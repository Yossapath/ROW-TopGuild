export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/auth";
import { dungeonsRef } from "@/lib/firebase-admin";
import { ok, err, handleServerError } from "@/lib/server-utils";
import { getUserBookingQuota } from "@/lib/dungeon/booking-rules";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const requestedName = searchParams.get("name")?.trim();

    const isAdminOrOwner = auth.user.role === "admin" || auth.user.role === "owner";

    // 1. Regular members MUST have a registered gameUsername:
    // Unregistered members cannot query any player quota
    if (!isAdminOrOwner) {
      if (!auth.user.gameUsername || auth.user.gameUsername.trim() === "") {
        return err("กรุณาตั้งชื่อตัวละครในเกมก่อนตรวจสอบสิทธิ์การจอง", 403);
      }

      const ownName = auth.user.gameUsername.trim().toLowerCase();

      // If member supplied a name parameter, it MUST match their own character name (case-insensitive)
      if (requestedName && requestedName.toLowerCase() !== ownName) {
        return err("คุณสามารถดูสิทธิ์การจองของตัวเองเท่านั้น", 403);
      }
    }

    // 2. Resolve target name:
    // For non-admin members, always enforce own gameUsername regardless of query param
    const targetName = isAdminOrOwner
      ? (requestedName || auth.user.gameUsername?.trim() || "")
      : auth.user.gameUsername!.trim();

    if (!targetName) {
      return err("ไม่พบชื่อตัวละครที่ต้องการตรวจสอบ", 400);
    }

    const queuesRef = dungeonsRef().collection("queues");
    const quota = await getUserBookingQuota(targetName, queuesRef, isAdminOrOwner);

    return ok(quota);
  } catch (e: unknown) {
    return handleServerError(e, "Failed to fetch user quota");
  }
}
