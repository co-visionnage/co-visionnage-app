import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT ?? '3399';
const baseURL = `http://localhost:${PORT}`;

// e2e tests need a real Postgres reachable via DATABASE_URL/MIGRATE_DATABASE_URL
// (same variables `pnpm migrate` and the app itself use -- see .env.example).
// They do not spin up Postgres themselves: bring one up first (e.g. `docker
// compose up -d postgres`, or a throwaway `postgres:16-alpine` container) and
// point a `.env.test` at it. globalSetup below only applies migrations.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
