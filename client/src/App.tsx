import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./lib/auth.tsx";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Appointments from "./pages/Appointments";
import FindDate from "./pages/FindDate";
import Clients from "./pages/Clients";
import Technicians from "./pages/Technicians";
import Vehicles from "./pages/Vehicles";
import Services from "./pages/Services";
import BusinessRules from "./pages/BusinessRules";
import RoutesHistoryPage from "./pages/routes-history/RoutesHistoryPage";
import UserManagement from "./pages/UserManagement";
import AccessSchedules from "./pages/AccessSchedules";
import VerifyEmail from "./pages/VerifyEmail";
import SetPassword from "./pages/SetPassword";
import ChangePassword from "./pages/ChangePassword";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import SignupCompany from "./pages/SignupCompany";
import AcceptInvite from "./pages/AcceptInvite";
import CompanyUsers from "./pages/CompanyUsers";
import Layout from "./components/Layout";
import NotFound from "@/pages/not-found";

function AppRoutes() {
  const { user, isLoading, requirePasswordChange } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-burnt-yellow"></div>
      </div>
    );
  }

  // Rotas públicas (sem autenticação)
  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/signup-company" component={SignupCompany} />
        <Route path="/convite/:token" component={AcceptInvite} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/set-password" component={SetPassword} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/" component={Home} />
        <Route component={Home} />
      </Switch>
    );
  }

  // 🔐 LGPD: Se usuário precisa trocar senha, mostrar apenas tela de troca de senha
  if (requirePasswordChange) {
    return <ChangePassword isRequired={true} />;
  }

  // Rotas autenticadas
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/appointments" component={Appointments} />
        <Route path="/find-date" component={FindDate} />
        {/* Legacy builder routes → redirect to Appointments */}
        <Route path="/routes" component={() => <Redirect to="/appointments" />} />
        <Route path="/roteirizacao" component={() => <Redirect to="/appointments" />} />
        <Route path="/routes/builder" component={() => <Redirect to="/appointments" />} />
        <Route path="/routes/optimize" component={() => <Redirect to="/appointments" />} />
        {/* Keep Routes History intact */}
        <Route path="/routes-history/:routeId" component={RoutesHistoryPage} />
        <Route path="/routes-history" component={RoutesHistoryPage} />
        <Route path="/clients" component={Clients} />
        <Route path="/technicians" component={Technicians} />
        <Route path="/vehicles" component={Vehicles} />
        <Route path="/services" component={Services} />
        <Route path="/business-rules" component={BusinessRules} />
        <Route path="/users" component={UserManagement} />
        <Route path="/company/users" component={CompanyUsers} />
        <Route path="/convite/:token" component={AcceptInvite} />
        <Route path="/access-schedules" component={AccessSchedules} />
        <Route path="/change-password" component={() => <ChangePassword isRequired={false} />} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(to);
  }, [to, setLocation]);
  return null;
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
