export const dynamic = "force-dynamic";
import { dungeonsRef, scheduleRef } from "@/lib/firebase-admin";
import { ok, err, handleServerError, logAction } from "@/lib/server-utils";
import { isBookingOpen } from "@/lib/utils";
import { dungeonQueueBookingSchema, validateBody } from "@/lib/validations";
import { requireAuth } from "@/lib/auth";

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
    // 0. ต้อง login ก่อนถึงจะจองคิวได้ (เดิม endpoint นี้ไม่เช็คเลย
    //    ทำให้ยิง POST ตรงๆ แบบไม่ login ก็จองได้ ทั้งที่หน้าเว็บบังคับ login)
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const validation = validateBody(dungeonQueueBookingSchema, body);
    if (!validation.success) {
      return err(validation.error, 400);
    }
    const validData = validation.data;

    // 0.5 จองได้เฉพาะชื่อของตัวเอง (กันสวมชื่อ/จองแทนคนอื่น)
    if (!auth.user.gameUsername || auth.user.gameUsername.trim() !== validData.name.trim()) {
      return err("คุณสามารถจองคิวในชื่อของตัวเองเท่านั้น", 403);
    }

    // 1. ตรวจสอบเวลาเปิดจอง (Validation on Backend - ป้องกันการโกง 100%)
    const schedSnap = await scheduleRef().get();
    if (schedSnap.exists) {
      const sched = schedSnap.data() as any;
      const check = isBookingOpen(sched);
      if (!check.open) {
        return err(check.reason || "ระบบจองปิดอยู่");
      }
    }

    // 2. + 3. เช็คชื่อซ้ำ + บันทึกข้อมูลคิว ทำในทรานแซกชันเดียวกัน
    //    (เดิมเช็คซ้ำด้วย .get() ก่อนแล้วค่อย .commit() แยกกัน ทำให้เกิด race
    //     condition ได้ถ้ามี 2 request มาพร้อมกัน — คนเดียวจองซ้อนได้)
    const db = dungeonsRef().firestore;
    const timestamp = Date.now();
    const newQueue = {
      name: validData.name,
      job: validData.job,
      dungeon: validData.dungeon,
      power: Number(validData.power) || 0,
      status: "waiting", // สถานะเริ่มต้น
      rounds: validData.rounds,
      round1: false,
      round2: false,
      timestamp,
    };

    const bookingRef = dungeonsRef().collection("queues").doc();
    const queueItemsRef = dungeonsRef().collection("dungeon_queue_items");

    try {
      await db.runTransaction(async (t) => {
        const activeQueues = await t.get(
          dungeonsRef().collection("queues").where("name", "==", validData.name)
        );

        const isDuplicate = activeQueues.docs.some((d) => {
          const status = d.data().status;
          return status === "waiting" || status === "active";
        });
        if (isDuplicate) {
          throw new Error("DUPLICATE_QUEUE_NAME");
        }

        // Create Main Booking Doc
        t.set(bookingRef, newQueue);

        // Create Queue Item Docs (1 per round)
        for (let i = 1; i <= validData.rounds; i++) {
          const itemRef = queueItemsRef.doc();
          t.set(itemRef, {
            bookingId: bookingRef.id,
            name: validData.name,
            job: validData.job,
            power: Number(validData.power) || 0,
            dungeon: validData.dungeon,
            roundNumber: i,
            status: "WAITING",
            queuedAt: timestamp + (i - 1), // R2 is technically queued right after R1
            assignedTeamId: null,
            completedAt: null,
          });
        }
      });
    } catch (txErr: unknown) {
      if (txErr instanceof Error && txErr.message === "DUPLICATE_QUEUE_NAME") {
        return err("ชื่อนี้อยู่ในคิวแล้ว (สถานะรอ หรือ กำลังลง)");
      }
      throw txErr;
    }

    // Save audit log to database
    logAction({
      module: "DUNGEON",
      action: "BOOK_QUEUE",
      actor: validData.name || "Member",
      target: validData.name,
      detail: `จองคิวดันเจี้ยน ${validData.dungeon} (${validData.job}) จำนวน ${validData.rounds} รอบ`,
      extra: { name: validData.name, job: validData.job, dungeon: validData.dungeon, rounds: validData.rounds },
    });

    return ok({ id: bookingRef.id, ...newQueue });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to book dungeon queue");
  }
}
