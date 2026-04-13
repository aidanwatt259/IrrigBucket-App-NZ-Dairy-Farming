import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_ANON_KEY environment variables must be set.",
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
        };
        Insert: Omit<Database["public"]["Tables"]["reports"]["Row"], "id" | "created_at"> & {
          id?: string;
        };
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
      };
    };
  };
};

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
