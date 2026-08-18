import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { Lock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useBilling } from "@/hooks/use-billing";

interface BillingPaywallProps {
  children: ReactNode;
  returnTo: string;
  title?: string;
  description?: string;
}

export function BillingPaywall({
  children,
  returnTo,
  title = "Unlock your results",
  description = "Subscribe annually to view test results and saved reports.",
}: BillingPaywallProps) {
  const [, setLocation] = useLocation();
  const { isLoading, hasAccess, isAuthenticated, login, priceDisplay } = useBilling();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (hasAccess) return <>{children}</>;

  return (
    <Card className="max-w-lg mx-auto">
      <CardContent className="p-8 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-display font-bold">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
        <p className="text-lg font-semibold text-foreground">{priceDisplay}</p>
        {isAuthenticated ? (
          <Button size="lg" className="w-full" onClick={() => setLocation(`/subscribe?returnTo=${encodeURIComponent(returnTo)}&start=1`)}>
            Subscribe to unlock
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={() => login(`/subscribe?returnTo=${encodeURIComponent(returnTo)}&start=1`)}>
            <LogIn className="w-4 h-4 mr-2" />
            Log in to subscribe
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
