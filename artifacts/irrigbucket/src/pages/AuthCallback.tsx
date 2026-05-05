import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { getSupabaseClient, createServerSession } from "@/lib/supabase";

/**
 * Handles all Supabase Auth redirects:
 *  - Email verification  (hash: type=signup)
 *  - Password reset      (hash: type=recovery)  → /reset-password
 *  - OAuth sign-in       (PKCE: ?code=...)
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

      // ── PKCE / authorization-code flow (OAuth + some email flows) ──
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || !data.session) {
          setLocation("/login");
          return;
        }
        await createServerSession(data.session.access_token, data.session.refresh_token);
        window.location.replace("/");
        return;
      }

      // ── Hash-based flow (email verification + password reset links) ──
      const hash = window.location.hash.slice(1);
      const hashParams = new URLSearchParams(hash);
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token") ?? "";
      const type = hashParams.get("type");

      if (access_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error || !data.session) {
          setLocation("/login");
          return;
        }

        if (type === "recovery") {
          // Password reset flow: keep Supabase session in localStorage so
          // ResetPassword can call updateUser(), but don't create server session yet.
          window.location.replace("/reset-password");
          return;
        }

        // Email verification or any other type: log the user straight in.
        await createServerSession(data.session.access_token, data.session.refresh_token);
        window.location.replace("/");
        return;
      }

      // Nothing usable — send to login
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
