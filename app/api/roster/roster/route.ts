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
    const rRef = rosterRef();
    const userDocRef = discordId ? db.collection(COLL_USER).doc(discordId) : null;

    // Atomically remove from roster and user collection in a single transaction
    await db.runTransaction(async (t) => {
      const [rDoc, uDoc] = await Promise.all([
        t.get(rRef),
        userDocRef ? t.get(userDocRef) : Promise.resolve(null),
      ]);

      if (rDoc.exists) {
        let rosterData = rDoc.data() as any;
        const isLegacyWrapper = Boolean(rosterData.data);
        if (isLegacyWrapper) rosterData = rosterData.data;

        const jobsToCheck = job && rosterData[job] ? [job] : Object.keys(rosterData);
        const modifiedJobs: string[] = [];

        for (const j of jobsToCheck) {
          if (Array.isArray(rosterData[j])) {
            const originalLen = rosterData[j].length;
            rosterData[j] = rosterData[j].filter((m: any) => {
              const isTarget = discordId && m.discordId
                ? m.discordId === discordId
                : Boolean(name && m.name === name);
              return !isTarget;
            });
            if (rosterData[j].length !== originalLen) {
              modifiedJobs.push(j);
            }
          }
        }

        if (modifiedJobs.length > 0) {
          // Targeted write: Only patch the specific job field(s) from which the member was removed
          if (isLegacyWrapper) {
            t.set(rRef, { data: rosterData }, { merge: true });
          } else {
            const patch: Record<string, any> = {};
            for (const j of modifiedJobs) {
              patch[j] = rosterData[j];
            }
            t.set(rRef, patch, { merge: true });
          }
        }
      }

      if (uDoc && uDoc.exists && userDocRef) {
        t.delete(userDocRef);
      }
    });

    return ok({ message: "Deleted" });
  } catch (e: unknown) {
    return handleServerError(e, "Failed to delete member");
  }
}


