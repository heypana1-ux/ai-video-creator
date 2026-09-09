import { serverEnv } from "@/lib/config/env";

import { ProviderError } from "../errors";
import { executeProviderCall } from "../execute";
import type {
  GeneratedMedia,
  GeneratedVideo,
  ImageGenerationInput,
  ImageGenerationProvider,
  ProviderCallOptions,
  ProviderResult,
  ProviderStatus,
  StorageProvider,
  VideoGenerationInput,
  VideoGenerationProvider,
} from "../types";
import { providerJson } from "./http";

interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[] | null;
  error?: string | null;
  urls?: { get?: string; cancel?: string };
}

const POLL_INTERVAL_MS = 2_000;

/** Shared Replicate prediction lifecycle: create, poll, cancel, download. */
async function runPrediction(
  providerId: string,
  model: string,
  input: Record<string, unknown>,
  signal: AbortSignal,
  onProgress: (progress: number, step: string) => void,
  setProviderJobId: (id: string) => void,
): Promise<Uint8Array> {
  const token = serverEnv.replicateApiToken;
  if (!token) {
    throw new ProviderError("unavailable", providerId, "REPLICATE_API_TOKEN fehlt", {
      retryable: false,
    });
  }

  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  };

  onProgress(0.05, "Job wird eingereiht");
  let prediction = await providerJson<Prediction>(
    providerId,
    `https://api.replicate.com/v1/models/${model}/predictions`,
    { method: "POST", signal, headers, body: JSON.stringify({ input }) },
  );
  setProviderJobId(prediction.id);

  const pollUrl =
    prediction.urls?.get ?? `https://api.replicate.com/v1/predictions/${prediction.id}`;

  let ticks = 0;
  while (prediction.status === "starting" || prediction.status === "processing") {
    if (signal.aborted) {
      // Best effort remote cancel so the user is not billed for a job they stopped.
      if (prediction.urls?.cancel) {
        await fetch(prediction.urls.cancel, { method: "POST", headers }).catch(() => undefined);
      }
      throw new ProviderError("cancelled", providerId, "Abgebrochen", { retryable: false });
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    ticks += 1;
    onProgress(Math.min(0.85, 0.1 + ticks * 0.05), "Generierung läuft");
    prediction = await providerJson<Prediction>(providerId, pollUrl, {
      method: "GET",
      signal,
      headers,
    });
  }

  if (prediction.status !== "succeeded") {
    throw new ProviderError(
      "upstream_error",
      providerId,
      prediction.error ?? `Prediction ${prediction.status}`,
    );
  }

  const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!outputUrl) {
    throw new ProviderError("invalid_response", providerId, "Keine Ausgabe in der Antwort");
  }

  onProgress(0.92, "Medien werden geladen");
  const response = await fetch(outputUrl, { signal });
  if (!response.ok) {
    throw new ProviderError("upstream_error", providerId, `Download fehlgeschlagen (${response.status})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export class ReplicateImageProvider implements ImageGenerationProvider {
  readonly id = "replicate-image";
  readonly kind = "image" as const;
  readonly isDemo = false;

  constructor(private readonly storage: StorageProvider) {}

  async status(): Promise<ProviderStatus> {
    const configured = Boolean(serverEnv.replicateApiToken);
    return {
      id: this.id,
      kind: this.kind,
      available: configured,
      isDemo: false,
      detail: configured ? `Modell ${serverEnv.replicateImageModel}` : "REPLICATE_API_TOKEN fehlt",
    };
  }

  async generate(
    input: ImageGenerationInput,
    options: ProviderCallOptions = {},
  ): Promise<ProviderResult<GeneratedMedia>> {
    return executeProviderCall<GeneratedMedia>(
      {
        providerId: this.id,
        kind: this.kind,
        operation: "generate",
        isDemo: false,
        cost: { estimatedUsd: 0.01, credits: 0 },
        attempt: async ({ signal, onProgress, setProviderJobId }) => {
          const bytes = await runPrediction(
            this.id,
            serverEnv.replicateImageModel,
            {
              prompt: input.prompt,
              aspect_ratio: input.height > input.width ? "9:16" : "16:9",
              output_format: "webp",
              ...(input.seed !== undefined ? { seed: input.seed } : {}),
            },
            signal,
            onProgress,
            setProviderJobId,
          );

          const stored = await this.storage.put(
            `generated/images/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.webp`,
            bytes,
            "image/webp",
          );
          return {
            url: stored.url,
            mimeType: "image/webp",
            width: input.width,
            height: input.height,
            byteSize: stored.byteSize,
            isDemo: false,
          };
        },
      },
      options,
    );
  }
}

export class ReplicateVideoProvider implements VideoGenerationProvider {
  readonly id = "replicate-video";
  readonly kind = "video" as const;
  readonly isDemo = false;

  constructor(private readonly storage: StorageProvider) {}

  async status(): Promise<ProviderStatus> {
    const configured = Boolean(serverEnv.replicateApiToken);
    return {
      id: this.id,
      kind: this.kind,
      available: configured,
      isDemo: false,
      detail: configured ? `Modell ${serverEnv.replicateVideoModel}` : "REPLICATE_API_TOKEN fehlt",
    };
  }

  async generate(
    input: VideoGenerationInput,
    options: ProviderCallOptions = {},
  ): Promise<ProviderResult<GeneratedVideo>> {
    return executeProviderCall<GeneratedVideo>(
      {
        providerId: this.id,
        kind: this.kind,
        operation: "generate",
        isDemo: false,
        // Video generation is the single most expensive call in the pipeline.
        cost: { estimatedUsd: 0.5, credits: 0 },
        // Video models routinely take minutes.
        timeoutMs: 10 * 60_000,
        attempt: async ({ signal, onProgress, setProviderJobId }) => {
          const bytes = await runPrediction(
            this.id,
            serverEnv.replicateVideoModel,
            {
              prompt: input.prompt,
              ...(input.referenceImageUrl ? { first_frame_image: input.referenceImageUrl } : {}),
            },
            signal,
            onProgress,
            setProviderJobId,
          );

          const stored = await this.storage.put(
            `generated/clips/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.mp4`,
            bytes,
            "video/mp4",
          );
          return {
            url: stored.url,
            mimeType: "video/mp4",
            width: input.width,
            height: input.height,
            byteSize: stored.byteSize,
            durationMs: input.durationMs,
            motionHint: "none",
            isDemo: false,
          };
        },
      },
      options,
    );
  }
}
