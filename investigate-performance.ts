// Script to check if indexes are being used and update database statistics
import { db } from "./server/db.js";
import { sql } from "drizzle-orm";

async function investigatePerformance() {
    console.log("🔍 Investigando performance do banco de dados...\n");

    try {
        // 1. Atualizar estatísticas do banco (ANALYZE)
        console.log("📊 Atualizando estatísticas do PostgreSQL...");
        await db.execute(sql`ANALYZE appointments`);
        await db.execute(sql`ANALYZE route_stops`);
        await db.execute(sql`ANALYZE routes`);
        console.log("✅ Estatísticas atualizadas\n");

        // 2. Verificar se os índices existem
        console.log("🔍 Verificando índices criados:");
        const indexes = await db.execute(sql`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE tablename IN ('appointments', 'route_stops', 'routes')
      AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `);

        console.log("Índices encontrados:");
        indexes.rows.forEach(row => {
            console.log(`  ✓ ${row.tablename}.${row.indexname}`);
        });
        console.log();

        // 3. Testar a query com EXPLAIN ANALYZE
        console.log("📈 Analisando plano de execução da query...\n");
        const explain = await db.execute(sql`
      EXPLAIN ANALYZE
      SELECT 
        a.id,
        a.client_id,
        a.service_id,
        a.user_id,
        r.id as route_id,
        r.status as route_status
      FROM appointments a
      LEFT JOIN route_stops rs ON rs.appointment_numeric_id = a.id
      LEFT JOIN routes r ON rs.route_id = r.id AND r.status IN ('confirmado', 'finalizado')
      WHERE a.user_id = 1
      LIMIT 5
    `);

        console.log("Plano de execução:");
        explain.rows.forEach(row => {
            console.log(row["QUERY PLAN"]);
        });

        console.log("\n✅ Análise concluída!");
        console.log("\n💡 Se aparecer 'Seq Scan' ao invés de 'Index Scan', os índices não estão sendo usados.");
        process.exit(0);

    } catch (error) {
        console.error("❌ Erro:", error.message);
        process.exit(1);
    }
}

investigatePerformance();
