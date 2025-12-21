import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";

/**
 * Middleware para verificar se o usuário é superadmin (fundador)
 * Deve ser usado APÓS o authenticateToken
 */
export function requireSuperAdmin(req: any, res: Response, next: NextFunction) {
    const isSuperAdmin = req.user?.isSuperAdmin || req.user?.email === 'lucaspmastaler@gmail.com';

    if (!isSuperAdmin) {
        return res.status(403).json({
            message: "Acesso restrito ao administrador master"
        });
    }
    next();
}

/**
 * Helper para registrar uso de features (fire-and-forget)
 * Não bloqueia a requisição, apenas registra em background
 */
export async function trackFeatureUsage(
    userId: number,
    feature: string,
    action: string,
    companyId?: number | null,
    metadata?: object
): Promise<void> {
    console.log(`📊 [METRICS] Rastreando: ${feature}.${action} (User: ${userId}, Company: ${companyId})`);
    try {
        const result = await storage.createFeatureUsage({
            userId,
            companyId: companyId || null,
            feature,
            action,
            metadata: metadata || null,
        });
        console.log(`✅ [METRICS] Salvo com sucesso! ID: ${result.id}`);
    } catch (error: any) {
        // Log detalhado para debug
        console.error("❌ [METRICS] Erro FATAL ao salvar métrica:", error.message);
        if (error.code) console.error("   Code:", error.code);
        if (error.detail) console.error("   Detail:", error.detail);
    }
}

/**
 * Registra rotas de métricas
 * Todas protegidas por requireSuperAdmin
 */
export function registerMetricsRoutes(app: Express, authenticateToken: any) {

    // Overview geral das métricas
    app.get(
        "/api/admin/metrics/overview",
        authenticateToken,
        requireSuperAdmin,
        async (req: Request, res: Response) => {
            try {
                const overview = await storage.getMetricsOverview();
                res.json(overview);
            } catch (error) {
                console.error("[Metrics] Erro ao buscar overview:", error);
                res.status(500).json({ message: "Erro ao buscar métricas" });
            }
        }
    );

    // Top features mais usadas
    app.get(
        "/api/admin/metrics/top-features",
        authenticateToken,
        requireSuperAdmin,
        async (req: Request, res: Response) => {
            try {
                const limit = parseInt(req.query.limit as string) || 20;
                const period = (req.query.period as string) || "30d";

                const { startDate, endDate } = getPeriodDates(period);

                const topFeatures = await storage.getTopFeatures(limit, startDate, endDate);
                res.json(topFeatures);
            } catch (error) {
                console.error("[Metrics] Erro ao buscar top features:", error);
                res.status(500).json({ message: "Erro ao buscar features" });
            }
        }
    );

    // Atividade de usuários por dia
    app.get(
        "/api/admin/metrics/users-activity",
        authenticateToken,
        requireSuperAdmin,
        async (req: Request, res: Response) => {
            try {
                const period = (req.query.period as string) || "30d";
                const { startDate, endDate } = getPeriodDates(period);

                const activity = await storage.getUsersActivityByDay(startDate, endDate);
                res.json(activity);
            } catch (error) {
                console.error("[Metrics] Erro ao buscar atividade:", error);
                res.status(500).json({ message: "Erro ao buscar atividade" });
            }
        }
    );

    // Detalhamento de uso por feature
    app.get(
        "/api/admin/metrics/features",
        authenticateToken,
        requireSuperAdmin,
        async (req: Request, res: Response) => {
            try {
                const period = (req.query.period as string) || "30d";
                const { startDate, endDate } = getPeriodDates(period);

                const usage = await storage.getFeatureUsageByPeriod(startDate, endDate);
                res.json(usage);
            } catch (error) {
                console.error("[Metrics] Erro ao buscar uso de features:", error);
                res.status(500).json({ message: "Erro ao buscar uso" });
            }
        }
    );

    console.log("✅ Rotas de métricas registradas (/api/admin/metrics/*)");
}

/**
 * Helper para calcular datas baseado no período
 */
function getPeriodDates(period: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
        case "7d":
            startDate.setDate(startDate.getDate() - 7);
            break;
        case "30d":
            startDate.setDate(startDate.getDate() - 30);
            break;
        case "90d":
            startDate.setDate(startDate.getDate() - 90);
            break;
        case "365d":
            startDate.setDate(startDate.getDate() - 365);
            break;
        default:
            startDate.setDate(startDate.getDate() - 30);
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
}
