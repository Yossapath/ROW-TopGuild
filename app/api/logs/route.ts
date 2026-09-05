export const dynamic = "force-dynamic";
import { logsRef } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { ok, err, handleServerError } from "@/lib/server-utils";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const snap = await logsRef().collection("entries").orderBy("timestamp", "desc").limit(300).get();
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
    const { module, action, actor, target, detail, extra } = body;

    if (!module || !action || !detail) {
      return err("ข้อมูลไม่ครบถ้วน", 400);
    }

    const newLog = {
      module: String(module).slice(0, 50),
      action: String(action).slice(0, 50),
      actor: actor ? String(actor).slice(0, 100) : (auth.user.gameUsername || auth.user.discordUsername || "System"),
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


