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
 */

import type { Express, Request, Response } from "express";
import { db } from "../db";
import { analyticsEvents } from "@shared/schema";
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

            // Total de page_views
            const pageViewsResult = await db
                .select({ count: sql<number>`count(*)` })
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
                    count: sql<number>`count(*)`
                })
                .from(analyticsEvents)
                .where(and(
                    eq(analyticsEvents.eventName, "page_view"),
                    gte(analyticsEvents.createdAt, startDate),
                    lte(analyticsEvents.createdAt, endDate)
                ))
                .groupBy(sql`COALESCE(${analyticsEvents.utmSource}, 'orgânico')`)
                .orderBy(desc(sql`count(*)`))
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

            // Buscar contagem de cada evento
            const results = await db
                .select({
                    eventName: analyticsEvents.eventName,
                    count: sql<number>`count(*)`
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

            // Visitantes por campanha (page_view)
            const visitorsResult = await db
                .select({
                    utmSource: sql<string>`COALESCE(${analyticsEvents.utmSource}, 'orgânico')`,
                    utmCampaign: sql<string>`COALESCE(${analyticsEvents.utmCampaign}, '-')`,
                    visitors: sql<number>`count(*)`
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
    app.get("/api/metrics/ads/behavior", authenticateToken, async (req: Request, res: Response) => {
        try {
            const period = (req.query.period as string) || "30d";
            const { startDate, endDate } = getPeriodDates(period);

            // Scroll metrics (50% vs 75%)
            const scrollResult = await db
                .select({
                    eventName: analyticsEvents.eventName,
                    count: sql<number>`count(*)`
                })
                .from(analyticsEvents)
                .where(and(
                    sql`${analyticsEvents.eventName} IN ('scroll_50', 'scroll_75')`,
                    gte(analyticsEvents.createdAt, startDate),
                    lte(analyticsEvents.createdAt, endDate)
                ))
                .groupBy(analyticsEvents.eventName);

            const scroll50 = Number(scrollResult.find(r => r.eventName === "scroll_50")?.count || 0);
            const scroll75 = Number(scrollResult.find(r => r.eventName === "scroll_75")?.count || 0);

            // Device breakdown (mobile vs desktop)
            const deviceResult = await db
                .select({
                    deviceType: analyticsEvents.deviceType,
                    count: sql<number>`count(DISTINCT ${analyticsEvents.sessionId})`
                })
                .from(analyticsEvents)
                .where(and(
                    eq(analyticsEvents.eventName, "page_view"),
                    gte(analyticsEvents.createdAt, startDate),
                    lte(analyticsEvents.createdAt, endDate)
                ))
                .groupBy(analyticsEvents.deviceType);

            const mobile = Number(deviceResult.find(r => r.deviceType === "mobile")?.count || 0);
            const desktop = Number(deviceResult.find(r => r.deviceType === "desktop")?.count || 0);
            const totalDevices = mobile + desktop;

            // CTA clicks by position (from eventData)
            const ctaResult = await db
                .select({
                    position: sql<string>`${analyticsEvents.eventData}->>'position'`,
                    count: sql<number>`count(*)`
                })
                .from(analyticsEvents)
                .where(and(
                    eq(analyticsEvents.eventName, "click_cta_principal"),
                    gte(analyticsEvents.createdAt, startDate),
                    lte(analyticsEvents.createdAt, endDate)
                ))
                .groupBy(sql`${analyticsEvents.eventData}->>'position'`);

            const ctaHero = Number(ctaResult.find(r => r.position === "hero")?.count || 0);
            const ctaFooter = Number(ctaResult.find(r => r.position === "footer")?.count || 0);

            res.json({
                scroll: {
                    scroll50,
                    scroll75,
                    engagementRate: scroll50 > 0
                        ? Math.round((scroll75 / scroll50) * 100)
                        : 0
                },
                devices: {
                    mobile,
                    desktop,
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

    console.log("✅ Rotas de métricas ADS registradas (/api/metrics/ads/*)");
}
