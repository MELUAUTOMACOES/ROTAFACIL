import { Response, NextFunction } from "express";

/**
 * Middleware para bloquear acesso baseado no ROLE_LEGADO do usuário (users.role).
 * Uso: requireRole(['admin', 'operador']) -> bloqueia quem não estiver nessa lista, como 'prestador' e 'tecnico'.
 */
export function requireRole(allowedRoles: string[]) {
  return (req: any, res: Response, next: NextFunction) => {
    // Se não tem usuário logado ou a role não está permitida
    if (!req.user || !req.user.role || !allowedRoles.includes(req.user.role)) {
      console.log(`❌ [ACCESS REJECTED] URL: ${req.url} | Usuário = ${req.user?.email || 'N/A'} | Role = ${req.user?.role || 'N/A'} tentou acessar rota restrita`);
      return res.status(403).json({ 
        error: "Acesso negado. Seu perfil não tem permissão para esta ação.",
        yourRole: req.user?.role,
        requiredRoles: allowedRoles
      });
    }
    next();
  };
}
