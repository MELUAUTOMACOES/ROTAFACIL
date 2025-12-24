import { eq, inArray } from "drizzle-orm";
import { db } from "./server/db";
import { appointments, routeStops as stopsTbl } from "./shared/schema";

async function forceResetAll() {
    const routeId = '2048069b-6d37-43d2-93c3-5ddd067d9f8c';

    // Buscar todos os agendamentos desta rota
    const stops = await db
        .select({ appointmentNumericId: stopsTbl.appointmentNumericId })
        .from(stopsTbl)
        .where(eq(stopsTbl.routeId, routeId));

    const apptIds = stops
        .map(s => s.appointmentNumericId)
        .filter((id): id is number => id !== null);

    console.log("Agendamentos na rota:", apptIds);

    // Buscar status atual
    const before = await db
        .select({ id: appointments.id, status: appointments.status, executionStatus: appointments.executionStatus })
        .from(appointments)
        .where(inArray(appointments.id, apptIds));

    console.log("\nANTES:");
    before.forEach(a => console.log(`  ID ${a.id}: status=${a.status}, executionStatus=${a.executionStatus}`));

    // Forcar reset de TODOS (sem filtrar por status)
    console.log("\nResetando TODOS os agendamentos...");
    await db
        .update(appointments)
        .set({ executionStatus: null, executionNotes: null })
        .where(inArray(appointments.id, apptIds));

    // Verificar depois
    const after = await db
        .select({ id: appointments.id, status: appointments.status, executionStatus: appointments.executionStatus })
        .from(appointments)
        .where(inArray(appointments.id, apptIds));

    console.log("\nDEPOIS:");
    after.forEach(a => console.log(`  ID ${a.id}: status=${a.status}, executionStatus=${a.executionStatus}`));

    console.log("\nPronto!");
    process.exit(0);
}

forceResetAll().catch(console.error);
