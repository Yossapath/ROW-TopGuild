export const dynamic = "force-dynamic";
import { scheduleRef } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth";
import { ok, err, handleServerError } from "@/lib/server-utils";
import { trackFirestoreRead } from "@/lib/firestore-logger";

export async function GET() {
  try {
    const doc = await trackFirestoreRead(
      "GET /api/dungeon/schedule",
      "dungeon_schedule doc get",
      () => scheduleRef().get()
    );
    const now = Date.now();
    if (!doc.exists) {
      const defaultSchedule = {
        openDate: "",
        openTime: "",
        closeTime: "",
        carryTeamsCount: 1,
        isClosed: false,
        serverTime: now,
      };
      const res = ok(defaultSchedule);
      res.headers.set("Cache-Control", "no-store, max-age=0");
      return res;
    }
    const data = doc.data() || {};
    const payload = {
      openDate: data.openDate ?? "",
      openTime: data.openTime ?? "",
      closeTime: data.closeTime ?? "",
      carryTeamsCount: typeof data.carryTeamsCount === "number" && data.carryTeamsCount > 0 ? data.carryTeamsCount : 1,
      isClosed: data.isClosed === true,
      serverTime: now,
    };
    const res = ok(payload);
    res.headers.set("Cache-Control", "no-store, max-age=0");
    return res;
  } catch (e: unknown) {
    return handleServerError(e, "Failed to load schedule");
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const updateData: Record<string, any> = {};

    if (body.openDate !== undefined) updateData.openDate = body.openDate;
    if (body.openTime !== undefined) updateData.openTime = body.openTime;
    if (body.closeTime !== undefined) updateData.closeTime = body.closeTime;
    if (body.carryTeamsCount !== undefined) {
      const count = Number(body.carryTeamsCount);
      updateData.carryTeamsCount = !isNaN(count) && count > 0 ? Math.floor(count) : 1;
    }
    // isClosed: admin manual override — saved explicitly
    if (body.isClosed !== undefined) {
      updateData.isClosed = Boolean(body.isClosed);
    }

    await scheduleRef().set(updateData, { merge: true });

    const { invalidateCurrentQueuesCache } = await import("@/lib/dungeon/queue-cache");
    invalidateCurrentQueuesCache();

    return ok({ message: "อัปเดตการตั้งค่าสำเร็จ", data: updateData });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to update schedule");
  }
}
