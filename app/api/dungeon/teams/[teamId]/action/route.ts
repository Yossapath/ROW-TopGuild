import { requireAdmin } from "@/lib/auth";
import { ok, err, handleServerError, logAction } from "@/lib/server-utils";
import { teamControlTransaction, autoAssignTeamTransaction } from "@/lib/dungeon/queue-transactions";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const { teamId } = params;
    const body = await req.json();
    const { action } = body; // "start" | "pause" | "complete" | "assign"

    if (!["start", "pause", "complete", "assign"].includes(action)) {
      return err("Invalid action", 400);
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
      return ok({ message: `Assigned ${result.assignedCount} players`, data: result.updatedTeam });
    }

    // Handle Start, Pause, Complete
    const { team: updatedTeam, previousMembers } = await teamControlTransaction(teamId, action as "start" | "pause" | "complete");

    // If completed, trigger auto-assign immediately for the next round (with continuous priest context)
    if (action === "complete") {
       await autoAssignTeamTransaction(teamId, previousMembers);
    }

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
