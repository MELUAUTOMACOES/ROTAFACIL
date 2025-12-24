/**
 * Rotas de Auditoria para Admin de Empresa
 * Permite visualizar logs de auditoria da empresa
 */

import type { Express, Response } from "express";
import { db } from "../db";
import { companyAuditLogs, users } from "@shared/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

export function registerAuditRoutes(app: Express, authenticateToken: any) {

    // Middleware para verificar se é admin
    function requireAdmin(req: any, res: Response, next: any) {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ message: "Acesso restrito a administradores" });
        }
        next();
    }

    // Listar auditoria da empresa (paginado)
    app.get(
        "/api/admin/audit",
        authenticateToken,
        requireAdmin,
        async (req: any, res: Response) => {
            try {
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 50;
                const offset = (page - 1) * limit;

                // Filtros opcionais
                const feature = req.query.feature as string;
                const action = req.query.action as string;
                const userId = req.query.userId ? parseInt(req.query.userId as string) : null;
                const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
                const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;

                // Para usuários sem companyId, usar o próprio userId como filtro (owner da conta)
                const userIdToFilter = req.user.companyId ? null : req.user.userId;
                const companyIdToFilter = req.user.companyId;

                // Construir condições
                const conditions = [];

                // Filtrar por empresa OU por userId do owner
                if (companyIdToFilter) {
                    conditions.push(eq(companyAuditLogs.companyId, companyIdToFilter));
                } else if (userIdToFilter) {
                    conditions.push(eq(companyAuditLogs.userId, userIdToFilter));
                }

                if (feature) {
                    conditions.push(eq(companyAuditLogs.feature, feature));
                }
                if (action) {
                    conditions.push(eq(companyAuditLogs.action, action));
                }
                if (userId) {
                    conditions.push(eq(companyAuditLogs.userId, userId));
                }
                if (startDate) {
                    conditions.push(gte(companyAuditLogs.createdAt, startDate));
                }
                if (endDate) {
                    const endOfDay = new Date(endDate);
                    endOfDay.setHours(23, 59, 59, 999);
                    conditions.push(lte(companyAuditLogs.createdAt, endOfDay));
                }

                const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

                // Buscar logs
                const logs = await db
                    .select()
                    .from(companyAuditLogs)
                    .where(whereClause)
                    .orderBy(desc(companyAuditLogs.createdAt))
                    .limit(limit)
                    .offset(offset);

                // Contar total
                const [{ count }] = await db
                    .select({ count: sql<number>`count(*)` })
                    .from(companyAuditLogs)
                    .where(whereClause);

                res.json({
                    data: logs,
                    pagination: {
                        page,
                        limit,
                        total: Number(count),
                        totalPages: Math.ceil(Number(count) / limit),
                    },
                });
            } catch (error: any) {
                console.error("[AUDIT] Erro ao buscar auditoria:", error);
                res.status(500).json({ message: "Erro ao buscar auditoria" });
            }
        }
    );

    // Listar usuários da empresa (para filtro)
    app.get(
        "/api/admin/audit/users",
        authenticateToken,
        requireAdmin,
        async (req: any, res: Response) => {
            try {
                // Buscar usuários únicos que aparecem na auditoria
                const companyIdToFilter = req.user.companyId;
                const userIdToFilter = req.user.companyId ? null : req.user.userId;

                const conditions = [];
                if (companyIdToFilter) {
                    conditions.push(eq(companyAuditLogs.companyId, companyIdToFilter));
                } else if (userIdToFilter) {
                    conditions.push(eq(companyAuditLogs.userId, userIdToFilter));
                }

                const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

                const usersInAudit = await db
                    .selectDistinct({
                        userId: companyAuditLogs.userId,
                        userName: companyAuditLogs.userName,
                    })
                    .from(companyAuditLogs)
                    .where(whereClause);

                res.json(usersInAudit);
            } catch (error: any) {
                console.error("[AUDIT] Erro ao buscar usuários:", error);
                res.status(500).json({ message: "Erro ao buscar usuários" });
            }
        }
    );

    // Estatísticas de auditoria
    app.get(
        "/api/admin/audit/stats",
        authenticateToken,
        requireAdmin,
        async (req: any, res: Response) => {
            try {
                const companyIdToFilter = req.user.companyId;
                const userIdToFilter = req.user.companyId ? null : req.user.userId;

                const conditions = [];
                if (companyIdToFilter) {
                    conditions.push(eq(companyAuditLogs.companyId, companyIdToFilter));
                } else if (userIdToFilter) {
                    conditions.push(eq(companyAuditLogs.userId, userIdToFilter));
                }

                // Últimas 24 horas
                const oneDayAgo = new Date();
                oneDayAgo.setDate(oneDayAgo.getDate() - 1);
                conditions.push(gte(companyAuditLogs.createdAt, oneDayAgo));

                const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

                const [{ count }] = await db
                    .select({ count: sql<number>`count(*)` })
                    .from(companyAuditLogs)
                    .where(whereClause);

                // Top features
                const topFeatures = await db
                    .select({
                        feature: companyAuditLogs.feature,
                        count: sql<number>`count(*)`,
                    })
                    .from(companyAuditLogs)
                    .where(whereClause)
                    .groupBy(companyAuditLogs.feature)
                    .orderBy(desc(sql`count(*)`))
                    .limit(5);

                res.json({
                    actionsToday: Number(count),
                    topFeatures,
                });
            } catch (error: any) {
                console.error("[AUDIT] Erro ao buscar estatísticas:", error);
                res.status(500).json({ message: "Erro ao buscar estatísticas" });
            }
        }
    );

    console.log("✅ Rotas de auditoria registradas (/api/admin/audit/*)");
}
