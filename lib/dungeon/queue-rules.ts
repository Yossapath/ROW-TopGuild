import { DungeonQueueItem, DungeonTeamResource } from "@/types";

/**
 * Sorts queue items based on Priority Rules:
 * 1. Round Number (Round 1 first)
 * 2. QueuedAt Timestamp (FIFO)
 */
export const sortQueueItems = (items: DungeonQueueItem[]): DungeonQueueItem[] => {
  return [...items].sort((a, b) => {
    if (a.roundNumber !== b.roundNumber) {
      return a.roundNumber - b.roundNumber;
    }
    return a.queuedAt - b.queuedAt;
  });
};

/**
 * Filters for valid waiting items
 */
export const getWaitingItems = (items: DungeonQueueItem[]): DungeonQueueItem[] => {
  return items.filter((i) => i.status === "WAITING");
};

/**
 * Finds if there is a priest from the completing team that has an R2 ticket waiting.
 * This is to support the "Priest continuous run" rule.
 */
export const findContinuousPriest = (
  completingTeamMembers: { name: string; job: string; roundNumber: number }[],
  waitingItems: DungeonQueueItem[]
): DungeonQueueItem | undefined => {
  const priestMembers = completingTeamMembers.filter((m) => m.job === "Priest" && m.roundNumber === 1);
  
  if (priestMembers.length === 0) return undefined;

  for (const priest of priestMembers) {
    const matchingR2 = waitingItems.find(
      (item) => item.name === priest.name && item.job === "Priest" && item.roundNumber === 2
    );
    if (matchingR2) {
      return matchingR2;
    }
  }

  return undefined;
};
