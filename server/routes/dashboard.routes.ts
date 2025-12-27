import type { Express } from "express";
import { db } from "../db";
import {
    appointments,
    routes,
    routeStops,
    services,
    technicians,
    teams,

    clients,
    vehicles,
    vehicleDocuments
} from "@shared/schema";
import { eq, and, sql, gte, lte, or, isNull, desc, ne } from "drizzle-orm";

export function registerDashboardRoutes(app: Express, authenticateToken: any) {

    // ==================== ROTAS EM ANDAMENTO ====================

    // GET /api/dashboard/routes-in-progress - Rotas que estão em andamento agora
    app.get("/api/dashboard/routes-in-progress", authenticateToken, async (req: any, res) => {
        try {
            console.log("📊 [DASHBOARD] Buscando rotas em andamento");

            // Rotas com status confirmado e que já foram iniciadas
            const inProgressRoutes = await db
                .select()
                .from(routes)
                .where(
                    and(
                        eq(routes.userId, req.user.userId),
                        eq(routes.status, "confirmado"),
                        sql`${routes.routeStartedAt} IS NOT NULL`,
                        sql`${routes.routeFinishedAt} IS NULL`
                    )
                );

            // Enriquecer com dados do responsável e paradas
            const enrichedRoutes = await Promise.all(
                inProgressRoutes.map(async (route) => {
                    let responsibleName = "Desconhecido";

                    if (route.responsibleType === "technician") {
                        const [tech] = await db
                            .select({ name: technicians.name })
                            .from(technicians)
                            .where(eq(technicians.id, parseInt(route.responsibleId)))
                            .limit(1);
                        responsibleName = tech?.name || "Técnico";
                    } else if (route.responsibleType === "team") {
                        const [team] = await db
                            .select({ name: teams.name })
                            .from(teams)
                            .where(eq(teams.id, parseInt(route.responsibleId)))
                            .limit(1);
                        responsibleName = team?.name || "Equipe";
                    }

                    // Buscar paradas da rota
                    const stops = await db
                        .select()
                        .from(routeStops)
                        .where(eq(routeStops.routeId, route.id));

                    // Contar paradas concluídas (agendamentos com executionStatus = concluido)
                    let completedStops = 0;
                    for (const stop of stops) {
                        if (stop.appointmentNumericId) {
                            const [apt] = await db
                                .select({ executionStatus: appointments.executionStatus })
                                .from(appointments)
                                .where(eq(appointments.id, stop.appointmentNumericId))
                                .limit(1);
                            if (apt?.executionStatus === "concluido") {
                                completedStops++;
                            }
                        }
                    }

                    // Calcular tempo decorrido
                    const startedAt = route.routeStartedAt ? new Date(route.routeStartedAt) : null;
                    const elapsedMinutes = startedAt
                        ? Math.round((Date.now() - startedAt.getTime()) / 1000 / 60)
                        : 0;

                    return {
                        id: route.id,
                        title: route.title,
                        responsibleType: route.responsibleType,
                        responsibleName,
                        totalStops: route.stopsCount,
                        completedStops,
                        remainingStops: route.stopsCount - completedStops,
                        startedAt: route.routeStartedAt,
                        elapsedMinutes,
                        estimatedDurationMinutes: Math.round((route.durationTotal || 0) / 60),
                    };
                })
            );

            console.log(`✅ [DASHBOARD] ${enrichedRoutes.length} rotas em andamento`);
            res.json(enrichedRoutes);
        } catch (error: any) {
            console.error("❌ [DASHBOARD] Erro ao buscar rotas em andamento:", error);
            res.status(500).json({ message: error.message });
        }
    });

    // ==================== ALERTAS CRÍTICOS ====================

    // GET /api/dashboard/critical-alerts - Alertas críticos para o gestor
    app.get("/api/dashboard/critical-alerts", authenticateToken, async (req: any, res) => {
        try {
            console.log("📊 [DASHBOARD] Buscando alertas críticos");

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const alerts: Array<{
                type: string;
                severity: "critical" | "warning" | "info";
                title: string;
                description: string;
                count: number;
                actionLabel: string;
                actionLink: string;
            }> = [];

            // 1. Agendamentos de hoje sem técnico/equipe atribuído
            const appointmentsWithoutResponsible = await db
                .select({
                    id: appointments.id,
                    scheduledDate: appointments.scheduledDate,
                    clientId: appointments.clientId,
                })
                .from(appointments)
                .where(
                    and(
                        eq(appointments.userId, req.user.userId),
                        gte(appointments.scheduledDate, today),
                        lte(appointments.scheduledDate, tomorrow),
                        or(
                            eq(appointments.status, "scheduled"),
                            eq(appointments.status, "rescheduled")
                        ),
                        isNull(appointments.technicianId),
                        isNull(appointments.teamId)
                    )
                );

            if (appointmentsWithoutResponsible.length > 0) {
                alerts.push({
                    type: "no_responsible",
                    severity: "critical",
                    title: "Agendamentos sem responsável",
                    description: `${appointmentsWithoutResponsible.length} agendamento(s) de hoje sem técnico ou equipe atribuído`,
                    count: appointmentsWithoutResponsible.length,
                    actionLabel: "Ver agendamentos",
                    actionLink: "/appointments",
                });
            }

            // 2. Rotas confirmadas que deveriam ter iniciado (hoje, confirmadas, sem routeStartedAt)
            const now = new Date();
            const startOfWorkday = new Date(today);
            startOfWorkday.setHours(8, 0, 0, 0); // Assumindo início às 8h

            if (now > startOfWorkday) {
                const lateRoutes = await db
                    .select()
                    .from(routes)
                    .where(
                        and(
                            eq(routes.userId, req.user.userId),
                            eq(routes.status, "confirmado"),
                            gte(routes.date, today),
                            lte(routes.date, tomorrow),
                            isNull(routes.routeStartedAt)
                        )
                    );

                if (lateRoutes.length > 0) {
                    alerts.push({
                        type: "late_routes",
                        severity: "warning",
                        title: "Rotas não iniciadas",
                        description: `${lateRoutes.length} rota(s) confirmada(s) para hoje ainda não foram iniciadas`,
                        count: lateRoutes.length,
                        actionLabel: "Ver prestadores",
                        actionLink: "/prestadores",
                    });
                }
            }

            // 3. Agendamentos pendentes (executionStatus começando com nao_realizado) sem resolução
            const pendingAppointments = await db
                .select()
                .from(appointments)
                .where(
                    and(
                        eq(appointments.userId, req.user.userId),
                        sql`${appointments.executionStatus} LIKE 'nao_realizado%'`,
                        or(
                            eq(appointments.status, "scheduled"),
                            eq(appointments.status, "rescheduled"),
                            eq(appointments.status, "in_progress")
                        )
                    )
                );

            if (pendingAppointments.length > 0) {
                alerts.push({
                    type: "pending_resolution",
                    severity: "warning",
                    title: "Pendências a resolver",
                    description: `${pendingAppointments.length} atendimento(s) não realizado(s) aguardando ação`,
                    count: pendingAppointments.length,
                    actionLabel: "Ver pendências",
                    actionLink: "/appointments?status=pending",
                });
            }

            // 4. Documentos de Veículos Vencendo (<= 30 dias) ou Vencidos
            const expiringDocuments = await db
                .select({
                    id: vehicleDocuments.id,
                    name: vehicleDocuments.name,
                    expirationDate: vehicleDocuments.expirationDate,
                    vehicleId: vehicleDocuments.vehicleId,
                    plate: vehicles.plate,
                    model: vehicles.model
                })
                .from(vehicleDocuments)
                .innerJoin(vehicles, eq(vehicleDocuments.vehicleId, vehicles.id))
                .where(
                    and(
                        eq(vehicles.userId, req.user.userId),
                        lte(vehicleDocuments.expirationDate, sql`NOW() + INTERVAL '30 days'`)
                    )
                );

            for (const doc of expiringDocuments) {
                const expiration = new Date(doc.expirationDate!);
                const isExpired = expiration < now;
                const daysRemaining = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                alerts.push({
                    type: "vehicle_document",
                    severity: isExpired ? "critical" : "warning",
                    title: isExpired ? "Documento Vencido" : "Documento a Vencer",
                    description: `${doc.name} do veículo ${doc.plate} ${isExpired ? `venceu em ${expiration.toLocaleDateString('pt-BR')}` : `vence em ${daysRemaining} dias`}`,
                    count: 1,
                    actionLabel: "Ver Veículo",
                    actionLink: `/vehicles?openId=${doc.vehicleId}&tab=documentos`,
                });
            }

            console.log(`✅ [DASHBOARD] ${alerts.length} alertas encontrados`);
            res.json(alerts);
        } catch (error: any) {
            console.error("❌ [DASHBOARD] Erro ao buscar alertas críticos:", error);
            res.status(500).json({ message: error.message });
        }
    });

    // ==================== MÉTRICAS DE PRODUTIVIDADE ====================

    // GET /api/dashboard/productivity-metrics - Métricas de produtividade
    app.get("/api/dashboard/productivity-metrics", authenticateToken, async (req: any, res) => {
        try {
            console.log("📊 [DASHBOARD] Buscando métricas de produtividade");

            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            // Buscar agendamentos do mês com dados de execução
            const monthAppointments = await db
                .select({
                    id: appointments.id,
                    serviceId: appointments.serviceId,
                    executionStartedAt: appointments.executionStartedAt,
                    executionFinishedAt: appointments.executionFinishedAt,
                    executionStatus: appointments.executionStatus,
                })
                .from(appointments)
                .where(
                    and(
                        eq(appointments.userId, req.user.userId),
                        gte(appointments.scheduledDate, startOfMonth),
                        eq(appointments.executionStatus, "concluido"),
                        sql`${appointments.executionStartedAt} IS NOT NULL`,
                        sql`${appointments.executionFinishedAt} IS NOT NULL`
                    )
                );

            // Buscar serviços para obter duração planejada
            const servicesList = await db
                .select({ id: services.id, duration: services.duration, name: services.name })
                .from(services)
                .where(eq(services.userId, req.user.userId));

            const servicesMap = new Map(servicesList.map(s => [s.id, s]));

            // Calcular tempo real vs planejado
            let totalPlannedMinutes = 0;
            let totalRealMinutes = 0;
            let validCount = 0;

            for (const apt of monthAppointments) {
                const service = servicesMap.get(apt.serviceId);
                if (!service) continue;

                const startedAt = new Date(apt.executionStartedAt!);
                const finishedAt = new Date(apt.executionFinishedAt!);
                const realMinutes = (finishedAt.getTime() - startedAt.getTime()) / 1000 / 60;

                // Ignorar tempos muito longos (possível erro de dados)
                if (realMinutes > 0 && realMinutes < 480) {
                    totalPlannedMinutes += service.duration;
                    totalRealMinutes += realMinutes;
                    validCount++;
                }
            }

            const avgPlannedMinutes = validCount > 0 ? Math.round(totalPlannedMinutes / validCount) : 0;
            const avgRealMinutes = validCount > 0 ? Math.round(totalRealMinutes / validCount) : 0;

            // Calcular variação percentual
            const variationPercent = avgPlannedMinutes > 0
                ? Math.round(((avgRealMinutes - avgPlannedMinutes) / avgPlannedMinutes) * 100)
                : 0;

            // Determinar status da eficiência
            let efficiencyStatus: "excellent" | "good" | "warning" | "critical" = "good";
            if (variationPercent <= -10) efficiencyStatus = "excellent"; // Mais rápido que o planejado
            else if (variationPercent <= 10) efficiencyStatus = "good";
            else if (variationPercent <= 25) efficiencyStatus = "warning";
            else efficiencyStatus = "critical";

            console.log(`✅ [DASHBOARD] Produtividade: ${avgRealMinutes}min real vs ${avgPlannedMinutes}min planejado (${variationPercent}%)`);
            res.json({
                avgPlannedMinutes,
                avgRealMinutes,
                variationPercent,
                efficiencyStatus,
                sampleSize: validCount,
                monthName: now.toLocaleDateString("pt-BR", { month: "long" }),
            });
        } catch (error: any) {
            console.error("❌ [DASHBOARD] Erro ao buscar métricas de produtividade:", error);
            res.status(500).json({ message: error.message });
        }
    });

    // ==================== MÉTRICAS DE QUALIDADE ====================

    // GET /api/dashboard/quality-metrics - Métricas de qualidade (não realizados, reagendamentos)
    app.get("/api/dashboard/quality-metrics", authenticateToken, async (req: any, res) => {
        try {
            console.log("📊 [DASHBOARD] Buscando métricas de qualidade");

            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            // Buscar todos os agendamentos do mês que foram finalizados
            const monthAppointments = await db
                .select({
                    id: appointments.id,
                    status: appointments.status,
                    executionStatus: appointments.executionStatus,
                })
                .from(appointments)
                .where(
                    and(
                        eq(appointments.userId, req.user.userId),
                        gte(appointments.scheduledDate, startOfMonth),
                        sql`${appointments.executionStatus} IS NOT NULL`
                    )
                );

            const totalFinalized = monthAppointments.length;
            const completed = monthAppointments.filter(a => a.executionStatus === "concluido").length;
            const notCompleted = monthAppointments.filter(a =>
                a.executionStatus?.startsWith("nao_realizado")
            );

            // Agrupar motivos de não realização
            const reasonsMap = new Map<string, number>();
            for (const apt of notCompleted) {
                const reason = apt.executionStatus || "outro";
                reasonsMap.set(reason, (reasonsMap.get(reason) || 0) + 1);
            }

            // Converter para array ordenado
            const reasonsBreakdown = Array.from(reasonsMap.entries())
                .map(([reason, count]) => ({
                    reason,
                    count,
                    label: formatNotCompletedReason(reason),
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5); // Top 5 motivos

            // Calcular taxa de não realizados
            const notCompletedRate = totalFinalized > 0
                ? Math.round((notCompleted.length / totalFinalized) * 100)
                : 0;

            // Calcular total de reagendamentos (soma de rescheduleCount)
            const rescheduledData = await db
                .select({ total: sql<number>`coalesce(sum(${appointments.rescheduleCount}), 0)::int` })
                .from(appointments)
                .where(
                    and(
                        eq(appointments.userId, req.user.userId),
                        gte(appointments.scheduledDate, startOfMonth)
                    )
                );

            const rescheduled = rescheduledData[0]?.total || 0;

            // Total de agendamentos do mês (para taxa de reagendamento)
            const totalMonthAppointments = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(appointments)
                .where(
                    and(
                        eq(appointments.userId, req.user.userId),
                        gte(appointments.scheduledDate, startOfMonth)
                    )
                );


            const totalMonth = totalMonthAppointments[0]?.count || 0;
            const rescheduledRate = totalMonth > 0
                ? Math.round((rescheduled / totalMonth) * 100)
                : 0;

            console.log(`✅ [DASHBOARD] Qualidade: ${notCompletedRate}% não realizados, ${rescheduledRate}% reagendados`);
            res.json({
                totalFinalized,
                completed,
                notCompletedCount: notCompleted.length,
                notCompletedRate,
                reasonsBreakdown,
                rescheduledCount: rescheduled,
                rescheduledRate,
                monthName: now.toLocaleDateString("pt-BR", { month: "long" }),
            });
        } catch (error: any) {
            console.error("❌ [DASHBOARD] Erro ao buscar métricas de qualidade:", error);
            res.status(500).json({ message: error.message });
        }
    });

    // ==================== MÉTRICAS FINANCEIRAS ====================

    // GET /api/dashboard/financial-metrics - Receita real vs esperada
    app.get("/api/dashboard/financial-metrics", authenticateToken, async (req: any, res) => {
        try {
            console.log("📊 [DASHBOARD] Buscando métricas financeiras");

            const now = new Date();
            const defaultStartOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const defaultEndOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

            // Query params para filtros opcionais
            const { technicianId, teamId, startDate, endDate } = req.query;

            // Definir período (usar filtros ou default mês atual)
            const periodStart = startDate ? new Date(startDate as string) : defaultStartOfMonth;
            const periodEnd = endDate ? new Date(endDate as string) : defaultEndOfMonth;

            // Base condition
            let baseCondition = and(
                eq(appointments.userId, req.user.userId),
                gte(appointments.scheduledDate, periodStart),
                lte(appointments.scheduledDate, periodEnd)
            );

            // Adicionar filtro de técnico/equipe se fornecido
            if (technicianId) {
                baseCondition = and(baseCondition, eq(appointments.technicianId, parseInt(technicianId)));
            }
            if (teamId) {
                baseCondition = and(baseCondition, eq(appointments.teamId, parseInt(teamId)));
            }

            // 1. Receita REAL: agendamentos CONCLUÍDOS
            const completedAppointments = await db
                .select({
                    id: appointments.id,
                    serviceId: appointments.serviceId,
                })
                .from(appointments)
                .where(and(baseCondition, eq(appointments.executionStatus, "concluido")));

            // 2. Receita ESPERADA: agendamentos PENDENTES (scheduled, in_progress, rescheduled)
            const pendingAppointments = await db
                .select({
                    id: appointments.id,
                    serviceId: appointments.serviceId,
                })
                .from(appointments)
                .where(
                    and(
                        baseCondition,
                        or(
                            eq(appointments.status, "scheduled"),
                            eq(appointments.status, "in_progress"),
                            eq(appointments.status, "rescheduled"),
                            eq(appointments.status, "confirmed")
                        ),
                        or(
                            isNull(appointments.executionStatus),
                            ne(appointments.executionStatus, "concluido")
                        )
                    )
                );

            // Buscar preços dos serviços
            const servicesList = await db
                .select({ id: services.id, price: services.price })
                .from(services)
                .where(eq(services.userId, req.user.userId));

            const pricesMap = new Map(servicesList.map(s => [s.id, parseFloat(s.price || "0")]));

            // Calcular receitas
            let realRevenue = 0;
            for (const apt of completedAppointments) {
                realRevenue += pricesMap.get(apt.serviceId) || 0;
            }

            let expectedRevenue = 0;
            for (const apt of pendingAppointments) {
                expectedRevenue += pricesMap.get(apt.serviceId) || 0;
            }

            const totalPotential = realRevenue + expectedRevenue;
            const realizationRate = totalPotential > 0
                ? Math.round((realRevenue / totalPotential) * 100)
                : 0;

            console.log(`✅ [DASHBOARD] Financeiro: R$${realRevenue.toFixed(2)} real, R$${expectedRevenue.toFixed(2)} esperado (${realizationRate}%)`);
            res.json({
                realRevenue,
                expectedRevenue,
                totalPotential,
                realizationRate,
                completedCount: completedAppointments.length,
                pendingCount: pendingAppointments.length,
                monthName: now.toLocaleDateString("pt-BR", { month: "long" }),
                year: now.getFullYear(),
            });
        } catch (error: any) {
            console.error("❌ [DASHBOARD] Erro ao buscar métricas financeiras:", error);
            res.status(500).json({ message: error.message });
        }
    });

    // GET /api/dashboard/financial-metrics-v2 - Receita total com breakdown por status
    app.get("/api/dashboard/financial-metrics-v2", authenticateToken, async (req: any, res) => {
        try {
            console.log("📊 [DASHBOARD] Buscando métricas financeiras V2");

            const now = new Date();
            const defaultStartOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const defaultEndOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

            // Query params para filtros opcionais
            const { technicianId, teamId, startDate, endDate } = req.query;

            // Definir período (usar filtros ou default mês atual)
            const periodStart = startDate ? new Date(startDate as string) : defaultStartOfMonth;
            const periodEnd = endDate ? new Date(endDate as string + "T23:59:59") : defaultEndOfMonth;

            // Base condition
            let baseCondition = and(
                eq(appointments.userId, req.user.userId),
                gte(appointments.scheduledDate, periodStart),
                lte(appointments.scheduledDate, periodEnd)
            );

            // Adicionar filtro de técnico/equipe se fornecido
            if (technicianId) {
                baseCondition = and(baseCondition, eq(appointments.technicianId, parseInt(technicianId)));
            }
            if (teamId) {
                baseCondition = and(baseCondition, eq(appointments.teamId, parseInt(teamId)));
            }

            // Buscar TODOS os agendamentos do período
            const allAppointments = await db
                .select({
                    id: appointments.id,
                    serviceId: appointments.serviceId,
                    status: appointments.status,
                    executionStatus: appointments.executionStatus,
                })
                .from(appointments)
                .where(baseCondition);

            // Buscar preços dos serviços
            const servicesList = await db
                .select({ id: services.id, price: services.price })
                .from(services)
                .where(eq(services.userId, req.user.userId));

            const pricesMap = new Map(servicesList.map(s => [s.id, parseFloat(s.price || "0")]));

            // Definir categorias de status
            const statusCategories = {
                concluido: { label: "Concluídos", color: "#22c55e", count: 0, revenue: 0 },
                cancelado: { label: "Cancelados", color: "#ef4444", count: 0, revenue: 0 },
                reagendado: { label: "Reagendados", color: "#f59e0b", count: 0, revenue: 0 },
                pendente: { label: "Pendentes", color: "#3b82f6", count: 0, revenue: 0 },
                nao_realizado: { label: "Não Realizados", color: "#6b7280", count: 0, revenue: 0 },
            };

            let totalRevenue = 0;
            let totalCount = 0;

            // Categorizar agendamentos
            for (const apt of allAppointments) {
                const price = pricesMap.get(apt.serviceId) || 0;
                totalRevenue += price;
                totalCount++;

                if (apt.executionStatus === "concluido") {
                    statusCategories.concluido.count++;
                    statusCategories.concluido.revenue += price;
                } else if (apt.status === "cancelled") {
                    statusCategories.cancelado.count++;
                    statusCategories.cancelado.revenue += price;
                } else if (apt.status === "rescheduled") {
                    statusCategories.reagendado.count++;
                    statusCategories.reagendado.revenue += price;
                } else if (apt.executionStatus?.startsWith("nao_realizado")) {
                    statusCategories.nao_realizado.count++;
                    statusCategories.nao_realizado.revenue += price;
                } else {
                    // scheduled, in_progress, confirmed = pendente
                    statusCategories.pendente.count++;
                    statusCategories.pendente.revenue += price;
                }
            }

            // Montar breakdown array com percentuais
            const breakdown = Object.entries(statusCategories)
                .map(([status, data]) => ({
                    status,
                    label: data.label,
                    count: data.count,
                    revenue: data.revenue,
                    percent: totalCount > 0 ? Math.round((data.count / totalCount) * 100) : 0,
                    color: data.color,
                }))
                .filter(b => b.count > 0) // Apenas mostrar status com algum agendamento
                .sort((a, b) => b.count - a.count); // Ordenar por quantidade desc

            console.log(`✅ [DASHBOARD] Financeiro V2: R$${totalRevenue.toFixed(2)} total, ${totalCount} agendamentos`);
            res.json({
                totalRevenue,
                totalCount,
                breakdown,
            });
        } catch (error: any) {
            console.error("❌ [DASHBOARD] Erro ao buscar métricas financeiras V2:", error);
            res.status(500).json({ message: error.message });
        }
    });

    // ==================== MOTIVOS DE PENDÊNCIAS ====================

    // GET /api/dashboard/pending-reasons - Breakdown de motivos de não realização
    app.get("/api/dashboard/pending-reasons", authenticateToken, async (req: any, res) => {
        try {
            console.log("📊 [DASHBOARD] Buscando motivos de pendências");

            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

            // Query params para filtros
            const { technicianId, teamId, startDate, endDate } = req.query;

            // Definir período
            const periodStart = startDate ? new Date(startDate as string) : startOfMonth;
            const periodEnd = endDate ? new Date(endDate as string) : endOfMonth;

            // Base condition
            let baseCondition = and(
                eq(appointments.userId, req.user.userId),
                gte(appointments.scheduledDate, periodStart),
                lte(appointments.scheduledDate, periodEnd),
                sql`${appointments.executionStatus} LIKE 'nao_realizado%'`
            );

            // Adicionar filtros
            if (technicianId) {
                baseCondition = and(baseCondition, eq(appointments.technicianId, parseInt(technicianId as string)));
            }
            if (teamId) {
                baseCondition = and(baseCondition, eq(appointments.teamId, parseInt(teamId as string)));
            }

            // Buscar agendamentos não realizados
            const notCompletedAppointments = await db
                .select({
                    id: appointments.id,
                    executionStatus: appointments.executionStatus,
                    technicianId: appointments.technicianId,
                    teamId: appointments.teamId,
                })
                .from(appointments)
                .where(baseCondition);

            // Agrupar por motivo
            const reasonsMap = new Map<string, number>();
            for (const apt of notCompletedAppointments) {
                const reason = apt.executionStatus || "nao_realizado_outro";
                reasonsMap.set(reason, (reasonsMap.get(reason) || 0) + 1);
            }

            const total = notCompletedAppointments.length;
            const reasons = Array.from(reasonsMap.entries())
                .map(([reason, count]) => ({
                    reason,
                    label: formatNotCompletedReason(reason),
                    count,
                    percent: total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0,
                }))
                .sort((a, b) => b.count - a.count);

            // Agrupar por equipe/técnico se não filtrado
            const byResponsible: Array<{ id: number; name: string; type: "technician" | "team"; count: number }> = [];

            if (!technicianId && !teamId) {
                // Agrupar por técnico
                const techMap = new Map<number, number>();
                const teamMap = new Map<number, number>();

                for (const apt of notCompletedAppointments) {
                    if (apt.technicianId) {
                        techMap.set(apt.technicianId, (techMap.get(apt.technicianId) || 0) + 1);
                    }
                    if (apt.teamId) {
                        teamMap.set(apt.teamId, (teamMap.get(apt.teamId) || 0) + 1);
                    }
                }

                // Buscar nomes dos técnicos
                if (techMap.size > 0) {
                    const techIds = Array.from(techMap.keys());
                    const techList = await db
                        .select({ id: technicians.id, name: technicians.name })
                        .from(technicians)
                        .where(sql`${technicians.id} IN (${sql.join(techIds.map(id => sql`${id}`), sql`, `)})`);

                    for (const tech of techList) {
                        byResponsible.push({
                            id: tech.id,
                            name: tech.name,
                            type: "technician",
                            count: techMap.get(tech.id) || 0,
                        });
                    }
                }

                // Buscar nomes das equipes
                if (teamMap.size > 0) {
                    const teamIds = Array.from(teamMap.keys());
                    const teamList = await db
                        .select({ id: teams.id, name: teams.name })
                        .from(teams)
                        .where(sql`${teams.id} IN (${sql.join(teamIds.map(id => sql`${id}`), sql`, `)})`);

                    for (const team of teamList) {
                        byResponsible.push({
                            id: team.id,
                            name: team.name,
                            type: "team",
                            count: teamMap.get(team.id) || 0,
                        });
                    }
                }

                // Ordenar por quantidade
                byResponsible.sort((a, b) => b.count - a.count);
            }

            // Calcular taxa de resolução (simplificado - olha se status mudou para completed ou cancelled)
            const resolvedCount = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(appointments)
                .where(
                    and(
                        eq(appointments.userId, req.user.userId),
                        gte(appointments.scheduledDate, periodStart),
                        lte(appointments.scheduledDate, periodEnd),
                        sql`${appointments.executionStatus} LIKE 'nao_realizado%'`,
                        or(
                            eq(appointments.status, "completed"),
                            eq(appointments.status, "cancelled"),
                            eq(appointments.status, "rescheduled")
                        )
                    )
                );

            const resolved = resolvedCount[0]?.count || 0;
            const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

            console.log(`✅ [DASHBOARD] Pendências: ${total} total, ${reasons.length} motivos, ${resolutionRate}% resolvidos`);
            res.json({
                total,
                reasons,
                byResponsible: byResponsible.slice(0, 10), // Top 10
                resolutionRate,
                periodStart: periodStart.toISOString(),
                periodEnd: periodEnd.toISOString(),
            });
        } catch (error: any) {
            console.error("❌ [DASHBOARD] Erro ao buscar motivos de pendências:", error);
            res.status(500).json({ message: error.message });
        }
    });

    console.log("✅ Rotas do Dashboard registradas");
}

// Helper para formatar motivos de não realização
function formatNotCompletedReason(reason: string): string {
    const labels: Record<string, string> = {
        "nao_realizado_cliente_ausente": "Cliente ausente",
        "nao_realizado_cliente_pediu_remarcacao": "Pediu remarcação",
        "nao_realizado_endereco_incorreto": "Endereço incorreto",
        "nao_realizado_cliente_recusou": "Cliente recusou",
        "nao_realizado_problema_tecnico": "Problema técnico",
        "nao_realizado_falta_material": "Falta de material",
        "nao_realizado_outro": "Outro motivo",
        "concluido": "Concluído",
    };
    return labels[reason] || reason.replace("nao_realizado_", "").replace(/_/g, " ");
}

