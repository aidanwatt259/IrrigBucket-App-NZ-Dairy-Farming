// Deletes E2E / smoke-test rows from the Supabase database so test data never
// lingers among real user reports. Safe to run any time; it only touches rows
// matching the reserved test-data convention (see replit.md "Test data"):
//   - reports:       farm_name starts with "E2E-"  OR user_id = TEST_USER_ID
//   - help_requests: description starts with "[E2E]" OR user_id = TEST_USER_ID
//   - feedback:      message starts with "[E2E]"     OR user_id = TEST_USER_ID
//
// Usage: node scripts/cleanup-test-data.mjs [--dry-run]
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (uses PostgREST over IPv4).

export const TEST_USER_ID = "00000000-0000-4000-8000-000000000e2e";
export const E2E_FARM_PREFIX = "E2E-";
export const E2E_TEXT_PREFIX = "[E2E]";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}
const base = url.replace(/\/$/, "");
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Prefer: "return=representation",
};
const dryRun = process.argv.includes("--dry-run");

// NOTE: values are fixed constants defined above (never user input), so the
// PostgREST `or=` filter is safe from injection here.
const targets = [
  { table: "reports", filter: `or=(farm_name.like.${E2E_FARM_PREFIX}*,user_id.eq.${TEST_USER_ID})` },
  { table: "help_requests", filter: `or=(description.like.${encodeURIComponent(E2E_TEXT_PREFIX)}*,user_id.eq.${TEST_USER_ID})` },
  { table: "feedback", filter: `or=(message.like.${encodeURIComponent(E2E_TEXT_PREFIX)}*,user_id.eq.${TEST_USER_ID})` },
];

let failed = false;
for (const { table, filter } of targets) {
  const endpoint = `${base}/rest/v1/${table}?${filter}&select=id`;
  if (dryRun) {
    const r = await fetch(endpoint, { headers });
    const rows = r.ok ? await r.json() : [];
    console.log(`[dry-run] ${table}: would delete ${rows.length} row(s)`, rows.map((x) => x.id));
    if (!r.ok) { console.error(`  query failed: ${r.status} ${await r.text()}`); failed = true; }
    continue;
  }
  const r = await fetch(endpoint, { method: "DELETE", headers });
  if (!r.ok) {
    console.error(`${table}: delete failed ${r.status}: ${(await r.text()).slice(0, 200)}`);
    failed = true;
    continue;
  }
  const rows = await r.json();
  console.log(`${table}: deleted ${rows.length} test row(s)${rows.length ? " " + JSON.stringify(rows.map((x) => x.id)) : ""}`);
}
process.exit(failed ? 1 : 0);
