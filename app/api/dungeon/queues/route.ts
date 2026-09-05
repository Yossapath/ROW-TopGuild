export const dynamic = "force-dynamic";
import { dungeonsRef, scheduleRef } from "@/lib/firebase-admin";
import { ok, err, handleServerError, logAction } from "@/lib/server-utils";
import { isBookingOpen } from "@/lib/utils";
import { dungeonQueueBookingSchema, validateBody } from "@/lib/validations";

export async function GET() {
  try {
    // ดึงคิวทั้งหมด เรียงตามเวลา
    const snap = await dungeonsRef().collection("queues").orderBy("timestamp", "asc").get();
    const queues = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return ok(queues);
  } catch (e: unknown) {
    return handleServerError(e, "Failed to load dungeon queues");
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validation = validateBody(dungeonQueueBookingSchema, body);
    if (!validation.success) {
      return err(validation.error, 400);
    }
    const validData = validation.data;
    
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
      .where("name", "==", validData.name)
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
      name: validData.name,
      job: validData.job,
      dungeon: validData.dungeon,
      power: Number(validData.power) || 0,
      status: "waiting", // สถานะเริ่มต้น
      rounds: validData.rounds,
      round1: false,
      round2: false,
      timestamp: Date.now(),
    };

    const docRef = await dungeonsRef().collection("queues").add(newQueue);

    // Save audit log to database
    logAction({
      module: "DUNGEON",
      action: "BOOK_QUEUE",
      actor: validData.name || "Member",
      target: validData.name,
      detail: `จองคิวดันเจี้ยน ${validData.dungeon} (${validData.job}) จำนวน ${validData.rounds} รอบ`,
      extra: { name: validData.name, job: validData.job, dungeon: validData.dungeon, rounds: validData.rounds },
    });

    return ok({ id: docRef.id, ...newQueue });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to book dungeon queue");
  }
}


