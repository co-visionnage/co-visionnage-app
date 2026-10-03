import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT ?? '3399';
const API_PORT = process.env.E2E_API_PORT ?? '18080';
const WORKER_HEALTH_PORT = 8081; // fixed in notrecinema-worker/cmd/worker
const MAIL_PORT = process.env.FAKE_RESEND_PORT ?? '18025';

const baseURL = `http://localhost:${PORT}`;
const apiURL = `http://localhost:${API_PORT}`;

// The e2e stack, all of it real except the mail provider:
//   Postgres + NATS  -- started by the developer or CI beforehand;
//                       DATABASE_URL (app_user), MIGRATE_DATABASE_URL
//                       (schema owner) and NATS_URL point at them.
//   fake Resend      -- e2e/support/fake-resend.mjs, collects every letter.
//   Go API + worker  -- ../notrecinema-api, ../notrecinema-worker.
//   Next.js          -- this app, proxying /api/v1 to the Go API.
// The schema migrations run as part of the API's start command: Playwright
// starts the web servers before globalSetup, and the API needs the schema.
const databaseUrl = process.env.DATABASE_URL ?? '';
const natsUrl = process.env.NATS_URL ?? 'nats://localhost:4222';
const sharedSecret = 'e2e-unsubscribe-secret-not-for-production';

const goEnvironment = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  NATS_URL: natsUrl,
  APP_ENV: 'development',
  APP_URL: baseURL,
  UNSUBSCRIBE_SECRET: sharedSecret,
  RESEND_API_KEY: 'e2e-key',
  RESEND_API_URL: `http://localhost:${MAIL_PORT}`,
  MAIL_FROM: 'notrecinema <e2e@example.com>',
};

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
  webServer: [
    {
      command: 'node e2e/support/fake-resend.mjs',
      url: `http://localhost:${MAIL_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      command: 'node ../notrecinema-schema/migrate.mjs && go run ./cmd/api',
      cwd: '../notrecinema-api',
      stdout: 'pipe',
      url: `${apiURL}/healthz`,
      env: { ...goEnvironment, PORT: API_PORT },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'go run ./cmd/worker',
      cwd: '../notrecinema-worker',
      stdout: 'pipe',
      url: `http://localhost:${WORKER_HEALTH_PORT}/readyz`,
      env: goEnvironment,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `pnpm exec next dev --webpack -p ${PORT}`,
      url: baseURL,
      env: { ...process.env, API_URL: apiURL } as Record<string, string>,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
