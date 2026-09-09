import type { WordTiming } from "@/lib/ai/types";
import type {
  SceneEffect,
  TextAnimation,
  TextPosition,
  Transition,
} from "@/lib/domain/enums";
import type { Concept, Project, Scene } from "@/lib/domain/schemas";

import { buildCaptionCues, deriveWordTimings, type CaptionCue } from "./captions";
import { getVideoStyle, type CaptionStyle, type VideoStylePalette } from "./styles";

/**
 * The `VideoSpec` is the single serialisable description of a video.
 *
 * It is the contract between the editor, the `<Player>` preview and the
 * Remotion renderer: the preview and the export consume exactly the same
 * object, which is why what you see in the editor is what gets exported.
 */

export const FINAL_SIZE = { width: 1080, height: 1920 } as const;
export const PREVIEW_SIZE = { width: 720, height: 1280 } as const;
export const FPS = 30;

/** TikTok/Reels chrome overlaps roughly this much of the frame. */
export const SAFE_ZONES = {
  topPx: 220,
  bottomPx: 520,
  sidePx: 90,
} as const;

export interface SpecBackground {
  kind: "media" | "gradient";
  /** Absolute URL or storage key - resolved via `assetBaseUrl`. */
  src: string | null;
  mediaType: "image" | "video";
  gradient: string[];
  motion: "none" | "ken_burns" | "parallax" | "pulse";
}

export interface SpecText {
  content: string;
  subline: string;
  fontFamily: string;
  fontSizePx: number;
  color: string;
  position: TextPosition;
  animation: TextAnimation;
  uppercase: boolean;
  letterSpacingEm: number;
  weight: number;
}

export interface SpecScene {
  id: string;
  title: string;
  startFrame: number;
  durationInFrames: number;
  background: SpecBackground;
  effect: SceneEffect;
  transition: Transition;
  text: SpecText;
  voice: { src: string; volume: number } | null;
  musicVolume: number;
  showSubtitles: boolean;
}

export interface VideoSpec {
  version: 1;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  /** Prefix for relative media keys. Empty string means "use staticFile()". */
  assetBaseUrl: string;
  palette: VideoStylePalette;
  captionStyle: CaptionStyle;
  scenes: SpecScene[];
  captions: CaptionCue[];
  music: { src: string; volume: number } | null;
  /** Shown as a corner badge when any media came from a mock provider. */
  demoWatermark: string | null;
  /** Draws the TikTok/Reels safe-zone guides. Preview only. */
  showSafeZones: boolean;
}

export function msToFrames(ms: number, fps = FPS): number {
  return Math.max(1, Math.round((ms / 1000) * fps));
}

export function framesToMs(frames: number, fps = FPS): number {
  return Math.round((frames / fps) * 1000);
}

function backgroundFor(scene: Scene): SpecBackground {
  const source = scene.source;
  const motion: SpecBackground["motion"] =
    scene.effect === "ken_burns" ? "ken_burns" : scene.effect === "pulse" ? "pulse" : "none";

  if (source.kind === "color_gradient" || !source.url) {
    return {
      kind: "gradient",
      src: null,
      mediaType: "image",
      gradient: source.gradient.length > 0 ? source.gradient : ["#1E1B4B", "#7E22CE"],
      motion,
    };
  }

  const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(source.url);
  return {
    kind: "media",
    src: source.url,
    mediaType: isVideo ? "video" : "image",
    gradient: source.gradient,
    motion,
  };
}

export interface BuildSpecOptions {
  quality: "preview" | "final";
  assetBaseUrl: string;
  music?: { src: string; volume: number } | null;
  /** Word timings per scene id, when a voice provider returned real ones. */
  wordTimings?: Record<string, WordTiming[]>;
  showSafeZones?: boolean;
  /** Overrides demo detection, e.g. to drop the watermark on a paid plan. */
  demoWatermark?: string | null;
}

/** Assembles the render-ready spec from a concept and its project. */
export function buildVideoSpec(
  project: Project,
  concept: Concept,
  options: BuildSpecOptions,
): VideoSpec {
  const style = getVideoStyle(concept.styleId);
  const size = options.quality === "final" ? FINAL_SIZE : PREVIEW_SIZE;
  const scale = size.width / FINAL_SIZE.width;

  const scenes: SpecScene[] = [];
  const captions: CaptionCue[] = [];
  let cursorFrames = 0;
  let anyDemoMedia = false;

  for (const scene of [...concept.scenes].sort((a, b) => a.index - b.index)) {
    const durationInFrames = msToFrames(scene.durationMs);
    const background = backgroundFor(scene);
    if (scene.source.isDemo) anyDemoMedia = true;

    scenes.push({
      id: scene.id,
      title: scene.title,
      startFrame: cursorFrames,
      durationInFrames,
      background,
      effect: scene.effect,
      transition: scene.transition,
      text: {
        content: scene.text.content,
        subline: scene.text.subline,
        fontFamily: scene.text.fontFamily,
        fontSizePx: Math.round(scene.text.fontSize * scale),
        color: scene.text.color,
        position: scene.text.position,
        animation: scene.text.animation,
        uppercase: style.typography.uppercase,
        letterSpacingEm: style.typography.letterSpacingEm,
        weight: style.typography.headlineWeight,
      },
      voice: scene.voiceoverUrl
        ? { src: scene.voiceoverUrl, volume: scene.voiceVolume }
        : null,
      musicVolume: scene.musicVolume,
      showSubtitles: scene.showSubtitles,
    });

    if (scene.showSubtitles && scene.voiceoverText.trim()) {
      const supplied = options.wordTimings?.[scene.id] ?? scene.voiceoverWords;
      const localWords =
        supplied && supplied.length > 0
          ? supplied
          : deriveWordTimings(scene.voiceoverText, scene.durationMs);
      const offsetMs = framesToMs(cursorFrames);
      const cues = buildCaptionCues(
        localWords.map((word) => ({
          word: word.word,
          startMs: word.startMs + offsetMs,
          endMs: word.endMs + offsetMs,
        })),
        style.caption.maxWordsPerCue,
      );
      captions.push(...cues);
    }

    cursorFrames += durationInFrames;
  }

  return {
    version: 1,
    width: size.width,
    height: size.height,
    fps: FPS,
    durationInFrames: Math.max(1, cursorFrames),
    assetBaseUrl: options.assetBaseUrl,
    palette: style.palette,
    captionStyle: {
      ...style.caption,
      fontSizePx: Math.round(style.caption.fontSizePx * scale),
      bottomOffsetPx: Math.round(style.caption.bottomOffsetPx * scale),
      strokeWidth: Math.max(0, Math.round(style.caption.strokeWidth * scale)),
    },
    scenes,
    captions,
    music: options.music ?? null,
    demoWatermark:
      options.demoWatermark !== undefined
        ? options.demoWatermark
        : anyDemoMedia
          ? "DEMO"
          : null,
    showSafeZones: options.showSafeZones ?? false,
  };
}

/** Total runtime in ms - used for credit estimates and UI labels. */
export function specDurationMs(spec: VideoSpec): number {
  return framesToMs(spec.durationInFrames, spec.fps);
}
