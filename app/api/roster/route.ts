export const dynamic = "force-dynamic";
import { rosterRef, getDb } from "@/lib/firebase-admin";
import { getCurrentUser } from "@/lib/auth";
import { ok, err, unauthorized } from "@/lib/server-utils";

export async function GET() {
  try {
    const snapshot = await getDb().collection("users").get();
    
    // Group users by class for the frontend
    const grouped: Record<string, any[]> = {};
    
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      const job = data.class;
      if (!job) return;
      
      if (!grouped[job]) grouped[job] = [];
      grouped[job].push({
        name: data.username,
        power: data.power,
        role: data.role
      });
    });
    
    // Sort each group by power descending
    for (const job in grouped) {
      grouped[job].sort((a, b) => b.power - a.power);
    }
    
    return ok(grouped);
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


