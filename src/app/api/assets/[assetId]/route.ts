import { getProviders } from "@/lib/ai/registry";
import { ApiError } from "@/lib/api/errors";
import { handleAuthed } from "@/lib/api/route";
import { getRepository } from "@/lib/db";

type Context = { params: Promise<{ assetId: string }> };

export async function DELETE(_request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const { assetId } = await context.params;
    const repo = await getRepository();
    const asset = await repo.getAsset(session.workspace.id, assetId);
    if (!asset) throw ApiError.notFound("Asset nicht gefunden.");

    await getProviders().storage.remove(asset.storageKey).catch(() => undefined);
    await repo.deleteAsset(session.workspace.id, assetId);
    return { ok: true };
  });
}
