/**
 * 📊 ADS Metrics Routes
 * 
 * Endpoints para agregação de métricas de tráfego pago da landing page.
 * Usa a tabela analytics_events para gerar insights de marketing.
 * 
 * Endpoints:
 * - GET /api/metrics/ads/overview - KPIs principais
 * - GET /api/metrics/ads/funnel - Funil de conversão
 * - GET /api/metrics/ads/campaigns - Tabela por campanha
 * - GET /api/metrics/ads/behavior - Comportamento (scroll, device)
 * - GET /api/metrics/ads/whatsapp-settings - Configuração do WhatsApp
 * - PUT /api/metrics/ads/whatsapp-settings - Atualizar configuração do WhatsApp
 * - GET /api/metrics/ads/whatsapp - Relatório de clicks no WhatsApp
 */

import type { Express, Request, Response } from "express";
import { db } from "../db";
import { analyticsEvents, adsWhatsappSettings } from "@shared/schema";
import { sql, eq, and, gte, lte, desc } from "drizzle-orm";

/**
 * Helper para calcular datas baseado no período
 */
function getPeriodDates(period: string = "30d"): { startDate: Date; endDate: Date } {
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
        default:
            startDate.setDate(startDate.getDate() - 30);
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
}

/**
 * Registra rotas de métricas ADS
 * Protegidas por authenticateToken (admin only)
 */
