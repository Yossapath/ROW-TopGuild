export const dynamic = "force-dynamic";
import { getDb, COLL_USER, rosterRef } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { ok, err, forbidden, handleServerError } from "@/lib/server-utils";
import { rosterMemberUpdateSchema, rosterMemberAddSchema, validateBody } from "@/lib/validations";

// Admin only: Add single member atomically to roster
export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const validation = validateBody(rosterMemberAddSchema, body);
    if (!validation.success) {
      return err(validation.error, 400);
    }

    const { name, job, power, warRole, discordId } = validation.data;
    const finalDiscordId = discordId || `manual_${Date.now()}`;

    const db = getDb();
    const rRef = rosterRef();

    await db.runTransaction(async (t) => {
      const rDoc = await t.get(rRef);
      let rosterData = rDoc.exists ? (rDoc.data() as any) : {};
      if (rosterData.data) rosterData = rosterData.data;

      // Check if member already exists in any job
      for (const j of Object.keys(rosterData)) {
        if (Array.isArray(rosterData[j])) {
          const exists = rosterData[j].some((m: any) => m.name?.toLowerCase() === name.toLowerCase());
          if (exists) {
            throw new Error(`มีสมาชิกชื่อ "${name}" อยู่ใน Roster แล้ว`);
          }
        }
      }

      const newMember = {
        name,
        power: Number(power),
        role: warRole || "อิสระ (ให้ระบบจัดให้)",
        discordId: finalDiscordId,
      };

      if (!rosterData[job]) rosterData[job] = [];
      rosterData[job].push(newMember);

      // Targeted write: Only write the modified job array instead of the entire document
      if (rDoc.exists && rDoc.data()?.data) {
        t.set(rRef, { data: rosterData }, { merge: true });
      } else {
        t.set(rRef, { [job]: rosterData[job] }, { merge: true });
      }
    });

    return ok({ success: true, member: { name, job, power, warRole, discordId: finalDiscordId } });
  } catch (err: unknown) {
    return handleServerError(err, "Failed to add member to roster");
  }
}

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
      let previousJob: string | null = null;

      for (const j of Object.keys(rosterData)) {
        if (Array.isArray(rosterData[j])) {
          const idx = rosterData[j].findIndex((m: any) => m.discordId === targetDiscordId || (originalName && m.name === originalName));
          if (idx !== -1) {
            existingWarRole = rosterData[j][idx].role || existingWarRole;
            previousJob = j;
            rosterData[j].splice(idx, 1);
            break;
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

      // Targeted write: Only write affected job fields instead of serializing the full roster
      if (rDoc.exists && rDoc.data()?.data) {
        t.set(rRef, { data: rosterData }, { merge: true });
      } else {
        const patch: Record<string, any> = {
          [job]: rosterData[job],
        };
        if (previousJob && previousJob !== job) {
          patch[previousJob] = rosterData[previousJob];
        }
        t.set(rRef, patch, { merge: true });
      }
    });

    return ok({ success: true });
  } catch (err: unknown) {
    return handleServerError(err, "Failed to update member");
  }
}
