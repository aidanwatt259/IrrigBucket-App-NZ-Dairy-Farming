import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { getSupabaseClient, createServerSession } from "@/lib/supabase";

/**
 * Handles the redirect back from Supabase Auth after email verification.
 *
 * Supabase uses two different redirect styles depending on config:
 *   1. Hash-based:  /auth-callback#access_token=...&refresh_token=...&type=signup
 *   2. PKCE / code: /auth-callback?code=...
 *
 * Either way we exchange it for a server session cookie then redirect home.
 */
export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCallback() {
    try {
      const supabase = await getSupabaseClient();

      // ── PKCE / authorization-code flow ──────────────────────────
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || !data.session) {
          setLocation("/login");
          return;
        }
        await createServerSession(
          data.session.access_token,
          data.session.refresh_token,
        );
        window.location.replace("/");
        return;
      }

      // ── Hash-based flow (email confirmation link) ───────────────
      const hash = window.location.hash.slice(1);
      const hashParams = new URLSearchParams(hash);
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token") ?? "";

      if (access_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error || !data.session) {
          setLocation("/login");
          return;
        }
        await createServerSession(
          data.session.access_token,
          data.session.refresh_token,
        );
        window.location.replace("/");
        return;
      }

      // No tokens found — send back to login
      setLocation("/login");
    } catch {
      setLocation("/login");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground text-sm">Verifying your account…</p>
    </div>
  );
}
