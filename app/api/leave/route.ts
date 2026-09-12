export const dynamic = "force-dynamic";
import { getDb, leaveRef, teamsRef } from "@/lib/firebase-admin";
import { removeMemberFromTeamsTransaction } from "@/lib/team-sync";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { ok, err, notFound, handleServerError, logAction } from "@/lib/server-utils";
import { leaveSubmitSchema, leaveDeleteSchema, validateBody } from "@/lib/validations";
import { trackFirestoreRead } from "@/lib/firestore-logger";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const limitParam = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 100);
    const before = Number(searchParams.get("before"));

    let query = leaveRef().collection("records").orderBy("timestamp", "desc");
    if (!isNaN(before) && before > 0) {
      query = query.startAfter(before);
    }

    const snap = await trackFirestoreRead(
      "GET /api/leave",
      "leaves records query",
      () => query.limit(limitParam).get()
    );
    const records = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return ok(records);
  } catch (e: unknown) {
    return handleServerError(e, "Failed to load leave records");
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const validation = validateBody(leaveSubmitSchema, body);
    if (!validation.success) {
      return err(validation.error, 400);
    }

    const { name, job, date, day, reason } = validation.data;

    // Authorization: a regular member may only submit leave for their own
    // in-game character. This also gates the GVG auto-remove side effect
    // below, which previously let anyone kick anyone out of the roster.
    const isAdmin = auth.user.role === "admin" || auth.user.role === "owner";
    if (!isAdmin && auth.user.gameUsername !== name) {
      return err("คุณสามารถแจ้งลาได้เฉพาะตัวละครของตนเองเท่านั้น", 403);
    }

    const newLeave = {
      name,
      job: job || "",
      date: date || "",
      day: day || "",
      reason: reason || "",
      submittedBy: auth.user.gameUsername || auth.user.discordUsername || "User",
      timestamp: Date.now(),
    };

    const docRef = await leaveRef().collection("records").add(newLeave);

    // Auto-remove from GVG Teams via atomic transaction to prevent Lost Updates
    try {
      const db = getDb();
      const tRef = teamsRef();
      await removeMemberFromTeamsTransaction(db, tRef, name);
    } catch (e) {
      console.error("Error auto-removing from teams:", e);
    }

    // Save audit log to database
    logAction({
      module: "LEAVE",
      action: "SUBMIT_LEAVE",
      actor: auth.user.gameUsername || auth.user.discordUsername || "User",
      target: name,
      detail: `แจ้งลาวอ วัน${day ? ` ${day}` : ""} วันที่ ${date || "-"} (เหตุผล: ${reason || "-"})`,
      extra: { name, job, date, day, reason },
    });

    return ok({ id: docRef.id, ...newLeave });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to submit leave request");
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const validation = validateBody(leaveDeleteSchema, body);
    if (!validation.success) {
      return err(validation.error, 400);
    }

    const { id } = validation.data;

    const snap = await leaveRef().collection("records").doc(id).get();
    if (!snap.exists) {
      return notFound("ไม่พบรายการแจ้งลานี้");
    }
    const lData = snap.data() as any;

    await leaveRef().collection("records").doc(id).delete();

    // Save audit log to database
    logAction({
      module: "LEAVE",
      action: "DELETE_LEAVE",
      actor: auth.user.gameUsername || auth.user.discordUsername || "Admin",
      target: lData?.name || id,
      detail: `ลบรายการแจ้งลาของ ${lData?.name || id} (วันที่ ${lData?.date || lData?.day || "-"})`,
      extra: lData || { id },
    });

    return ok({ success: true });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to delete leave record");
  }
}


