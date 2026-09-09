import { serverEnv } from "@/lib/config/env";

import { ProviderError } from "../errors";
import { executeProviderCall } from "../execute";
import type {
  ProviderCallOptions,
  ProviderResult,
  ProviderStatus,
  TextGenerationInput,
  TextGenerationOutput,
  TextGenerationProvider,
} from "../types";
import { providerJson } from "./http";

interface MessagesResponse {
  id?: string;
  model?: string;
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** Anthropic Messages API adapter. */
export class AnthropicTextProvider implements TextGenerationProvider {
  readonly id = "anthropic-text";
  readonly kind = "text" as const;
  readonly isDemo = false;

  async status(): Promise<ProviderStatus> {
    const configured = Boolean(serverEnv.anthropicApiKey);
    return {
      id: this.id,
      kind: this.kind,
      available: configured,
      isDemo: false,
      detail: configured ? `Modell ${serverEnv.anthropicTextModel}` : "ANTHROPIC_API_KEY fehlt",
    };
  }

  async generate(
    input: TextGenerationInput,
    options: ProviderCallOptions = {},
  ): Promise<ProviderResult<TextGenerationOutput>> {
    const apiKey = serverEnv.anthropicApiKey;
    if (!apiKey) {
      throw new ProviderError("unavailable", this.id, "ANTHROPIC_API_KEY fehlt", {
        retryable: false,
      });
    }

    const model = serverEnv.anthropicTextModel;
    return executeProviderCall<TextGenerationOutput>(
      {
        providerId: this.id,
        kind: this.kind,
        operation: "generate",
        isDemo: false,
        cost: { estimatedUsd: 0.02, credits: 0 },
        attempt: async ({ signal, onProgress, setProviderJobId }) => {
          onProgress(0.2, "Anfrage wird gesendet");
          const body = await providerJson<MessagesResponse>(
            this.id,
            `${serverEnv.anthropicBaseUrl}/v1/messages`,
            {
              method: "POST",
              signal,
              headers: {
                "content-type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model,
                max_tokens: input.maxOutputTokens ?? 4000,
                temperature: input.temperature ?? 0.8,
                system: input.system,
                messages: [
                  { role: "user", content: input.prompt },
                  // Pre-filling the assistant turn keeps JSON responses clean.
                  ...(input.json ? [{ role: "assistant", content: "{" }] : []),
                ],
              }),
            },
          );

          if (body.id) setProviderJobId(body.id);
          onProgress(0.9, "Antwort wird verarbeitet");

          const raw = (body.content ?? [])
            .filter((part) => part.type === "text")
            .map((part) => part.text ?? "")
            .join("");
          const text = input.json && !raw.trimStart().startsWith("{") ? `{${raw}` : raw;

          if (!text.trim()) {
            throw new ProviderError("invalid_response", this.id, "Leere Antwort erhalten");
          }
          return {
            text,
            inputTokens: body.usage?.input_tokens ?? 0,
            outputTokens: body.usage?.output_tokens ?? 0,
            model: body.model ?? model,
          };
        },
      },
      options,
    );
  }
}
