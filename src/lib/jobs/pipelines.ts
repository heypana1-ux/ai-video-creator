import { promises as fs } from "node:fs";
import path from "node:path";

import { getProviders, mediaRoot } from "@/lib/ai/registry";
import type { ProviderResultMeta } from "@/lib/ai/types";
import { ApiError } from "@/lib/api/errors";
import { estimateCredits, type CreditEstimate } from "@/lib/credits/pricing";
import type { Repository } from "@/lib/db";
import type { Asset, Concept, GenerationJob, Project, RenderJob, Scene } from "@/lib/domain/schemas";
import type { ExportQuality } from "@/lib/domain/enums";
import { generateConcepts } from "@/lib/concepts/engine";
import { randomId } from "@/lib/util/id";
import { estimateSpeechDurationMs } from "@/lib/video/captions";
import { FINAL_SIZE, PREVIEW_SIZE, buildVideoSpec, msToFrames } from "@/lib/video/spec";
import { getVideoStyle } from "@/lib/video/styles";

import { refundCredits, reserveCredits } from "./credits";
import { planSceneMedia, plannedImageCount, plannedVideoSeconds } from "./media-plan";
import { startJob, throttleProgress, type JobContext } from "./runner";

/**
 * The three background pipelines: concept generation, media generation and
 * rendering. Each one reserves credits, writes progress to its job row and
 * refunds on failure or cancellation.
 */

async function recordUsage(
  repo: Repository,
  workspaceId: string,
  projectId: string,
  meta: ProviderResultMeta | null,
  success: boolean,
): Promise<void> {
  if (!meta) return;
  await repo.recordProviderUsage({
    workspaceId,
    projectId,
    providerKind: meta.providerKind,
    providerId: meta.providerId,
    operation: meta.operation,
    providerJobId: meta.providerJobId,
    durationMs: meta.durationMs,
    estimatedCostUsd: meta.cost.estimatedUsd,
    credits: meta.cost.credits,
    success,
  });
}

function isCancellation(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      /abgebrochen|cancelled/i.test(error.message))
  );
}

function userMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unbekannter Fehler";
}

/* -------------------------------------------------------------------------- */
/* Concepts                                                                   */
/* -------------------------------------------------------------------------- */

export function estimateForConcepts(): CreditEstimate {
  return estimateCredits({ concepts: 1 });
}

export async function startConceptsJob(input: {
  repo: Repository;
  workspaceId: string;
  project: Project;
  extraPrompt?: string;
  styleId?: string;
}): Promise<{ job: GenerationJob; estimate: CreditEstimate }> {
  const { repo, workspaceId, project } = input;

  const { estimate } = await reserveCredits(repo, {
    workspaceId,
    projectId: project.id,
    plan: { concepts: 1 },
    reason: `Konzepte für „${project.name}“`,
  });

  const job = await repo.createGenerationJob({
    workspaceId,
    projectId: project.id,
    kind: "concepts",
  });
  await repo.updateGenerationJob(job.id, { creditsSpent: estimate.total });
  await repo.setProjectStatus(workspaceId, project.id, "concept_generating");

  startJob({
    jobId: job.id,
    run: async (context: JobContext) => {
      const report = throttleProgress((progress, step) =>
        context.repo.updateGenerationJob(job.id, { progress, step, status: "running" }).then(
          () => undefined,
        ),
      );
      await report(0.02, "Briefing wird gelesen");

      const providers = getProviders();
      const result = await generateConcepts(
        providers.text,
        {
          brief: project.brief,
          projectId: project.id,
          count: 3,
          extraPrompt: input.extraPrompt,
          styleId: input.styleId,
        },
        { signal: context.signal, onProgress: (progress, step) => void report(progress * 0.9, step) },
      );

      await report(0.94, "Konzepte werden gespeichert");
      await context.repo.replaceConcepts(workspaceId, project.id, result.concepts);
      await recordUsage(context.repo, workspaceId, project.id, result.meta, true);

      await context.repo.setProjectStatus(workspaceId, project.id, "draft");
      await context.repo.updateGenerationJob(job.id, {
        status: "succeeded",
        progress: 1,
        step: result.usedFallback
          ? "Fertig (Demo-Generator verwendet)"
          : "Konzepte sind fertig",
        error: result.usedFallback ? result.fallbackReason : null,
        resultRef: result.concepts[0]?.id ?? null,
      });
    },
    onError: async (error, repo2) => {
      const cancelled = isCancellation(error);
      await refundCredits(repo2, {
        workspaceId,
        projectId: project.id,
        amount: estimate.total,
        reason: cancelled ? "Konzepte abgebrochen" : "Konzepte fehlgeschlagen",
      });
      await repo2.updateGenerationJob(job.id, {
        status: cancelled ? "cancelled" : "failed",
        step: cancelled ? "Abgebrochen" : "Fehlgeschlagen",
        error: cancelled ? null : userMessage(error),
      });
      await repo2.setProjectStatus(workspaceId, project.id, cancelled ? "draft" : "failed");
    },
  });

  return { job, estimate };
}

