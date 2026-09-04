import { scheduleRef } from "@/lib/firebase-admin";
import { getCurrentUser } from "@/lib/auth";
import { ok, err, unauthorized } from "@/lib/utils";

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
  } catch (e: any) {
    return err(e.message, 500);
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return unauthorized();
    }

    const body = await req.json();
    const { openDate, openTime, closeTime } = body;

    if (!openDate || !openTime || !closeTime) {
      return err("ข้อมูลเวลาไม่ครบถ้วน");
    }

    await scheduleRef().set({ openDate, openTime, closeTime }, { merge: true });
    
    return ok({ message: "อัปเดตเวลาเปิดจองสำเร็จ" });
  } catch (e: any) {
    return err(e.message, 500);
  }
}
