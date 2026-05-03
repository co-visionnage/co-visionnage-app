import type { PoolClient, QueryResult, QueryResultRow } from 'pg';

import { Pool } from 'pg';

import { ENV } from '@/shared/config/environment';

const connectionString =
  ENV.DATABASE_URL ??
  `postgresql://${ENV.DB_USER}:${ENV.DB_PASSWORD}@${ENV.DB_HOST}:${ENV.DB_PORT}/${ENV.DB_NAME}`;

const globalForDatabase = globalThis as typeof globalThis & {
  __coVisionnagePool?: Pool;
};

const pool =
  globalForDatabase.__coVisionnagePool ??
  new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDatabase.__coVisionnagePool = pool;
}

export function getPool() {
  return pool;
}

export async function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<Row>> {
  return pool.query<Row>(text, values);
}

export async function withUserContext<T>(
  userId: string,
  callback: (client: PoolClient) => Promise<T>,
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
