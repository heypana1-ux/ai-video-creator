import { loadProject, resolveConcept } from "@/lib/api/context";
import { ApiError } from "@/lib/api/errors";
import { handleAuthed } from "@/lib/api/route";
import {
  estimateForConcepts,
  estimateForMedia,
  estimateForRender,
} from "@/lib/jobs/pipelines";

type Context = { params: Promise<{ projectId: string }> };

/**
 * Credit preview for a paid operation. The UI calls this before showing the
 * confirm dialog, so the cost is always visible before anything is charged.
 */
export async function GET(request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const { projectId } = await context.params;
    const { repo, project } = await loadProject(session, projectId);

    const url = new URL(request.url);
    const operation = url.searchParams.get("operation") ?? "concepts";
    const conceptId = url.searchParams.get("conceptId");

    if (operation === "concepts") {
      return { estimate: estimateForConcepts(), balance: session.workspace.credits };
    }
    if (operation === "media") {
      const concept = await resolveConcept(repo, session, project, conceptId);
      const assets = await repo.listAssets(session.workspace.id);
      return {
        estimate: estimateForMedia(project, concept, assets),
        balance: session.workspace.credits,
      };
    }
    if (operation === "render") {
      const quality = url.searchParams.get("quality") === "final" ? "final" : "preview";
      return { estimate: estimateForRender(quality), balance: session.workspace.credits };
    }
    throw ApiError.badRequest("Unbekannte Operation.");
  });
}
