/**
 * Normaliza respostas de APIs paginadas
 * Suporta: array direto, {items: []}, {data: []}
 */
export function normalizeItems<T>(data: any): T[] {
    if (Array.isArray(data)) return data as T[];
    if (data && Array.isArray(data.items)) return data.items as T[];
    if (data && Array.isArray(data.data)) return data.data as T[];
    return [];
}

// Alias para compatibilidade
export const normalizeList = normalizeItems;

/**
 * Extrai informações de paginação de resposta
 */
export function normalizePagination(data: any) {
    if (data && data.pagination) return data.pagination;
    return { page: 1, pageSize: 25, total: 0, totalPages: 1 };
}
