"use client";

import * as React from "react";
import { FileAudio, FileVideo, Images, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AssetUploader } from "@/components/wizard/asset-uploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { apiSend, errorMessage } from "@/lib/client/api";
import type { Asset } from "@/lib/domain/schemas";
import { formatBytes, formatDateTime } from "@/lib/util/format";

export function AssetLibrary({ initialAssets }: { initialAssets: Asset[] }) {
  const [assets, setAssets] = React.useState(initialAssets);

  async function remove(id: string) {
    try {
      await apiSend(`/api/assets/${id}`, "DELETE");
      setAssets((current) => current.filter((asset) => asset.id !== id));
      toast.success("Asset gelöscht.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <div className="surface-card p-5">
        <AssetUploader
          label="Neue Dateien hochladen"
          kind="image"
          accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/wav"
          multiple
          value={[]}
          onChange={() => undefined}
          onUploaded={(asset) => setAssets((current) => [asset, ...current])}
          hint="Bilder, Videos und Audio. Dateityp und Größe werden serverseitig geprüft."
        />
      </div>

      {assets.length === 0 ? (
        <EmptyState
          icon={<Images className="size-6" />}
          title="Noch keine Assets"
          description="Lade Cover, Screenshots, Screenrecordings oder Audio hoch – AdReel verwendet sie automatisch in passenden Szenen."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {assets.map((asset) => (
            <li key={asset.id} className="surface-card overflow-hidden">
              <div className="grid aspect-square place-items-center bg-ink-800">
                {asset.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.url} alt="" className="size-full object-cover" />
                ) : asset.mimeType.startsWith("video/") ? (
                  <FileVideo className="size-8 text-chalk-faint" />
                ) : (
                  <FileAudio className="size-8 text-chalk-faint" />
                )}
              </div>
              <div className="space-y-1.5 p-3">
                <p className="truncate text-xs font-medium" title={asset.fileName}>
                  {asset.fileName}
                </p>
                <p className="text-[11px] text-chalk-faint">
                  {formatBytes(asset.byteSize)} · {formatDateTime(asset.createdAt)}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="neutral">{asset.kind}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-danger"
                    aria-label={`${asset.fileName} löschen`}
                    onClick={() => remove(asset.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
