import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const iss = url.searchParams.get("iss");

    if (!code || !state) {
      setLocation("/");
      return;
    }

    const params = new URLSearchParams({ code, state });
    if (iss) params.set("iss", iss);

    fetch(`/api/login-complete?${params.toString()}`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          window.location.replace(data.returnTo || "/");
        } else {
          setLocation("/");
        }
      })
      .catch(() => {
        setLocation("/");
      });
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-600">Signing you in…</p>
    </div>
  );
}
