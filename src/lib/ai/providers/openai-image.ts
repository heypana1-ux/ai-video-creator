import { serverEnv } from "@/lib/config/env";

import { ProviderError } from "../errors";
import { executeProviderCall } from "../execute";
import type {
  GeneratedMedia,
  ImageGenerationInput,
  ImageGenerationProvider,
  ProviderCallOptions,
  ProviderResult,
  ProviderStatus,
  StorageProvider,
} from "../types";
import { providerJson } from "./http";

interface ImageResponse {
  created?: number;
  data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
}

/** Maps an arbitrary aspect onto the sizes the image API accepts. */
function nearestSupportedSize(width: number, height: number): string {
  if (height > width) return "1024x1536";
  if (width > height) return "1536x1024";
  return "1024x1024";
}

/** OpenAI image generation adapter. Uploads the result to storage. */
export class OpenAiImageProvider implements ImageGenerationProvider {
  readonly id = "openai-image";
  readonly kind = "image" as const;
  readonly isDemo = false;

  constructor(private readonly storage: StorageProvider) {}

  async status(): Promise<ProviderStatus> {
    const configured = Boolean(serverEnv.openaiApiKey);
    return {
      id: this.id,
      kind: this.kind,
      available: configured,
      isDemo: false,
      detail: configured ? `Modell ${serverEnv.openaiImageModel}` : "OPENAI_API_KEY fehlt",
    };
  }

  async generate(
    input: ImageGenerationInput,
    options: ProviderCallOptions = {},
  ): Promise<ProviderResult<GeneratedMedia>> {
    const apiKey = serverEnv.openaiApiKey;
    if (!apiKey) {
      throw new ProviderError("unavailable", this.id, "OPENAI_API_KEY fehlt", {
        retryable: false,
      });
    }

    return executeProviderCall<GeneratedMedia>(
      {
        providerId: this.id,
        kind: this.kind,
        operation: "generate",
        isDemo: false,
        cost: { estimatedUsd: 0.04, credits: 0 },
        attempt: async ({ signal, onProgress }) => {
          onProgress(0.15, "Bild wird angefragt");
          const body = await providerJson<ImageResponse>(
            this.id,
            `${serverEnv.openaiBaseUrl}/images/generations`,
            {
              method: "POST",
              signal,
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: serverEnv.openaiImageModel,
                prompt: input.prompt,
                size: nearestSupportedSize(input.width, input.height),
                n: 1,
              }),
            },
          );

          onProgress(0.7, "Bild wird gespeichert");
          const first = body.data?.[0];
          const bytes = first?.b64_json
            ? Uint8Array.from(Buffer.from(first.b64_json, "base64"))
            : first?.url
              ? new Uint8Array(
                  await (await fetch(first.url, { signal })).arrayBuffer(),
                )
              : null;

          if (!bytes) {
            throw new ProviderError("invalid_response", this.id, "Kein Bild in der Antwort");
          }

          const stored = await this.storage.put(
            `generated/images/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.png`,
            bytes,
            "image/png",
          );

          return {
            url: stored.url,
            mimeType: "image/png",
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
