import { eq, inArray, and, or } from "drizzle-orm";
import { db } from "./server/db";
import { appointments, routes as routesTbl, routeStops as stopsTbl } from "./shared/schema";

async function resetExecutionStatus() {
    console.log("\n🔄 RESETANDO executionStatus DOS AGENDAMENTOS REMARCADOS\n");

    // 1. Buscar o romaneio ativo (rota 28 / confirmada)
    const routeId = '2048069b-6d37-43d2-93c3-5ddd067d9f8c';

    // 2. Buscar paradas desta rota
    const stops = await db
        .select({ appointmentNumericId: stopsTbl.appointmentNumericId })
        .from(stopsTbl)
        .where(eq(stopsTbl.routeId, routeId));

    const apptIds = stops
        .map(s => s.appointmentNumericId)
        .filter((id): id is number => id !== null);

    console.log(`📋 Agendamentos na rota: ${apptIds.join(', ')}`);

    // 3. Buscar status atual dos agendamentos
    const appointmentsData = await db
        .select({
            id: appointments.id,
            status: appointments.status,
            executionStatus: appointments.executionStatus,
        })
        .from(appointments)
        .where(inArray(appointments.id, apptIds));

    console.log("\n==== STATUS ATUAL ====");
    appointmentsData.forEach(a => {
        console.log(`  ID ${a.id}: status=${a.status}, executionStatus=${a.executionStatus}`);
    });

    // 4. Filtrar agendamentos que são scheduled/rescheduled E têm executionStatus antigo
    const toReset = appointmentsData
        .filter(a =>
            (a.status === 'scheduled' || a.status === 'rescheduled') &&
            a.executionStatus !== null
        )
        .map(a => a.id);

    if (toReset.length === 0) {
        console.log("\n✅ Nenhum agendamento precisa de reset");
        process.exit(0);
    }

    console.log(`\n🔧 Resetando ${toReset.length} agendamentos: ${toReset.join(', ')}`);

    // 5. Resetar executionStatus para null
    await db
        .update(appointments)
        .set({
            executionStatus: null,
            executionNotes: null
        })
        .where(inArray(appointments.id, toReset));

    console.log("✅ executionStatus resetado com sucesso!");

    // 6. Verificar o resultado
    const afterReset = await db
        .select({
            id: appointments.id,
            status: appointments.status,
            executionStatus: appointments.executionStatus,
        })
        .from(appointments)
        .where(inArray(appointments.id, apptIds));

    console.log("\n==== APÓS RESET ====");
    afterReset.forEach(a => {
        console.log(`  ID ${a.id}: status=${a.status}, executionStatus=${a.executionStatus}`);
    });

    process.exit(0);
}

resetExecutionStatus().catch(console.error);
