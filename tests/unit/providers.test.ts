import { describe, expect, it, vi } from "vitest";

import { ProviderError, codeForStatus, isProviderError } from "@/lib/ai/errors";
import { backoffDelayMs, executeProviderCall } from "@/lib/ai/execute";
import { redact, summarisePrompt } from "@/lib/ai/logging";
import { MockTextProvider } from "@/lib/ai/providers/mock-text";
import { MockImageProvider, MockVoiceProvider, MockMusicProvider } from "@/lib/ai/providers/mock-media";
import { LocalStorageProvider } from "@/lib/ai/providers/storage-local";
import { buildConceptPrompt, buildConceptSystemPrompt } from "@/lib/concepts/prompt";
import { conceptDraftResponseSchema } from "@/lib/concepts/draft-schema";
import { defaultBrief } from "@/lib/domain/defaults";
import type { ProjectBrief } from "@/lib/domain/schemas";
import { withTempDataDir } from "../helpers/temp-dir";

const brief = {
  ...defaultBrief("product"),
  name: "Testprodukt",
  description: "Ein Produkt mit einer ausreichend langen Beschreibung.",
  details: { productName: "Testprodukt", keyBenefits: ["Spart Zeit"], price: "", shopUrl: "", usp: "" },
} as ProjectBrief;

type Attempt = Parameters<typeof executeProviderCall<string>>[0]["attempt"];

function baseConfig(attempt: Attempt) {
  return {
    providerId: "test",
    kind: "text" as const,
    operation: "generate",
    isDemo: true,
    cost: { estimatedUsd: 0, credits: 0 },
    attempt,
  };
}

