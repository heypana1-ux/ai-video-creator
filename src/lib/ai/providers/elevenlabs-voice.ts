import { serverEnv } from "@/lib/config/env";
import { deriveWordTimings } from "@/lib/video/captions";

import { ProviderError } from "../errors";
import { executeProviderCall } from "../execute";
import { providerFetch } from "./http";
import type {
  GeneratedVoiceover,
  ProviderCallOptions,
  ProviderResult,
  ProviderStatus,
  StorageProvider,
  VoiceGenerationInput,
  VoiceGenerationProvider,
  WordTiming,
} from "../types";

interface TimestampResponse {
  audio_base64?: string;
  alignment?: {
    characters?: string[];
    character_start_times_seconds?: number[];
    character_end_times_seconds?: number[];
  };
}

/**
 * Turns ElevenLabs' per-character alignment into word timings, which is what
 * the subtitle renderer needs.
 */
export function wordsFromCharacterAlignment(
  characters: string[],
  starts: number[],
  ends: number[],
): WordTiming[] {
  const words: WordTiming[] = [];
  let current = "";
  let startSec: number | null = null;
  let endSec = 0;

  const flush = () => {
    if (current.trim().length > 0 && startSec !== null) {
      words.push({
        word: current,
        startMs: Math.round(startSec * 1000),
        endMs: Math.round(endSec * 1000),
      });
    }
    current = "";
    startSec = null;
  };

  characters.forEach((character, index) => {
    if (/\s/.test(character)) {
      flush();
      return;
    }
    if (startSec === null) startSec = starts[index] ?? endSec;
    current += character;
    endSec = ends[index] ?? endSec;
  });
  flush();

  return words;
}

/** ElevenLabs text-to-speech with word level timestamps. */
export class ElevenLabsVoiceProvider implements VoiceGenerationProvider {
  readonly id = "elevenlabs-voice";
  readonly kind = "voice" as const;
  readonly isDemo = false;

  constructor(private readonly storage: StorageProvider) {}

  async status(): Promise<ProviderStatus> {
    const configured = Boolean(serverEnv.elevenLabsApiKey);
    return {
      id: this.id,
      kind: this.kind,
      available: configured,
      isDemo: false,
      detail: configured ? `Modell ${serverEnv.elevenLabsModel}` : "ELEVENLABS_API_KEY fehlt",
    };
  }

  async synthesize(
    input: VoiceGenerationInput,
    options: ProviderCallOptions = {},
  ): Promise<ProviderResult<GeneratedVoiceover>> {
    const apiKey = serverEnv.elevenLabsApiKey;
    if (!apiKey) {
      throw new ProviderError("unavailable", this.id, "ELEVENLABS_API_KEY fehlt", {
        retryable: false,
      });
    }
    const voiceId = input.voiceId || serverEnv.elevenLabsVoiceId;

    return executeProviderCall<GeneratedVoiceover>(
      {
        providerId: this.id,
        kind: this.kind,
        operation: "synthesize",
        isDemo: false,
        cost: { estimatedUsd: 0.03, credits: 0 },
        attempt: async ({ signal, onProgress }) => {
          onProgress(0.2, "Stimme wird erzeugt");
          const response = await providerFetch(
            this.id,
            `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`,
            {
              method: "POST",
              signal,
              headers: {
                "content-type": "application/json",
                "xi-api-key": apiKey,
              },
              body: JSON.stringify({
                text: input.text,
                model_id: serverEnv.elevenLabsModel,
                output_format: "mp3_44100_128",
                voice_settings: { stability: 0.5, similarity_boost: 0.75 },
              }),
            },
          );

          const body = (await response.json()) as TimestampResponse;
          if (!body.audio_base64) {
            throw new ProviderError("invalid_response", this.id, "Keine Audiodaten erhalten");
          }

          onProgress(0.8, "Audio wird gespeichert");
          const bytes = Uint8Array.from(Buffer.from(body.audio_base64, "base64"));

          const characters = body.alignment?.characters ?? [];
          const starts = body.alignment?.character_start_times_seconds ?? [];
          const ends = body.alignment?.character_end_times_seconds ?? [];
          const words =
            characters.length > 0
              ? wordsFromCharacterAlignment(characters, starts, ends)
              : [];
          const durationMs =
            words.length > 0
              ? words[words.length - 1].endMs
              : (input.targetDurationMs ?? 3000);

          const stored = await this.storage.put(
            `generated/voice/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.mp3`,
            bytes,
            "audio/mpeg",
          );

          return {
            url: stored.url,
            mimeType: "audio/mpeg",
            durationMs,
            byteSize: stored.byteSize,
            words: words.length > 0 ? words : deriveWordTimings(input.text, durationMs),
            isDemo: false,
            isSilentPlaceholder: false,
          };
        },
      },
      options,
    );
  }
}
