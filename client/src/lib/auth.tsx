import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "./queryClient";
import { buildApiUrl } from "./api-config";
import type { User } from "../../../shared/schema";
import type { CompanyOption } from "@/components/CompanySelector";

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
  if (!children) {
    console.warn("[AuthProvider] Renderizado sem children!");
    return null;
  }
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userCompanies, setUserCompanies] = useState<CompanyOption[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
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
        setUser(userData);
        // Carregar lista de empresas a partir das memberships retornadas pelo /me
        if (userData.memberships && userData.memberships.length > 1) {
          // Buscar nomes das empresas do cache ou usar IDs
          const companies: CompanyOption[] = userData.memberships.map((m: any) => ({
            companyId: m.companyId,
            companyRole: m.role,
            companyName: m.companyName || `Empresa #${m.companyId}`,
            companyCnpj: m.companyCnpj || '',
          }));
          setUserCompanies(companies);
        }
      } else {
        localStorage.removeItem("token");
      }
    } catch (error) {
      localStorage.removeItem("token");
    } finally {
      setIsLoading(false);
    }
  };

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

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setUserCompanies([]);
  };

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