import { requireAdmin } from "@/lib/auth";
import { err, ok, handleServerError, logAction } from "@/lib/server-utils";
import { auctionAwardSchema, validateBody } from "@/lib/validations";
import { awardAuction } from "@/lib/auction/reservations";
import { getAuction } from "@/lib/auction/auctions";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await request.json();
    const validation = validateBody(auctionAwardSchema, body);
    if (!validation.success) {
      return err(validation.error, 400);
    }

    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get("reservationId");
    if (!reservationId) return err("Missing reservationId", 400);

    const adminName = auth.user.gameUsername || auth.user.discordUsername || "Admin";
    const result = await awardAuction(params.id, reservationId, auth.user.discordId, adminName);
    
    if (!result.success) {
      return err(result.error || "Failed to award", 400);
    }

    const auction = await getAuction(params.id);

    logAction({
      module: "SYSTEM",
      action: "AWARD_AUCTION",
      actor: adminName,
      target: params.id,
      detail: `มอบไอเทม ${auction?.itemName || params.id} ให้กับ ${validation.data.characterName}`,
    });

    return ok({ success: true });
  } catch (error) {
    return handleServerError(error, "Failed to award auction");
  }
}
