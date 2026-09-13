import type { PoolClient, QueryResult, QueryResultRow } from 'pg';

import { Pool } from 'pg';

import { ENV } from '@/shared/config/environment';

const connectionString =
  ENV.DATABASE_URL ??
  `postgresql://${ENV.DB_USER}:${ENV.DB_PASSWORD}@${ENV.DB_HOST}:${ENV.DB_PORT}/${ENV.DB_NAME}`;

const globalForDatabase = globalThis as typeof globalThis & {
  __notreCinemaPool?: Pool;
};

const pool =
  globalForDatabase.__notreCinemaPool ??
  new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5000,
    // Safety net against a future withUserContext callback accidentally
    // doing slow work (an external HTTP call, a runaway query) while
    // holding a transaction open: without these, a single stuck call can
    // hold a pool slot indefinitely and eventually starve the whole pool
    // (max 20). Postgres kills the session itself past either threshold,
    // freeing the slot even if the client-side code never returns.
    statement_timeout: 15_000,
    idle_in_transaction_session_timeout: 10_000,
  });

// Required by node-postgres: an idle client sitting in the pool can still
// error out (network blip, admin/timeout kill) with no query pending to
// reject, which pg surfaces as an 'error' event on the pool. An unhandled
// 'error' event crashes the whole process, so this listener exists purely
// to prevent that -- the pool itself removes the broken client either way.
pool.on('error', (error) => {
  console.error('Postgres pool: idle client error', error);
});

if (process.env.NODE_ENV !== 'production') {
  globalForDatabase.__notreCinemaPool = pool;
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

  // A checked-out client can be killed by the server with no query pending
  // (e.g. our idle_in_transaction_session_timeout safety net) -- that error
  // has no promise to reject, so pg emits it as an 'error' event instead.
  // Without a listener that's an unhandled event, which crashes the whole
  // process. release(error) below then discards the connection instead of
  // returning a dead one to the pool.
  let connectionError: Error | undefined;
  client.on('error', (error: Error) => {
    connectionError = error;
  });

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [
      userId,
    ]);

    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // connection may already be dead (e.g. terminated by the server) --
      // nothing left to roll back
    }
    throw error;
  } finally {
    client.release(connectionError);
  }
}
