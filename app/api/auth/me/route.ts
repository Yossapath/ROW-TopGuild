export const dynamic = "force-dynamic";
import { getCurrentUser } from "@/lib/auth";
import { ok, unauthorized, handleServerError } from "@/lib/server-utils";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }
    return ok(user);
  } catch (err: unknown) {
    return handleServerError(err, "Failed to get current user");
  }
}
