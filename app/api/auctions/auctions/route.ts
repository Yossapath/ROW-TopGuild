import { NextResponse } from "next/server";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { err, ok, handleServerError, logAction } from "@/lib/server-utils";
import { auctionItemCreateSchema, validateBody } from "@/lib/validations";
import { getAuctions, createAuction } from "@/lib/auction/auctions";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const auctions = await getAuctions();
    return ok(auctions);
  } catch (error) {
    return handleServerError(error, "Failed to load auctions");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await request.json();
    const validation = validateBody(auctionItemCreateSchema, body);
    if (!validation.success) {
      return err(validation.error, 400);
    }

    const createdBy = auth.user.gameUsername || auth.user.discordUsername || "Admin";
    const auction = await createAuction(validation.data, createdBy);

    logAction({
      module: "SYSTEM",
      action: "CREATE_AUCTION",
      actor: createdBy,
      target: auction.id,
      detail: `สร้างประมูลใหม่: ${auction.itemName}`,
    });

    return ok({ success: true, data: auction });
  } catch (error) {
    return handleServerError(error, "Failed to create auction");
  }
}
