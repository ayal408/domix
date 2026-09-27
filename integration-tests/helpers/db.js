import pg from "pg";

/**
 * Wipes every table domix-server owns before a test run starts. Needed for test isolation:
 * a fresh Postgres service container in CI gives this for free, but a developer re-running
 * `npm test` locally against the same long-lived database would otherwise see leftover users
 * from the previous run — in particular breaking the "first user in the database becomes
 * Admin" assumption the self-block test below relies on.
 */
export async function resetDatabase(postgresUrl) {
  const client = new pg.Client(parseDotNetConnectionString(postgresUrl));
  await client.connect();
  try {
    const { rows } = await client.query(
      // Excludes __EFMigrationsHistory: truncating it while the tables it tracks still exist
      // makes MigrateAsync() try to re-run "CREATE TABLE" against tables that are already
      // there on the next startup, which fails.
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '__EFMigrationsHistory'`
    );
    if (rows.length === 0) return; // nothing to reset -- migrations haven't run yet

    const tableList = rows.map((r) => `"${r.tablename}"`).join(", ");
    await client.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
  } finally {
    await client.end();
  }
}

/** Converts EF Core's "Host=...;Port=...;Database=...;Username=...;Password=..." into node-pg's config shape. */
function parseDotNetConnectionString(connectionString) {
  const config = {};
  for (const part of connectionString.split(";")) {
    if (!part.trim()) continue;
    const [key, value] = part.split("=");
    switch (key.trim().toLowerCase()) {
      case "host":
        config.host = value;
        break;
      case "port":
        config.port = Number(value);
        break;
      case "database":
        config.database = value;
        break;
      case "username":
        config.user = value;
        break;
      case "password":
        config.password = value;
        break;
    }
  }
  return config;
}
