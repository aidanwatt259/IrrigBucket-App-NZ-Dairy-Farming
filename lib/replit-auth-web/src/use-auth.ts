import { useState, useEffect, useCallback } from "react";
import type { AuthUser as ApiAuthUser } from "@workspace/api-client-react";

/**
 * The auth boundary's user type. The server's `/api/auth/user` response includes
 * an `isAdmin` flag that the OpenAPI-generated `AuthUser` does not model, so the
 * auth lib augments it here (this lib owns the web app's auth contract).
 */
export type AuthUser = ApiAuthUser & { isAdmin?: boolean };

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (returnTo?: string) => void;
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
  const login = useCallback((returnTo?: string) => {
    const env = (import.meta as { env?: { BASE_URL?: string } }).env;
    const base = (env?.BASE_URL ?? "/").replace(/\/+$/, "");
    const loginPath = `${base}/login`;
    const dest = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? `?returnTo=${encodeURIComponent(returnTo)}`
      : "";
    window.location.href = `${loginPath}${dest}`;
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
