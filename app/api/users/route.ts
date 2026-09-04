export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getDb, COLL_USER } from "@/lib/firebase-admin";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const db = getDb();
    const snapshot = await db.collection(COLL_USER).get();
    const users: any[] = [];
    snapshot.forEach(doc => users.push(doc.data()));
    return NextResponse.json(users);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { discordId, role } = await req.json();
    if (!discordId || !role) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }
    const db = getDb();
    await db.collection(COLL_USER).doc(discordId).update({ role });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
