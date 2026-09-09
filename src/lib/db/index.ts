import path from "node:path";

import { isDemoMode, serverEnv } from "@/lib/config/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import { JsonTableDriver } from "./json-driver";
import { Repository } from "./repository";
import { SupabaseTableDriver } from "./supabase-driver";
import type { TableDriver } from "./driver";

let demoDriver: JsonTableDriver | null = null;

export function demoDbRoot(): string {
  return path.resolve(process.cwd(), serverEnv.dataDir, "db");
}

export function getDemoDriver(): JsonTableDriver {
  if (!demoDriver) demoDriver = new JsonTableDriver(demoDbRoot());
  return demoDriver;
}

/** Test seam - drops the memoised demo driver (and its in-memory cache). */
export function resetRepository(): void {
  demoDriver = null;
}

/**
 * Returns the repository for the current request.
 *
 * In demo mode this is the local JSON store. With Supabase configured it is a
 * request-scoped client that carries the user's session, so every statement
 * runs under that user's RLS policies.
 */
export async function getRepository(): Promise<Repository> {
  if (isDemoMode()) return new Repository(getDemoDriver());

  const client = await getSupabaseServerClient();
  if (!client) return new Repository(getDemoDriver());
  return new Repository(new SupabaseTableDriver(client));
}

/** Repository bound to an explicit driver - used by seeds, jobs and tests. */
export function repositoryFor(driver: TableDriver): Repository {
  return new Repository(driver);
}

export { Repository } from "./repository";
export type { TableDriver } from "./driver";
