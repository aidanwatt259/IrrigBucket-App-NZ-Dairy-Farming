import { useState, useEffect, useCallback } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/user", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ user: AuthUser | null }>;
      })
      .then((data) => {
        if (!cancelled) {
          setUser(data.user ?? null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Navigate to the app's own login page instead of Replit OIDC.
  const login = useCallback(() => {
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");
    window.location.href = `${base}/login`;
  }, []);

  // Clear the server session; best-effort Supabase signOut first.
  const logout = useCallback(async () => {
    try {
      const configRes = await fetch("/api/config");
      if (configRes.ok) {
        const { supabaseUrl, supabaseAnonKey } = await configRes.json();
        if (supabaseUrl && supabaseAnonKey) {
          const { createClient } = await import("@supabase/supabase-js");
          const sb = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
          });
          await sb.auth.signOut();
        }
      }
    } catch {
      // Non-fatal — server session cleared below regardless
    }
    window.location.href = "/api/logout";
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
