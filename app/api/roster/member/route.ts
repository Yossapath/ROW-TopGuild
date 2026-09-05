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
    
    // 1. Update the user document in COLL_USER
    const userDocRef = db.collection(COLL_USER).doc(targetDiscordId);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
      const updateData: any = { gameUsername: name, class: job, power: Number(power) };
      if ((user.role === "admin" || user.role === "owner") && warRole) {
        updateData.warRole = warRole;
      }
      await userDocRef.update(updateData);
    }

    // 2. Update roster in a transaction to prevent race conditions
    await db.runTransaction(async (t) => {
      const rRef = rosterRef();
      const rDoc = await t.get(rRef);
      let rosterData = rDoc.exists ? rDoc.data() as any : {};
      if (rosterData.data) rosterData = rosterData.data; // Handle legacy wrapper

      // Find existing member by targetDiscordId or originalName/originalJob
      let memberObj: any = { discordId: targetDiscordId, name, power: Number(power) };
      
      // Retain existing role if not admin
      let existingWarRole = "อิสระ (ให้ระบบจัดให้)";

      if (originalJob && rosterData[originalJob]) {
        const idx = rosterData[originalJob].findIndex((m: any) => m.discordId === targetDiscordId || m.name === originalName);
        if (idx !== -1) {
          existingWarRole = rosterData[originalJob][idx].role || existingWarRole;
          rosterData[originalJob].splice(idx, 1);
        }
      }

      memberObj.role = (user.role === "admin" || user.role === "owner") && warRole ? warRole : existingWarRole;

      if (!rosterData[job]) rosterData[job] = [];
      rosterData[job].push(memberObj);

      t.set(rRef, rosterData);
    });

    return ok({ success: true });
  } catch (err: unknown) {
    return handleServerError(err, "Failed to update member");
  }
}
