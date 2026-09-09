import type { ProjectBrief } from "@/lib/domain/schemas";
import { CATEGORY_LABELS, PLATFORM_LABELS, TONE_LABELS } from "@/lib/domain/enums";
import { SCENE_ROLES } from "@/lib/video/styles";

import { ASSET_HINTS } from "./draft-schema";

/**
 * Prompt construction for the concept generator.
 *
 * The brief is embedded as a machine readable `<BRIEF>` block. Real models read
 * it as context; the mock provider parses it back out and runs the deterministic
 * composer. That keeps a single code path: every provider - mock or not -
 * returns JSON that goes through the same validation and layout pipeline.
 */

export const BRIEF_OPEN = "<BRIEF>";
export const BRIEF_CLOSE = "</BRIEF>";

export interface ConceptPromptTask {
  kind: "concepts" | "hooks" | "scene_rewrite" | "rescript";
  count?: number;
  /** Free text the user added on top of the brief. */
  extraPrompt?: string;
  /** Scene id when rewriting a single scene. */
  sceneId?: string;
}

export interface BriefEnvelope {
  task: ConceptPromptTask;
  brief: ProjectBrief;
}

export function encodeBriefEnvelope(envelope: BriefEnvelope): string {
  return `${BRIEF_OPEN}\n${JSON.stringify(envelope)}\n${BRIEF_CLOSE}`;
}

export function decodeBriefEnvelope(prompt: string): BriefEnvelope | null {
  const start = prompt.indexOf(BRIEF_OPEN);
  const end = prompt.indexOf(BRIEF_CLOSE);
  if (start === -1 || end === -1 || end < start) return null;
  const json = prompt.slice(start + BRIEF_OPEN.length, end).trim();
  try {
    return JSON.parse(json) as BriefEnvelope;
  } catch {
    return null;
  }
}

const GUARDRAILS = [
  "Erfinde niemals Kundenstimmen, Bewertungen, Auszeichnungen, Chartplatzierungen oder Nutzerzahlen.",
  "Formuliere keine Garantien oder Heilsversprechen und keine Ergebnisversprechen, die nicht im Briefing belegt sind.",
  "Wenn ein Testimonial-Format gewünscht ist, liefere nur ein Skript-Gerüst mit klar markierten Platzhaltern.",
  "Verwende ausschließlich Fakten aus dem Briefing. Fehlt eine Angabe, lasse sie weg statt sie zu erfinden.",
].join(" ");

export function buildConceptSystemPrompt(): string {
  return [
    "Du bist Creative Director für vertikale Kurzvideo-Werbung (TikTok, Instagram Reels, YouTube Shorts).",
    "Du lieferst ausschließlich gültiges JSON ohne Markdown-Codefences und ohne erklärenden Text davor oder danach.",
    GUARDRAILS,
  ].join(" ");
}

export function buildConceptPrompt(
  brief: ProjectBrief,
  task: ConceptPromptTask,
): string {
  const count = task.count ?? 3;
  const shape = [
    "{",
    '  "concepts": [{',
    '    "title": string,',
    '    "bigIdea": string,',
    '    "audience": string,',
    '    "hook": string,',
    '    "callToAction": string,',
    '    "caption": string,',
    '    "hashtags": string[],',
    '    "rationale": string,',
    '    "musicNote": string,',
    '    "styleId": string,',
    '    "beats": [{',
    `      "role": ${SCENE_ROLES.map((role) => `"${role}"`).join(" | ")},`,
    '      "priority": 1..5,',
    '      "weight": 0.2..4,',
    '      "title": string,',
    '      "text": string,',
    '      "subline": string,',
    '      "voiceover": string,',
    '      "visual": string,',
    '      "mediaPrompt": string,',
    '      "sourceKind": "ai_video" | "ai_image_motion" | "user_upload" | "website_screenshot" | "app_screenshot" | "stock_demo" | "color_gradient",',
    `      "assetHint": ${ASSET_HINTS.map((hint) => `"${hint}"`).join(" | ")},`,
    '      "soundNote": string',
    "    }]",
    "  }]",
    "}",
  ].join("\n");

  const instructions = [
    `Entwickle ${count} deutlich unterschiedliche Werbekonzepte für das folgende Briefing.`,
    `Kategorie: ${CATEGORY_LABELS[brief.category]}. Plattform: ${PLATFORM_LABELS[brief.platform]}. Tonalität: ${TONE_LABELS[brief.tone]}. Sprache der Texte: ${brief.language}. Gesamtlänge: ${brief.durationSeconds} Sekunden.`,
    "Jedes Konzept braucht einen anderen dramaturgischen Ansatz - nicht dreimal dieselbe Idee mit anderen Worten.",
    "Der Hook muss in den ersten zwei Sekunden funktionieren und konkret auf den Inhalt des Briefings eingehen.",
    "Nenne im Text echte Details aus dem Briefing (Namen, Titel, Features, Preise), keine Platzhalter wie [Produkt].",
    "`text` ist der Text im Bild und darf maximal etwa 6 Wörter lang sein. `voiceover` ist der gesprochene Satz.",
    "`weight` beschreibt nur das Verhältnis der Szenenlängen zueinander. Die absoluten Sekunden berechnet das System.",
    "`rationale` erklärt in zwei bis drei Sätzen, warum das Konzept auf dieser Plattform funktionieren kann.",
    GUARDRAILS,
    task.extraPrompt ? `Zusätzliche Anweisung des Nutzers: ${task.extraPrompt}` : "",
    "",
    "Antworte ausschließlich mit JSON in genau dieser Form:",
    shape,
    "",
    "Briefing:",
    encodeBriefEnvelope({ task: { ...task, count }, brief }),
  ]
    .filter(Boolean)
    .join("\n");

  return instructions;
}

export function buildHooksPrompt(brief: ProjectBrief, count: number): string {
  return [
    `Formuliere ${count} alternative Hooks (jeweils maximal 12 Wörter) für das folgende Briefing.`,
    "Jeder Hook muss in den ersten zwei Sekunden gesprochen oder gelesen werden können.",
    GUARDRAILS,
    'Antworte ausschließlich mit JSON: {"hooks": string[]}',
    "",
    "Briefing:",
    encodeBriefEnvelope({ task: { kind: "hooks", count }, brief }),
  ].join("\n");
}

/**
 * Models sometimes wrap JSON in code fences or add a sentence around it.
 * This extracts the outermost JSON object without executing anything.
 */
export function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return candidate;
  return candidate.slice(start, end + 1);
}
