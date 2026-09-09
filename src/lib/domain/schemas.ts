import { z } from "zod";

import {
  ASSET_KINDS,
  EXPORT_QUALITIES,
  GENERATION_JOB_KINDS,
  JOB_STATUSES,
  LANGUAGES,
  PLATFORMS,
  PROJECT_CATEGORIES,
  PROJECT_STATUSES,
  SCENE_EFFECTS,
  SCENE_SOURCE_KINDS,
  TEXT_ANIMATIONS,
  TEXT_POSITIONS,
  TONES,
  TRANSITIONS,
  VIDEO_DURATIONS,
} from "./enums";

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Bitte eine Hex-Farbe wie #7C3AED angeben");

export const idSchema = z.string().min(1).max(64);

/* -------------------------------------------------------------------------- */
/* Brief - the user supplied input per category                               */
/* -------------------------------------------------------------------------- */

export const brandKitSchema = z.object({
  id: idSchema.optional(),
  name: z.string().min(1).max(80),
  primaryColor: hexColor,
  secondaryColor: hexColor,
  accentColor: hexColor,
  fontFamily: z.string().min(1).max(60),
  logoAssetId: idSchema.nullable().optional(),
});
export type BrandKitInput = z.infer<typeof brandKitSchema>;

/** Fields every category shares. */
export const baseBriefSchema = z.object({
  name: z.string().min(2, "Bitte einen Projektnamen angeben").max(120),
  description: z.string().min(10, "Bitte mindestens 10 Zeichen beschreiben").max(2000),
  audience: z.string().max(400).default(""),
  goal: z.string().max(400).default(""),
  platform: z.enum(PLATFORMS).default("tiktok"),
  language: z.enum(LANGUAGES).default("de"),
  tone: z.enum(TONES).default("professional"),
  durationSeconds: z
    .union(VIDEO_DURATIONS.map((value) => z.literal(value)) as [
      z.ZodLiteral<10>,
      z.ZodLiteral<15>,
      z.ZodLiteral<30>,
      z.ZodLiteral<45>,
      z.ZodLiteral<60>,
    ])
    .default(15),
  callToAction: z.string().max(160).default(""),
  targetUrl: z.string().url("Bitte eine gültige URL angeben").or(z.literal("")).default(""),
  logoAssetId: idSchema.nullable().default(null),
  brandColors: z.array(hexColor).max(5).default([]),
  mediaAssetIds: z.array(idSchema).max(50).default([]),
  styleId: z.string().min(1).max(60).default("viral_ugc"),
  extraPrompt: z.string().max(1200).default(""),
});

export const musicDetailsSchema = z.object({
  artistName: z.string().min(1, "Künstlername fehlt").max(120),
  songTitle: z.string().min(1, "Songtitel fehlt").max(160),
  genre: z.string().max(80).default(""),
  mood: z.string().max(80).default(""),
  releaseDate: z.string().max(40).default(""),
  streamingUrl: z.string().url().or(z.literal("")).default(""),
  audioAssetId: idSchema.nullable().default(null),
  coverAssetId: idSchema.nullable().default(null),
  lyricsExcerpt: z.string().max(2000).default(""),
  /** Which part of the uploaded song should be used, in seconds. */
  songSectionStart: z.number().min(0).max(3600).default(0),
  songSectionEnd: z.number().min(0).max(3600).default(30),
  /** Legally required: the user confirms they hold the rights to the audio. */
  rightsConfirmed: z.boolean(),
});

export const websiteDetailsSchema = z.object({
  url: z.string().url("Bitte eine gültige URL angeben"),
  coreMessage: z.string().max(400).default(""),
  benefits: z.array(z.string().max(200)).max(10).default([]),
  siteGoal: z.string().max(300).default(""),
  desiredCta: z.string().max(160).default(""),
  /** Everything the importer extracted - always user editable before use. */
  importedTitle: z.string().max(300).default(""),
  importedDescription: z.string().max(1000).default(""),
  importedHeadings: z.array(z.string().max(300)).max(30).default([]),
  importReviewed: z.boolean().default(false),
});

export const appDetailsSchema = z.object({
  appName: z.string().min(1, "App-Name fehlt").max(120),
  platforms: z.array(z.string().max(40)).max(8).default([]),
  problemSolved: z.string().max(600).default(""),
  features: z.array(z.string().max(200)).max(12).default([]),
  storeUrl: z.string().url().or(z.literal("")).default(""),
  screenshotAssetIds: z.array(idSchema).max(20).default([]),
  screenRecordingAssetIds: z.array(idSchema).max(10).default([]),
});

