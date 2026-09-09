import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Wires the environment for a route-handler integration test: forced demo mode,
 * a throwaway data directory and instant mock providers.
 */
export function prepareIsolatedDataDir(): { dir: string; cleanup: () => Promise<void> } {
  const dir = path.join(".adreel", "test", randomUUID());
  process.env.ADREEL_FORCE_DEMO = "1";
  process.env.ADREEL_DATA_DIR = dir;
  process.env.ADREEL_MOCK_LATENCY_MS = "0";
  process.env.ADREEL_RENDER_PROVIDER = "mock";
  process.env.AUTH_SECRET = "integration-test-secret-0123456789";

  return {
    dir,
    cleanup: async () => {
      await fs.rm(path.resolve(process.cwd(), dir), { recursive: true, force: true });
    },
  };
}

export function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

/** Polls a job route until it leaves the queued/running state. */
export async function waitForJob(
  getJob: (jobId: string) => Promise<{ status: string }>,
  jobId: string,
  timeoutMs = 20_000,
): Promise<{ status: string }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const job = await getJob(jobId);
    if (job.status !== "queued" && job.status !== "running") return job;
    if (Date.now() > deadline) throw new Error(`Job ${jobId} timed out in status ${job.status}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
