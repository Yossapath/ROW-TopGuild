import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { hashPassword } from "@/lib/auth";
import { ok, err } from "@/lib/server-utils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password, class: userClass, power } = body;

    if (!username || !password || !userClass || power === undefined) {
      return err("กรุณากรอกข้อมูลให้ครบถ้วน", 400);
    }

    // validate format
    if (username.length < 3) return err("ชื่อผู้ใช้งานต้องมีอย่างน้อย 3 ตัวอักษร", 400);
    if (password.length < 6) return err("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร", 400);

    const db = getDb();
    const userRef = db.collection("users").doc(username);
    const doc = await userRef.get();

    if (doc.exists) {
      return err("ชื่อผู้ใช้งานนี้มีในระบบแล้ว", 409);
    }

    const hashedPassword = await hashPassword(password);

    await userRef.set({
      username,
      password: hashedPassword,
      class: userClass,
      power: Number(power),
      role: "member",
      createdAt: new Date().toISOString(),
    });

    return ok({ message: "สมัครสมาชิกสำเร็จ" });
  } catch (e: any) {
    return err(e.message || "เกิดข้อผิดพลาดในการสมัครสมาชิก", 500);
  }
}
