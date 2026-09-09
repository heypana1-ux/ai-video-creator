import { randomUUID } from "node:crypto";

/** Short, URL-safe, collision-resistant id used for every domain record. */
export function randomId(prefix = ""): string {
  const raw = randomUUID().replace(/-/g, "").slice(0, 20);
  return prefix ? `${prefix}_${raw}` : raw;
}

/** Deterministic id factory - used by seeds and tests. */
export function sequentialIdFactory(prefix: string): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}${String(counter).padStart(4, "0")}`;
  };
}
