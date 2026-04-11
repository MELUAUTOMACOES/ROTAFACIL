import { Switch, Route, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./lib/auth.tsx";
import { ThemeProvider } from "./lib/theme";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Inicio from "./pages/Inicio";
import Dashboard from "./pages/Dashboard";
import Appointments from "./pages/Appointments";
import FindDate from "./pages/FindDate";
import Clients from "./pages/Clients";
import Technicians from "./pages/Technicians";
import Vehicles from "./pages/Vehicles";
import PrestadoresPage from "@/pages/PrestadoresPage";
import Services from "./pages/Services";
import BusinessRules from "./pages/BusinessRules";
import RoutesHistoryPage from "./pages/routes-history/RoutesHistoryPage";
import { canAccess, getHomeForRole } from "./lib/permissions";
import UserManagement from "./pages/UserManagement";
import VerifyEmail from "./pages/VerifyEmail";
import SetPassword from "./pages/SetPassword";
import ChangePassword from "./pages/ChangePassword";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import SignupCompany from "./pages/SignupCompany";
import AcceptInvite from "./pages/AcceptInvite";
import CompanyUsers from "./pages/CompanyUsers";
import AdminMetrics from "./pages/AdminMetrics";
import AdminAudit from "./pages/AdminAudit";
import Ads from "./pages/Ads";
import CompaniesOverview from "./pages/superadmin/CompaniesOverview";
import LeadsOverview from "./pages/superadmin/Leads";
import LgpdAccept from "./pages/LgpdAccept";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import AgendarDemonstracao from "./pages/AgendarDemonstracao";
import AccessPending from "./pages/AccessPending";
import Layout from "./components/Layout";
import NotFound from "@/pages/not-found";

function AppRoutes() {
  const { user, isLoading, requirePasswordChange } = useAuth();
  const [forceAccessPending, setForceAccessPending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // 🔒 Escutar evento de empresa invalidada (por polling do /api/auth/me)
    const handleCompanyInvalidated = () => {
      console.log('[APP] Evento company-invalidated recebido (polling). Forçando AccessPending...');
      toast({
        title: "Acesso à empresa removido",
        description: "Seu acesso a esta empresa foi desativado. Selecione outra empresa ou entre em contato com o administrador.",
        variant: "destructive",
      });
      setForceAccessPending(true);
      // Invalidar queries para limpar dados da empresa antiga
      import('./lib/queryClient').then(({ queryClient }) => {
        queryClient.clear();
      });
    };

    // 🔒 Escutar evento de forçar AccessPending (erro 403 do backend)
    const handleForceAccessPending = () => {
      console.log('[APP] Evento force-access-pending recebido (erro backend). Forçando AccessPending...');
      setForceAccessPending(true);
      // Invalidar queries para limpar dados da empresa antiga
      import('./lib/queryClient').then(({ queryClient }) => {
        queryClient.clear();
      });
    };

    window.addEventListener('company-invalidated', handleCompanyInvalidated as EventListener);
    window.addEventListener('force-access-pending', handleForceAccessPending as EventListener);
    
    return () => {
      window.removeEventListener('company-invalidated', handleCompanyInvalidated as EventListener);
      window.removeEventListener('force-access-pending', handleForceAccessPending as EventListener);
    };
  }, [toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
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
        <Route path="/agendar-demonstracao" component={AgendarDemonstracao} />
        <Route path="/convite/:token" component={AcceptInvite} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/set-password" component={SetPassword} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/cookies" component={CookiePolicy} />
        <Route path="/" component={Home} />
        <Route component={Home} />
      </Switch>
    );
  }

  // 🔐 LGPD: Se usuário precisa trocar senha, mostrar apenas tela de troca de senha
  if (requirePasswordChange) {
    return <ChangePassword isRequired={true} />;
  }

  // 🔐 LGPD: Se usuário não aceitou os termos LGPD, mostrar apenas tela de aceite
  // Usa !user.lgpdAccepted para capturar false, undefined e null
  // @ts-ignore - lgpdAccepted será retornado pelo /api/auth/me
  if (!user.lgpdAccepted) {
    return <LgpdAccept />;
  }

  // 🏢 Multiempresa: Se usuário não tem empresa ativa ou foi forçado, redirecionar para tela neutra
  // EXCETO se está em rota de aceite de convite (precisa completar o fluxo)
  const [location] = useLocation();
  const isConviteRoute = location.startsWith('/convite/');
  
  if (((!user.companyId && !isConviteRoute) || forceAccessPending) && !isConviteRoute) {
    return <AccessPending onCompanySelected={() => setForceAccessPending(false)} />;
  }

  // Rotas autenticadas
  return (
    <Switch>
      <Route path="/admin/metrics" component={AdminMetrics} />
      <Route>
        <Layout>
          <RoleGuard>
            <Switch>
              <Route path="/inicio" component={Inicio} />
              <Route path="/" component={Inicio} />
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
              <Route path="/prestadores" component={PrestadoresPage} />
              <Route path="/services" component={Services} />
              <Route path="/business-rules" component={BusinessRules} />
              <Route path="/users" component={UserManagement} />
              <Route path="/company/users" component={CompanyUsers} />
              <Route path="/convite/:token" component={AcceptInvite} />
              <Route path="/admin/audit" component={AdminAudit} />
              <Route path="/ads" component={Ads} />
              <Route path="/superadmin/empresas" component={CompaniesOverview} />
              <Route path="/superadmin/leads" component={LeadsOverview} />

              <Route path="/change-password" component={() => <ChangePassword isRequired={false} />} />
              <Route component={NotFound} />
            </Switch>
          </RoleGuard>
        </Layout>
      </Route>
    </Switch>
  );
}

function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(to);
  }, [to, setLocation]);
  return null;
}

/**
 * RoleGuard — proteção de rota por perfil (front-end, Opção 1).
 * Se o usuário não pode acessar a rota atual, redireciona para seu /inicio.
 * ⚠️ Proteção visual apenas — backend ainda não valida roles por endpoint.
 */
function RoleGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (user && !canAccess(user.role, location)) {
      setLocation(getHomeForRole(user.role));
    }
  }, [user, location, setLocation]);

  // Enquanto redireciona, não renderiza nada para evitar flash da tela bloqueada
  if (user && !canAccess(user.role, location)) return null;

  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <AppRoutes />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
