import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// Separate from vitest.config.ts (pnpm test) on purpose: these tests need a
// real Postgres with migrations applied -- same DATABASE_URL/.env
// convention as `pnpm migrate` and the e2e suite, see README.md. Run with
// `pnpm test:integration`.
export default defineConfig({
  // Needed once a test imports app source (e.g. '@/shared/lib/rateLimit')
  // rather than only test-local helpers from ./database.
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['integration/**/*.test.ts'],
    setupFiles: ['./integration/setup-environment.ts'],
    testTimeout: 15_000,
  },
});
