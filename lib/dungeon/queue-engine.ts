import { DungeonQueueItem, DungeonTeamResource } from "@/types";
import { sortQueueItems, getWaitingItems, findContinuousPriest } from "./queue-rules";

export interface AssignmentResult {
  updatedTeam: DungeonTeamResource;
  updatedItems: DungeonQueueItem[]; // Only the items that were changed
}

/**
 * Core engine logic to assign waiting players to an available team.
 * This function is pure and returns the calculated updates.
 */
export const assignPlayersToTeam = (
  team: DungeonTeamResource,
  allQueueItems: DungeonQueueItem[],
  previousTeamMembers?: { name: string; job: string; roundNumber: number }[],
  rosterJobs?: Record<string, string>
): AssignmentResult => {
  // Filter and sort eligible waiting items
  let waitingItems = sortQueueItems(getWaitingItems(allQueueItems));


  if (waitingItems.length === 0) {
    return { updatedTeam: { ...team }, updatedItems: [] };
  }

  const newlyAssignedItems: DungeonQueueItem[] = [];
  const newActiveMembers: { queueItemId: string; name: string; job: string; roundNumber: 1 | 2 }[] = [...team.activeMembers];

  // Max team size is 5 players total, including carriers.
  const carrierCount = team.carriers?.length ?? 0;
  const maxQueueMembers = Math.max(0, 5 - carrierCount);

  // Check if carriers already have a Priest — if so, no Priest is needed from queue.
  let hasCarrierPriest = false;
  if (team.carriers && rosterJobs) {
    for (const c of team.carriers) {
      if (rosterJobs[c] === "Priest") {
        hasCarrierPriest = true;
        break;
      }
    }
  }

  // How many priests are already assigned in this team
  let assignedPriestCount = team.activeMembers.filter(m => m.job === "Priest").length;
  const maxPriest = hasCarrierPriest ? 0 : 1;

  // ── Priest Reservation ────────────────────────────────────────────────────
  // If no carrier-Priest and no Priest already in team:
  //   - If a Priest IS waiting → assign normally (Priest first, fill all slots)
  //   - If no Priest is waiting → assign up to (maxQueueMembers - 1), keep 1 slot for a future Priest
  const priestAlreadyInTeam = assignedPriestCount > 0;
  const priestAvailableInQueue = waitingItems.some(item => item.job === "Priest");

  // Effective cap: reserve 1 slot for Priest if needed and Priest isn't in queue yet
  // If no Priest: auto-assign at most 2 people, leaving 1 slot for a future Priest
  const needsPriestReservation = !hasCarrierPriest && !priestAlreadyInTeam && !priestAvailableInQueue;
  const effectiveMax = needsPriestReservation
    ? Math.min(2, Math.max(0, maxQueueMembers - 1))  // cap at 2 people, reserve 1 slot for Priest
    : maxQueueMembers;

  if (effectiveMax === 0) {
    // No room to assign anyone (e.g. 1-slot team and Priest slot is reserved)
    return { updatedTeam: { ...team }, updatedItems: [] };
  }

  // 1. Priest Priority — assign a Priest FIRST if one is available
  if (maxPriest > 0 && assignedPriestCount < maxPriest && priestAvailableInQueue) {
    // Continuous rule: prefer a priest who was in the previous team
    let priestToAssign: DungeonQueueItem | null = null;

    if (previousTeamMembers && previousTeamMembers.length > 0) {
      priestToAssign = findContinuousPriest(previousTeamMembers, waitingItems) ?? null;
    }

    // Fallback: take the first Priest in sorted queue order
    if (!priestToAssign) {
      priestToAssign = waitingItems.find(item => item.job === "Priest") ?? null;
    }

    if (priestToAssign && newActiveMembers.length < effectiveMax) {
      newlyAssignedItems.push({ ...priestToAssign, status: "ASSIGNED", assignedTeamId: team.id });
      newActiveMembers.push({
        queueItemId: priestToAssign.id,
        name: priestToAssign.name,
        job: priestToAssign.job,
        roundNumber: priestToAssign.roundNumber,
      });
      assignedPriestCount++;
      waitingItems = waitingItems.filter(item => item.id !== priestToAssign!.id);
    }
  }

  // 2. Fill remaining slots sequentially (non-Priest, or extra Priests if cap allows)
  for (const item of waitingItems) {
    if (newActiveMembers.length >= effectiveMax) {
      break;
    }

    // Prevent double-assigning the same person
    const isAlreadyInTeam = newActiveMembers.some(m => m.name === item.name);
    if (isAlreadyInTeam) continue;

    // Enforce Priest cap (max 1 Priest per team unless carrier already covers it)
    if (item.job === "Priest") {
      if (assignedPriestCount >= maxPriest) {
        continue; // Team already has its Priest quota filled
      } else {
        assignedPriestCount++;
      }
    }

    newlyAssignedItems.push({ ...item, status: "ASSIGNED", assignedTeamId: team.id });
    newActiveMembers.push({
      queueItemId: item.id,
      name: item.name,
      job: item.job,
      roundNumber: item.roundNumber,
    });
  }

  const updatedTeam: DungeonTeamResource = {
    ...team,
    activeMembers: newActiveMembers,
  };

  return {
    updatedTeam,
    updatedItems: newlyAssignedItems,
  };
};



/**
 * Calculates estimated completion time for a currently RUNNING or PAUSED team.
 * Returns null if team is AVAILABLE (since it hasn't started).
 */
export const calculateTeamETA = (team: DungeonTeamResource, now: number = Date.now()): number | null => {
  if (team.status === "AVAILABLE" || !team.startedAt) return null;

  const baseDurationMs = team.estimatedDurationSeconds * 1000;
  
  if (team.status === "RUNNING") {
    // Current run time = now - startedAt - pausedDuration
    const elapsed = now - team.startedAt - team.pausedDuration;
    const remaining = Math.max(0, baseDurationMs - elapsed);
    return now + remaining;
  }
  
  if (team.status === "PAUSED" && team.pausedAt) {
    // When paused, ETA is fixed relative to paused time
    const elapsedBeforePause = team.pausedAt - team.startedAt - team.pausedDuration;
    const remaining = Math.max(0, baseDurationMs - elapsedBeforePause);
    return team.pausedAt + remaining; // Meaningless if paused indefinitely, but represents ETA if resumed right now
  }

  return null;
};
