export const dynamic = "force-dynamic";
import { dungeonsRef, scheduleRef } from "@/lib/firebase-admin";
import { getCurrentUser } from "@/lib/auth";
import { ok, err, logAction } from "@/lib/server-utils";
import { isBookingOpen } from "@/lib/utils";

export async function GET() {
  try {
    // ดึงคิวทั้งหมด เรียงตามเวลา
    const snap = await dungeonsRef().collection("queues").orderBy("timestamp", "asc").get();
    const queues = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return ok(queues);
  } catch (e: any) {
    return err(e.message, 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 1. ตรวจสอบเวลาเปิดจอง (Validation on Backend ✅ ป้องกันการโกง 100%)
    const schedSnap = await scheduleRef().get();
    if (schedSnap.exists) {
      const sched = schedSnap.data() as any;
      const check = isBookingOpen(sched);
      if (!check.open) {
        return err(check.reason || "ระบบจองปิดอยู่");
      }
    }

    // 2. ป้องกันการลงชื่อซ้ำในคิว
    const activeQueues = await dungeonsRef()
      .collection("queues")
      .where("name", "==", body.name)
      .get();
      
    if (!activeQueues.empty) {
       const isDuplicate = activeQueues.docs.some(d => {
         const status = d.data().status;
         return status === "waiting" || status === "active";
       });
       if (isDuplicate) {
         return err("ชื่อนี้อยู่ในคิวแล้ว (สถานะรอ หรือ กำลังลง)");
       }
    }

    // 3. บันทึกข้อมูลคิว
    const newQueue = {
      name: body.name,
      job: body.job,
      dungeon: body.dungeon,
      power: Number(body.power) || 0,
      status: "waiting", // สถานะเริ่มต้น
      rounds: body.rounds || 1,
      round1: false,
      round2: false,
      timestamp: Date.now(),
    };

    const docRef = await dungeonsRef().collection("queues").add(newQueue);

    // Save audit log to database
    logAction({
      module: "DUNGEON",
      action: "BOOK_QUEUE",
      actor: body.name || "Member",
      target: body.name,
      detail: `จองคิวดันเจี้ยน ${body.dungeon || "ดันมายา"} (${body.job}) จำนวน ${body.rounds || 1} รอบ`,
      extra: { name: body.name, job: body.job, dungeon: body.dungeon, rounds: body.rounds || 1 },
    });

    return ok({ id: docRef.id, ...newQueue });
  } catch (e: any) {
    return err(e.message, 500);
  }
}


