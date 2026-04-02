import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "bun src/index.ts",
      cwd: "server",
      port: 3001,
      env: {
        NODE_ENV: "test",
        PORT: "3001",
        DATABASE_URL: "postgresql://helpdesk:helpdesk@localhost:5432/helpdesk_test",
        BETTER_AUTH_SECRET: "test-secret-min-32-chars-for-playwright",
        BETTER_AUTH_URL: "http://localhost:3001",
        TRUSTED_ORIGINS: "http://localhost:5173",
        ADMIN_EMAIL: "admin@test.com",
        ADMIN_PASSWORD: "testpassword123",
      },
      reuseExistingServer: false,
    },
    {
      command: "bun run dev",
      cwd: "client",
      port: 5173,
      env: { API_URL: "http://localhost:3001" },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
