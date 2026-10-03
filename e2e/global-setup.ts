import pg from 'pg';

// Runs after the web servers are up. The schema migrations are NOT applied
// here: the API needs them to start, so they run as the first part of its
// start command (see playwright.config.ts). Postgres and NATS themselves are
// not provisioned either: bring them up first (docker compose up -d
// postgres nats, or throwaway containers).
export default async function globalSetup() {
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
