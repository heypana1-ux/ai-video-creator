import { loadConcept, loadProject } from "@/lib/api/context";
import { handleAuthed, readJson } from "@/lib/api/route";
import { updateConceptSchema } from "@/lib/domain/schemas";
import { retimeConcept } from "@/lib/concepts/layout";

type Context = { params: Promise<{ projectId: string; conceptId: string }> };

export async function GET(_request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const { projectId, conceptId } = await context.params;
    const { repo, project } = await loadProject(session, projectId);
    return { concept: await loadConcept(repo, session, project, conceptId) };
  });
}

/** Saves editor changes. Scene durations are re-timed to the project length. */
export async function PATCH(request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const { projectId, conceptId } = await context.params;
    const { repo, project } = await loadProject(session, projectId);
    const concept = await loadConcept(repo, session, project, conceptId);
    const patch = updateConceptSchema.parse(await readJson(request));

    const scenes = patch.scenes
      ? retimeConcept({ ...concept, scenes: patch.scenes }, project.durationSeconds).scenes
      : undefined;

    const updated = await repo.updateConcept(session.workspace.id, conceptId, {
      ...patch,
      ...(scenes ? { scenes } : {}),
      ...(patch.scenes
        ? {
            voiceoverScript: patch.scenes
              .map((scene) => scene.voiceoverText.trim())
              .filter(Boolean)
              .join(" "),
          }
        : {}),
    });
    return { concept: updated };
  });
}
