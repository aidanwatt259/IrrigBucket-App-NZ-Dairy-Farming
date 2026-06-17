// Reusable Supabase migration runner.
// Usage: node scripts/apply-supabase-migration.mjs <path-to-sql-file>
//
// Applies the given SQL file inside a single transaction against the Supabase
// Postgres (resolved via scripts/supabase-conn.mjs, which transparently handles
// the IPv6 direct-host -> IPv4 Session pooler rewrite).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { connectSupabase } from "./supabase-conn.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-supabase-migration.mjs <sqlFile>");
  process.exit(1);
}

const sql = await readFile(path.resolve(file), "utf8");
const client = await connectSupabase();

try {
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
