import { dungeonsRef } from "@/lib/firebase-admin";
import { ok, handleServerError } from "@/lib/server-utils";
import { DungeonQueueItem } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = await dungeonsRef().collection("dungeon_queue_items").get();
    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DungeonQueueItem));
    
    // Filter out SKIPPED or COMPLETED items for the UI (maybe we just want WAITING and ASSIGNED)
    const activeItems = items.filter(i => i.status === "WAITING" || i.status === "ASSIGNED");
    
    // Sort logic to match UI expectations (same as engine)
    activeItems.sort((a, b) => {
      if (a.roundNumber !== b.roundNumber) {
        return a.roundNumber - b.roundNumber;
      }
      return a.queuedAt - b.queuedAt;
    });

    return ok(activeItems);
  } catch (e: unknown) {
    return handleServerError(e, "Failed to load queue items");
  }
}
