import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { dungeonsRef, rosterRef } from "../firebase-admin";
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

    // 2.5 Fetch Roster to know carrier jobs
    const rosterSnap = await t.get(rosterRef());
    let rosterJobs: Record<string, string> = {};
    if (rosterSnap.exists) {
      const rosterData = rosterSnap.data() as Record<string, { name: string }[]>;
      for (const [job, members] of Object.entries(rosterData)) {
        for (const m of members) {
          rosterJobs[m.name] = job;
        }
      }
    }

    // 3. Process Assignment Logic
    const { updatedTeam, updatedItems } = assignPlayersToTeam(team, allQueueItems, previousTeamMembers, rosterJobs);

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
      
      // Update the assigned queue items to COMPLETED
      const queueItemsRef = dRef.collection("dungeon_queue_items");
      const bookingsToUpdate = new Map<string, { r1?: boolean; r2?: boolean }>();

      // First, perform all reads (t.get)
      const itemSnaps = await Promise.all(
        team.activeMembers.map(member => t.get(queueItemsRef.doc(member.queueItemId)))
      );

      const queueDocSnaps = new Map<string, any>();
      for (const itemSnap of itemSnaps) {
        if (itemSnap.exists) {
          const itemData = itemSnap.data() as DungeonQueueItem;
          const current = bookingsToUpdate.get(itemData.bookingId) || {};
          if (itemData.roundNumber === 1) current.r1 = true;
          if (itemData.roundNumber === 2) current.r2 = true;
          bookingsToUpdate.set(itemData.bookingId, current);

          if (!queueDocSnaps.has(itemData.bookingId)) {
             const qDoc = await t.get(dRef.collection("queues").doc(itemData.bookingId));
             if (qDoc.exists) queueDocSnaps.set(itemData.bookingId, qDoc.data());
          }
        }
      }

      // Then, perform all writes (t.update)
      t.update(teamRef, updates);

      for (const member of team.activeMembers) {
        const itemRef = queueItemsRef.doc(member.queueItemId);
        t.update(itemRef, {
          status: "COMPLETED",
          completedAt: now,
        });
      }

      const queuesRef = dRef.collection("queues");
      for (const [bookingId, rounds] of Array.from(bookingsToUpdate.entries())) {
        const queueDocRef = queuesRef.doc(bookingId);
        const qData = queueDocSnaps.get(bookingId);
        
        const updates: any = {};
        let r1 = qData?.round1 || false;
        let r2 = qData?.round2 || false;
        
        if (rounds.r1) { updates.round1 = true; r1 = true; }
        if (rounds.r2) { updates.round2 = true; r2 = true; }
        
        const totalRounds = qData?.rounds || 1;
        const allDone = (totalRounds === 1) ? r1 : (r1 && r2);
        
        updates.status = allDone ? "done" : "active";
        t.update(queueDocRef, updates);
      }

      return { team: { ...team, ...updates } as DungeonTeamResource, previousMembers };
    }

    if (action === "eject") {
      // Not used here, implemented below
      throw new Error("Invalid action for this transaction");
    }

    throw new Error("Invalid action");
  });
};

/**
 * Transaction to eject a specific player from a team back to the queue
 */
export const ejectMemberTransaction = async (
  teamId: string,
  queueItemId: string
): Promise<{ team: DungeonTeamResource }> => {
  const db = getFirestore();
  const dRef = dungeonsRef();

  return await db.runTransaction(async (t) => {
    const teamRef = dRef.collection("dungeon_teams").doc(teamId);
    const teamSnap = await t.get(teamRef);

    if (!teamSnap.exists) {
      throw new Error(`Team ${teamId} does not exist`);
    }

    const team = teamSnap.data() as DungeonTeamResource;
    
    // Find the member
    const memberIndex = team.activeMembers.findIndex(m => m.queueItemId === queueItemId);
    if (memberIndex === -1) {
      // Member not in team, maybe already ejected. Just return current team.
      return { team };
    }

    // Update team
    const updatedMembers = [...team.activeMembers];
    updatedMembers.splice(memberIndex, 1);
    t.update(teamRef, { activeMembers: updatedMembers });

    // Update queue item
    const itemRef = dRef.collection("dungeon_queue_items").doc(queueItemId);
    t.update(itemRef, {
      status: "WAITING",
      assignedTeamId: null,
      queuedAt: Date.now(), // Put them at the end of the line? Or keep original? The user asked to just remove them from team. It's safer to use Date.now() so they don't instantly get re-assigned if we auto-assign again, giving admin time to skip/delete them.
    });

    return { team: { ...team, activeMembers: updatedMembers } as DungeonTeamResource };
  });
};

/**
 * Transaction to manually assign a specific player to a team
 */
export const manualAssignTeamTransaction = async (
  teamId: string,
  queueItemId: string
): Promise<{ team: DungeonTeamResource }> => {
  const db = getFirestore();
  const dRef = dungeonsRef();

  return await db.runTransaction(async (t) => {
    const teamRef = dRef.collection("dungeon_teams").doc(teamId);
    const teamSnap = await t.get(teamRef);

    if (!teamSnap.exists) {
      throw new Error(`Team ${teamId} does not exist`);
    }

    const team = teamSnap.data() as DungeonTeamResource;
    
    // Check if team is full (max 5 minus carriers)
    const carrierCount = team.carriers?.length || 0;
    if (team.activeMembers.length >= (5 - carrierCount)) {
      throw new Error("Team is already full");
    }

    const itemRef = dRef.collection("dungeon_queue_items").doc(queueItemId);
    const itemSnap = await t.get(itemRef);

    if (!itemSnap.exists) {
      throw new Error("Queue item does not exist");
    }

    const item = itemSnap.data() as DungeonQueueItem;
    
    if (item.status !== "WAITING") {
      throw new Error(`Cannot assign item with status ${item.status}`);
    }

    // Check if player is already in team
    if (team.activeMembers.some(m => m.queueItemId === queueItemId)) {
      return { team };
    }

    // Check for Priest requirement
    const rosterSnap = await t.get(rosterRef());
    let rosterJobs: Record<string, string> = {};
    if (rosterSnap.exists) {
      const rosterData = rosterSnap.data() as Record<string, { name: string }[]>;
      for (const [job, members] of Object.entries(rosterData)) {
        for (const m of members) {
          rosterJobs[m.name] = job;
        }
      }
    }

    const carrierHasPriest = (team.carriers || []).some(c => rosterJobs[c] === "Priest");
    const activeMembersHasPriest = team.activeMembers.some(m => m.job === "Priest");
    const incomingIsPriest = item.job === "Priest";

    if (!carrierHasPriest && !activeMembersHasPriest && !incomingIsPriest) {
      throw new Error("ทีมขาดพระ ต้องการพระ priest");
    }

    // Update team
    const updatedMembers = [...team.activeMembers, {
      queueItemId: item.id || queueItemId,
      name: item.name,
      job: item.job,
      roundNumber: item.roundNumber,
    }];
    t.update(teamRef, { activeMembers: updatedMembers });

    // Update queue item
    t.update(itemRef, {
      status: "ASSIGNED",
      assignedTeamId: teamId,
    });

    return { team: { ...team, activeMembers: updatedMembers } as DungeonTeamResource };
  });
};
