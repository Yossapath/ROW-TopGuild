export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getDb, COLL_SYSTEM } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth";
import { err, handleServerError } from "@/lib/server-utils";

export async function GET() {
  // Block access completely in production
  if (process.env.NODE_ENV === "production") {
    return err("Not Found", 404);
  }

  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const snapshot = await getDb().collection(COLL_SYSTEM).get();
    const data: any = {};
    snapshot.forEach((doc) => {
      data[doc.id] = doc.data();
    });
    return NextResponse.json(data);
  } catch (err: any) {
    return handleServerError(err, "Failed to load debug data");
  }
}
