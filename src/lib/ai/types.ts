import type { Language } from "@/lib/domain/enums";

/* -------------------------------------------------------------------------- */
/* Shared provider plumbing                                                   */
/* -------------------------------------------------------------------------- */

export type ProviderKind =
  | "text"
  | "image"
  | "video"
  | "voice"
  | "music"
  | "render"
  | "storage";

export interface ProviderCost {
  /** Best-effort estimate of what this call costs at the upstream provider. */
  estimatedUsd: number;
  /** What the user is billed, in AdReel credits. */
  credits: number;
}

export interface ProviderResultMeta {
  providerId: string;
  providerKind: ProviderKind;
  operation: string;
  /** Upstream job identifier when the provider exposes one. */
  providerJobId: string | null;
  durationMs: number;
  cost: ProviderCost;
  /** True when the output came from a mock/demo provider. */
  isDemo: boolean;
  /** Number of attempts the call needed (1 = succeeded first try). */
  attempts: number;
}

export interface ProviderResult<T> {
  data: T;
  meta: ProviderResultMeta;
}

export interface ProviderCallOptions {
  /** Cancels the call (and any in-flight HTTP request). */
  signal?: AbortSignal;
  /** Overrides the configured per-call timeout. */
  timeoutMs?: number;
  /** Progress in 0..1 plus a human readable step label. */
  onProgress?: (progress: number, step: string) => void;
}

export interface ProviderStatus {
  id: string;
  kind: ProviderKind;
  available: boolean;
  isDemo: boolean;
  /** Human readable explanation, e.g. "OPENAI_API_KEY fehlt". */
  detail: string;
}

export interface BaseProvider {
  readonly id: string;
  readonly kind: ProviderKind;
  readonly isDemo: boolean;
  /** Cheap readiness probe - never performs a paid call. */
  status(): Promise<ProviderStatus>;
}

/* -------------------------------------------------------------------------- */
/* Text                                                                       */
/* -------------------------------------------------------------------------- */

export interface TextGenerationInput {
  /** System / role instruction. */
  system: string;
  /** The actual task prompt. */
  prompt: string;
  /** Ask the provider for strict JSON output. */
  json?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface TextGenerationOutput {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface TextGenerationProvider extends BaseProvider {
  readonly kind: "text";
  generate(
    input: TextGenerationInput,
    options?: ProviderCallOptions,
  ): Promise<ProviderResult<TextGenerationOutput>>;
}

/* -------------------------------------------------------------------------- */
/* Image                                                                      */
/* -------------------------------------------------------------------------- */

export interface ImageGenerationInput {
  prompt: string;
  width: number;
  height: number;
  /** Deterministic output for mocks and reproducible tests. */
  seed?: number;
  /** Style template id, forwarded as a hint to the model. */
  styleHint?: string;
  /** Palette the image should stay within. */
  palette?: string[];
}

export interface GeneratedMedia {
  /** Publicly reachable URL (already uploaded through the storage provider). */
  url: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  isDemo: boolean;
}

export interface ImageGenerationProvider extends BaseProvider {
  readonly kind: "image";
  generate(
    input: ImageGenerationInput,
    options?: ProviderCallOptions,
  ): Promise<ProviderResult<GeneratedMedia>>;
}

/* -------------------------------------------------------------------------- */
/* Video                                                                      */
/* -------------------------------------------------------------------------- */

export interface VideoGenerationInput {
  prompt: string;
  durationMs: number;
  width: number;
  height: number;
  seed?: number;
  styleHint?: string;
  palette?: string[];
  /** Optional still image the clip should animate from. */
  referenceImageUrl?: string;
}

export interface GeneratedVideo extends GeneratedMedia {
  durationMs: number;
  /**
   * Some providers (and the mock) return a still frame plus a motion hint
   * instead of an encoded clip. The renderer animates the still in that case.
   */
  motionHint: "none" | "ken_burns" | "parallax" | "pulse";
}

export interface VideoGenerationProvider extends BaseProvider {
  readonly kind: "video";
  generate(
    input: VideoGenerationInput,
    options?: ProviderCallOptions,
  ): Promise<ProviderResult<GeneratedVideo>>;
}

/* -------------------------------------------------------------------------- */
/* Voice                                                                      */
/* -------------------------------------------------------------------------- */

export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export interface VoiceGenerationInput {
  text: string;
  language: Language;
  voiceId?: string;
  /** 0.5 - 2.0, 1 = normal. */
  speed?: number;
  /** Target duration; providers that support it will pace the read. */
  targetDurationMs?: number;
}

export interface GeneratedVoiceover {
  url: string;
  mimeType: string;
  durationMs: number;
  byteSize: number;
  /** Word level timings used for burned-in subtitles. */
  words: WordTiming[];
  isDemo: boolean;
  /** True when the audio contains no actual speech (demo placeholder). */
  isSilentPlaceholder: boolean;
}

export interface VoiceGenerationProvider extends BaseProvider {
  readonly kind: "voice";
  synthesize(
    input: VoiceGenerationInput,
    options?: ProviderCallOptions,
  ): Promise<ProviderResult<GeneratedVoiceover>>;
}

/* -------------------------------------------------------------------------- */
/* Music                                                                      */
/* -------------------------------------------------------------------------- */

export interface MusicGenerationInput {
  mood: string;
  genre: string;
  durationMs: number;
  /** 0..1 - drives tempo and layering. */
  energy: number;
  seed?: number;
}

export interface GeneratedMusic {
  url: string;
  mimeType: string;
  durationMs: number;
  byteSize: number;
  title: string;
  license: string;
  isDemo: boolean;
}

export interface MusicProvider extends BaseProvider {
  readonly kind: "music";
  generate(
    input: MusicGenerationInput,
    options?: ProviderCallOptions,
  ): Promise<ProviderResult<GeneratedMusic>>;
}

/* -------------------------------------------------------------------------- */
/* Render                                                                     */
/* -------------------------------------------------------------------------- */

export interface RenderInput {
  /** Serialisable description of the whole video, see `@/lib/video/spec`. */
  spec: unknown;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  /** Absolute path the encoded file must be written to. */
  outputPath: string;
}

export interface RenderOutput {
  outputPath: string;
  byteSize: number;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  isDemo: boolean;
}

export interface VideoRenderProvider extends BaseProvider {
  readonly kind: "render";
  render(
    input: RenderInput,
    options?: ProviderCallOptions,
  ): Promise<ProviderResult<RenderOutput>>;
}

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

export interface StoredObject {
  key: string;
  url: string;
  byteSize: number;
  contentType: string;
}

export interface StorageProvider extends BaseProvider {
  readonly kind: "storage";
  put(
    key: string,
    data: Uint8Array,
    contentType: string,
  ): Promise<StoredObject>;
  /** Time limited URL. Local storage returns the plain public URL. */
  signedUrl(key: string, ttlSeconds?: number): Promise<string>;
  remove(key: string): Promise<void>;
  /** Absolute filesystem path when the object lives on local disk. */
  localPath(key: string): string | null;
}

export interface ProviderBundle {
  text: TextGenerationProvider;
  image: ImageGenerationProvider;
  video: VideoGenerationProvider;
  voice: VoiceGenerationProvider;
  music: MusicProvider;
  render: VideoRenderProvider;
  storage: StorageProvider;
}
