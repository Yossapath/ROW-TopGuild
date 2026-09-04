export const dynamic = "force-dynamic";
import { rosterRef, getDb, COLL_USER } from "@/lib/firebase-admin";
import { getCurrentUser } from "@/lib/auth";
import { ok, err, unauthorized } from "@/lib/server-utils";

export async function GET() {
  try {
    const doc = await rosterRef().get();
    if (!doc.exists) {
      return ok({});
    }
    const docData = doc.data() as any;
    // The HTML app wraps the roster in a "data" property: { data: { "Lord Knight": [...] } }
    const actualRoster = docData.data ? docData.data : docData;
    return ok(actualRoster);
  } catch (e: any) {
    return err(e.message, 500);
  }
}

// Admin only: Update whole roster or add new member
export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return unauthorized();
    }

    const body = await req.json();
    await rosterRef().set(body, { merge: true });
    
    return ok({ message: "Roster updated successfully" });
  } catch (e: any) {
    return err(e.message, 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      return unauthorized();
    }

    const body = await req.json();
    const { discordId, job, name } = body;
    
    const db = getDb();
    
    // Remove from roster
    if (job) {
      const doc = await rosterRef().get();
      if (doc.exists) {
        let rosterData = doc.data() as any;
        if (rosterData.data) rosterData = rosterData.data;
        
        if (rosterData[job]) {
          rosterData[job] = rosterData[job].filter((m: any) => m.discordId !== discordId && m.name !== name);
          await rosterRef().set(rosterData);
        }
      }
    }
    
    // Remove user doc
    if (discordId) {
      await db.collection(COLL_USER).doc(discordId).delete();
    }

    return ok({ message: "Deleted" });
  } catch (e: any) {
    return err(e.message, 500);
  }
}


