import { deriveWordTimings, estimateSpeechDurationMs, splitWords } from "@/lib/video/captions";
import { generateArtworkSvg, hashString } from "@/lib/media/artwork";
import { silentWav, synthesiseMusicWav } from "@/lib/media/wav";

import { executeProviderCall } from "../execute";
import type {
  GeneratedMedia,
  GeneratedMusic,
  GeneratedVideo,
  GeneratedVoiceover,
  ImageGenerationInput,
  ImageGenerationProvider,
  MusicGenerationInput,
  MusicProvider,
  ProviderCallOptions,
  ProviderResult,
  ProviderStatus,
  StorageProvider,
  VideoGenerationInput,
  VideoGenerationProvider,
  VoiceGenerationInput,
  VoiceGenerationProvider,
} from "../types";
import { demoKey, mockLatencyMs, simulateWork } from "./mock-support";

/* -------------------------------------------------------------------------- */
/* Images                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Produces deterministic abstract SVG artwork instead of calling an image
 * model. Output is real, renderable media - not a placeholder rectangle - so
 * the editor, the preview and the export all behave like production.
 */
export class MockImageProvider implements ImageGenerationProvider {
  readonly id = "mock-image";
  readonly kind = "image" as const;
  readonly isDemo = true;

  constructor(private readonly storage: StorageProvider) {}

  async status(): Promise<ProviderStatus> {
    return {
      id: this.id,
      kind: this.kind,
      available: true,
      isDemo: true,
      detail: "Demo-Bilder: prozedurale Grafiken, keine externen Kosten.",
    };
  }

