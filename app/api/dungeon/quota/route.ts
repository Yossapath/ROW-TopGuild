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
    const targetName = requestedName || auth.user.gameUsername;

    if (!targetName) {
      return err("ไม่พบชื่อตัวละคร", 400);
    }

    // Regular users can only inspect their own character quota
    if (!isAdminOrOwner && auth.user.gameUsername && targetName !== auth.user.gameUsername) {
      return err("คุณสามารถดูสิทธิ์การจองของตัวเองเท่านั้น", 403);
    }

    const queuesRef = dungeonsRef().collection("queues");
    const quota = await getUserBookingQuota(targetName, queuesRef, isAdminOrOwner);

    return ok(quota);
  } catch (e: unknown) {
    return handleServerError(e, "Failed to fetch user quota");
  }
}
