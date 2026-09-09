import { describe, expect, it } from "vitest";

import { composeConcepts, composeHooks, selectArchetypeIds } from "@/lib/concepts/composer";
import { conceptDraftResponseSchema } from "@/lib/concepts/draft-schema";
import {
  distributeDurations,
  layoutConcept,
  retimeConcept,
  selectBeats,
  targetSceneCount,
} from "@/lib/concepts/layout";
import { decodeBriefEnvelope, buildConceptPrompt, extractJsonObject } from "@/lib/concepts/prompt";
import { defaultBrief } from "@/lib/domain/defaults";
import type { ProjectBrief } from "@/lib/domain/schemas";
import { sequentialIdFactory } from "@/lib/util/id";

function musicBrief(overrides: Partial<ProjectBrief> = {}): ProjectBrief {
  const base = defaultBrief("music");
  return {
    ...base,
    name: "Midnight Drive Kampagne",
    description: "Neue Synthwave-Single über nächtliche Autofahrten.",
    audience: "Synthwave-Hörer",
    callToAction: "Jetzt streamen",
    durationSeconds: 15,
    details: {
      ...base.details,
      artistName: "NOVA",
      songTitle: "Midnight Drive",
      genre: "Synthwave",
      mood: "melancholisch",
      releaseDate: "14. März",
      lyricsExcerpt: "Ich fahr durch die Nacht",
      rightsConfirmed: true,
    },
    ...overrides,
  } as ProjectBrief;
}

