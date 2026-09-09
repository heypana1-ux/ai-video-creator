"use client";

import * as React from "react";

import { apiGet, apiSend, errorMessage } from "@/lib/client/api";
import type { GenerationJob, RenderJob, VideoExport } from "@/lib/domain/schemas";

export type TrackedJob =
  | { type: "generation"; job: GenerationJob; running: boolean }
  | { type: "render"; job: RenderJob; export: VideoExport | null; running: boolean };

const POLL_INTERVAL_MS = 900;

export interface UseJobResult {
  job: TrackedJob | null;
  error: string | null;
  track: (jobId: string) => void;
  cancel: () => Promise<void>;
  reset: () => void;
  isActive: boolean;
}

/**
 * Polls a background job until it reaches a terminal state.
 *
 * Polling (instead of a socket) keeps the server stateless and survives page
 * reloads: the job id is all that is needed to resume watching.
 */
export function useJob(onFinished?: (job: TrackedJob) => void): UseJobResult {
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [job, setJob] = React.useState<TrackedJob | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const finishedRef = React.useRef(onFinished);
  // Keep the latest callback without making it a polling dependency.
  React.useEffect(() => {
    finishedRef.current = onFinished;
  }, [onFinished]);

  React.useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const result = await apiGet<TrackedJob>(`/api/jobs/${jobId}`);
        if (cancelled) return;
        setJob(result);

        const status = result.job.status;
        if (status === "succeeded" || status === "failed" || status === "cancelled") {
          setJobId(null);
          finishedRef.current?.(result);
          return;
        }
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (caught) {
        if (cancelled) return;
        setError(errorMessage(caught));
        setJobId(null);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  const track = React.useCallback((id: string) => {
    setError(null);
    setJob(null);
    setJobId(id);
  }, []);

  const cancel = React.useCallback(async () => {
    const current = jobId ?? job?.job.id;
    if (!current) return;
    try {
      await apiSend(`/api/jobs/${current}/cancel`, "POST");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, [job?.job.id, jobId]);

  const reset = React.useCallback(() => {
    setJobId(null);
    setJob(null);
    setError(null);
  }, []);

  return {
    job,
    error,
    track,
    cancel,
    reset,
    isActive:
      jobId !== null ||
      job?.job.status === "queued" ||
      job?.job.status === "running",
  };
}
