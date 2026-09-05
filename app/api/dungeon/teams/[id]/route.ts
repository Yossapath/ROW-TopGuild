export const dynamic = "force-dynamic";
import { dungeonsRef } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth";
import { ok, err, handleServerError } from "@/lib/server-utils";

// สร้างทีมจัดดันเจี้ยน
export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

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
  } catch (e: unknown) {
    return handleServerError(e, "Failed to create dungeon team");
  }
}

// อัปเดตข้อมูลทีมดันเจี้ยน (การจัดคนลงตี้)
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const { id } = params;

    await dungeonsRef().collection("teams").doc(id).set(body, { merge: true });
    
    return ok({ message: "อัปเดตทีมสำเร็จ" });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to update dungeon team");
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const { id } = params;
    await dungeonsRef().collection("teams").doc(id).delete();
    
    return ok({ message: "ลบทีมสำเร็จ" });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to delete dungeon team");
  }
}

