/**
 * 🔐 LGPD Middleware
 * 
 * Middleware para verificar se o usuário aceitou os termos LGPD.
 * Bloqueia acesso às rotas privadas se lgpdAccepted = false.
 */

import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

// Lista de rotas que NÃO requerem aceite LGPD (exceções)
const LGPD_EXEMPT_ROUTES = [
    "/api/auth/me",
    "/api/auth/logout",
    "/api/lgpd/accept",
    // Rotas públicas de autenticação
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/verify-email",
    "/api/auth/set-password",
    // Analytics público (landing page)
    "/api/metrics/event",
];

/**
 * Middleware que verifica se o usuário aceitou os termos LGPD.
 * Deve ser aplicado APÓS o middleware de autenticação (authenticateToken).
 * 
 * Se o usuário não aceitou os termos, retorna 403 com lgpdRequired: true.
 * O frontend deve redirecionar para /lgpd quando receber esta resposta.
 */
export function requireLgpdAccepted(req: Request & { user?: any }, res: Response, next: NextFunction) {
    // Se não está autenticado, deixa passar (outro middleware tratará)
    if (!req.user) {
        return next();
    }

    // Verifica se a rota está na lista de exceções
    const path = req.path.toLowerCase();
    const isExempt = LGPD_EXEMPT_ROUTES.some(route => path.startsWith(route.toLowerCase()));

    if (isExempt) {
        return next();
    }

    // Buscar usuário no banco para verificar lgpdAccepted
    storage.getUserById(req.user.userId)
        .then(user => {
            if (!user) {
                console.log(`⚠️ [LGPD] Usuário não encontrado: ${req.user.userId}`);
                return res.status(403).json({ message: "Usuário não encontrado" });
            }

            // Verifica se LGPD foi aceita
            if (!user.lgpdAccepted) {
                console.log(`📋 [LGPD] Bloqueando acesso: userId=${user.id}, path=${req.path}`);
                return res.status(403).json({
                    message: "É necessário aceitar os termos LGPD para continuar",
                    lgpdRequired: true,
                });
            }

            // LGPD aceita, prossegue normalmente
            next();
        })
        .catch(error => {
            console.error(`❌ [LGPD] Erro ao verificar aceite:`, error);
            res.status(500).json({ message: "Erro interno ao verificar aceite LGPD" });
        });
}

export default requireLgpdAccepted;
