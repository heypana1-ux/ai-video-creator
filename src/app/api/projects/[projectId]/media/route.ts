import { loadProject, resolveConcept } from "@/lib/api/context";
import { ApiError } from "@/lib/api/errors";
import { clientKey, rateLimit } from "@/lib/api/rate-limit";
import { handleAuthed, readJson } from "@/lib/api/route";
import { serverEnv } from "@/lib/config/env";
import { startMediaJob } from "@/lib/jobs/pipelines";

type Context = { params: Promise<{ projectId: string }> };

/** Generates visuals, voice-over and music for a concept. */
export async function POST(request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const limit = rateLimit(
      clientKey(request, `media:${session.workspace.id}`),
      serverEnv.rateLimits.generationPerMin,
    );
    if (!limit.allowed) throw ApiError.tooManyRequests();

    const { projectId } = await context.params;
    const { repo, project } = await loadProject(session, projectId);
    const body = await readJson<{ conceptId?: string }>(request).catch(
      () => ({}) as { conceptId?: string },
    );
    const concept = await resolveConcept(repo, session, project, body.conceptId);

    const { job, estimate } = await startMediaJob({
      repo,
      workspaceId: session.workspace.id,
      project,
      concept,
    });
    return { job, estimate };
  });
}
