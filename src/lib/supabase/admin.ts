import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/config/env";

let cached: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses RLS, so it is only used by background jobs and
 * storage operations that have already verified workspace ownership in
 * application code. Never import this from a client component.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (cached) return cached;
  const url = serverEnv.supabaseUrl;
  const key = serverEnv.supabaseServiceRoleKey;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** Test seam - drops the memoised client. */
export function resetSupabaseAdminClient(): void {
  cached = null;
}
