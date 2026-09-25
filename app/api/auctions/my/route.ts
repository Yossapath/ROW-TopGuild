import { requireAuth } from "@/lib/auth";
import { err, ok, handleServerError } from "@/lib/server-utils";
import { getMyReservations } from "@/lib/auction/reservations";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const myReservations = await getMyReservations(auth.user.discordId);
    return ok(myReservations);
  } catch (error) {
    return handleServerError(error, "Failed to load my reservations");
  }
}
