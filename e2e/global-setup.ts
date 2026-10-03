import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));

// Applies pending schema migrations (the single source of truth lives in
// ../notrecinema-schema) to whatever Postgres MIGRATE_DATABASE_URL -- or
// POSTGRES_USER/PASSWORD/DB -- points at, before the stack starts. Postgres
// and NATS themselves are not provisioned here: bring them up first (docker
// compose up -d postgres nats, or throwaway containers).
export default async function globalSetup() {
  execFileSync(
    'node',
    [path.join(here, '..', '..', 'notrecinema-schema', 'migrate.mjs')],
    { stdio: 'inherit' },
  );

  // Every test registers and signs in from the same address, and the
  // limits are stored in the database: without a reset, a second run within
  // the 15-minute window would be throttled.
  const connectionString = process.env.MIGRATE_DATABASE_URL;
  if (!connectionString) return;

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('TRUNCATE public.rate_limit_buckets');
  } finally {
    await client.end();
  }
}
