import type { WordTiming } from "@/lib/ai/types";

/**
 * Subtitle timing.
 *
 * When a voice provider returns real word timings we use them verbatim. When it
 * does not (or when running in demo mode) timings are derived from the script,
 * weighted by word length with extra pauses after punctuation, so burned-in
 * subtitles still line up with the spoken pace.
 */

/** Average speaking rate in words per minute, per language. */
const WORDS_PER_MINUTE: Record<string, number> = {
  de: 135,
  en: 150,
  es: 155,
  fr: 145,
  it: 150,
  pt: 150,
  nl: 140,
  tr: 135,
};

export function splitWords(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length > 0);
}

export function estimateSpeechDurationMs(text: string, language = "de"): number {
  const words = splitWords(text);
  if (words.length === 0) return 0;
  const wpm = WORDS_PER_MINUTE[language] ?? 140;
  return Math.round((words.length / wpm) * 60_000);
}

/** Extra pause in ms contributed by the punctuation a word ends with. */
function pauseAfter(word: string): number {
  if (/[.!?…]["')\]]?$/.test(word)) return 260;
  if (/[,;:–-]["')\]]?$/.test(word)) return 130;
  return 0;
}

/**
 * Spreads `durationMs` across the words of `text`.
 * Weight = character count + punctuation pause, so long words get more time.
 */
export function deriveWordTimings(text: string, durationMs: number): WordTiming[] {
  const words = splitWords(text);
  if (words.length === 0 || durationMs <= 0) return [];

  const weights = words.map((word) => word.length + 2 + pauseAfter(word) / 40);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  const timings: WordTiming[] = [];
  let cursor = 0;
  words.forEach((word, index) => {
    const share = (weights[index] / totalWeight) * durationMs;
    const startMs = Math.round(cursor);
    cursor += share;
    timings.push({ word, startMs, endMs: Math.round(cursor) });
  });

  // Guard against rounding drift so the last word always ends exactly on time.
  if (timings.length > 0) timings[timings.length - 1].endMs = Math.round(durationMs);
  return timings;
}

export interface CaptionCue {
  startMs: number;
  endMs: number;
  words: WordTiming[];
  text: string;
}

/**
 * Groups word timings into short cues. Cues break on sentence punctuation and
 * never exceed `maxWords`, which keeps burned-in subtitles readable at 9:16.
 */
export function buildCaptionCues(words: WordTiming[], maxWords = 4): CaptionCue[] {
  const cues: CaptionCue[] = [];
  let current: WordTiming[] = [];

  const flush = () => {
    if (current.length === 0) return;
    cues.push({
      startMs: current[0].startMs,
      endMs: current[current.length - 1].endMs,
      words: current,
      text: current.map((word) => word.word).join(" "),
    });
    current = [];
  };

  for (const word of words) {
    current.push(word);
    const endsSentence = /[.!?…]["')\]]?$/.test(word.word);
    if (current.length >= maxWords || endsSentence) flush();
  }
  flush();

  return cues;
}

/** Shifts every timing by `offsetMs` - used to place scene-local cues globally. */
export function offsetWordTimings(words: WordTiming[], offsetMs: number): WordTiming[] {
  return words.map((word) => ({
    word: word.word,
    startMs: word.startMs + offsetMs,
    endMs: word.endMs + offsetMs,
  }));
}