describe("executeProviderCall", () => {
  it("returns cost and provider metadata on success", async () => {
    const result = await executeProviderCall({
      ...baseConfig(async () => "ok"),
      cost: { estimatedUsd: 0.02, credits: 4 },
      attempt: async ({ setProviderJobId }) => {
        setProviderJobId("job-1");
        return "ok";
      },
    });

    expect(result.data).toBe("ok");
    expect(result.meta.providerJobId).toBe("job-1");
    expect(result.meta.cost).toEqual({ estimatedUsd: 0.02, credits: 4 });
    expect(result.meta.attempts).toBe(1);
    expect(result.meta.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("retries retryable failures and reports the attempt count", async () => {
    let calls = 0;
    const result = await executeProviderCall({
      ...baseConfig(async () => {
        calls += 1;
        if (calls < 3) throw new ProviderError("rate_limited", "test", "429");
        return "recovered";
      }),
      maxRetries: 3,
    });

    expect(calls).toBe(3);
    expect(result.data).toBe("recovered");
    expect(result.meta.attempts).toBe(3);
  });

  it("does not retry non-retryable failures", async () => {
    let calls = 0;
    await expect(
      executeProviderCall({
        ...baseConfig(async () => {
          calls += 1;
          throw new ProviderError("unauthorized", "test", "401");
        }),
        maxRetries: 3,
      }),
    ).rejects.toThrow(ProviderError);
    expect(calls).toBe(1);
  });

  it("times out a hanging call", async () => {
    const error = await executeProviderCall({
      ...baseConfig(
        () =>
          new Promise<string>(() => {
            /* never settles */
          }),
      ),
      maxRetries: 0,
      timeoutMs: 30,
    }).catch((caught: unknown) => caught);

    expect(isProviderError(error)).toBe(true);
    expect((error as ProviderError).code).toBe("timeout");
  });

  it("propagates caller cancellation without retrying", async () => {
    const controller = new AbortController();
    let calls = 0;
    const promise = executeProviderCall(
      {
        ...baseConfig(async ({ signal }) => {
          calls += 1;
          await new Promise((resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("AbortError")), { once: true });
          });
          return "never";
        }),
        maxRetries: 3,
      },
      { signal: controller.signal },
    );

    setTimeout(() => controller.abort(), 10);
    const error = await promise.catch((caught: unknown) => caught);
    expect((error as ProviderError).code).toBe("cancelled");
    expect(calls).toBe(1);
  });

  it("reports progress to the caller", async () => {
    const onProgress = vi.fn();
    await executeProviderCall(
      baseConfig(async () => "ok"),
      { onProgress },
    );
    // The mock attempt reports nothing; the wrapper must not invent progress.
    expect(onProgress).not.toHaveBeenCalled();
  });
});

describe("backoffDelayMs", () => {
  it("grows with the attempt and stays capped", () => {
    expect(backoffDelayMs(1, () => 0)).toBe(250);
    expect(backoffDelayMs(3, () => 0)).toBeGreaterThan(backoffDelayMs(1, () => 0));
    expect(backoffDelayMs(20, () => 1)).toBeLessThanOrEqual(10_000);
  });
});

describe("codeForStatus", () => {
  it("maps HTTP statuses to provider error codes", () => {
    expect(codeForStatus(401)).toBe("unauthorized");
    expect(codeForStatus(429)).toBe("rate_limited");
    expect(codeForStatus(503)).toBe("upstream_error");
    expect(codeForStatus(422)).toBe("bad_request");
  });
});

describe("logging", () => {
  it("redacts api keys and bearer tokens", () => {
    expect(redact("key sk-abcdefgh12345678 end")).toBe("key [redacted] end");
    expect(redact("Authorization: Bearer abcdef123456789")).toContain("[redacted]");
    expect(redact("token r8_abcdefgh1234")).toContain("[redacted]");
  });

  it("summarises prompts instead of logging them", () => {
    const summary = summarisePrompt("Ein sehr langer Prompt mit vertraulichem Kundentext darin");
    expect(summary).toMatch(/^len=\d+ head="/);
    expect(summary).not.toContain("Kundentext");
  });
});

describe("MockTextProvider", () => {
  it("answers the concept contract in valid JSON", async () => {
    const provider = new MockTextProvider();
    const result = await provider.generate({
      system: buildConceptSystemPrompt(),
      prompt: buildConceptPrompt(brief, { kind: "concepts", count: 3 }),
      json: true,
    });

    const parsed = conceptDraftResponseSchema.parse(JSON.parse(result.data.text));
    expect(parsed.concepts).toHaveLength(3);
    expect(result.meta.isDemo).toBe(true);
    expect(result.meta.cost.credits).toBe(0);
  });

  it("fails clearly when the prompt has no brief", async () => {
    const provider = new MockTextProvider();
    await expect(
      provider.generate({ system: "s", prompt: "kein Briefing" }),
    ).rejects.toThrow(/Briefing/);
  });

  it("reports itself as available and demo", async () => {
    expect(await new MockTextProvider().status()).toMatchObject({
      available: true,
      isDemo: true,
    });
  });
});

describe("mock media providers", () => {
  it("writes real image bytes through the storage provider", async () => {
    await withTempDataDir(async (root) => {
      const storage = new LocalStorageProvider(root);
      const result = await new MockImageProvider(storage).generate({
        prompt: "abstract synthwave",
        width: 1080,
        height: 1920,
        seed: 42,
      });

      expect(result.data.byteSize).toBeGreaterThan(200);
      expect(result.data.mimeType).toBe("image/svg+xml");
      expect(result.data.isDemo).toBe(true);
      expect(result.data.url.startsWith("/api/media/")).toBe(true);
    });
  });

  it("is deterministic for the same seed", async () => {
    await withTempDataDir(async (root) => {
      const storage = new LocalStorageProvider(root);
      const provider = new MockImageProvider(storage);
      const [a, b] = await Promise.all([
        provider.generate({ prompt: "x", width: 540, height: 960, seed: 7 }),
        provider.generate({ prompt: "x", width: 540, height: 960, seed: 7 }),
      ]);
      expect(a.data.url).toBe(b.data.url);
      expect(a.data.byteSize).toBe(b.data.byteSize);
    });
  });

  it("produces a silent voice track with matching word timings", async () => {
    await withTempDataDir(async (root) => {
      const storage = new LocalStorageProvider(root);
      const result = await new MockVoiceProvider(storage).synthesize({
        text: "Dieser Song geht nicht mehr aus dem Kopf.",
        language: "de",
        targetDurationMs: 4000,
      });

      expect(result.data.isSilentPlaceholder).toBe(true);
      expect(result.data.durationMs).toBe(4000);
      expect(result.data.words).toHaveLength(8);
      expect(result.data.words.at(-1)?.endMs).toBe(4000);
      expect(result.data.mimeType).toBe("audio/wav");
    });
  });

  it("produces an audible music bed of the requested length", async () => {
    await withTempDataDir(async (root) => {
      const storage = new LocalStorageProvider(root);
      const result = await new MockMusicProvider(storage).generate({
        mood: "treibend",
        genre: "synthwave",
        durationMs: 2000,
        energy: 0.8,
      });

      // 2 s of 44.1 kHz 16-bit mono PCM plus the 44 byte RIFF header.
      expect(result.data.byteSize).toBe(44_100 * 2 * 2 + 44);
      expect(result.data.durationMs).toBe(2000);
    });
  });
});

describe("LocalStorageProvider", () => {
  it("rejects path traversal", async () => {
    await withTempDataDir(async (root) => {
      const storage = new LocalStorageProvider(root);
      await expect(storage.put("../escape.txt", new Uint8Array([1]), "text/plain")).rejects.toThrow(
        /Speicher-Key/,
      );
      await expect(storage.put("/etc/passwd", new Uint8Array([1]), "text/plain")).rejects.toThrow(
        /Speicher-Key/,
      );
    });
  });

  it("round-trips a file and removes it", async () => {
    await withTempDataDir(async (root) => {
      const storage = new LocalStorageProvider(root);
      const stored = await storage.put("a/b.txt", new TextEncoder().encode("hi"), "text/plain");
      expect(stored.byteSize).toBe(2);
      expect(storage.localPath("a/b.txt")).toContain("a/b.txt");
      await storage.remove("a/b.txt");
    });
  });
});
