/**
 * superadmin.routes.ts
 *
 * Rotas exclusivas para SuperAdmin — métricas consolidadas por empresa.
 * ⚠️ Acesso restrito: apenas isSuperAdmin === true.
 */

import type { Express } from "express";
import { db } from "../db";
import {
  companies,
  memberships,
  clients,
  appointments,
  teams,
  technicians,
  vehicles,
  routes,
} from "@shared/schema";
import { sql, eq } from "drizzle-orm";

export function registerSuperadminRoutes(
  app: Express,
  authenticateToken: any
) {
  // GET /api/superadmin/companies — Métricas consolidadas de todas as empresas
  app.get(
    "/api/superadmin/companies",
    authenticateToken,
    async (req: any, res) => {
      try {
        // 🔐 Verificação obrigatória de SuperAdmin
        if (!req.user?.isSuperAdmin) {
          return res
            .status(403)
            .json({ error: "Acesso restrito ao SuperAdmin" });
        }

        console.log("[SUPERADMIN] Listando métricas de empresas");

        // 1) Buscar todas as empresas
        const allCompanies = await db.select().from(companies);

        // 2) Queries agregadas por company_id (uma query por métrica, agrupada)
        const [
          clientCounts,
          userCounts,
          appointmentCounts,
          teamCounts,
          technicianCounts,
          vehicleCounts,
          routeCounts,
          routeKmTotals,
        ] = await Promise.all([
          // Clientes por empresa
          db
            .select({
              companyId: clients.companyId,
              total: sql<number>`count(*)::int`,
            })
            .from(clients)
            .groupBy(clients.companyId),

          // Usuários por empresa (via memberships)
          db
            .select({
              companyId: memberships.companyId,
              total: sql<number>`count(distinct ${memberships.userId})::int`,
            })
            .from(memberships)
            .where(eq(memberships.isActive, true))
            .groupBy(memberships.companyId),

          // Agendamentos por empresa
          db
            .select({
              companyId: appointments.companyId,
              total: sql<number>`count(*)::int`,
            })
            .from(appointments)
            .groupBy(appointments.companyId),

          // Equipes por empresa
          db
            .select({
              companyId: teams.companyId,
              total: sql<number>`count(*)::int`,
            })
            .from(teams)
            .groupBy(teams.companyId),

          // Técnicos por empresa
          db
            .select({
              companyId: technicians.companyId,
              total: sql<number>`count(*)::int`,
            })
            .from(technicians)
            .groupBy(technicians.companyId),

          // Veículos por empresa
          db
            .select({
              companyId: vehicles.companyId,
              total: sql<number>`count(*)::int`,
            })
            .from(vehicles)
            .groupBy(vehicles.companyId),

          // Rotas (romaneios) por empresa — routes tem userId, join com memberships
          db
            .select({
              companyId: memberships.companyId,
              total: sql<number>`count(distinct ${routes.id})::int`,
            })
            .from(routes)
            .innerJoin(memberships, eq(routes.userId, memberships.userId))
            .groupBy(memberships.companyId),

          // Km total por empresa (distance_total em metros → converter para km)
          db
            .select({
              companyId: memberships.companyId,
              totalKm: sql<number>`coalesce(sum(${routes.distanceTotal}), 0)::bigint`,
            })
            .from(routes)
            .innerJoin(memberships, eq(routes.userId, memberships.userId))
            .groupBy(memberships.companyId),
        ]);

        // 3) Montar mapas rápidos para lookup O(1)
        const toMap = <T extends { companyId: number | null }>(
          arr: T[],
          key: keyof T = "total" as keyof T
        ) => {
          const map = new Map<number, number>();
          for (const row of arr) {
            if (row.companyId != null) {
              map.set(row.companyId, (row as any)[key] ?? 0);
            }
          }
          return map;
        };

        const clientMap = toMap(clientCounts);
        const userMap = toMap(userCounts);
        const appointmentMap = toMap(appointmentCounts);
        const teamMap = toMap(teamCounts);
        const techMap = toMap(technicianCounts);
        const vehicleMap = toMap(vehicleCounts);
        const routeMap = toMap(routeCounts);
        const kmMap = toMap(routeKmTotals, "totalKm" as any);

        // 4) Montar resposta final
        const result = allCompanies.map((company) => {
          const totalRoutes = routeMap.get(company.id) || 0;
          const totalAppointments = appointmentMap.get(company.id) || 0;
          const totalKmMeters = kmMap.get(company.id) || 0;
          const totalKm = Math.round(Number(totalKmMeters) / 1000);

          return {
            companyId: company.id,
            companyName: company.name,
            cnpj: company.cnpj,
            plan: company.plan,
            statusAssinatura: company.statusAssinatura,
            createdAt: company.createdAt,
            totalClients: clientMap.get(company.id) || 0,
            totalUsers: userMap.get(company.id) || 0,
            totalRoutes,
            totalAppointments,
            avgAppointmentsPerRoute:
              totalRoutes > 0
                ? Math.round((totalAppointments / totalRoutes) * 10) / 10
                : 0,
            totalTeams: teamMap.get(company.id) || 0,
            totalTechnicians: techMap.get(company.id) || 0,
            totalVehicles: vehicleMap.get(company.id) || 0,
            totalKm,
          };
        });

        console.log(
          `[SUPERADMIN] ${result.length} empresas retornadas com métricas`
        );

        return res.json(result);
      } catch (error: any) {
        console.error("[SUPERADMIN] Erro ao listar métricas:", error);
        return res
          .status(500)
          .json({ error: "Erro interno ao buscar métricas de empresas" });
      }
    }
  );
}
