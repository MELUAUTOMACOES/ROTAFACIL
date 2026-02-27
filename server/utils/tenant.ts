/**
 * tenant.ts — Helpers centralizados para multi-tenancy (companyId obrigatório).
 *
 * ❌ NUNCA filtrar domínio por userId.
 * ✅ Sempre usar requireCompanyId() + byCompany() em queries de domínio.
 * userId só pode existir para: audit (ator), autenticação, identidade.
 */

import { eq } from "drizzle-orm";

/**
 * Extrai companyId do req.user. Se ausente, responde 401 e retorna null.
 * Uso:
 *   const companyId = requireCompanyId(req, res);
 *   if (!companyId) return;
 */
export function requireCompanyId(req: any, res: any): number | null {
  const companyId: number | undefined | null = req.user?.companyId;
  if (!companyId) {
    res.status(401).json({ error: "companyId ausente no JWT — acesso negado" });
    return null;
  }
  return companyId;
}

/**
 * Retorna condição Drizzle `eq(table.companyId, companyId)`.
 * companyId DEVE ser validado antes (usar requireCompanyId).
 */
export function byCompany(table: any, companyId: number) {
  return eq(table.companyId, companyId);
}
