import { getDb, COLL_USER, rosterRef } from "@/lib/firebase-admin";
import { requireAuth, signToken, authCookie } from "@/lib/auth";
import { ok, err, handleServerError } from "@/lib/server-utils";
import { completeProfileSchema, validateBody } from "@/lib/validations";

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

    const { gameUsername, class: userClass, power } = validation.data;

    const db = getDb();
    const userRef = db.collection(COLL_USER).doc(user.discordId);
    
    await userRef.update({
      gameUsername,
      class: userClass,
      power: Number(power),
    });

    // Add to roster
    const rosterDocRef = rosterRef();
    const rosterDoc = await rosterDocRef.get();
    let rosterData = rosterDoc.exists ? rosterDoc.data() || {} : {};
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
      power: Number(power) 
    };

    rosterData[userClass].push(memberObj);

    await rosterDocRef.set(rosterData);

    const payload = {
      ...user,
      gameUsername,
      class: userClass,
      power: Number(power),
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
