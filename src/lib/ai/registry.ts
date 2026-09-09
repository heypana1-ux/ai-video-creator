import path from "node:path";

import { isDemoMode, serverEnv } from "@/lib/config/env";

import { AnthropicTextProvider } from "./providers/anthropic-text";
import { ElevenLabsVoiceProvider } from "./providers/elevenlabs-voice";
import { LibraryMusicProvider } from "./providers/library-music";
import {
  MockImageProvider,
  MockMusicProvider,
  MockVideoProvider,
  MockVoiceProvider,
} from "./providers/mock-media";
import { MockRenderProvider } from "./providers/mock-render";
import { MockTextProvider } from "./providers/mock-text";
import { OpenAiImageProvider } from "./providers/openai-image";
import { OpenAiTextProvider } from "./providers/openai-text";
import { RemotionRenderProvider } from "./providers/remotion-render";
import { ReplicateImageProvider, ReplicateVideoProvider } from "./providers/replicate";
import { LocalStorageProvider } from "./providers/storage-local";
import { SupabaseStorageProvider } from "./providers/storage-supabase";
import type {
  ImageGenerationProvider,
  MusicProvider,
  ProviderBundle,
  ProviderStatus,
  StorageProvider,
  TextGenerationProvider,
  VideoGenerationProvider,
  VideoRenderProvider,
  VoiceGenerationProvider,
} from "./types";

/**
 * Central provider selection.
 *
 * Business logic never constructs a provider itself - it asks for the bundle
 * and works against the interfaces. Swapping a vendor is one env variable.
 */

let cached: ProviderBundle | null = null;

/** Absolute path of the local media root, also used as Remotion's publicDir. */
export function mediaRoot(): string {
  return path.resolve(process.cwd(), serverEnv.dataDir, "media");
}

function buildStorage(): StorageProvider {
  if (serverEnv.storageProvider === "supabase" && !isDemoMode()) {
    return new SupabaseStorageProvider();
  }
  return new LocalStorageProvider(mediaRoot());
}

function buildText(): TextGenerationProvider {
  if (isDemoMode()) return new MockTextProvider();
  switch (serverEnv.textProvider) {
    case "openai":
      return new OpenAiTextProvider();
    case "anthropic":
      return new AnthropicTextProvider();
    default:
      return new MockTextProvider();
  }
}

function buildImage(storage: StorageProvider): ImageGenerationProvider {
  if (isDemoMode()) return new MockImageProvider(storage);
  switch (serverEnv.imageProvider) {
    case "openai":
      return new OpenAiImageProvider(storage);
    case "replicate":
      return new ReplicateImageProvider(storage);
    default:
      return new MockImageProvider(storage);
  }
}

function buildVideo(storage: StorageProvider): VideoGenerationProvider {
  if (isDemoMode()) return new MockVideoProvider(storage);
  switch (serverEnv.videoProvider) {
    case "replicate":
      return new ReplicateVideoProvider(storage);
    default:
      return new MockVideoProvider(storage);
  }
}

function buildVoice(storage: StorageProvider): VoiceGenerationProvider {
  if (isDemoMode()) return new MockVoiceProvider(storage);
  switch (serverEnv.voiceProvider) {
    case "elevenlabs":
      return new ElevenLabsVoiceProvider(storage);
    default:
      return new MockVoiceProvider(storage);
  }
}

function buildMusic(storage: StorageProvider): MusicProvider {
  if (isDemoMode()) return new MockMusicProvider(storage);
  switch (serverEnv.musicProvider) {
    case "library":
      return new LibraryMusicProvider(storage);
    default:
      return new MockMusicProvider(storage);
  }
}

function buildRender(): VideoRenderProvider {
  // Remotion is the default even in demo mode - it needs no credentials and
  // produces a real MP4. The mock exists purely for fast automated tests.
  return serverEnv.renderProvider === "mock"
    ? new MockRenderProvider()
    : new RemotionRenderProvider(mediaRoot());
}

export function getProviders(): ProviderBundle {
  if (cached) return cached;
  const storage = buildStorage();
  cached = {
    storage,
    text: buildText(),
    image: buildImage(storage),
    video: buildVideo(storage),
    voice: buildVoice(storage),
    music: buildMusic(storage),
    render: buildRender(),
  };
  return cached;
}

/** Test seam - forces providers to be rebuilt from the current environment. */
export function resetProviders(): void {
  cached = null;
}

export async function getProviderStatuses(): Promise<ProviderStatus[]> {
  const providers = getProviders();
  return Promise.all([
    providers.text.status(),
    providers.image.status(),
    providers.video.status(),
    providers.voice.status(),
    providers.music.status(),
    providers.render.status(),
    providers.storage.status(),
  ]);
}
