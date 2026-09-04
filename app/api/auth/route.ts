export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { usersRef, getDb } from "@/lib/firebase-admin";
import { signToken, authCookie, clearAuthCookie, hashPassword } from "@/lib/auth";
import { ok, err } from "@/lib/server-utils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, username, password } = body;

    // ── Logout ──
    if (action === "logout") {
      const res = ok({ message: "Logged out" });
      res.cookies.set(clearAuthCookie());
      return res;
    }

    // ── Login ──
    if (!username || !password) return err("กรุณากรอก Username และ Password");

    // ดึงข้อมูล user จาก Firestore
    // ลองหาจาก root collection "users" ก่อน (กรณีที่คนสร้างไม่ได้ซ้อน collection)
    
    let doc = await getDb().collection("users").doc(username).get();
    
    // ถ้าไม่เจอ ลองหาจาก path เดิม: guild_system/users/accounts/{username}
    if (!doc.exists) {
      doc = await usersRef().collection("accounts").doc(username).get();
    }

    if (!doc.exists) {
      return err("ไม่พบผู้ใช้งานนี้ในระบบ", 404);
    }

    const data = doc.data()!;
    const hashed = await hashPassword(password);
    
    // ตรวจสอบ Password (รองรับทั้งแบบ plain text เดิม และ hashed)
    if (data.password !== password && data.password !== hashed) {
      return err("รหัสผ่านไม่ถูกต้อง", 401);
    }

    // สร้าง JWT Payload
    const payload = {
      username,
      role: data.role || "member",
      class: data.class || "",
    };

    // Sign Token & Set Cookie
    const token = await signToken(payload);
    const res = ok({ user: payload });
    res.cookies.set(authCookie(token));

    return res;
  } catch (e: any) {
    return err(e.message, 500);
  }
}

export async function GET() {
  return err("Method Not Allowed", 405);
}