export function registerAdsMetricsRoutes(app: Express, authenticateToken: any) {

    // ==================== OVERVIEW (KPIs) ====================
    app.get("/api/metrics/ads/overview", authenticateToken, async (req: Request, res: Response) => {
        try {
            const period = (req.query.period as string) || "30d";
            const { startDate, endDate } = getPeriodDates(period);

            // Total de page_views (distinct sessions)
            const pageViewsResult = await db
                .select({ count: sql<number>`count(DISTINCT ${analyticsEvents.sessionId})` })
                .from(analyticsEvents)
                .where(and(
                    eq(analyticsEvents.eventName, "page_view"),
                    gte(analyticsEvents.createdAt, startDate),
                    lte(analyticsEvents.createdAt, endDate)
                ));
            const totalPageViews = Number(pageViewsResult[0]?.count || 0);

            // Total de signup_complete (conversões)
            const signupsResult = await db
                .select({ count: sql<number>`count(*)` })
                .from(analyticsEvents)
                .where(and(
                    eq(analyticsEvents.eventName, "signup_complete"),
                    gte(analyticsEvents.createdAt, startDate),
                    lte(analyticsEvents.createdAt, endDate)
                ));
            const totalSignups = Number(signupsResult[0]?.count || 0);

            // Taxa de conversão
            const conversionRate = totalPageViews > 0
                ? Math.round((totalSignups / totalPageViews) * 10000) / 100
                : 0;

            // Top source (origem principal)
            const topSourceResult = await db
                .select({
                    source: sql<string>`COALESCE(${analyticsEvents.utmSource}, 'orgânico')`,
                    count: sql<number>`count(DISTINCT ${analyticsEvents.sessionId})`
                })
                .from(analyticsEvents)
                .where(and(
                    eq(analyticsEvents.eventName, "page_view"),
                    gte(analyticsEvents.createdAt, startDate),
                    lte(analyticsEvents.createdAt, endDate)
                ))
                .groupBy(sql`COALESCE(${analyticsEvents.utmSource}, 'orgânico')`)
                .orderBy(desc(sql`count(DISTINCT ${analyticsEvents.sessionId})`))
                .limit(1);

            const topSource = topSourceResult[0]
                ? { name: topSourceResult[0].source, count: Number(topSourceResult[0].count) }
                : { name: "orgânico", count: 0 };

            res.json({
                totalPageViews,
                totalSignups,
                conversionRate,
                topSource,
                period
            });

        } catch (error: any) {
            console.error("❌ [ADS] Erro ao buscar overview:", error.message);
            res.status(500).json({ message: "Erro ao buscar métricas de overview" });
        }
    });

    // ==================== FUNNEL (Funil de Conversão) ====================
    app.get("/api/metrics/ads/funnel", authenticateToken, async (req: Request, res: Response) => {
        try {
            const period = (req.query.period as string) || "30d";
            const { startDate, endDate } = getPeriodDates(period);

            // Eventos do funil na ordem
            const funnelEvents = [
                "page_view",
                "scroll_50",
                "scroll_75",
                "click_cta_principal",
                "signup_start",
                "signup_complete"
            ];

            // Buscar contagem de cada evento (distinct sessions para page_view/scroll)
            const results = await db
                .select({
                    eventName: analyticsEvents.eventName,
                    count: sql<number>`count(DISTINCT ${analyticsEvents.sessionId})`
                })
                .from(analyticsEvents)
                .where(and(
                    gte(analyticsEvents.createdAt, startDate),
                    lte(analyticsEvents.createdAt, endDate)
                ))
                .groupBy(analyticsEvents.eventName);

            // Montar objeto com contagens
            const funnel: Record<string, number> = {};
            funnelEvents.forEach(event => {
                const found = results.find(r => r.eventName === event);
                funnel[event] = found ? Number(found.count) : 0;
            });

            // Calcular taxas de perda entre etapas
            const funnelWithRates = funnelEvents.map((event, index) => {
                const count = funnel[event];
                const previousCount = index > 0 ? funnel[funnelEvents[index - 1]] : count;
                const dropRate = previousCount > 0
                    ? Math.round((1 - count / previousCount) * 100)
                    : 0;

                return {
                    event,
                    count,
                    dropRate: index === 0 ? 0 : dropRate
                };
            });

            res.json({
                funnel: funnelWithRates,
                period
            });

        } catch (error: any) {
            console.error("❌ [ADS] Erro ao buscar funil:", error.message);
            res.status(500).json({ message: "Erro ao buscar funil de conversão" });
        }
    });

    // ==================== CAMPAIGNS (Tabela de Campanhas) ====================
    app.get("/api/metrics/ads/campaigns", authenticateToken, async (req: Request, res: Response) => {
        try {
            const period = (req.query.period as string) || "30d";
            const { startDate, endDate } = getPeriodDates(period);

            // Visitantes por campanha (distinct sessions com page_view)
            const visitorsResult = await db
                .select({
                    utmSource: sql<string>`COALESCE(${analyticsEvents.utmSource}, 'orgânico')`,
                    utmCampaign: sql<string>`COALESCE(${analyticsEvents.utmCampaign}, '-')`,
                    visitors: sql<number>`count(DISTINCT ${analyticsEvents.sessionId})`
                })
                .from(analyticsEvents)
                .where(and(
                    eq(analyticsEvents.eventName, "page_view"),
                    gte(analyticsEvents.createdAt, startDate),
                    lte(analyticsEvents.createdAt, endDate)
                ))
                .groupBy(
                    sql`COALESCE(${analyticsEvents.utmSource}, 'orgânico')`,
                    sql`COALESCE(${analyticsEvents.utmCampaign}, '-')`
                );

            // Conversões por campanha (signup_complete)
            const conversionsResult = await db
                .select({
                    utmSource: sql<string>`COALESCE(${analyticsEvents.utmSource}, 'orgânico')`,
                    utmCampaign: sql<string>`COALESCE(${analyticsEvents.utmCampaign}, '-')`,
                    conversions: sql<number>`count(*)`
                })
                .from(analyticsEvents)
                .where(and(
                    eq(analyticsEvents.eventName, "signup_complete"),
                    gte(analyticsEvents.createdAt, startDate),
                    lte(analyticsEvents.createdAt, endDate)
                ))
                .groupBy(
                    sql`COALESCE(${analyticsEvents.utmSource}, 'orgânico')`,
                    sql`COALESCE(${analyticsEvents.utmCampaign}, '-')`
                );

            // Combinar visitantes e conversões
            const campaignsMap = new Map<string, {
                utmSource: string;
                utmCampaign: string;
                visitors: number;
                conversions: number;
            }>();

            // Adicionar visitantes
            visitorsResult.forEach(row => {
                const key = `${row.utmSource}::${row.utmCampaign}`;
                campaignsMap.set(key, {
                    utmSource: row.utmSource,
                    utmCampaign: row.utmCampaign,
                    visitors: Number(row.visitors),
                    conversions: 0
                });
            });

            // Adicionar conversões
            conversionsResult.forEach(row => {
                const key = `${row.utmSource}::${row.utmCampaign}`;
                const existing = campaignsMap.get(key);
                if (existing) {
                    existing.conversions = Number(row.conversions);
                } else {
                    campaignsMap.set(key, {
                        utmSource: row.utmSource,
                        utmCampaign: row.utmCampaign,
                        visitors: 0,
                        conversions: Number(row.conversions)
                    });
                }
            });

            // Calcular taxa de conversão e ordenar por visitantes
            const campaigns = Array.from(campaignsMap.values())
                .map(c => ({
                    ...c,
                    conversionRate: c.visitors > 0
                        ? Math.round((c.conversions / c.visitors) * 10000) / 100
                        : 0
                }))
                .sort((a, b) => b.visitors - a.visitors);

            res.json({
                campaigns,
                period
            });

        } catch (error: any) {
            console.error("❌ [ADS] Erro ao buscar campanhas:", error.message);
            res.status(500).json({ message: "Erro ao buscar campanhas" });
        }
    });

    // ==================== BEHAVIOR (Comportamento) ====================
    // CORRIGIDO: Engajamento = sessions com scroll_50 / sessions com page_view
    // CORRIGIDO: Dispositivos = distinct sessionId com page_view
    app.get("/api/metrics/ads/behavior", authenticateToken, async (req: Request, res: Response) => {
        try {
            const period = (req.query.period as string) || "30d";
            const { startDate, endDate } = getPeriodDates(period);

            // Total de sessions com page_view (base para engajamento)
            const totalSessionsResult = await db
                .select({ count: sql<number>`count(DISTINCT ${analyticsEvents.sessionId})` })
                .from(analyticsEvents)
                .where(and(
                    eq(analyticsEvents.eventName, "page_view"),
                    gte(analyticsEvents.createdAt, startDate),
                    lte(analyticsEvents.createdAt, endDate)
                ));
            const totalSessions = Number(totalSessionsResult[0]?.count || 0);

            // Sessions com scroll_50
            const scroll50Result = await db
                .select({ count: sql<number>`count(DISTINCT ${analyticsEvents.sessionId})` })
                .from(analyticsEvents)
                .where(and(
                    eq(analyticsEvents.eventName, "scroll_50"),
                    gte(analyticsEvents.createdAt, startDate),
                    lte(analyticsEvents.createdAt, endDate)
                ));
            const scroll50Sessions = Number(scroll50Result[0]?.count || 0);

            // Sessions com scroll_75
            const scroll75Result = await db
                .select({ count: sql<number>`count(DISTINCT ${analyticsEvents.sessionId})` })
                .from(analyticsEvents)
                .where(and(
                    eq(analyticsEvents.eventName, "scroll_75"),
                    gte(analyticsEvents.createdAt, startDate),
                    lte(analyticsEvents.createdAt, endDate)
                ));
            const scroll75Sessions = Number(scroll75Result[0]?.count || 0);

            // Taxa de engajamento = sessions com scroll_50 / sessions com page_view
            const engagementRate = totalSessions > 0
                ? Math.round((scroll50Sessions / totalSessions) * 100)
                : 0;

            // Device breakdown (distinct sessionId com page_view)
            const deviceResult = await db
                .select({
                    deviceType: sql<string>`COALESCE(${analyticsEvents.deviceType}, 'unknown')`,
                    count: sql<number>`count(DISTINCT ${analyticsEvents.sessionId})`
                })
                .from(analyticsEvents)
                .where(and(
                    eq(analyticsEvents.eventName, "page_view"),
                    gte(analyticsEvents.createdAt, startDate),
                    lte(analyticsEvents.createdAt, endDate)
                ))
                .groupBy(sql`COALESCE(${analyticsEvents.deviceType}, 'unknown')`);

            const mobile = Number(deviceResult.find(r => r.deviceType === "mobile")?.count || 0);
            const desktop = Number(deviceResult.find(r => r.deviceType === "desktop")?.count || 0);
            const unknown = Number(deviceResult.find(r => r.deviceType === "unknown")?.count || 0);
            const totalDevices = mobile + desktop + unknown;

            // CTA clicks by position (from eventData)
            const ctaResult = await db
                .select({
                    position: sql<string>`COALESCE(${analyticsEvents.eventData}->>'position', 'unknown')`,
                    count: sql<number>`count(*)`
                })
                .from(analyticsEvents)
                .where(and(
                    eq(analyticsEvents.eventName, "click_cta_principal"),
                    gte(analyticsEvents.createdAt, startDate),
                    lte(analyticsEvents.createdAt, endDate)
                ))
                .groupBy(sql`COALESCE(${analyticsEvents.eventData}->>'position', 'unknown')`);

            const ctaHero = Number(ctaResult.find(r => r.position === "hero")?.count || 0);
            const ctaFooter = Number(ctaResult.find(r => r.position === "footer")?.count || 0);

            res.json({
                scroll: {
                    scroll50: scroll50Sessions,
                    scroll75: scroll75Sessions,
                    engagementRate, // % de sessions que rolaram 50%
                    engagedUsers: scroll50Sessions // Usuários engajados = sessions com scroll_50
                },
                devices: {
                    mobile,
                    desktop,
                    unknown,
                    total: totalDevices,
                    mobilePercentage: totalDevices > 0
                        ? Math.round((mobile / totalDevices) * 100)
                        : 0
                },
                cta: {
                    hero: ctaHero,
                    footer: ctaFooter,
                    total: ctaHero + ctaFooter
                },
                period
            });

        } catch (error: any) {
            console.error("❌ [ADS] Erro ao buscar comportamento:", error.message);
            res.status(500).json({ message: "Erro ao buscar dados de comportamento" });
        }
    });

    // ==================== WHATSAPP SETTINGS ====================

    // GET PÚBLICO - Para a landing page (Home) buscar config sem auth
    app.get("/api/public/whatsapp-settings", async (req: Request, res: Response) => {
        try {
            const result = await db
                .select({
                    whatsappNumber: adsWhatsappSettings.whatsappNumber,
                    defaultMessage: adsWhatsappSettings.defaultMessage
                })
                .from(adsWhatsappSettings)
                .orderBy(desc(adsWhatsappSettings.id))
                .limit(1);

            if (result.length === 0) {
                return res.json({ whatsappNumber: "", defaultMessage: "" });
            }

            res.json(result[0]);
        } catch (error: any) {
            console.error("❌ [ADS] Erro ao buscar config WhatsApp pública:", error.message);
            res.json({ whatsappNumber: "", defaultMessage: "" });
        }
    });

    // GET - Buscar configuração atual (com auth para admin)
    app.get("/api/metrics/ads/whatsapp-settings", authenticateToken, async (req: Request, res: Response) => {
        try {
            // Busca o registro mais recente (ou primeiro com id=1)
            const result = await db
                .select()
                .from(adsWhatsappSettings)
                .orderBy(desc(adsWhatsappSettings.id))
                .limit(1);

            if (result.length === 0) {
                // Retorna configuração padrão se não existir
                return res.json({
                    id: null,
                    whatsappNumber: "",
                    defaultMessage: "Olá! Gostaria de saber mais sobre o RotaFácil.",
                    exists: false
                });
            }

            res.json({
                ...result[0],
                exists: true
            });

        } catch (error: any) {
            console.error("❌ [ADS] Erro ao buscar configuração WhatsApp:", error.message);
            res.status(500).json({ message: "Erro ao buscar configuração do WhatsApp" });
        }
    });

    // PUT - Atualizar configuração
    app.put("/api/metrics/ads/whatsapp-settings", authenticateToken, async (req: Request, res: Response) => {
        try {
            const { whatsappNumber, defaultMessage } = req.body;

            // Validações
            if (!whatsappNumber || typeof whatsappNumber !== "string") {
                console.warn("⚠️ [ADS] Validação falhou: número WhatsApp inválido");
                return res.status(400).json({ message: "Número do WhatsApp é obrigatório" });
            }

            // Validar formato do número (apenas dígitos, mínimo 10)
            const cleanNumber = whatsappNumber.replace(/\D/g, "");
            if (cleanNumber.length < 10) {
                console.warn("⚠️ [ADS] Validação falhou: número muito curto:", cleanNumber);
                return res.status(400).json({ message: "Número deve ter pelo menos 10 dígitos (com DDI)" });
            }

            if (!defaultMessage || typeof defaultMessage !== "string") {
                console.warn("⚠️ [ADS] Validação falhou: mensagem inválida");
                return res.status(400).json({ message: "Mensagem padrão é obrigatória" });
            }

            // Verificar se já existe registro
            const existing = await db
                .select()
                .from(adsWhatsappSettings)
                .limit(1);

            let result;
            if (existing.length > 0) {
                // Atualizar existente
                [result] = await db
                    .update(adsWhatsappSettings)
                    .set({
                        whatsappNumber: cleanNumber,
                        defaultMessage,
                        updatedAt: new Date()
                    })
                    .where(eq(adsWhatsappSettings.id, existing[0].id))
                    .returning();
            } else {
                // Criar novo
                [result] = await db
                    .insert(adsWhatsappSettings)
                    .values({
                        whatsappNumber: cleanNumber,
                        defaultMessage
                    })
                    .returning();
            }

            console.log("✅ [ADS] Configuração WhatsApp salva:", result.id);
            res.json(result);

        } catch (error: any) {
            console.error("❌ [ADS] Erro ao salvar configuração WhatsApp:", error.message);
            res.status(500).json({ message: "Erro ao salvar configuração do WhatsApp" });
        }
    });

    // ==================== WHATSAPP CLICKS REPORT ====================
    app.get("/api/metrics/ads/whatsapp", authenticateToken, async (req: Request, res: Response) => {
        try {
            const period = (req.query.period as string) || "30d";
            const { startDate, endDate } = getPeriodDates(period);

            // Total de clicks no WhatsApp
            const totalResult = await db
                .select({ count: sql<number>`count(*)` })
                .from(analyticsEvents)
                .where(and(
                    eq(analyticsEvents.eventName, "click_whatsapp"),
                    gte(analyticsEvents.createdAt, startDate),
                    lte(analyticsEvents.createdAt, endDate)
                ));
            const totalClicks = Number(totalResult[0]?.count || 0);

            // Breakdown por source (metadata.source ou eventData.source)
            const bySourceResult = await db
                .select({
                    source: sql<string>`COALESCE(${analyticsEvents.eventData}->>'source', 'unknown')`,
                    clicks: sql<number>`count(*)`
                })
                .from(analyticsEvents)
                .where(and(
                    eq(analyticsEvents.eventName, "click_whatsapp"),
                    gte(analyticsEvents.createdAt, startDate),
                    lte(analyticsEvents.createdAt, endDate)
                ))
                .groupBy(sql`COALESCE(${analyticsEvents.eventData}->>'source', 'unknown')`)
                .orderBy(desc(sql`count(*)`));

            const clicksBySource = bySourceResult.map(r => ({
                source: r.source,
                clicks: Number(r.clicks)
            }));

            res.json({
                totalClicks,
                clicksBySource,
                period
            });

        } catch (error: any) {
            console.error("❌ [ADS] Erro ao buscar relatório WhatsApp:", error.message);
            res.status(500).json({ message: "Erro ao buscar relatório do WhatsApp" });
        }
    });

    console.log("✅ Rotas de métricas ADS registradas (/api/metrics/ads/*)");
}
