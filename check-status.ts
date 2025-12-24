import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkStatuses() {
    // Buscar todos os status únicos
    const result = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM appointments
    GROUP BY status
    ORDER BY count DESC
  `);

    console.log("STATUS ÚNICOS NO BANCO:");
    console.table(result.rows);

    // Buscar agendamentos com status não padrão
    const nonStandard = await db.execute(sql`
    SELECT id, status, created_at
    FROM appointments  
    WHERE status NOT IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled')
    ORDER BY created_at DESC
    LIMIT 20
  `);

    if (nonStandard.rows.length > 0) {
        console.log("\nAGENDAMENTOS COM STATUS NÃO PADRÃO:");
        console.table(nonStandard.rows);
    } else {
        console.log("\nTodos os status estão corretos!");
    }

    process.exit(0);
}

checkStatuses().catch(console.error);
