import type { AssetKind } from "@/lib/domain/enums";

import { ApiError } from "./errors";

/**
 * Upload validation.
 *
 * Type and size are checked against an allowlist before a single byte is
 * written. The declared MIME type is never trusted on its own: the extension
 * has to match it too, and the stored file name is sanitised.
 */

export const MAX_UPLOAD_BYTES: Record<AssetKind, number> = {
  image: 15 * 1024 * 1024,
  cover: 15 * 1024 * 1024,
  logo: 5 * 1024 * 1024,
  screenshot: 15 * 1024 * 1024,
  video: 200 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
  other: 25 * 1024 * 1024,
};

const ALLOWED: Record<string, { kinds: AssetKind[]; extensions: string[] }> = {
  "image/png": { kinds: ["image", "cover", "logo", "screenshot", "other"], extensions: ["png"] },
  "image/jpeg": { kinds: ["image", "cover", "logo", "screenshot", "other"], extensions: ["jpg", "jpeg"] },
  "image/webp": { kinds: ["image", "cover", "logo", "screenshot", "other"], extensions: ["webp"] },
  "image/gif": { kinds: ["image", "other"], extensions: ["gif"] },
  "image/svg+xml": { kinds: ["logo", "other"], extensions: ["svg"] },
  "video/mp4": { kinds: ["video", "screenshot", "other"], extensions: ["mp4", "m4v"] },
  "video/quicktime": { kinds: ["video", "other"], extensions: ["mov"] },
  "video/webm": { kinds: ["video", "other"], extensions: ["webm"] },
  "audio/mpeg": { kinds: ["audio", "other"], extensions: ["mp3"] },
  "audio/wav": { kinds: ["audio", "other"], extensions: ["wav"] },
  "audio/x-wav": { kinds: ["audio", "other"], extensions: ["wav"] },
  "audio/mp4": { kinds: ["audio", "other"], extensions: ["m4a", "mp4"] },
  "audio/aac": { kinds: ["audio", "other"], extensions: ["aac"] },
  "audio/ogg": { kinds: ["audio", "other"], extensions: ["ogg"] },
  "audio/flac": { kinds: ["audio", "other"], extensions: ["flac"] },
};

/** Keeps only characters that are safe in a storage key and a file name. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "datei";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "-")
    .replace(/_{2,}/g, "_")
    .slice(0, 120);
  return cleaned || "datei";
}

export function extensionOf(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export interface ValidatedUpload {
  fileName: string;
  mimeType: string;
  kind: AssetKind;
  byteSize: number;
}

export function validateUpload(input: {
  fileName: string;
  mimeType: string;
  byteSize: number;
  kind: AssetKind;
}): ValidatedUpload {
  const mimeType = input.mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  const rule = ALLOWED[mimeType];
  if (!rule) {
    throw ApiError.badRequest(`Dateityp „${mimeType || "unbekannt"}“ wird nicht unterstützt.`);
  }
  if (!rule.kinds.includes(input.kind)) {
    throw ApiError.badRequest(
      `Dateityp „${mimeType}“ passt nicht zur Kategorie „${input.kind}“.`,
    );
  }

  const fileName = sanitizeFileName(input.fileName);
  const extension = extensionOf(fileName);
  if (!extension || !rule.extensions.includes(extension)) {
    throw ApiError.badRequest(
      `Die Dateiendung passt nicht zum Dateityp (erwartet: ${rule.extensions.join(", ")}).`,
    );
  }

  const limit = MAX_UPLOAD_BYTES[input.kind];
  if (input.byteSize <= 0) throw ApiError.badRequest("Die Datei ist leer.");
  if (input.byteSize > limit) {
    throw ApiError.badRequest(
      `Die Datei ist zu groß (max. ${Math.round(limit / (1024 * 1024))} MB).`,
    );
  }

  return { fileName, mimeType, kind: input.kind, byteSize: input.byteSize };
}
