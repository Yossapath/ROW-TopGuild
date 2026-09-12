export const dynamic = "force-dynamic";
import { dungeonsRef, scheduleRef } from "@/lib/firebase-admin";
import { ok, err, handleServerError, logAction } from "@/lib/server-utils";
import { isBookingOpen } from "@/lib/utils";
import { dungeonQueueBookingSchema, validateBody } from "@/lib/validations";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { checkBookingEligibility, getTodayRange } from "@/lib/dungeon/booking-rules";
import { trackFirestoreRead } from "@/lib/firestore-logger";
import { getOrSetCurrentQueuesCache, invalidateCurrentQueuesCache } from "@/lib/dungeon/queue-cache";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "current";
    const limitParam = Math.min(Math.max(1, Number(searchParams.get("limit")) || 50), 100);

    // 1. All: สำหรับหน้า Audit Log ของแอดมิน (Admin/Owner เท่านั้น)
    if (type === "all") {
      const auth = await requireAdmin();
      if (auth.errorResponse) return auth.errorResponse;

      let query = dungeonsRef().collection("queues").orderBy("timestamp", "desc");
      const before = Number(searchParams.get("before"));
      if (!isNaN(before) && before > 0) {
        query = query.startAfter(before);
      }
      const snap = await trackFirestoreRead(
        "GET /api/dungeon/queues?type=all",
        "queues query (all)",
        () => query.limit(limitParam).get()
      );
      const queues = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return ok(queues);
    }

    // สำหรับบอร์ดสดและประวัติ (current, history) ต้องผ่านการยืนยันตัวตน (Member, Admin, Owner)
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    // 2. History: โหลดเฉพาะคิวที่เสร็จแล้ว (done) บน On-Demand / Pagination
    if (type === "history") {
      const snap = await trackFirestoreRead(
        "GET /api/dungeon/queues?type=history",
        "queues query (history)",
        () =>
          dungeonsRef()
            .collection("queues")
            .where("status", "==", "done")
            .limit(limitParam)
            .get()
      );
      const queues = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      return ok(queues);
    }

    // 3. Current (Default): ดึงเฉพาะคิวที่ยังต้องแสดงในบอร์ดสด (waiting, active, skipped)
    // มี In-Memory Server Cache (TTL ~7s) พร้อม Stampede & Race Condition Protection
    const queues = await getOrSetCurrentQueuesCache(async () => {
      const snap = await trackFirestoreRead(
        "GET /api/dungeon/queues",
        "queues query (current)",
        () =>
          dungeonsRef()
            .collection("queues")
            .where("status", "in", ["waiting", "active", "skipped"])
            .get()
      );

      return snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => ((a.queuedAt ?? a.timestamp) || 0) - ((b.queuedAt ?? b.timestamp) || 0));
    });

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

    // 0.5 สมาชิกทั่วไปจองได้เฉพาะชื่อของตัวเอง ส่วนแอดมิน/หัวกิลด์จองแทนใครก็ได้
    const isAdminOrOwner = auth.user.role === "admin" || auth.user.role === "owner";
    if (!isAdminOrOwner) {
      if (!auth.user.gameUsername || auth.user.gameUsername.trim() !== validData.name.trim()) {
        return err("คุณสามารถจองคิวในชื่อของตัวเองเท่านั้น", 403);
      }
    }

    // 1. ตรวจสอบเวลาเปิดจอง (Validation on Backend - ป้องกันการโกง 100%)
    //    ใช้เวลา Server เสมอ ไม่เชื่อ timestamp จาก client
    const schedSnap = await scheduleRef().get();
    if (schedSnap.exists) {
      const sched = schedSnap.data() as any;
      const check = isBookingOpen(sched);
      if (!check.open) {
        return err(check.reason || "ระบบจองปิดอยู่", 403);
      }
    }

    // 1.5 ตรวจกฎการจอง: วันละ 1 รอบ, อาทิตย์ละ 2 รอบ, รวม 30 คน/วัน
    const eligibility = await checkBookingEligibility(
      validData.name,
      validData.rounds,
      dungeonsRef().collection("queues"),
      isAdminOrOwner
    );
    if (!eligibility.allowed) {
      return err(eligibility.reason || "ไม่สามารถจองคิวได้", 403);
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
      bookedAt: timestamp,
      queuedAt: timestamp,
      timestamp,
    };

    const bookingRef = dungeonsRef().collection("queues").doc();
    const queueItemsRef = dungeonsRef().collection("dungeon_queue_items");

    const today = getTodayRange();

    try {
      await db.runTransaction(async (t) => {
        const queuesCollection = dungeonsRef().collection("queues");

        const [activeQueues, dailyQueues] = await Promise.all([
          t.get(queuesCollection.where("name", "==", validData.name)),
          !isAdminOrOwner
            ? t.get(
                queuesCollection
                  .where("timestamp", ">=", today.start)
                  .where("timestamp", "<=", today.end)
              )
            : Promise.resolve(null),
        ]);

        const isDuplicate = activeQueues.docs.some((d) => {
          const status = d.data().status;
          return status === "waiting" || status === "active";
        });
        if (isDuplicate) {
          throw new Error("DUPLICATE_QUEUE_NAME");
        }

        if (dailyQueues) {
          const uniquePlayersToday = new Set<string>();
          for (const d of dailyQueues.docs) {
            const data = d.data();
            if (data.name) uniquePlayersToday.add(data.name as string);
          }
          if (!uniquePlayersToday.has(validData.name) && uniquePlayersToday.size >= 30) {
            throw new Error("DAILY_LIMIT_EXCEEDED");
          }
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
      if (txErr instanceof Error) {
        if (txErr.message === "DUPLICATE_QUEUE_NAME") {
          return err("ชื่อนี้อยู่ในคิวแล้ว (สถานะรอ หรือ กำลังลง)");
        }
        if (txErr.message === "DAILY_LIMIT_EXCEEDED") {
          return err("วันนี้มีผู้เล่นจองครบ 30 คนแล้ว — ระบบปิดรับจองสำหรับวันนี้", 403);
        }
      }
      throw txErr;
    }

    // Invalidate in-memory cache so fresh queue is immediately visible to all callers
    invalidateCurrentQueuesCache();

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
