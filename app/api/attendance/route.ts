export const dynamic = "force-dynamic";
import { attendanceRef } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { ok, err, handleServerError } from "@/lib/server-utils";
import { attendancePostSchema, validateBody } from "@/lib/validations";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    // ดึงข้อมูลการเช็คชื่อทั้งหมด เรียงตามวันที่ล่าสุด
    const snap = await attendanceRef().collection("records").orderBy("timestamp", "desc").limit(500).get();
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

    const batch = attendanceRef().firestore.batch();

    records.forEach((rec) => {
      // Use date_name as ID to prevent duplicates
      const safeName = rec.name.replace(/\//g, "-");
      const docId = `${date}_${safeName}`;
      const docRef = attendanceRef().collection("records").doc(docId);
      
      if (rec.status === null) {
        batch.delete(docRef);
      } else {
        batch.set(docRef, {
          name: rec.name,
          date: date,
          status: rec.status,
          note: rec.note || "",
          timestamp: Date.now(),
          recordedBy: auth.user.gameUsername || auth.user.discordUsername || "Admin"
        }, { merge: true });
      }
    });

    await batch.commit();

    return ok({ message: `บันทึกเช็คชื่อวันที่ ${date} สำเร็จ` });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to save attendance");
  }
}


