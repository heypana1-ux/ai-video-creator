import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/route";
import { signInAsDemoUser } from "@/lib/auth/session";

/** One-click demo login. Only works while the app runs in demo mode. */
export async function POST() {
  return handle(async () => {
    const result = await signInAsDemoUser();
    if (!result.ok) throw ApiError.badRequest(result.error ?? "Demo-Login fehlgeschlagen.");
    return { ok: true, user: result.session?.user ?? null };
  });
}
