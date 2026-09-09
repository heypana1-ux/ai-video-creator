import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { jsonRequest, readJson, prepareIsolatedDataDir, waitForJob } from "../helpers/api";

vi.mock("next/headers", () => import("../helpers/next-headers-mock"));

const isolated = prepareIsolatedDataDir();

// Imported after the environment is prepared so the demo store lands in the
// throwaway directory and providers are built in demo mode.
const { resetCookieJar } = await import("../helpers/next-headers-mock");
const { resetRepository } = await import("@/lib/db");
const { resetProviders } = await import("@/lib/ai/registry");
const { resetRateLimits } = await import("@/lib/api/rate-limit");

const registerRoute = await import("@/app/api/auth/register/route");
const loginRoute = await import("@/app/api/auth/login/route");
const sessionRoute = await import("@/app/api/auth/session/route");
const projectsRoute = await import("@/app/api/projects/route");
const projectRoute = await import("@/app/api/projects/[projectId]/route");
const conceptsRoute = await import("@/app/api/projects/[projectId]/concepts/route");
const selectRoute = await import(
  "@/app/api/projects/[projectId]/concepts/[conceptId]/select/route"
);
const conceptRoute = await import("@/app/api/projects/[projectId]/concepts/[conceptId]/route");
const mediaRoute = await import("@/app/api/projects/[projectId]/media/route");
const rendersRoute = await import("@/app/api/projects/[projectId]/renders/route");
const jobRoute = await import("@/app/api/jobs/[jobId]/route");
const estimateRoute = await import("@/app/api/projects/[projectId]/estimate/route");
const creditsRoute = await import("@/app/api/credits/route");

const BASE = "http://localhost:3000";

interface JobBody {
  job: { id: string; status: string; progress: number; step: string; error: string | null };
  export?: { id: string; url: string; width: number; height: number } | null;
}

async function getJob(jobId: string) {
  const response = await jobRoute.GET(new Request(`${BASE}/api/jobs/${jobId}`), {
    params: Promise.resolve({ jobId }),
  });
  const body = await readJson<JobBody>(response);
  return body.job;
}

async function getJobBody(jobId: string): Promise<JobBody> {
  const response = await jobRoute.GET(new Request(`${BASE}/api/jobs/${jobId}`), {
    params: Promise.resolve({ jobId }),
  });
  return readJson<JobBody>(response);
}

const musicBrief = {
  category: "music",
  name: "Midnight Drive – Release",
  description: "Neue Synthwave-Single über nächtliche Autofahrten in der Großstadt.",
  audience: "Synthwave-Hörer zwischen 18 und 34",
  goal: "Streams am Release-Tag",
  platform: "tiktok",
  language: "de",
  tone: "emotional",
  durationSeconds: 15,
  callToAction: "Jetzt überall streamen",
  targetUrl: "",
  logoAssetId: null,
  brandColors: [],
  mediaAssetIds: [],
  styleId: "music_visualizer",
  extraPrompt: "",
  details: {
    artistName: "NOVA",
    songTitle: "Midnight Drive",
    genre: "Synthwave",
    mood: "melancholisch",
    releaseDate: "14. März",
    streamingUrl: "",
    audioAssetId: null,
    coverAssetId: null,
    lyricsExcerpt: "Ich fahr durch die Nacht",
    songSectionStart: 0,
    songSectionEnd: 30,
    rightsConfirmed: true,
  },
};

