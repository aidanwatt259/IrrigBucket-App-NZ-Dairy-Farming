import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { OfflineIndicator } from "@/components/ui/OfflineIndicator";

import Home from "@/pages/Home";
import SystemSetup from "@/pages/SystemSetup";
import TestPlan from "@/pages/TestPlan";
import Operation from "@/pages/Operation";
import DataEntry from "@/pages/DataEntry";
import Results from "@/pages/Results";
import SavedReport from "@/pages/SavedReport";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/setup" component={SystemSetup} />
      <Route path="/plan" component={TestPlan} />
      <Route path="/operation" component={Operation} />
      <Route path="/data" component={DataEntry} />
      <Route path="/results" component={Results} />
      <Route path="/reports/:id" component={SavedReport} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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
