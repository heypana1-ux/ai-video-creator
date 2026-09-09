"use client";

import * as React from "react";
import Link from "next/link";
import { Download, Film, Loader2, MonitorPlay, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { CreditEstimateBox } from "@/components/app/credit-estimate";
import { JobProgress } from "@/components/app/job-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { apiGet, apiSend, errorMessage } from "@/lib/client/api";
import { useJob } from "@/lib/client/use-job";
import type { CreditEstimate } from "@/lib/credits/pricing";
import type { Concept, Project, VideoExport } from "@/lib/domain/schemas";
import { formatBytes, formatDateTime, formatDuration } from "@/lib/util/format";

interface Props {
  project: Project;
  concept: Concept;
  initialExports: VideoExport[];
  balance: number;
  demoMode: boolean;
}

export function ExportPanel({ project, concept, initialExports, balance, demoMode }: Props) {
  const [exports, setExports] = React.useState(initialExports);
  const [estimates, setEstimates] = React.useState<Record<string, CreditEstimate>>({});
  const [starting, setStarting] = React.useState<string | null>(null);

  const job = useJob(async (finished) => {
    if (finished.job.status === "succeeded") {
      const result = await apiGet<{ exports: VideoExport[] }>(
        `/api/projects/${project.id}/renders`,
      );
      setExports(result.exports);
      toast.success("Video ist fertig gerendert.");
    } else if (finished.job.status === "failed") {
      toast.error(finished.job.error ?? "Das Rendering ist fehlgeschlagen.");
    }
  });

  React.useEffect(() => {
    void Promise.all(
      (["preview", "final"] as const).map(async (quality) => {
        const result = await apiGet<{ estimate: CreditEstimate }>(
          `/api/projects/${project.id}/estimate?operation=render&quality=${quality}`,
        );
        return [quality, result.estimate] as const;
      }),
    )
      .then((entries) => setEstimates(Object.fromEntries(entries)))
      .catch(() => undefined);
  }, [project.id]);

  async function startRender(quality: "preview" | "final") {
    setStarting(quality);
    try {
      const result = await apiSend<{ job: { id: string } }>(
        `/api/projects/${project.id}/renders`,
        "POST",
        { conceptId: concept.id, quality },
      );
      job.track(result.job.id);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setStarting(null);
    }
  }

  const busy = job.isActive || starting !== null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            {
              quality: "preview" as const,
              icon: MonitorPlay,
              title: "Vorschau-Export",
              size: "720 × 1280",
              copy: "Schneller Zwischenstand zum Gegenlesen und Teilen im Team.",
            },
            {
              quality: "final" as const,
              icon: Film,
              title: "Finaler Export",
              size: "1080 × 1920",
              copy: "H.264 · 30 FPS · eingebrannte Untertitel · gemischtes Audio.",
            },
          ]
        ).map((option) => (
          <Card key={option.quality}>
            <CardContent className="space-y-4 pt-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 font-semibold">
                    <option.icon className="size-4 text-electric" />
                    {option.title}
                  </h2>
                  <p className="mt-1 text-sm text-chalk-faint">{option.copy}</p>
                </div>
                <Badge tone="electric">{option.size}</Badge>
              </div>

              {estimates[option.quality] ? (
                <CreditEstimateBox
                  estimate={estimates[option.quality]}
                  balance={balance}
                  demoMode={demoMode}
                />
              ) : null}

              <Button
                className="w-full"
                variant={option.quality === "final" ? "primary" : "secondary"}
                onClick={() => startRender(option.quality)}
                disabled={busy}
              >
                {starting === option.quality ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {option.title} starten
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {job.job ? (
        <JobProgress
          job={job.job}
          title={job.isActive ? "Video wird gerendert" : "Rendering"}
          onCancel={job.isActive ? () => void job.cancel() : undefined}
          onRetry={!job.isActive ? () => startRender("preview") : undefined}
        />
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-chalk-faint">
          Exporte
        </h2>
        {exports.length === 0 ? (
          <EmptyState
            icon={<Download className="size-6" />}
            title="Noch kein Export"
            description="Starte einen Vorschau- oder finalen Export – das fertige MP4 erscheint dann hier zum Download."
          />
        ) : (
          <ul className="space-y-2">
            {exports.map((item) => (
              <li
                key={item.id}
                className="surface-card flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {item.width} × {item.height}
                    <Badge tone={item.quality === "final" ? "mint" : "neutral"}>
                      {item.quality === "final" ? "Final" : "Vorschau"}
                    </Badge>
                    {item.isDemo ? <Badge tone="violet">Demo-Inhalte</Badge> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-chalk-faint">
                    {formatDuration(item.durationMs)} · {formatBytes(item.byteSize)} ·{" "}
                    {item.fps} FPS · {formatDateTime(item.createdAt)}
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <a href={`/api/exports/${item.id}/download`} download>
                    <Download className="size-4" /> MP4 herunterladen
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card>
        <CardContent className="space-y-2 pt-5 text-sm text-chalk-dim">
          <h2 className="font-semibold text-chalk">Veröffentlichen</h2>
          <p>
            Lade die MP4-Datei herunter und poste sie direkt in TikTok, Instagram Reels oder
            YouTube Shorts. Caption und Hashtags stehen im Konzept bereit:
          </p>
          <p className="rounded-xl border border-ink-700 bg-ink-850 p-3 text-xs">
            {concept.caption}
            <br />
            <span className="text-electric">{concept.hashtags.join(" ")}</span>
          </p>
          <Button variant="link" className="px-0" asChild>
            <Link href={`/projects/${project.id}/editor`}>Zurück in den Editor</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