describe("demo workflow (music promo)", () => {
  let projectId = "";
  let conceptId = "";

  beforeAll(() => {
    resetCookieJar();
    resetRepository();
    resetProviders();
    resetRateLimits();
  });

  afterAll(async () => {
    await isolated.cleanup();
  });

  it("rejects anonymous access to projects", async () => {
    const response = await projectsRoute.GET();
    expect(response.status).toBe(401);
  });

  it("registers a user and starts a session", async () => {
    const response = await registerRoute.POST(
      jsonRequest(`${BASE}/api/auth/register`, "POST", {
        email: "artist@example.com",
        password: "supersicher123",
        displayName: "NOVA",
      }),
    );
    expect(response.status).toBe(200);

    const session = await readJson<{ user: { email: string } | null; workspace: { credits: number } | null }>(
      await sessionRoute.GET(),
    );
    expect(session.user?.email).toBe("artist@example.com");
    expect(session.workspace?.credits).toBeGreaterThan(0);
  });

  it("rejects a wrong password without leaking whether the account exists", async () => {
    const response = await loginRoute.POST(
      jsonRequest(`${BASE}/api/auth/login`, "POST", {
        email: "artist@example.com",
        password: "falsch",
      }),
    );
    expect(response.status).toBe(401);
    const body = await readJson<{ error: { message: string } }>(response);
    expect(body.error.message).toBe("E-Mail oder Passwort ist falsch.");

    const unknown = await loginRoute.POST(
      jsonRequest(`${BASE}/api/auth/login`, "POST", {
        email: "niemand@example.com",
        password: "falsch",
      }),
    );
    const unknownBody = await readJson<{ error: { message: string } }>(unknown);
    expect(unknownBody.error.message).toBe(body.error.message);
  });

  it("rejects an invalid brief with field level errors", async () => {
    const response = await projectsRoute.POST(
      jsonRequest(`${BASE}/api/projects`, "POST", {
        brief: { ...musicBrief, details: { ...musicBrief.details, rightsConfirmed: false } },
        brandKitId: null,
      }),
    );
    expect(response.status).toBe(400);
    const body = await readJson<{ error: { details: Array<{ path: string }> } }>(response);
    expect(body.error.details.some((issue) => issue.path.includes("rightsConfirmed"))).toBe(true);
  });

  it("creates a music project", async () => {
    const response = await projectsRoute.POST(
      jsonRequest(`${BASE}/api/projects`, "POST", { brief: musicBrief, brandKitId: null }),
    );
    expect(response.status).toBe(200);
    const body = await readJson<{ project: { id: string; category: string; status: string } }>(
      response,
    );
    projectId = body.project.id;
    expect(body.project.category).toBe("music");
    expect(body.project.status).toBe("draft");
  });

  it("shows the credit estimate before generating", async () => {
    const response = await estimateRoute.GET(
      new Request(`${BASE}/api/projects/${projectId}/estimate?operation=concepts`),
      { params: Promise.resolve({ projectId }) },
    );
    const body = await readJson<{ estimate: { total: number }; balance: number }>(response);
    expect(body.estimate.total).toBeGreaterThan(0);
    expect(body.balance).toBeGreaterThan(body.estimate.total);
  });

  it("generates three tailored concepts", async () => {
    const start = await conceptsRoute.POST(
      jsonRequest(`${BASE}/api/projects/${projectId}/concepts`, "POST", {}),
      { params: Promise.resolve({ projectId }) },
    );
    const { job } = await readJson<JobBody>(start);
    const finished = await waitForJob(getJob, job.id);
    expect(finished.status).toBe("succeeded");

    const listed = await conceptsRoute.GET(new Request(`${BASE}/x`), {
      params: Promise.resolve({ projectId }),
    });
    const body = await readJson<{
      concepts: Array<{
        id: string;
        title: string;
        hook: string;
        scenes: Array<{ durationMs: number }>;
      }>;
    }>(listed);

    expect(body.concepts).toHaveLength(3);
    conceptId = body.concepts[0].id;

    for (const concept of body.concepts) {
      expect(concept.hook.length).toBeGreaterThan(0);
      const total = concept.scenes.reduce((sum, scene) => sum + scene.durationMs, 0);
      expect(total).toBe(15_000);
    }
    // Concepts must reference the user's actual input.
    expect(JSON.stringify(body.concepts)).toContain("Midnight Drive");
  });

  it("charges credits for the generation", async () => {
    const body = await readJson<{
      balance: number;
      transactions: Array<{ amount: number; reason: string }>;
    }>(await creditsRoute.GET());
    expect(body.transactions.some((entry) => entry.amount < 0)).toBe(true);
    expect(body.balance).toBeLessThan(500);
  });

  it("selects a concept and records it on the project", async () => {
    const response = await selectRoute.POST(new Request(`${BASE}/x`), {
      params: Promise.resolve({ projectId, conceptId }),
    });
    expect(response.status).toBe(200);

    const project = await readJson<{ project: { selectedConceptId: string } }>(
      await projectRoute.GET(new Request(`${BASE}/x`), {
        params: Promise.resolve({ projectId }),
      }),
    );
    expect(project.project.selectedConceptId).toBe(conceptId);
  });

  it("generates media, voice-over and music for every scene", async () => {
    const start = await mediaRoute.POST(
      jsonRequest(`${BASE}/api/projects/${projectId}/media`, "POST", { conceptId }),
      { params: Promise.resolve({ projectId }) },
    );
    const { job } = await readJson<JobBody>(start);
    const finished = await waitForJob(getJob, job.id);
    expect(finished.status).toBe("succeeded");

    const body = await readJson<{
      concept: {
        musicUrl: string | null;
        scenes: Array<{
          source: { url: string | null; isDemo: boolean };
          voiceoverText: string;
          voiceoverUrl: string | null;
          voiceoverWords: Array<{ word: string }>;
        }>;
      };
    }>(
      await conceptRoute.GET(new Request(`${BASE}/x`), {
        params: Promise.resolve({ projectId, conceptId }),
      }),
    );

    expect(body.concept.musicUrl).toMatch(/^\/api\/media\//);
    for (const scene of body.concept.scenes) {
      expect(scene.source.url).toMatch(/^\/api\/media\//);
      expect(scene.source.isDemo).toBe(true);
      if (scene.voiceoverText.trim()) {
        expect(scene.voiceoverUrl).toMatch(/^\/api\/media\//);
        expect(scene.voiceoverWords.length).toBeGreaterThan(0);
      }
    }
  });

  it("renders an export and marks the project as ready", async () => {
    const start = await rendersRoute.POST(
      jsonRequest(`${BASE}/api/projects/${projectId}/renders`, "POST", {
        conceptId,
        quality: "final",
      }),
      { params: Promise.resolve({ projectId }) },
    );
    const { job } = await readJson<JobBody>(start);
    const finished = await waitForJob(getJob, job.id);
    expect(finished.status).toBe("succeeded");

    const body = await getJobBody(job.id);
    expect(body.export).toBeTruthy();
    expect(body.export?.width).toBe(1080);
    expect(body.export?.height).toBe(1920);

    const project = await readJson<{ project: { status: string } }>(
      await projectRoute.GET(new Request(`${BASE}/x`), {
        params: Promise.resolve({ projectId }),
      }),
    );
    expect(project.project.status).toBe("ready");
  });

  it("refunds credits when a render is cancelled", async () => {
    const before = await readJson<{ balance: number }>(await creditsRoute.GET());

    const start = await rendersRoute.POST(
      jsonRequest(`${BASE}/api/projects/${projectId}/renders`, "POST", {
        conceptId,
        quality: "preview",
      }),
      { params: Promise.resolve({ projectId }) },
    );
    const { job } = await readJson<JobBody>(start);

    const cancelRoute = await import("@/app/api/jobs/[jobId]/cancel/route");
    await cancelRoute.POST(new Request(`${BASE}/x`), {
      params: Promise.resolve({ jobId: job.id }),
    });

    const finished = await waitForJob(getJob, job.id);
    expect(["cancelled", "succeeded"]).toContain(finished.status);

    if (finished.status === "cancelled") {
      const after = await readJson<{ balance: number }>(await creditsRoute.GET());
      expect(after.balance).toBe(before.balance);
    }
  });

  it("deletes the project and everything attached to it", async () => {
    const response = await projectRoute.DELETE(new Request(`${BASE}/x`), {
      params: Promise.resolve({ projectId }),
    });
    expect(response.status).toBe(200);

    const missing = await projectRoute.GET(new Request(`${BASE}/x`), {
      params: Promise.resolve({ projectId }),
    });
    expect(missing.status).toBe(404);
  });
});