  async generate(
    input: ImageGenerationInput,
    options: ProviderCallOptions = {},
  ): Promise<ProviderResult<GeneratedMedia>> {
    return executeProviderCall<GeneratedMedia>(
      {
        providerId: this.id,
        kind: this.kind,
        operation: "generate",
        isDemo: true,
        cost: { estimatedUsd: 0, credits: 0 },
        maxRetries: 0,
        attempt: async ({ signal, onProgress, setProviderJobId }) => {
          const seed = input.seed ?? hashString(input.prompt);
          setProviderJobId(`demo-img-${seed.toString(36)}`);
          await simulateWork(mockLatencyMs(900), signal, onProgress, [
            "Prompt wird interpretiert",
            "Komposition wird gesetzt",
            "Farben werden abgestimmt",
            "Bild wird finalisiert",
          ]);

          const svg = generateArtworkSvg({
            seed,
            width: input.width,
            height: input.height,
            palette: input.palette ?? [],
            prompt: input.prompt,
          });
          const bytes = new TextEncoder().encode(svg);
          const stored = await this.storage.put(
            demoKey("images", `${seed.toString(36)}-${input.width}x${input.height}`, "svg"),
            bytes,
            "image/svg+xml",
          );

          return {
            url: stored.url,
            mimeType: "image/svg+xml",
            width: input.width,
            height: input.height,
            byteSize: stored.byteSize,
            isDemo: true,
          };
        },
      },
      options,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Video                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Demo video provider. Returns a still plus a motion hint; the renderer
 * animates it, which yields real movement in the exported MP4 without paying
 * for a video model.
 */
export class MockVideoProvider implements VideoGenerationProvider {
  readonly id = "mock-video";
  readonly kind = "video" as const;
  readonly isDemo = true;

  constructor(private readonly storage: StorageProvider) {}

  async status(): Promise<ProviderStatus> {
    return {
      id: this.id,
      kind: this.kind,
      available: true,
      isDemo: true,
      detail: "Demo-Clips: animierte Standbilder statt generierter Videos.",
    };
  }

  async generate(
    input: VideoGenerationInput,
    options: ProviderCallOptions = {},
  ): Promise<ProviderResult<GeneratedVideo>> {
    return executeProviderCall<GeneratedVideo>(
      {
        providerId: this.id,
        kind: this.kind,
        operation: "generate",
        isDemo: true,
        cost: { estimatedUsd: 0, credits: 0 },
        maxRetries: 0,
        attempt: async ({ signal, onProgress, setProviderJobId }) => {
          const seed = input.seed ?? hashString(input.prompt);
          setProviderJobId(`demo-vid-${seed.toString(36)}`);
          // Video models are slow; the mock mirrors that so progress UI is real.
          await simulateWork(mockLatencyMs(2200), signal, onProgress, [
            "Clip wird eingereiht",
            "Keyframes werden erzeugt",
            "Bewegung wird interpoliert",
            "Clip wird kodiert",
          ]);

          const svg = generateArtworkSvg({
            seed,
            width: input.width,
            height: input.height,
            palette: input.palette ?? [],
            prompt: input.prompt,
          });
          const stored = await this.storage.put(
            demoKey("clips", `${seed.toString(36)}-${input.width}x${input.height}`, "svg"),
            new TextEncoder().encode(svg),
            "image/svg+xml",
          );

          const hints = ["ken_burns", "parallax", "pulse"] as const;
          return {
            url: stored.url,
            mimeType: "image/svg+xml",
            width: input.width,
            height: input.height,
            byteSize: stored.byteSize,
            durationMs: input.durationMs,
            motionHint: hints[seed % hints.length],
            isDemo: true,
          };
        },
      },
      options,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Voice                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Demo voice provider.
 *
 * It produces a silent track of the correct length plus accurate word timings.
 * That means subtitles, scene pacing and the audio mix are all exercised for
 * real - only the spoken audio itself is missing, and the UI labels it as such.
 */
export class MockVoiceProvider implements VoiceGenerationProvider {
  readonly id = "mock-voice";
  readonly kind = "voice" as const;
  readonly isDemo = true;

  constructor(private readonly storage: StorageProvider) {}

  async status(): Promise<ProviderStatus> {
    return {
      id: this.id,
      kind: this.kind,
      available: true,
      isDemo: true,
      detail:
        "Demo-Voice-over: stille Tonspur mit korrektem Timing. Für echte Stimmen ELEVENLABS_API_KEY setzen.",
    };
  }

  async synthesize(
    input: VoiceGenerationInput,
    options: ProviderCallOptions = {},
  ): Promise<ProviderResult<GeneratedVoiceover>> {
    return executeProviderCall<GeneratedVoiceover>(
      {
        providerId: this.id,
        kind: this.kind,
        operation: "synthesize",
        isDemo: true,
        cost: { estimatedUsd: 0, credits: 0 },
        maxRetries: 0,
        attempt: async ({ signal, onProgress, setProviderJobId }) => {
          const seed = hashString(input.text);
          setProviderJobId(`demo-voice-${seed.toString(36)}`);
          await simulateWork(mockLatencyMs(700), signal, onProgress, [
            "Text wird segmentiert",
            "Sprechtempo wird berechnet",
            "Tonspur wird erzeugt",
          ]);

          const words = splitWords(input.text);
          const naturalMs = estimateSpeechDurationMs(input.text, input.language);
          const durationMs = Math.max(
            400,
            input.targetDurationMs && words.length > 0 ? input.targetDurationMs : naturalMs,
          );

          const bytes = silentWav(durationMs);
          const stored = await this.storage.put(
            demoKey("voice", `${seed.toString(36)}-${durationMs}`, "wav"),
            bytes,
            "audio/wav",
          );

          return {
            url: stored.url,
            mimeType: "audio/wav",
            durationMs,
            byteSize: stored.byteSize,
            words: deriveWordTimings(input.text, durationMs),
            isDemo: true,
            isSilentPlaceholder: true,
          };
        },
      },
      options,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Music                                                                      */
/* -------------------------------------------------------------------------- */

/** Synthesises an actual audible bed, so demo exports carry real audio. */
export class MockMusicProvider implements MusicProvider {
  readonly id = "mock-music";
  readonly kind = "music" as const;
  readonly isDemo = true;

  constructor(private readonly storage: StorageProvider) {}

  async status(): Promise<ProviderStatus> {
    return {
      id: this.id,
      kind: this.kind,
      available: true,
      isDemo: true,
      detail: "Demo-Musik: prozedural synthetisiertes Bett, frei verwendbar.",
    };
  }

  async generate(
    input: MusicGenerationInput,
    options: ProviderCallOptions = {},
  ): Promise<ProviderResult<GeneratedMusic>> {
    return executeProviderCall<GeneratedMusic>(
      {
        providerId: this.id,
        kind: this.kind,
        operation: "generate",
        isDemo: true,
        cost: { estimatedUsd: 0, credits: 0 },
        maxRetries: 0,
        attempt: async ({ signal, onProgress, setProviderJobId }) => {
          const seed = input.seed ?? hashString(`${input.genre}|${input.mood}|${input.energy}`);
          setProviderJobId(`demo-music-${seed.toString(36)}`);
          await simulateWork(mockLatencyMs(1100), signal, onProgress, [
            "Stimmung wird ausgewertet",
            "Akkorde werden gesetzt",
            "Arrangement wird gebaut",
            "Track wird gerendert",
          ]);

          const durationMs = Math.max(1000, input.durationMs);
          const bytes = synthesiseMusicWav({
            durationMs,
            energy: input.energy,
            seed,
          });
          const stored = await this.storage.put(
            demoKey("music", `${seed.toString(36)}-${durationMs}`, "wav"),
            bytes,
            "audio/wav",
          );

          return {
            url: stored.url,
            mimeType: "audio/wav",
            durationMs,
            byteSize: stored.byteSize,
            title: `AdReel Demo Bed (${input.mood || "neutral"})`,
            license: "AdReel Demo - prozedural erzeugt, frei für Tests",
            isDemo: true,
          };
        },
      },
      options,
    );
  }
}
