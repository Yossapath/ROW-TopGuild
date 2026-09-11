export const dynamic = "force-dynamic";
import { attendanceRef } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { ok, err, handleServerError } from "@/lib/server-utils";
import { attendancePostSchema, validateBody } from "@/lib/validations";
import { trackFirestoreRead } from "@/lib/firestore-logger";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const limitParam = Math.min(Math.max(Number(searchParams.get("limit")) || 300, 1), 500);

    // ดึงข้อมูลการเช็คชื่อทั้งหมด เรียงตามวันที่ล่าสุด
    const snap = await trackFirestoreRead(
      "GET /api/attendance",
      "attendance records query",
      () =>
        attendanceRef()
          .collection("records")
          .orderBy("timestamp", "desc")
          .limit(limitParam)
          .get()
    );
    const records = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return ok(records);
  } catch (e: unknown) {
    return handleServerError(e, "Failed to load attendance records");
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const validation = validateBody(attendancePostSchema, body);
    if (!validation.success) {
      return err(validation.error, 400);
    }

    const { date, records } = validation.data;

    // Fetch existing records for this date to only write genuine changes and avoid ghost deletes
    const existingSnap = await attendanceRef()
      .collection("records")
      .where("date", "==", date)
      .get();
    const existingMap = new Map<string, any>();
    existingSnap.docs.forEach((d) => existingMap.set(d.id, d.data()));

    const batch = attendanceRef().firestore.batch();
    let writeCount = 0;

    records.forEach((rec) => {
      // Use date_name as ID to prevent duplicates
      const safeName = rec.name.replace(/\//g, "-");
      const docId = `${date}_${safeName}`;
      const docRef = attendanceRef().collection("records").doc(docId);
      const existing = existingMap.get(docId);

      if (rec.status === null) {
        if (existing) {
          batch.delete(docRef);
          writeCount++;
        }
      } else {
        const note = rec.note || "";
        if (!existing || existing.status !== rec.status || (existing.note || "") !== note) {
          batch.set(docRef, {
            name: rec.name,
            date: date,
            status: rec.status,
            note,
            timestamp: Date.now(),
            recordedBy: auth.user.gameUsername || auth.user.discordUsername || "Admin",
          }, { merge: true });
          writeCount++;
        }
      }
    });

    if (writeCount > 0) {
      await batch.commit();
    }

    return ok({ message: `บันทึกเช็คชื่อวันที่ ${date} สำเร็จ` });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to save attendance");
  }
}


