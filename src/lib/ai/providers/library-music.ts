import { promises as fs } from "node:fs";
import path from "node:path";

import { ProviderError } from "../errors";
import { executeProviderCall } from "../execute";
import type {
  GeneratedMusic,
  MusicGenerationInput,
  MusicProvider,
  ProviderCallOptions,
  ProviderResult,
  ProviderStatus,
  StorageProvider,
} from "../types";

const LIBRARY_DIR = process.env.ADREEL_MUSIC_LIBRARY_DIR ?? "music-library";

/**
 * Serves background music from a local, self-hosted library instead of
 * generating it. Point `ADREEL_MUSIC_LIBRARY_DIR` at a folder of licensed
 * tracks; file names are matched loosely against mood and genre.
 */
export class LibraryMusicProvider implements MusicProvider {
  readonly id = "library-music";
  readonly kind = "music" as const;
  readonly isDemo = false;

  constructor(private readonly storage: StorageProvider) {}

  private get root(): string {
    return path.resolve(process.cwd(), LIBRARY_DIR);
  }

  async status(): Promise<ProviderStatus> {
    try {
      const files = await this.listTracks();
      return {
        id: this.id,
        kind: this.kind,
        available: files.length > 0,
        isDemo: false,
        detail: files.length > 0
          ? `${files.length} Tracks in ${LIBRARY_DIR}`
          : `Keine Audiodateien in ${LIBRARY_DIR} gefunden`,
      };
    } catch {
      return {
        id: this.id,
        kind: this.kind,
        available: false,
        isDemo: false,
        detail: `Verzeichnis ${LIBRARY_DIR} nicht lesbar`,
      };
    }
  }

  private async listTracks(): Promise<string[]> {
    const entries = await fs.readdir(this.root).catch(() => [] as string[]);
    return entries.filter((entry) => /\.(mp3|wav|m4a|ogg)$/i.test(entry));
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
        isDemo: false,
        cost: { estimatedUsd: 0, credits: 0 },
        maxRetries: 0,
        attempt: async ({ onProgress }) => {
          onProgress(0.3, "Passenden Track suchen");
          const tracks = await this.listTracks();
          if (tracks.length === 0) {
            throw new ProviderError(
              "unavailable",
              this.id,
              `Keine Tracks in ${LIBRARY_DIR}`,
              { retryable: false },
            );
          }

          const needle = `${input.mood} ${input.genre}`.toLowerCase();
          const match =
            tracks.find((track) =>
              needle.split(/\s+/).filter(Boolean).some((term) => track.toLowerCase().includes(term)),
            ) ?? tracks[Math.abs(input.seed ?? 0) % tracks.length];

          onProgress(0.7, "Track wird übernommen");
          const bytes = new Uint8Array(await fs.readFile(path.join(this.root, match)));
          const extension = path.extname(match).slice(1).toLowerCase();
          const stored = await this.storage.put(
            `library/music/${match}`,
            bytes,
            extension === "mp3" ? "audio/mpeg" : `audio/${extension}`,
          );

          return {
            url: stored.url,
            mimeType: extension === "mp3" ? "audio/mpeg" : `audio/${extension}`,
            durationMs: input.durationMs,
            byteSize: stored.byteSize,
            title: path.basename(match, path.extname(match)),
            license: "Eigene Lizenz - siehe music-library/LICENSE",
            isDemo: false,
          };
        },
      },
      options,
    );
  }
}
