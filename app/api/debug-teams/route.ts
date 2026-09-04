import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export async function GET() {
  const snapshot = await getDocs(collection(db, "guild_system"));
  const data: any = {};
  snapshot.forEach(doc => {
    data[doc.id] = doc.data();
  });
  return NextResponse.json(data);
}
