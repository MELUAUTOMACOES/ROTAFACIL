import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { buildApiUrl } from "./api-config";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let errorMessage = `${res.status}: ${text}`;
    let code = undefined;
    let errorCode = undefined;
    let companyId = undefined;
    
    try {
      const parsed = JSON.parse(text);
      if (parsed.message) {
        errorMessage = parsed.message;
      } else if (parsed.error) {
        errorMessage = parsed.error;
      }
      code = parsed.code;
      errorCode = parsed.error; // Backend retorna: { error: "MEMBERSHIP_INACTIVE", message: "...", companyId: 2 }
      companyId = parsed.companyId;
    } catch (e) {
      // Not JSON, keep default format
    }
    
    // 🔒 MEMBERSHIP INVÁLIDA: Tratar diferente de logout genérico
    // Preserva autenticação global, mas redireciona para Hall
    if (res.status === 403 && (errorCode === "MEMBERSHIP_INACTIVE" || errorCode === "MEMBERSHIP_NOT_FOUND")) {
      console.warn(`⚠️ [MEMBERSHIP] Empresa atual inválida detectada pelo backend:`, errorCode);
      const event = new CustomEvent("membership-invalidated", { 
        detail: { 
          message: errorMessage, 
          errorCode,
          companyId 
        } 
      });
      window.dispatchEvent(event);
      throw new Error(errorMessage);
    }
    
    // 🔐 UNAUTHORIZED genérico (401): Logout padrão
    if (res.status === 401) {
       const event = new CustomEvent("unauthorized", { detail: { message: errorMessage, code } });
       window.dispatchEvent(event);
    }
    
    throw new Error(errorMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(buildApiUrl(url), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
    async ({ queryKey }) => {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(buildApiUrl(queryKey[0] as string), {
        credentials: "include",
        headers,
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
