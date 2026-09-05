export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/server-utils";
import { dungeonsRef } from "@/lib/firebase-admin";

type Params = { params: { id: string } };

// PATCH /api/dungeon/queues/[id]
// Body: { round: 1 | 2 }
// Marks round1 or round2 as done. Auto-sets status="done" when all rounds complete.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = params;
    const body = await req.json() as { round?: 1 | 2 };
    const round = body.round;

    if (round !== 1 && round !== 2) {
      return err("round must be 1 or 2", 400);
    }

    const docRef = dungeonsRef().collection("queues").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return err("Queue item not found", 404);

    const data = snap.data() as {
      rounds: 1 | 2;
      round1?: boolean;
      round2?: boolean;
      status: string;
    };

    const update: Record<string, unknown> = {};

    if (round === 1) update.round1 = true;
    if (round === 2) update.round2 = true;

    const newRound1 = round === 1 ? true : (data.round1 ?? false);
    const newRound2 = round === 2 ? true : (data.round2 ?? false);

    const totalRounds = data.rounds ?? 1;
    const allDone = totalRounds === 1 ? newRound1 : newRound1 && newRound2;

    if (allDone) {
      update.status = "done";
    } else {
      update.status = "active";
    }

    await docRef.update(update);
    return ok({ id, ...update });
  } catch (e) {
    console.error("[PATCH /api/dungeon/queues/[id]]", e);
    return err("Internal server error", 500);
  }
}

// DELETE /api/dungeon/queues/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = params;
    const docRef = dungeonsRef().collection("queues").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return err("Queue item not found", 404);

    await docRef.delete();
    return ok({ id, deleted: true });
  } catch (e) {
    console.error("[DELETE /api/dungeon/queues/[id]]", e);
    return err("Internal server error", 500);
  }
}