export const dynamic = "force-dynamic";
import { leaveRef } from "@/lib/firebase-admin";
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
    const { name, date, day, reason } = body;

    if (!name || (!date && !day)) {
      return err("ข้อมูลไม่ครบถ้วน (ต้องมีชื่อ และ วันที่/วันในสัปดาห์)");
    }

    const newLeave = {
      name,
      date: date || "",
      day: day || "",
      reason: reason || "",
      submittedBy: user.gameUsername,
      timestamp: Date.now()
    };

    const docRef = await leaveRef().collection("records").add(newLeave);

    return ok({ id: docRef.id, ...newLeave });
  } catch (e: any) {
    return err(e.message, 500);
  }
}


