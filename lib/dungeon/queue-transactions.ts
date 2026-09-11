import { getFirestore } from "firebase-admin/firestore";
import { dungeonsRef, rosterRef } from "../firebase-admin";
import { DungeonTeamResource, DungeonQueueItem } from "@/types";
import { assignPlayersToTeam } from "./queue-engine";
import { createInitialTeam } from "./queue-state";

/**
 * Transaction to auto-assign players to an available team.
 * Uses Firebase transactions to ensure no race conditions (double assignment).
 */
export const autoAssignTeamTransaction = async (
  teamId: string,
  previousTeamMembers?: { name: string; job: string; roundNumber: number }[]
): Promise<{ updatedTeam: DungeonTeamResource; assignedCount: number; reason?: string }> => {
  const db = getFirestore();
  const dRef = dungeonsRef();

  return await db.runTransaction(async (t) => {
    // 1. Read Team State
    const teamRef = dRef.collection("dungeon_teams").doc(teamId);
    const teamSnap = await t.get(teamRef);

    const team = teamSnap.exists
      ? (teamSnap.data() as DungeonTeamResource)
      : createInitialTeam(teamId, "ดันมายา (Maya)");
    const teamNeedsCreate = !teamSnap.exists;

    // Self-heal: If team has 0 active members, it is available for assignment regardless of legacy status
    if (team.status !== "AVAILABLE") {
      if (team.activeMembers.length === 0) {
        team.status = "AVAILABLE";
      } else {
        return { updatedTeam: team, assignedCount: 0, reason: "ทีมกำลังลงดันเจี้ยนอยู่" };
      }
    }

    const carrierCount = team.carriers?.length ?? 0;
    const maxQueueMembers = Math.max(0, 5 - carrierCount);

    if (team.activeMembers.length >= maxQueueMembers) {
      return { updatedTeam: team, assignedCount: 0, reason: "ทีมเต็มแล้ว (มีสมาชิกครบจำนวน)" };
    }

    // 2. Read Waiting Queue Items
    const queueItemsRef = dRef.collection("dungeon_queue_items");
    const queueItemsSnap = await t.get(queueItemsRef.where("status", "==", "WAITING"));

    if (queueItemsSnap.empty) {
      return { updatedTeam: team, assignedCount: 0, reason: "ไม่มีผู้เล่นรออยู่ในคิว" };
    }

    const allQueueItems: DungeonQueueItem[] = [];
    queueItemsSnap.forEach((doc) => {
      allQueueItems.push({ id: doc.id, ...doc.data() } as DungeonQueueItem);
    });

    // 2.5 Fetch Roster to know carrier jobs (only if team has carriers configured)
    let rosterJobs: Record<string, string> = {};
    if (carrierCount > 0 && team.carriers && team.carriers.length > 0) {
      const rosterSnap = await t.get(rosterRef());
      if (rosterSnap.exists) {
        const rosterData = rosterSnap.data() as Record<string, { name: string }[]>;
        for (const [job, members] of Object.entries(rosterData)) {
          for (const m of members) {
            rosterJobs[m.name] = job;
          }
        }
      }
    }

    // 3. Process Assignment Logic
    const { updatedTeam, updatedItems } = assignPlayersToTeam(team, allQueueItems, previousTeamMembers, rosterJobs);

    if (updatedItems.length === 0) {
      // Check if blocked by Priest requirement
      const hasCarrierPriest = (team.carriers || []).some(c => rosterJobs[c] === "Priest");
      const priestInTeam = team.activeMembers.some(m => m.job === "Priest");
      const priestInQueue = allQueueItems.some(i => i.job === "Priest");

      let reason = "ไม่พบผู้เล่นที่ตรงตามเงื่อนไขการจัดทีม";
      if (!hasCarrierPriest && !priestInTeam && !priestInQueue) {
        if (team.activeMembers.length >= 2) {
          reason = "ทีมมีสมาชิก 2 คนแล้ว ระบบเว้นที่ว่าง 1 ช่องไว้สำหรับ Priest (พระ) เสมอ (หากต้องการลง 3 คนโดยไม่มีพระ สามารถลากผู้เล่นเข้าทีมได้)";
        } else {
          reason = "ไม่มีผู้เล่นในคิวที่ตรงตามเงื่อนไข";
        }
      }
      return { updatedTeam: team, assignedCount: 0, reason };
    }

    // 4. Write Updates back to DB. All transaction reads are complete.
    if (teamNeedsCreate) {
      t.set(teamRef, { ...updatedTeam, status: "AVAILABLE" });
    } else {
      t.update(teamRef, {
        status: "AVAILABLE",
        activeMembers: updatedTeam.activeMembers,
      });
    }

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
      // In the simplified workflow a team stays AVAILABLE while assigned
      // players are running. "complete" is valid whenever players exist.
      if (team.activeMembers.length === 0) {
        throw new Error("ไม่มีผู้เล่นในทีมให้กดลงเสร็จ");
      }

      const previousMembers = team.activeMembers.map(m => ({ name: m.name, job: m.job, roundNumber: m.roundNumber }));

      const queueItemsRef = dRef.collection("dungeon_queue_items");
      const queuesRef = dRef.collection("queues");

      // ── READS FIRST ─────────────────────────────────────────────────
      // Read all queue item docs
      const itemSnaps = await Promise.all(
        team.activeMembers.map(member => t.get(queueItemsRef.doc(member.queueItemId)))
      );

      // Collect unique booking IDs that need updating
      const bookingIds: string[] = [];
      const bookingsToUpdate = new Map<string, { r1?: boolean; r2?: boolean }>();

      for (const itemSnap of itemSnaps) {
        if (itemSnap.exists) {
          const itemData = itemSnap.data() as DungeonQueueItem;
          const current = bookingsToUpdate.get(itemData.bookingId) || {};
          if (itemData.roundNumber === 1) current.r1 = true;
          if (itemData.roundNumber === 2) current.r2 = true;
          bookingsToUpdate.set(itemData.bookingId, current);
          if (!bookingIds.includes(itemData.bookingId)) {
            bookingIds.push(itemData.bookingId);
          }
        }
      }

      // Read all booking queue docs in parallel (must happen before any write)
      const bookingSnaps = await Promise.all(
        bookingIds.map(bid => t.get(queuesRef.doc(bid)))
      );
      const queueDocSnaps = new Map<string, any>();
      for (const bSnap of bookingSnaps) {
        if (bSnap.exists) queueDocSnaps.set(bSnap.id, bSnap.data());
      }

      // ── WRITES AFTER ALL READS ──────────────────────────────────────
      // Update the team
      const teamUpdates: Partial<DungeonTeamResource> = {
        status: "AVAILABLE",
        startedAt: null,
        pausedAt: null,
        pausedDuration: 0,
        activeMembers: [],
        completedRounds: team.completedRounds + 1,
      };
      t.update(teamRef, teamUpdates);

      // Mark queue items as COMPLETED
      for (const member of team.activeMembers) {
        t.update(queueItemsRef.doc(member.queueItemId), {
          status: "COMPLETED",
          completedAt: now,
        });
      }

      // Update parent booking docs
      for (const [bookingId, rounds] of Array.from(bookingsToUpdate.entries())) {
        const qData = queueDocSnaps.get(bookingId);
        const bookingUpdate: any = {};
        let r1 = qData?.round1 || false;
        let r2 = qData?.round2 || false;

        if (rounds.r1) { bookingUpdate.round1 = true; r1 = true; }
        if (rounds.r2) { bookingUpdate.round2 = true; r2 = true; }

        const totalRounds = qData?.rounds || 1;
        const allDone = totalRounds === 1 ? r1 : (r1 && r2);
        bookingUpdate.status = allDone ? "done" : "active";
        t.update(queuesRef.doc(bookingId), bookingUpdate);
      }

      return { team: { ...team, ...teamUpdates } as DungeonTeamResource, previousMembers };
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

    const team = teamSnap.exists
      ? (teamSnap.data() as DungeonTeamResource)
      : createInitialTeam(teamId, "ดันมายา (Maya)");
    const teamNeedsCreate = !teamSnap.exists;
    
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

    // Check for Priest requirement: handled by auto-assign engine.
    // Manual assign (admin action) allows any player without restriction.
    const updatedMembers = [...team.activeMembers, {
      queueItemId: item.id || queueItemId,
      name: item.name,
      job: item.job,
      roundNumber: item.roundNumber,
    }];
    if (teamNeedsCreate) {
      t.set(teamRef, { ...team, activeMembers: updatedMembers });
    } else {
      t.update(teamRef, { activeMembers: updatedMembers });
    }

    // Update queue item
    t.update(itemRef, {
      status: "ASSIGNED",
      assignedTeamId: teamId,
    });

    return { team: { ...team, activeMembers: updatedMembers } as DungeonTeamResource };
  });
};
