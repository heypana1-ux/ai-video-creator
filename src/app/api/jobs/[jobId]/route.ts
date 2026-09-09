import { ApiError } from "@/lib/api/errors";
import { handleAuthed } from "@/lib/api/route";
import { getRepository } from "@/lib/db";
import { isJobRunning } from "@/lib/jobs/runner";

type Context = { params: Promise<{ jobId: string }> };

/** Polled by the UI. Resolves either a generation job or a render job. */
export async function GET(_request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const { jobId } = await context.params;
    const repo = await getRepository();

    const generation = await repo.getGenerationJob(session.workspace.id, jobId);
    if (generation) {
      return { type: "generation" as const, job: generation, running: isJobRunning(jobId) };
    }

    const render = await repo.getRenderJob(session.workspace.id, jobId);
    if (render) {
      const videoExport = render.exportId
        ? await repo.getExport(session.workspace.id, render.exportId)
        : null;
      return {
        type: "render" as const,
        job: render,
        export: videoExport,
        running: isJobRunning(jobId),
      };
    }

    throw ApiError.notFound("Job nicht gefunden.");
  });
}
