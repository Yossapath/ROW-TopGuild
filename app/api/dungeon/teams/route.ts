import { dungeonsRef } from "@/lib/firebase-admin";
import { ok, handleServerError } from "@/lib/server-utils";
import { DungeonTeamResource } from "@/types";
import { createInitialTeam } from "@/lib/dungeon/queue-state";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = await dungeonsRef().collection("dungeon_teams").get();
    let teams: DungeonTeamResource[] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DungeonTeamResource));

    const scheduleDoc = await dungeonsRef().parent.doc("dungeon_schedule").get();
    const carryTeamsCount = scheduleDoc.exists ? (scheduleDoc.data()?.carryTeamsCount || 1) : 1;

    // Create teams if missing or fix existing durations
    let needsUpdate = false;
    const batch = dungeonsRef().firestore.batch();
    
    for (let i = 1; i <= carryTeamsCount; i++) {
      const teamId = `team-${i}`;
      const existingTeam = teams.find(t => t.id === teamId);
      
      if (!existingTeam) {
        const newTeam = createInitialTeam(teamId, "ดันมายา (Maya)");
        batch.set(dungeonsRef().collection("dungeon_teams").doc(teamId), newTeam);
        teams.push(newTeam as DungeonTeamResource);
        needsUpdate = true;
      } else if (existingTeam.estimatedDurationSeconds !== 600) {
        // Enforce 10 minutes (600s) for existing teams
        batch.update(dungeonsRef().collection("dungeon_teams").doc(teamId), {
          estimatedDurationSeconds: 600
        });
        existingTeam.estimatedDurationSeconds = 600;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await batch.commit();
    }

    // Filter to exactly carryTeamsCount
    const validIds = Array.from({ length: carryTeamsCount }).map((_, i) => `team-${i + 1}`);
    teams = teams.filter(t => validIds.includes(t.id));

    // Sort by team ID
    teams.sort((a, b) => a.id.localeCompare(b.id));

    return ok(teams);
  } catch (e: unknown) {
    return handleServerError(e, "Failed to load teams");
  }
}
