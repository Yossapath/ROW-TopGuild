export const dynamic = "force-dynamic";
import { rosterRef, getDb, COLL_USER } from "@/lib/firebase-admin";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { ok, err, handleServerError } from "@/lib/server-utils";
import { trackFirestoreRead } from "@/lib/firestore-logger";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const doc = await trackFirestoreRead(
      "GET /api/roster",
      "roster doc get",
      () => rosterRef().get()
    );
    if (!doc.exists) {
      return ok({});
    }
    const docData = doc.data() as any;
    const actualRoster = docData.data ? docData.data : docData;
    return ok(actualRoster);
  } catch (e: unknown) {
    return handleServerError(e, "Failed to load roster");
  }
}

// Admin only: Update whole roster or add new member
export async function PUT(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    if (!body || typeof body !== "object") {
      return err("ข้อมูลไม่ถูกต้อง", 400);
    }

    await rosterRef().set(body, { merge: true });
    
    return ok({ message: "Roster updated successfully" });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to update roster");
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const { discordId, job, name } = body;
    if (!discordId && !name) {
      return err("Missing identifier", 400);
    }
    
    const db = getDb();
    const batch = db.batch();
    let hasWrites = false;
    
    // Remove from roster
    if (job) {
      const doc = await rosterRef().get();
      if (doc.exists) {
        let rosterData = doc.data() as any;
        if (rosterData.data) rosterData = rosterData.data;
        
        if (rosterData[job]) {
          const originalLen = rosterData[job].length;
          rosterData[job] = rosterData[job].filter((m: any) => m.discordId !== discordId && m.name !== name);
          if (rosterData[job].length !== originalLen) {
            batch.set(rosterRef(), rosterData);
            hasWrites = true;
          }
        }
      }
    }
    
    // Remove user doc
    if (discordId) {
      batch.delete(db.collection(COLL_USER).doc(discordId));
      hasWrites = true;
    }

    if (hasWrites) {
      await batch.commit();
    }

    return ok({ message: "Deleted" });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to delete member");
  }
}


