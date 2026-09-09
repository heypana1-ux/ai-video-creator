import { promises as fs } from "node:fs";
import path from "node:path";

import { executeProviderCall } from "../execute";
import type {
  ProviderCallOptions,
  ProviderResult,
  ProviderStatus,
  RenderInput,
  RenderOutput,
  VideoRenderProvider,
} from "../types";
import { mockLatencyMs, simulateWork } from "./mock-support";

/**
 * Test-only render provider.
 *
 * It writes a small placeholder file so integration tests can exercise the full
 * render-job lifecycle in milliseconds instead of spinning up a browser. The
 * file is NOT a playable video - enable it with `ADREEL_RENDER_PROVIDER=mock`
 * only in automated tests. The default provider is Remotion, which produces a
 * real MP4 without needing any API key.
 */
export class MockRenderProvider implements VideoRenderProvider {
  readonly id = "mock-render";
  readonly kind = "render" as const;
  readonly isDemo = true;

  async status(): Promise<ProviderStatus> {
    return {
      id: this.id,
      kind: this.kind,
      available: true,
      isDemo: true,
      detail: "Platzhalter-Renderer für automatisierte Tests (kein abspielbares Video).",
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
        isDemo: true,
        cost: { estimatedUsd: 0, credits: 0 },
        maxRetries: 0,
        attempt: async ({ signal, onProgress }) => {
          await simulateWork(mockLatencyMs(600), signal, onProgress, [
            "Komposition wird gebaut",
            "Frames werden gerendert",
            "Audio wird gemischt",
            "Datei wird finalisiert",
          ]);

          await fs.mkdir(path.dirname(input.outputPath), { recursive: true });
          const payload = JSON.stringify(
            { placeholder: true, width: input.width, height: input.height, fps: input.fps },
            null,
            2,
          );
          await fs.writeFile(input.outputPath, payload);

          return {
            outputPath: input.outputPath,
            byteSize: Buffer.byteLength(payload),
            width: input.width,
            height: input.height,
            fps: input.fps,
            durationMs: Math.round((input.durationInFrames / input.fps) * 1000),
            isDemo: true,
          };
        },
      },
      options,
    );
  }
}
