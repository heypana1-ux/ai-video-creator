"use client";

import * as React from "react";
import { Check, Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, NativeSelect, Textarea } from "@/components/ui/field";
import { apiSend, errorMessage } from "@/lib/client/api";
import {
  TONES,
  TONE_LABELS,
  VIDEO_DURATIONS,
  type Tone,
  type VideoDuration,
} from "@/lib/domain/enums";
import type { Concept, Project, ProjectBrief } from "@/lib/domain/schemas";

interface Props {
  project: Project;
  /** The concept a generated hook would be applied to. */
  selectedConcept: Concept | null;
  busy: boolean;
  onRegenerate: (extraPrompt: string) => void;
  onConceptUpdated: (concept: Concept) => void;
  children?: React.ReactNode;
}

/**
 * Post-generation controls: change the tone, shorten or lengthen the script,
 * ask for alternative hooks, or add an extra instruction and regenerate.
 */
export function ConceptTuning({
  project,
  selectedConcept,
  busy,
  onRegenerate,
  onConceptUpdated,
  children,
}: Props) {
  const [tone, setTone] = React.useState<Tone>(project.brief.tone);
  const [duration, setDuration] = React.useState<VideoDuration>(
    project.brief.durationSeconds,
  );
  const [extraPrompt, setExtraPrompt] = React.useState("");
  const [savingBrief, setSavingBrief] = React.useState(false);
  const [hooks, setHooks] = React.useState<string[]>([]);
  const [loadingHooks, setLoadingHooks] = React.useState(false);
  const [applying, setApplying] = React.useState<string | null>(null);

  const briefChanged = tone !== project.brief.tone || duration !== project.brief.durationSeconds;

  async function saveBriefAndRegenerate() {
    setSavingBrief(true);
    try {
      const brief: ProjectBrief = {
        ...project.brief,
        tone,
        durationSeconds: duration,
      } as ProjectBrief;
      await apiSend(`/api/projects/${project.id}`, "PATCH", { brief });
      toast.success("Briefing aktualisiert – neue Konzepte werden erstellt.");
      onRegenerate(extraPrompt);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingBrief(false);
    }
  }

  async function loadHooks() {
    if (!selectedConcept) {
      toast.error("Bitte zuerst ein Konzept wählen.");
      return;
    }
    setLoadingHooks(true);
    try {
      const result = await apiSend<{ hooks: string[] }>(
        `/api/projects/${project.id}/concepts/${selectedConcept.id}/hooks`,
        "POST",
      );
      setHooks(result.hooks);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoadingHooks(false);
    }
  }

  async function applyHook(hook: string) {
    if (!selectedConcept) return;
    setApplying(hook);
    try {
      const result = await apiSend<{ concept: Concept }>(
        `/api/projects/${project.id}/concepts/${selectedConcept.id}`,
        "PATCH",
        { hook },
      );
      onConceptUpdated(result.concept);
      toast.success("Hook übernommen.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setApplying(null);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5 pt-5">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Wand2 className="size-4 text-magenta-brand" />
            Konzepte anpassen
          </h3>
          <p className="mt-1 text-sm text-chalk-faint">
            Tonalität und Länge ändern das Briefing. Danach werden die Konzepte neu
            entwickelt – bestehende Konzepte werden dabei ersetzt.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tonalität" htmlFor="tuneTone">
            <NativeSelect
              id="tuneTone"
              value={tone}
              onChange={(event) => setTone(event.target.value as Tone)}
            >
              {TONES.map((value) => (
                <option key={value} value={value}>
                  {TONE_LABELS[value]}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field
            label="Videolänge"
            htmlFor="tuneDuration"
            hint="Kürzer heißt weniger Szenen und ein knapperes Skript."
          >
            <NativeSelect
              id="tuneDuration"
              value={String(duration)}
              onChange={(event) => setDuration(Number(event.target.value) as VideoDuration)}
            >
              {VIDEO_DURATIONS.map((value) => (
                <option key={value} value={value}>
                  {value} Sekunden
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <Field
          label="Eigener Zusatz-Prompt"
          htmlFor="tunePrompt"
          hint="z. B. „mehr Humor, kein Voice-over, Fokus auf den Refrain“"
        >
          <Textarea
            id="tunePrompt"
            value={extraPrompt}
            onChange={(event) => setExtraPrompt(event.target.value)}
          />
        </Field>

        {children}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => (briefChanged ? void saveBriefAndRegenerate() : onRegenerate(extraPrompt))}
            disabled={busy || savingBrief}
          >
            {savingBrief ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {briefChanged ? "Briefing speichern & neu generieren" : "Konzepte neu generieren"}
          </Button>

          <Button variant="outline" onClick={loadHooks} disabled={loadingHooks || !selectedConcept}>
            {loadingHooks ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Alternative Hooks
          </Button>
        </div>

        {hooks.length > 0 ? (
          <div className="rounded-xl border border-ink-700 bg-ink-850 p-3">
            <p className="mb-2 text-[10px] uppercase tracking-widest text-chalk-faint">
              Alternative Hooks für „{selectedConcept?.title}“
            </p>
            <ul className="space-y-1.5">
              {hooks.map((hook) => (
                <li key={hook} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-chalk-dim">{hook}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={applying !== null}
                    onClick={() => void applyHook(hook)}
                  >
                    {applying === hook ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                    Übernehmen
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
