import { serverEnv } from "@/lib/config/env";

import { ProviderError, isProviderError } from "./errors";
import { logProvider } from "./logging";
import type {
  ProviderCallOptions,
  ProviderCost,
  ProviderKind,
  ProviderResult,
} from "./types";

export interface ExecuteConfig<T> {
  providerId: string;
  kind: ProviderKind;
  operation: string;
  isDemo: boolean;
  /** How much this call costs when it succeeds. */
  cost: ProviderCost;
  /** Runs one attempt. Must honour `signal`. */
  attempt: (context: {
    signal: AbortSignal;
    attempt: number;
    setProviderJobId: (id: string) => void;
    onProgress: (progress: number, step: string) => void;
  }) => Promise<T>;
  maxRetries?: number;
  timeoutMs?: number;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new ProviderError("cancelled", "runtime", "Abgebrochen"));
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Rejects as soon as `signal` aborts, and never settles otherwise.
 *
 * Racing this against the attempt is what actually enforces the timeout: an
 * adapter that ignores its `signal` would otherwise hang the whole job.
 */
function rejectOnAbort(signal: AbortSignal, providerId: string): {
  promise: Promise<never>;
  dispose: () => void;
} {
  let onAbort: (() => void) | null = null;
  const promise = new Promise<never>((_resolve, reject) => {
    onAbort = () =>
      reject(new ProviderError("timeout", providerId, "Zeitüberschreitung oder Abbruch"));
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
  return {
    promise,
    dispose: () => {
      if (onAbort) signal.removeEventListener("abort", onAbort);
    },
  };
}

/** Full jitter exponential backoff, capped at 10s. */
export function backoffDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(10_000, 500 * 2 ** (attempt - 1));
  return Math.round(base / 2 + random() * (base / 2));
}

/**
 * Runs a provider call with timeout, cancellation, retry-with-backoff,
 * structured logging and cost metadata. Every adapter goes through this so the
 * behaviour is identical no matter which vendor is plugged in.
 */
export async function executeProviderCall<T>(
  config: ExecuteConfig<T>,
  options: ProviderCallOptions = {},
): Promise<ProviderResult<T>> {
  const maxRetries = config.maxRetries ?? serverEnv.providerMaxRetries;
  const timeoutMs =
    options.timeoutMs ?? config.timeoutMs ?? serverEnv.providerTimeoutMs;

  const startedAt = Date.now();
  let providerJobId: string | null = null;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    if (options.signal?.aborted) {
      throw new ProviderError("cancelled", config.providerId, "Abgebrochen");
    }

    const controller = new AbortController();
    const onOuterAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onOuterAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const attemptStart = Date.now();

    logProvider({
      providerId: config.providerId,
      kind: config.kind,
      operation: config.operation,
      attempt,
      status: "start",
    });

    const abortRace = rejectOnAbort(controller.signal, config.providerId);

    try {
      const data = await Promise.race([
        config.attempt({
          signal: controller.signal,
          attempt,
          setProviderJobId: (id) => {
            providerJobId = id;
          },
          onProgress: (progress, step) => options.onProgress?.(progress, step),
        }),
        abortRace.promise,
      ]);

      logProvider({
        providerId: config.providerId,
        kind: config.kind,
        operation: config.operation,
        attempt,
        status: "success",
        durationMs: Date.now() - attemptStart,
        providerJobId,
      });

      return {
        data,
        meta: {
          providerId: config.providerId,
          providerKind: config.kind,
          operation: config.operation,
          providerJobId,
          durationMs: Date.now() - startedAt,
          cost: config.cost,
          isDemo: config.isDemo,
          attempts: attempt,
        },
      };
    } catch (rawError) {
      const error = normaliseError(rawError, config.providerId, {
        aborted: controller.signal.aborted,
        cancelledByCaller: options.signal?.aborted ?? false,
      });
      lastError = error;

      const willRetry = error.retryable && attempt <= maxRetries;
      logProvider({
        providerId: config.providerId,
        kind: config.kind,
        operation: config.operation,
        attempt,
        status: willRetry ? "retry" : "error",
        durationMs: Date.now() - attemptStart,
        detail: `${error.code}: ${error.message}`,
        providerJobId,
      });

      if (!willRetry) throw error;

      await sleep(backoffDelayMs(attempt), options.signal ?? new AbortController().signal);
    } finally {
      clearTimeout(timer);
      abortRace.dispose();
      options.signal?.removeEventListener("abort", onOuterAbort);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ProviderError("upstream_error", config.providerId, "Unbekannter Fehler");
}

function normaliseError(
  raw: unknown,
  providerId: string,
  context: { aborted: boolean; cancelledByCaller: boolean },
): ProviderError {
  if (isProviderError(raw)) return raw;

  const isAbort =
    raw instanceof Error && (raw.name === "AbortError" || raw.name === "TimeoutError");

  if (isAbort || context.aborted) {
    return context.cancelledByCaller
      ? new ProviderError("cancelled", providerId, "Abgebrochen", { retryable: false })
      : new ProviderError("timeout", providerId, "Zeitüberschreitung");
  }

  const message = raw instanceof Error ? raw.message : String(raw);
  return new ProviderError("upstream_error", providerId, message, { cause: raw });
}
