export const dynamic = "force-dynamic";
import { getCurrentUser, getLiveUserRole, signToken, authCookie, clearAuthCookie } from "@/lib/auth";
import { ok, unauthorized, handleServerError } from "@/lib/server-utils";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const liveRole = await getLiveUserRole(user.discordId, user.role);
    if (!liveRole) {
      // User has been deleted from system -> invalidate session cookie
      const res = unauthorized();
      res.cookies.set(clearAuthCookie());
      return res;
    }

    // If role has changed (e.g. demoted from admin or promoted to owner), refresh token cookie
    if (liveRole !== user.role) {
      const updatedUser = { ...user, role: liveRole };
      const newToken = await signToken(updatedUser);
      const res = ok(updatedUser);
      res.cookies.set(authCookie(newToken));
      return res;
    }

    return ok(user);
  } catch (err: unknown) {
    return handleServerError(err, "Failed to get current user");
  }
}
