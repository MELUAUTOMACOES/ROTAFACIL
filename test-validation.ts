import { eq, inArray, or, and, ne } from "drizzle-orm";
import { db } from "./server/db";
import { appointments, routes as routesTbl, routeStops as stopsTbl } from "./shared/schema";

async function testValidation() {
    console.log("\n🧪 TESTANDO A NOVA LÓGICA DE VALIDAÇÃO\n");

    const testApptIds = [9, 14, 8, 32];
    const newRouteId = '2048069b-6d37-43d2-93c3-5ddd067d9f8c'; // Romaneio #28

    // 1. Status atual dos agendamentos
    const appointmentsStatus = await db
        .select({
            id: appointments.id,
            status: appointments.status,
        })
        .from(appointments)
        .where(inArray(appointments.id, testApptIds));

    console.log("==== 1. STATUS DOS AGENDAMENTOS ====");
    appointmentsStatus.forEach(a => {
        console.log(`  ID ${a.id}: ${a.status}`);
    });

    // 2. Filtrar por categoria
    const nonReusableIds = appointmentsStatus
        .filter(a => a.status === 'completed' || a.status === 'in_progress' || a.status === 'cancelled')
        .map(a => a.id);

    const rescheduledIds = appointmentsStatus
        .filter(a => a.status === 'scheduled' || a.status === 'rescheduled')
        .map(a => a.id);

    console.log("\n==== 2. CATEGORIZAÇÃO ====");
    console.log(`  Remarcados (permitidos): [${rescheduledIds.join(', ')}]`);
    console.log(`  Não-reutilizáveis: [${nonReusableIds.join(', ')}]`);

    // 3. Resultado da validação
    console.log("\n==== 3. RESULTADO DA VALIDAÇÃO ====");

    if (nonReusableIds.length === 0) {
        console.log("  ✅ PERMITIDO: Todos os agendamentos foram remarcados");
        console.log("  ✅ O romaneio pode ser confirmado/finalizado");
    } else {
        // Verificar conflitos apenas para os não-reutilizáveis
        const conflicts = await db
            .select({
                apptId: stopsTbl.appointmentNumericId,
                routeId: routesTbl.id,
                displayNum: routesTbl.displayNumber,
                status: routesTbl.status,
            })
            .from(stopsTbl)
            .innerJoin(routesTbl, eq(stopsTbl.routeId, routesTbl.id))
            .where(
                and(
                    inArray(stopsTbl.appointmentNumericId, nonReusableIds),
                    or(
                        eq(routesTbl.status, 'confirmado'),
                        eq(routesTbl.status, 'finalizado')
                    ),
                    ne(routesTbl.id, newRouteId)
                )
            );

        if (conflicts.length > 0) {
            console.log(`  ❌ BLOQUEADO: ${conflicts.length} conflito(s) encontrado(s)`);
            conflicts.forEach(c => {
                console.log(`     - Appt ${c.apptId} em Romaneio #${c.displayNum} (${c.status})`);
            });
        } else {
            console.log("  ✅ PERMITIDO: Nenhum conflito encontrado");
        }
    }

    console.log("\n" + "=".repeat(80));
    process.exit(0);
}

testValidation().catch(console.error);
