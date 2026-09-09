import { serverEnv } from "@/lib/config/env";
import { ApiError } from "@/lib/api/errors";
import { clientKey, rateLimit } from "@/lib/api/rate-limit";
import { handle, readJson } from "@/lib/api/route";
import { signIn } from "@/lib/auth/session";
import { signInSchema } from "@/lib/domain/schemas";

export async function POST(request: Request) {
  return handle(async () => {
    const limit = rateLimit(clientKey(request, "login"), serverEnv.rateLimits.authPerMin);
    if (!limit.allowed) throw ApiError.tooManyRequests();

    const input = signInSchema.parse(await readJson(request));
    const result = await signIn(input);
    if (!result.ok) throw new ApiError(401, "invalid_credentials", result.error ?? "Anmeldung fehlgeschlagen.");
    return { ok: true, user: result.session?.user ?? null };
  });
}
