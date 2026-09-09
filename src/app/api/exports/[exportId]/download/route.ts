import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";

import { getProviders } from "@/lib/ai/registry";
import { ApiError, toErrorBody } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";

type Context = { params: Promise<{ exportId: string }> };

/**
 * Streams a finished export as an MP4 download. Ownership is checked against
 * the caller's workspace; remote storage is redirected to a signed URL.
 */
export async function GET(_request: Request, context: Context) {
  try {
    const session = await getSession();
    if (!session) throw ApiError.unauthorized();

    const { exportId } = await context.params;
    const repo = await getRepository();
    const videoExport = await repo.getExport(session.workspace.id, exportId);
    if (!videoExport) throw ApiError.notFound("Export nicht gefunden.");

    const project = await repo.getProject(session.workspace.id, videoExport.projectId);
    const fileName = `${(project?.name ?? "adreel").replace(/[^\w-]+/g, "-").slice(0, 60)}-${videoExport.width}x${videoExport.height}.mp4`;

    const providers = getProviders();
    const localPath = providers.storage.localPath(videoExport.storageKey);
    if (!localPath) {
      const signed = await providers.storage.signedUrl(videoExport.storageKey, 300);
      return Response.redirect(signed, 302);
    }

    const stats = await fs.stat(localPath).catch(() => null);
    if (!stats) throw ApiError.notFound("Die Exportdatei ist nicht mehr vorhanden.");

    const stream = Readable.toWeb(createReadStream(localPath)) as WebReadableStream<Uint8Array>;
    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "content-type": "video/mp4",
        "content-length": String(stats.size),
        "content-disposition": `attachment; filename="${fileName}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}
