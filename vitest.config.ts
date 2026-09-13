import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    // jsdom defaults to the opaque "about:blank" origin, where localStorage
    // throws a SecurityError -- readUiPreferences/writeUiPreferences need a
    // real origin to work in tests the same way they do in a browser tab.
    environmentOptions: {
      jsdom: { url: 'http://localhost/' },
    },
    // Node 22+'s own experimental global `localStorage` shadows jsdom's
    // per-window implementation, leaving `window.localStorage` undefined in
    // the test worker. Disabling it on the worker process (not the parent
    // vitest process, so this works regardless of how `vitest` itself was
    // invoked) restores jsdom's normal behavior.
    poolOptions: {
      forks: { execArgv: ['--no-experimental-webstorage'] },
      threads: { execArgv: ['--no-experimental-webstorage'] },
    },
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**'],
  },
});
