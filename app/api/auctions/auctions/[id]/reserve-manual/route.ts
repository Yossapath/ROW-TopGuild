import { requireAdmin } from "@/lib/auth";
import { ok, err, handleServerError, logAction } from "@/lib/server-utils";
import { getAuction } from "@/lib/auction/auctions";
import { addManualReservation } from "@/lib/auction/reservations";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await request.json();
    const { userId, characterName, job } = body;

    if (!userId || !characterName) {
      return err("Missing userId or characterName", 400);
    }

    const auction = await getAuction(params.id);
    if (!auction) return err("Auction not found", 404);

    const reservation = await addManualReservation(params.id, userId, characterName, job || "Novice");

    logAction({
      module: "SYSTEM",
      action: "MANUAL_RESERVE",
      actor: auth.user.gameUsername || "Admin",
      target: params.id,
      detail: `แอดมินเพิ่ม ${characterName} เข้าร่วมคิว ${auction.itemName}`,
    });

    return ok({ success: true, data: reservation });
  } catch (error: any) {
    if (error.message === "User already in queue") {
      return err("ผู้ใช้นี้อยู่ในคิวแล้ว", 400);
    }
    return handleServerError(error, "Failed to manually reserve");
  }
}