export const mixingDetailsSchema = z.object({
  offerName: z.string().min(1, "Angebotsname fehlt").max(120),
  genres: z.array(z.string().max(60)).max(12).default([]),
  services: z.array(z.string().max(160)).max(12).default([]),
  price: z.string().max(80).default(""),
  priceOnRequest: z.boolean().default(false),
  turnaround: z.string().max(80).default(""),
  references: z.array(z.string().max(200)).max(12).default([]),
  beforeAudioAssetId: idSchema.nullable().default(null),
  afterAudioAssetId: idSchema.nullable().default(null),
  bookingUrl: z.string().url().or(z.literal("")).default(""),
});

export const productDetailsSchema = z.object({
  productName: z.string().min(1, "Produktname fehlt").max(120),
  keyBenefits: z.array(z.string().max(200)).max(10).default([]),
  price: z.string().max(80).default(""),
  shopUrl: z.string().url().or(z.literal("")).default(""),
  usp: z.string().max(300).default(""),
});

export const serviceDetailsSchema = z.object({
  serviceName: z.string().min(1, "Name der Dienstleistung fehlt").max(120),
  problemSolved: z.string().max(600).default(""),
  deliverables: z.array(z.string().max(200)).max(10).default([]),
  price: z.string().max(80).default(""),
  bookingUrl: z.string().url().or(z.literal("")).default(""),
  serviceArea: z.string().max(120).default(""),
});

export const eventDetailsSchema = z.object({
  eventName: z.string().min(1, "Eventname fehlt").max(120),
  eventDate: z.string().max(60).default(""),
  venue: z.string().max(160).default(""),
  lineup: z.array(z.string().max(120)).max(20).default([]),
  ticketUrl: z.string().url().or(z.literal("")).default(""),
  ticketPrice: z.string().max(80).default(""),
});

export const customDetailsSchema = z.object({
  offerName: z.string().min(1, "Bitte das Angebot benennen").max(120),
  highlights: z.array(z.string().max(200)).max(10).default([]),
  proofPoints: z.array(z.string().max(200)).max(10).default([]),
});

/** Discriminated union of all category briefs. */
export const projectBriefSchema = z.discriminatedUnion("category", [
  baseBriefSchema.extend({ category: z.literal("music"), details: musicDetailsSchema }),
  baseBriefSchema.extend({ category: z.literal("website"), details: websiteDetailsSchema }),
  baseBriefSchema.extend({ category: z.literal("app"), details: appDetailsSchema }),
  baseBriefSchema.extend({
    category: z.literal("mixing_mastering"),
    details: mixingDetailsSchema,
  }),
  baseBriefSchema.extend({ category: z.literal("product"), details: productDetailsSchema }),
  baseBriefSchema.extend({ category: z.literal("service"), details: serviceDetailsSchema }),
  baseBriefSchema.extend({ category: z.literal("event"), details: eventDetailsSchema }),
  baseBriefSchema.extend({ category: z.literal("custom"), details: customDetailsSchema }),
]);
export type ProjectBrief = z.infer<typeof projectBriefSchema>;
export type MusicBrief = Extract<ProjectBrief, { category: "music" }>;
export type WebsiteBrief = Extract<ProjectBrief, { category: "website" }>;
export type AppBrief = Extract<ProjectBrief, { category: "app" }>;
export type MixingBrief = Extract<ProjectBrief, { category: "mixing_mastering" }>;

/**
 * The music category requires an explicit rights confirmation. Zod cannot
 * express "must be true" inside the shared union without losing the nice
 * per-field error, so it is validated here.
 */
