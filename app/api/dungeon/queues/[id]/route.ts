export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { ok, err, handleServerError, logAction } from "@/lib/server-utils";
import { dungeonsRef } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth";
import { dungeonQueuePatchSchema, validateBody } from "@/lib/validations";

type Params = { params: { id: string } };

// PATCH /api/dungeon/queues/[id]
// Body: { round: 1 | 2 } or { action: "updateRounds", rounds: 1 | 2 }
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

    // Check if the action is updating rounds
    if (action === "updateRounds") {
      if (newRounds === 1 || newRounds === 2) {
        update.rounds = newRounds;
        totalRounds = newRounds;
      }
    } else {
      // Normal mark round done
      if (round === 1) { update.round1 = true; newRound1 = true; }
      if (round === 2) { update.round2 = true; newRound2 = true; }
    }

    const allDone = totalRounds === 1 ? newRound1 : newRound1 && newRound2;

    if (allDone) {
      update.status = "done";
    } else {
      update.status = (newRound1 || newRound2) ? "active" : "waiting";
    }

    await docRef.update(update);

    // Save audit log to database
    logAction({
      module: "DUNGEON",
      action: action === "updateRounds" ? "UPDATE_ROUNDS" : "COMPLETE_ROUND",
      actor: data?.name || "System",
      target: data?.name || id,
      detail: action === "updateRounds" 
        ? `แก้ไขจำนวนรอบเป็น ${update.rounds} รอบ` 
        : `อัปเดตรอบที่ ${round} สำเร็จ (สถานะ: ${update.status === "done" ? "เสร็จสิ้น" : "กำลังลง"})`,
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