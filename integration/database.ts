import { createHash } from 'node:crypto';

import pg from 'pg';

// Mirrors src/shared/api/postgres/database.ts's own withUserContext, using
// the app's own DATABASE_URL (app_user, RLS-enforced) rather than a
// superuser connection -- these tests exist specifically to exercise RLS
// policies as the real app connects, not to bypass them.
function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set -- integration tests need a real Postgres ' +
        'with migrations applied. See README.md.',
    );
  }
  return url;
}

// Test fixtures (profiles, families, series...) are seeded with a
// superuser/migration-role connection, same as scripts/migrate.mjs: real
// rows for those only ever come from SECURITY DEFINER functions
// (register_profile_account, create_two_factor_challenge, ...), not direct
// table inserts, so app_user's own RLS insert policies would reject a raw
// INSERT here. The behavior under test always runs against `pool`
// (app_user, RLS-enforced) below.
function resolveAdminConnectionString(): string {
  if (process.env.MIGRATE_DATABASE_URL) return process.env.MIGRATE_DATABASE_URL;

  const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, DB_HOST, DB_PORT } =
    process.env;
  if (POSTGRES_USER && POSTGRES_PASSWORD && POSTGRES_DB) {
    const host = DB_HOST || 'localhost';
    const port = DB_PORT || '5432';
    return `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${host}:${port}/${POSTGRES_DB}`;
  }

  throw new Error(
    'MIGRATE_DATABASE_URL (or POSTGRES_USER/PASSWORD/DB) is not set -- ' +
      'integration test fixtures are seeded with a superuser connection, ' +
      'same as scripts/migrate.mjs. See README.md.',
  );
}

export const pool = new pg.Pool({ connectionString: requireDatabaseUrl() });
// Exported for tests that need to seed fixtures beyond the helpers below
// (e.g. poll/option rows) -- always for seeding only, never for the
// behavior under test.
export const adminPool = new pg.Pool({
  connectionString: resolveAdminConnectionString(),
});

export async function closePools(): Promise<void> {
  await Promise.all([pool.end(), adminPool.end()]);
}

export async function withUserContext<T>(
  userId: string,
  callback: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [
      userId,
    ]);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

let seedCounter = 0;

// A short, per-process-unique suffix so parallel test files (or repeat runs
// against a persistent dev database) don't collide on unique columns like
// profiles.email or families.invite_code.
export function uniqueSuffix(): string {
  seedCounter += 1;
  return `${process.pid}-${Date.now()}-${seedCounter}`;
}

type SeededProfile = { id: string };

export async function seedProfile(displayName: string): Promise<SeededProfile> {
  const suffix = uniqueSuffix();
  const result = await adminPool.query<{ id: string }>(
    `
      INSERT INTO public.profiles (email, display_name, password_hash)
      VALUES ($1, $2, 'unused-in-tests')
      RETURNING id
    `,
    [`${suffix}@example.com`, displayName],
  );
  return { id: result.rows[0].id };
}

type SeededFamily = { id: string; inviteCode: string };

export async function seedFamily(
  ownerId: string,
  name: string,
): Promise<SeededFamily> {
  const suffix = uniqueSuffix();
  const inviteCode = `T${suffix}`.slice(0, 20).toUpperCase();

  const result = await adminPool.query<{ id: string }>(
    `
      INSERT INTO public.families (name, owner_id, invite_code)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [name, ownerId, inviteCode],
  );
  const familyId = result.rows[0].id;

  await adminPool.query(
    `
      INSERT INTO public.family_members (family_id, user_id, role)
      VALUES ($1, $2, 'owner')
    `,
    [familyId, ownerId],
  );

  return { id: familyId, inviteCode };
}

export async function addFamilyMember(
  familyId: string,
  userId: string,
  role: 'owner' | 'member' = 'member',
): Promise<void> {
  await adminPool.query(
    `
      INSERT INTO public.family_members (family_id, user_id, role)
      VALUES ($1, $2, $3)
    `,
    [familyId, userId, role],
  );
}

export async function seedSeries(
  familyId: string,
  createdBy: string,
  title: string,
): Promise<{ id: string }> {
  const result = await adminPool.query<{ id: string }>(
    `
      INSERT INTO public.family_series (
        family_id, title, genres, year, created_by, media_type
      )
      VALUES ($1, $2, ARRAY[]::text[], 2020, $3, 'series')
      RETURNING id
    `,
    [familyId, title, createdBy],
  );
  return { id: result.rows[0].id };
}
