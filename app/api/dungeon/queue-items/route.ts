import { dungeonsRef } from "@/lib/firebase-admin";
import { ok, handleServerError } from "@/lib/server-utils";
import { DungeonQueueItem } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Only read queue items that can currently appear on the board.
    // Completed/skipped history is intentionally left in Firestore but is
    // not fetched, which significantly reduces Firestore document reads.
    const snap = await dungeonsRef()
      .collection("dungeon_queue_items")
      .where("status", "in", ["WAITING", "ASSIGNED"])
      .get();

    const activeItems: DungeonQueueItem[] = snap.docs.map(
      (doc: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() } as DungeonQueueItem)
    );

    // Keep ordering consistent with the queue engine: round first, then
    // original queue time. The UI handles the Priest/Other grouping.
    activeItems.sort((a: DungeonQueueItem, b: DungeonQueueItem) => {
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
