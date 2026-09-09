import { loadProject, resolveConcept } from "@/lib/api/context";
import { ApiError } from "@/lib/api/errors";
import { clientKey, rateLimit } from "@/lib/api/rate-limit";
import { handleAuthed, readJson } from "@/lib/api/route";
import { serverEnv } from "@/lib/config/env";
import { startRenderJob } from "@/lib/jobs/pipelines";
import { startRenderSchema } from "@/lib/domain/schemas";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const { projectId } = await context.params;
    const { repo, project } = await loadProject(session, projectId);
    const [renderJobs, exports] = await Promise.all([
      repo.listRenderJobs(session.workspace.id, project.id),
      repo.listExports(session.workspace.id, project.id),
    ]);
    return { renderJobs, exports };
  });
}

export async function POST(request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const limit = rateLimit(
      clientKey(request, `render:${session.workspace.id}`),
      serverEnv.rateLimits.generationPerMin,
    );
    if (!limit.allowed) throw ApiError.tooManyRequests();

    const { projectId } = await context.params;
    const { repo, project } = await loadProject(session, projectId);
    const body = startRenderSchema.partial({ conceptId: true }).parse(await readJson(request));
    const concept = await resolveConcept(repo, session, project, body.conceptId);

    if (concept.scenes.length === 0) {
      throw ApiError.badRequest("Das Konzept enthält keine Szenen.");
    }

    const { job, estimate } = await startRenderJob({
      repo,
      workspaceId: session.workspace.id,
      project,
      concept,
      quality: body.quality ?? "preview",
    });
    return { job, estimate };
  });
}
