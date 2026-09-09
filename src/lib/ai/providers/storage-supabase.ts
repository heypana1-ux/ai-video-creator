import { serverEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

import { ProviderError } from "../errors";
import type { ProviderStatus, StorageProvider, StoredObject } from "../types";

/**
 * Supabase Storage adapter.
 *
 * Objects are private; every URL handed to the client (or to the renderer) is a
 * short lived signed URL. Keys are always prefixed with the workspace id by the
 * caller, and the bucket policy restricts access to the owning workspace.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly id = "supabase";
  readonly kind = "storage" as const;
  readonly isDemo = false;

  private readonly bucket = serverEnv.supabaseBucket;

  async status(): Promise<ProviderStatus> {
    const client = getSupabaseAdminClient();
    if (!client) {
      return {
        id: this.id,
        kind: this.kind,
        available: false,
        isDemo: false,
        detail: "SUPABASE_SERVICE_ROLE_KEY oder NEXT_PUBLIC_SUPABASE_URL fehlt",
      };
    }
    const { error } = await client.storage.getBucket(this.bucket);
    return {
      id: this.id,
      kind: this.kind,
      available: !error,
      isDemo: false,
      detail: error ? `Bucket „${this.bucket}“ nicht erreichbar` : `Bucket „${this.bucket}“`,
    };
  }

  private client() {
    const client = getSupabaseAdminClient();
    if (!client) {
      throw new ProviderError("unavailable", this.id, "Supabase ist nicht konfiguriert");
    }
    return client;
  }

  async put(key: string, data: Uint8Array, contentType: string): Promise<StoredObject> {
    const { error } = await this.client()
      .storage.from(this.bucket)
      .upload(key, data, { contentType, upsert: true });
    if (error) {
      throw new ProviderError("upstream_error", this.id, error.message, { cause: error });
    }
    return {
      key,
      url: await this.signedUrl(key),
      byteSize: data.byteLength,
      contentType,
    };
  }

  async signedUrl(key: string, ttlSeconds = 60 * 60): Promise<string> {
    const { data, error } = await this.client()
      .storage.from(this.bucket)
      .createSignedUrl(key, ttlSeconds);
    if (error || !data) {
      throw new ProviderError("upstream_error", this.id, error?.message ?? "Signed URL fehlgeschlagen");
    }
    return data.signedUrl;
  }

  async remove(key: string): Promise<void> {
    const { error } = await this.client().storage.from(this.bucket).remove([key]);
    if (error) {
      throw new ProviderError("upstream_error", this.id, error.message, { cause: error });
    }
  }

  localPath(): string | null {
    return null;
  }
}
