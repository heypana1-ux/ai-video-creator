import { isDemoMode } from "@/lib/config/env";
import { handle } from "@/lib/api/route";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  return handle(async () => {
    const session = await getSession();
    return {
      demoMode: isDemoMode(),
      user: session?.user ?? null,
      workspace: session?.workspace ?? null,
    };
  });
}
