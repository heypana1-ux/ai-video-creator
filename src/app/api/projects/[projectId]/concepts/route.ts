import { loadProject } from "@/lib/api/context";
import { ApiError } from "@/lib/api/errors";
import { clientKey, rateLimit } from "@/lib/api/rate-limit";
import { handleAuthed, readJson } from "@/lib/api/route";
import { serverEnv } from "@/lib/config/env";
import { startConceptsJob } from "@/lib/jobs/pipelines";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const { projectId } = await context.params;
    const { repo, project } = await loadProject(session, projectId);
    return { concepts: await repo.listConcepts(session.workspace.id, project.id) };
  });
}

/** Starts a background job that generates three concepts. */
export async function POST(request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const limit = rateLimit(
      clientKey(request, `concepts:${session.workspace.id}`),
      serverEnv.rateLimits.generationPerMin,
    );
    if (!limit.allowed) throw ApiError.tooManyRequests();

    const { projectId } = await context.params;
    const { repo, project } = await loadProject(session, projectId);
    const body = await readJson<{ extraPrompt?: string; styleId?: string }>(request).catch(
      () => ({}) as { extraPrompt?: string; styleId?: string },
    );

    const { job, estimate } = await startConceptsJob({
      repo,
      workspaceId: session.workspace.id,
      project,
      extraPrompt: body.extraPrompt?.slice(0, 1200),
      styleId: body.styleId,
    });
    return { job, estimate };
  });
}
