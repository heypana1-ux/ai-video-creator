import { describe, expect, it } from "vitest";

import {
  buildCaptionCues,
  deriveWordTimings,
  estimateSpeechDurationMs,
  offsetWordTimings,
  splitWords,
} from "@/lib/video/captions";
import { wordsFromCharacterAlignment } from "@/lib/ai/providers/elevenlabs-voice";

describe("deriveWordTimings", () => {
  it("returns nothing for empty text", () => {
    expect(deriveWordTimings("", 5000)).toEqual([]);
    expect(deriveWordTimings("Hallo", 0)).toEqual([]);
  });

  it("covers the full duration without gaps", () => {
    const words = deriveWordTimings("Dieser Song geht nicht mehr aus dem Kopf.", 4000);
    expect(words).toHaveLength(8);
    expect(words[0].startMs).toBe(0);
    expect(words[words.length - 1].endMs).toBe(4000);
    for (let i = 1; i < words.length; i += 1) {
      expect(words[i].startMs).toBe(words[i - 1].endMs);
    }
  });

  it("gives longer words more time than short ones", () => {
    const [short, long] = deriveWordTimings("ab abcdefghijklmno", 2000);
    expect(long.endMs - long.startMs).toBeGreaterThan(short.endMs - short.startMs);
  });
});

describe("buildCaptionCues", () => {
  it("breaks on sentence end and on the word limit", () => {
    const words = deriveWordTimings("Eins zwei drei. Vier fünf sechs sieben acht", 8000);
    const cues = buildCaptionCues(words, 4);
    expect(cues[0].text).toBe("Eins zwei drei.");
    expect(cues.every((cue) => cue.words.length <= 4)).toBe(true);
    expect(cues.at(-1)?.endMs).toBe(8000);
  });

  it("returns no cues for no words", () => {
    expect(buildCaptionCues([], 4)).toEqual([]);
  });
});

describe("offsetWordTimings", () => {
  it("shifts every timing", () => {
    const shifted = offsetWordTimings([{ word: "a", startMs: 0, endMs: 100 }], 500);
    expect(shifted[0]).toEqual({ word: "a", startMs: 500, endMs: 600 });
  });
});

describe("estimateSpeechDurationMs", () => {
  it("scales with word count and is language aware", () => {
    const short = estimateSpeechDurationMs("Ein Satz mit vier Wörtern", "de");
    const long = estimateSpeechDurationMs(
      "Ein deutlich längerer Satz mit vielen weiteren Wörtern darin",
      "de",
    );
    expect(long).toBeGreaterThan(short);
    // English is spoken faster in the table, so the same word count is shorter.
    expect(estimateSpeechDurationMs("one two three four", "en")).toBeLessThan(
      estimateSpeechDurationMs("eins zwei drei vier", "de"),
    );
  });
});

describe("splitWords", () => {
  it("collapses whitespace", () => {
    expect(splitWords("  a   b \n c ")).toEqual(["a", "b", "c"]);
  });
});

describe("wordsFromCharacterAlignment", () => {
  it("groups characters into words on whitespace", () => {
    const words = wordsFromCharacterAlignment(
      ["H", "i", " ", "d", "u"],
      [0, 0.1, 0.2, 0.3, 0.4],
      [0.1, 0.2, 0.3, 0.4, 0.5],
    );
    expect(words).toEqual([
      { word: "Hi", startMs: 0, endMs: 200 },
      { word: "du", startMs: 300, endMs: 500 },
    ]);
  });
});
