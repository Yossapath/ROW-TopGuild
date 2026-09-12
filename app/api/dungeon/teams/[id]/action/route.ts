import { requireAdmin } from "@/lib/auth";
import { ok, err, handleServerError, logAction } from "@/lib/server-utils";
import { teamControlTransaction, autoAssignTeamTransaction, ejectMemberTransaction, manualAssignTeamTransaction } from "@/lib/dungeon/queue-transactions";
import type { DungeonTeamResource } from "@/types";
import { createInitialTeam } from "@/lib/dungeon/queue-state";
import { dungeonsRef } from "@/lib/firebase-admin";
import { invalidateCurrentQueuesCache } from "@/lib/dungeon/queue-cache";

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

    if (action === "eject") {
      const targetId = queueItemId || body.name;
      if (!targetId) {
        return err("Missing player identifier to eject", 400);
      }
      const { team } = await ejectMemberTransaction(teamId, targetId);
      invalidateCurrentQueuesCache();
      logAction({
        module: "DUNGEON_TEAM",
        action: "EJECT_PLAYER",
        actor: auth.user.discordUsername,
        target: teamId,
        detail: `Ejected ${targetId} from ${teamId}`,
      });
      return ok({ message: "นำผู้เล่นออกจากทีมเรียบร้อยแล้ว", data: team });
    }

    if (action === "manual-assign" && queueItemId) {
      const { team } = await manualAssignTeamTransaction(teamId, queueItemId);
      invalidateCurrentQueuesCache();
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
      if (result.assignedCount > 0) {
        invalidateCurrentQueuesCache();
      }
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

    if (action === "complete") {
      const { team: updatedTeam } = await teamControlTransaction(teamId, "complete");
      invalidateCurrentQueuesCache();

      logAction({
        module: "DUNGEON_TEAM",
        action: "TEAM_COMPLETE",
        actor: auth.user.discordUsername,
        target: teamId,
        detail: `Completed dungeon run for ${teamId} (round ${updatedTeam.completedRounds})`,
      });

      return ok({ message: "ลงดันเจี้ยนเสร็จสิ้นเรียบร้อยแล้ว", data: updatedTeam });
    }

    return err("Action not handled", 400);
  } catch (e: unknown) {
    return handleServerError(e, "Failed to control team");
  }
}
