import { Composition } from "remotion";

import { FPS, PREVIEW_SIZE, type VideoSpec } from "@/lib/video/spec";

import { AdReelVideo } from "./AdReelVideo";

/** Minimal spec so the Remotion Studio can open without a project loaded. */
export const EMPTY_SPEC: VideoSpec = {
  version: 1,
  width: PREVIEW_SIZE.width,
  height: PREVIEW_SIZE.height,
  fps: FPS,
  durationInFrames: FPS * 5,
  assetBaseUrl: "",
  palette: {
    background: "#08070C",
    surface: "#16121F",
    primary: "#A855F7",
    secondary: "#EC4899",
    accent: "#38BDF8",
    text: "#FFFFFF",
    textMuted: "#C4B5FD",
  },
  captionStyle: {
    fontFamily: "Inter, sans-serif",
    fontSizePx: 40,
    color: "#FFFFFF",
    activeColor: "#FACC15",
    backgroundColor: "rgba(0,0,0,0.5)",
    strokeWidth: 4,
    uppercase: true,
    maxWordsPerCue: 4,
    bottomOffsetPx: 280,
  },
  scenes: [
    {
      id: "placeholder",
      title: "AdReel AI",
      startFrame: 0,
      durationInFrames: FPS * 5,
      background: {
        kind: "gradient",
        src: null,
        mediaType: "image",
        gradient: ["#2E1065", "#7E22CE", "#DB2777"],
        motion: "ken_burns",
      },
      effect: "ken_burns",
      transition: "fade",
      text: {
        content: "AdReel AI",
        subline: "Öffne ein Projekt, um eine Vorschau zu sehen",
        fontFamily: "Inter, sans-serif",
        fontSizePx: 64,
        color: "#FFFFFF",
        position: "center",
        animation: "pop",
        uppercase: false,
        letterSpacingEm: -0.02,
        weight: 800,
      },
      voice: null,
      musicVolume: 0.3,
      showSubtitles: false,
    },
  ],
  captions: [],
  music: null,
  demoWatermark: null,
  showSafeZones: false,
};

export function RemotionRoot() {
  return (
    <Composition
      id="AdReel"
      component={AdReelVideo}
      defaultProps={{ spec: EMPTY_SPEC }}
      width={EMPTY_SPEC.width}
      height={EMPTY_SPEC.height}
      fps={EMPTY_SPEC.fps}
      durationInFrames={EMPTY_SPEC.durationInFrames}
      // Dimensions and length come from the spec that is being rendered.
      calculateMetadata={({ props }) => ({
        width: props.spec.width,
        height: props.spec.height,
        fps: props.spec.fps,
        durationInFrames: props.spec.durationInFrames,
      })}
    />
  );
}
