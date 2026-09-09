import type {
  SceneEffect,
  TextAnimation,
  TextPosition,
  Transition,
} from "@/lib/domain/enums";

/** Narrative role a scene plays inside the ad. Drives copy generation. */
export const SCENE_ROLES = [
  "hook",
  "problem",
  "context",
  "proof",
  "feature",
  "showcase",
  "transformation",
  "offer",
  "cta",
] as const;
export type SceneRole = (typeof SCENE_ROLES)[number];

export interface SceneBlueprint {
  role: SceneRole;
  /** Relative share of the total video duration. */
  weight: number;
  transition: Transition;
  effect: SceneEffect;
  textAnimation: TextAnimation;
  textPosition: TextPosition;
}

export interface CaptionStyle {
  fontFamily: string;
  fontSizePx: number;
  color: string;
  /** Colour of the word currently being spoken. */
  activeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  uppercase: boolean;
  maxWordsPerCue: number;
  /** Distance from the bottom of the 1920px canvas, in px. */
  bottomOffsetPx: number;
}

export interface VideoStylePalette {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textMuted: string;
}

export interface VideoStyle {
  id: string;
  name: string;
  description: string;
  /** Categories this template was designed for; used for ranking suggestions. */
  bestFor: string[];
  palette: VideoStylePalette;
  gradient: string[];
  typography: {
    headline: string;
    body: string;
    headlineWeight: number;
    headlineSizePx: number;
    sublineSizePx: number;
    uppercase: boolean;
    letterSpacingEm: number;
  };
  transitions: Transition[];
  textAnimations: TextAnimation[];
  defaultEffect: SceneEffect;
  sceneStructure: SceneBlueprint[];
  caption: CaptionStyle;
  audioMix: {
    musicVolume: number;
    voiceVolume: number;
    /** How much the music dips while the voice-over speaks, 0..1. */
    duckingAmount: number;
  };
}

const SANS = "Inter, 'Helvetica Neue', Arial, sans-serif";
const DISPLAY = "'Archivo Black', Inter, Impact, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const SERIF = "'Playfair Display', Georgia, serif";

function blueprint(
  role: SceneRole,
  weight: number,
  transition: Transition,
  effect: SceneEffect,
  textAnimation: TextAnimation,
  textPosition: TextPosition,
): SceneBlueprint {
  return { role, weight, transition, effect, textAnimation, textPosition };
}

