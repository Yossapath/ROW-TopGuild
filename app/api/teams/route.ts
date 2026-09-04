import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export async function GET() {
  try {
    const docRef = doc(db, "guild_system", "teams");
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      return NextResponse.json({ main: [], sub: [], unassigned: [] });
    }
    return NextResponse.json(snapshot.data());
  } catch (error) {
    return NextResponse.json({ error: "Failed to load teams" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const docRef = doc(db, "guild_system", "teams");
    // We overwrite completely since team arrangement is an exact snapshot
    await setDoc(docRef, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save teams" }, { status: 500 });
  }
}
