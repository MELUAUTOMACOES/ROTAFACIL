// Script to apply performance indexes to the database
import { db } from "./server/db.js";
import { sql } from "drizzle-orm";

async function applyIndexes() {
    console.log("📊 Aplicando índices de performance...\n");

    try {
        const indexes = [
            "CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments (user_id)",
            "CREATE INDEX IF NOT EXISTS idx_route_stops_appointment_numeric_id ON route_stops (appointment_numeric_id)",
            "CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops (route_id)",
            "CREATE INDEX IF NOT EXISTS idx_routes_status ON routes (status)",
            "CREATE INDEX IF NOT EXISTS idx_routes_id_status ON routes (id, status)"
        ];

        for (const indexSql of indexes) {
            const indexName = indexSql.match(/idx_\w+/)[0];
            console.log(`✓ Criando ${indexName}...`);
            await db.execute(sql.raw(indexSql));
        }

        console.log("\n✅ Todos os índices foram aplicados com sucesso!");
        console.log("🚀 A performance deve melhorar de 30s para menos de 100ms!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Erro:", error.message);
        process.exit(1);
    }
}

applyIndexes();
