import { handle } from "@/lib/api/route";
import { signOut } from "@/lib/auth/session";

export async function POST() {
  return handle(async () => {
    await signOut();
    return { ok: true };
  });
}
