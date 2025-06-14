import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./lib/auth.tsx";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Appointments from "./pages/Appointments";
import FindDate from "./pages/FindDate";
import Routes from "./pages/Routes";
import Clients from "./pages/Clients";
import Technicians from "./pages/Technicians";
import Vehicles from "./pages/Vehicles";
import Services from "./pages/Services";
import BusinessRules from "./pages/BusinessRules";
import Layout from "./components/Layout";
import NotFound from "@/pages/not-found";

function AppRoutes() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-yellow"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/appointments" component={Appointments} />
        <Route path="/find-date" component={FindDate} />
        <Route path="/routes" component={Routes} />
        <Route path="/clients" component={Clients} />
        <Route path="/technicians" component={Technicians} />
        <Route path="/vehicles" component={Vehicles} />
        <Route path="/services" component={Services} />
        <Route path="/business-rules" component={BusinessRules} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <AppRoutes />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
