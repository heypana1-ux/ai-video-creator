/** Client-safe id generator (node:crypto is not available in the browser). */
export function randomId(prefix = ""): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 20)
      : Math.random().toString(36).slice(2).padEnd(20, "0").slice(0, 20);
  return prefix ? `${prefix}_${raw}` : raw;
}
