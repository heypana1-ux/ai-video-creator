"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Check,
  Layers,
  Loader2,
  MonitorSmartphone,
  Music4,
  Package,
  Sparkles,
  Ticket,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { CategoryFields, IMAGE_ACCEPT, MEDIA_ACCEPT } from "@/components/wizard/category-fields";
import { AssetUploader } from "@/components/wizard/asset-uploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/states";
import { apiSend, ApiClientError, errorMessage } from "@/lib/client/api";
import {
  CATEGORY_LABELS,
  LANGUAGES,
  LANGUAGE_LABELS,
  PLATFORMS,
  PLATFORM_LABELS,
  PROJECT_CATEGORIES,
  TONES,
  TONE_LABELS,
  VIDEO_DURATIONS,
  type ProjectCategory,
} from "@/lib/domain/enums";
import { defaultBrief } from "@/lib/domain/defaults";
import type { BrandKit, Project, ProjectBrief } from "@/lib/domain/schemas";
import { listStylesForCategory } from "@/lib/video/styles";
import { cn } from "@/lib/util/cn";

const CATEGORY_ICONS: Record<ProjectCategory, React.ComponentType<{ className?: string }>> = {
  music: Music4,
  website: MonitorSmartphone,
  app: Layers,
  mixing_mastering: AudioLines,
  product: Package,
  service: Wrench,
  event: Ticket,
  custom: Sparkles,
};

const CATEGORY_HINTS: Record<ProjectCategory, string> = {
  music: "Release-Teaser, Lyric-Video, Visualizer, UGC-Promo",
  website: "Screenshot-Tour, Problem/Lösung, Einwand-Konter",
  app: "Feature-Demo, Problem/Lösung, Mini-Tutorial",
  mixing_mastering: "Vorher/Nachher, Studio-Showcase, Kundenreise",
  product: "Direct-Response mit Nutzen, Preis und CTA",
  service: "Problem, Leistung, Beweis, Anfrage",
  event: "Datum, Line-up, Location, Tickets",
  custom: "Frei definierbar für alles andere",
};

const STEPS = ["Kategorie", "Briefing", "Stil & Start"] as const;

