/**
 * auth.middleware.ts
 *
 * Middleware de autenticação JWT real — compartilhado entre routes.ts e routes.api.ts.
 * Extrai userId, companyId, role, isSuperAdmin do token JWT e popula req.user.
 *
 * ⚠️  NUNCA usar DEV_MODE=true em produção!
 */

import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { isAccessAllowed, getAccessDeniedMessage } from "../access-schedule-validator";

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "development_jwt_secret_key_32_characters_long_minimum_for_security_rotafacil_2025";

export function authenticateToken(req: any, res: any, next: any) {
    // 🚨 DEV MODE BYPASS — ⚠️ NUNCA habilitar em produção!
    if (process.env.DEV_MODE === "true") {
        console.warn("");
        console.warn("⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️");
        console.warn("🚨 ALERTA DE SEGURANÇA: DEV_MODE ATIVO! 🚨");
        console.warn("⚠️  TODOS OS USUÁRIOS ESTÃO SENDO TRATADOS COMO ADMIN!");
        console.warn("⚠️  DESATIVE IMEDIATAMENTE EM PRODUÇÃO!");
        console.warn("⚠️  Defina DEV_MODE=false no arquivo .env");
        console.warn("⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️");
        console.warn("");

        req.user = {
            userId: 1,
            email: "dev@rotafacil.com",
            name: "Dev User",
            plan: "premium",
            role: "admin",
        };
        return next();
    }

    // 🔐 Autenticação real via JWT
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        console.log("❌ [AUTH] Token não fornecido");
        return res.status(401).json({ message: "Access token required" });
    }

    jwt.verify(token, JWT_SECRET, async (err: any, decoded: any) => {
        if (err) {
            console.log("❌ [AUTH] Token inválido:", err.message);
            return res.status(403).json({ message: "Invalid token" });
        }

        try {
            const user = await storage.getUserById(decoded.userId);

            if (!user) {
                console.log("❌ [AUTH] Usuário não encontrado:", decoded.userId);
                return res.status(403).json({ message: "User not found" });
            }

            // Verificar se a senha foi alterada após a emissão do token
            if (user.passwordChangedAt) {
                const passwordChangedTimestamp = Math.floor(
                    user.passwordChangedAt.getTime() / 1000
                );
                const tokenIssuedAt = decoded.iat;

                if (passwordChangedTimestamp > tokenIssuedAt) {
                    console.log(
                        "⚠️ [AUTH] Token inválido: senha alterada após emissão do token"
                    );
                    return res.status(403).json({
                        message:
                            "Token expired due to password change. Please login again.",
                    });
                }
            }

            // Popula req.user com todos os dados de identidade e empresa
            req.user = {
                id: decoded.userId,
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role || "user",
                companyId: decoded.companyId,        // 🔑 essencial para multi-tenancy
                companyRole: decoded.companyRole,
                isSuperAdmin: user.isSuperAdmin || false,
            };

            // 🕒 Validação de horário de acesso
            if (user.accessScheduleId) {
                try {
                    const schedule = await storage.getAccessScheduleById(
                        user.accessScheduleId
                    );

                    if (schedule) {
                        const allowed = isAccessAllowed(schedule);
                        if (!allowed) {
                            const message = getAccessDeniedMessage(schedule);
                            console.log(
                                `❌ [AUTH] Acesso negado para ${user.email} — ${message}`
                            );
                            return res.status(403).json({ message });
                        }
                    }
                } catch (error) {
                    console.error("❌ [AUTH] Erro ao verificar horário de acesso:", error);
                    // Em caso de erro, liberar acesso
                }
            }

            next();
        } catch (error) {
            console.error("❌ [AUTH] Erro ao verificar token:", error);
            return res.status(500).json({ message: "Authentication error" });
        }
    });
}
