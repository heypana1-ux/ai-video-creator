import { handleAuthed, readJson } from "@/lib/api/route";
import { getRepository } from "@/lib/db";

/** Marks onboarding as done and optionally renames the workspace. */
export async function POST(request: Request) {
  return handleAuthed(async (session) => {
    const body = await readJson<{ workspaceName?: string }>(request).catch(
      () => ({}) as { workspaceName?: string },
    );
    const repo = await getRepository();
    const workspace = await repo.updateWorkspace(session.workspace.id, {
      onboardedAt: new Date().toISOString(),
      ...(body.workspaceName?.trim()
        ? { name: body.workspaceName.trim().slice(0, 120) }
        : {}),
    });
    return { workspace };
  });
}
