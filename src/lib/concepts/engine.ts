import { z } from "zod";

import type { ProviderCallOptions, ProviderResultMeta, TextGenerationProvider } from "@/lib/ai/types";
import type { Concept, ProjectBrief } from "@/lib/domain/schemas";

import { composeConcepts, composeHooks } from "./composer";
import { conceptDraftResponseSchema, hookListSchema, type ConceptDraft } from "./draft-schema";
import { layoutConcept } from "./layout";
import {
  buildConceptPrompt,
  buildConceptSystemPrompt,
  buildHooksPrompt,
  extractJsonObject,
} from "./prompt";

/**
 * Concept generation.
 *
 * One code path for every provider: build the prompt, call the provider, parse
 * and validate JSON, then lay out the timing locally. If a real model answers
 * with something unusable we fall back to the deterministic composer rather
 * than failing the job - the user always ends up with three concepts.
 */

export interface GenerateConceptsResult {
  concepts: Concept[];
  meta: ProviderResultMeta | null;
  /** True when the local composer produced the result. */
  usedFallback: boolean;
  fallbackReason: string | null;
}

export interface GenerateConceptsInput {
  brief: ProjectBrief;
  projectId: string;
  count?: number;
  extraPrompt?: string;
  styleId?: string;
}

function draftsToConcepts(
  drafts: ConceptDraft[],
  input: GenerateConceptsInput,
  isDemo: boolean,
): Concept[] {
  return drafts.map((draft) => ({
    ...layoutConcept(draft, {
      brief: input.brief,
      projectId: input.projectId,
      styleId: input.styleId,
    }),
    isDemo,
  }));
}

export async function generateConcepts(
  provider: TextGenerationProvider,
  input: GenerateConceptsInput,
  options: ProviderCallOptions = {},
): Promise<GenerateConceptsResult> {
  const count = input.count ?? 3;

  try {
    const result = await provider.generate(
      {
        system: buildConceptSystemPrompt(),
        prompt: buildConceptPrompt(input.brief, {
          kind: "concepts",
          count,
          extraPrompt: input.extraPrompt,
        }),
        json: true,
        temperature: 0.9,
        maxOutputTokens: 6000,
      },
      options,
    );

    const parsed = conceptDraftResponseSchema.parse(
      JSON.parse(extractJsonObject(result.data.text)),
    );

    return {
      concepts: draftsToConcepts(parsed.concepts.slice(0, count), input, result.meta.isDemo),
      meta: result.meta,
      usedFallback: false,
      fallbackReason: null,
    };
  } catch (error) {
    // Cancellation is a user action, not a provider failure - let it through.
    if (options.signal?.aborted) throw error;

    const reason =
      error instanceof z.ZodError
        ? "Die Antwort des Sprachmodells entsprach nicht dem erwarteten Format."
        : error instanceof SyntaxError
          ? "Das Sprachmodell hat kein gültiges JSON geliefert."
          : error instanceof Error
            ? error.message
            : "Unbekannter Fehler";

    return {
      concepts: draftsToConcepts(composeConcepts(input.brief, count), input, true),
      meta: null,
      usedFallback: true,
      fallbackReason: reason,
    };
  }
}

export interface GenerateHooksResult {
  hooks: string[];
  usedFallback: boolean;
}

export async function generateHooks(
  provider: TextGenerationProvider,
  brief: ProjectBrief,
  count = 5,
  options: ProviderCallOptions = {},
): Promise<GenerateHooksResult> {
  try {
    const result = await provider.generate(
      {
        system: buildConceptSystemPrompt(),
        prompt: buildHooksPrompt(brief, count),
        json: true,
        temperature: 1,
        maxOutputTokens: 800,
      },
      options,
    );
    const parsed = hookListSchema.parse(JSON.parse(extractJsonObject(result.data.text)));
    return { hooks: parsed.hooks.slice(0, count), usedFallback: false };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return { hooks: composeHooks(brief, count), usedFallback: true };
  }
}
