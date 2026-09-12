export const dynamic = "force-dynamic";
import { getDb, COLL_USER } from "@/lib/firebase-admin";
import { requireAdmin, invalidateUserRoleCache } from "@/lib/auth";
import { ok, err, handleServerError, logAction } from "@/lib/server-utils";
import { userRoleUpdateSchema, userDeleteSchema, validateBody } from "@/lib/validations";

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const limitParam = Math.min(Math.max(Number(searchParams.get("limit")) || 150, 1), 300);

    const db = getDb();
    const snapshot = await db.collection(COLL_USER).limit(limitParam).get();
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

    // 1. Prevent self-role mutation (prevents accidental self-lockout and self-privilege escalation)
    if (auth.user.discordId === discordId) {
      return err("ไม่สามารถเปลี่ยนบทบาทของตนเองได้", 400);
    }

    const db = getDb();
    const userRef = db.collection(COLL_USER).doc(discordId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return err("ไม่พบผู้ใช้งานนี้ในระบบ", 404);
    }

    const targetUser = userDoc.data() || {};
    const currentTargetRole = targetUser.role || "member";
    const isCallerOwner = auth.user.role === "owner";

    // 2. Admin cannot manage Owner or peer Admin:
    if (!isCallerOwner) {
      if (role === "owner") {
        return err("แอดมินไม่สามารถแต่งตั้งบทบาท Owner ได้ (เฉพาะ Owner เท่านั้น)", 403);
      }
      if (currentTargetRole === "owner") {
        return err("แอดมินไม่สามารถแก้ไขบทบาทของผู้ใช้งานระดับ Owner ได้", 403);
      }
      if (currentTargetRole === "admin") {
        return err("แอดมินไม่สามารถแก้ไขบทบาทของ Admin คนอื่นได้ (เฉพาะ Owner เท่านั้น)", 403);
      }
    }

    // 3. If caller is Owner and is demoting an Owner, ensure guild has at least 1 remaining Owner
    if (isCallerOwner && currentTargetRole === "owner" && role !== "owner") {
      const ownersSnap = await db.collection(COLL_USER).where("role", "==", "owner").get();
      if (ownersSnap.size <= 1) {
        return err("ไม่สามารถลดบทบาท Owner คนสุดท้ายของระบบได้", 400);
      }
    }

    await userRef.update({ role });
    invalidateUserRoleCache(discordId);

    logAction({
      module: "AUTH",
      action: "UPDATE_ROLE",
      actor: auth.user.gameUsername || auth.user.discordUsername || "Admin",
      target: discordId,
      detail: `เปลี่ยนบทบาทของ ${targetUser.gameUsername || targetUser.discordUsername || discordId} (${discordId}) จาก ${currentTargetRole} เป็น ${role}`,
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

    // 1. Prevent deleting self (prevents locking own account)
    if (auth.user.discordId === discordId) {
      return err("ไม่สามารถลบบัญชีของตนเองได้", 400);
    }

    const db = getDb();
    const userRef = db.collection(COLL_USER).doc(discordId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return err("ไม่พบผู้ใช้งานนี้ในระบบ", 404);
    }

    const targetUser = userDoc.data() || {};
    const targetRole = targetUser.role || "member";
    const isCallerOwner = auth.user.role === "owner";

    // 2. Admin cannot delete Owner or peer Admin:
    if (!isCallerOwner) {
      if (targetRole === "owner") {
        return err("แอดมินไม่สามารถลบผู้ใช้งานระดับ Owner ได้", 403);
      }
      if (targetRole === "admin") {
        return err("แอดมินไม่สามารถลบผู้ใช้งานระดับ Admin ได้ (เฉพาะ Owner เท่านั้น)", 403);
      }
    }

    // 3. If target is an Owner, ensure not the last Owner
    if (targetRole === "owner") {
      const ownersSnap = await db.collection(COLL_USER).where("role", "==", "owner").get();
      if (ownersSnap.size <= 1) {
        return err("ไม่สามารถลบ Owner คนสุดท้ายของระบบได้", 400);
      }
    }

    await userRef.delete();
    invalidateUserRoleCache(discordId);

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
