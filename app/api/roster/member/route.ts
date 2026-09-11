export const dynamic = "force-dynamic";
import { getDb, COLL_USER, rosterRef } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth";
import { ok, err, forbidden, handleServerError } from "@/lib/server-utils";
import { rosterMemberUpdateSchema, validateBody } from "@/lib/validations";

export async function PUT(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;
    const user = auth.user;

    const body = await req.json();
    const validation = validateBody(rosterMemberUpdateSchema, body);
    if (!validation.success) {
      return err(validation.error, 400);
    }

    const { targetDiscordId, originalName, originalJob, name, job, power, warRole } = validation.data;

    // Check permission: Admin or Self
    if (user.role !== "admin" && user.role !== "owner" && user.discordId !== targetDiscordId) {
      return forbidden();
    }

    const db = getDb();
    const userDocRef = db.collection(COLL_USER).doc(targetDiscordId);
    const rRef = rosterRef();

    // Update user document and roster in a single atomic transaction
    await db.runTransaction(async (t) => {
      const [userDoc, rDoc] = await Promise.all([
        t.get(userDocRef),
        t.get(rRef),
      ]);

      let rosterData = rDoc.exists ? rDoc.data() as any : {};
      if (rosterData.data) rosterData = rosterData.data; // Handle legacy wrapper

      // Find existing member by targetDiscordId or originalName/originalJob
      let memberObj: any = { discordId: targetDiscordId, name, power: Number(power) };
      
      // Retain existing role if not admin
      let existingWarRole = "อิสระ (ให้ระบบจัดให้)";

      for (const j of Object.keys(rosterData)) {
        if (Array.isArray(rosterData[j])) {
          const idx = rosterData[j].findIndex((m: any) => m.discordId === targetDiscordId || (originalName && m.name === originalName));
          if (idx !== -1) {
            existingWarRole = rosterData[j][idx].role || existingWarRole;
            rosterData[j].splice(idx, 1);
          }
        }
      }

      memberObj.role = (user.role === "admin" || user.role === "owner") && warRole ? warRole : existingWarRole;

      if (!rosterData[job]) rosterData[job] = [];
      rosterData[job].push(memberObj);

      if (userDoc.exists) {
        const updateData: any = { gameUsername: name, class: job, power: Number(power) };
        if ((user.role === "admin" || user.role === "owner") && warRole) {
          updateData.warRole = warRole;
        }
        t.update(userDocRef, updateData);
      }

      t.set(rRef, rosterData);
    });

    return ok({ success: true });
  } catch (err: unknown) {
    return handleServerError(err, "Failed to update member");
  }
}
