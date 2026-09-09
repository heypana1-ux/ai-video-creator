import { ApiError } from "@/lib/api/errors";
import { handleAuthed } from "@/lib/api/route";
import { getRepository } from "@/lib/db";
import { cancelJob } from "@/lib/jobs/runner";

type Context = { params: Promise<{ jobId: string }> };

export async function POST(_request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const { jobId } = await context.params;
    const repo = await getRepository();

    // Ownership check first: a job id must never be cancellable cross-workspace.
    const generation = await repo.getGenerationJob(session.workspace.id, jobId);
    const render = generation ? null : await repo.getRenderJob(session.workspace.id, jobId);
    if (!generation && !render) throw ApiError.notFound("Job nicht gefunden.");

    const cancelled = cancelJob(jobId);
    if (!cancelled) {
      // Job already finished or this instance is not the one running it.
      const status = (generation ?? render)?.status;
      if (status === "queued" || status === "running") {
        if (generation) {
          await repo.updateGenerationJob(jobId, { status: "cancelled", step: "Abgebrochen" });
        } else {
          await repo.updateRenderJob(jobId, { status: "cancelled", step: "Abgebrochen" });
        }
      }
    }
    return { ok: true, cancelled };
  });
}