export const VIDEO_STYLES: VideoStyle[] = [
  {
    id: "viral_ugc",
    name: "Viral UGC",
    description:
      "Handgemachter Creator-Look mit harten Schnitten, großen Untertiteln und direkter Ansprache.",
    bestFor: ["music", "app", "product", "service", "custom"],
    palette: {
      background: "#08070C",
      surface: "#16121F",
      primary: "#A855F7",
      secondary: "#EC4899",
      accent: "#38BDF8",
      text: "#FFFFFF",
      textMuted: "#C4B5FD",
    },
    gradient: ["#2E1065", "#7E22CE", "#DB2777"],
    typography: {
      headline: DISPLAY,
      body: SANS,
      headlineWeight: 900,
      headlineSizePx: 86,
      sublineSizePx: 40,
      uppercase: true,
      letterSpacingEm: -0.02,
    },
    transitions: ["cut", "whip_pan", "flash", "zoom_in"],
    textAnimations: ["pop", "word_by_word", "slide_up"],
    defaultEffect: "shake",
    sceneStructure: [
      blueprint("hook", 1.1, "cut", "shake", "pop", "center"),
      blueprint("problem", 1, "whip_pan", "ken_burns", "slide_up", "upper_third"),
      blueprint("proof", 1, "flash", "pulse", "word_by_word", "center"),
      blueprint("offer", 1, "cut", "ken_burns", "pop", "center"),
      blueprint("cta", 0.9, "zoom_in", "pulse", "pop", "center"),
    ],
    caption: {
      fontFamily: DISPLAY,
      fontSizePx: 60,
      color: "#FFFFFF",
      activeColor: "#FACC15",
      backgroundColor: "rgba(0,0,0,0.55)",
      strokeWidth: 8,
      uppercase: true,
      maxWordsPerCue: 4,
      bottomOffsetPx: 430,
    },
    audioMix: { musicVolume: 0.32, voiceVolume: 1, duckingAmount: 0.6 },
  },
  {
    id: "cinematic",
    name: "Cinematic",
    description:
      "Weiche Kamerafahrten, filmische Farbgebung und ruhige Typografie für emotionale Geschichten.",
    bestFor: ["music", "event", "service", "custom"],
    palette: {
      background: "#05060A",
      surface: "#101725",
      primary: "#60A5FA",
      secondary: "#F472B6",
      accent: "#FBBF24",
      text: "#F8FAFC",
      textMuted: "#94A3B8",
    },
    gradient: ["#020617", "#1E293B", "#0F172A"],
    typography: {
      headline: SERIF,
      body: SANS,
      headlineWeight: 700,
      headlineSizePx: 72,
      sublineSizePx: 36,
      uppercase: false,
      letterSpacingEm: 0.01,
    },
    transitions: ["fade", "zoom_in", "slide_left"],
    textAnimations: ["fade_in", "blur_in", "slide_up"],
    defaultEffect: "ken_burns",
    sceneStructure: [
      blueprint("hook", 1.2, "fade", "ken_burns", "blur_in", "center"),
      blueprint("context", 1.1, "fade", "ken_burns", "fade_in", "lower_third"),
      blueprint("transformation", 1.1, "slide_left", "ken_burns", "slide_up", "center"),
      blueprint("showcase", 1, "fade", "ken_burns", "fade_in", "lower_third"),
      blueprint("cta", 0.8, "zoom_in", "pulse", "fade_in", "center"),
    ],
    caption: {
      fontFamily: SANS,
      fontSizePx: 46,
      color: "#F8FAFC",
      activeColor: "#FBBF24",
      backgroundColor: "rgba(0,0,0,0.35)",
      strokeWidth: 3,
      uppercase: false,
      maxWordsPerCue: 6,
      bottomOffsetPx: 380,
    },
    audioMix: { musicVolume: 0.4, voiceVolume: 0.95, duckingAmount: 0.5 },
  },
  {
    id: "clean_product",
    name: "Clean Product",
    description:
      "Heller, aufgeräumter Produktlook mit klaren Flächen und ruhigen Übergängen.",
    bestFor: ["product", "app", "service"],
    palette: {
      background: "#0B0B0F",
      surface: "#FFFFFF",
      primary: "#111827",
      secondary: "#6366F1",
      accent: "#22D3EE",
      text: "#F9FAFB",
      textMuted: "#9CA3AF",
    },
    gradient: ["#111827", "#1F2937", "#0B0B0F"],
    typography: {
      headline: SANS,
      body: SANS,
      headlineWeight: 800,
      headlineSizePx: 70,
      sublineSizePx: 34,
      uppercase: false,
      letterSpacingEm: -0.015,
    },
    transitions: ["fade", "slide_up", "cut"],
    textAnimations: ["slide_up", "fade_in"],
    defaultEffect: "ken_burns",
    sceneStructure: [
      blueprint("hook", 1, "fade", "ken_burns", "slide_up", "upper_third"),
      blueprint("feature", 1, "slide_up", "none", "slide_up", "lower_third"),
      blueprint("feature", 1, "slide_up", "none", "slide_up", "lower_third"),
      blueprint("proof", 1, "fade", "ken_burns", "fade_in", "center"),
      blueprint("cta", 0.9, "fade", "pulse", "slide_up", "center"),
    ],
    caption: {
      fontFamily: SANS,
      fontSizePx: 44,
      color: "#FFFFFF",
      activeColor: "#22D3EE",
      backgroundColor: "rgba(17,24,39,0.6)",
      strokeWidth: 2,
      uppercase: false,
      maxWordsPerCue: 5,
      bottomOffsetPx: 400,
    },
    audioMix: { musicVolume: 0.28, voiceVolume: 1, duckingAmount: 0.55 },
  },
  {
    id: "dark_luxury",
    name: "Dark Luxury",
    description: "Tiefschwarz, Gold-Akzente und langsame Bewegungen für Premium-Angebote.",
    bestFor: ["mixing_mastering", "service", "product", "event"],
    palette: {
      background: "#050505",
      surface: "#121212",
      primary: "#D4AF37",
      secondary: "#8A6D1F",
      accent: "#F5E6B8",
      text: "#F5F5F0",
      textMuted: "#A3A3A3",
    },
    gradient: ["#000000", "#1A1408", "#050505"],
    typography: {
      headline: SERIF,
      body: SANS,
      headlineWeight: 700,
      headlineSizePx: 68,
      sublineSizePx: 32,
      uppercase: true,
      letterSpacingEm: 0.12,
    },
    transitions: ["fade", "zoom_out", "slide_left"],
    textAnimations: ["fade_in", "blur_in"],
    defaultEffect: "vignette",
    sceneStructure: [
      blueprint("hook", 1.1, "fade", "vignette", "blur_in", "center"),
      blueprint("proof", 1, "fade", "ken_burns", "fade_in", "lower_third"),
      blueprint("showcase", 1.1, "zoom_out", "vignette", "fade_in", "center"),
      blueprint("offer", 1, "fade", "ken_burns", "fade_in", "lower_third"),
      blueprint("cta", 0.9, "fade", "pulse", "fade_in", "center"),
    ],
    caption: {
      fontFamily: SANS,
      fontSizePx: 42,
      color: "#F5F5F0",
      activeColor: "#D4AF37",
      backgroundColor: "rgba(0,0,0,0.5)",
      strokeWidth: 2,
      uppercase: true,
      maxWordsPerCue: 4,
      bottomOffsetPx: 390,
    },
    audioMix: { musicVolume: 0.35, voiceVolume: 0.95, duckingAmount: 0.5 },
  },
  {
    id: "neon_futuristic",
    name: "Neon Futuristic",
    description: "Cyber-Ästhetik mit Neonrändern, Glitch-Übergängen und Scanlines.",
    bestFor: ["app", "music", "event", "custom"],
    palette: {
      background: "#04010F",
      surface: "#0E0524",
      primary: "#22D3EE",
      secondary: "#C026D3",
      accent: "#A3E635",
      text: "#ECFEFF",
      textMuted: "#67E8F9",
    },
    gradient: ["#04010F", "#3B0764", "#0891B2"],
    typography: {
      headline: MONO,
      body: MONO,
      headlineWeight: 700,
      headlineSizePx: 66,
      sublineSizePx: 32,
      uppercase: true,
      letterSpacingEm: 0.06,
    },
    transitions: ["glitch", "flash", "slide_left", "cut"],
    textAnimations: ["typewriter", "pop", "blur_in"],
    defaultEffect: "scanlines",
    sceneStructure: [
      blueprint("hook", 1, "glitch", "scanlines", "typewriter", "center"),
      blueprint("problem", 1, "flash", "shake", "pop", "upper_third"),
      blueprint("feature", 1, "slide_left", "scanlines", "typewriter", "lower_third"),
      blueprint("proof", 1, "glitch", "pulse", "pop", "center"),
      blueprint("cta", 0.9, "flash", "scanlines", "pop", "center"),
    ],
    caption: {
      fontFamily: MONO,
      fontSizePx: 48,
      color: "#ECFEFF",
      activeColor: "#A3E635",
      backgroundColor: "rgba(4,1,15,0.6)",
      strokeWidth: 4,
      uppercase: true,
      maxWordsPerCue: 4,
      bottomOffsetPx: 410,
    },
    audioMix: { musicVolume: 0.42, voiceVolume: 1, duckingAmount: 0.55 },
  },
  {
    id: "music_visualizer",
    name: "Music Visualizer",
    description:
      "Cover im Zentrum, reagierende Balken und Lyric-Einblendungen - gebaut für Releases.",
    bestFor: ["music"],
    palette: {
      background: "#070310",
      surface: "#150B2B",
      primary: "#F472B6",
      secondary: "#818CF8",
      accent: "#FDE68A",
      text: "#FFFFFF",
      textMuted: "#D8B4FE",
    },
    gradient: ["#1E1B4B", "#701A75", "#BE185D"],
    typography: {
      headline: DISPLAY,
      body: SANS,
      headlineWeight: 900,
      headlineSizePx: 78,
      sublineSizePx: 38,
      uppercase: true,
      letterSpacingEm: -0.01,
    },
    transitions: ["fade", "zoom_in", "flash"],
    textAnimations: ["word_by_word", "pop", "fade_in"],
    defaultEffect: "pulse",
    sceneStructure: [
      blueprint("hook", 1, "flash", "pulse", "pop", "center"),
      blueprint("showcase", 1.2, "fade", "pulse", "word_by_word", "lower_third"),
      blueprint("showcase", 1.2, "zoom_in", "pulse", "word_by_word", "lower_third"),
      blueprint("proof", 0.9, "fade", "ken_burns", "fade_in", "center"),
      blueprint("cta", 0.9, "flash", "pulse", "pop", "center"),
    ],
    caption: {
      fontFamily: DISPLAY,
      fontSizePx: 56,
      color: "#FFFFFF",
      activeColor: "#FDE68A",
      backgroundColor: "rgba(7,3,16,0.45)",
      strokeWidth: 6,
      uppercase: true,
      maxWordsPerCue: 4,
      bottomOffsetPx: 420,
    },
    audioMix: { musicVolume: 0.75, voiceVolume: 0.9, duckingAmount: 0.35 },
  },
  {
    id: "app_demo",
    name: "App Demo",
    description:
      "Screenrecordings im Telefonrahmen, Feature-Callouts und klare Schritt-für-Schritt-Führung.",
    bestFor: ["app", "website", "service"],
    palette: {
      background: "#06080F",
      surface: "#131A2A",
      primary: "#3B82F6",
      secondary: "#8B5CF6",
      accent: "#34D399",
      text: "#F8FAFC",
      textMuted: "#94A3B8",
    },
    gradient: ["#0B1120", "#1E3A8A", "#0F766E"],
    typography: {
      headline: SANS,
      body: SANS,
      headlineWeight: 800,
      headlineSizePx: 64,
      sublineSizePx: 32,
      uppercase: false,
      letterSpacingEm: -0.02,
    },
    transitions: ["slide_up", "fade", "cut"],
    textAnimations: ["slide_up", "pop", "fade_in"],
    defaultEffect: "none",
    sceneStructure: [
      blueprint("problem", 1, "cut", "shake", "pop", "center"),
      blueprint("feature", 1.1, "slide_up", "none", "slide_up", "upper_third"),
      blueprint("feature", 1.1, "slide_up", "none", "slide_up", "upper_third"),
      blueprint("proof", 0.9, "fade", "ken_burns", "fade_in", "lower_third"),
      blueprint("cta", 0.9, "fade", "pulse", "pop", "center"),
    ],
    caption: {
      fontFamily: SANS,
      fontSizePx: 46,
      color: "#F8FAFC",
      activeColor: "#34D399",
      backgroundColor: "rgba(6,8,15,0.6)",
      strokeWidth: 3,
      uppercase: false,
      maxWordsPerCue: 5,
      bottomOffsetPx: 400,
    },
    audioMix: { musicVolume: 0.26, voiceVolume: 1, duckingAmount: 0.6 },
  },
  {
    id: "before_after",
    name: "Before & After",
    description:
      "Split-Screen-Dramaturgie mit klarer Vorher-Nachher-Gegenüberstellung.",
    bestFor: ["mixing_mastering", "service", "product"],
    palette: {
      background: "#070707",
      surface: "#141414",
      primary: "#EF4444",
      secondary: "#22C55E",
      accent: "#FACC15",
      text: "#FAFAFA",
      textMuted: "#A1A1AA",
    },
    gradient: ["#450A0A", "#171717", "#052E16"],
    typography: {
      headline: DISPLAY,
      body: SANS,
      headlineWeight: 900,
      headlineSizePx: 74,
      sublineSizePx: 36,
      uppercase: true,
      letterSpacingEm: -0.01,
    },
    transitions: ["slide_left", "cut", "flash"],
    textAnimations: ["pop", "slide_up"],
    defaultEffect: "pulse",
    sceneStructure: [
      blueprint("hook", 1, "cut", "shake", "pop", "center"),
      blueprint("problem", 1.1, "slide_left", "pulse", "pop", "upper_third"),
      blueprint("transformation", 1.2, "flash", "pulse", "pop", "upper_third"),
      blueprint("proof", 0.9, "cut", "ken_burns", "slide_up", "lower_third"),
      blueprint("cta", 0.9, "flash", "pulse", "pop", "center"),
    ],
    caption: {
      fontFamily: DISPLAY,
      fontSizePx: 54,
      color: "#FAFAFA",
      activeColor: "#FACC15",
      backgroundColor: "rgba(0,0,0,0.55)",
      strokeWidth: 6,
      uppercase: true,
      maxWordsPerCue: 4,
      bottomOffsetPx: 415,
    },
    audioMix: { musicVolume: 0.3, voiceVolume: 1, duckingAmount: 0.6 },
  },
  {
    id: "minimal_typography",
    name: "Minimal Typography",
    description: "Nur Text, viel Weißraum, ruhige Farbflächen - maximale Lesbarkeit.",
    bestFor: ["service", "custom", "website", "product"],
    palette: {
      background: "#0A0A0A",
      surface: "#171717",
      primary: "#FAFAFA",
      secondary: "#A3A3A3",
      accent: "#7C3AED",
      text: "#FAFAFA",
      textMuted: "#737373",
    },
    gradient: ["#0A0A0A", "#171717", "#0A0A0A"],
    typography: {
      headline: SANS,
      body: SANS,
      headlineWeight: 800,
      headlineSizePx: 82,
      sublineSizePx: 34,
      uppercase: false,
      letterSpacingEm: -0.04,
    },
    transitions: ["fade", "cut"],
    textAnimations: ["fade_in", "word_by_word", "slide_up"],
    defaultEffect: "none",
    sceneStructure: [
      blueprint("hook", 1, "fade", "none", "word_by_word", "center"),
      blueprint("problem", 1, "fade", "none", "fade_in", "center"),
      blueprint("proof", 1, "fade", "none", "fade_in", "center"),
      blueprint("offer", 1, "fade", "none", "slide_up", "center"),
      blueprint("cta", 1, "fade", "none", "word_by_word", "center"),
    ],
    caption: {
      fontFamily: SANS,
      fontSizePx: 44,
      color: "#FAFAFA",
      activeColor: "#7C3AED",
      backgroundColor: "transparent",
      strokeWidth: 0,
      uppercase: false,
      maxWordsPerCue: 6,
      bottomOffsetPx: 370,
    },
    audioMix: { musicVolume: 0.22, voiceVolume: 1, duckingAmount: 0.5 },
  },
  {
    id: "fast_promo",
    name: "Fast-Paced Promo",
    description:
      "Sehr kurze Schnitte, hohe Frequenz, permanenter Reiz - ideal für Sale- und Event-Kampagnen.",
    bestFor: ["event", "product", "music", "custom"],
    palette: {
      background: "#0A0416",
      surface: "#1B0A33",
      primary: "#F43F5E",
      secondary: "#8B5CF6",
      accent: "#FDE047",
      text: "#FFFFFF",
      textMuted: "#E9D5FF",
    },
    gradient: ["#4C0519", "#581C87", "#0A0416"],
    typography: {
      headline: DISPLAY,
      body: SANS,
      headlineWeight: 900,
      headlineSizePx: 88,
      sublineSizePx: 38,
      uppercase: true,
      letterSpacingEm: -0.03,
    },
    transitions: ["cut", "flash", "whip_pan", "zoom_in"],
    textAnimations: ["pop", "word_by_word"],
    defaultEffect: "shake",
    sceneStructure: [
      blueprint("hook", 0.9, "flash", "shake", "pop", "center"),
      blueprint("showcase", 0.9, "whip_pan", "shake", "pop", "center"),
      blueprint("feature", 0.9, "cut", "pulse", "pop", "upper_third"),
      blueprint("offer", 1, "zoom_in", "shake", "pop", "center"),
      blueprint("cta", 1, "flash", "pulse", "pop", "center"),
    ],
    caption: {
      fontFamily: DISPLAY,
      fontSizePx: 58,
      color: "#FFFFFF",
      activeColor: "#FDE047",
      backgroundColor: "rgba(10,4,22,0.5)",
      strokeWidth: 7,
      uppercase: true,
      maxWordsPerCue: 3,
      bottomOffsetPx: 425,
    },
    audioMix: { musicVolume: 0.45, voiceVolume: 1, duckingAmount: 0.55 },
  },
];

export const DEFAULT_STYLE_ID = "viral_ugc";

const STYLE_INDEX = new Map(VIDEO_STYLES.map((style) => [style.id, style]));

export function getVideoStyle(id: string | null | undefined): VideoStyle {
  const style = id ? STYLE_INDEX.get(id) : undefined;
  // Falling back keeps old projects renderable when a template is renamed.
  return style ?? STYLE_INDEX.get(DEFAULT_STYLE_ID)!;
}

export function listStylesForCategory(category: string): VideoStyle[] {
  const preferred = VIDEO_STYLES.filter((style) => style.bestFor.includes(category));
  const rest = VIDEO_STYLES.filter((style) => !style.bestFor.includes(category));
  return [...preferred, ...rest];
}
