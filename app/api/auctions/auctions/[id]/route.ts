import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { err, ok, handleServerError, logAction } from "@/lib/server-utils";
import { auctionItemUpdateSchema, validateBody } from "@/lib/validations";
import { updateAuction, deleteAuction, getAuction } from "@/lib/auction/auctions";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await request.json();
    const validation = validateBody(auctionItemUpdateSchema, body);
    if (!validation.success) {
      return err(validation.error, 400);
    }

    const auction = await getAuction(params.id);
    if (!auction) return err("Auction not found", 404);

    const updatedBy = auth.user.gameUsername || auth.user.discordUsername || "Admin";
    await updateAuction(params.id, validation.data, updatedBy);

    logAction({
      module: "SYSTEM",
      action: "UPDATE_AUCTION",
      actor: updatedBy,
      target: params.id,
      detail: `อัปเดตประมูล: ${auction.itemName}`,
    });

    return ok({ success: true });
  } catch (error) {
    return handleServerError(error, "Failed to update auction");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const auction = await getAuction(params.id);
    if (!auction) return err("Auction not found", 404);

    const updatedBy = auth.user.gameUsername || auth.user.discordUsername || "Admin";
    await deleteAuction(params.id);

    logAction({
      module: "SYSTEM",
      action: "DELETE_AUCTION",
      actor: updatedBy,
      target: params.id,
      detail: `ลบประมูล: ${auction.itemName}`,
    });

    return ok({ success: true });
  } catch (error) {
    return handleServerError(error, "Failed to delete auction");
  }
}
