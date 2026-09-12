import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Lazily creates and caches a Supabase client.
 * Config is fetched from /api/config so no VITE_ env vars are needed —
 * the anon key is public by design (scoped by Supabase RLS).
 */
export async function getSupabaseClient(): Promise<SupabaseClient> {
  if (_client) return _client;

  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Failed to load Supabase config from /api/config");
  const { supabaseUrl, supabaseAnonKey } = await res.json();

  _client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return _client;
}

/**
 * Creates a server session from a Supabase access token.
 * Call this after every successful Supabase sign-in / token exchange.
 */
export async function createServerSession(
  access_token: string,
  refresh_token: string,
): Promise<void> {
  const res = await fetch("/api/auth/supabase-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ access_token, refresh_token }),
  });
  if (!res.ok) {
    throw new Error("Failed to create server session");
  }
}
