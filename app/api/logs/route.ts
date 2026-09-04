import { logsRef } from "@/lib/firebase-admin";
import { getCurrentUser } from "@/lib/auth";
import { ok, err, unauthorized } from "@/lib/utils";

export async function GET() {
  try {
    const user = await getCurrentUser();
    // Admin only can see logs
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return unauthorized();
    }

    const snap = await logsRef().collection("entries").orderBy("timestamp", "desc").limit(300).get();
    const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return ok(logs);
  } catch (e: any) {
    return err(e.message, 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    // Usually frontend triggers a log, but we can also log automatically in other backend APIs
    const body = await req.json();
    const { module, action, actor, target, detail, extra } = body;

    const newLog = {
      module,
      action,
      actor: actor || (user ? user.username : "System"),
      target,
      detail,
      extra: extra || {},
      timestamp: Date.now()
    };

    await logsRef().collection("entries").add(newLog);

    return ok({ message: "Log saved" });
  } catch (e: any) {
    return err(e.message, 500);
  }
}
