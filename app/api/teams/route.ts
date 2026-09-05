export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { teamsRef } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth";
import { err, ok, handleServerError, logAction } from "@/lib/server-utils";
import { teamDataSchema, validateBody } from "@/lib/validations";

export async function GET() {
  try {
    const snapshot = await teamsRef().get();
    if (!snapshot.exists) {
      return NextResponse.json({ main: [], sub: [], unassigned: [] });
    }
    return NextResponse.json(snapshot.data());
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

    await teamsRef().set(validation.data);

    // Audit log
    logAction({
      module: "TEAMS",
      action: "SAVE_TEAMS",
      actor: auth.user.gameUsername || auth.user.discordUsername || "Admin",
      target: "GVG Teams",
      detail: "บันทึกและอัปเดตการจัดทีม GVG ทั้งหมด",
    });

    return ok({ success: true });
  } catch (error) {
    return handleServerError(error, "Failed to save teams");
  }
}
