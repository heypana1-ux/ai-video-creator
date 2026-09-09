import { isDemoMode } from "@/lib/config/env";
import { getDemoDriver, repositoryFor, type Repository } from "@/lib/db";
import { SupabaseTableDriver } from "@/lib/db/supabase-driver";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Background job runner.
 *
 * Jobs are started fire-and-forget and report progress by writing to the
 * `generation_jobs` / `render_jobs` tables; the UI polls those rows. That keeps
 * the client simple and means a reload never loses a running job.
 *
 * This runs in-process, which is the right size for a single node and for demo
 * mode. Swapping in a real queue (Inngest, QStash, pg-boss) means replacing
 * `startJob` - the pipelines and the API surface stay identical.
 */

const running = new Map<string, AbortController>();

export interface JobContext {
  jobId: string;
  signal: AbortSignal;
  repo: Repository;
  /** Persists progress for the UI. */
  report: (progress: number, step: string) => Promise<void>;
}

/**
 * Repository for background work.
 *
 * Request-scoped Supabase clients die with the request, so jobs use the
 * service-role client. Safe because every repository method filters by
 * `workspaceId` and the pipelines pass the workspace of the owning project.
 */
export function getBackgroundRepository(): Repository {
  if (isDemoMode()) return repositoryFor(getDemoDriver());
  const client = getSupabaseAdminClient();
  if (!client) return repositoryFor(getDemoDriver());
  return repositoryFor(new SupabaseTableDriver(client));
}

export function isJobRunning(jobId: string): boolean {
  return running.has(jobId);
}

export function cancelJob(jobId: string): boolean {
  const controller = running.get(jobId);
  if (!controller) return false;
  controller.abort();
  running.delete(jobId);
  return true;
}

export interface StartJobOptions {
  jobId: string;
  run: (context: JobContext) => Promise<void>;
  onError: (error: unknown, repo: Repository) => Promise<void>;
}

/** Starts a job in the background. Returns immediately. */
export function startJob(options: StartJobOptions): void {
  if (running.has(options.jobId)) return;

  const controller = new AbortController();
  running.set(options.jobId, controller);
  const repo = getBackgroundRepository();

  const context: JobContext = {
    jobId: options.jobId,
    signal: controller.signal,
    repo,
    report: async () => undefined,
  };

  void (async () => {
    try {
      await options.run(context);
    } catch (error) {
      try {
        await options.onError(error, repo);
      } catch (nested) {
        console.error("[jobs] error handler failed", nested);
      }
    } finally {
      running.delete(options.jobId);
    }
  })();
}

/**
 * Throttles progress writes so a fast job does not hammer the database.
 * Always lets the first and the final update through.
 */
export function throttleProgress(
  write: (progress: number, step: string) => Promise<void>,
  minIntervalMs = 400,
): (progress: number, step: string) => Promise<void> {
  let lastAt = 0;
  let lastStep = "";
  return async (progress, step) => {
    const now = Date.now();
    const important = progress >= 1 || step !== lastStep;
    if (!important && now - lastAt < minIntervalMs) return;
    lastAt = now;
    lastStep = step;
    await write(Math.max(0, Math.min(1, progress)), step);
  };
}