export function ProjectWizard({ brandKits }: { brandKits: BrandKit[] }) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [brief, setBrief] = React.useState<ProjectBrief>(() => defaultBrief("music"));
  const [brandKitId, setBrandKitId] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const styles = React.useMemo(() => listStylesForCategory(brief.category), [brief.category]);

  function patchBrief(patch: Partial<ProjectBrief>) {
    setBrief((current) => ({ ...current, ...patch }) as ProjectBrief);
  }

  function patchDetails(patch: Partial<ProjectBrief["details"]>) {
    setBrief(
      (current) =>
        ({ ...current, details: { ...current.details, ...patch } }) as ProjectBrief,
    );
  }

  function chooseCategory(category: ProjectCategory) {
    setBrief((current) => ({
      ...defaultBrief(category),
      // Keep anything the user already typed that is category independent.
      name: current.name,
      description: current.description,
      audience: current.audience,
      goal: current.goal,
      platform: current.platform,
      language: current.language,
      tone: current.tone,
      durationSeconds: current.durationSeconds,
      callToAction: current.callToAction,
      brandColors: current.brandColors,
      logoAssetId: current.logoAssetId,
      mediaAssetIds: current.mediaAssetIds,
    }) as ProjectBrief);
    setErrors({});
    setStep(1);
  }

  async function onSubmit() {
    setSubmitting(true);
    setFormError(null);
    setErrors({});
    try {
      const result = await apiSend<{ project: Project }>("/api/projects", "POST", {
        brief,
        brandKitId,
      });
      toast.success("Projekt angelegt. Konzepte können jetzt generiert werden.");
      router.push(`/projects/${result.project.id}/concepts?autostart=1`);
    } catch (error) {
      if (error instanceof ApiClientError && Array.isArray(error.details)) {
        const mapped: Record<string, string> = {};
        for (const issue of error.details as Array<{ path: string; message: string }>) {
          mapped[issue.path.replace(/^brief\./, "")] = issue.message;
        }
        setErrors(mapped);
        setStep(1);
      }
      setFormError(errorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Neues Video</h1>
        <ol className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {STEPS.map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => index < step && setStep(index)}
                disabled={index > step}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1 transition-colors",
                  index === step
                    ? "border-violet-brand bg-violet-brand/15 text-chalk"
                    : index < step
                      ? "border-ink-600 text-chalk-dim hover:border-violet-brand/50"
                      : "border-ink-700 text-chalk-faint",
                )}
              >
                {index < step ? <Check className="size-3.5" /> : <span>{index + 1}</span>}
                {label}
              </button>
              {index < STEPS.length - 1 ? (
                <span className="text-chalk-faint">/</span>
              ) : null}
            </li>
          ))}
        </ol>
      </header>

      {formError ? <ErrorState message={formError} className="mb-6" /> : null}

      {step === 0 ? (
        <section aria-label="Kategorie wählen" className="grid gap-3 sm:grid-cols-2">
          {PROJECT_CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICONS[category];
            return (
              <button
                key={category}
                type="button"
                onClick={() => chooseCategory(category)}
                className={cn(
                  "surface-card flex items-start gap-3 p-4 text-left transition-colors hover:border-violet-brand/60",
                  brief.category === category && "border-violet-brand/60",
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-700 text-violet-brand">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{CATEGORY_LABELS[category]}</span>
                  <span className="mt-0.5 block text-xs text-chalk-faint">
                    {CATEGORY_HINTS[category]}
                  </span>
                </span>
              </button>
            );
          })}
        </section>
      ) : null}

      {step === 1 ? (
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            setStep(2);
          }}
        >
          <Card>
            <CardContent className="space-y-4 pt-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-chalk-faint">
                  Allgemein
                </h2>
                <Badge tone="violet">{CATEGORY_LABELS[brief.category]}</Badge>
              </div>

              <Field label="Projektname" htmlFor="name" required error={errors.name}>
                <Input
                  id="name"
                  value={brief.name}
                  onChange={(event) => patchBrief({ name: event.target.value })}
                  placeholder="Midnight Drive – Release-Kampagne"
                  required
                />
              </Field>

              <Field
                label="Kurze Beschreibung"
                htmlFor="description"
                required
                error={errors.description}
                hint="Was bewirbst du und was ist daran besonders? Zwei bis drei Sätze genügen."
              >
                <Textarea
                  id="description"
                  value={brief.description}
                  onChange={(event) => patchBrief({ description: event.target.value })}
                  required
                  minLength={10}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Zielgruppe" htmlFor="audience">
                  <Input
                    id="audience"
                    value={brief.audience}
                    onChange={(event) => patchBrief({ audience: event.target.value })}
                    placeholder="Synthwave-Hörer zwischen 18 und 34"
                  />
                </Field>
                <Field label="Ziel des Videos" htmlFor="goal">
                  <Input
                    id="goal"
                    value={brief.goal}
                    onChange={(event) => patchBrief({ goal: event.target.value })}
                    placeholder="Streams am Release-Tag"
                  />
                </Field>
                <Field label="Plattform" htmlFor="platform">
                  <NativeSelect
                    id="platform"
                    value={brief.platform}
                    onChange={(event) =>
                      patchBrief({ platform: event.target.value as ProjectBrief["platform"] })
                    }
                  >
                    {PLATFORMS.map((platform) => (
                      <option key={platform} value={platform}>
                        {PLATFORM_LABELS[platform]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Sprache" htmlFor="language">
                  <NativeSelect
                    id="language"
                    value={brief.language}
                    onChange={(event) =>
                      patchBrief({ language: event.target.value as ProjectBrief["language"] })
                    }
                  >
                    {LANGUAGES.map((language) => (
                      <option key={language} value={language}>
                        {LANGUAGE_LABELS[language]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Tonalität" htmlFor="tone">
                  <NativeSelect
                    id="tone"
                    value={brief.tone}
                    onChange={(event) =>
                      patchBrief({ tone: event.target.value as ProjectBrief["tone"] })
                    }
                  >
                    {TONES.map((tone) => (
                      <option key={tone} value={tone}>
                        {TONE_LABELS[tone]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Videolänge" htmlFor="duration">
                  <NativeSelect
                    id="duration"
                    value={String(brief.durationSeconds)}
                    onChange={(event) =>
                      patchBrief({
                        durationSeconds: Number(
                          event.target.value,
                        ) as ProjectBrief["durationSeconds"],
                      })
                    }
                  >
                    {VIDEO_DURATIONS.map((duration) => (
                      <option key={duration} value={duration}>
                        {duration} Sekunden
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Call-to-Action" htmlFor="cta">
                  <Input
                    id="cta"
                    value={brief.callToAction}
                    onChange={(event) => patchBrief({ callToAction: event.target.value })}
                    placeholder="Jetzt überall streamen"
                  />
                </Field>
                <Field label="Ziel-URL" htmlFor="targetUrl" error={errors.targetUrl}>
                  <Input
                    id="targetUrl"
                    type="url"
                    value={brief.targetUrl}
                    onChange={(event) => patchBrief({ targetUrl: event.target.value })}
                    placeholder="https://…"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-chalk-faint">
                {CATEGORY_LABELS[brief.category]}
              </h2>
              <CategoryFields brief={brief} onDetails={patchDetails} errors={errors} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 pt-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-chalk-faint">
                Branding & eigene Medien
              </h2>

              {brandKits.length > 0 ? (
                <Field label="Brand-Kit" htmlFor="brandKit">
                  <NativeSelect
                    id="brandKit"
                    value={brandKitId ?? ""}
                    onChange={(event) => {
                      const value = event.target.value || null;
                      setBrandKitId(value);
                      const kit = brandKits.find((entry) => entry.id === value);
                      if (kit) {
                        patchBrief({
                          brandColors: [kit.primaryColor, kit.secondaryColor, kit.accentColor],
                          logoAssetId: kit.logoAssetId,
                        });
                      }
                    }}
                  >
                    <option value="">Kein Brand-Kit</option>
                    {brandKits.map((kit) => (
                      <option key={kit.id} value={kit.id}>
                        {kit.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}

              <Field
                label="Markenfarben"
                htmlFor="brandColors"
                hint="Hex-Werte, durch Komma getrennt. Werden für Hintergründe und Verläufe genutzt."
              >
                <Input
                  id="brandColors"
                  value={brief.brandColors.join(", ")}
                  onChange={(event) =>
                    patchBrief({
                      brandColors: event.target.value
                        .split(",")
                        .map((entry) => entry.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="#7C3AED, #EC4899"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <AssetUploader
                  label="Logo"
                  kind="logo"
                  accept={`${IMAGE_ACCEPT},image/svg+xml`}
                  value={brief.logoAssetId ? [brief.logoAssetId] : []}
                  onChange={(ids) => patchBrief({ logoAssetId: ids[0] ?? null })}
                />
                <AssetUploader
                  label="Eigene Bilder und Videos"
                  kind="image"
                  accept={MEDIA_ACCEPT}
                  multiple
                  value={brief.mediaAssetIds}
                  onChange={(ids) => patchBrief({ mediaAssetIds: ids })}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(0)}>
              <ArrowLeft className="size-4" /> Zurück
            </Button>
            <Button type="submit">
              Weiter <ArrowRight className="size-4" />
            </Button>
          </div>
        </form>
      ) : null}

      {step === 2 ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-chalk-faint">
                Video-Stil
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {styles.slice(0, 6).map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => patchBrief({ styleId: style.id })}
                    aria-pressed={brief.styleId === style.id}
                    className={cn(
                      "overflow-hidden rounded-xl border text-left transition-colors",
                      brief.styleId === style.id
                        ? "border-violet-brand shadow-glow"
                        : "border-ink-700 hover:border-ink-500",
                    )}
                  >
                    <span
                      className="block h-20"
                      style={{ background: `linear-gradient(150deg, ${style.gradient.join(", ")})` }}
                    />
                    <span className="block p-3">
                      <span className="block text-sm font-semibold">{style.name}</span>
                      <span className="mt-0.5 block text-xs text-chalk-faint">
                        {style.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <Field
                label="Eigener Zusatz-Prompt (optional)"
                htmlFor="extraPrompt"
                hint="Zusätzliche Anweisung für die Konzeptgenerierung, z. B. „keine Preise nennen“."
              >
                <Textarea
                  id="extraPrompt"
                  value={brief.extraPrompt}
                  onChange={(event) => patchBrief({ extraPrompt: event.target.value })}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-chalk-faint">
                Zusammenfassung
              </h2>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {[
                  ["Projekt", brief.name || "–"],
                  ["Kategorie", CATEGORY_LABELS[brief.category]],
                  ["Plattform", PLATFORM_LABELS[brief.platform]],
                  ["Tonalität", TONE_LABELS[brief.tone]],
                  ["Länge", `${brief.durationSeconds} Sekunden`],
                  ["Sprache", LANGUAGE_LABELS[brief.language]],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-ink-800 py-1.5">
                    <dt className="text-chalk-faint">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft className="size-4" /> Zurück
            </Button>
            <Button type="button" onClick={onSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Projekt anlegen & Konzepte generieren
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
