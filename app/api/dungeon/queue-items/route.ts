import { dungeonsRef } from "@/lib/firebase-admin";
import { ok, handleServerError } from "@/lib/server-utils";
import { DungeonQueueItem } from "@/types";
import { trackFirestoreRead } from "@/lib/firestore-logger";
import { requireAuth } from "@/lib/auth";
import { getOrSetQueueItemsCache } from "@/lib/dungeon/queue-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;

    const activeItems = await getOrSetQueueItemsCache(async () => {
      const snap = await trackFirestoreRead(
        "GET /api/dungeon/queue-items",
        "dungeon_queue_items query (active)",
        () =>
          dungeonsRef()
            .collection("dungeon_queue_items")
            .where("status", "in", ["WAITING", "ASSIGNED"])
            .get()
      );

      const items: DungeonQueueItem[] = snap.docs.map(
        (doc: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() } as DungeonQueueItem)
      );

      items.sort((a: DungeonQueueItem, b: DungeonQueueItem) => {
        if (a.roundNumber !== b.roundNumber) {
          return a.roundNumber - b.roundNumber;
        }
        return a.queuedAt - b.queuedAt;
      });

      return items;
    });

    return ok(activeItems);
  } catch (e: unknown) {
    return handleServerError(e, "Failed to load queue items");
  }
}
