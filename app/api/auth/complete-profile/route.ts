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
    
    if (!rosterData[userClass]) {
      rosterData[userClass] = [];
    }
    
    // Check if user is already in roster, if so update, else add
    const existingIndex = rosterData[userClass].findIndex((m: any) => m.discordId === user.discordId || m.name === gameUsername);
    const memberObj = { 
      discordId: user.discordId, 
      discordUsername: user.discordUsername,
      name: gameUsername, 
      power: Number(power) 
    };
    
    if (existingIndex >= 0) {
      rosterData[userClass][existingIndex] = memberObj;
    } else {
      rosterData[userClass].push(memberObj);
    }
    
    await rosterDocRef.set(rosterData, { merge: true });

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
