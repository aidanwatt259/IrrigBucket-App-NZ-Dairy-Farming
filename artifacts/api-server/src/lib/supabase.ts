import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
// Use the service role key so the server can bypass Row Level Security.
// The anon key is subject to RLS policies which block server-side writes.
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set.",
  );
}

export type Database = {
  public: {
    Tables: {
      reports: {
        Row: {
          id: string;
          user_id: string | null;
          irrigator_type: string | null;
          farm_name: string | null;
          assessor_name: string | null;
          test_date: string | null;
          report_data: unknown;
          du_percent: string | null;
          du_status: string | null;
          created_at: string;
          updated_at: string;
          client_updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["reports"]["Row"],
          "id" | "created_at" | "updated_at" | "client_updated_at" | "deleted_at"
        > & {
          id?: string;
          updated_at?: string;
          client_updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Row"]>;
        Relationships: [];
      };
      help_requests: {
        Row: {
          id: string;
          user_id: string | null;
          description: string;
          contact_info: string | null;
          resolved: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["help_requests"]["Row"], "id" | "created_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["help_requests"]["Row"]>;
        Relationships: [];
      };
      feedback: {
        Row: {
          id: string;
          user_id: string | null;
          message: string;
          contact_info: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["feedback"]["Row"], "id" | "created_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["feedback"]["Row"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

/**
 * Detect Supabase errors caused by the project being unreachable — most
 * commonly the free-tier project auto-pausing after inactivity, but also DNS
 * failures, connection refusals, and gateway timeouts. These are transient
 * infrastructure failures, not client mistakes, so routes should surface them
 * as 503 "sync unavailable" rather than a generic 500.
 */
export function isSupabaseUnavailable(error: unknown): boolean {
  if (!error) return false;
  const message =
    typeof error === "string"
      ? error
      : ((error as { message?: unknown }).message?.toString() ?? "");
  const code = String((error as { code?: unknown })?.code ?? "");
  // Node fetch / undici network-level failures and gateway-level HTTP errors.
  if (
    /fetch failed|network|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|EHOSTUNREACH|UND_ERR|aborted|timeout|socket|Bad Gateway|Service Unavailable|Gateway Timeout|project is paused|upstream/i.test(
      message,
    )
  ) {
    return true;
  }
  // PostgREST relays gateway failures with 5xx numeric codes; a paused
  // project's REST endpoint typically responds 540/503.
  if (/^5\d\d$/.test(code)) return true;
  if (["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"].includes(code)) {
    return true;
  }
  return false;
}

/** JSON body routes return when the cloud database is unreachable. */
export const SYNC_UNAVAILABLE_BODY = {
  error:
    "Sync unavailable — the cloud database is unreachable. Your data is safe on this device and will sync when the service is back.",
  code: "SYNC_UNAVAILABLE",
} as const;

/**
 * Standard route error responder for Supabase failures: logs the error, then
 * answers 503 + SYNC_UNAVAILABLE when the database is unreachable (paused /
 * network failure) or the given fallback status/message otherwise.
 */
export function respondSupabaseError(
  res: {
    status: (code: number) => { json: (body: unknown) => unknown };
  },
  error: unknown,
  logLabel: string,
  fallback: { status: number; error: string },
): void {
  console.error(logLabel, error);
  if (isSupabaseUnavailable(error)) {
    res.status(503).json(SYNC_UNAVAILABLE_BODY);
    return;
  }
  res.status(fallback.status).json({ error: fallback.error });
}

/**
 * When the error indicates Supabase is unreachable, respond 503 +
 * SYNC_UNAVAILABLE and return true; otherwise return false so the caller can
 * keep its normal error path (e.g. a 404 for a missing row).
 */
export function respondIfUnavailable(
  res: {
    status: (code: number) => { json: (body: unknown) => unknown };
  },
  error: unknown,
): boolean {
  if (isSupabaseUnavailable(error)) {
    console.error("Supabase unavailable:", error);
    res.status(503).json(SYNC_UNAVAILABLE_BODY);
    return true;
  }
  return false;
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    // Disable Supabase Auth on the server-side client — we handle auth ourselves.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
