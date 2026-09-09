import { promises as fs } from "node:fs";
import path from "node:path";

import { renderMedia, selectComposition } from "@remotion/renderer";

import { serverEnv } from "@/lib/config/env";
import { getRemotionBundle } from "@/lib/render/bundle";

import { ProviderError } from "../errors";
import { executeProviderCall } from "../execute";
import type {
  ProviderCallOptions,
  ProviderResult,
  ProviderStatus,
  RenderInput,
  RenderOutput,
  VideoRenderProvider,
} from "../types";

const COMPOSITION_ID = "AdReel";

/**
 * Renders the `AdReel` composition to H.264 MP4 with Remotion.
 *
 * This is the default render provider and works without any API key, so a
 * fresh checkout can export a real video immediately.
 */
export class RemotionRenderProvider implements VideoRenderProvider {
  readonly id = "remotion";
  readonly kind = "render" as const;
  readonly isDemo = false;

  constructor(private readonly publicDir: string) {}

  async status(): Promise<ProviderStatus> {
    return {
      id: this.id,
      kind: this.kind,
      available: true,
      isDemo: false,
      detail: serverEnv.remotionBrowserExecutable
        ? `Remotion mit Browser ${serverEnv.remotionBrowserExecutable}`
        : "Remotion (lädt Chrome Headless Shell beim ersten Render)",
    };
  }

  async render(
    input: RenderInput,
    options: ProviderCallOptions = {},
  ): Promise<ProviderResult<RenderOutput>> {
    return executeProviderCall<RenderOutput>(
      {
        providerId: this.id,
        kind: this.kind,
        operation: "render",
        isDemo: false,
        cost: { estimatedUsd: 0, credits: 0 },
        // Rendering is CPU bound locally; retrying rarely helps and costs time.
        maxRetries: 0,
        timeoutMs: 15 * 60_000,
        attempt: async ({ signal, onProgress }) => {
          onProgress(0.02, "Komposition wird gebaut");
          const serveUrl = await getRemotionBundle({
            publicDir: this.publicDir,
            onProgress: (progress) =>
              onProgress(0.02 + progress * 0.18, "Komposition wird gebaut"),
          });

          if (signal.aborted) {
            throw new ProviderError("cancelled", this.id, "Abgebrochen", { retryable: false });
          }

          const browserExecutable = serverEnv.remotionBrowserExecutable || null;
          const inputProps = { spec: input.spec };

          onProgress(0.22, "Szenen werden analysiert");
          const composition = await selectComposition({
            serveUrl,
            id: COMPOSITION_ID,
            inputProps,
            browserExecutable,
          });

          await fs.mkdir(path.dirname(input.outputPath), { recursive: true });

          onProgress(0.25, "Frames werden gerendert");
          await renderMedia({
            composition: {
              ...composition,
              width: input.width,
              height: input.height,
              fps: input.fps,
              durationInFrames: input.durationInFrames,
            },
            serveUrl,
            codec: "h264",
            // yuv420p keeps the file playable on phones and in browsers.
            pixelFormat: "yuv420p",
            imageFormat: "jpeg",
            jpegQuality: 90,
            crf: input.width >= 1080 ? 20 : 24,
            outputLocation: input.outputPath,
            inputProps,
            browserExecutable,
            ...(serverEnv.remotionConcurrency
              ? { concurrency: serverEnv.remotionConcurrency }
              : {}),
            onProgress: ({ progress }) => {
              onProgress(0.25 + progress * 0.72, "Frames werden gerendert");
              if (signal.aborted) {
                throw new ProviderError("cancelled", this.id, "Abgebrochen", {
                  retryable: false,
                });
              }
            },
          });

          onProgress(0.99, "Datei wird finalisiert");
          const stats = await fs.stat(input.outputPath);
          return {
            outputPath: input.outputPath,
            byteSize: stats.size,
            width: input.width,
            height: input.height,
            fps: input.fps,
            durationMs: Math.round((input.durationInFrames / input.fps) * 1000),
            isDemo: false,
          };
        },
      },
      options,
    );
  }
}
