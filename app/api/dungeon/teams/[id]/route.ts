export const dynamic = "force-dynamic";
import { dungeonsRef } from "@/lib/firebase-admin";
import { getCurrentUser } from "@/lib/auth";
import { ok, err, unauthorized } from "@/lib/server-utils";

// สร้างทีมจัดดันเจี้ยน
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    // ปกติแอดมินหรือคนมีสิทธิ์จัดทีม
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return unauthorized();
    }

    const body = await req.json();
    const newTeam = {
      type: body.type,               // e.g. "ดันมายา (Maya)"
      dungeonName: body.dungeonName, // e.g. "ทีม 1"
      capacity: body.capacity || 5,
      members: body.members || [],
      timestamp: Date.now()
    };

    const docRef = await dungeonsRef().collection("teams").add(newTeam);
    return ok({ id: docRef.id, ...newTeam });
  } catch (e: any) {
    return err(e.message, 500);
  }
}

// อัปเดตข้อมูลทีมดันเจี้ยน (การจัดคนลงตี้)
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return unauthorized();
    }

    const body = await req.json();
    const { id } = params;

    await dungeonsRef().collection("teams").doc(id).set(body, { merge: true });
    
    return ok({ message: "อัปเดตทีมสำเร็จ" });
  } catch (e: any) {
    return err(e.message, 500);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return unauthorized();
    }

    const { id } = params;
    await dungeonsRef().collection("teams").doc(id).delete();
    
    return ok({ message: "ลบทีมสำเร็จ" });
  } catch (e: any) {
    return err(e.message, 500);
  }
}

