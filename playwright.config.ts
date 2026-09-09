import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // Rendering a real video takes a while - the demo workflow test waits for it.
  timeout: 240_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // CI images often already ship a browser. Point at it with
        // PLAYWRIGHT_CHROMIUM_EXECUTABLE to skip `npx playwright install`.
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } }
          : {}),
      },
    },
  ],
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      ADREEL_FORCE_DEMO: "1",
      ADREEL_DATA_DIR: ".adreel/e2e",
      NEXT_PUBLIC_APP_URL: baseURL,
      AUTH_SECRET: "e2e-test-secret-not-for-production-use-0123456789",
      // Mock providers answer instantly; the render at the end stays real.
      ADREEL_MOCK_LATENCY_MS: "0",
      // Reuse an already installed Chrome instead of downloading one.
      REMOTION_BROWSER_EXECUTABLE: process.env.REMOTION_BROWSER_EXECUTABLE ?? "",
    },
  },
});
