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

interface ChatCompletionResponse {
  id?: string;
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** OpenAI Chat Completions adapter. */
export class OpenAiTextProvider implements TextGenerationProvider {
  readonly id = "openai-text";
  readonly kind = "text" as const;
  readonly isDemo = false;

  async status(): Promise<ProviderStatus> {
    const configured = Boolean(serverEnv.openaiApiKey);
    return {
      id: this.id,
      kind: this.kind,
      available: configured,
      isDemo: false,
      detail: configured
        ? `Modell ${serverEnv.openaiTextModel}`
        : "OPENAI_API_KEY fehlt",
    };
  }

  async generate(
    input: TextGenerationInput,
    options: ProviderCallOptions = {},
  ): Promise<ProviderResult<TextGenerationOutput>> {
    const apiKey = serverEnv.openaiApiKey;
    if (!apiKey) {
      throw new ProviderError("unavailable", this.id, "OPENAI_API_KEY fehlt", {
        retryable: false,
      });
    }

    const model = serverEnv.openaiTextModel;
    return executeProviderCall<TextGenerationOutput>(
      {
        providerId: this.id,
        kind: this.kind,
        operation: "generate",
        isDemo: false,
        // Rough public list price for a small model; refined per deployment.
        cost: { estimatedUsd: 0.01, credits: 0 },
        attempt: async ({ signal, onProgress, setProviderJobId }) => {
          onProgress(0.2, "Anfrage wird gesendet");
          const body = await providerJson<ChatCompletionResponse>(
            this.id,
            `${serverEnv.openaiBaseUrl}/chat/completions`,
            {
              method: "POST",
              signal,
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model,
                temperature: input.temperature ?? 0.8,
                max_tokens: input.maxOutputTokens ?? 4000,
                ...(input.json ? { response_format: { type: "json_object" } } : {}),
                messages: [
                  { role: "system", content: input.system },
                  { role: "user", content: input.prompt },
                ],
              }),
            },
          );

          if (body.id) setProviderJobId(body.id);
          onProgress(0.9, "Antwort wird verarbeitet");

          const text = body.choices?.[0]?.message?.content ?? "";
          if (!text.trim()) {
            throw new ProviderError("invalid_response", this.id, "Leere Antwort erhalten");
          }
          return {
            text,
            inputTokens: body.usage?.prompt_tokens ?? 0,
            outputTokens: body.usage?.completion_tokens ?? 0,
            model: body.model ?? model,
          };
        },
      },
      options,
    );
  }
}
