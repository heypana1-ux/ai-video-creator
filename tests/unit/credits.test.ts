import { describe, expect, it } from "vitest";

import { CREDIT_COSTS, estimateCredits, estimateRenderCredits } from "@/lib/credits/pricing";

describe("estimateCredits", () => {
  it("returns zero for an empty plan", () => {
    const estimate = estimateCredits({});
    expect(estimate.total).toBe(0);
    expect(estimate.lines).toHaveLength(0);
  });

  it("prices images above text and video above images", () => {
    expect(CREDIT_COSTS.image).toBeGreaterThan(CREDIT_COSTS.concepts);
    expect(CREDIT_COSTS.videoClipPer5s).toBeGreaterThan(CREDIT_COSTS.image);
  });

  it("bills video clips per started 5 seconds", () => {
    expect(estimateCredits({ videoClipSeconds: 1 }).total).toBe(CREDIT_COSTS.videoClipPer5s);
    expect(estimateCredits({ videoClipSeconds: 5 }).total).toBe(CREDIT_COSTS.videoClipPer5s);
    expect(estimateCredits({ videoClipSeconds: 6 }).total).toBe(
      CREDIT_COSTS.videoClipPer5s * 2,
    );
  });

  it("bills voice-over per started 15 seconds", () => {
    expect(estimateCredits({ voiceoverSeconds: 16 }).total).toBe(CREDIT_COSTS.voicePer15s * 2);
  });

  it("sums an itemised plan", () => {
    const estimate = estimateCredits({ images: 3, musicTracks: 1, renderFinals: 1 });
    expect(estimate.total).toBe(
      CREDIT_COSTS.image * 3 + CREDIT_COSTS.music + CREDIT_COSTS.renderFinal,
    );
    expect(estimate.lines.map((line) => line.operation)).toEqual([
      "image",
      "music",
      "renderFinal",
    ]);
  });

  it("charges more for a final export than for a preview", () => {
    expect(estimateRenderCredits("final").total).toBeGreaterThan(
      estimateRenderCredits("preview").total,
    );
  });
});
