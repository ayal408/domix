const { Pool } = require('pg');

// Prefer discrete PG* fields (PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE, which
// `pg` reads automatically) over a DATABASE_URL string: a password containing
// URI-reserved characters (/, #, ?, @, :) would otherwise corrupt the URL.
// DATABASE_URL remains supported for callers (e.g. tests, managed hosts) that
// already have a full connection string.
if (!process.env.DATABASE_URL && !process.env.PGHOST) {
  throw new Error('DATABASE_URL or PGHOST (+ PGUSER/PGPASSWORD/PGDATABASE) environment variables are required');
}

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool();

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

// Retries so auth-server can start even if auth-db is still coming up
// despite the compose healthcheck (e.g. during a cold `docker compose up`).
async function migrateWithRetry(retries = 10, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await migrate();
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`DB not ready yet (attempt ${attempt}/${retries}): ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

module.exports = { pool, migrateWithRetry };
