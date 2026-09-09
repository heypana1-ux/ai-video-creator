/**
 * Provider logging.
 *
 * Rule: never log secrets and never log full prompts. Prompts frequently carry
 * customer copy and uploaded content, so only a length and a short truncated
 * fingerprint are recorded, which is enough to correlate a log line with a job.
 */

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\bsk-ant-[A-Za-z0-9_-]{8,}\b/g,
  /\br8_[A-Za-z0-9]{8,}\b/g,
  /\bBearer\s+[A-Za-z0-9._-]{8,}\b/gi,
  /\beyJ[A-Za-z0-9._-]{20,}\b/g,
];

/** Removes anything that looks like an API key or bearer token. */
export function redact(value: string): string {
  return SECRET_PATTERNS.reduce(
    (acc, pattern) => acc.replace(pattern, "[redacted]"),
    value,
  );
}

/** A prompt is summarised, never logged verbatim. */
export function summarisePrompt(prompt: string): string {
  const normalised = prompt.replace(/\s+/g, " ").trim();
  return `len=${normalised.length} head="${redact(normalised.slice(0, 32))}"`;
}

export interface ProviderLogEntry {
  providerId: string;
  kind: string;
  operation: string;
  attempt: number;
  durationMs?: number;
  status: "start" | "success" | "retry" | "error";
  detail?: string;
  providerJobId?: string | null;
}

type Sink = (entry: ProviderLogEntry) => void;

let sink: Sink = (entry) => {
  const parts = [
    `[provider:${entry.kind}]`,
    entry.providerId,
    entry.operation,
    entry.status,
    `attempt=${entry.attempt}`,
  ];
  if (entry.durationMs !== undefined) parts.push(`${entry.durationMs}ms`);
  if (entry.providerJobId) parts.push(`job=${entry.providerJobId}`);
  if (entry.detail) parts.push(redact(entry.detail));
  console.info(parts.join(" "));
};

export function setProviderLogSink(next: Sink): void {
  sink = next;
}

export function logProvider(entry: ProviderLogEntry): void {
  sink(entry);
}
