
import { db } from "../server/db";
import { appointments } from "../shared/schema";
import { inArray } from "drizzle-orm";

async function main() {
    console.log("🧹 Cleaning up phantom appointments...");

    // IDs identified from the logs as "phantom" (Team only, no technician, causing duplicates/issues)
    // ID 9 is the valid one for Felipe Costa, so we exclude it.
    const idsToDelete = [13, 20, 21, 23, 31, 34];

    console.log(`Targeting IDs for deletion: ${idsToDelete.join(", ")}`);

    const result = await db.delete(appointments).where(inArray(appointments.id, idsToDelete)).returning();

    console.log(`✅ Deleted ${result.length} appointments.`);
    result.forEach(apt => {
        console.log(` - Deleted ID: ${apt.id} (Date: ${apt.scheduledDate}, Status: ${apt.status})`);
    });

    process.exit(0);
}

main().catch(console.error);
