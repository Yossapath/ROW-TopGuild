import { requireAdmin } from "@/lib/auth";
import { ok, err, handleServerError, logAction } from "@/lib/server-utils";
import { teamControlTransaction, autoAssignTeamTransaction, ejectMemberTransaction, manualAssignTeamTransaction } from "@/lib/dungeon/queue-transactions";
import type { DungeonTeamResource } from "@/types";
import { createInitialTeam } from "@/lib/dungeon/queue-state";
import { dungeonsRef } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const teamId = params.id;
    const body = await req.json();
    const { action, carriers, queueItemId } = body;

    if (!["complete", "assign", "manual-assign", "update-carriers", "eject"].includes(action)) {
      return err("Invalid action", 400);
    }

    if (action === "eject" && queueItemId) {
      const { team } = await ejectMemberTransaction(teamId, queueItemId);
      return ok({ message: "Ejected player", data: team });
    }

    if (action === "manual-assign" && queueItemId) {
      const { team } = await manualAssignTeamTransaction(teamId, queueItemId);
      logAction({
        module: "DUNGEON_TEAM",
        action: "MANUAL_ASSIGN",
        actor: auth.user.discordUsername,
        target: teamId,
        detail: `Manually assigned player to ${teamId}`,
      });
      return ok({ message: "Manually assigned player", data: team });
    }

    if (action === "update-carriers") {
      const nextCarriers: string[] = [];
      if (Array.isArray(carriers)) {
        for (const value of carriers) {
          const name = String(value).trim();
          if (name && !nextCarriers.includes(name)) nextCarriers.push(name);
        }
      }

      if (nextCarriers.length > 5) {
        return err("ทีมมีคนแบกได้สูงสุด 5 คน", 400);
      }

      const teamRef = dungeonsRef().collection("dungeon_teams").doc(teamId);
      const teamSnap = await teamRef.get();
      const team = teamSnap.exists
        ? (teamSnap.data() as DungeonTeamResource)
        : createInitialTeam(teamId, "ดันมายา (Maya)");
      const maxPlayers = Math.max(0, 5 - nextCarriers.length);
      if (team.activeMembers.length > maxPlayers) {
        return err(`ไม่สามารถลดคนแบกได้: ทีมมีผู้เล่นอยู่ ${team.activeMembers.length} คน`, 400);
      }

      const currentCarriers = team.carriers || [];
      const isCarriersUnchanged =
        teamSnap.exists &&
        currentCarriers.length === nextCarriers.length &&
        currentCarriers.every((c, i) => c === nextCarriers[i]);

      if (isCarriersUnchanged) {
        return ok({ message: "Updated carriers" });
      }

      if (teamSnap.exists) {
        await teamRef.update({ carriers: nextCarriers });
      } else {
        await teamRef.set({ ...team, carriers: nextCarriers });
      }
      return ok({ message: "Updated carriers" });
    }

    if (action === "assign") {
      const result = await autoAssignTeamTransaction(teamId);
      logAction({
        module: "DUNGEON_TEAM",
        action: "ASSIGN_TEAM",
        actor: auth.user.discordUsername,
        target: teamId,
        detail: `Auto-assigned ${result.assignedCount} players to ${teamId}`,
      });
      return ok({
        message: result.assignedCount > 0 ? `จัดทีมสำเร็จ ${result.assignedCount} คน` : (result.reason || "ไม่สามารถจัดทีมได้"),
        assignedCount: result.assignedCount,
        reason: result.reason,
        data: result.updatedTeam,
      });
    }

    // The simplified workflow has one team-control action:
    // assign players -> run dungeon -> click "ลงเสร็จ".
    const { team: updatedTeam, previousMembers } = await teamControlTransaction(teamId, "complete");

    // Immediately refill the same team from the queue. The previous members
    // are passed in so the continuous Priest R1 -> R2 rule is preserved.
    await autoAssignTeamTransaction(teamId, previousMembers);

    logAction({
      module: "DUNGEON_TEAM",
      action: `TEAM_${action.toUpperCase()}`,
      actor: auth.user.discordUsername,
      target: teamId,
      detail: `Changed team ${teamId} status to ${updatedTeam.status}`,
    });

    return ok({ message: `Team ${action} successful`, data: updatedTeam });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to control team");
  }
}
