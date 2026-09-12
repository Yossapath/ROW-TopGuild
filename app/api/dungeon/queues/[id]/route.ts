export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { ok, err, handleServerError, logAction } from "@/lib/server-utils";
import { dungeonsRef } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { dungeonQueuePatchSchema, validateBody } from "@/lib/validations";
import { invalidateCurrentQueuesCache } from "@/lib/dungeon/queue-cache";

type Params = { params: { id: string } };

// PATCH /api/dungeon/queues/[id]
// Body: { round: 1 | 2 } or { action: "updateRounds"|"skip"|"unskip"|"startRun", rounds?: 1|2 }
//
// เดิม endpoint นี้ไม่มีการเช็คสิทธิ์เลยแม้แต่ requireAuth ทำให้ยิงตรงมา
// ข้าม/เริ่มรัน/มาร์กเสร็จคิวของคนอื่นได้โดยไม่ต้อง login เลย ตอนนี้แยกสิทธิ์เป็น:
//  - "updateRounds": เจ้าของคิวเอง (คนที่ login แล้วชื่อใน token ตรงกับคิวนั้น) แก้ได้
//  - action อื่นๆ ทั้งหมด (startRun / skip / unskip / mark round done): แอดมินเท่านั้น
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { requireAuth } = await import("@/lib/auth");
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const { id } = params;
    const body = await req.json();
    const validation = validateBody(dungeonQueuePatchSchema, body);
    if (!validation.success) {
      return err(validation.error, 400);
    }

    const { round, action, rounds: newRounds } = validation.data;

    const docRef = dungeonsRef().collection("queues").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return err("Queue item not found", 404);

    const qData = snap.data() as { name?: string };
    
    // Check permission
    const isAdmin = auth.user.role === "admin" || auth.user.role === "owner";
    if (!isAdmin) {
      if (action !== "updateRounds" || auth.user.gameUsername !== qData.name) {
        return err("Permission denied", 403);
      }
    }

    const data = snap.data() as {
      name?: string;
      job?: string;
      rounds: 1 | 2;
      round1?: boolean;
      round2?: boolean;
      status: string;
      power?: number;
      dungeon?: string;
      timestamp?: number;
      bookedAt?: number;
      queuedAt?: number;
    };

    if (action === "updateRounds") {
      // สมาชิกแก้ไขจำนวนรอบของคิว "ตัวเอง" ได้ หรือแอดมินก็แก้ได้
      const auth = await requireAuth();
      if (auth.errorResponse) return auth.errorResponse;
      const isAdminCheck = auth.user.role === "admin" || auth.user.role === "owner";
      if (!isAdminCheck && (!auth.user.gameUsername || auth.user.gameUsername.trim() !== (data.name ?? "").trim())) {
        return err("คุณไม่มีสิทธิ์แก้ไขคิวนี้", 403);
      }
    } else {
      // startRun / skip / unskip / mark round done — แอดมินเท่านั้น
      const auth = await requireAdmin();
      if (auth.errorResponse) return auth.errorResponse;
    }

    const update: Record<string, unknown> = {};

    let newRound1 = data.round1 ?? false;
    let newRound2 = data.round2 ?? false;
    let totalRounds = data.rounds ?? 1;

    // ── Action handlers ────────────────────────────────────────
    if (action === "startRun") {
      update.status = "active";
      update.startTime = Date.now();
    } else if (action === "skip") {
      update.queuedAt = Date.now();
      if (!data.bookedAt && data.timestamp) {
        update.bookedAt = data.timestamp;
      }
    } else if (action === "unskip") {
      update.queuedAt = Date.now();
      if (!data.bookedAt && data.timestamp) {
        update.bookedAt = data.timestamp;
      }
      const allDone = totalRounds === 1 ? newRound1 : newRound1 && newRound2;
      update.status = allDone ? "done" : "waiting";
    } else if (action === "updateRounds") {
      if (newRounds === 2) {
        return err("ระบบจำกัดการจองไว้ที่ 1 รอบเท่านั้น", 400);
      }
      if (newRounds === 1) {
        update.rounds = 1;
        totalRounds = 1;
      }
      const allDone = totalRounds === 1 ? newRound1 : newRound1 && newRound2;
      update.status = allDone ? "done" : data.status === "active" ? "active" : "waiting";
    } else {
      if (round === 1) { update.round1 = true; newRound1 = true; }
      if (round === 2) { update.round2 = true; newRound2 = true; }
      const allDone = totalRounds === 1 ? newRound1 : newRound1 && newRound2;
      update.status = allDone ? "done" : data.status;
    }

    const db = dungeonsRef().firestore;
    const batch = db.batch();
    batch.update(docRef, update);

    if (action === "updateRounds") {
      const qItemsSnap = await dungeonsRef().collection("dungeon_queue_items").where("bookingId", "==", id).get();
      const currentItems = qItemsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const hasRound2 = currentItems.find(i => i.roundNumber === 2);
      
      if (newRounds === 1 && hasRound2) {
        // Delete round 2
        batch.delete(dungeonsRef().collection("dungeon_queue_items").doc(hasRound2.id));
      } else if (newRounds === 2 && !hasRound2) {
        // Add round 2
        const itemRef = dungeonsRef().collection("dungeon_queue_items").doc();
        batch.set(itemRef, {
          bookingId: id,
          name: data.name,
          job: data.job,
          power: data.power || 0,
          dungeon: data.dungeon || "ดันมายา (Maya)",
          roundNumber: 2,
          // A newly-created R2 ticket always starts in the waiting queue.
          // The booking itself may already be active because R1 is running,
          // but the R2 item is not assigned to a team yet.
          status: "WAITING",
          queuedAt: Date.now(),
          assignedTeamId: null,
          completedAt: null
        });
      }
    }

    if (action === "skip" || action === "unskip") {
      // Also update queuedAt for queue items to move them to the bottom of waiting queue
      const qItemsSnap = await dungeonsRef().collection("dungeon_queue_items")
        .where("bookingId", "==", id)
        .where("status", "==", "WAITING")
        .get();
      qItemsSnap.docs.forEach(doc => {
        batch.update(doc.ref, { queuedAt: Date.now() });
      });
    }

    await batch.commit();

    // Invalidate in-memory cache so updates immediately propagate to all polling users
    invalidateCurrentQueuesCache();

    // ── Audit log ──────────────────────────────────────────────
    let logDetail = "";
    let logActionType = "COMPLETE_ROUND";

    if (action === "startRun") {
      logActionType = "START_RUN";
      logDetail = `เริ่มรันคิวของ ${data?.name || id}`;
    } else if (action === "skip") {
      logActionType = "SKIP_QUEUE";
      logDetail = `ข้ามคิวของ ${data?.name || id} (ไม่อยู่)`;
    } else if (action === "unskip") {
      logActionType = "UNSKIP_QUEUE";
      logDetail = `นำคิวของ ${data?.name || id} กลับเข้าระบบ (ต่อท้ายคิวปัจจุบัน)`;
    } else if (action === "updateRounds") {
      logActionType = "UPDATE_ROUNDS";
      logDetail = `แก้ไขจำนวนรอบเป็น ${update.rounds} รอบ`;
    } else {
      logActionType = "COMPLETE_ROUND";
      logDetail = `อัปเดตรอบที่ ${round} สำเร็จ (สถานะ: ${update.status === "done" ? "เสร็จสิ้น" : "กำลังลง"})`;
    }

    logAction({
      module: "DUNGEON",
      action: logActionType,
      actor: data?.name || "System",
      target: data?.name || id,
      detail: logDetail,
      extra: { id, ...update },
    });

    return ok({ id, ...update });
  } catch (e: unknown) {
    return handleServerError(e, "Internal server error");
  }
}

