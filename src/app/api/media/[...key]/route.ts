import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";

import { mediaRoot } from "@/lib/ai/registry";
import { ApiError, toErrorBody } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";

const CONTENT_TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  flac: "audio/flac",
};

type Context = { params: Promise<{ key: string[] }> };

/**
 * Serves locally stored media.
 *
 * Files live outside `public/` so they are never served anonymously. Every
 * request requires a session, and the resolved path must stay inside the media
 * root - which is what stops `../` traversal.
 */
export async function GET(request: Request, context: Context) {
  try {
    const session = await getSession();
    if (!session) throw ApiError.unauthorized();

    const { key } = await context.params;
    const relative = key.map((segment) => decodeURIComponent(segment)).join("/");
    if (!relative || relative.includes("..") || relative.includes("\0")) {
      throw ApiError.badRequest("Ungültiger Pfad.");
    }

    const root = mediaRoot();
    const target = path.resolve(root, relative);
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw ApiError.badRequest("Ungültiger Pfad.");
    }

    const stats = await fs.stat(target).catch(() => null);
    if (!stats?.isFile()) throw ApiError.notFound("Datei nicht gefunden.");

    const extension = path.extname(target).slice(1).toLowerCase();
    const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";

    // Range support so <video>/<audio> can seek during preview playback.
    const range = request.headers.get("range");
    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Number(match[2]) : stats.size - 1;
        if (start <= end && start < stats.size) {
          const stream = Readable.toWeb(
            createReadStream(target, { start, end }),
          ) as WebReadableStream<Uint8Array>;
          return new Response(stream as unknown as ReadableStream, {
            status: 206,
            headers: {
              "content-type": contentType,
              "content-length": String(end - start + 1),
              "content-range": `bytes ${start}-${end}/${stats.size}`,
              "accept-ranges": "bytes",
              "cache-control": "private, max-age=60",
            },
          });
        }
      }
    }

    const stream = Readable.toWeb(createReadStream(target)) as WebReadableStream<Uint8Array>;
    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "content-type": contentType,
        "content-length": String(stats.size),
        "accept-ranges": "bytes",
        "cache-control": "private, max-age=60",
        // Uploaded SVGs are user content: never let them execute in our origin.
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    const { status, body } = toErrorBody(error);
    return Response.json(body, { status });
  }
}
