export const dynamic = "force-dynamic";
import { logsRef } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { ok, err, handleServerError } from "@/lib/server-utils";
import { trackFirestoreRead } from "@/lib/firestore-logger";

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const limitParam = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 100);
    const before = Number(searchParams.get("before"));

    let query = logsRef().collection("entries").orderBy("timestamp", "desc");
    if (!isNaN(before) && before > 0) {
      query = query.startAfter(before);
    }

    const snap = await trackFirestoreRead(
      "GET /api/logs",
      "logs entries query",
      () => query.limit(limitParam).get()
    );
    const logs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return ok(logs);
  } catch (e: unknown) {
    return handleServerError(e, "Failed to load system logs");
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const { module, action, target, detail, extra } = body;

    if (!module || !action || !detail) {
      return err("ข้อมูลไม่ครบถ้วน", 400);
    }

    const newLog = {
      module: String(module).slice(0, 50),
      action: String(action).slice(0, 50),
      // Always derive actor from the authenticated session, never trust
      // the client-supplied value, or anyone can forge log entries as
      // "Admin" / another user.
      actor: auth.user.gameUsername || auth.user.discordUsername || "System",
      target: target ? String(target).slice(0, 100) : "",
      detail: String(detail).slice(0, 500),
      extra: extra || {},
      timestamp: Date.now()
    };

    await logsRef().collection("entries").add(newLog);

    return ok({ message: "Log saved" });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to save log");
  }
}


