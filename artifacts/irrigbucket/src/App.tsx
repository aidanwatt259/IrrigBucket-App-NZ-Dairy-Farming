import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { OfflineIndicator } from "@/components/ui/OfflineIndicator";
import { initSyncEngine } from "@/lib/syncEngine";

import Home from "@/pages/Home";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import SystemSetup from "@/pages/SystemSetup";
import TestPlan from "@/pages/TestPlan";
import Operation from "@/pages/Operation";
import DataEntry from "@/pages/DataEntry";
import Results from "@/pages/Results";
import SavedReport from "@/pages/SavedReport";
import Admin from "@/pages/Admin";
import AuthCallback from "@/pages/AuthCallback";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

const queryClient = new QueryClient();

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/auth-callback" component={AuthCallback} />
        <Route path="/setup" component={SystemSetup} />
        <Route path="/plan" component={TestPlan} />
        <Route path="/operation" component={Operation} />
        <Route path="/data" component={DataEntry} />
        <Route path="/results" component={Results} />
        <Route path="/reports/:id" component={SavedReport} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  useEffect(() => {
    initSyncEngine();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <OfflineIndicator />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
