export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getDb, COLL } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const snapshot = await getDb().collection(COLL).get();
    const data: any = {};
    snapshot.forEach(doc => {
      data[doc.id] = doc.data();
    });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
