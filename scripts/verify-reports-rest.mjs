// Verifies the Supabase `reports` schema + readability via the PostgREST API
// using the service-role key. Needs no Postgres password and works over IPv4
// (unlike the IPv6-only direct DB host).
// Usage: node scripts/verify-reports-rest.mjs
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}
const base = url.replace(/\/$/, "");
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function columnExists(col) {
  const r = await fetch(`${base}/rest/v1/reports?select=${col}&limit=1`, { headers });
  if (r.ok) return { col, exists: true };
  const body = await r.text();
  return { col, exists: false, status: r.status, msg: body.slice(0, 140) };
}

async function rowCount() {
  const r = await fetch(`${base}/rest/v1/reports?select=id`, {
    headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
  });
  const cr = r.headers.get("content-range"); // e.g. "0-0/123"
  return cr ? cr.split("/")[1] : `unknown (status ${r.status})`;
}

const cols = ["id", "created_at", "deleted_at", "client_updated_at", "updated_at"];
const results = [];
for (const c of cols) results.push(await columnExists(c));

console.log("=== reports column existence ===");
let allNew = true;
for (const r of results) {
  console.log(`  - ${r.col}: ${r.exists ? "EXISTS" : `MISSING (${r.status}: ${r.msg})`}`);
  if (["deleted_at", "client_updated_at", "updated_at"].includes(r.col) && !r.exists) {
    allNew = false;
  }
}
console.log("reports row count:", await rowCount());
console.log(
  allNew
    ? "\nRESULT: local-first columns present — migration is applied."
    : "\nRESULT: one or more local-first columns are MISSING — migration not yet applied.",
);
