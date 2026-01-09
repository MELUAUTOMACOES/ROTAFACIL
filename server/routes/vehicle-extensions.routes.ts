import type { Express } from "express";
import { db } from "../db";
import {
    vehicleChecklists,
    vehicleChecklistItems,
    vehicleChecklistAudits,
    vehicleMaintenances,
    vehicles,
    technicians,
    users
} from "@shared/schema";
import {
    insertVehicleChecklistAuditSchema,
    type VehicleChecklistAudit,
    type InsertVehicleChecklistAudit
} from "@shared/schema";
import { eq, and, desc, asc, sql, lte, gte, or, inArray } from "drizzle-orm";
import { notifyMaintenanceScheduled } from "../notifications";

export function registerVehicleExtensionRoutes(app: Express, authenticateToken: any) {

    // ==================== VEHICLE MAINTENANCES (ALL) ====================

    // GET /api/vehicle-maintenances - Listar TODAS as manutenções do usuário
    app.get("/api/vehicle-maintenances", authenticateToken, async (req: any, res) => {
        try {
            console.log("🔧 [MAINTENANCE] Listando todas as manutenções do usuário");

            const maintenances = await db
                .select()
                .from(vehicleMaintenances)
                .where(eq(vehicleMaintenances.userId, req.user.userId))
                .orderBy(desc(vehicleMaintenances.createdAt));

            console.log(`✅ [MAINTENANCE] ${maintenances.length} manutenções encontradas`);
            res.json(maintenances);
        } catch (error: any) {
            console.error("❌ [MAINTENANCE] Erro ao listar manutenções:", error);
            res.status(500).json({ message: error.message });
        }
    });

    // ==================== VEHICLE CHECKLIST AUDITS ====================

    // GET /api/vehicle-checklist-audits - Listar auditorias de checklists
    app.get("/api/vehicle-checklist-audits", authenticateToken, async (req: any, res) => {
        try {
            console.log("📋 [AUDIT] Listando auditorias de checklists");

            const { checklistId, verified } = req.query;

            let query = db
                .select()
                .from(vehicleChecklistAudits)
                .where(eq(vehicleChecklistAudits.userId, req.user.userId));

            // Aplicar filtros
            const conditions: any[] = [eq(vehicleChecklistAudits.userId, req.user.userId)];

            if (checklistId) {
                conditions.push(eq(vehicleChecklistAudits.checklistId, parseInt(checklistId)));
            }

            if (verified !== undefined) {
                conditions.push(eq(vehicleChecklistAudits.verified, verified === 'true'));
            }

            const audits = await db
                .select()
                .from(vehicleChecklistAudits)
                .where(and(...conditions))
                .orderBy(desc(vehicleChecklistAudits.createdAt));

            console.log(`✅ [AUDIT] ${audits.length} auditorias encontradas`);
            res.json(audits);
        } catch (error: any) {
            console.error("❌ [AUDIT] Erro ao listar auditorias:", error);
            res.status(500).json({ message: error.message });
        }
    });

    // GET /api/vehicle-checklist-audits/checklist/:checklistId - Buscar auditoria de um checklist
    app.get("/api/vehicle-checklist-audits/checklist/:checklistId", authenticateToken, async (req: any, res) => {
        try {
            const checklistId = parseInt(req.params.checklistId);
            console.log(`📋 [AUDIT] Buscando auditoria do checklist ${checklistId}`);

            const [audit] = await db
                .select()
                .from(vehicleChecklistAudits)
                .where(
                    and(
                        eq(vehicleChecklistAudits.checklistId, checklistId),
                        eq(vehicleChecklistAudits.userId, req.user.userId)
                    )
                )
                .limit(1);

            if (!audit) {
                return res.json(null);
            }

            // Enriquecer com nome do verificador
            let verifierName = null;
            if (audit.verifiedBy) {
                const [verifier] = await db
                    .select({ name: users.name })
                    .from(users)
                    .where(eq(users.id, audit.verifiedBy))
                    .limit(1);
                verifierName = verifier?.name || null;
            }

            const enrichedAudit = {
                ...audit,
                verifierName,
            };

            console.log(`✅ [AUDIT] Auditoria do checklist ${checklistId} retornada`);
            res.json(enrichedAudit);
        } catch (error: any) {
            console.error("❌ [AUDIT] Erro ao buscar auditoria:", error);
            res.status(500).json({ message: error.message });
        }
    });

    // POST /api/vehicle-checklist-audits - Criar/atualizar auditoria
    app.post("/api/vehicle-checklist-audits", authenticateToken, async (req: any, res) => {
        try {
            console.log("📋 [AUDIT] Criando/atualizando auditoria de checklist");

            const { checklistId, verified, observations, maintenanceLinked } = req.body;

            // Verificar se o checklist existe e pertence ao usuário
            const [checklist] = await db
                .select()
                .from(vehicleChecklists)
                .where(
                    and(
                        eq(vehicleChecklists.id, checklistId),
                        eq(vehicleChecklists.userId, req.user.userId)
                    )
                )
                .limit(1);

            if (!checklist) {
                return res.status(404).json({ message: "Checklist não encontrado" });
            }

            // Verificar se já existe uma auditoria
            const [existingAudit] = await db
                .select()
                .from(vehicleChecklistAudits)
                .where(eq(vehicleChecklistAudits.checklistId, checklistId))
                .limit(1);

            let audit;

            if (existingAudit) {
                // Atualizar auditoria existente
                [audit] = await db
                    .update(vehicleChecklistAudits)
                    .set({
                        verified,
                        verifiedBy: req.user.userId,
                        verifiedAt: new Date(),
                        observations,
                        maintenanceLinked,
                    })
                    .where(eq(vehicleChecklistAudits.id, existingAudit.id))
                    .returning();

                console.log(`✅ [AUDIT] Auditoria ${audit.id} atualizada`);
            } else {
                // Criar nova auditoria
                [audit] = await db
                    .insert(vehicleChecklistAudits)
                    .values({
                        checklistId,
                        verified,
                        verifiedBy: req.user.userId,
                        verifiedAt: new Date(),
                        observations,
                        maintenanceLinked,
                        userId: req.user.userId,
                        companyId: req.user.companyId,
                    })
                    .returning();

                console.log(`✅ [AUDIT] Auditoria ${audit.id} criada`);
            }

            // Se vinculou a uma manutenção, atualizar o checklist
            if (maintenanceLinked) {
                await db
                    .update(vehicleChecklists)
                    .set({ maintenanceId: maintenanceLinked })
                    .where(eq(vehicleChecklists.id, checklistId));

                console.log(`🔗 [AUDIT] Checklist ${checklistId} vinculado à manutenção ${maintenanceLinked}`);
            }

            res.status(201).json(audit);
        } catch (error: any) {
            console.error("❌ [AUDIT] Erro ao criar/atualizar auditoria:", error);
            res.status(500).json({ message: error.message });
        }
    });

    // ==================== DASHBOARD ENDPOINTS ====================

    // GET /api/dashboard/vehicles-attention - Veículos com último checklist com atenção/crítico
    app.get("/api/dashboard/vehicles-attention", authenticateToken, async (req: any, res) => {
        try {
            console.log("📊 [DASHBOARD] Buscando veículos que precisam de atenção");

            // Buscar todos os veículos do usuário
            const userVehicles = await db
                .select()
                .from(vehicles)
                .where(eq(vehicles.userId, req.user.userId));

            const vehiclesWithIssues = [];

            // Para cada veículo, buscar o último checklist
            for (const vehicle of userVehicles) {
                const [lastChecklist] = await db
                    .select()
                    .from(vehicleChecklists)
                    .where(
                        and(
                            eq(vehicleChecklists.vehicleId, vehicle.id),
                            eq(vehicleChecklists.userId, req.user.userId)
                        )
                    )
                    .orderBy(desc(vehicleChecklists.checkDate))
                    .limit(1);

                if (!lastChecklist) continue;

                // Buscar items do checklist
                const items = await db
                    .select()
                    .from(vehicleChecklistItems)
                    .where(eq(vehicleChecklistItems.checklistId, lastChecklist.id));

                // Verificar se há items com atenção ou crítico
                const hasAttention = items.some(item => item.status === 'attention');
                const hasCritical = items.some(item => item.status === 'critical');

                if (hasAttention || hasCritical) {
                    const problematicItems = items.filter(
                        item => item.status === 'attention' || item.status === 'critical'
                    );

                    vehiclesWithIssues.push({
                        id: vehicle.id,
                        plate: vehicle.plate,
                        brand: vehicle.brand,
                        model: vehicle.model,
                        checklistDate: lastChecklist.checkDate,
                        severity: hasCritical ? 'critical' : 'attention',
                        problematicItemsCount: problematicItems.length,
                        checklistId: lastChecklist.id,
                    });
                }
            }

            console.log(`✅ [DASHBOARD] ${vehiclesWithIssues.length} veículos com problemas encontrados`);
            res.json(vehiclesWithIssues);
        } catch (error: any) {
            console.error("❌ [DASHBOARD] Erro ao buscar veículos com atenção:", error);
            res.status(500).json({ message: error.message });
        }
    });

    // GET /api/dashboard/upcoming-maintenances - Próximas manutenções agendadas
    app.get("/api/dashboard/upcoming-maintenances", authenticateToken, async (req: any, res) => {
        try {
            console.log("📊 [DASHBOARD] Buscando próximas manutenções");

            const upcomingMaintenances = await db
                .select({
                    id: vehicleMaintenances.id,
                    vehicleId: vehicleMaintenances.vehicleId,
                    scheduledDate: vehicleMaintenances.scheduledDate,
                    description: vehicleMaintenances.description,
                    workshop: vehicleMaintenances.workshop,
                    category: vehicleMaintenances.category,
                    maintenanceType: vehicleMaintenances.maintenanceType,
                    vehiclePlate: vehicles.plate,
                    vehicleModel: vehicles.model,
                    vehicleBrand: vehicles.brand,
                })
                .from(vehicleMaintenances)
                .leftJoin(vehicles, eq(vehicleMaintenances.vehicleId, vehicles.id))
                .where(
                    and(
                        eq(vehicleMaintenances.userId, req.user.userId),
                        eq(vehicleMaintenances.status, 'agendada'),
                        sql`${vehicleMaintenances.scheduledDate} IS NOT NULL`
                    )
                )
                .orderBy(asc(vehicleMaintenances.scheduledDate))
                .limit(10);

            const enriched = upcomingMaintenances.map(m => ({
                id: m.id,
                scheduledDate: m.scheduledDate,
                description: m.description,
                location: m.workshop,
                category: m.category,
                maintenanceType: m.maintenanceType,
                vehicle: {
                    id: m.vehicleId,
                    plate: m.vehiclePlate,
                    model: m.vehicleModel,
                    brand: m.vehicleBrand,
                },
            }));

            console.log(`✅ [DASHBOARD] ${enriched.length} manutenções agendadas encontradas`);
            res.json(enriched);
        } catch (error: any) {
            console.error("❌ [DASHBOARD] Erro ao buscar próximas manutenções:", error);
            res.status(500).json({ message: error.message });
        }
    });

    // GET /api/dashboard/maintenance-costs - Custos de manutenção por mês e ano
    app.get("/api/dashboard/maintenance-costs", authenticateToken, async (req: any, res) => {
        try {
            console.log("📊 [DASHBOARD] Buscando custos de manutenção");

            const { vehicleId, startDate, endDate } = req.query;

            const now = new Date();
            const defaultStartOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const defaultEndOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            const startOfYear = new Date(now.getFullYear(), 0, 1);

            // Definir período (usar filtros ou default mês atual)
            const periodStart = startDate ? new Date(startDate as string) : defaultStartOfMonth;
            const periodEnd = endDate ? new Date(endDate as string + "T23:59:59") : defaultEndOfMonth;

            // Base conditions
            const baseConditions = [
                eq(vehicleMaintenances.userId, req.user.userId),
                eq(vehicleMaintenances.status, "concluida"),
            ];

            if (vehicleId) {
                baseConditions.push(eq(vehicleMaintenances.vehicleId, parseInt(vehicleId)));
            }

            // Total do período selecionado
            const periodMaintenances = await db
                .select({ totalCost: vehicleMaintenances.totalCost })
                .from(vehicleMaintenances)
                .where(
                    and(
                        ...baseConditions,
                        gte(vehicleMaintenances.entryDate, periodStart),
                        lte(vehicleMaintenances.entryDate, periodEnd)
                    )
                );

            const monthTotal = periodMaintenances.reduce((acc, m) => {
                return acc + parseFloat(m.totalCost?.toString() || "0");
            }, 0);

            // Total do ano atual
            const yearMaintenances = await db
                .select({ totalCost: vehicleMaintenances.totalCost })
                .from(vehicleMaintenances)
                .where(
                    and(
                        ...baseConditions,
                        gte(vehicleMaintenances.entryDate, startOfYear)
                    )
                );

            const yearTotal = yearMaintenances.reduce((acc, m) => {
                return acc + parseFloat(m.totalCost?.toString() || "0");
            }, 0);

            // Buscar veículos para filtro
            const userVehicles = await db
                .select({ id: vehicles.id, plate: vehicles.plate, model: vehicles.model })
                .from(vehicles)
                .where(eq(vehicles.userId, req.user.userId));

            // Determinar nome do período
            let monthName = "";
            const isFullMonth = periodStart.getDate() === 1 &&
                periodEnd.getDate() === new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate();

            if (isFullMonth) {
                monthName = periodStart.toLocaleDateString("pt-BR", { month: "long" });
                if (periodStart.getFullYear() !== now.getFullYear()) {
                    monthName += ` ${periodStart.getFullYear()}`;
                }
            } else {
                monthName = `${periodStart.toLocaleDateString("pt-BR")} a ${periodEnd.toLocaleDateString("pt-BR")}`;
            }

            console.log(`✅ [DASHBOARD] Custos calculados - Mês: R$ ${monthTotal.toFixed(2)}, Ano: R$ ${yearTotal.toFixed(2)}`);
            res.json({
                monthTotal,
                yearTotal,
                monthName: monthName,
                year: periodStart.getFullYear(),
                vehicles: userVehicles,
                selectedVehicleId: vehicleId ? parseInt(vehicleId) : null,
            });
        } catch (error: any) {
            console.error("❌ [DASHBOARD] Erro ao buscar custos de manutenção:", error);
            res.status(500).json({ message: error.message });
        }
    });

    console.log("✅ Rotas de extensão de veículos registradas");
}