export const projectBriefWithConsentSchema = projectBriefSchema.superRefine((brief, ctx) => {
  if (brief.category === "music" && !brief.details.rightsConfirmed) {
    ctx.addIssue({
      code: "custom",
      path: ["details", "rightsConfirmed"],
      message: "Bitte bestätige, dass du die Rechte am hochgeladenen Audio besitzt.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Concepts and scenes                                                        */
/* -------------------------------------------------------------------------- */

export const sceneSourceSchema = z.object({
  kind: z.enum(SCENE_SOURCE_KINDS),
  /** Asset id when the media already lives in storage. */
  assetId: idSchema.nullable().default(null),
  /** Direct URL - used for demo/stock media that is served from /public. */
  url: z.string().nullable().default(null),
  /** Prompt handed to the image/video provider when (re)generating. */
  prompt: z.string().max(1200).default(""),
  /** Gradient stops for `color_gradient` sources. */
  gradient: z.array(hexColor).max(4).default([]),
  /** True when the media came out of a mock provider. */
  isDemo: z.boolean().default(false),
});
export type SceneSource = z.infer<typeof sceneSourceSchema>;

export const sceneTextSchema = z.object({
  content: z.string().max(300).default(""),
  fontFamily: z.string().max(80).default("Inter"),
  fontSize: z.number().min(16).max(160).default(64),
  color: hexColor.default("#FFFFFF"),
  position: z.enum(TEXT_POSITIONS).default("center"),
  animation: z.enum(TEXT_ANIMATIONS).default("fade_in"),
  /** Optional smaller line below the headline. */
  subline: z.string().max(300).default(""),
});
export type SceneText = z.infer<typeof sceneTextSchema>;

export const wordTimingSchema = z.object({
  word: z.string().max(80),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
});
export type WordTimingRecord = z.infer<typeof wordTimingSchema>;

export const sceneSchema = z.object({
  id: idSchema,
  index: z.number().int().min(0),
  durationMs: z.number().int().min(500).max(20_000),
  title: z.string().max(120).default(""),
  visualDescription: z.string().max(800).default(""),
  source: sceneSourceSchema,
  text: sceneTextSchema,
  transition: z.enum(TRANSITIONS).default("fade"),
  effect: z.enum(SCENE_EFFECTS).default("ken_burns"),
  voiceoverText: z.string().max(800).default(""),
  voiceoverAssetId: idSchema.nullable().default(null),
  voiceoverUrl: z.string().nullable().default(null),
  /** Word level timings from the voice provider; empty means "derive from text". */
  voiceoverWords: z.array(wordTimingSchema).max(400).default([]),
  voiceVolume: z.number().min(0).max(1).default(1),
  musicVolume: z.number().min(0).max(1).default(0.25),
  showSubtitles: z.boolean().default(true),
  soundNote: z.string().max(300).default(""),
});
export type Scene = z.infer<typeof sceneSchema>;

export const conceptSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  title: z.string().min(1).max(160),
  bigIdea: z.string().max(1000),
  audience: z.string().max(400),
  hook: z.string().max(300),
  voiceoverScript: z.string().max(4000),
  callToAction: z.string().max(200),
  caption: z.string().max(600),
  hashtags: z.array(z.string().max(60)).max(20),
  rationale: z.string().max(1200),
  musicNote: z.string().max(400).default(""),
  /** Background music generated for this concept, as a media reference. */
  musicUrl: z.string().nullable().default(null),
  styleId: z.string().max(60).default("viral_ugc"),
  scenes: z.array(sceneSchema).min(1).max(24),
  selected: z.boolean().default(false),
  isDemo: z.boolean().default(false),
  createdAt: z.string(),
});
export type Concept = z.infer<typeof conceptSchema>;

/* -------------------------------------------------------------------------- */
/* Persisted records                                                          */
/* -------------------------------------------------------------------------- */

export const assetSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  projectId: idSchema.nullable(),
  kind: z.enum(ASSET_KINDS),
  fileName: z.string().max(300),
  mimeType: z.string().max(120),
  byteSize: z.number().int().min(0),
  url: z.string(),
  storageKey: z.string(),
  width: z.number().int().nullable().default(null),
  height: z.number().int().nullable().default(null),
  durationMs: z.number().int().nullable().default(null),
  isDemo: z.boolean().default(false),
  createdAt: z.string(),
});
export type Asset = z.infer<typeof assetSchema>;

export const projectSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  ownerId: idSchema,
  name: z.string().max(120),
  category: z.enum(PROJECT_CATEGORIES),
  status: z.enum(PROJECT_STATUSES),
  brief: projectBriefSchema,
  selectedConceptId: idSchema.nullable().default(null),
  thumbnailUrl: z.string().nullable().default(null),
  durationSeconds: z.number().int().min(1).max(600),
  brandKitId: idSchema.nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof projectSchema>;

export const generationJobSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  projectId: idSchema,
  kind: z.enum(GENERATION_JOB_KINDS),
  status: z.enum(JOB_STATUSES),
  progress: z.number().min(0).max(1),
  step: z.string().max(200),
  error: z.string().max(2000).nullable().default(null),
  resultRef: z.string().max(200).nullable().default(null),
  providerJobId: z.string().max(200).nullable().default(null),
  creditsSpent: z.number().min(0).default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GenerationJob = z.infer<typeof generationJobSchema>;

export const renderJobSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  projectId: idSchema,
  conceptId: idSchema,
  quality: z.enum(EXPORT_QUALITIES),
  status: z.enum(JOB_STATUSES),
  progress: z.number().min(0).max(1),
  step: z.string().max(200),
  error: z.string().max(2000).nullable().default(null),
  exportId: idSchema.nullable().default(null),
  creditsSpent: z.number().min(0).default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RenderJob = z.infer<typeof renderJobSchema>;

export const exportSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  projectId: idSchema,
  renderJobId: idSchema,
  quality: z.enum(EXPORT_QUALITIES),
  width: z.number().int(),
  height: z.number().int(),
  fps: z.number().int(),
  durationMs: z.number().int(),
  byteSize: z.number().int(),
  url: z.string(),
  storageKey: z.string(),
  isDemo: z.boolean().default(false),
  createdAt: z.string(),
});
export type VideoExport = z.infer<typeof exportSchema>;

