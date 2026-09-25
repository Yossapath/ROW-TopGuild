import { getDb, auctionsRef, auctionReservationsRef } from "@/lib/firebase-admin";
import { AuctionReservation, ReservationStatus } from "@/types";

export async function getAuctionQueue(auctionId: string): Promise<AuctionReservation[]> {
  const snapshot = await auctionReservationsRef()
    .where("auctionId", "==", auctionId)
    .where("status", "==", "waiting")
    .orderBy("joinedAt", "asc")
    .get();
    
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AuctionReservation[];
}

export async function getMyReservations(userId: string): Promise<AuctionReservation[]> {
  const snapshot = await auctionReservationsRef()
    .where("userId", "==", userId)
    .where("status", "in", ["waiting", "won"])
    .orderBy("joinedAt", "desc")
    .get();
    
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AuctionReservation[];
}

export async function reserveAuction(
  auctionId: string,
  userId: string,
  characterName: string,
  job: string
): Promise<{ success: boolean; error?: string; reservation?: AuctionReservation }> {
  const db = getDb();
  
  return await db.runTransaction(async (t) => {
    const auctionDoc = await t.get(auctionsRef().doc(auctionId));
    if (!auctionDoc.exists) return { success: false, error: "Auction not found" };
    
    const auction = auctionDoc.data();
    if (auction?.status !== "open") return { success: false, error: "Auction is not open" };

    // Check if already reserved
    const existingSnapshot = await t.get(
      auctionReservationsRef()
        .where("auctionId", "==", auctionId)
        .where("userId", "==", userId)
        .where("status", "==", "waiting")
    );
    if (!existingSnapshot.empty) {
      return { success: false, error: "You are already in this queue" };
    }

    // Get current queue count (we can count the waiting ones to be accurate)
    const queueSnapshot = await t.get(
      auctionReservationsRef()
        .where("auctionId", "==", auctionId)
        .where("status", "==", "waiting")
    );
    const queueCount = queueSnapshot.size;
    const queueNumber = queueCount + 1;

    const resRef = auctionReservationsRef().doc();
    const now = Date.now();
    const newReservation: AuctionReservation = {
      id: resRef.id,
      auctionId,
      userId,
      characterName,
      job,
      queueNumber,
      status: "waiting",
      joinedAt: now,
      updatedAt: now,
    };

    t.set(resRef, newReservation);
    t.update(auctionsRef().doc(auctionId), { 
      queueCount: queueCount + 1,
      updatedAt: now 
    });

    return { success: true, reservation: newReservation };
  });
}

export async function cancelReservation(
  reservationId: string,
  userId: string,
  isAdmin: boolean
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  
  return await db.runTransaction(async (t) => {
    const resDoc = await t.get(auctionReservationsRef().doc(reservationId));
    if (!resDoc.exists) return { success: false, error: "Reservation not found" };
    
    const reservation = resDoc.data() as AuctionReservation;
    if (reservation.userId !== userId && !isAdmin) {
      return { success: false, error: "Permission denied" };
    }
    if (reservation.status !== "waiting") {
      return { success: false, error: "Only waiting reservations can be cancelled" };
    }

    const auctionId = reservation.auctionId;

    t.update(resDoc.ref, { 
      status: isAdmin && reservation.userId !== userId ? "removed" : "cancelled", 
      updatedAt: Date.now() 
    });

    // Update queue count
    const queueSnapshot = await t.get(
      auctionReservationsRef()
        .where("auctionId", "==", auctionId)
        .where("status", "==", "waiting")
    );
    // Note: this size includes the one we are cancelling, so -1
    const newCount = Math.max(0, queueSnapshot.size - 1);
    
    t.update(auctionsRef().doc(auctionId), { 
      queueCount: newCount,
      updatedAt: Date.now() 
    });

    return { success: true };
  });
}

export async function awardAuction(
  auctionId: string,
  reservationId: string,
  adminId: string,
  adminName: string
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  
  return await db.runTransaction(async (t) => {
    const resDoc = await t.get(auctionReservationsRef().doc(reservationId));
    if (!resDoc.exists) return { success: false, error: "Reservation not found" };
    
    const auctionDoc = await t.get(auctionsRef().doc(auctionId));
    if (!auctionDoc.exists) return { success: false, error: "Auction not found" };
    
    const reservation = resDoc.data() as AuctionReservation;

    // Mark reservation as won
    t.update(resDoc.ref, { 
      status: "won", 
      updatedAt: Date.now() 
    });

    // Mark auction as awarded
    t.update(auctionDoc.ref, { 
      status: "awarded",
      winnerId: reservation.userId,
      winnerName: reservation.characterName,
      awardedBy: adminName,
      awardedAt: Date.now(),
      updatedAt: Date.now() 
    });

    return { success: true };
  });
}
