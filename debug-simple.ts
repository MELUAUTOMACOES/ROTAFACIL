import { eq, inArray, or, and, ne } from "drizzle-orm";
import { db } from "./server/db";
import { appointments, routes as routesTbl, routeStops as stopsTbl } from "./shared/schema";

async function debug() {
    // Status atual dos agendamentos
    const appts = await db
        .select()
        .from(appointments)
        .where(inArray(appointments.id, [9, 14, 8, 32]));

    console.log("\n==== STATUS ATUAL DOS AGENDAMENTOS ====");
    appts.forEach(a => {
        console.log(`ID: ${a.id} | Status: ${a.status} | Data: ${a.scheduledDate}`);
    });

    // Histórico completo de rotas
    const history = await db
        .select({
            apptId: stopsTbl.appointmentNumericId,
            routeId: routesTbl.id,
            displayNum: routesTbl.displayNumber,
            status: routesTbl.status,
        })
        .from(stopsTbl)
        .innerJoin(routesTbl, eq(stopsTbl.routeId, routesTbl.id))
        .where(inArray(stopsTbl.appointmentNumericId, [9, 14, 8, 32]));

    console.log("\n==== HIST├ôRICO DE ROTAS ====");
    history.forEach(h => {
        console.log(`Appt ${h.apptId} -> Romaneio #${h.displayNum} (${h.status})`);
    });

    // Simular a valida├º├úo
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
                inArray(stopsTbl.appointmentNumericId, [9, 14, 8, 32]),
                or(
                    eq(routesTbl.status, 'confirmado'),
                    eq(routesTbl.status, 'finalizado')
                ),
                ne(routesTbl.id, '2048069b-6d37-43d2-93c3-5ddd067d9f8c')
            )
        );

    console.log("\n==== CONFLITOS (confirmado/finalizado) ====");
    if (conflicts.length === 0) {
        console.log("Nenhum conflito encontrado!");
    } else {
        conflicts.forEach(c => {
            console.log(`CONFLITO: Appt ${c.apptId} em Romaneio #${c.displayNum} (${c.status})`);
        });
    }

    process.exit(0);
}

debug().catch(console.error);
