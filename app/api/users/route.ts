export const dynamic = "force-dynamic";
import { getDb, COLL_USER } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth";
import { ok, err, handleServerError, logAction } from "@/lib/server-utils";
import { userRoleUpdateSchema, userDeleteSchema, validateBody } from "@/lib/validations";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const db = getDb();
    const snapshot = await db.collection(COLL_USER).get();
    const users: any[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      users.push({ discordId: doc.id, ...data });
    });
    return ok(users);
  } catch (err: unknown) {
    return handleServerError(err, "Failed to load users");
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const validation = validateBody(userRoleUpdateSchema, body);
    if (!validation.success) {
      return err(validation.error, 400);
    }

    const { discordId, role } = validation.data;
    const db = getDb();
    await db.collection(COLL_USER).doc(discordId).update({ role });

    logAction({
      module: "AUTH",
      action: "UPDATE_ROLE",
      actor: auth.user.gameUsername || auth.user.discordUsername || "Admin",
      target: discordId,
      detail: `เปลี่ยนบทบาทของ ${discordId} เป็น ${role}`,
    });

    return ok({ success: true });
  } catch (err: unknown) {
    return handleServerError(err, "Failed to update user role");
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const validation = validateBody(userDeleteSchema, body);
    if (!validation.success) {
      return err(validation.error, 400);
    }

    const { discordId } = validation.data;

    // Prevent admin from deleting themselves
    if (auth.user.discordId === discordId) {
      return err("ไม่สามารถลบบัญชีของตนเองได้", 400);
    }

    const db = getDb();
    const userDoc = await db.collection(COLL_USER).doc(discordId).get();
    if (!userDoc.exists) {
      return err("ไม่พบผู้ใช้งานนี้ในระบบ", 404);
    }

    const targetUser = userDoc.data();
    await db.collection(COLL_USER).doc(discordId).delete();

    logAction({
      module: "AUTH",
      action: "DELETE_USER",
      actor: auth.user.gameUsername || auth.user.discordUsername || "Admin",
      target: discordId,
      detail: `ลบผู้ใช้ ${targetUser?.gameUsername || targetUser?.discordUsername || discordId} (${discordId})`,
    });

    return ok({ success: true });
  } catch (err: unknown) {
    return handleServerError(err, "Failed to delete user");
  }
}
