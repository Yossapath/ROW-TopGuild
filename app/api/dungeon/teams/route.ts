import { dungeonsRef } from "@/lib/firebase-admin";
import { ok, handleServerError } from "@/lib/server-utils";
import { DungeonTeamResource } from "@/types";
import { createInitialTeam } from "@/lib/dungeon/queue-state";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = await dungeonsRef().collection("dungeon_teams").get();
    let teams: DungeonTeamResource[] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DungeonTeamResource));

    // If no teams exist, let's initialize Team 1 and 2 automatically for backward compatibility
    if (teams.length === 0) {
      const db = dungeonsRef().firestore;
      const batch = db.batch();
      
      const team1 = createInitialTeam("team-1", "ดันมายา (Maya)");
      const team2 = createInitialTeam("team-2", "ดันมายา (Maya)");
      
      batch.set(dungeonsRef().collection("dungeon_teams").doc("team-1"), team1);
      batch.set(dungeonsRef().collection("dungeon_teams").doc("team-2"), team2);
      
      await batch.commit();
      teams = [team1, team2];
    }

    // Sort by team ID
    teams.sort((a, b) => a.id.localeCompare(b.id));

    return ok(teams);
  } catch (e: unknown) {
    return handleServerError(e, "Failed to load teams");
  }
}
