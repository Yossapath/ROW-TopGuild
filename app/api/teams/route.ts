export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { teamsRef, getDb } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { err, ok, handleServerError, logAction } from "@/lib/server-utils";
import { teamDataSchema, validateBody } from "@/lib/validations";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const snapshot = await teamsRef().get();
    if (!snapshot.exists) {
      return NextResponse.json({ main: [], sub: [], unassigned: [], version: 0 });
    }
    const docData = snapshot.data();
    return NextResponse.json({
      ...docData,
      version: typeof docData?.version === "number" ? docData.version : 0,
    });
  } catch (error) {
    return handleServerError(error, "Failed to load teams");
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const data = await request.json();
    const validation = validateBody(teamDataSchema, data);
    if (!validation.success) {
      return err(validation.error, 400);
    }

    // Strip undefined values before saving to Firestore
    const cleanData = JSON.parse(JSON.stringify(validation.data));
    const db = getDb();
    const tRef = teamsRef();

    const result = await db.runTransaction(async (t) => {
      const docSnap = await t.get(tRef);
      const currentDoc = docSnap.exists ? (docSnap.data() || {}) : {};
      const currentVersion = typeof currentDoc.version === "number" ? currentDoc.version : 0;
      const expectedVersion = typeof cleanData.version === "number" ? cleanData.version : null;

      // Optimistic concurrency control: if client passed expected version and it doesn't match, reject
      if (expectedVersion !== null && expectedVersion !== currentVersion) {
        return {
          conflict: true,
          currentVersion,
        };
      }

      const nextVersion = currentVersion + 1;
      const finalData = {
        ...cleanData,
        version: nextVersion,
        updatedAt: Date.now(),
        updatedBy: auth.user.gameUsername || auth.user.discordUsername || "Admin",
      };

      t.set(tRef, finalData);
      return { conflict: false, version: nextVersion };
    });

    if (result.conflict) {
      return NextResponse.json(
        {
          ok: false,
          conflict: true,
          error: "ข้อมูลทีมในระบบมีการเปลี่ยนแปลงจาก Admin ท่านอื่น หรือมีสมาชิกแจ้งลา กรุณารีเฟรชข้อมูลล่าสุดก่อนทำการแก้ไข",
          currentVersion: result.currentVersion,
        },
        { status: 409 }
      );
    }

    // Audit log
    logAction({
      module: "TEAMS",
      action: "SAVE_TEAMS",
      actor: auth.user.gameUsername || auth.user.discordUsername || "Admin",
      target: "GVG Teams",
      detail: `บันทึกและอัปเดตการจัดทีม GVG ทั้งหมด (v${result.version})`,
    });

    return ok({ success: true, version: result.version });
  } catch (error: unknown) {
    return handleServerError(error, "Failed to save teams");
  }
}

