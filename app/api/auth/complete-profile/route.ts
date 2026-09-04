import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { getCurrentUser, signToken, authCookie } from "@/lib/auth";
import { ok, err } from "@/lib/server-utils";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return err("Unauthorized", 401);

    const body = await req.json();
    const { gameUsername, class: userClass, power } = body;

    if (!gameUsername || !userClass || power === undefined || power === null) {
      return err("กรุณากรอกข้อมูลให้ครบถ้วน", 400);
    }

    const db = getDb();
    const userRef = db.collection("TopGuild").doc(user.discordId);
    
    await userRef.update({
      gameUsername,
      class: userClass,
      power: Number(power),
    });

    // Add to roster
    const rosterRef = db.collection("TopGuild").doc("roster");
    const rosterDoc = await rosterRef.get();
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
    
    await rosterRef.set(rosterData, { merge: true });

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
  } catch (e: any) {
    return err(e.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล", 500);
  }
}
