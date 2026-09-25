import { getDb, auctionsRef, auctionReservationsRef } from "@/lib/firebase-admin";
import { AuctionItem, AuctionStatus, AuctionCategory } from "@/types";

export async function getAuctions(): Promise<AuctionItem[]> {
  const snapshot = await auctionsRef().get();
  let items = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as AuctionItem[];
  
  // Sort alphabetically by itemName
  items.sort((a, b) => a.itemName.localeCompare(b.itemName, 'th'));
  
  return items;
}

export async function getAuction(id: string): Promise<AuctionItem | null> {
  const doc = await auctionsRef().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as AuctionItem;
}

export async function createAuction(
  data: { itemName: string; category: AuctionCategory; description?: string; imageUrl?: string },
  createdBy: string
): Promise<AuctionItem> {
  const docRef = auctionsRef().doc();
  const now = Date.now();
  const auction: AuctionItem = {
    id: docRef.id,
    itemName: data.itemName,
    category: data.category,
    description: data.description || "",
    imageUrl: data.imageUrl || "",
    status: "open",
    queueCount: 0,
    createdAt: now,
    createdBy,
    updatedAt: now,
  };

  await docRef.set(auction);
  return auction;
}

export async function updateAuction(
  id: string,
  data: Partial<AuctionItem>,
  updatedBy: string
): Promise<void> {
  const docRef = auctionsRef().doc(id);
  await docRef.update({
    ...data,
    updatedAt: Date.now(),
  });
}

export async function deleteAuction(id: string): Promise<void> {
  // Using atomic transaction to delete auction and its reservations?
  // Or maybe batch delete. For now just delete auction. 
  // In a real app we'd archive it or delete reservations too.
  const batch = getDb().batch();
  batch.delete(auctionsRef().doc(id));
  
  const resSnapshot = await auctionReservationsRef().where("auctionId", "==", id).get();
  resSnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
}
