import { getProviders } from "@/lib/ai/registry";
import { ApiError } from "@/lib/api/errors";
import { clientKey, rateLimit } from "@/lib/api/rate-limit";
import { handleAuthed } from "@/lib/api/route";
import { validateUpload } from "@/lib/api/uploads";
import { serverEnv } from "@/lib/config/env";
import { getRepository } from "@/lib/db";
import { ASSET_KINDS, type AssetKind } from "@/lib/domain/enums";
import { randomId } from "@/lib/util/id";

export async function GET(request: Request) {
  return handleAuthed(async (session) => {
    const repo = await getRepository();
    const projectId = new URL(request.url).searchParams.get("projectId") ?? undefined;
    return { assets: await repo.listAssets(session.workspace.id, projectId ?? undefined) };
  });
}

/** Multipart upload. Type, extension and size are validated before writing. */
export async function POST(request: Request) {
  return handleAuthed(async (session) => {
    const limit = rateLimit(
      clientKey(request, `upload:${session.workspace.id}`),
      serverEnv.rateLimits.uploadPerMin,
    );
    if (!limit.allowed) throw ApiError.tooManyRequests();

    const form = await request.formData().catch(() => null);
    if (!form) throw ApiError.badRequest("Ungültiger Upload.");

    const file = form.get("file");
    if (!(file instanceof File)) throw ApiError.badRequest("Es wurde keine Datei übertragen.");

    const rawKind = String(form.get("kind") ?? "other");
    if (!ASSET_KINDS.includes(rawKind as AssetKind)) {
      throw ApiError.badRequest("Unbekannte Asset-Kategorie.");
    }
    const kind = rawKind as AssetKind;

    const projectId = form.get("projectId") ? String(form.get("projectId")) : null;
    const repo = await getRepository();
    if (projectId && !(await repo.getProject(session.workspace.id, projectId))) {
      throw ApiError.notFound("Projekt nicht gefunden.");
    }

    const validated = validateUpload({
      fileName: file.name,
      mimeType: file.type,
      byteSize: file.size,
      kind,
    });

    const bytes = new Uint8Array(await file.arrayBuffer());
    // Re-check after reading: the declared size can lie.
    validateUpload({ ...validated, byteSize: bytes.byteLength });

    const assetId = randomId("ast");
    const storageKey = `${session.workspace.id}/uploads/${assetId}-${validated.fileName}`;
    const stored = await getProviders().storage.put(storageKey, bytes, validated.mimeType);

    const asset = await repo.createAsset({
      id: assetId,
      workspaceId: session.workspace.id,
      projectId,
      kind,
      fileName: validated.fileName,
      mimeType: validated.mimeType,
      byteSize: bytes.byteLength,
      url: stored.url,
      storageKey,
      width: null,
      height: null,
      durationMs: null,
      isDemo: false,
    });

    return { asset };
  });
}
