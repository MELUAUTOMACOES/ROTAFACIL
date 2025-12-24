import { db } from "./server/db";
import { appointments } from "./shared/schema";
import { eq, sql } from "drizzle-orm";

async function fixStatus() {
    console.log("Corrigindo status do agendamento ID 9...");

    // Buscar antes
    const [before] = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 9));

    console.log("ANTES:", before?.status);

    // Corrigir
    await db
        .update(appointments)
        .set({ status: "scheduled" })
        .where(eq(appointments.id, 9));

    // Verificar depois
    const [after] = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 9));

    console.log("DEPOIS:", after?.status);
    console.log("\n✅ Status corrigido!");

    process.exit(0);
}

fixStatus().catch(console.error);
