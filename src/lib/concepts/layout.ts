import { randomId } from "@/lib/util/id";
import type { ProjectBrief, Concept, Scene } from "@/lib/domain/schemas";
import { getVideoStyle, type SceneBlueprint, type VideoStyle } from "@/lib/video/styles";

import type { BeatDraft, ConceptDraft } from "./draft-schema";

/**
 * Turns creative drafts into fully timed scenes.
 *
 * Providers only supply copy plus a relative weight per beat. All timing lives
 * here, which guarantees the scenes always add up to exactly the requested
 * runtime - a model that cannot count is still safe to plug in.
 */

const MIN_SCENE_MS = 900;
/** Duration in seconds -> how many scenes read comfortably at 9:16. */
const SCENE_COUNT_BY_DURATION: Array<[number, number]> = [
  [10, 3],
  [15, 4],
  [30, 5],
  [45, 6],
  [60, 7],
];

export function targetSceneCount(durationSeconds: number): number {
  for (const [seconds, count] of SCENE_COUNT_BY_DURATION) {
    if (durationSeconds <= seconds) return count;
  }
  return 8;
}

/**
 * Keeps the most important beats while always preserving the opening hook and
 * the closing CTA, and never reordering what survives.
 */
export function selectBeats(beats: BeatDraft[], targetCount: number): BeatDraft[] {
  if (beats.length <= targetCount) return beats;

  const indexed = beats.map((beat, index) => ({ beat, index }));
  const first = indexed[0];
  const last = indexed[indexed.length - 1];
  const middle = indexed.slice(1, -1);

  const keep = new Set<number>([first.index, last.index]);
  const ranked = [...middle].sort((a, b) =>
    a.beat.priority === b.beat.priority ? a.index - b.index : a.beat.priority - b.beat.priority,
  );
  for (const entry of ranked) {
    if (keep.size >= targetCount) break;
    keep.add(entry.index);
  }

  return indexed.filter((entry) => keep.has(entry.index)).map((entry) => entry.beat);
}

/**
 * Distributes `totalMs` across weights. Every slice gets at least
 * `MIN_SCENE_MS`, values snap to 100 ms and the sum is exact.
 */
export function distributeDurations(weights: number[], totalMs: number): number[] {
  const count = weights.length;
  if (count === 0) return [];
  const floor = Math.min(MIN_SCENE_MS, Math.floor(totalMs / count / 100) * 100);
  const flexible = totalMs - floor * count;

  const totalWeight = weights.reduce((sum, weight) => sum + Math.max(0.1, weight), 0);
  const raw = weights.map(
    (weight) => floor + (Math.max(0.1, weight) / totalWeight) * Math.max(0, flexible),
  );

  const rounded = raw.map((value) => Math.max(floor, Math.round(value / 100) * 100));
  let drift = totalMs - rounded.reduce((sum, value) => sum + value, 0);

  // Push the rounding remainder onto the longest scenes, 100 ms at a time.
  const order = rounded
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value)
    .map((entry) => entry.index);
  let cursor = 0;
  while (drift !== 0 && order.length > 0) {
    const index = order[cursor % order.length];
    const step = drift > 0 ? 100 : -100;
    if (step < 0 && rounded[index] + step < floor) {
      cursor += 1;
      if (cursor > order.length * 4) break;
      continue;
    }
    rounded[index] += step;
    drift -= step;
    cursor += 1;
  }

  return rounded;
}

function blueprintFor(style: VideoStyle, index: number, total: number): SceneBlueprint {
  const structure = style.sceneStructure;
  if (structure.length === 0) {
    return {
      role: "showcase",
      weight: 1,
      transition: "fade",
      effect: "ken_burns",
      textAnimation: "fade_in",
      textPosition: "center",
    };
  }
  // Last scene always uses the template's closing beat so CTAs land consistently.
  if (index === total - 1) return structure[structure.length - 1];
  return structure[index % structure.length];
}

function gradientFor(style: VideoStyle, brandColors: string[], index: number): string[] {
  const brand = brandColors.filter((color) => /^#[0-9a-fA-F]{3,8}$/.test(color));
  const source = brand.length >= 2 ? brand : style.gradient;
  const rotated = [...source.slice(index % source.length), ...source.slice(0, index % source.length)];
  return rotated.slice(0, 3);
}

export interface LayoutOptions {
  brief: ProjectBrief;
  projectId: string;
  /** Overrides the style suggested by the draft. */
  styleId?: string;
  now?: () => string;
  makeId?: () => string;
}

/** Converts one creative draft into a persisted concept with timed scenes. */
export function layoutConcept(draft: ConceptDraft, options: LayoutOptions): Concept {
  const { brief, projectId } = options;
  const makeId = options.makeId ?? randomId;
  const now = options.now ?? (() => new Date().toISOString());

  const styleId = options.styleId ?? brief.styleId ?? draft.styleId;
  const style = getVideoStyle(styleId);

  const beats = selectBeats(draft.beats, targetSceneCount(brief.durationSeconds));
  const durations = distributeDurations(
    beats.map((beat) => beat.weight),
    brief.durationSeconds * 1000,
  );

  const scenes: Scene[] = beats.map((beat, index) => {
    const blueprint = blueprintFor(style, index, beats.length);
    const isColorOnly = beat.sourceKind === "color_gradient";

    return {
      id: makeId(),
      index,
      durationMs: durations[index],
      title: beat.title,
      visualDescription: beat.visual,
      source: {
        kind: beat.sourceKind,
        assetId: null,
        url: null,
        prompt: beat.mediaPrompt,
        gradient: gradientFor(style, brief.brandColors, index),
        isDemo: false,
      },
      text: {
        content: beat.text,
        subline: beat.subline,
        fontFamily: style.typography.headline,
        fontSize: beat.text.length > 30 ? style.typography.headlineSizePx - 16 : style.typography.headlineSizePx,
        color: style.palette.text,
        position: blueprint.textPosition,
        animation: blueprint.textAnimation,
      },
      transition: index === 0 ? "none" : blueprint.transition,
      effect: isColorOnly ? "none" : blueprint.effect,
      voiceoverText: beat.voiceover,
      voiceoverAssetId: null,
      voiceoverUrl: null,
      voiceoverWords: [],
      voiceVolume: style.audioMix.voiceVolume,
      musicVolume: style.audioMix.musicVolume,
      showSubtitles: beat.voiceover.trim().length > 0,
      soundNote: beat.soundNote,
    };
  });

  const script = scenes
    .map((scene) => scene.voiceoverText.trim())
    .filter(Boolean)
    .join(" ");

  return {
    id: makeId(),
    projectId,
    title: draft.title,
    bigIdea: draft.bigIdea,
    audience: draft.audience || brief.audience,
    hook: draft.hook,
    voiceoverScript: script,
    callToAction: draft.callToAction || brief.callToAction,
    caption: draft.caption,
    hashtags: draft.hashtags,
    rationale: draft.rationale,
    musicNote: draft.musicNote,
    musicUrl: null,
    styleId: style.id,
    scenes,
    selected: false,
    isDemo: false,
    createdAt: now(),
  };
}

/** Re-times an edited concept so its scenes still fill the project duration. */
export function retimeConcept(concept: Concept, durationSeconds: number): Concept {
  const durations = distributeDurations(
    concept.scenes.map((scene) => scene.durationMs),
    durationSeconds * 1000,
  );
  return {
    ...concept,
    scenes: concept.scenes.map((scene, index) => ({
      ...scene,
      index,
      durationMs: durations[index],
    })),
  };
}
