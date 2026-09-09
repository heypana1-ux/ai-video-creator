import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import type { SpecText } from "@/lib/video/spec";
import type { TextPosition } from "@/lib/domain/enums";

interface Props {
  text: SpecText;
  accentColor: string;
}

function justifyFor(position: TextPosition): React.CSSProperties["justifyContent"] {
  switch (position) {
    case "top":
      return "flex-start";
    case "upper_third":
      return "flex-start";
    case "center":
      return "center";
    case "lower_third":
      return "flex-end";
    case "bottom":
      return "flex-end";
  }
}

function paddingFor(position: TextPosition): React.CSSProperties {
  switch (position) {
    case "top":
      return { paddingTop: "9%" };
    case "upper_third":
      return { paddingTop: "22%" };
    case "lower_third":
      return { paddingBottom: "34%" };
    case "bottom":
      return { paddingBottom: "16%" };
    default:
      return {};
  }
}

/** Animated headline + subline. All animations are frame-derived, never timers. */
export function TextOverlay({ text, accentColor }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!text.content.trim() && !text.subline.trim()) return null;

  // A hook has about two seconds to work, so entrances are deliberately quick:
  // roughly a third of a second rather than the spring's default settle time.
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 10 });
  const words = text.content.split(/\s+/).filter(Boolean);

  const baseStyle: React.CSSProperties = {
    fontFamily: text.fontFamily,
    fontWeight: text.weight,
    fontSize: text.fontSizePx,
    lineHeight: 1.05,
    color: text.color,
    letterSpacing: `${text.letterSpacingEm}em`,
    textTransform: text.uppercase ? "uppercase" : "none",
    textAlign: "center",
    textWrap: "balance",
    textShadow: "0 6px 34px rgba(0,0,0,0.55)",
    margin: 0,
  };

  const renderHeadline = () => {
    switch (text.animation) {
      case "word_by_word":
        return (
          <h1 style={baseStyle}>
            {words.map((word, index) => {
              const appear = spring({
                frame: frame - index * 3,
                fps,
                config: { damping: 200 },
                durationInFrames: 8,
              });
              return (
                <span
                  key={`${word}-${index}`}
                  style={{
                    display: "inline-block",
                    opacity: appear,
                    transform: `translateY(${(1 - appear) * 26}px)`,
                    marginRight: "0.28em",
                  }}
                >
                  {word}
                </span>
              );
            })}
          </h1>
        );
      case "typewriter": {
        const visible = Math.min(
          text.content.length,
          Math.floor(interpolate(frame, [0, 16], [0, text.content.length], {
            extrapolateRight: "clamp",
          })),
        );
        return (
          <h1 style={baseStyle}>
            {text.content.slice(0, visible)}
            <span style={{ opacity: frame % 16 < 8 ? 1 : 0, color: accentColor }}>|</span>
          </h1>
        );
      }
      case "pop":
        return (
          <h1
            style={{
              ...baseStyle,
              transform: `scale(${interpolate(enter, [0, 1], [0.72, 1])})`,
              opacity: enter,
            }}
          >
            {text.content}
          </h1>
        );
      case "slide_up":
        return (
          <h1
            style={{
              ...baseStyle,
              transform: `translateY(${(1 - enter) * 60}px)`,
              opacity: enter,
            }}
          >
            {text.content}
          </h1>
        );
      case "blur_in":
        return (
          <h1
            style={{
              ...baseStyle,
              filter: `blur(${(1 - enter) * 18}px)`,
              opacity: enter,
            }}
          >
            {text.content}
          </h1>
        );
      case "none":
        return <h1 style={baseStyle}>{text.content}</h1>;
      default:
        return <h1 style={{ ...baseStyle, opacity: enter }}>{text.content}</h1>;
    }
  };

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: justifyFor(text.position),
        padding: "0 8%",
        ...paddingFor(text.position),
      }}
    >
      {text.content.trim() ? renderHeadline() : null}
      {text.subline.trim() ? (
        <p
          style={{
            marginTop: text.content.trim() ? "0.5em" : 0,
            fontFamily: text.fontFamily,
            fontSize: Math.round(text.fontSizePx * 0.44),
            fontWeight: 500,
            color: accentColor,
            letterSpacing: "0.02em",
            textAlign: "center",
            opacity: interpolate(frame, [3, 11], [0, 1], { extrapolateRight: "clamp" }),
            textShadow: "0 4px 20px rgba(0,0,0,0.6)",
            margin: 0,
          }}
        >
          {text.subline}
        </p>
      ) : null}
    </AbsoluteFill>
  );
}