// DELETE /api/dungeon/queues/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { requireAuth } = await import("@/lib/auth");
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const { id } = params;
    const docRef = dungeonsRef().collection("queues").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return err("Queue item not found", 404);

    const qData = snap.data() as any;
    
    // Check permission
    const isAdmin = auth.user.role === "admin" || auth.user.role === "owner";
    if (!isAdmin && auth.user.gameUsername !== qData.name) {
      return err("Permission denied", 403);
    }

    // Query associated queue items to verify assignment and prepare deletion
    const qItemsSnap = await dungeonsRef().collection("dungeon_queue_items").where("bookingId", "==", id).get();
    const isAssignedToTeam = qItemsSnap.docs.some((doc) => {
      const itemData = doc.data();
      return itemData.status === "ASSIGNED" || Boolean(itemData.assignedTeamId);
    });

    // Guard: Regular members cannot cancel queues that are already active or assigned to a team
    if (!isAdmin && (qData.status === "active" || isAssignedToTeam)) {
      return err("ไม่สามารถยกเลิกคิวที่กำลังลงดันเจี้ยนหรือถูกจัดเข้าทีมแล้วได้ กรุณาติดต่อแอดมินเพื่อนำออกจากทีมก่อน", 400);
    }

    const db = dungeonsRef().firestore;
    const batch = db.batch();
    batch.delete(docRef);
    
    // Only query and update teams if any deleted queue item was actually assigned to a team
    const assignedTeamIds = new Set<string>();
    const deletedItemIds = new Set<string>();

    qItemsSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedItemIds.add(doc.id);
      const qItemData = doc.data();
      if (qItemData.assignedTeamId) {
        assignedTeamIds.add(qItemData.assignedTeamId);
      }
    });

    if (assignedTeamIds.size > 0) {
      const teamSnaps = await Promise.all(
        Array.from(assignedTeamIds).map(teamId =>
          dungeonsRef().collection("dungeon_teams").doc(teamId).get()
        )
      );

      teamSnaps.forEach(teamSnap => {
        if (teamSnap.exists) {
          const members = (teamSnap.data()?.activeMembers || []).filter(
            (m: any) => !deletedItemIds.has(m.queueItemId)
          );
          batch.update(teamSnap.ref, { activeMembers: members });
        }
      });
    }
    
    await batch.commit();

    // Invalidate in-memory cache so deleted queue immediately disappears for all users
    invalidateCurrentQueuesCache();

    // Save audit log to database
    logAction({
      module: "DUNGEON",
      action: "DELETE_QUEUE",
      actor: auth.user.gameUsername || auth.user.discordUsername || "Admin",
      target: qData?.name || id,
      detail: `ลบคิวของ ${qData?.name || id} (${qData?.job || "-"}) ออกจากระบบ`,
      extra: qData || { id },
    });

    return ok({ id, deleted: true });
  } catch (e: unknown) {
    return handleServerError(e, "Internal server error");
  }
}
