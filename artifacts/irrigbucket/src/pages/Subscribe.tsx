import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Check, CreditCard, Droplet, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBilling } from "@/hooks/use-billing";

export default function Subscribe() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("returnTo") || "/results";
  const start = params.get("start") === "1";
  const checkout = params.get("checkout");
  const sessionId = params.get("session_id");
  const {
    isLoading,
    hasAccess,
    isAuthenticated,
    login,
    startCheckout,
    confirmCheckout,
    openPortal,
    priceDisplay,
    status,
    error,
  } = useBilling();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const autoCheckoutAttempted = useRef(false);

  useEffect(() => {
    if (checkout !== "success" || !sessionId || !isAuthenticated || hasAccess) return;
    void confirmCheckout(sessionId).catch((err: Error) => {
      setActionError(err.message);
    });
  }, [checkout, sessionId, isAuthenticated, hasAccess, confirmCheckout]);

  useEffect(() => {
    if (checkout === "success" && hasAccess && !isLoading) {
      setLocation(returnTo.startsWith("/") ? returnTo : "/");
    }
  }, [checkout, hasAccess, isLoading, returnTo, setLocation]);

  useEffect(() => {
    if (
      !start ||
      isLoading ||
      !isAuthenticated ||
      hasAccess ||
      busy ||
      autoCheckoutAttempted.current
    ) {
      return;
    }
    autoCheckoutAttempted.current = true;
    setBusy(true);
    startCheckout(returnTo)
      .catch((err: Error) => {
        setActionError(err.message);
        setBusy(false);
      });
  }, [start, isLoading, isAuthenticated, hasAccess, busy, startCheckout, returnTo]);

  async function handleSubscribe() {
    setActionError(null);
    if (!isAuthenticated) {
      login(`/subscribe?returnTo=${encodeURIComponent(returnTo)}&start=1`);
      return;
    }
    setBusy(true);
    try {
      await startCheckout(returnTo);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Checkout failed");
      setBusy(false);
    }
  }

  async function handlePortal() {
    setActionError(null);
    setBusy(true);
    try {
      await openPortal();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not open billing portal");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6">
          <div className="flex items-center gap-3 h-16">
            <button
              onClick={() => setLocation("/")}
              className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-2 rounded-xl text-primary">
                <Droplet className="w-5 h-5 fill-primary" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight">
                Irrig<span className="text-primary">Bucket</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {checkout === "success" && !hasAccess && (
            <p className="mb-6 text-sm text-center text-primary bg-primary/10 rounded-xl px-4 py-3">
              Payment received. Unlocking your results…
            </p>
          )}
          {checkout === "cancel" && (
            <p className="mb-6 text-sm text-center text-muted-foreground bg-muted rounded-xl px-4 py-3">
              Checkout was cancelled. You can subscribe whenever you are ready.
            </p>
          )}

          <Card>
            <CardContent className="p-8 space-y-6">
              <div className="text-center">
                <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-2">Annual access</p>
                <h1 className="text-3xl font-display font-extrabold">IrrigBucket Pro</h1>
                <p className="text-muted-foreground mt-3">
                  Unlock test results and saved reports for a full season.
                </p>
              </div>

              <div className="text-center">
                <div className="text-4xl font-display font-extrabold text-foreground">
                  {isLoading ? "…" : priceDisplay}
                </div>
              </div>

              <ul className="space-y-3 text-sm">
                {[
                  "Full bucket test results and recommendations",
                  "Saved reports on this device and in the cloud",
                  "Print and share professional test reports",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
              {actionError && (
                <p className="text-sm text-destructive text-center">{actionError}</p>
              )}
              {status && !status.configured && (
                <p className="text-xs text-muted-foreground text-center">
                  Add <code className="font-mono bg-muted px-1 rounded">STRIPE_SECRET_KEY</code> in Replit Secrets to take live payments.
                </p>
              )}

              {isLoading ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : hasAccess ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-sm text-primary font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    Your subscription is active
                  </div>
                  <Button className="w-full" onClick={() => setLocation(returnTo.startsWith("/") ? returnTo : "/")}>
                    Continue
                  </Button>
                  {status?.status !== "admin" && (
                    <Button variant="outline" className="w-full" disabled={busy} onClick={() => void handlePortal()}>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Manage billing
                    </Button>
                  )}
                </div>
              ) : (
                <Button size="lg" className="w-full" disabled={busy} onClick={() => void handleSubscribe()}>
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {isAuthenticated ? "Subscribe with Stripe" : "Log in to subscribe"}
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
