import { getProviders } from "@/lib/ai/registry";
import { loadConcept, loadProject } from "@/lib/api/context";
import { ApiError } from "@/lib/api/errors";
import { clientKey, rateLimit } from "@/lib/api/rate-limit";
import { handleAuthed, readJson } from "@/lib/api/route";
import { serverEnv } from "@/lib/config/env";
import { estimateCredits } from "@/lib/credits/pricing";
import { reserveCredits } from "@/lib/jobs/credits";
import { FINAL_SIZE } from "@/lib/video/spec";
import { getVideoStyle } from "@/lib/video/styles";

type Context = {
  params: Promise<{ projectId: string; conceptId: string; sceneId: string }>;
};

/**
 * Regenerates a single scene's background media. Runs inline because one image
 * is quick; AI video clips go through the media job instead.
 */
export async function POST(request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const limit = rateLimit(
      clientKey(request, `scene:${session.workspace.id}`),
      serverEnv.rateLimits.generationPerMin,
    );
    if (!limit.allowed) throw ApiError.tooManyRequests();

    const { projectId, conceptId, sceneId } = await context.params;
    const { repo, project } = await loadProject(session, projectId);
    const concept = await loadConcept(repo, session, project, conceptId);

    const scene = concept.scenes.find((candidate) => candidate.id === sceneId);
    if (!scene) throw ApiError.notFound("Szene nicht gefunden.");

    const body = await readJson<{ prompt?: string }>(request).catch(() => ({}) as { prompt?: string });
    const prompt =
      body.prompt?.trim() || scene.source.prompt || scene.visualDescription || concept.title;

    await reserveCredits(repo, {
      workspaceId: session.workspace.id,
      projectId: project.id,
      plan: { images: 1 },
      reason: `Szene „${scene.title}“ neu generiert`,
    });

    const style = getVideoStyle(concept.styleId);
    const providers = getProviders();
    const result = await providers.image.generate({
      prompt,
      width: FINAL_SIZE.width,
      height: FINAL_SIZE.height,
      styleHint: style.id,
      palette: style.gradient,
      // A new seed on every call, otherwise the mock returns the same artwork.
      seed: Math.floor(Math.random() * 1_000_000),
    });

    const updated = await repo.updateScene(session.workspace.id, sceneId, {
      source: {
        ...scene.source,
        assetId: null,
        url: result.data.url,
        prompt,
        isDemo: result.data.isDemo,
      },
    });

    await repo.recordProviderUsage({
      workspaceId: session.workspace.id,
      projectId: project.id,
      providerKind: result.meta.providerKind,
      providerId: result.meta.providerId,
      operation: result.meta.operation,
      providerJobId: result.meta.providerJobId,
      durationMs: result.meta.durationMs,
      estimatedCostUsd: result.meta.cost.estimatedUsd,
      credits: result.meta.cost.credits,
      success: true,
    });

    return { scene: updated, estimate: estimateCredits({ images: 1 }) };
  });
}
