export const dynamic = "force-dynamic";
import { leaveRef, teamsRef } from "@/lib/firebase-admin";
import { getCurrentUser } from "@/lib/auth";
import { ok, err, unauthorized } from "@/lib/server-utils";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const snap = await leaveRef().collection("records").orderBy("timestamp", "desc").limit(200).get();
    const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return ok(records);
  } catch (e: any) {
    return err(e.message, 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const body = await req.json();
    const { name, job, date, day, reason } = body;

    if (!name || (!date && !day)) {
      return err("ข้อมูลไม่ครบถ้วน (ต้องมีชื่อ และ วันที่/วันในสัปดาห์)");
    }

    const newLeave = {
      name,
      job: job || "",
      date: date || "",
      day: day || "",
      reason: reason || "",
      submittedBy: user.gameUsername,
      timestamp: Date.now()
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

    return ok({ id: docRef.id, ...newLeave });
  } catch (e: any) {
    return err(e.message, 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") return unauthorized();

    const { id } = await req.json();
    if (!id) return err("Missing id");

    await leaveRef().collection("records").doc(id).delete();
    return ok({ success: true });
  } catch (e: any) {
    return err(e.message, 500);
  }
}


