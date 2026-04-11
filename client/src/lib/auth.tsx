import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { apiRequest } from "./queryClient";
import { buildApiUrl } from "./api-config";
import type { User } from "../../../shared/schema";
import type { CompanyOption } from "@/components/CompanySelector";
import { toast } from "@/hooks/use-toast";

// Tipo estendido com campos multi-tenant retornados pelo backend (não estão na tabela users)
export interface AuthUser extends User {
  companyId?: number;
  companyRole?: string;
  company?: { id: number; name: string };
  memberships?: Array<{
    companyId: number;
    role: string;
    isActive: boolean;
    companyName?: string;
    companyCnpj?: string;
  }>;
}

// Resposta do login quando exige seleção de empresa
export interface CompanySelectionData {
  requireCompanySelection: true;
  userId: number;
  userName: string;
  companies: CompanyOption[];
  selectionToken: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<CompanySelectionData | void>;
  selectCompany: (selectionToken: string, companyId: number) => Promise<void>;
  switchCompany: (companyId: number) => Promise<void>;
  register: (userData: { name: string; email: string; password: string; username: string }) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  requirePasswordChange: boolean;
  userCompanies: CompanyOption[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children?: ReactNode } = {}) {
  // ✅ TODOS OS HOOKS DEVEM FICAR AQUI — ANTES de qualquer return condicional
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userCompanies, setUserCompanies] = useState<CompanyOption[]>([]);
  const [previousCompanyId, setPreviousCompanyId] = useState<number | undefined>();

  // ✅ Estabilizar logout com useCallback
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
    setUserCompanies([]);
  }, []);

  // ✅ Estabilizar checkAuth com useCallback
  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await fetch(buildApiUrl("/api/auth/me"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        
        // 🔒 VALIDAÇÃO CRÍTICA: Detectar se empresa atual ficou inválida
        const hadCompanyId = previousCompanyId !== undefined;
        const hasCompanyId = userData.companyId !== undefined;
        
        if (hadCompanyId && !hasCompanyId) {
          // Empresa atual PERDEU VALIDADE durante a sessão
          console.warn('⚠️ [AUTH] Empresa atual ficou INVÁLIDA. Redirecionando para Hall...');
          
          // Disparar evento personalizado para App.tsx interceptar
          window.dispatchEvent(new CustomEvent('company-invalidated', {
            detail: { previousCompanyId, userData }
          }));
        }
        
        setPreviousCompanyId(userData.companyId);
        setUser(userData);
        
        // Carregar lista de empresas a partir das memberships retornadas pelo /me
        if (userData.memberships && userData.memberships.length >= 1) {
          const companies: CompanyOption[] = userData.memberships
            .filter((m: any) => m.isActive) // Só empresas ativas
            .map((m: any) => ({
              companyId: m.companyId,
              companyRole: m.role,
              companyName: m.companyName || `Empresa #${m.companyId}`,
              companyCnpj: m.companyCnpj || '',
            }));
          setUserCompanies(companies);
        } else {
          setUserCompanies([]);
        }
      } else {
        localStorage.removeItem("token");
      }
    } catch (error) {
      localStorage.removeItem("token");
    } finally {
      setIsLoading(false);
    }
  }, [previousCompanyId]);

  // ✅ useEffect com listeners estáveis
  useEffect(() => {
    checkAuth();

    // 🔄 REVALIDAÇÃO PERIÓDICA: Verificar a cada 30s se a empresa atual ainda é válida
    const intervalId = setInterval(() => {
      const token = localStorage.getItem("token");
      if (token) {
        console.log('[AUTH] Revalidando sessão...');
        checkAuth();
      }
    }, 30000); // 30 segundos

    // 🔐 UNAUTHORIZED genérico (401): Logout global
    const handleUnauthorized = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.code === "SYSTEM_UPDATED") {
        toast({
          title: "Sistema Atualizado",
          description: detail.message || "Sua sessão expirou devido a uma atualização do sistema. Faça login novamente.",
          variant: "destructive",
        });
      }
      setTimeout(() => {
        logout();
        window.location.href = '/login';
      }, 500);
    };

    // 🔒 MEMBERSHIP INVÁLIDA (403 do backend): Preservar autenticação, limpar empresa, ir para Hall
    const handleMembershipInvalidated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.warn('⚠️ [AUTH] Membership invalidada pelo backend:', detail);
      
      toast({
        title: "Acesso à empresa removido",
        description: detail.message || "Seu acesso a esta empresa foi desativado. Selecione outra empresa ou entre em contato com o administrador.",
        variant: "destructive",
      });

      // Atualizar contexto para limpar empresa atual (mantém autenticação global)
      setUser(prev => {
        if (!prev) return null;
        return {
          ...prev,
          companyId: undefined,
          companyRole: undefined,
          company: undefined,
        };
      });

      // Disparar evento para App.tsx forçar AccessPending
      window.dispatchEvent(new CustomEvent('force-access-pending'));
    };

    window.addEventListener("unauthorized", handleUnauthorized);
    window.addEventListener("membership-invalidated", handleMembershipInvalidated as EventListener);
    
    return () => {
      window.removeEventListener("unauthorized", handleUnauthorized);
      window.removeEventListener("membership-invalidated", handleMembershipInvalidated as EventListener);
      clearInterval(intervalId);
    };
  }, [checkAuth, logout]);

  const login = async (email: string, password: string): Promise<CompanySelectionData | void> => {
    // 🔄 Retry logic para erros de pooler/cold start
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await apiRequest("POST", "/api/auth/login", { email, password });
        const data = await response.json();

        // 🏢 MULTI-TENANT: Se backend exige seleção de empresa
        if (data.requireCompanySelection) {
          return data as CompanySelectionData;
        }

        localStorage.setItem("token", data.token);
        setUser(data.user);
        return; // Sucesso, sai da função
      } catch (error: any) {
        lastError = error;

        // Se for erro 503 (Service Unavailable - pooler timeout) e ainda há tentativas
        if (error.message?.includes("503") && attempt < maxRetries) {
          console.log(`⚠️ [LOGIN] Tentativa ${attempt} falhou com erro 503 (pooler timeout). Tentando novamente em 1s...`);
          // Aguardar 1 segundo antes de tentar novamente
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // Se não é erro 503 ou não há mais tentativas, lança o erro
        throw error;
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    throw lastError;
  };

  // 🏢 MULTI-TENANT: Selecionar empresa após login (2ª etapa)
  const selectCompany = async (selectionToken: string, companyId: number) => {
    const response = await apiRequest("POST", "/api/auth/select-company", {
      selectionToken,
      companyId,
    });
    const data = await response.json();
    localStorage.setItem("token", data.token);
    setUser(data.user);
    // Re-carregar dados completos para popular userCompanies imediatamente
    // (sem isso, o seletor de empresa só aparece após um page refresh)
    await checkAuth();
  };

  // 🏢 MULTI-TENANT: Trocar de empresa após já estar logado
  const switchCompany = async (companyId: number) => {
    const response = await apiRequest("POST", "/api/auth/switch-company", { companyId });
    const data = await response.json();
    localStorage.setItem("token", data.token);
    setUser(data.user);
    // Invalidar cache do react-query para recarregar dados da nova empresa
    const { queryClient } = await import("./queryClient");
    queryClient.invalidateQueries();
  };

  const register = async (userData: { name: string; email: string; password: string; username: string }) => {
    const response = await apiRequest("POST", "/api/auth/register", userData);
    const data = await response.json();

    localStorage.setItem("token", data.token);
    setUser(data.user);
  };

  // logout já definido acima com useCallback

  const requirePasswordChange = user?.requirePasswordChange || false;

  return (
    <AuthContext.Provider value={{ user, login, selectCompany, switchCompany, register, logout, isLoading, requirePasswordChange, userCompanies }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Utility function to get auth headers
export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}