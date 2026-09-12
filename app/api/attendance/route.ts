export const dynamic = "force-dynamic";
import { attendanceRef } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { ok, err, handleServerError } from "@/lib/server-utils";
import { attendancePostSchema, validateBody } from "@/lib/validations";
import { trackFirestoreRead } from "@/lib/firestore-logger";
import { getOrSetAttendanceCache, invalidateAttendanceCache } from "@/lib/attendance-cache";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limitParam = Math.min(Math.max(Number(searchParams.get("limit")) || 300, 1), 500);

    if (startDate && endDate) {
      if (startDate > endDate) {
        return err("startDate must be before or equal to endDate", 400);
      }
      const startMs = new Date(`${startDate}T00:00:00Z`).getTime();
      const endMs = new Date(`${endDate}T00:00:00Z`).getTime();
      const diffDays = (endMs - startMs) / (24 * 60 * 60 * 1000);
      if (diffDays > 62) {
        return err("ช่วงวันที่ค้นหาต้องไม่เกิน 62 วันเพื่อป้องกันการดึงข้อมูลขนาดใหญ่เกินจำเป็น", 400);
      }
    }

    let cacheKey = "default";
    if (date) {
      cacheKey = `date:${date}`;
    } else if (startDate || endDate) {
      cacheKey = `range:${startDate || ""}_${endDate || ""}`;
    } else {
      cacheKey = `limit:${limitParam}`;
    }

    const records = await getOrSetAttendanceCache(cacheKey, async () => {
      let query: any = attendanceRef().collection("records");

      if (date) {
        query = query.where("date", "==", date);
      } else if (startDate && endDate) {
        query = query.where("date", ">=", startDate).where("date", "<=", endDate);
      } else if (startDate) {
        query = query.where("date", ">=", startDate);
      } else if (endDate) {
        query = query.where("date", "<=", endDate);
      } else {
        query = query.orderBy("timestamp", "desc").limit(limitParam);
      }

      const snap = await trackFirestoreRead(
        "GET /api/attendance",
        date
          ? `attendance records date=${date}`
          : startDate || endDate
          ? `attendance records range=${startDate || ""}..${endDate || ""}`
          : "attendance records query",
        () => query.get()
      );

      return (snap as any).docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    });

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

    const { date, records, action } = validation.data;
    const isReset = action === "reset";

    // Fetch existing records for this date to only write genuine changes and avoid ghost deletes
    const existingSnap = await trackFirestoreRead(
      "POST /api/attendance",
      `attendance existing records date=${date}`,
      () => attendanceRef().collection("records").where("date", "==", date).get()
    );
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

      // Silent deletion protection:
      // status === null is a no-op ("unedited") unless explicitly flagged with clear: true or action === "reset".
      // This guarantees that an admin editing Player B with a stale page will NEVER silently wipe Player A's status.
      if (rec.status === null) {
        const isExplicitDelete = rec.clear === true || isReset;
        if (isExplicitDelete && existing) {
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
      invalidateAttendanceCache();
    }

    return ok({ message: `บันทึกเช็คชื่อวันที่ ${date} สำเร็จ` });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to save attendance");
  }
}


