import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import type { CaptionCue } from "@/lib/video/captions";
import type { CaptionStyle } from "@/lib/video/styles";

interface Props {
  cues: CaptionCue[];
  style: CaptionStyle;
}

/**
 * Burned-in subtitles with the currently spoken word highlighted.
 * Cue times are absolute (video timeline), so this sits above all scenes.
 */
export function Captions({ cues, style }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;

  const cue = cues.find((candidate) => nowMs >= candidate.startMs && nowMs < candidate.endMs);
  if (!cue) return null;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: style.bottomOffsetPx,
        paddingLeft: "7%",
        paddingRight: "7%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.28em",
          justifyContent: "center",
          backgroundColor: style.backgroundColor,
          borderRadius: 18,
          padding: style.backgroundColor === "transparent" ? 0 : "0.28em 0.6em",
        }}
      >
        {cue.words.map((word, index) => {
          const active = nowMs >= word.startMs && nowMs < word.endMs;
          return (
            <span
              key={`${word.word}-${index}`}
              style={{
                fontFamily: style.fontFamily,
                fontSize: style.fontSizePx,
                fontWeight: 800,
                lineHeight: 1.15,
                color: active ? style.activeColor : style.color,
                textTransform: style.uppercase ? "uppercase" : "none",
                WebkitTextStroke:
                  style.strokeWidth > 0 ? `${style.strokeWidth}px rgba(0,0,0,0.85)` : undefined,
                paintOrder: "stroke fill",
                transform: active ? "translateY(-2px) scale(1.04)" : "none",
                transition: "none",
              }}
            >
              {word.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
