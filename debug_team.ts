
import { db } from "./server/db";
import { teams, services, technicians } from "./shared/schema";
import { eq } from "drizzle-orm";

async function checkTeamConfig() {
    console.log("Checking Service ID 2...");
    const service = await db.query.services.findFirst({
        where: eq(services.id, 2)
    });
    console.log("Service 2:", service);

    console.log("\nChecking Teams...");
    const allTeams = await db.query.teams.findMany();
    for (const team of allTeams) {
        console.log(`Team: ${team.name} (ID: ${team.id}), Service IDs: ${team.serviceIds}`);
        if (team.serviceIds?.includes('2')) {
            console.log("  -> MATCHES Service 2");
        } else {
            console.log("  -> DOES NOT match Service 2");
        }
    }

    process.exit(0);
}

checkTeamConfig();
