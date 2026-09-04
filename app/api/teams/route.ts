export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { teamsRef } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const snapshot = await teamsRef().get();
    if (!snapshot.exists) {
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
    await teamsRef().set(data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save teams" }, { status: 500 });
  }
}
