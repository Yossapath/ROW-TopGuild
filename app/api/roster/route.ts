import { rosterRef } from "@/lib/firebase-admin";
import { getCurrentUser } from "@/lib/auth";
import { ok, err, unauthorized } from "@/lib/utils";

export async function GET() {
  try {
    const doc = await rosterRef().get();
    if (!doc.exists) {
      return ok({}); // Default empty roster
    }
    return ok(doc.data());
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
    // In a real app we'd validate the structure against our Roster type
    await rosterRef().set(body, { merge: true });
    
    return ok({ message: "Roster updated successfully" });
  } catch (e: any) {
    return err(e.message, 500);
  }
}
