import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/config/env";

/**
 * Request-scoped Supabase client that carries the user's session cookies, so
 * every query runs under that user's RLS policies.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient | null> {
  const url = serverEnv.supabaseUrl;
  const key = serverEnv.supabaseAnonKey;
  if (!url || !key) return null;

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component where cookies are read-only. The
          // session is refreshed by the proxy instead, so this is safe to skip.
        }
      },
    },
  });
}
