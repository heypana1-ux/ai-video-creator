import { AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame } from "remotion";

import type { SpecBackground } from "@/lib/video/spec";
import type { SceneEffect } from "@/lib/domain/enums";

import { resolveAsset } from "../resolve";

interface Props {
  background: SpecBackground;
  effect: SceneEffect;
  durationInFrames: number;
  assetBaseUrl: string;
}

/** Slow zoom/pan so still images never look like static slides. */
function motionTransform(
  motion: SpecBackground["motion"],
  frame: number,
  durationInFrames: number,
): string {
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], {
    extrapolateRight: "clamp",
  });
  switch (motion) {
    case "ken_burns":
      return `scale(${1.08 + progress * 0.12}) translate(${progress * -1.2}%, ${progress * -1.6}%)`;
    case "parallax":
      return `scale(1.16) translate(${interpolate(progress, [0, 1], [3, -3])}%, 0%)`;
    case "pulse":
      return `scale(${1.05 + Math.sin(progress * Math.PI * 4) * 0.02})`;
    default:
      return "scale(1.02)";
  }
}

export function Background({ background, effect, durationInFrames, assetBaseUrl }: Props) {
  const frame = useCurrentFrame();
  const transform = motionTransform(background.motion, frame, durationInFrames);
  const src = resolveAsset(background.src, assetBaseUrl);

  const shakeX = effect === "shake" ? Math.sin(frame * 1.1) * 6 : 0;
  const shakeY = effect === "shake" ? Math.cos(frame * 0.9) * 5 : 0;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#05050A" }}>
      <AbsoluteFill
        style={{
          transform: `${transform} translate(${shakeX}px, ${shakeY}px)`,
          willChange: "transform",
        }}
      >
        {background.kind === "gradient" || !src ? (
          <AbsoluteFill
            style={{
              background: `linear-gradient(155deg, ${
                background.gradient.length > 0
                  ? background.gradient.join(", ")
                  : "#1E1B4B, #7E22CE"
              })`,
            }}
          />
        ) : background.mediaType === "video" ? (
          <OffthreadVideo src={src} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </AbsoluteFill>

      {effect === "vignette" ? (
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.75) 100%)",
          }}
        />
      ) : null}

      {effect === "film_grain" ? (
        <AbsoluteFill
          style={{
            opacity: 0.16,
            mixBlendMode: "overlay",
            backgroundImage:
              "repeating-conic-gradient(#fff 0% 25%, #000 0% 50%)",
            backgroundSize: `${3 + (frame % 3)}px ${3 + (frame % 3)}px`,
          }}
        />
      ) : null}

      {effect === "scanlines" ? (
        <AbsoluteFill
          style={{
            opacity: 0.28,
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.14) 0px, rgba(255,255,255,0.14) 1px, transparent 1px, transparent 4px)",
            transform: `translateY(${(frame * 2) % 4}px)`,
          }}
        />
      ) : null}

      {/* Readability scrim so white type always holds up over busy visuals. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.65) 100%)",
        }}
      />
    </AbsoluteFill>
  );
}
