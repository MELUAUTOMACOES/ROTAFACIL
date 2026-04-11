import { Response, NextFunction } from "express";
import type { IStorage } from "../storage";

/**
 * 🔒 VALIDAÇÃO CRÍTICA DE MEMBERSHIP ATIVA
 * 
 * Middleware que garante que o usuário não só tem um JWT válido,
 * mas também que sua membership na empresa atual (req.user.companyId)
 * ainda está ATIVA no banco de dados.
 * 
 * ⚠️ IMPORTANTE:
 * - Deve ser usado APÓS authenticateToken (precisa de req.user)
 * - Bloqueia imediatamente requests com membership inativa
 * - Não depende de polling/frontend para segurança
 * 
 * USO:
 * app.get("/api/rota-empresa", authenticateToken, validateActiveMembership(storage), (req, res) => {
 *   // Se chegou aqui, membership está ativa
 * });
 * 
 * ERRO RETORNADO:
 * 403 { 
 *   error: "MEMBERSHIP_INACTIVE", 
 *   message: "Seu acesso a esta empresa foi desativado"
 * }
 */
export function validateActiveMembership(storage: IStorage) {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      // Se não há companyId no JWT, não é uma rota de empresa (ex: /api/auth/me)
      // Deixa passar para não bloquear rotas globais
      if (!req.user?.companyId) {
        return next();
      }

      const userId = req.user.userId;
      const companyId = req.user.companyId;

      // 🔍 VALIDAÇÃO CRÍTICA: Buscar membership INCLUINDO status isActive
      const membership = await storage.getMembershipIncludingInactive(userId, companyId);

      // Se membership não existe mais
      if (!membership) {
        console.warn(`⚠️ [MEMBERSHIP] Membership REMOVIDA: user ${userId} tentou acessar empresa ${companyId}`);
        return res.status(403).json({
          error: "MEMBERSHIP_NOT_FOUND",
          message: "Você não tem mais acesso a esta empresa. Entre em contato com o administrador.",
          companyId: companyId
        });
      }

      // 🔒 BLOQUEIO CRÍTICO: Se membership existe mas está INATIVA
      if (!membership.isActive) {
        console.warn(`🚫 [MEMBERSHIP] Acesso BLOQUEADO: user ${userId} → empresa ${companyId} (membership inativa)`);
        return res.status(403).json({
          error: "MEMBERSHIP_INACTIVE",
          message: "Seu acesso a esta empresa foi desativado. Entre em contato com o administrador.",
          companyId: companyId
        });
      }

      // ✅ Membership existe e está ativa - permite request
      // Log removido para não poluir (validação acontece a cada request)
      next();

    } catch (error: any) {
      console.error(`❌ [MEMBERSHIP] Erro ao validar membership:`, error);
      return res.status(500).json({ 
        error: "MEMBERSHIP_VALIDATION_ERROR",
        message: "Erro ao validar acesso. Tente novamente." 
      });
    }
  };
}
