import type { ExportQuality } from "@/lib/domain/enums";

/**
 * Credit pricing.
 *
 * Credits are the user facing abstraction over provider cost. The rule of thumb
 * encoded here: text is cheap, images cost more, video generation costs the
 * most, and rendering is billed separately for preview and final export.
 */
export const CREDIT_COSTS = {
  /** One run of the concept generator (produces three concepts). */
  concepts: 4,
  /** Regenerating a single scene's copy. */
  sceneRewrite: 1,
  /** Generating alternative hooks. */
  hooks: 1,
  /** One AI still image. */
  image: 6,
  /** One AI video clip (per started 5 seconds). */
  videoClipPer5s: 25,
  /** Voice-over, per started 15 seconds of script. */
  voicePer15s: 3,
  /** One generated background music bed. */
  music: 5,
  /** Website import + extraction. */
  websiteImport: 1,
  /** 720x1280 preview render. */
  renderPreview: 8,
  /** 1080x1920 final export. */
  renderFinal: 20,
} as const;

export type CreditOperation = keyof typeof CREDIT_COSTS;

export interface GenerationPlan {
  concepts?: number;
  sceneRewrites?: number;
  hooks?: number;
  images?: number;
  videoClipSeconds?: number;
  voiceoverSeconds?: number;
  musicTracks?: number;
  websiteImports?: number;
  renderPreviews?: number;
  renderFinals?: number;
}

export interface CreditEstimateLine {
  operation: CreditOperation;
  label: string;
  units: number;
  creditsPerUnit: number;
  credits: number;
}

export interface CreditEstimate {
  lines: CreditEstimateLine[];
  total: number;
}

const LABELS: Record<CreditOperation, string> = {
  concepts: "Konzeptgenerierung",
  sceneRewrite: "Szene neu texten",
  hooks: "Alternative Hooks",
  image: "KI-Bild",
  videoClipPer5s: "KI-Videoclip (je 5 s)",
  voicePer15s: "Voice-over (je 15 s)",
  music: "Hintergrundmusik",
  websiteImport: "Website-Analyse",
  renderPreview: "Vorschau-Rendering (720×1280)",
  renderFinal: "Finaler Export (1080×1920)",
};

function line(
  operation: CreditOperation,
  units: number,
  lines: CreditEstimateLine[],
): void {
  if (units <= 0) return;
  const creditsPerUnit = CREDIT_COSTS[operation];
  lines.push({
    operation,
    label: LABELS[operation],
    units,
    creditsPerUnit,
    credits: units * creditsPerUnit,
  });
}

/**
 * Turns a plan of work into an itemised credit estimate. Always call this
 * before starting a paid generation so the user can see the price up front.
 */
export function estimateCredits(plan: GenerationPlan): CreditEstimate {
  const lines: CreditEstimateLine[] = [];
  line("concepts", plan.concepts ?? 0, lines);
  line("sceneRewrite", plan.sceneRewrites ?? 0, lines);
  line("hooks", plan.hooks ?? 0, lines);
  line("image", plan.images ?? 0, lines);
  line("videoClipPer5s", Math.ceil((plan.videoClipSeconds ?? 0) / 5), lines);
  line("voicePer15s", Math.ceil((plan.voiceoverSeconds ?? 0) / 15), lines);
  line("music", plan.musicTracks ?? 0, lines);
  line("websiteImport", plan.websiteImports ?? 0, lines);
  line("renderPreview", plan.renderPreviews ?? 0, lines);
  line("renderFinal", plan.renderFinals ?? 0, lines);

  return {
    lines,
    total: lines.reduce((sum, entry) => sum + entry.credits, 0),
  };
}

export function estimateRenderCredits(quality: ExportQuality): CreditEstimate {
  return estimateCredits(
    quality === "final" ? { renderFinals: 1 } : { renderPreviews: 1 },
  );
}

/** Credits a fresh workspace starts with in demo mode. */
export const DEMO_STARTING_CREDITS = 500;

export const PLANS = [
  {
    id: "demo",
    name: "Demo",
    priceEur: 0,
    creditsPerMonth: DEMO_STARTING_CREDITS,
    highlights: [
      "Kompletter Workflow mit Demo-Medien",
      "Unbegrenzte Projekte lokal",
      "Wasserzeichen auf Demo-Exporten",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    priceEur: 19,
    creditsPerMonth: 600,
    highlights: ["Echte KI-Provider", "1080×1920 Exporte", "5 Brand-Kits"],
  },
  {
    id: "creator",
    name: "Creator",
    priceEur: 49,
    creditsPerMonth: 2000,
    highlights: ["KI-Videoclips", "Priorisiertes Rendering", "Team-Workspace"],
  },
  {
    id: "studio",
    name: "Studio",
    priceEur: 149,
    creditsPerMonth: 7000,
    highlights: ["Eigene Provider-Keys", "API-Zugang", "Support mit SLA"],
  },
] as const;
