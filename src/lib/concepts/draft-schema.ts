import { z } from "zod";

import { SCENE_SOURCE_KINDS } from "@/lib/domain/enums";
import { SCENE_ROLES } from "@/lib/video/styles";

/**
 * The contract every text provider must satisfy when generating concepts.
 *
 * Providers return *creative content only*. Timing, transitions, fonts and
 * asset wiring are applied afterwards by `layoutConcept`, so scene durations
 * always add up to exactly the requested video length no matter which model
 * produced the copy.
 */

export const ASSET_HINTS = [
  "cover",
  "logo",
  "screenshot",
  "user_media",
  "website_shot",
  "before_after",
  "none",
] as const;
export type AssetHint = (typeof ASSET_HINTS)[number];

export const beatDraftSchema = z.object({
  role: z.enum(SCENE_ROLES),
  /** 1 = must keep when the video is short, higher = dropped first. */
  priority: z.number().int().min(1).max(5),
  /** Relative share of the total runtime. */
  weight: z.number().min(0.2).max(4),
  /** Short internal label shown in the editor's scene list. */
  title: z.string().min(1).max(80),
  /** Main on-screen text. Keep it short - it has to fit a 9:16 frame. */
  text: z.string().max(120),
  subline: z.string().max(160).default(""),
  voiceover: z.string().max(400).default(""),
  visual: z.string().max(400),
  mediaPrompt: z.string().max(600),
  sourceKind: z.enum(SCENE_SOURCE_KINDS).default("ai_image_motion"),
  assetHint: z.enum(ASSET_HINTS).default("none"),
  soundNote: z.string().max(200).default(""),
});
export type BeatDraft = z.infer<typeof beatDraftSchema>;

export const conceptDraftSchema = z.object({
  title: z.string().min(1).max(120),
  bigIdea: z.string().min(1).max(800),
  audience: z.string().max(300).default(""),
  hook: z.string().min(1).max(200),
  callToAction: z.string().max(160).default(""),
  caption: z.string().max(500).default(""),
  hashtags: z.array(z.string().max(50)).max(15).default([]),
  rationale: z.string().max(900).default(""),
  musicNote: z.string().max(300).default(""),
  styleId: z.string().max(60).default("viral_ugc"),
  beats: z.array(beatDraftSchema).min(3).max(12),
});
export type ConceptDraft = z.infer<typeof conceptDraftSchema>;

export const conceptDraftResponseSchema = z.object({
  concepts: z.array(conceptDraftSchema).min(1).max(5),
});

export const hookListSchema = z.object({
  hooks: z.array(z.string().min(1).max(200)).min(1).max(10),
});
