import { Response, NextFunction } from "express";

/**
 * Middleware para bloquear acesso baseado na ROLE DA EMPRESA (memberships.role).
 * Uso: requireRole(['admin', 'operador']) -> bloqueia quem não estiver nessa lista.
 * Aceita roles em maiúsculo ou minúsculo (case-insensitive).
 * 
 * IMPORTANTE: Usa req.user.companyRole (role da empresa atual) em vez de req.user.role (global).
 */
export function requireRole(allowedRoles: string[]) {
  return (req: any, res: Response, next: NextFunction) => {
    // Normalizar role da empresa e roles permitidas para lowercase
    const userRole = (req.user?.companyRole || req.user?.role || '').toLowerCase();
    const normalizedAllowedRoles = allowedRoles.map(r => r.toLowerCase());
    
    // Se não tem usuário logado ou a role não está permitida
    if (!req.user || !userRole || !normalizedAllowedRoles.includes(userRole)) {
      console.log(`❌ [ACCESS REJECTED] URL: ${req.url} | Usuário = ${req.user?.email || 'N/A'} | CompanyRole = ${req.user?.companyRole || 'N/A'} tentou acessar rota restrita`);
      return res.status(403).json({ 
        error: "Acesso negado. Seu perfil não tem permissão para esta ação.",
        yourRole: req.user?.companyRole || req.user?.role,
        requiredRoles: allowedRoles
      });
    }
    next();
  };
}
