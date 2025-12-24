import { db } from "./server/db";

import { sql } from "drizzle-orm";
import fs from "fs";

async function saveResults() {
    const results: string[] = [];

    const statusCounts = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM appointments
    GROUP BY status
  `);

    results.push("=== STATUS ÚNICOS ===");
    statusCounts.rows.forEach((r: any) => {
        results.push(`${r.status}: ${r.count} agendamentos`);
    });

    const nonStandard = await db.execute(sql`
    SELECT id, status
    FROM appointments  
    WHERE status NOT IN ('scheduled', 'in_progress', 'completed', 'rescheduled', 'cancelled')
    LIMIT 30
  `);

    results.push("\n=== STATUS NÃO PADRÃO ===");
    if (nonStandard.rows.length > 0) {
        nonStandard.rows.forEach((r: any) => {
            results.push(`ID ${r.id}: ${r.status}`);
        });
    } else {
        results.push("Nenhum status não padrão encontrado");
    }

    fs.writeFileSync("status-report.txt", results.join("\n"), "utf-8");
    console.log("Relatório salvo em status-report.txt");
    process.exit(0);
}

saveResults().catch(console.error);
