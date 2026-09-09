import { ProviderError } from "../errors";

/**
 * Shared helpers for the mock providers.
 *
 * Mocks deliberately simulate latency and progress so the UI's job states,
 * progress bars and cancel buttons are exercised exactly like they would be
 * against a real provider. Set `ADREEL_MOCK_LATENCY_MS=0` in tests.
 */

export function mockLatencyMs(fallback: number): number {
  const raw = process.env.ADREEL_MOCK_LATENCY_MS;
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** Sleeps in small steps, reporting progress and honouring cancellation. */
export async function simulateWork(
  totalMs: number,
  signal: AbortSignal,
  onProgress: (progress: number, step: string) => void,
  steps: string[],
): Promise<void> {
  if (totalMs <= 0) {
    onProgress(1, steps[steps.length - 1] ?? "Fertig");
    return;
  }
  const chunks = Math.max(steps.length, 6);
  const chunkMs = totalMs / chunks;

  for (let i = 0; i < chunks; i += 1) {
    if (signal.aborted) {
      throw new ProviderError("cancelled", "mock", "Abgebrochen", { retryable: false });
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, chunkMs);
      function onAbort() {
        clearTimeout(timer);
        reject(new ProviderError("cancelled", "mock", "Abgebrochen", { retryable: false }));
      }
      signal.addEventListener("abort", onAbort, { once: true });
    });
    const step = steps[Math.min(steps.length - 1, Math.floor((i / chunks) * steps.length))];
    onProgress((i + 1) / chunks, step ?? "Wird verarbeitet");
  }
}

/** Stable storage key so regenerating the same input reuses the same object. */
export function demoKey(namespace: string, fingerprint: string, extension: string): string {
  return `demo/${namespace}/${fingerprint}.${extension}`;
}
