export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { ok, err, handleServerError, logAction } from "@/lib/server-utils";
import { dungeonsRef } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth";
import { dungeonQueuePatchSchema, validateBody } from "@/lib/validations";

type Params = { params: { id: string } };

// PATCH /api/dungeon/queues/[id]
// Body: { round: 1 | 2 } or { action: "updateRounds"|"skip"|"unskip"|"startRun", rounds?: 1|2 }
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
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

    const data = snap.data() as {
      name?: string;
      job?: string;
      rounds: 1 | 2;
      round1?: boolean;
      round2?: boolean;
      status: string;
    };

    const update: Record<string, unknown> = {};

    let newRound1 = data.round1 ?? false;
    let newRound2 = data.round2 ?? false;
    let totalRounds = data.rounds ?? 1;

    // ── Action handlers ────────────────────────────────────────
    if (action === "startRun") {
      // Mark this queue item as actively running; record start time
      update.status = "active";
      update.startTime = Date.now();
    } else if (action === "skip") {
      update.status = "skipped";
    } else if (action === "unskip") {
      // Give a fresh timestamp so the player re-queues AFTER current active players
      // (sorting is by timestamp ascending; active items already have lower timestamps)
      update.timestamp = Date.now();
      const allDone = totalRounds === 1 ? newRound1 : newRound1 && newRound2;
      update.status = allDone ? "done" : "waiting";
    } else if (action === "updateRounds") {
      if (newRounds === 1 || newRounds === 2) {
        update.rounds = newRounds;
        totalRounds = newRounds;
      }
      const allDone = totalRounds === 1 ? newRound1 : newRound1 && newRound2;
      update.status = allDone ? "done" : data.status === "active" ? "active" : "waiting";
    } else {
      // Normal mark round done — does NOT change waiting→active; only active→done
      if (round === 1) { update.round1 = true; newRound1 = true; }
      if (round === 2) { update.round2 = true; newRound2 = true; }
      const allDone = totalRounds === 1 ? newRound1 : newRound1 && newRound2;
      // Keep existing status unless all done (then set done)
      update.status = allDone ? "done" : data.status;
    }

    await docRef.update(update);

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
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const { id } = params;
    const docRef = dungeonsRef().collection("queues").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return err("Queue item not found", 404);

    const qData = snap.data() as any;
    await docRef.delete();

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