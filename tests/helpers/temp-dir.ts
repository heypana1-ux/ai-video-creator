import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Runs `work` against a throwaway directory and cleans up afterwards. */
export async function withTempDataDir<T>(work: (root: string) => Promise<T>): Promise<T> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "adreel-test-"));
  try {
    return await work(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}
