import { eq, inArray } from "drizzle-orm";
import { db } from "./server/db";
import { appointments, routes as routesTbl, routeStops as stopsTbl } from "./shared/schema";

async function debugAppointments() {
    console.log("🔍 INVESTIGANDO AGENDAMENTOS 9, 14, 8, 32\n");

    // 1. Status atual dos agendamentos
    console.log("=".repeat(80));
    console.log("1️⃣  STATUS ATUAL DOS AGENDAMENTOS");
    console.log("=".repeat(80));

    const appts = await db
        .select({
            id: appointments.id,
            status: appointments.status,
            scheduledDate: appointments.scheduledDate,
            createdAt: appointments.createdAt,
        })
        .from(appointments)
        .where(inArray(appointments.id, [9, 14, 8, 32]))
        .orderBy(appointments.id);

    console.table(appts);

    // 2. Histórico completo de rotas desses agendamentos
    console.log("\n" + "=".repeat(80));
    console.log("2️⃣  HISTÓRICO DE ROTAS (TODOS OS ROMANEIOS)");
    console.log("=".repeat(80));

    const routeHistory = await db
        .select({
            appointmentId: stopsTbl.appointmentNumericId,
            routeId: routesTbl.id,
            displayNumber: routesTbl.displayNumber,
            routeStatus: routesTbl.status,
            routeDate: routesTbl.date,
        })
        .from(stopsTbl)
        .innerJoin(routesTbl, eq(stopsTbl.routeId, routesTbl.id))
        .where(inArray(stopsTbl.appointmentNumericId, [9, 14, 8, 32]))
        .orderBy(stopsTbl.appointmentNumericId);

    console.table(routeHistory);

    // 3. Verificar a lógica da query de validação
    console.log("\n" + "=".repeat(80));
    console.log("3️⃣  SIMULANDO A VALIDAÇÃO (confirmado/finalizado)");
    console.log("=".repeat(80));

    const conflictingRoutes = await db
        .select({
            routeId: routesTbl.id,
            routeDisplayNumber: routesTbl.displayNumber,
            routeStatus: routesTbl.status,
            appointmentNumericId: stopsTbl.appointmentNumericId,
        })
        .from(stopsTbl)
        .innerJoin(routesTbl, eq(stopsTbl.routeId, routesTbl.id))
        .where(
            inArray(stopsTbl.appointmentNumericId, [9, 14, 8, 32])
        );

    console.log(`\n📊 Total de registros encontrados: ${conflictingRoutes.length}\n`);
    console.table(conflictingRoutes);

    // 4. Análise por agendamento
    console.log("\n" + "=".repeat(80));
    console.log("4️⃣  ANÁLISE POR AGENDAMENTO");
    console.log("=".repeat(80));

    for (const id of [9, 14, 8, 32]) {
        const apptRoutes = conflictingRoutes.filter(r => r.appointmentNumericId === id);
        const apptInfo = appts.find(a => a.id === id);

        console.log(`\n📌 Agendamento #${id}`);
        console.log(`   Status atual: ${apptInfo?.status}`);
        console.log(`   Data agendada: ${apptInfo?.scheduledDate}`);
        console.log(`   Aparece em ${apptRoutes.length} romaneio(s):`);

        apptRoutes.forEach(r => {
            console.log(`      - Romaneio #${r.routeDisplayNumber} (status: ${r.routeStatus})`);
        });
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ INVESTIGAÇÃO COMPLETA");
    console.log("=".repeat(80));

    process.exit(0);
}

debugAppointments().catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
});
