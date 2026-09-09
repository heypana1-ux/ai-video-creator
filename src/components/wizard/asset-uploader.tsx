"use client";

import * as React from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { apiUpload, errorMessage } from "@/lib/client/api";
import type { AssetKind } from "@/lib/domain/enums";
import type { Asset } from "@/lib/domain/schemas";
import { formatBytes } from "@/lib/util/format";
import { cn } from "@/lib/util/cn";

interface Props {
  label: string;
  hint?: string;
  kind: AssetKind;
  accept: string;
  multiple?: boolean;
  value: string[];
  onChange: (assetIds: string[]) => void;
  /** Lets the parent render previews without refetching. */
  onUploaded?: (asset: Asset) => void;
  className?: string;
}

/** Uploads files straight to the asset API and reports the stored ids back. */
export function AssetUploader({
  label,
  hint,
  kind,
  accept,
  multiple = false,
  value,
  onChange,
  onUploaded,
  className,
}: Props) {
  const inputId = React.useId();
  const [uploading, setUploading] = React.useState(false);
  const [assets, setAssets] = React.useState<Asset[]>([]);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const uploaded: Asset[] = [];

    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);
        form.set("kind", kind);
        const result = await apiUpload<{ asset: Asset }>("/api/assets", form);
        uploaded.push(result.asset);
        onUploaded?.(result.asset);
      }
      const next = multiple
        ? [...value, ...uploaded.map((asset) => asset.id)]
        : uploaded.slice(-1).map((asset) => asset.id);
      setAssets((current) => (multiple ? [...current, ...uploaded] : uploaded.slice(-1)));
      onChange(next);
      toast.success(uploaded.length === 1 ? "Datei hochgeladen." : `${uploaded.length} Dateien hochgeladen.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  function remove(assetId: string) {
    setAssets((current) => current.filter((asset) => asset.id !== assetId));
    onChange(value.filter((id) => id !== assetId));
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <label
        htmlFor={inputId}
        className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ink-600 bg-ink-850 px-3 py-3 text-sm text-chalk-faint transition-colors hover:border-violet-brand/60 hover:text-chalk"
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Paperclip className="size-4" />
        )}
        {uploading ? "Wird hochgeladen …" : "Datei auswählen"}
        <input
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(event) => {
            void onFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {hint ? <p className="text-xs text-chalk-faint">{hint}</p> : null}

      {assets.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {assets.map((asset) => (
            <li
              key={asset.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-xs"
            >
              <span className="truncate">{asset.fileName}</span>
              <span className="flex shrink-0 items-center gap-2 text-chalk-faint">
                {formatBytes(asset.byteSize)}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`${asset.fileName} entfernen`}
                  onClick={() => remove(asset.id)}
                >
                  <X className="size-3.5" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
