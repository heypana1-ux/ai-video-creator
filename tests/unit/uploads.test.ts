import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/errors";
import {
  MAX_UPLOAD_BYTES,
  extensionOf,
  sanitizeFileName,
  validateUpload,
} from "@/lib/api/uploads";
import { clientKey, rateLimit, resetRateLimits } from "@/lib/api/rate-limit";

describe("sanitizeFileName", () => {
  it("strips directory components", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\x\\cover.png")).toBe("cover.png");
  });

  it("replaces unsafe characters", () => {
    expect(sanitizeFileName("mein cover;rm -rf.png")).toBe("mein-cover_rm--rf.png");
  });

  it("never returns an empty name", () => {
    expect(sanitizeFileName("///")).toBe("datei");
  });
});

describe("extensionOf", () => {
  it("returns the lowercase extension", () => {
    expect(extensionOf("Cover.PNG")).toBe("png");
    expect(extensionOf("noextension")).toBe("");
  });
});

describe("validateUpload", () => {
  it("accepts a matching type and extension", () => {
    const result = validateUpload({
      fileName: "cover.png",
      mimeType: "image/png",
      byteSize: 1024,
      kind: "cover",
    });
    expect(result).toEqual({
      fileName: "cover.png",
      mimeType: "image/png",
      kind: "cover",
      byteSize: 1024,
    });
  });

  it("ignores charset parameters on the mime type", () => {
    expect(
      validateUpload({
        fileName: "logo.svg",
        mimeType: "image/svg+xml; charset=utf-8",
        byteSize: 512,
        kind: "logo",
      }).mimeType,
    ).toBe("image/svg+xml");
  });

  it("rejects an unknown type", () => {
    expect(() =>
      validateUpload({ fileName: "x.exe", mimeType: "application/x-msdownload", byteSize: 10, kind: "other" }),
    ).toThrow(ApiError);
  });

  it("rejects a type that does not fit the asset kind", () => {
    expect(() =>
      validateUpload({ fileName: "song.mp3", mimeType: "audio/mpeg", byteSize: 10, kind: "logo" }),
    ).toThrow(/passt nicht zur Kategorie/);
  });

  it("rejects a mismatched extension", () => {
    expect(() =>
      validateUpload({ fileName: "evil.php", mimeType: "image/png", byteSize: 10, kind: "image" }),
    ).toThrow(/Dateiendung/);
  });

  it("rejects an empty file", () => {
    expect(() =>
      validateUpload({ fileName: "a.png", mimeType: "image/png", byteSize: 0, kind: "image" }),
    ).toThrow(/leer/);
  });

  it("enforces the per-kind size limit", () => {
    expect(() =>
      validateUpload({
        fileName: "logo.png",
        mimeType: "image/png",
        byteSize: MAX_UPLOAD_BYTES.logo + 1,
        kind: "logo",
      }),
    ).toThrow(/zu groß/);
  });

  it("allows video files up to their larger limit", () => {
    expect(
      validateUpload({
        fileName: "clip.mp4",
        mimeType: "video/mp4",
        byteSize: MAX_UPLOAD_BYTES.video,
        kind: "video",
      }).kind,
    ).toBe("video");
  });
});

describe("rateLimit", () => {
  it("allows up to the limit then blocks", () => {
    resetRateLimits();
    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit("k", 3).allowed).toBe(true);
    }
    const blocked = rateLimit("k", 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("keeps separate buckets per key", () => {
    resetRateLimits();
    rateLimit("a", 1);
    expect(rateLimit("a", 1).allowed).toBe(false);
    expect(rateLimit("b", 1).allowed).toBe(true);
  });

  it("resets after the window", () => {
    resetRateLimits();
    rateLimit("w", 1, 5);
    expect(rateLimit("w", 1, 5).allowed).toBe(false);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(rateLimit("w", 1, 5).allowed).toBe(true);
        resolve();
      }, 20);
    });
  });

  it("derives a key from the forwarded client address", () => {
    const request = new Request("http://x/", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    expect(clientKey(request, "login")).toBe("login:203.0.113.5");
  });
});
