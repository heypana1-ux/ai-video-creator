import { ApiError } from "@/lib/api/errors";
import { handleAuthed, readJson } from "@/lib/api/route";
import { getRepository } from "@/lib/db";
import { brandKitSchema } from "@/lib/domain/schemas";

type Context = { params: Promise<{ brandKitId: string }> };

export async function PATCH(request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const { brandKitId } = await context.params;
    const repo = await getRepository();
    if (!(await repo.getBrandKit(session.workspace.id, brandKitId))) {
      throw ApiError.notFound("Brand-Kit nicht gefunden.");
    }
    const input = brandKitSchema.partial().parse(await readJson(request));
    const brandKit = await repo.updateBrandKit(session.workspace.id, brandKitId, input);
    return { brandKit };
  });
}

export async function DELETE(_request: Request, context: Context) {
  return handleAuthed(async (session) => {
    const { brandKitId } = await context.params;
    const repo = await getRepository();
    const removed = await repo.deleteBrandKit(session.workspace.id, brandKitId);
    if (!removed) throw ApiError.notFound("Brand-Kit nicht gefunden.");
    return { ok: true };
  });
}
