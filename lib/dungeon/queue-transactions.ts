import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { dungeonsRef } from "../firebase-admin";
import { DungeonTeamResource, DungeonQueueItem } from "@/types";
import { assignPlayersToTeam } from "./queue-engine";

/**
 * Transaction to auto-assign players to an available team.
 * Uses Firebase transactions to ensure no race conditions (double assignment).
 */
export const autoAssignTeamTransaction = async (
  teamId: string,
  previousTeamMembers?: { name: string; job: string; roundNumber: number }[]
): Promise<{ updatedTeam: DungeonTeamResource; assignedCount: number }> => {
  const db = getFirestore();
  const dRef = dungeonsRef();

  return await db.runTransaction(async (t) => {
    // 1. Read Team State
    const teamRef = dRef.collection("dungeon_teams").doc(teamId);
    const teamSnap = await t.get(teamRef);

    if (!teamSnap.exists) {
      throw new Error(`Team ${teamId} does not exist`);
    }

    const team = teamSnap.data() as DungeonTeamResource;

    if (team.status !== "AVAILABLE") {
      // Nothing to assign if team is not available
      return { updatedTeam: team, assignedCount: 0 };
    }

    if (team.activeMembers.length >= 3) {
      // Team is already full
      return { updatedTeam: team, assignedCount: 0 };
    }

    // 2. Read Waiting Queue Items
    const queueItemsRef = dRef.collection("dungeon_queue_items");
    const queueItemsSnap = await t.get(queueItemsRef.where("status", "==", "WAITING"));

    const allQueueItems: DungeonQueueItem[] = [];
    queueItemsSnap.forEach((doc) => {
      allQueueItems.push({ id: doc.id, ...doc.data() } as DungeonQueueItem);
    });

    // 3. Process Assignment Logic
    const { updatedTeam, updatedItems } = assignPlayersToTeam(team, allQueueItems, previousTeamMembers);

    if (updatedItems.length === 0) {
      // No one assigned
      return { updatedTeam: team, assignedCount: 0 };
    }

    // 4. Write Updates back to DB
    t.update(teamRef, {
      activeMembers: updatedTeam.activeMembers,
    });

    for (const item of updatedItems) {
      const itemRef = queueItemsRef.doc(item.id);
      t.update(itemRef, {
        status: item.status,
        assignedTeamId: item.assignedTeamId,
      });
    }

    return { updatedTeam, assignedCount: updatedItems.length };
  });
};

/**
 * Transaction to pause, resume, or complete a team
 */
export const teamControlTransaction = async (
  teamId: string,
  action: "start" | "pause" | "complete"
): Promise<{ team: DungeonTeamResource; previousMembers?: { name: string; job: string; roundNumber: number }[] }> => {
  const db = getFirestore();
  const dRef = dungeonsRef();

  return await db.runTransaction(async (t) => {
    const teamRef = dRef.collection("dungeon_teams").doc(teamId);
    const teamSnap = await t.get(teamRef);

    if (!teamSnap.exists) {
      throw new Error(`Team ${teamId} does not exist`);
    }

    const team = teamSnap.data() as DungeonTeamResource;
    const now = Date.now();

    if (action === "start") {
      if (team.status === "RUNNING") throw new Error("Team is already running");
      
      const updates: Partial<DungeonTeamResource> = {
        status: "RUNNING",
      };

      if (team.status === "PAUSED" && team.pausedAt) {
        updates.pausedDuration = team.pausedDuration + (now - team.pausedAt);
        updates.pausedAt = null;
      } else if (team.status === "AVAILABLE") {
        updates.startedAt = now;
        updates.pausedDuration = 0;
        updates.pausedAt = null;
      }

      t.update(teamRef, updates);
      return { team: { ...team, ...updates } as DungeonTeamResource };
    }

    if (action === "pause") {
      if (team.status !== "RUNNING") throw new Error("Only running teams can be paused");
      
      const updates: Partial<DungeonTeamResource> = {
        status: "PAUSED",
        pausedAt: now,
      };

      t.update(teamRef, updates);
      return { team: { ...team, ...updates } as DungeonTeamResource };
    }

    if (action === "complete") {
      if (team.status === "AVAILABLE") throw new Error("Team is already available (completed)");
      
      const previousMembers = team.activeMembers.map(m => ({ name: m.name, job: m.job, roundNumber: m.roundNumber }));

      // Update the team
      const updates: Partial<DungeonTeamResource> = {
        status: "AVAILABLE",
        startedAt: null,
        pausedAt: null,
        pausedDuration: 0,
        activeMembers: [], // clear members
        completedRounds: team.completedRounds + 1,
      };
      
      t.update(teamRef, updates);

      // Update the assigned queue items to COMPLETED
      const queueItemsRef = dRef.collection("dungeon_queue_items");
      const bookingsToUpdate = new Map<string, { r1?: boolean; r2?: boolean }>();

      for (const member of team.activeMembers) {
        const itemRef = queueItemsRef.doc(member.queueItemId);
        t.update(itemRef, {
          status: "COMPLETED",
          completedAt: now,
        });

        const itemSnap = await t.get(itemRef);
        if (itemSnap.exists) {
          const itemData = itemSnap.data() as DungeonQueueItem;
          const current = bookingsToUpdate.get(itemData.bookingId) || {};
          if (itemData.roundNumber === 1) current.r1 = true;
          if (itemData.roundNumber === 2) current.r2 = true;
          bookingsToUpdate.set(itemData.bookingId, current);
        }
      }

      const queuesRef = dRef.collection("queues");
      const entries = Array.from(bookingsToUpdate.entries());
      for (const [bookingId, rounds] of entries) {
        const queueDocRef = queuesRef.doc(bookingId);
        const updates: any = {};
        if (rounds.r1) updates.round1 = true;
        if (rounds.r2) updates.round2 = true;
        t.update(queueDocRef, updates);
      }

      return { team: { ...team, ...updates } as DungeonTeamResource, previousMembers };
    }

    throw new Error("Invalid action");
  });
};
