export const dynamic = "force-dynamic";
import { clearAuthCookie } from "@/lib/auth";
import { ok, err, handleServerError } from "@/lib/server-utils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    // Logout
    if (action === "logout") {
      const res = ok({ message: "Logged out" });
      res.cookies.set(clearAuthCookie());
      return res;
    }

    return err("Invalid action", 400);
  } catch (e: unknown) {
    return handleServerError(e, "Internal server error");
  }
}

export async function GET() {
  return err("Method Not Allowed", 405);
}
