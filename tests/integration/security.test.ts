import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { jsonRequest, readJson, prepareIsolatedDataDir } from "../helpers/api";

vi.mock("next/headers", () => import("../helpers/next-headers-mock"));

const isolated = prepareIsolatedDataDir();

const { resetCookieJar } = await import("../helpers/next-headers-mock");
const { resetRepository } = await import("@/lib/db");
const { resetProviders } = await import("@/lib/ai/registry");
const { resetRateLimits } = await import("@/lib/api/rate-limit");

const registerRoute = await import("@/app/api/auth/register/route");
const logoutRoute = await import("@/app/api/auth/logout/route");
const projectsRoute = await import("@/app/api/projects/route");
const projectRoute = await import("@/app/api/projects/[projectId]/route");
const mediaFileRoute = await import("@/app/api/media/[...key]/route");
const importRoute = await import("@/app/api/website-import/route");
const assetsRoute = await import("@/app/api/assets/route");

const BASE = "http://localhost:3000";

const simpleBrief = {
  category: "custom",
  name: "Geheimprojekt",
  description: "Ein Projekt, das nur seinem Workspace gehören darf.",
  audience: "",
  goal: "",
  platform: "tiktok",
  language: "de",
  tone: "professional",
  durationSeconds: 15,
  callToAction: "",
  targetUrl: "",
  logoAssetId: null,
  brandColors: [],
  mediaAssetIds: [],
  styleId: "viral_ugc",
  extraPrompt: "",
  details: { offerName: "Geheim", highlights: [], proofPoints: [] },
};

async function registerAs(email: string) {
  resetCookieJar();
  const response = await registerRoute.POST(
    jsonRequest(`${BASE}/api/auth/register`, "POST", {
      email,
      password: "supersicher123",
      displayName: email.split("@")[0],
    }),
  );
  expect(response.status).toBe(200);
}

describe("access control", () => {
  let victimProjectId = "";

  beforeAll(async () => {
    resetRepository();
    resetProviders();
    resetRateLimits();

    await registerAs("victim@example.com");
    const created = await projectsRoute.POST(
      jsonRequest(`${BASE}/api/projects`, "POST", { brief: simpleBrief, brandKitId: null }),
    );
    const body = await readJson<{ project: { id: string } }>(created);
    victimProjectId = body.project.id;

    await logoutRoute.POST();
    await registerAs("attacker@example.com");
  });

  afterAll(async () => {
    await isolated.cleanup();
  });

  it("hides another workspace's project", async () => {
    const response = await projectRoute.GET(new Request(`${BASE}/x`), {
      params: Promise.resolve({ projectId: victimProjectId }),
    });
    expect(response.status).toBe(404);
  });

  it("refuses to delete another workspace's project", async () => {
    const response = await projectRoute.DELETE(new Request(`${BASE}/x`), {
      params: Promise.resolve({ projectId: victimProjectId }),
    });
    expect(response.status).toBe(404);
  });

  it("does not list another workspace's projects", async () => {
    const body = await readJson<{ projects: Array<{ id: string }> }>(
      await projectsRoute.GET(),
    );
    expect(body.projects.some((project) => project.id === victimProjectId)).toBe(false);
  });
});

describe("media route", () => {
  beforeAll(async () => {
    resetRepository();
    resetProviders();
    resetRateLimits();
    await registerAs("media@example.com");
  });

  it("rejects path traversal", async () => {
    const response = await mediaFileRoute.GET(new Request(`${BASE}/api/media/x`), {
      params: Promise.resolve({ key: ["..", "..", "package.json"] }),
    });
    expect(response.status).toBe(400);
  });

  it("rejects encoded traversal", async () => {
    const response = await mediaFileRoute.GET(new Request(`${BASE}/api/media/x`), {
      params: Promise.resolve({ key: ["%2e%2e", "package.json"] }),
    });
    expect(response.status).toBe(400);
  });

  it("returns 404 for a missing file", async () => {
    const response = await mediaFileRoute.GET(new Request(`${BASE}/api/media/x`), {
      params: Promise.resolve({ key: ["demo", "nope.svg"] }),
    });
    expect(response.status).toBe(404);
  });

  it("requires a session", async () => {
    resetCookieJar();
    const response = await mediaFileRoute.GET(new Request(`${BASE}/api/media/x`), {
      params: Promise.resolve({ key: ["demo", "nope.svg"] }),
    });
    expect(response.status).toBe(401);
  });
});

describe("website import", () => {
  beforeAll(async () => {
    resetRepository();
    resetProviders();
    resetRateLimits();
    await registerAs("importer@example.com");
  });

  it.each([
    "http://localhost:3000/admin",
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "file:///etc/passwd",
    "http://metadata.google.internal/",
    "http://example.com:2375/containers/json",
  ])("blocks %s", async (url) => {
    const response = await importRoute.POST(
      jsonRequest(`${BASE}/api/website-import`, "POST", { url }),
    );
    expect(response.status).toBe(400);
  });
});

describe("uploads", () => {
  beforeAll(async () => {
    resetRepository();
    resetProviders();
    resetRateLimits();
    await registerAs("uploader@example.com");
  });

  it("rejects a disallowed file type", async () => {
    const form = new FormData();
    form.set("file", new File(["#!/bin/sh\necho hi"], "script.sh", { type: "application/x-sh" }));
    form.set("kind", "image");

    const response = await assetsRoute.POST(
      new Request(`${BASE}/api/assets`, { method: "POST", body: form }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a mismatched extension", async () => {
    const form = new FormData();
    form.set("file", new File(["fake"], "evil.php", { type: "image/png" }));
    form.set("kind", "image");

    const response = await assetsRoute.POST(
      new Request(`${BASE}/api/assets`, { method: "POST", body: form }),
    );
    expect(response.status).toBe(400);
  });

  it("stores a valid image under the workspace prefix", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array([137, 80, 78, 71])], "cover.png", { type: "image/png" }));
    form.set("kind", "cover");

    const response = await assetsRoute.POST(
      new Request(`${BASE}/api/assets`, { method: "POST", body: form }),
    );
    expect(response.status).toBe(200);

    const body = await readJson<{ asset: { storageKey: string; url: string; kind: string } }>(
      response,
    );
    expect(body.asset.kind).toBe("cover");
    expect(body.asset.storageKey).toMatch(/\/uploads\/.*cover\.png$/);
    expect(body.asset.url.startsWith("/api/media/")).toBe(true);
  });
});