/* -------------------------------------------------------------------------- */
/* Scene media, voice-over and music                                          */
/* -------------------------------------------------------------------------- */

export function estimateForMedia(
  project: Project,
  concept: Concept,
  assets: Asset[],
): CreditEstimate {
  const plan = planSceneMedia(project, concept, assets);
  return estimateCredits({
    images: plannedImageCount(plan),
    videoClipSeconds: plannedVideoSeconds(concept, plan),
    voiceoverSeconds: concept.scenes.reduce(
      (sum, scene) => sum + (scene.voiceoverText.trim() ? scene.durationMs / 1000 : 0),
      0,
    ),
    musicTracks: 1,
  });
}

export async function startMediaJob(input: {
  repo: Repository;
  workspaceId: string;
  project: Project;
  concept: Concept;
}): Promise<{ job: GenerationJob; estimate: CreditEstimate }> {
  const { repo, workspaceId, project, concept } = input;
  // Brief assets may be workspace-level (uploaded before the project existed),
  // so the whole workspace library is considered.
  const assets = await repo.listAssets(workspaceId);
  const plan = planSceneMedia(project, concept, assets);

  const { estimate } = await reserveCredits(repo, {
    workspaceId,
    projectId: project.id,
    plan: {
      images: plannedImageCount(plan),
      videoClipSeconds: plannedVideoSeconds(concept, plan),
      voiceoverSeconds: concept.scenes.reduce(
        (sum, scene) => sum + (scene.voiceoverText.trim() ? scene.durationMs / 1000 : 0),
        0,
      ),
      musicTracks: 1,
    },
    reason: `Medien für „${concept.title}“`,
  });

  const job = await repo.createGenerationJob({
    workspaceId,
    projectId: project.id,
    kind: "scene_media",
  });
  await repo.updateGenerationJob(job.id, { creditsSpent: estimate.total });
  await repo.setProjectStatus(workspaceId, project.id, "media_generating");

  startJob({
    jobId: job.id,
    run: async (context) => {
      const report = throttleProgress((progress, step) =>
        context.repo
          .updateGenerationJob(job.id, { progress, step, status: "running" })
          .then(() => undefined),
      );

      const providers = getProviders();
      const style = getVideoStyle(concept.styleId);
      const assetById = new Map(assets.map((asset) => [asset.id, asset]));
      const scenesById = new Map(concept.scenes.map((scene) => [scene.id, scene]));

      const totalSteps = plan.length * 2 + 1;
      let completed = 0;
      const tick = async (step: string) => {
        completed += 1;
        await report(Math.min(0.97, completed / totalSteps), step);
      };

      const updatedScenes: Scene[] = [];

      for (const entry of plan) {
        const scene = scenesById.get(entry.sceneId);
        if (!scene) continue;
        const next: Scene = { ...scene };

        if (entry.action.kind === "asset") {
          const asset = assetById.get(entry.action.assetId);
          if (asset) {
            next.source = {
              ...next.source,
              assetId: asset.id,
              url: asset.url,
              isDemo: asset.isDemo,
            };
          }
          await tick(`Medium für „${scene.title}“ übernommen`);
        } else if (entry.action.kind === "video") {
          const result = await providers.video.generate(
            {
              prompt: entry.prompt,
              durationMs: scene.durationMs,
              width: FINAL_SIZE.width,
              height: FINAL_SIZE.height,
              styleHint: style.id,
              palette: style.gradient,
            },
            { signal: context.signal },
          );
          next.source = {
            ...next.source,
            url: result.data.url,
            assetId: null,
            isDemo: result.data.isDemo,
          };
          await recordUsage(context.repo, workspaceId, project.id, result.meta, true);
          await tick(`Clip für „${scene.title}“ erzeugt`);
        } else if (entry.action.kind === "image") {
          const result = await providers.image.generate(
            {
              prompt: entry.prompt,
              width: FINAL_SIZE.width,
              height: FINAL_SIZE.height,
              styleHint: style.id,
              palette: style.gradient,
            },
            { signal: context.signal },
          );
          next.source = {
            ...next.source,
            url: result.data.url,
            assetId: null,
            isDemo: result.data.isDemo,
          };
          await recordUsage(context.repo, workspaceId, project.id, result.meta, true);
          await tick(`Bild für „${scene.title}“ erzeugt`);
        } else {
          await tick(`Hintergrund für „${scene.title}“ gesetzt`);
        }

        if (scene.voiceoverText.trim()) {
          const result = await providers.voice.synthesize(
            {
              text: scene.voiceoverText,
              language: project.brief.language,
              targetDurationMs: Math.min(
                scene.durationMs,
                Math.max(
                  600,
                  estimateSpeechDurationMs(scene.voiceoverText, project.brief.language),
                ),
              ),
            },
            { signal: context.signal },
          );
          next.voiceoverUrl = result.data.url;
          next.voiceoverWords = result.data.words;
          await recordUsage(context.repo, workspaceId, project.id, result.meta, true);
          await tick(`Voice-over für „${scene.title}“ erzeugt`);
        } else {
          next.voiceoverUrl = null;
          next.voiceoverWords = [];
          await tick(`Szene „${scene.title}“ ohne Voice-over`);
        }

        updatedScenes.push(next);
      }

      await report(0.9, "Hintergrundmusik wird erzeugt");
      const totalMs = updatedScenes.reduce((sum, scene) => sum + scene.durationMs, 0);
      const music = await providers.music.generate(
        {
          mood: project.brief.category === "music" ? project.brief.details.mood : project.brief.tone,
          genre: project.brief.category === "music" ? project.brief.details.genre : "",
          durationMs: totalMs,
          energy:
            project.brief.tone === "aggressive" || project.brief.tone === "futuristic"
              ? 0.85
              : project.brief.tone === "minimalistic" || project.brief.tone === "luxurious"
                ? 0.3
                : 0.6,
        },
        { signal: context.signal },
      );
      await recordUsage(context.repo, workspaceId, project.id, music.meta, true);

      await report(0.97, "Ergebnisse werden gespeichert");
      await context.repo.updateConcept(workspaceId, concept.id, {
        scenes: updatedScenes,
        musicUrl: music.data.url,
      });

      const thumbnail = updatedScenes.find((scene) => scene.source.url)?.source.url ?? null;
      await context.repo.updateProject(workspaceId, project.id, {
        status: "draft",
        thumbnailUrl: thumbnail,
      });

      await context.repo.updateGenerationJob(job.id, {
        status: "succeeded",
        progress: 1,
        step: "Medien sind fertig",
        resultRef: concept.id,
      });
    },
    onError: async (error, repo2) => {
      const cancelled = isCancellation(error);
      await refundCredits(repo2, {
        workspaceId,
        projectId: project.id,
        amount: estimate.total,
        reason: cancelled ? "Medien abgebrochen" : "Medien fehlgeschlagen",
      });
      await repo2.updateGenerationJob(job.id, {
        status: cancelled ? "cancelled" : "failed",
        step: cancelled ? "Abgebrochen" : "Fehlgeschlagen",
        error: cancelled ? null : userMessage(error),
      });
      await repo2.setProjectStatus(workspaceId, project.id, cancelled ? "draft" : "failed");
    },
  });

  return { job, estimate };
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

export function estimateForRender(quality: ExportQuality): CreditEstimate {
  return estimateCredits(quality === "final" ? { renderFinals: 1 } : { renderPreviews: 1 });
}

export async function startRenderJob(input: {
  repo: Repository;
  workspaceId: string;
  project: Project;
  concept: Concept;
  quality: ExportQuality;
}): Promise<{ job: RenderJob; estimate: CreditEstimate }> {
  const { repo, workspaceId, project, concept, quality } = input;

  const { estimate } = await reserveCredits(repo, {
    workspaceId,
    projectId: project.id,
    plan: quality === "final" ? { renderFinals: 1 } : { renderPreviews: 1 },
    reason: `${quality === "final" ? "Export" : "Vorschau"} für „${project.name}“`,
  });

  const job = await repo.createRenderJob({
    workspaceId,
    projectId: project.id,
    conceptId: concept.id,
    quality,
  });
  await repo.updateRenderJob(job.id, { creditsSpent: estimate.total });
  await repo.setProjectStatus(workspaceId, project.id, "rendering");

  startJob({
    jobId: job.id,
    run: async (context) => {
      const report = throttleProgress((progress, step) =>
        context.repo
          .updateRenderJob(job.id, { progress, step, status: "running" })
          .then(() => undefined),
      );
      await report(0.01, "Video wird vorbereitet");

      const providers = getProviders();
      const spec = buildVideoSpec(project, concept, {
        quality,
        // Empty means "resolve through Remotion's staticFile" - see resolve.ts.
        assetBaseUrl: "",
        music: concept.musicUrl
          ? { src: concept.musicUrl, volume: getVideoStyle(concept.styleId).audioMix.musicVolume }
          : null,
      });

      const exportId = randomId("exp");
      const storageKey = `renders/${exportId}.mp4`;
      const outputPath = path.join(mediaRoot(), storageKey);

      const result = await providers.render.render(
        {
          spec,
          width: spec.width,
          height: spec.height,
          fps: spec.fps,
          durationInFrames: spec.durationInFrames,
          outputPath,
        },
        {
          signal: context.signal,
          onProgress: (progress, step) => void report(0.02 + progress * 0.95, step),
        },
      );
      await recordUsage(context.repo, workspaceId, project.id, result.meta, true);

      // With remote storage the renderer still writes locally first, because it
      // needs a real file path. Move it into the storage provider afterwards.
      let url = `/api/media/${storageKey}`;
      if (providers.storage.localPath(storageKey) !== outputPath) {
        const bytes = new Uint8Array(await fs.readFile(outputPath));
        const stored = await providers.storage.put(storageKey, bytes, "video/mp4");
        url = stored.url;
        await fs.rm(outputPath, { force: true });
      }

      await report(0.99, "Export wird abgelegt");
      const videoExport = await context.repo.createExport({
        id: exportId,
        workspaceId,
        projectId: project.id,
        renderJobId: job.id,
        quality,
        width: result.data.width,
        height: result.data.height,
        fps: result.data.fps,
        durationMs: result.data.durationMs,
        byteSize: result.data.byteSize,
        url,
        storageKey,
        isDemo: spec.demoWatermark !== null,
      });

      await context.repo.updateRenderJob(job.id, {
        status: "succeeded",
        progress: 1,
        step: "Video ist fertig",
        exportId: videoExport.id,
      });
      await context.repo.updateProject(workspaceId, project.id, { status: "ready" });
    },
    onError: async (error, repo2) => {
      const cancelled = isCancellation(error);
      await refundCredits(repo2, {
        workspaceId,
        projectId: project.id,
        amount: estimate.total,
        reason: cancelled ? "Rendering abgebrochen" : "Rendering fehlgeschlagen",
      });
      await repo2.updateRenderJob(job.id, {
        status: cancelled ? "cancelled" : "failed",
        step: cancelled ? "Abgebrochen" : "Fehlgeschlagen",
        error: cancelled ? null : userMessage(error),
      });
      await repo2.setProjectStatus(workspaceId, project.id, cancelled ? "draft" : "failed");
    },
  });

  return { job, estimate };
}

/** Frames a concept will produce at the given quality - shown in the UI. */
export function renderFrameCount(concept: Concept): number {
  return concept.scenes.reduce((sum, scene) => sum + msToFrames(scene.durationMs), 0);
}

export { FINAL_SIZE, PREVIEW_SIZE };
