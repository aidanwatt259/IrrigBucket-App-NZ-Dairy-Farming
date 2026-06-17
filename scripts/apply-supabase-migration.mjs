// Reusable Supabase migration runner.
// Usage: node scripts/apply-supabase-migration.mjs <path-to-sql-file>
//
// Connects to the Supabase Postgres via the SUPABASE_DB_URL secret and applies
// the given SQL file inside a single transaction. Used because Supabase is only
// otherwise reachable via the REST API (supabase-js cannot run DDL).
import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-supabase-migration.mjs <sqlFile>");
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is not set.");
  process.exit(1);
}

const sql = await readFile(path.resolve(file), "utf8");

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  statement_timeout: 60000,
});

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log(`OK: applied migration ${file}`);
} catch (err) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // ignore rollback errors
  }
  console.error(`FAILED: ${err.code ?? ""} ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
