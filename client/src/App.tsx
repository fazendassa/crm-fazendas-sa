import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Contacts from "@/pages/contacts";
import Companies from "@/pages/companies";
import Pipeline from "@/pages/pipeline";
import Activities from "@/pages/activities";
import Admin from "@/pages/admin";
import UserManagement from "@/pages/user-management";
import ContactImport from "@/pages/contact-import";
import ActiveCampaignConfig from "@/pages/ActiveCampaignConfig";
import WhatsApp from "@/pages/whatsapp";
import WhatsAppNew from "@/pages/whatsapp-new";
import WhatsAppSimple from "@/pages/whatsapp-simple";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { lazy, Suspense } from 'react';

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/contacts">
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div></div>}>
                <Contacts />
              </Suspense>
            </Route>
            <Route path="/contacts/:id" component={lazy(() => import("./pages/contact-detail"))} />
            <Route path="/contact-import" component={ContactImport} />
            <Route path="/companies" component={Companies} />
            <Route path="/pipeline" component={Pipeline} />
            <Route path="/activities" component={Activities} />
            <Route path="/integrations/activecampaign" component={ActiveCampaignConfig} />
            <Route path="/integrations/whatsapp" component={WhatsAppSimple} />
            <Route path="/whatsapp" component={WhatsAppSimple} />
            <Route path="/whatsapp-new" component={WhatsAppSimple} />
            <Route path="/whatsapp-simple" component={WhatsAppSimple} />
            <Route path="/admin" component={Admin} />
            <Route path="/users" component={UserManagement} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;