export const providerUsageSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  projectId: idSchema.nullable(),
  providerKind: z.string().max(40),
  providerId: z.string().max(60),
  operation: z.string().max(60),
  providerJobId: z.string().max(200).nullable(),
  durationMs: z.number().int().min(0),
  estimatedCostUsd: z.number().min(0),
  credits: z.number().min(0),
  success: z.boolean(),
  createdAt: z.string(),
});
export type ProviderUsage = z.infer<typeof providerUsageSchema>;

export const creditTransactionSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  projectId: idSchema.nullable(),
  amount: z.number(),
  reason: z.string().max(200),
  balanceAfter: z.number(),
  createdAt: z.string(),
});
export type CreditTransaction = z.infer<typeof creditTransactionSchema>;

export const subscriptionSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  plan: z.enum(["demo", "starter", "creator", "studio"]),
  status: z.enum(["active", "past_due", "cancelled"]),
  creditsPerMonth: z.number().int(),
  renewsAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

export const workspaceSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  name: z.string().max(120),
  credits: z.number(),
  onboardedAt: z.string().nullable().default(null),
  createdAt: z.string(),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const userSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  displayName: z.string().max(120),
  passwordHash: z.string().nullable().default(null),
  isDemo: z.boolean().default(false),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const brandKitRecordSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  name: z.string().max(80),
  primaryColor: hexColor,
  secondaryColor: hexColor,
  accentColor: hexColor,
  fontFamily: z.string().max(60),
  logoAssetId: idSchema.nullable(),
  createdAt: z.string(),
});
export type BrandKit = z.infer<typeof brandKitRecordSchema>;

/* -------------------------------------------------------------------------- */
/* Request payloads                                                           */
/* -------------------------------------------------------------------------- */

export const createProjectSchema = z.object({
  brief: projectBriefWithConsentSchema,
  brandKitId: idSchema.nullable().default(null),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  brief: projectBriefWithConsentSchema.optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  selectedConceptId: idSchema.nullable().optional(),
  brandKitId: idSchema.nullable().optional(),
});

export const regenerateSceneSchema = z.object({
  conceptId: idSchema,
  sceneId: idSchema,
  extraPrompt: z.string().max(600).default(""),
});

export const updateConceptSchema = z.object({
  title: z.string().max(160).optional(),
  hook: z.string().max(300).optional(),
  voiceoverScript: z.string().max(4000).optional(),
  callToAction: z.string().max(200).optional(),
  caption: z.string().max(600).optional(),
  hashtags: z.array(z.string().max(60)).max(20).optional(),
  styleId: z.string().max(60).optional(),
  scenes: z.array(sceneSchema).min(1).max(24).optional(),
});

export const startRenderSchema = z.object({
  conceptId: idSchema,
  quality: z.enum(EXPORT_QUALITIES).default("preview"),
});

export const signUpSchema = z.object({
  email: z.string().email("Bitte eine gültige E-Mail angeben"),
  password: z.string().min(8, "Mindestens 8 Zeichen"),
  displayName: z.string().min(1, "Bitte einen Namen angeben").max(120),
});

export const signInSchema = z.object({
  email: z.string().email("Bitte eine gültige E-Mail angeben"),
  password: z.string().min(1, "Bitte das Passwort eingeben"),
});

export const websiteImportSchema = z.object({
  url: z.string().url("Bitte eine gültige URL angeben"),
});
