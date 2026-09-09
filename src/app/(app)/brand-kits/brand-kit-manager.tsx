"use client";

import * as React from "react";
import { Loader2, Palette, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AssetUploader } from "@/components/wizard/asset-uploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { apiSend, errorMessage } from "@/lib/client/api";
import type { BrandKit } from "@/lib/domain/schemas";

const EMPTY = {
  name: "",
  primaryColor: "#8B5CF6",
  secondaryColor: "#EC4899",
  accentColor: "#38BDF8",
  fontFamily: "Inter",
  logoAssetId: null as string | null,
};

export function BrandKitManager({ initialKits }: { initialKits: BrandKit[] }) {
  const [kits, setKits] = React.useState(initialKits);
  const [draft, setDraft] = React.useState(EMPTY);
  const [pending, setPending] = React.useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await apiSend<{ brandKit: BrandKit }>("/api/brand-kits", "POST", draft);
      setKits((current) => [result.brandKit, ...current]);
      setDraft(EMPTY);
      toast.success("Brand-Kit gespeichert.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiSend(`/api/brand-kits/${id}`, "DELETE");
      setKits((current) => current.filter((kit) => kit.id !== id));
      toast.success("Brand-Kit gelöscht.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section>
        {kits.length === 0 ? (
          <EmptyState
            icon={<Palette className="size-6" />}
            title="Noch kein Brand-Kit"
            description="Lege Farben, Schrift und Logo einmal fest – neue Projekte übernehmen sie automatisch."
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {kits.map((kit) => (
              <li key={kit.id}>
                <Card>
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="font-semibold">{kit.name}</h2>
                        <p className="text-xs text-chalk-faint">{kit.fontFamily}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-danger"
                        aria-label={`${kit.name} löschen`}
                        onClick={() => remove(kit.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="mt-4 flex gap-2">
                      {[kit.primaryColor, kit.secondaryColor, kit.accentColor].map((color) => (
                        <span
                          key={color}
                          className="h-10 flex-1 rounded-lg border border-ink-700"
                          style={{ background: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card className="h-fit">
        <CardContent className="pt-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-chalk-faint">
            Neues Brand-Kit
          </h2>
          <form onSubmit={create} className="space-y-4">
            <Field label="Name" htmlFor="kitName" required>
              <Input
                id="kitName"
                required
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Label-Branding"
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["primaryColor", "Primär"],
                  ["secondaryColor", "Sekundär"],
                  ["accentColor", "Akzent"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label} htmlFor={key}>
                  <Input
                    id={key}
                    type="color"
                    className="h-10 p-1"
                    value={draft[key]}
                    onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                  />
                </Field>
              ))}
            </div>
            <Field label="Schriftart" htmlFor="kitFont">
              <Input
                id="kitFont"
                value={draft.fontFamily}
                onChange={(event) => setDraft({ ...draft, fontFamily: event.target.value })}
              />
            </Field>
            <AssetUploader
              label="Logo"
              kind="logo"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              value={draft.logoAssetId ? [draft.logoAssetId] : []}
              onChange={(ids) => setDraft({ ...draft, logoAssetId: ids[0] ?? null })}
            />
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Brand-Kit anlegen
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
