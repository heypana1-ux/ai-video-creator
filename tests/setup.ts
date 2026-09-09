import { beforeEach } from "vitest";

/**
 * Every test run uses an isolated data directory and forced demo mode, so tests
 * never touch a developer's local `.adreel` store or contact a real provider.
 */
process.env.ADREEL_FORCE_DEMO = "1";
process.env.ADREEL_MOCK_LATENCY_MS = "0";
process.env.ADREEL_RENDER_PROVIDER = "mock";
process.env.AUTH_SECRET = "test-secret-not-for-production-0123456789";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

beforeEach(() => {
  process.env.ADREEL_FORCE_DEMO = "1";
});
