import { getDb, COLL_USER, rosterRef, teamsRef } from "@/lib/firebase-admin";
import { requireAuth, signToken, authCookie } from "@/lib/auth";
import { ok, err, handleServerError } from "@/lib/server-utils";
import { completeProfileSchema, validateBody } from "@/lib/validations";
import { updateMemberNameInTeamsData } from "@/lib/team-sync";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;
    const user = auth.user;

    const body = await req.json();
    const validation = validateBody(completeProfileSchema, body);
    if (!validation.success) {
      return err(validation.error, 400);
    }

    const { gameUsername, class: userClass, power, gvgField } = validation.data;

    const db = getDb();
    const userRef = db.collection(COLL_USER).doc(user.discordId);
    const rosterDocRef = rosterRef();
    const tRef = teamsRef();

    await db.runTransaction(async (t) => {
      const [userDoc, rosterDoc, tDoc] = await Promise.all([
        t.get(userRef),
        t.get(rosterDocRef),
        t.get(tRef),
      ]);

      let rosterData = rosterDoc.exists ? (rosterDoc.data() || {}) : {};
      if (rosterData.data) rosterData = rosterData.data;
      
      let oldName: string | null = null;
      if (userDoc.exists) {
        oldName = userDoc.data()?.gameUsername;
      }

      // Remove this member from every job bucket first (they may be changing
      // class or name), so switching jobs can't leave a stale duplicate entry behind
      // in their old class array.
      for (const jobKey of Object.keys(rosterData)) {
        if (!Array.isArray(rosterData[jobKey])) continue;
        rosterData[jobKey] = rosterData[jobKey].filter(
          (m: any) => m.discordId !== user.discordId && m.name !== gameUsername
        );
      }

      if (!rosterData[userClass]) {
        rosterData[userClass] = [];
      }

      const memberObj = { 
        discordId: user.discordId, 
        discordUsername: user.discordUsername,
        name: gameUsername, 
        power: Number(power),
        gvgField
      };

      rosterData[userClass].push(memberObj);

      if (userDoc.exists) {
        t.update(userRef, {
          gameUsername,
          class: userClass,
          power: Number(power),
          gvgField,
        });
      } else {
        t.set(userRef, {
          discordId: user.discordId,
          discordUsername: user.discordUsername,
          gameUsername,
          class: userClass,
          power: Number(power),
          role: user.role || "member",
          gvgField,
        }, { merge: true });
      }

      t.set(rosterDocRef, rosterData);
      
      if (oldName && oldName !== gameUsername && tDoc.exists) {
        const tData = tDoc.data();
        const { changed, updatedData } = updateMemberNameInTeamsData(tData, oldName, gameUsername);
        if (changed) {
          const nextVersion = typeof tData?.version === "number" ? tData.version + 1 : 1;
          t.set(tRef, { ...updatedData, version: nextVersion, updatedAt: Date.now() }, { merge: true });
        }
      }
    });

    const payload = {
      ...user,
      gameUsername,
      class: userClass,
      power: Number(power),
      gvgField,
      isProfileComplete: true,
    };

    const token = await signToken(payload);
    const res = ok({ user: payload, message: "บันทึกข้อมูลสำเร็จ" });
    res.cookies.set(authCookie(token));

    return res;
  } catch (e: unknown) {
    return handleServerError(e, "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
  }
}
