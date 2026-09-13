import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Applies pending migrations to whatever Postgres MIGRATE_DATABASE_URL (or
// POSTGRES_USER/PASSWORD/DB) points at before the e2e suite runs, exactly
// like `pnpm migrate` -- see scripts/migrate.mjs and .env.example. Doesn't
// provision Postgres itself; that's the developer's job (docker compose up
// -d postgres, or a throwaway container) via a .env the script's own
// dotenv loader will pick up.
export default function globalSetup() {
  execFileSync('node', [path.join(here, '..', 'scripts', 'migrate.mjs')], {
    stdio: 'inherit',
  });
}
