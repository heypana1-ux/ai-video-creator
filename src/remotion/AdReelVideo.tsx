import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame } from "remotion";

import type { SpecScene, VideoSpec } from "@/lib/video/spec";
import type { Transition } from "@/lib/domain/enums";

import { Background } from "./components/Background";
import { Captions } from "./components/Captions";
import { DemoWatermark, SafeZones } from "./components/Overlays";
import { TextOverlay } from "./components/TextOverlay";
import { resolveAsset } from "./resolve";

const TRANSITION_FRAMES = 9;

/**
 * Transition into a scene, expressed as CSS on the scene's own container.
 * Doing it this way keeps every scene independently seekable, which is what
 * makes scrubbing in the editor's `<Player>` feel instant.
 */
function transitionStyle(transition: Transition, frame: number): React.CSSProperties {
  if (transition === "none" || transition === "cut") return {};
  const progress = interpolate(frame, [0, TRANSITION_FRAMES], [0, 1], {
    extrapolateRight: "clamp",
  });
  if (progress >= 1) return {};

  switch (transition) {
    case "fade":
      return { opacity: progress };
    case "slide_up":
      return { transform: `translateY(${(1 - progress) * 100}%)` };
    case "slide_left":
      return { transform: `translateX(${(1 - progress) * 100}%)` };
    case "zoom_in":
      return { transform: `scale(${0.7 + progress * 0.3})`, opacity: progress };
    case "zoom_out":
      return { transform: `scale(${1.35 - progress * 0.35})`, opacity: progress };
    case "whip_pan":
      return {
        transform: `translateX(${(1 - progress) * 60}%)`,
        filter: `blur(${(1 - progress) * 22}px)`,
      };
    case "glitch":
      return {
        transform: `translateX(${Math.sin(frame * 3) * (1 - progress) * 24}px)`,
        filter: `hue-rotate(${(1 - progress) * 90}deg) saturate(${1 + (1 - progress) * 2})`,
        opacity: 0.35 + progress * 0.65,
      };
    case "flash":
      return { opacity: 1, filter: `brightness(${1 + (1 - progress) * 2.4})` };
    default:
      return { opacity: progress };
  }
}

function SceneLayer({ scene, spec }: { scene: SpecScene; spec: VideoSpec }) {
  const frame = useCurrentFrame();
  const voiceSrc = resolveAsset(scene.voice?.src ?? null, spec.assetBaseUrl);

  return (
    <AbsoluteFill style={transitionStyle(scene.transition, frame)}>
      <Background
        background={scene.background}
        effect={scene.effect}
        durationInFrames={scene.durationInFrames}
        assetBaseUrl={spec.assetBaseUrl}
      />
      <TextOverlay text={scene.text} accentColor={spec.palette.accent} />
      {voiceSrc ? <Audio src={voiceSrc} volume={scene.voice?.volume ?? 1} /> : null}
    </AbsoluteFill>
  );
}

/**
 * The single composition used for both the editor preview and the MP4 export.
 * Preview and export therefore cannot drift apart.
 */
export function AdReelVideo({ spec }: { spec: VideoSpec }) {
  const musicSrc = resolveAsset(spec.music?.src ?? null, spec.assetBaseUrl);

  return (
    <AbsoluteFill style={{ backgroundColor: spec.palette.background }}>
      {spec.scenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.durationInFrames}
          name={scene.title || scene.id}
        >
          <SceneLayer scene={scene} spec={spec} />
        </Sequence>
      ))}

      {musicSrc ? <Audio src={musicSrc} volume={spec.music?.volume ?? 0.3} /> : null}

      <Captions cues={spec.captions} style={spec.captionStyle} />

      {spec.demoWatermark ? (
        <DemoWatermark label={spec.demoWatermark} width={spec.width} />
      ) : null}
      {spec.showSafeZones ? <SafeZones width={spec.width} /> : null}
    </AbsoluteFill>
  );
}
