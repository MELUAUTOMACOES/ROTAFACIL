
import { db } from "../server/db";
import { appointments } from "../shared/schema";
import { inArray } from "drizzle-orm";

async function main() {
    console.log("🔍 Investigating specific appointments...");

    const idsToCheck = [9, 34, 23, 13, 20, 21, 31];
    const results = await db.select().from(appointments).where(inArray(appointments.id, idsToCheck));

    console.log(`Found ${results.length} appointments:`);
    results.forEach(apt => {
        console.log("------------------------------------------------");
        console.log(`ID: ${apt.id}`);
        console.log(`Date: ${apt.scheduledDate}`);
        console.log(`Status: ${apt.status}`);
        console.log(`TechnicianID: ${apt.technicianId}`);
        console.log(`TeamID: ${apt.teamId}`);
        console.log(`ServiceID: ${apt.serviceId}`);
        console.log(`Notes: ${apt.notes}`);
        console.log(`Client ID: ${apt.clientId}`);
        console.log("------------------------------------------------");
    });

    process.exit(0);
}

main().catch(console.error);
