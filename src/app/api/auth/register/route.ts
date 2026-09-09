import { serverEnv } from "@/lib/config/env";
import { ApiError } from "@/lib/api/errors";
import { clientKey, rateLimit } from "@/lib/api/rate-limit";
import { handle, readJson } from "@/lib/api/route";
import { signUp } from "@/lib/auth/session";
import { signUpSchema } from "@/lib/domain/schemas";

export async function POST(request: Request) {
  return handle(async () => {
    const limit = rateLimit(clientKey(request, "register"), serverEnv.rateLimits.authPerMin);
    if (!limit.allowed) throw ApiError.tooManyRequests();

    const input = signUpSchema.parse(await readJson(request));
    const result = await signUp(input);
    if (!result.ok) throw ApiError.badRequest(result.error ?? "Registrierung fehlgeschlagen.");
    return { ok: true, user: result.session?.user ?? null, notice: result.error ?? null };
  });
}
