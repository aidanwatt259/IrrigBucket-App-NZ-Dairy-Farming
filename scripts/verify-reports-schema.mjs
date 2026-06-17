// Verifies the local-first columns/trigger on the Supabase `reports` table and
// confirms existing rows remain readable. Usage: node scripts/verify-reports-schema.mjs
import { connectSupabase } from "./supabase-conn.mjs";

const client = await connectSupabase();

try {
  const cols = await client.query(
    `select column_name, data_type, is_nullable
       from information_schema.columns
      where table_schema = 'public' and table_name = 'reports'
      order by ordinal_position`,
  );
  console.log("reports columns:");
  for (const r of cols.rows) {
    console.log(
      `  - ${r.column_name} ${r.data_type} ${r.is_nullable === "YES" ? "NULL" : "NOT NULL"}`,
    );
  }

  const cnt = await client.query(
    `select count(*)::int n,
            count(updated_at)::int with_updated,
            count(client_updated_at)::int with_client
       from public.reports`,
  );
  console.log("row counts:", JSON.stringify(cnt.rows[0]));

  const trg = await client.query(
    `select tgname from pg_trigger
      where tgrelid = 'public.reports'::regclass and not tgisinternal`,
  );
  console.log("triggers:", trg.rows.map((r) => r.tgname).join(", ") || "(none)");
} finally {
  await client.end().catch(() => {});
}
