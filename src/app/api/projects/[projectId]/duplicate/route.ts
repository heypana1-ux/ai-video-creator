import { loadProject } from "@/lib/api/context";
import { handleAuthed } from "@/lib/api/route";
import { randomId } from "@/lib/util/id";

type Context = { params: Promise<{ projectId: string }> };

/**
 * Duplicates a project including its concepts and scenes. Generated media is
 * re-used by reference; nothing is copied in storage.
 */
export async function POST(_request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const { projectId } = await context.params;
    const { repo, project } = await loadProject(session, projectId);

    const copy = await repo.createProject({
      id: randomId("prj"),
      workspaceId: session.workspace.id,
      ownerId: session.user.id,
      name: `${project.name} (Kopie)`,
      category: project.category,
      status: "draft",
      brief: { ...project.brief, name: `${project.brief.name} (Kopie)` },
      selectedConceptId: null,
      thumbnailUrl: project.thumbnailUrl,
      durationSeconds: project.durationSeconds,
      brandKitId: project.brandKitId,
    });

    const concepts = await repo.listConcepts(session.workspace.id, project.id);
    const cloned = concepts.map((concept) => ({
      ...concept,
      id: randomId("cpt"),
      projectId: copy.id,
      selected: false,
      scenes: concept.scenes.map((scene) => ({ ...scene, id: randomId("scn") })),
    }));
    if (cloned.length > 0) {
      await repo.replaceConcepts(session.workspace.id, copy.id, cloned);
    }

    return { project: copy };
  });
}
