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
    const userRef = db.collection("users").doc(user.discordId);
    
    await userRef.update({
      gameUsername,
      class: userClass,
      power: Number(power),
    });

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
