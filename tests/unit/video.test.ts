import { describe, expect, it } from "vitest";

import { composeConcepts } from "@/lib/concepts/composer";
import { layoutConcept } from "@/lib/concepts/layout";
import { defaultBrief } from "@/lib/domain/defaults";
import type { Concept, Project, ProjectBrief } from "@/lib/domain/schemas";
import { checkConcept, checkScene } from "@/lib/video/quality";
import {
  FINAL_SIZE,
  PREVIEW_SIZE,
  buildVideoSpec,
  framesToMs,
  msToFrames,
  specDurationMs,
} from "@/lib/video/spec";
import {
  DEFAULT_STYLE_ID,
  VIDEO_STYLES,
  getVideoStyle,
  listStylesForCategory,
} from "@/lib/video/styles";
import { resolveAsset } from "@/remotion/resolve";

function brief(overrides: Partial<ProjectBrief> = {}): ProjectBrief {
  const base = defaultBrief("product");
  return {
    ...base,
    name: "Testprodukt",
    description: "Ein Produkt mit einer ausreichend langen Beschreibung für den Composer.",
    callToAction: "Jetzt sichern",
    durationSeconds: 30,
    details: {
      productName: "Testprodukt",
      keyBenefits: ["Spart Zeit", "Klarer Preis"],
      price: "79 €",
      shopUrl: "",
      usp: "Nur hier erhältlich",
    },
    ...overrides,
  } as ProjectBrief;
}

