export const dynamic = "force-dynamic";
import { leaveRef, teamsRef } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { ok, err, handleServerError, logAction } from "@/lib/server-utils";
import { leaveSubmitSchema, leaveDeleteSchema, validateBody } from "@/lib/validations";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const snap = await leaveRef().collection("records").orderBy("timestamp", "desc").limit(200).get();
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

    // Auto-remove from GVG Teams
    try {
      const tRef = teamsRef();
      const tDoc = await tRef.get();
      if (tDoc.exists) {
        let tData = tDoc.data() as any;
        let changed = false;
        if (tData.columns) {
          for (const colId of Object.keys(tData.columns)) {
            if (colId === "unassigned") continue;
            const col = tData.columns[colId];
            if (col && col.memberIds && Array.isArray(col.memberIds)) {
              for (let i = 0; i < col.memberIds.length; i++) {
                if (col.memberIds[i] === name) {
                  col.memberIds[i] = null;
                  changed = true;
                }
              }
            }
          }
        }
        if (changed) {
          await tRef.set(tData);
        }
      }
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


