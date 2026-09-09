import Anthropic from "@anthropic-ai/sdk";

import { serverEnv } from "@/lib/config/env";

import { ProviderError, codeForStatus } from "../errors";
import { executeProviderCall } from "../execute";
import type {
  ProviderCallOptions,
  ProviderResult,
  ProviderStatus,
  TextGenerationInput,
  TextGenerationOutput,
  TextGenerationProvider,
} from "../types";

/**
 * Anthropic Messages API adapter, on the official SDK.
 *
 * Two parameters that older code commonly sends are rejected by every current
 * model (Opus 5, Sonnet 5, the 4.6/4.7/4.8 family) with a 400:
 *
 *   - `temperature` / `top_p` / `top_k` - sampling controls were removed.
 *     `TextGenerationInput.temperature` is therefore ignored here; other
 *     adapters (OpenAI) still honour it.
 *   - assistant prefill (seeding the reply with `{`) - no longer allowed.
 *     JSON shape is instead carried by the prompt, and `extractJsonObject`
 *     plus Zod validation in the concept engine handle any stray prose.
 *
 * Retries are owned by `executeProviderCall`, so the SDK's own retry loop is
 * switched off to avoid multiplying the two.
 */
export class AnthropicTextProvider implements TextGenerationProvider {
  readonly id = "anthropic-text";
  readonly kind = "text" as const;
  readonly isDemo = false;

  private client(apiKey: string): Anthropic {
    return new Anthropic({
      apiKey,
      baseURL: serverEnv.anthropicBaseUrl,
      maxRetries: 0,
    });
  }

  async status(): Promise<ProviderStatus> {
    const configured = Boolean(serverEnv.anthropicApiKey);
    return {
      id: this.id,
      kind: this.kind,
      available: configured,
      isDemo: false,
      detail: configured
        ? `Modell ${serverEnv.anthropicTextModel}${
            serverEnv.anthropicEffort ? ` (Effort: ${serverEnv.anthropicEffort})` : ""
          }`
        : "ANTHROPIC_API_KEY fehlt",
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
    const effort = serverEnv.anthropicEffort;

    return executeProviderCall<TextGenerationOutput>(
      {
        providerId: this.id,
        kind: this.kind,
        operation: "generate",
        isDemo: false,
        cost: { estimatedUsd: 0.02, credits: 0 },
        attempt: async ({ signal, onProgress, setProviderJobId }) => {
          onProgress(0.2, "Anfrage wird gesendet");

          const response = await this.client(apiKey)
            .messages.create(
              {
                model,
                max_tokens: input.maxOutputTokens ?? 8000,
                system: input.system,
                messages: [{ role: "user", content: input.prompt }],
                ...(effort ? { output_config: { effort } } : {}),
              },
              { signal },
            )
            .catch((error: unknown) => {
              throw toProviderError(error, this.id);
            });

          setProviderJobId(response.id);
          onProgress(0.9, "Antwort wird verarbeitet");

          // `stop_details` is only populated when the model declined.
          if (response.stop_reason === "refusal") {
            throw new ProviderError(
              "bad_request",
              this.id,
              "Das Modell hat die Anfrage abgelehnt. Bitte das Briefing anpassen.",
              { retryable: false },
            );
          }

          const text = response.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("");

          if (!text.trim()) {
            throw new ProviderError("invalid_response", this.id, "Leere Antwort erhalten");
          }

          return {
            text,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            model: response.model,
          };
        },
      },
      options,
    );
  }
}

/** Maps the SDK's typed errors onto the shared provider error type. */
function toProviderError(error: unknown, providerId: string): ProviderError {
  if (error instanceof Anthropic.APIUserAbortError) {
    return new ProviderError("cancelled", providerId, "Abgebrochen", { retryable: false });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ProviderError("unavailable", providerId, "Keine Verbindung zur Anthropic-API");
  }
  if (error instanceof Anthropic.APIError && typeof error.status === "number") {
    return new ProviderError(codeForStatus(error.status), providerId, error.message, {
      statusCode: error.status,
      cause: error,
    });
  }
  return new ProviderError(
    "upstream_error",
    providerId,
    error instanceof Error ? error.message : String(error),
    { cause: error },
  );
}
