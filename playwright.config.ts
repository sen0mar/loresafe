import { defineConfig, devices } from "@playwright/test";

const webOrigin = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: webOrigin,
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      command: "pnpm --filter @loresafe/api start",
      url: "http://127.0.0.1:3000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000
    },
    {
      command: "pnpm --filter @loresafe/web preview",
      url: webOrigin,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000
    }
  ]
});
