import { dungeonsRef } from "@/lib/firebase-admin";
import { ok, handleServerError } from "@/lib/server-utils";
import { DungeonTeamResource } from "@/types";
import { createInitialTeam } from "@/lib/dungeon/queue-state";
import { trackFirestoreRead } from "@/lib/firestore-logger";
import { requireAuth } from "@/lib/auth";
import { getOrSetDungeonTeamsCache } from "@/lib/dungeon/queue-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const result = await getOrSetDungeonTeamsCache(async () => {
      const [snap, scheduleDoc] = await Promise.all([
        trackFirestoreRead(
          "GET /api/dungeon/teams",
          "dungeon_teams query",
          () => dungeonsRef().collection("dungeon_teams").get()
        ),
        trackFirestoreRead(
          "GET /api/dungeon/teams",
          "dungeon_schedule doc get",
          () => dungeonsRef().parent.doc("dungeon_schedule").get()
        ),
      ]);
      let teams: DungeonTeamResource[] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DungeonTeamResource));
      const carryTeamsCount = scheduleDoc.exists ? (scheduleDoc.data()?.carryTeamsCount || 1) : 1;

      // Build team list: if a team doc is missing, use a virtual default (no writes).
      // estimatedDurationSeconds is normalised in memory — we never batch-write on GET.
      const validIds = Array.from({ length: carryTeamsCount }).map((_, i) => `team-${i + 1}`);

      const teamsById = new Map(teams.map((t) => [t.id, t]));

      const teamList: DungeonTeamResource[] = validIds.map((teamId) => {
        const existing = teamsById.get(teamId);
        if (existing) {
          // Normalise in-memory only — no Firestore write
          return {
            ...existing,
            estimatedDurationSeconds: existing.estimatedDurationSeconds || 600,
          };
        }
        // Team doc missing → return a virtual default without writing
        return createInitialTeam(teamId, "ดันมายา (Maya)") as DungeonTeamResource;
      });

      teamList.sort((a, b) => a.id.localeCompare(b.id));
      return teamList;
    });

    return ok(result);
  } catch (e: unknown) {
    return handleServerError(e, "Failed to load teams");
  }
}
