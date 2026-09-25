import { requireAuth } from "@/lib/auth";
import { err, ok, handleServerError, logAction } from "@/lib/server-utils";
import { auctionReserveSchema, validateBody } from "@/lib/validations";
import { getAuctionQueue, reserveAuction, cancelReservation } from "@/lib/auction/reservations";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const queue = await getAuctionQueue(params.id);
    return ok({ data: queue });
  } catch (error) {
    return handleServerError(error, "Failed to load queue");
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await request.json();
    const validation = validateBody(auctionReserveSchema, body);
    if (!validation.success) {
      return err(validation.error, 400);
    }

    const { characterName, job } = validation.data;
    const userId = auth.user.discordId;

    const result = await reserveAuction(params.id, userId, characterName, job);
    if (!result.success) {
      return err(result.error || "Failed to reserve", 400);
    }

    logAction({
      module: "SYSTEM",
      action: "JOIN_AUCTION_QUEUE",
      actor: characterName,
      target: params.id,
      detail: `ลงชื่อจองไอเทมประมูล`,
    });

    return ok({ success: true, data: result.reservation });
  } catch (error) {
    return handleServerError(error, "Failed to reserve auction");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    // Need to parse search params for reservationId
    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get("reservationId");

    if (!reservationId) return err("Missing reservationId", 400);

    const isAdmin = auth.user.role === "admin" || auth.user.role === "owner";
    const result = await cancelReservation(reservationId, auth.user.discordId, isAdmin);

    if (!result.success) {
      return err(result.error || "Failed to cancel", 400);
    }

    const actor = auth.user.gameUsername || auth.user.discordUsername;
    logAction({
      module: "SYSTEM",
      action: isAdmin ? "REMOVE_AUCTION_QUEUE" : "CANCEL_AUCTION_QUEUE",
      actor: actor,
      target: reservationId,
      detail: isAdmin ? `แอดมินลบผู้ใช้ออกจากคิว` : `ยกเลิกการจองไอเทมด้วยตัวเอง`,
    });

    return ok({ success: true });
  } catch (error) {
    return handleServerError(error, "Failed to cancel reservation");
  }
}
