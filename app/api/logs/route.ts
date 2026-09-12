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

import { systemLogPostSchema, validateBody } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const validation = validateBody(systemLogPostSchema, body);
    if (!validation.success) {
      return err(validation.error, 400);
    }

    const { module, action, target, detail, extra } = validation.data;

    // Never trust client-supplied actor, role, or timestamp.
    // Always strictly derive from authenticated server session to prevent forging logs.
    const newLog = {
      module,
      action,
      actor: auth.user.gameUsername || auth.user.discordUsername || "Admin",
      role: auth.user.role,
      target: target || "",
      detail,
      extra: extra || {},
      timestamp: Date.now(),
    };

    await logsRef().collection("entries").add(newLog);

    return ok({ message: "Log saved" });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to save log");
  }
}


