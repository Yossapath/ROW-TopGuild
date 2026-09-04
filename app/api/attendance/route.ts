export const dynamic = "force-dynamic";
import { attendanceRef } from "@/lib/firebase-admin";
import { getCurrentUser } from "@/lib/auth";
import { ok, err, unauthorized } from "@/lib/server-utils";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    // ดึงข้อมูลการเช็คชื่อทั้งหมด เรียงตามวันที่ล่าสุด
    const snap = await attendanceRef().collection("records").orderBy("timestamp", "desc").limit(500).get();
    const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return ok(records);
  } catch (e: any) {
    return err(e.message, 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    // อนุญาตเฉพาะ Admin เช็คชื่อ
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return unauthorized();
    }

    const body = await req.json();
    const { date, records } = body; 
    // records = array of { name: string, present: boolean, note?: string }

    if (!date || !Array.isArray(records)) {
      return err("ข้อมูลไม่ถูกต้อง");
    }

    const batch = attendanceRef().firestore.batch();

    records.forEach((rec) => {
      const docRef = attendanceRef().collection("records").doc();
      batch.set(docRef, {
        name: rec.name,
        date: date,
        present: rec.present,
        note: rec.note || "",
        timestamp: Date.now(),
        recordedBy: user.gameUsername
      });
    });

    await batch.commit();

    return ok({ message: `บันทึกเช็คชื่อวันที่ ${date} สำเร็จ` });
  } catch (e: any) {
    return err(e.message, 500);
  }
}