describe("composeConcepts", () => {
  it("produces three distinct concepts", () => {
    const concepts = composeConcepts(musicBrief(), 3);
    expect(concepts).toHaveLength(3);
    expect(new Set(concepts.map((concept) => concept.title)).size).toBe(3);
  });

  it("satisfies the provider response contract", () => {
    const parsed = conceptDraftResponseSchema.safeParse({
      concepts: composeConcepts(musicBrief(), 3),
    });
    expect(parsed.success).toBe(true);
  });

  it("uses the user's own details instead of placeholders", () => {
    const [concept] = composeConcepts(musicBrief(), 1);
    const text = JSON.stringify(concept);
    expect(text).toContain("Midnight Drive");
    expect(text).toContain("NOVA");
    expect(text).not.toMatch(/\[Produkt\]|\{\{|lorem ipsum/i);
  });

  it("is deterministic for the same brief", () => {
    expect(composeConcepts(musicBrief(), 3)).toEqual(composeConcepts(musicBrief(), 3));
  });

  it("adapts the archetype mix to the tone", () => {
    const professional = selectArchetypeIds(musicBrief({ tone: "professional" }), 3);
    const ugc = selectArchetypeIds(musicBrief({ tone: "ugc" }), 3);
    expect(ugc[0]).toBe("ugc_promo");
    expect(professional).not.toEqual(ugc);
  });

  it("works for every category", () => {
    for (const category of [
      "music",
      "website",
      "app",
      "mixing_mastering",
      "product",
      "service",
      "event",
      "custom",
    ] as const) {
      const brief = defaultBrief(category);
      const concepts = composeConcepts(
        { ...brief, name: "Testprojekt", description: "Eine Beschreibung mit genug Text." } as ProjectBrief,
        3,
      );
      expect(concepts.length, category).toBe(3);
      expect(conceptDraftResponseSchema.safeParse({ concepts }).success, category).toBe(true);
    }
  });
});

describe("composeHooks", () => {
  it("returns the requested number of distinct hooks", () => {
    const hooks = composeHooks(musicBrief(), 5);
    expect(hooks).toHaveLength(5);
    expect(new Set(hooks).size).toBe(5);
  });
});

describe("distributeDurations", () => {
  it("hits the total exactly", () => {
    const durations = distributeDurations([1, 1.2, 0.8, 1], 15_000);
    expect(durations.reduce((sum, value) => sum + value, 0)).toBe(15_000);
  });

  it("snaps to 100 ms steps", () => {
    for (const value of distributeDurations([1, 2, 3], 30_000)) {
      expect(value % 100).toBe(0);
    }
  });

  it("gives heavier beats more time", () => {
    const [small, large] = distributeDurations([1, 3], 20_000);
    expect(large).toBeGreaterThan(small);
  });

  it("still works when many scenes share a short video", () => {
    const durations = distributeDurations([1, 1, 1, 1, 1, 1, 1, 1], 10_000);
    expect(durations.reduce((sum, value) => sum + value, 0)).toBe(10_000);
    expect(durations.every((value) => value > 0)).toBe(true);
  });
});

describe("selectBeats", () => {
  const beats = composeConcepts(musicBrief(), 1)[0].beats;

  it("keeps everything when it already fits", () => {
    expect(selectBeats(beats, beats.length + 2)).toHaveLength(beats.length);
  });

  it("always keeps the first and last beat", () => {
    const kept = selectBeats(beats, 3);
    expect(kept).toHaveLength(3);
    expect(kept[0]).toEqual(beats[0]);
    expect(kept[kept.length - 1]).toEqual(beats[beats.length - 1]);
  });

  it("preserves the original order", () => {
    const kept = selectBeats(beats, 4);
    const indices = kept.map((beat) => beats.indexOf(beat));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });
});

describe("targetSceneCount", () => {
  it("grows with the video length", () => {
    expect(targetSceneCount(10)).toBeLessThan(targetSceneCount(30));
    expect(targetSceneCount(30)).toBeLessThan(targetSceneCount(60));
  });
});

describe("layoutConcept", () => {
  it.each([10, 15, 30, 45, 60])("fills exactly %i seconds", (seconds) => {
    const brief = musicBrief({ durationSeconds: seconds as ProjectBrief["durationSeconds"] });
    const [draft] = composeConcepts(brief, 1);
    const concept = layoutConcept(draft, {
      brief,
      projectId: "prj_1",
      makeId: sequentialIdFactory("id"),
    });
    const total = concept.scenes.reduce((sum, scene) => sum + scene.durationMs, 0);
    expect(total).toBe(seconds * 1000);
  });

  it("numbers scenes from zero without gaps", () => {
    const brief = musicBrief();
    const [draft] = composeConcepts(brief, 1);
    const concept = layoutConcept(draft, { brief, projectId: "prj_1" });
    expect(concept.scenes.map((scene) => scene.index)).toEqual(
      concept.scenes.map((_scene, index) => index),
    );
  });

  it("joins the scene voice-overs into the script", () => {
    const brief = musicBrief();
    const [draft] = composeConcepts(brief, 1);
    const concept = layoutConcept(draft, { brief, projectId: "prj_1" });
    for (const scene of concept.scenes) {
      if (scene.voiceoverText.trim()) {
        expect(concept.voiceoverScript).toContain(scene.voiceoverText.trim());
      }
    }
  });

  it("starts without a transition on the first scene", () => {
    const brief = musicBrief();
    const [draft] = composeConcepts(brief, 1);
    const concept = layoutConcept(draft, { brief, projectId: "prj_1" });
    expect(concept.scenes[0].transition).toBe("none");
  });
});

describe("retimeConcept", () => {
  it("rescales edited scenes back to the project length", () => {
    const brief = musicBrief();
    const [draft] = composeConcepts(brief, 1);
    const concept = layoutConcept(draft, { brief, projectId: "prj_1" });
    const stretched = {
      ...concept,
      scenes: concept.scenes.map((scene) => ({ ...scene, durationMs: scene.durationMs * 3 })),
    };
    const retimed = retimeConcept(stretched, 30);
    expect(retimed.scenes.reduce((sum, scene) => sum + scene.durationMs, 0)).toBe(30_000);
  });
});

describe("prompt envelope", () => {
  it("round-trips the brief", () => {
    const brief = musicBrief();
    const prompt = buildConceptPrompt(brief, { kind: "concepts", count: 3 });
    const decoded = decodeBriefEnvelope(prompt);
    expect(decoded?.brief).toEqual(brief);
    expect(decoded?.task.count).toBe(3);
  });

  it("returns null when there is no envelope", () => {
    expect(decodeBriefEnvelope("nur Text")).toBeNull();
  });

  it("forbids invented testimonials in the instructions", () => {
    const prompt = buildConceptPrompt(musicBrief(), { kind: "concepts" });
    expect(prompt).toMatch(/Erfinde niemals Kundenstimmen/);
  });
});

describe("extractJsonObject", () => {
  it("unwraps fenced JSON", () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("strips prose around the object", () => {
    expect(extractJsonObject('Hier ist das Ergebnis: {"a":1} - viel Erfolg!')).toBe('{"a":1}');
  });

  it("leaves plain JSON untouched", () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });
});
