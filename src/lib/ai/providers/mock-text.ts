import { composeConcepts, composeHooks } from "@/lib/concepts/composer";
import { decodeBriefEnvelope } from "@/lib/concepts/prompt";

import { executeProviderCall } from "../execute";
import { ProviderError } from "../errors";
import type {
  ProviderCallOptions,
  ProviderResult,
  ProviderStatus,
  TextGenerationInput,
  TextGenerationOutput,
  TextGenerationProvider,
} from "../types";
import { mockLatencyMs, simulateWork } from "./mock-support";

/**
 * Demo text provider.
 *
 * Reads the `<BRIEF>` envelope out of the prompt and answers with the same JSON
 * shape a real model is asked for, produced by the deterministic composer. The
 * caller cannot tell the difference - it parses and validates identically.
 */
export class MockTextProvider implements TextGenerationProvider {
  readonly id = "mock-text";
  readonly kind = "text" as const;
  readonly isDemo = true;

  async status(): Promise<ProviderStatus> {
    return {
      id: this.id,
      kind: this.kind,
      available: true,
      isDemo: true,
      detail: "Demo-Generator: erzeugt Konzepte aus deinen Eingaben ohne externe API.",
    };
  }

  async generate(
    input: TextGenerationInput,
    options: ProviderCallOptions = {},
  ): Promise<ProviderResult<TextGenerationOutput>> {
    return executeProviderCall<TextGenerationOutput>(
      {
        providerId: this.id,
        kind: this.kind,
        operation: "generate",
        isDemo: true,
        cost: { estimatedUsd: 0, credits: 0 },
        maxRetries: 0,
        attempt: async ({ signal, onProgress, setProviderJobId }) => {
          setProviderJobId(`demo-${Date.now().toString(36)}`);
          await simulateWork(mockLatencyMs(1400), signal, onProgress, [
            "Briefing wird analysiert",
            "Zielgruppe wird geschärft",
            "Hooks werden entwickelt",
            "Szenen werden strukturiert",
            "Captions und Hashtags",
          ]);

          const text = this.respond(input.prompt);
          return {
            text,
            inputTokens: Math.ceil(input.prompt.length / 4),
            outputTokens: Math.ceil(text.length / 4),
            model: "adreel-demo-composer",
          };
        },
      },
      options,
    );
  }

  private respond(prompt: string): string {
    const envelope = decodeBriefEnvelope(prompt);
    if (!envelope) {
      throw new ProviderError(
        "bad_request",
        this.id,
        "Dem Demo-Generator fehlt das Briefing im Prompt.",
        { retryable: false },
      );
    }

    const { task, brief } = envelope;
    if (task.kind === "hooks") {
      return JSON.stringify({ hooks: composeHooks(brief, task.count ?? 5) });
    }
    return JSON.stringify({ concepts: composeConcepts(brief, task.count ?? 3) });
  }
}
