import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: { baseURL: "http://localhost:3100", ...devices["Desktop Chrome"] },
  webServer: {
    command: "npm run dev -- --port 3100 --strictPort",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
