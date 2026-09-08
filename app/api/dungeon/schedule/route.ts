export const dynamic = "force-dynamic";
import { scheduleRef } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth";
import { ok, err, handleServerError } from "@/lib/server-utils";

export async function GET() {
  try {
    const doc = await scheduleRef().get();
    if (!doc.exists) {
      return ok({
        openDate: "",
        openTime: "",
        closeTime: "",
        carryTeamsCount: 1,
      });
    }
    const data = doc.data() || {};
    return ok({
      openDate: data.openDate ?? "",
      openTime: data.openTime ?? "",
      closeTime: data.closeTime ?? "",
      carryTeamsCount: typeof data.carryTeamsCount === "number" && data.carryTeamsCount > 0 ? data.carryTeamsCount : 1,
    });
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

    await scheduleRef().set(updateData, { merge: true });
    
    return ok({ message: "อัปเดตการตั้งค่าสำเร็จ", data: updateData });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to update schedule");
  }
}


