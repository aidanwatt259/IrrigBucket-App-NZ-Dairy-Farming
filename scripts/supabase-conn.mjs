// Shared Supabase Postgres connection helper.
//
// Supabase's "Direct connection" host (db.<ref>.supabase.co) publishes only
// IPv6 (AAAA) records. Environments without IPv6 (like this one) cannot resolve
// it. The "Session pooler" endpoint (aws-<n>-<region>.pooler.supabase.com) is
// IPv4 and uses the SAME database password, with username postgres.<ref>.
//
// This helper transparently rewrites a direct URL into the pooler form, probing
// the project's region. It connects with DISCRETE fields (not a rebuilt URL
// string) and a properly decoded password to avoid percent-encoding round-trip
// corruption. The password is only ever used in-process and never logged.
import pg from "pg";

const { Client } = pg;

// Host candidates, most-likely first. This project resolved to us-east-2 on the
// aws-1 pooler; others remain as fallback in case the project is ever moved.
const HOST_CANDIDATES = [
  "aws-1-us-east-2.pooler.supabase.com",
  "aws-0-us-east-2.pooler.supabase.com",
  "aws-1-us-east-1.pooler.supabase.com",
  "aws-0-us-east-1.pooler.supabase.com",
  "aws-1-ap-southeast-2.pooler.supabase.com",
  "aws-0-ap-southeast-2.pooler.supabase.com",
  "aws-1-us-west-1.pooler.supabase.com",
  "aws-0-us-west-1.pooler.supabase.com",
  "aws-1-eu-central-1.pooler.supabase.com",
  "aws-0-eu-central-1.pooler.supabase.com",
];

function decode(pw) {
  try {
    return decodeURIComponent(pw);
  } catch {
    return pw;
  }
}

export async function connectSupabase() {
  const cs = process.env.SUPABASE_DB_URL;
  if (!cs) throw new Error("SUPABASE_DB_URL is not set.");

  const u = new URL(cs);
  const direct = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);

  // Already a pooler / custom host — connect as provided.
  if (!direct) {
    const client = new Client({
      connectionString: cs,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 12000,
      statement_timeout: 60000,
    });
    await client.connect();
    return client;
  }

  const ref = direct[1];
  const user = `postgres.${ref}`;
  const password = decode(u.password);

  let lastErr;
  for (const host of HOST_CANDIDATES) {
    const client = new Client({
      host,
      port: 5432,
      user,
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      statement_timeout: 60000,
    });
    try {
      await client.connect();
      console.log(`Connected via ${host}`);
      return client;
    } catch (err) {
      lastErr = err;
      await client.end().catch(() => {});
      // 28P01 = tenant found on this host but password rejected -> stop early.
      if (err.code === "28P01") {
        throw new Error(
          `Tenant found on ${host} but password authentication failed. ` +
            `The password in SUPABASE_DB_URL is incorrect — re-copy the Database password.`,
        );
      }
      // Otherwise (tenant/user not found, DNS) try the next host.
    }
  }
  throw new Error(
    `Could not connect to Supabase. Last error: ${lastErr?.code ?? ""} ${lastErr?.message ?? ""}`,
  );
}