function makeConcept(overrides: Partial<ProjectBrief> = {}): { concept: Concept; project: Project } {
  const projectBrief = brief(overrides);
  const [draft] = composeConcepts(projectBrief, 1);
  const concept = layoutConcept(draft, { brief: projectBrief, projectId: "prj_1" });
  const project: Project = {
    id: "prj_1",
    workspaceId: "ws_1",
    ownerId: "usr_1",
    name: projectBrief.name,
    category: projectBrief.category,
    status: "draft",
    brief: projectBrief,
    selectedConceptId: concept.id,
    thumbnailUrl: null,
    durationSeconds: projectBrief.durationSeconds,
    brandKitId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { concept, project };
}

describe("video styles", () => {
  it("ships ten templates with unique ids", () => {
    expect(VIDEO_STYLES).toHaveLength(10);
    expect(new Set(VIDEO_STYLES.map((style) => style.id)).size).toBe(10);
  });

  it("gives every template a full definition", () => {
    for (const style of VIDEO_STYLES) {
      expect(style.sceneStructure.length, style.id).toBeGreaterThanOrEqual(4);
      expect(style.transitions.length, style.id).toBeGreaterThan(0);
      expect(style.textAnimations.length, style.id).toBeGreaterThan(0);
      expect(style.gradient.length, style.id).toBeGreaterThanOrEqual(2);
      expect(style.caption.fontSizePx, style.id).toBeGreaterThan(20);
      expect(style.audioMix.musicVolume, style.id).toBeGreaterThan(0);
      expect(style.audioMix.voiceVolume, style.id).toBeGreaterThan(0);
    }
  });

  it("falls back to the default for an unknown id", () => {
    expect(getVideoStyle("does-not-exist").id).toBe(DEFAULT_STYLE_ID);
    expect(getVideoStyle(null).id).toBe(DEFAULT_STYLE_ID);
  });

  it("ranks matching templates first but keeps all of them", () => {
    const ranked = listStylesForCategory("music");
    expect(ranked).toHaveLength(VIDEO_STYLES.length);
    expect(ranked[0].bestFor).toContain("music");
  });
});

describe("frame maths", () => {
  it("round-trips milliseconds and frames", () => {
    expect(msToFrames(1000)).toBe(30);
    expect(framesToMs(30)).toBe(1000);
    expect(msToFrames(0)).toBe(1); // a scene is never zero frames long
  });
});

describe("buildVideoSpec", () => {
  it("uses full resolution for a final export and half for a preview", () => {
    const { concept, project } = makeConcept();
    const final = buildVideoSpec(project, concept, { quality: "final", assetBaseUrl: "" });
    const preview = buildVideoSpec(project, concept, { quality: "preview", assetBaseUrl: "" });

    expect(final.width).toBe(FINAL_SIZE.width);
    expect(final.height).toBe(FINAL_SIZE.height);
    expect(preview.width).toBe(PREVIEW_SIZE.width);
    expect(preview.height).toBe(PREVIEW_SIZE.height);
    expect(preview.captionStyle.fontSizePx).toBeLessThan(final.captionStyle.fontSizePx);
  });

  it("keeps the total runtime and lays scenes out back to back", () => {
    const { concept, project } = makeConcept();
    const spec = buildVideoSpec(project, concept, { quality: "final", assetBaseUrl: "" });

    expect(specDurationMs(spec)).toBeCloseTo(30_000, -2);
    let cursor = 0;
    for (const scene of spec.scenes) {
      expect(scene.startFrame).toBe(cursor);
      cursor += scene.durationInFrames;
    }
    expect(spec.durationInFrames).toBe(cursor);
  });

  it("derives caption cues on the global timeline", () => {
    const { concept, project } = makeConcept();
    const spec = buildVideoSpec(project, concept, { quality: "final", assetBaseUrl: "" });

    expect(spec.captions.length).toBeGreaterThan(0);
    for (const cue of spec.captions) {
      expect(cue.endMs).toBeGreaterThan(cue.startMs);
      expect(cue.endMs).toBeLessThanOrEqual(specDurationMs(spec) + 50);
    }
    // Cues must not overlap - only one line is on screen at a time.
    for (let i = 1; i < spec.captions.length; i += 1) {
      expect(spec.captions[i].startMs).toBeGreaterThanOrEqual(spec.captions[i - 1].endMs - 1);
    }
  });

  it("marks the export as demo when any scene uses mock media", () => {
    const { concept, project } = makeConcept();
    const demo = {
      ...concept,
      scenes: concept.scenes.map((scene, index) => ({
        ...scene,
        source: {
          ...scene.source,
          url: index === 0 ? "/api/media/demo/x.svg" : scene.source.url,
          isDemo: index === 0,
        },
      })),
    };
    expect(buildVideoSpec(project, demo, { quality: "final", assetBaseUrl: "" }).demoWatermark).toBe(
      "DEMO",
    );
    expect(
      buildVideoSpec(project, concept, { quality: "final", assetBaseUrl: "" }).demoWatermark,
    ).toBeNull();
  });

  it("falls back to a gradient background when a scene has no media", () => {
    const { concept, project } = makeConcept();
    const spec = buildVideoSpec(project, concept, { quality: "final", assetBaseUrl: "" });
    expect(spec.scenes.every((scene) => scene.background.kind === "gradient")).toBe(true);
    expect(spec.scenes[0].background.gradient.length).toBeGreaterThan(0);
  });

  it("detects video media by extension", () => {
    const { concept, project } = makeConcept();
    const withVideo = {
      ...concept,
      scenes: concept.scenes.map((scene, index) => ({
        ...scene,
        source: { ...scene.source, url: index === 0 ? "https://cdn.test/clip.mp4" : "https://cdn.test/x.png" },
      })),
    };
    const spec = buildVideoSpec(project, withVideo, { quality: "final", assetBaseUrl: "" });
    expect(spec.scenes[0].background.mediaType).toBe("video");
    expect(spec.scenes[1].background.mediaType).toBe("image");
  });
});

describe("resolveAsset", () => {
  it("passes absolute URLs through untouched", () => {
    expect(resolveAsset("https://cdn.test/a.png", "")).toBe("https://cdn.test/a.png");
    expect(resolveAsset("data:image/png;base64,AAA", "/api/media")).toBe(
      "data:image/png;base64,AAA",
    );
  });

  it("keeps media route URLs as-is in the browser", () => {
    expect(resolveAsset("/api/media/demo/x.svg", "/api/media")).toBe("/api/media/demo/x.svg");
  });

  it("returns null for a missing reference", () => {
    expect(resolveAsset(null, "")).toBeNull();
  });

  it("joins a bare key onto the base URL", () => {
    expect(resolveAsset("demo/x.svg", "/api/media")).toBe("/api/media/demo/x.svg");
  });
});

describe("quality checks", () => {
  const { concept, project } = makeConcept();
  const base = concept.scenes[0];

  it("flags an over-long headline", () => {
    const warnings = checkScene(
      { ...base, text: { ...base.text, content: "eins zwei drei vier fünf sechs sieben acht neun" } },
      0,
    );
    expect(warnings.some((warning) => warning.id.endsWith("text-length"))).toBe(true);
  });

  it("flags a scene that is too short to read", () => {
    const warnings = checkScene({ ...base, durationMs: 700, text: { ...base.text, content: "Hallo" } }, 0);
    expect(warnings.some((warning) => warning.id.endsWith("too-short"))).toBe(true);
  });

  it("flags a voice-over that cannot fit", () => {
    const warnings = checkScene(
      {
        ...base,
        durationMs: 1500,
        voiceoverText:
          "Ein sehr langer gesprochener Satz der in anderthalb Sekunden unmöglich vorgelesen werden kann ohne zu hetzen",
      },
      0,
    );
    expect(warnings.some((warning) => warning.id.endsWith("voice-overflow"))).toBe(true);
  });

  it("notes a scene without media", () => {
    const warnings = checkScene({ ...base, source: { ...base.source, url: null } }, 0);
    expect(warnings.some((warning) => warning.id.endsWith("no-media"))).toBe(true);
  });

  it("flags an empty opening scene", () => {
    const weak = {
      ...concept,
      scenes: concept.scenes.map((scene) =>
        scene.index === 0 ? { ...scene, text: { ...scene.text, content: "" }, voiceoverText: "" } : scene,
      ),
    };
    expect(checkConcept(weak, project.durationSeconds).some((warning) => warning.id === "weak-hook")).toBe(
      true,
    );
  });

  it("flags a duration that drifted away from the target", () => {
    const drifted = {
      ...concept,
      scenes: concept.scenes.map((scene) => ({ ...scene, durationMs: scene.durationMs + 500 })),
    };
    expect(
      checkConcept(drifted, project.durationSeconds).some((warning) => warning.id === "duration-mismatch"),
    ).toBe(true);
  });

  it("does not flag a healthy concept's duration", () => {
    const warnings = checkConcept(concept, project.durationSeconds);
    expect(warnings.some((warning) => warning.id === "duration-mismatch")).toBe(false);
  });
});
