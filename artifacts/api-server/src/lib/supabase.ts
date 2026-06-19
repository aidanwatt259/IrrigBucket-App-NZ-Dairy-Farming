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

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    // Disable Supabase Auth on the server-side client — we handle auth ourselves.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
