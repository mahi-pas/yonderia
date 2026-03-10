import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  webServer: {
    command: "npm run dev",
    reuseExistingServer: true,
    timeout: 120_000,
    url: "http://localhost:3000",
  },
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    viewport: {
      width: 375,
      height: 812,
    },
  },
  projects: [
    {
      name: "mobile",
      use: {
        viewport: {
          width: 375,
          height: 812,
        },
      },
    },
    {
      name: "desktop",
      use: {
        viewport: {
          width: 1280,
          height: 720,
        },
      },
    },
  ],
});
