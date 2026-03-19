/**
 * permissions.ts
 *
 * Helper central de permissões de front-end.
 *
 * ⚠️ ATENÇÃO: Esta é proteção de INTERFACE apenas (Opção 1).
 * O backend ainda não verifica roles por endpoint.
 * A Opção 2 (segurança real no backend) deve ser implementada em seguida.
 */

/**
 * Rotas que cada role pode acessar.
 * Roles não listados aqui (admin, user, operador) têm acesso total.
 */
const ROLE_ALLOWED_PATHS: Record<string, string[]> = {
    prestador: ['/inicio', '/prestadores'],
};

/**
 * Retorna true se o role pode acessar o caminho informado.
 * - admin, user, operador → acesso total (sem restrição).
 * - prestador → somente /inicio e /prestadores (e subpaths deles).
 */
export function canAccess(role: string | undefined, path: string): boolean {
    if (!role) return true;

    // Roles sem restrição especial
    if (role === 'admin' || role === 'user' || role === 'operador') return true;

    // Roles com restrição de rota
    const allowed = ROLE_ALLOWED_PATHS[role];
    if (!allowed) return true; // Role desconhecida: libera por segurança conservadora

    return allowed.some((p) => path === p || path.startsWith(p + '/'));
}

/**
 * Retorna a rota inicial (home) para o role informado.
 * - prestador → /prestadores (tela funcional principal)
 * - demais   → /inicio (home interna padrão)
 */
export function getHomeForRole(role: string | undefined): string {
    if (role === 'prestador') return '/prestadores';
    return '/inicio';
}
