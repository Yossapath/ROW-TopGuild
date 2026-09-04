export const dynamic = "force-dynamic";
import { getDb, COLL_USER, rosterRef } from "@/lib/firebase-admin";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { targetDiscordId, originalName, originalJob, name, job, power, warRole } = await req.json();

    // Check permission: Admin or Self
    if (user.role !== "admin" && user.discordId !== targetDiscordId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = getDb();
    
    // 1. Update the user document in COLL_USER
    const userDocRef = db.collection(COLL_USER).doc(targetDiscordId);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
      const updateData: any = { gameUsername: name, class: job, power: Number(power) };
      if (user.role === "admin" && warRole) {
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

      memberObj.role = user.role === "admin" && warRole ? warRole : existingWarRole;

      if (!rosterData[job]) rosterData[job] = [];
      rosterData[job].push(memberObj);

      t.set(rRef, rosterData);
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
