import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";

export interface BillingPrice {
  amountNzd: number;
  currency: string;
  interval: string;
  display: string;
}

export interface BillingStatus {
  configured: boolean;
  authenticated: boolean;
  hasAccess: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  price: BillingPrice;
}

export function useBilling() {
  const { isAuthenticated, isLoading: authLoading, login, user } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/status", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as BillingStatus;
      setStatus(data);
    } catch {
      setError("Could not load billing status");
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, isAuthenticated, refresh]);

  const startCheckout = useCallback(async (returnTo = "/results") => {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnTo }),
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      throw new Error(data.error || "Could not start checkout");
    }
    window.location.href = data.url;
  }, []);

  const confirmCheckout = useCallback(async (sessionId: string) => {
    const res = await fetch("/api/billing/confirm", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error || "Could not confirm payment");
    }
    await refresh();
  }, [refresh]);

  const openPortal = useCallback(async () => {
    const res = await fetch("/api/billing/portal", {
      method: "POST",
      credentials: "include",
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      throw new Error(data.error || "Could not open billing portal");
    }
    window.location.href = data.url;
  }, []);

  return {
    user,
    login,
    isAuthenticated,
    authLoading,
    status,
    isLoading: authLoading || isLoading,
    error,
    refresh,
    startCheckout,
    confirmCheckout,
    openPortal,
    hasAccess: Boolean(status?.hasAccess),
    priceDisplay: status?.price.display ?? "NZ$149 / year",
  };
}
