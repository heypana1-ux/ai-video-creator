import { loadConcept, loadProject } from "@/lib/api/context";
import { handleAuthed } from "@/lib/api/route";

type Context = { params: Promise<{ projectId: string; conceptId: string }> };

export async function POST(_request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const { projectId, conceptId } = await context.params;
    const { repo, project } = await loadProject(session, projectId);
    await loadConcept(repo, session, project, conceptId);
    const concept = await repo.selectConcept(session.workspace.id, project.id, conceptId);
    return { concept };
  });
}
