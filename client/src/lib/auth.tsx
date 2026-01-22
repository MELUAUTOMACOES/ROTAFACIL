import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "./queryClient";
import { buildApiUrl } from "./api-config";
import type { User } from "../../../shared/schema";

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: { name: string; email: string; password: string; username: string }) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  requirePasswordChange: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children?: ReactNode } = {}) {
  if (!children) {
    console.warn("[AuthProvider] Renderizado sem children!");
    return null;
  }
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      } else {
        localStorage.removeItem("token");
      }
    } catch (error) {
      localStorage.removeItem("token");
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    // 🔄 Retry logic para erros de pooler/cold start
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await apiRequest("POST", "/api/auth/login", { email, password });
        const data = await response.json();

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

  const register = async (userData: { name: string; email: string; password: string; username: string }) => {
    const response = await apiRequest("POST", "/api/auth/register", userData);
    const data = await response.json();

    localStorage.setItem("token", data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  const requirePasswordChange = user?.requirePasswordChange || false;

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading, requirePasswordChange }}>
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