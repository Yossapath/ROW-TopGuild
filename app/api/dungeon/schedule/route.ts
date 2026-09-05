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
        closeTime: ""
      });
    }
    return ok(doc.data());
  } catch (e: unknown) {
    return handleServerError(e, "Failed to load schedule");
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const { openDate, openTime, closeTime } = body;

    if (!openDate || !openTime || !closeTime) {
      return err("ข้อมูลเวลาไม่ครบถ้วน", 400);
    }

    await scheduleRef().set({ openDate, openTime, closeTime }, { merge: true });
    
    return ok({ message: "อัปเดตเวลาเปิดจองสำเร็จ" });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to update schedule");
  }
}


