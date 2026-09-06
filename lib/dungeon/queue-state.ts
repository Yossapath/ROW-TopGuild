import { DungeonTeamResource, DungeonQueueItem } from "@/types";

export const QUEUE_CONSTANTS = {
  MAX_TEAM_MEMBERS: 3,
  BASE_ESTIMATED_DURATION_SECONDS: 5 * 60, // 5 minutes base time
};

export const createInitialTeam = (id: string, dungeon: any): DungeonTeamResource => ({
  id,
  dungeon,
  status: "AVAILABLE",
  startedAt: null,
  pausedAt: null,
  pausedDuration: 0,
  estimatedDurationSeconds: QUEUE_CONSTANTS.BASE_ESTIMATED_DURATION_SECONDS,
  activeMembers: [],
  completedRounds: 0,
});
