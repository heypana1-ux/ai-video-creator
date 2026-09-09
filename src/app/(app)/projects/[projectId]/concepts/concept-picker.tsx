"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Clapperboard, Hash, Lightbulb, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { CreditEstimateBox } from "@/components/app/credit-estimate";
import { JobProgress } from "@/components/app/job-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { ConceptTuning } from "./concept-tuning";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { apiGet, apiSend, errorMessage } from "@/lib/client/api";
import { useJob } from "@/lib/client/use-job";
import type { CreditEstimate } from "@/lib/credits/pricing";
import type { Concept, Project } from "@/lib/domain/schemas";
import { cn } from "@/lib/util/cn";
import { formatDuration } from "@/lib/util/format";

interface Props {
  project: Project;
  initialConcepts: Concept[];
  balance: number;
  demoMode: boolean;
}

export function ConceptPicker({ project, initialConcepts, balance, demoMode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [concepts, setConcepts] = React.useState(initialConcepts);
  const [estimate, setEstimate] = React.useState<CreditEstimate | null>(null);
  const [selecting, setSelecting] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const autoStarted = React.useRef(false);

  const job = useJob(async (finished) => {
    if (finished.job.status === "succeeded") {
      const result = await apiGet<{ concepts: Concept[] }>(
        `/api/projects/${project.id}/concepts`,
      );
      setConcepts(result.concepts);
      toast.success(
        finished.job.error
          ? "Konzepte erstellt (Demo-Generator verwendet)."
          : "Drei Konzepte sind fertig.",
      );
    } else if (finished.job.status === "failed") {
      toast.error(finished.job.error ?? "Die Konzeptgenerierung ist fehlgeschlagen.");
    }
  });

  React.useEffect(() => {
    apiGet<{ estimate: CreditEstimate }>(
      `/api/projects/${project.id}/estimate?operation=concepts`,
    )
      .then((result) => setEstimate(result.estimate))
      .catch(() => undefined);
  }, [project.id]);

  const generate = React.useCallback(
    async (extraPrompt = "") => {
      setStarting(true);
      setError(null);
      try {
        const result = await apiSend<{ job: { id: string } }>(
          `/api/projects/${project.id}/concepts`,
          "POST",
          { extraPrompt },
        );
        job.track(result.job.id);
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setStarting(false);
      }
    },
    [job, project.id],
  );

  // Coming straight from the wizard: kick the first generation off automatically.
  // Deferred to a task so the effect itself performs no synchronous state update.
  React.useEffect(() => {
    if (autoStarted.current) return;
    if (searchParams.get("autostart") !== "1") return;
    if (concepts.length > 0) return;
    autoStarted.current = true;
    const timer = setTimeout(() => void generate(""), 0);
    return () => clearTimeout(timer);
  }, [concepts.length, generate, searchParams]);

  async function selectConcept(conceptId: string) {
    setSelecting(conceptId);
    try {
      await apiSend(`/api/projects/${project.id}/concepts/${conceptId}/select`, "POST");
      router.push(`/projects/${project.id}/editor`);
    } catch (caught) {
      toast.error(errorMessage(caught));
      setSelecting(null);
    }
  }

  const busy = job.isActive || starting;

  return (
    <div className="space-y-6">
      {error ? <ErrorState message={error} onRetry={() => void generate("")} /> : null}

      {job.job && job.isActive ? (
        <JobProgress
          job={job.job}
          title="Konzepte werden entwickelt"
          onCancel={() => void job.cancel()}
        />
      ) : null}

      {job.job && !job.isActive && job.job.job.status === "failed" ? (
        <JobProgress job={job.job} title="Konzeptgenerierung" onRetry={() => void generate("")} />
      ) : null}

      {concepts.length === 0 && !busy ? (
        <div className="space-y-4">
          {estimate ? (
            <CreditEstimateBox estimate={estimate} balance={balance} demoMode={demoMode} />
          ) : null}
          <EmptyState
            icon={<Lightbulb className="size-6" />}
            title="Noch keine Konzepte"
            description="AdReel entwickelt aus deinem Briefing drei unterschiedliche Werbekonzepte mit Hook, Skript, Szenen und Caption."
            action={
              <Button onClick={() => void generate("")} disabled={busy}>
                <Sparkles className="size-4" /> Drei Konzepte generieren
              </Button>
            }
          />
        </div>
      ) : null}

      {busy && concepts.length === 0 && !job.job ? <LoadingState /> : null}

      {concepts.length > 0 ? (
        <>
          <div className="grid gap-5 lg:grid-cols-3">
            {concepts.map((concept) => (
              <Card
                key={concept.id}
                className={cn(
                  "flex flex-col transition-colors",
                  concept.selected && "border-violet-brand/60 shadow-glow",
                )}
              >
                <CardContent className="flex flex-1 flex-col gap-4 pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold leading-snug">{concept.title}</h3>
                    {concept.selected ? (
                      <Badge tone="violet">
                        <Check className="size-3" /> gewählt
                      </Badge>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-violet-brand/30 bg-violet-brand/10 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-violet-brand">
                      Hook · erste 2 Sekunden
                    </p>
                    <p className="mt-1 text-sm font-medium">{concept.hook}</p>
                  </div>

                  <p className="text-sm text-chalk-dim">{concept.bigIdea}</p>

                  <div>
                    <p className="mb-2 text-[10px] uppercase tracking-widest text-chalk-faint">
                      Szenen ({concept.scenes.length})
                    </p>
                    <ol className="space-y-1.5">
                      {concept.scenes.map((scene) => (
                        <li key={scene.id} className="flex gap-2 text-xs text-chalk-dim">
                          <span className="shrink-0 font-mono text-chalk-faint">
                            {formatDuration(scene.durationMs)}
                          </span>
                          <span className="min-w-0">
                            <span className="font-medium text-chalk">{scene.title}</span>
                            {scene.text.content ? ` – „${scene.text.content}“` : ""}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-widest text-chalk-faint">
                      Voice-over
                    </p>
                    <p className="text-xs leading-relaxed text-chalk-dim">
                      {concept.voiceoverScript || "Kein Voice-over – reines Musik-/Textvideo."}
                    </p>
                  </div>

                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-widest text-chalk-faint">
                      Caption
                    </p>
                    <p className="text-xs text-chalk-dim">{concept.caption}</p>
                    <p className="mt-1.5 flex flex-wrap gap-1 text-xs text-electric">
                      {concept.hashtags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </p>
                  </div>

                  <div className="rounded-xl border border-ink-700 bg-ink-850 p-3">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-chalk-faint">
                      <Hash className="size-3" /> Warum das funktionieren kann
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-chalk-dim">
                      {concept.rationale}
                    </p>
                  </div>

                  <Button
                    className="mt-auto"
                    onClick={() => selectConcept(concept.id)}
                    disabled={selecting !== null}
                    variant={concept.selected ? "secondary" : "primary"}
                  >
                    {selecting === concept.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Clapperboard className="size-4" />
                    )}
                    {concept.selected ? "Im Editor öffnen" : "Dieses Konzept wählen"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <ConceptTuning
            project={project}
            selectedConcept={concepts.find((concept) => concept.selected) ?? concepts[0] ?? null}
            busy={busy}
            onRegenerate={(prompt) => void generate(prompt)}
            onConceptUpdated={(updated) =>
              setConcepts((current) =>
                current.map((concept) => (concept.id === updated.id ? updated : concept)),
              )
            }
          >
            {estimate ? (
              <CreditEstimateBox estimate={estimate} balance={balance} demoMode={demoMode} />
            ) : null}
          </ConceptTuning>
        </>
      ) : null}
    </div>
  );
}
