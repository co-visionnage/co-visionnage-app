// CI-only equivalent of database/init.sh's app_user bootstrap.
//
// docker-compose's postgres service gets init.sh mounted at
// /docker-entrypoint-initdb.d/, which the official postgres image only
// runs on a fresh (empty) data directory -- there's no equivalent hook for
// a GitLab CI `services:` container, and shared runners can't mount extra
// files into a service container anyway. Reimplemented here with `pg`
// (already a project dependency) instead of shelling out to psql, so it
// runs in any CI job image without extra packages.
//
// Usage: MIGRATE_DATABASE_URL=... APP_DB_PASSWORD=... node scripts/ci/create-app-role.mjs
import pg from 'pg';

const adminConnectionString = process.env.MIGRATE_DATABASE_URL;
const appPassword = process.env.APP_DB_PASSWORD;

if (!adminConnectionString) {
  throw new Error('MIGRATE_DATABASE_URL is not set');
}
if (!appPassword) {
  throw new Error('APP_DB_PASSWORD is not set');
}

const client = new pg.Client({ connectionString: adminConnectionString });
await client.connect();

try {
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
      ELSE
        ALTER ROLE app_user WITH PASSWORD '${appPassword}';
      END IF;
    END
    $$;
  `);

  const databaseName = client.database;
  await client.query(`GRANT CONNECT ON DATABASE ${databaseName} TO app_user;`);
  await client.query('GRANT USAGE ON SCHEMA public TO app_user;');

  console.log(`app_user role ready on database "${databaseName}".`);
} finally {
  await client.end();
}
