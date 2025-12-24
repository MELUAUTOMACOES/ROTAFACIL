import { db } from "./server/db";
import { appointments } from "./shared/schema";
import { sql } from "drizzle-orm";

async function investigateStatuses() {
    console.log("\n🔍 INVESTIGANDO STATUS DOS AGENDAMENTOS\n");

    // 1. Buscar todos os valores únicos de status
    const uniqueStatuses = await db
        .selectDistinct({ status: appointments.status })
        .from(appointments);

    console.log("==== STATUS ÚNICOS NO BANCO ====");
    uniqueStatuses.forEach(s => console.log(`  - '${s.status}'`));

    // 2. Contar agendamentos por status
    const counts = await db
        .select({
            status: appointments.status,
            count: sql<number>`count(*)::int`
        })
        .from(appointments)
        .groupBy(appointments.status);

    console.log("\n==== CONTAGEM POR STATUS ====");
    counts.forEach(c => console.log(`  ${c.status}: ${c.count} agendamentos`));

    // 3. Identificar status inválidos (não inglês)
    const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled'];
    const invalidStatuses = uniqueStatuses
        .filter(s => !validStatuses.includes(s.status))
        .map(s => s.status);

    if (invalidStatuses.length > 0) {
        console.log("\n⚠️  STATUS INVÁLIDOS ENCONTRADOS:");
        invalidStatuses.forEach(s => console.log(`  - '${s}'`));

        // Buscar agendamentos com status inválidos
        for (const invalidStatus of invalidStatuses) {
            const appts = await db
                .select({ id: appointments.id, status: appointments.status, createdAt: appointments.createdAt })
                .from(appointments)
                .where(sql`${appointments.status} = ${invalidStatus}`)
                .limit(10);

            console.log(`\n  Exemplos de agendamentos com status '${invalidStatus}':`);
            appts.forEach(a => console.log(`    ID ${a.id} - criado em ${a.createdAt}`));
        }
    } else {
        console.log("\n✅ Todos os status estão corretos!");
    }

    process.exit(0);
}

investigateStatuses().catch(console.error);
