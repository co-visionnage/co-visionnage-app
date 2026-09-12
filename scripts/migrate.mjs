import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const rootDirectory = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDirectory = join(rootDirectory, 'database', 'migrations');
const grantsPath = join(rootDirectory, 'database', 'grants.sql');

// Minimal .env loader for local/manual runs (docker-compose sets these
// directly in the environment, so this is a no-op there) -- avoids adding
// a dotenv dependency just for this one script.
function loadDotEnvIfPresent() {
  const envPath = join(rootDirectory, '.env');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

loadDotEnvIfPresent();

function resolveConnectionString() {
  if (process.env.MIGRATE_DATABASE_URL) {
    return process.env.MIGRATE_DATABASE_URL;
  }

  const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, DB_HOST, DB_PORT } =
    process.env;

  if (POSTGRES_USER && POSTGRES_PASSWORD && POSTGRES_DB) {
    const host = DB_HOST || 'localhost';
    const port = DB_PORT || '5432';
    return `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${host}:${port}/${POSTGRES_DB}`;
  }

  throw new Error(
    'No migration connection available: set MIGRATE_DATABASE_URL, or ' +
      'POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB (the same superuser ' +
      'credentials database/init.sh uses to create app_user). ' +
      'DATABASE_URL is intentionally not used here -- it connects as ' +
      'app_user, which owns none of the schema and cannot run DDL.',
  );
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query(
    'SELECT filename FROM public.schema_migrations',
  );
  return new Set(result.rows.map((row) => row.filename));
}

async function applyMigration(client, filename, sql) {
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(
      'INSERT INTO public.schema_migrations (filename) VALUES ($1)',
      [filename],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Migration ${filename} failed: ${error.message}`, {
      cause: error,
    });
  }
}

async function main() {
  const client = new pg.Client({ connectionString: resolveConnectionString() });
  await client.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    const filenames = readdirSync(migrationsDirectory)
      .filter((name) => name.endsWith('.sql'))
      .sort();

    let appliedCount = 0;
    for (const filename of filenames) {
      if (applied.has(filename)) continue;

      const sql = readFileSync(join(migrationsDirectory, filename), 'utf8');
      console.log(`Applying ${filename} ...`);
      await applyMigration(client, filename, sql);
      appliedCount += 1;
    }

    if (appliedCount === 0) {
      console.log('No pending migrations.');
    } else {
      console.log(`Applied ${appliedCount} migration(s).`);
    }

    // Grants aren't a migration -- they must always be reapplied so that
    // privileges cover tables/functions any migration just created, and
    // ALTER DEFAULT PRIVILEGES only affects objects created after it runs.
    console.log('Reapplying database/grants.sql ...');
    await client.query(readFileSync(grantsPath, 'utf8'));

    console.log('Done.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
