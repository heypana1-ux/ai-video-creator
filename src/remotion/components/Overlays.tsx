import { AbsoluteFill } from "remotion";

import { SAFE_ZONES } from "@/lib/video/spec";

/** Guides showing where the TikTok / Reels UI covers the frame. Preview only. */
export function SafeZones({ width }: { width: number }) {
  const scale = width / 1080;
  const top = SAFE_ZONES.topPx * scale;
  const bottom = SAFE_ZONES.bottomPx * scale;
  const side = SAFE_ZONES.sidePx * scale;

  const label: React.CSSProperties = {
    position: "absolute",
    fontFamily: "Inter, sans-serif",
    fontSize: Math.max(10, 22 * scale),
    letterSpacing: "0.14em",
    color: "rgba(255,255,255,0.75)",
    textTransform: "uppercase",
  };

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: `${top}px ${side}px ${bottom}px ${side}px`,
          border: "2px dashed rgba(56,189,248,0.65)",
          borderRadius: 12,
        }}
      />
      <div style={{ ...label, top: top + 8, left: side + 10 }}>Safe Zone</div>
      <div
        style={{
          position: "absolute",
          insetInline: 0,
          top: 0,
          height: top,
          background: "rgba(236,72,153,0.14)",
        }}
      />
      <div
        style={{
          position: "absolute",
          insetInline: 0,
          bottom: 0,
          height: bottom,
          background: "rgba(236,72,153,0.14)",
        }}
      />
      <div style={{ ...label, bottom: bottom - 30 * scale, left: side + 10 }}>
        UI-Bereich TikTok / Reels
      </div>
    </AbsoluteFill>
  );
}

/** Corner badge marking AI/demo generated output. */
export function DemoWatermark({ label, width }: { label: string; width: number }) {
  const scale = width / 1080;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 28 * scale,
          right: 28 * scale,
          padding: `${8 * scale}px ${16 * scale}px`,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.35)",
          background: "rgba(0,0,0,0.45)",
          color: "rgba(255,255,255,0.92)",
          fontFamily: "Inter, sans-serif",
          fontSize: Math.max(11, 26 * scale),
          fontWeight: 700,
          letterSpacing: "0.16em",
        }}
      >
        {label}
      </div>
    </AbsoluteFill>
  );
}
