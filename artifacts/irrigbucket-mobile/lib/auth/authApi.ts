/**
 * Mobile authentication API calls (email/password only).
 *
 * Sign-in hits the Supabase Auth REST endpoint directly (password grant) to get
 * an access token, which is exchanged at the api-server for an opaque server
 * session id (sid). The sid — not the Supabase session — is what we persist and
 * send as a bearer token on every synced request. Using REST (instead of
 * supabase-js) keeps react-native-url-polyfill out of the bundle and the
 * persisted credential tiny.
 */

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : '';

interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

let configCache: SupabaseConfig | null = null;

/** Fetch (and cache) the public Supabase config the server exposes. */
async function getConfig(): Promise<SupabaseConfig> {
  if (configCache) return configCache;
  const res = await fetch(`${API_BASE}/api/config`);
  if (!res.ok) throw new Error('Could not reach the sign-in service.');
  const json = (await res.json()) as Partial<SupabaseConfig>;
  if (!json.supabaseUrl || !json.supabaseAnonKey) {
    throw new Error('Sign-in is not configured on the server.');
  }
  configCache = {
    supabaseUrl: json.supabaseUrl,
    supabaseAnonKey: json.supabaseAnonKey,
  };
  return configCache;
}

export interface PasswordSignInResult {
  accessToken: string;
  refreshToken: string | null;
}

/** Exchange email + password for a Supabase access token (password grant). */
export async function supabasePasswordSignIn(
  email: string,
  password: string,
): Promise<PasswordSignInResult> {
  const { supabaseUrl, supabaseAnonKey } = await getConfig();
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  const data = (await res.json().catch(() => null)) as
    | {
        access_token?: string;
        refresh_token?: string;
        error_description?: string;
        msg?: string;
        error?: string;
      }
    | null;
  if (!res.ok || !data?.access_token) {
    const message =
      data?.error_description ||
      data?.msg ||
      data?.error ||
      'Incorrect email or password.';
    throw new Error(message);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
  };
}

/** Trade a Supabase access token for an api-server session id (sid). */
export async function exchangeForServerSession(
  accessToken: string,
  refreshToken: string | null,
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth/supabase-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      returnSid: true,
    }),
  });
  const data = (await res.json().catch(() => null)) as { sid?: string } | null;
  if (!res.ok || !data?.sid) {
    throw new Error('Could not establish a session. Please try again.');
  }
  return data.sid;
}

/** Best-effort server-side session teardown; local sign-out proceeds regardless. */
export async function serverSignOut(sid: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/logout`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${sid}` },
      redirect: 'manual',
    });
  } catch {
    // Network failure on sign-out is non-fatal — the local token is cleared anyway.
  }
}
