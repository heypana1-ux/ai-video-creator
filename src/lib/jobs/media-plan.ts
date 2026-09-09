import type { Asset, Concept, Project, Scene } from "@/lib/domain/schemas";

/**
 * Decides how each scene's background media is produced.
 *
 * Scenes that reference user material use the uploaded asset when one exists;
 * otherwise they fall back to AI generation from the scene's media prompt, so
 * the workflow never stalls because a user skipped an upload.
 */

export type MediaAction =
  | { kind: "asset"; assetId: string }
  | { kind: "image" }
  | { kind: "video" }
  | { kind: "gradient" };

export interface ScenePlanEntry {
  sceneId: string;
  action: MediaAction;
  prompt: string;
}

/** Assets the brief points at, in the order they should be consumed. */
export function candidateAssetIds(project: Project, sourceKind: Scene["source"]["kind"]): string[] {
  const brief = project.brief;
  switch (sourceKind) {
    case "app_screenshot":
      return brief.category === "app"
        ? [...brief.details.screenRecordingAssetIds, ...brief.details.screenshotAssetIds]
        : brief.mediaAssetIds;
    case "user_upload":
      if (brief.category === "music") {
        return [brief.details.coverAssetId, ...brief.mediaAssetIds].filter(
          (id): id is string => Boolean(id),
        );
      }
      return brief.mediaAssetIds;
    default:
      return [];
  }
}

export function planSceneMedia(
  project: Project,
  concept: Concept,
  availableAssets: Asset[],
): ScenePlanEntry[] {
  const availableIds = new Set(availableAssets.map((asset) => asset.id));
  const consumed = new Set<string>();

  return [...concept.scenes]
    .sort((a, b) => a.index - b.index)
    .map((scene) => {
      // An explicit choice in the editor always wins.
      if (scene.source.assetId && availableIds.has(scene.source.assetId)) {
        return {
          sceneId: scene.id,
          action: { kind: "asset", assetId: scene.source.assetId } as MediaAction,
          prompt: scene.source.prompt,
        };
      }

      if (scene.source.kind === "color_gradient") {
        return { sceneId: scene.id, action: { kind: "gradient" } as MediaAction, prompt: "" };
      }

      const candidates = candidateAssetIds(project, scene.source.kind).filter(
        (id) => availableIds.has(id) && !consumed.has(id),
      );
      if (candidates.length > 0) {
        consumed.add(candidates[0]);
        return {
          sceneId: scene.id,
          action: { kind: "asset", assetId: candidates[0] } as MediaAction,
          prompt: scene.source.prompt,
        };
      }

      return {
        sceneId: scene.id,
        action: { kind: scene.source.kind === "ai_video" ? "video" : "image" } as MediaAction,
        prompt: scene.source.prompt || scene.visualDescription || concept.title,
      };
    });
}

/** Total seconds of AI video in the plan - drives the credit estimate. */
export function plannedVideoSeconds(concept: Concept, plan: ScenePlanEntry[]): number {
  const byId = new Map(concept.scenes.map((scene) => [scene.id, scene]));
  return plan
    .filter((entry) => entry.action.kind === "video")
    .reduce((sum, entry) => sum + (byId.get(entry.sceneId)?.durationMs ?? 0) / 1000, 0);
}

export function plannedImageCount(plan: ScenePlanEntry[]): number {
  return plan.filter((entry) => entry.action.kind === "image").length;
}
