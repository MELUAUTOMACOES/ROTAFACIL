/**
 * API Configuration Helper
 * 
 * Gerencia a URL base da API para suportar:
 * - Desenvolvimento: usa proxy do Vite (/api/... → localhost:5000/api/...)
 * - Produção: usa VITE_API_URL (ex: https://api.meluautomacao.com)
 */

/**
 * Retorna a base URL da API
 * - Em produção (VITE_API_URL definido): retorna a URL sem barra final
 * - Em dev (sem VITE_API_URL): retorna "" para requests relativas (proxy Vite)
 */
export function getApiBaseUrl(): string {
    const envUrl = import.meta.env.VITE_API_URL;

    if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
        // Remove barra final se existir
        return envUrl.trim().replace(/\/+$/, '');
    }

    // Em dev, retornar vazio para usar proxy do Vite
    return '';
}

/**
 * Monta URL completa da API
 * - Em produção: https://api.meluautomacao.com/api/clients
 * - Em dev: /api/clients (proxy resolve)
 */
export function buildApiUrl(path: string): string {
    const base = getApiBaseUrl();

    // Garantir que path começa com /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    return `${base}${cleanPath}`;
}
