export const dynamic = "force-dynamic";
import { teamsRef } from "@/lib/firebase-admin";
import { getCurrentUser } from "@/lib/auth";
import { ok, err, unauthorized } from "@/lib/server-utils";

export async function GET() {
  try {
    const doc = await teamsRef().get();
    if (!doc.exists) {
      return ok({});
    }
    return ok(doc.data());
  } catch (e: any) {
    return err(e.message, 500);
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    // อนุญาตเฉพาะ Admin/Owner หรือหัวหน้ากิลด์ในการจัดทีม War
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return unauthorized();
    }

    const body = await req.json();
    await teamsRef().set(body, { merge: true });
    
    return ok({ message: "War teams updated successfully" });
  } catch (e: any) {
    return err(e.message, 500);
  }
}


