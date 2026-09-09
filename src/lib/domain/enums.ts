/**
 * Central enumerations of the AdReel AI domain.
 *
 * Every list is exported both as a readonly tuple (for Zod `z.enum` and for
 * rendering pickers in the UI) and as a derived union type.
 */

export const PROJECT_CATEGORIES = [
  "music",
  "website",
  "app",
  "mixing_mastering",
  "product",
  "service",
  "event",
  "custom",
] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const PLATFORMS = [
  "tiktok",
  "instagram_reels",
  "youtube_shorts",
  "all",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const TONES = [
  "professional",
  "emotional",
  "luxurious",
  "aggressive",
  "humorous",
  "futuristic",
  "minimalistic",
  "ugc",
] as const;
export type Tone = (typeof TONES)[number];

export const LANGUAGES = ["de", "en", "es", "fr", "it", "pt", "nl", "tr"] as const;
export type Language = (typeof LANGUAGES)[number];

export const VIDEO_DURATIONS = [10, 15, 30, 45, 60] as const;
export type VideoDuration = (typeof VIDEO_DURATIONS)[number];

export const PROJECT_STATUSES = [
  "draft",
  "concept_generating",
  "media_generating",
  "rendering",
  "ready",
  "failed",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const JOB_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const GENERATION_JOB_KINDS = [
  "concepts",
  "scene_media",
  "voiceover",
  "music",
  "website_import",
] as const;
export type GenerationJobKind = (typeof GENERATION_JOB_KINDS)[number];

export const SCENE_SOURCE_KINDS = [
  "ai_video",
  "ai_image_motion",
  "user_upload",
  "website_screenshot",
  "app_screenshot",
  "stock_demo",
  "color_gradient",
] as const;
export type SceneSourceKind = (typeof SCENE_SOURCE_KINDS)[number];

export const TRANSITIONS = [
  "none",
  "cut",
  "fade",
  "slide_up",
  "slide_left",
  "zoom_in",
  "zoom_out",
  "whip_pan",
  "glitch",
  "flash",
] as const;
export type Transition = (typeof TRANSITIONS)[number];

export const TEXT_ANIMATIONS = [
  "none",
  "fade_in",
  "slide_up",
  "pop",
  "typewriter",
  "word_by_word",
  "blur_in",
] as const;
export type TextAnimation = (typeof TEXT_ANIMATIONS)[number];

export const TEXT_POSITIONS = ["top", "upper_third", "center", "lower_third", "bottom"] as const;
export type TextPosition = (typeof TEXT_POSITIONS)[number];

export const SCENE_EFFECTS = [
  "none",
  "ken_burns",
  "shake",
  "pulse",
  "film_grain",
  "vignette",
  "scanlines",
] as const;
export type SceneEffect = (typeof SCENE_EFFECTS)[number];

export const ASSET_KINDS = [
  "image",
  "video",
  "audio",
  "logo",
  "screenshot",
  "cover",
  "other",
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const EXPORT_QUALITIES = ["preview", "final"] as const;
export type ExportQuality = (typeof EXPORT_QUALITIES)[number];

export const PROVIDER_KINDS = [
  "text",
  "image",
  "video",
  "voice",
  "music",
  "render",
  "storage",
] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

/** Human readable labels (German UI copy). */
export const CATEGORY_LABELS: Record<ProjectCategory, string> = {
  music: "Musik",
  website: "Website",
  app: "App",
  mixing_mastering: "Mixing & Mastering",
  product: "Produkt",
  service: "Dienstleistung",
  event: "Event",
  custom: "Benutzerdefiniert",
};

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Entwurf",
  concept_generating: "Konzept wird erstellt",
  media_generating: "Medien werden generiert",
  rendering: "Video wird gerendert",
  ready: "Fertig",
  failed: "Fehlgeschlagen",
};

export const TONE_LABELS: Record<Tone, string> = {
  professional: "Professionell",
  emotional: "Emotional",
  luxurious: "Luxuriös",
  aggressive: "Aggressiv",
  humorous: "Humorvoll",
  futuristic: "Futuristisch",
  minimalistic: "Minimalistisch",
  ugc: "Authentischer UGC-Stil",
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram_reels: "Instagram Reels",
  youtube_shorts: "YouTube Shorts",
  all: "Alle Plattformen",
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  de: "Deutsch",
  en: "English",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  tr: "Türkçe",
};
