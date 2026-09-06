import { DungeonQueueItem, DungeonTeamResource } from "@/types";
import { sortQueueItems, getWaitingItems, findContinuousPriest } from "./queue-rules";
import { QUEUE_CONSTANTS } from "./queue-state";

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
  if (team.status !== "AVAILABLE") {
    return { updatedTeam: { ...team }, updatedItems: [] };
  }

  // Filter and sort eligible waiting items
  let waitingItems = sortQueueItems(getWaitingItems(allQueueItems));
  
  const newlyAssignedItems: DungeonQueueItem[] = [];
  const newActiveMembers: { queueItemId: string; name: string; job: string; roundNumber: 1 | 2 }[] = [];
  
  // Calculate how many slots are available
  // Max team size is 5. Subtract carriers.
  const carrierCount = team.carriers?.length || 0;
  const maxQueueMembers = Math.max(0, 5 - carrierCount);

  // Check if carriers have a Priest
  let hasCarrierPriest = false;
  if (team.carriers && rosterJobs) {
    for (const c of team.carriers) {
      if (rosterJobs[c] === "Priest") {
        hasCarrierPriest = true;
        break;
      }
    }
  }

  let assignedPriestCount = 0;
  const maxPriest = hasCarrierPriest ? 0 : 1;

  // 1. Priest Continuous Rule
  if (previousTeamMembers && previousTeamMembers.length > 0 && maxPriest > 0) {
    const continuousPriest = findContinuousPriest(previousTeamMembers, waitingItems);
    if (continuousPriest && newActiveMembers.length < maxQueueMembers) {
      newlyAssignedItems.push({ ...continuousPriest, status: "ASSIGNED", assignedTeamId: team.id });
      newActiveMembers.push({
        queueItemId: continuousPriest.id,
        name: continuousPriest.name,
        job: continuousPriest.job,
        roundNumber: continuousPriest.roundNumber,
      });
      assignedPriestCount++;
      // Remove this priest from waiting list for subsequent generic assignments
      waitingItems = waitingItems.filter((item) => item.id !== continuousPriest.id);
    }
  }

  // 2. Fill remaining slots sequentially
  for (const item of waitingItems) {
    if (newActiveMembers.length >= maxQueueMembers) {
      break;
    }
    
    // Check if team already has this person (to prevent double assigning the same person in weird edge cases)
    const isAlreadyInTeam = newActiveMembers.some(m => m.name === item.name);
    if (isAlreadyInTeam) continue;

    // Check Priest limit
    if (item.job === "Priest") {
      if (assignedPriestCount >= maxPriest) {
        continue; // Skip this Priest, team is full of Priests
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
