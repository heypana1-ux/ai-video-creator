/**
 * Environment access.
 *
 * Everything here is server-only unless explicitly marked public. No secret is
 * ever read from a module that could end up in the client bundle - the values
 * below are only touched from route handlers, server components and jobs.
 */

function str(name: string, fallback = ""): string {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function num(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function bool(name: string): boolean {
  const value = (process.env[name] ?? "").toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/** Reasoning-effort levels accepted by the current Claude models. */
export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

export const serverEnv = {
  get appUrl(): string {
    return str("NEXT_PUBLIC_APP_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  get authSecret(): string {
    return str("AUTH_SECRET", "adreel-development-secret-change-me");
  },
  get dataDir(): string {
    return str("ADREEL_DATA_DIR", ".adreel");
  },
  get forceDemo(): boolean {
    return bool("ADREEL_FORCE_DEMO");
  },

  get supabaseUrl(): string {
    return str("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey(): string {
    return str("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey(): string {
    return str("SUPABASE_SERVICE_ROLE_KEY");
  },
  get supabaseBucket(): string {
    return str("SUPABASE_STORAGE_BUCKET", "adreel-media");
  },

  get textProvider(): string {
    return str("ADREEL_TEXT_PROVIDER", "mock");
  },
  get imageProvider(): string {
    return str("ADREEL_IMAGE_PROVIDER", "mock");
  },
  get videoProvider(): string {
    return str("ADREEL_VIDEO_PROVIDER", "mock");
  },
  get voiceProvider(): string {
    return str("ADREEL_VOICE_PROVIDER", "mock");
  },
  get musicProvider(): string {
    return str("ADREEL_MUSIC_PROVIDER", "mock");
  },
  get renderProvider(): string {
    return str("ADREEL_RENDER_PROVIDER", "remotion");
  },
  get storageProvider(): string {
    return str("ADREEL_STORAGE_PROVIDER", "local");
  },

  get openaiApiKey(): string {
    return str("OPENAI_API_KEY");
  },
  get openaiBaseUrl(): string {
    return str("OPENAI_BASE_URL", "https://api.openai.com/v1");
  },
  get openaiTextModel(): string {
    return str("OPENAI_TEXT_MODEL", "gpt-4.1-mini");
  },
  get openaiImageModel(): string {
    return str("OPENAI_IMAGE_MODEL", "gpt-image-1");
  },

  get anthropicApiKey(): string {
    return str("ANTHROPIC_API_KEY");
  },
  get anthropicBaseUrl(): string {
    return str("ANTHROPIC_BASE_URL", "https://api.anthropic.com");
  },
  get anthropicTextModel(): string {
    return str("ANTHROPIC_TEXT_MODEL", "claude-opus-5");
  },
  /** Optional reasoning effort. Empty (the default) leaves the model's own. */
  get anthropicEffort(): EffortLevel | null {
    const value = str("ANTHROPIC_EFFORT");
    return EFFORT_LEVELS.includes(value as EffortLevel) ? (value as EffortLevel) : null;
  },

  get replicateApiToken(): string {
    return str("REPLICATE_API_TOKEN");
  },
  get replicateImageModel(): string {
    return str("REPLICATE_IMAGE_MODEL", "black-forest-labs/flux-schnell");
  },
  get replicateVideoModel(): string {
    return str("REPLICATE_VIDEO_MODEL", "minimax/video-01");
  },

  get elevenLabsApiKey(): string {
    return str("ELEVENLABS_API_KEY");
  },
  get elevenLabsVoiceId(): string {
    return str("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM");
  },
  get elevenLabsModel(): string {
    return str("ELEVENLABS_MODEL", "eleven_multilingual_v2");
  },

  get providerTimeoutMs(): number {
    return num("ADREEL_PROVIDER_TIMEOUT_MS", 120_000);
  },
  get providerMaxRetries(): number {
    return num("ADREEL_PROVIDER_MAX_RETRIES", 2);
  },

  get remotionBrowserExecutable(): string {
    return str("REMOTION_BROWSER_EXECUTABLE");
  },
  get remotionConcurrency(): number | null {
    const raw = process.env.REMOTION_CONCURRENCY;
    const parsed = Number(raw);
    return raw && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  },

  get rateLimits() {
    return {
      generationPerMin: num("ADREEL_RATE_LIMIT_GENERATION_PER_MIN", 10),
      uploadPerMin: num("ADREEL_RATE_LIMIT_UPLOAD_PER_MIN", 30),
      authPerMin: num("ADREEL_RATE_LIMIT_AUTH_PER_MIN", 10),
    };
  },
};

/** True when Supabase is fully configured for server side usage. */
export function hasSupabase(): boolean {
  return Boolean(serverEnv.supabaseUrl && serverEnv.supabaseAnonKey);
}

/**
 * Demo mode = no Supabase project configured (or explicitly forced).
 * In demo mode the app uses the local JSON store, cookie auth and mock
 * providers, and never spends real money.
 */
export function isDemoMode(): boolean {
  return serverEnv.forceDemo || !hasSupabase();
}
