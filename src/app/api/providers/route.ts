import { getProviderStatuses } from "@/lib/ai/registry";
import { handleAuthed } from "@/lib/api/route";
import { isDemoMode } from "@/lib/config/env";

export async function GET() {
  return handleAuthed(async () => ({
    demoMode: isDemoMode(),
    providers: await getProviderStatuses(),
  }));
}
