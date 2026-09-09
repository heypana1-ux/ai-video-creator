"use client";

import { Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { TrackedJob } from "@/lib/client/use-job";

/** Shared progress panel for generation and render jobs. */
export function JobProgress({
  job,
  onCancel,
  onRetry,
  title,
}: {
  job: TrackedJob;
  onCancel?: () => void;
  onRetry?: () => void;
  title: string;
}) {
  const { status, progress, step, error } = job.job;
  const percentage = Math.round(progress * 100);

  return (
    <div className="surface-card space-y-3 p-5" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {status === "running" || status === "queued" ? (
            <Loader2 className="size-4 animate-spin text-violet-brand" />
          ) : status === "failed" ? (
            <XCircle className="size-4 text-danger" />
          ) : null}
          <p className="text-sm font-semibold">{title}</p>
        </div>
        <span className="text-xs text-chalk-faint">{percentage}%</span>
      </div>

      <Progress value={percentage} />
      <p className="text-sm text-chalk-faint">{step || "…"}</p>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex gap-2">
        {(status === "running" || status === "queued") && onCancel ? (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Abbrechen
          </Button>
        ) : null}
        {(status === "failed" || status === "cancelled") && onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Erneut versuchen
          </Button>
        ) : null}
      </div>
    </div>
  );
}
