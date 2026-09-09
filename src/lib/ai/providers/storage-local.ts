import { promises as fs } from "node:fs";
import path from "node:path";

import { serverEnv } from "@/lib/config/env";

import { ProviderError } from "../errors";
import type { ProviderStatus, StorageProvider, StoredObject } from "../types";

/**
 * Filesystem backed storage used in demo mode.
 *
 * Files live under `<ADREEL_DATA_DIR>/media` - deliberately *outside* `public/`
 * so uploads are never served by the static file handler. They are exposed
 * through `/api/media/[...key]`, which enforces the same path checks as here,
 * and through Remotion's `publicDir` during rendering.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly id = "local";
  readonly kind = "storage" as const;
  readonly isDemo = false;

  readonly root: string;

  constructor(root?: string) {
    const base = root ?? path.join(process.cwd(), serverEnv.dataDir, "media");
    this.root = path.resolve(base);
  }

  async status(): Promise<ProviderStatus> {
    try {
      await fs.mkdir(this.root, { recursive: true });
      return {
        id: this.id,
        kind: this.kind,
        available: true,
        isDemo: this.isDemo,
        detail: `Lokaler Speicher unter ${this.root}`,
      };
    } catch (error) {
      return {
        id: this.id,
        kind: this.kind,
        available: false,
        isDemo: this.isDemo,
        detail: `Verzeichnis nicht beschreibbar: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Rejects absolute paths and any `..` segment before touching the disk.
   * An absolute key is refused rather than silently reinterpreted as relative -
   * a caller passing `/etc/passwd` has a bug, and hiding it helps nobody.
   */
  private resolveKey(key: string): string {
    const normalised = key.replace(/\\/g, "/");
    if (
      !normalised ||
      normalised.startsWith("/") ||
      normalised.split("/").includes("..") ||
      path.isAbsolute(normalised)
    ) {
      throw new ProviderError("bad_request", this.id, "Ungültiger Speicher-Key");
    }
    const target = path.resolve(this.root, normalised);
    if (target !== this.root && !target.startsWith(this.root + path.sep)) {
      throw new ProviderError("bad_request", this.id, "Ungültiger Speicher-Key");
    }
    return target;
  }

  async put(key: string, data: Uint8Array, contentType: string): Promise<StoredObject> {
    const target = this.resolveKey(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
    return {
      key,
      url: `/api/media/${key.split("/").map(encodeURIComponent).join("/")}`,
      byteSize: data.byteLength,
      contentType,
    };
  }

  async signedUrl(key: string): Promise<string> {
    // Local files are already access-checked by the media route; there is no
    // separate signature to hand out.
    return `/api/media/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  async remove(key: string): Promise<void> {
    const target = this.resolveKey(key);
    await fs.rm(target, { force: true });
  }

  localPath(key: string): string {
    return this.resolveKey(key);
  }
}
