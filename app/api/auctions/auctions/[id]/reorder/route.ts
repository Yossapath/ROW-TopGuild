import { requireAdmin } from "@/lib/auth";
import { ok, err, handleServerError } from "@/lib/server-utils";
import { auctionReservationsRef, getDb } from "@/lib/firebase-admin";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const { orderedIds } = await request.json();
    if (!Array.isArray(orderedIds)) {
      return err("Invalid payload", 400);
    }

    const batch = getDb().batch();
    const baseTime = Date.now();

    orderedIds.forEach((id: string, index: number) => {
      // Each gets a progressively larger joinedAt so they stay in this order
      batch.update(auctionReservationsRef().doc(id), {
        joinedAt: baseTime + index * 1000,
        updatedAt: baseTime
      });
    });

    await batch.commit();

    return ok({ success: true });
  } catch (error) {
    return handleServerError(error, "Failed to reorder queue");
  }
}
