import { getDb, auctionsRef, auctionReservationsRef } from "@/lib/firebase-admin";
import { AuctionReservation, ReservationStatus } from "@/types";

export async function getAuctionQueue(auctionId: string): Promise<AuctionReservation[]> {
  // Use single-field where only to avoid composite index requirement.
  // Sort in memory instead.
  const snapshot = await auctionReservationsRef()
    .where("auctionId", "==", auctionId)
    .get();
    
  const docs = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }) as AuctionReservation)
    .filter(r => r.status === "waiting")
    .sort((a, b) => a.joinedAt - b.joinedAt);

  return docs;
}

export async function getMyReservations(userId: string): Promise<AuctionReservation[]> {
  // Use single-field where only to avoid composite index requirement.
  const snapshot = await auctionReservationsRef()
    .where("userId", "==", userId)
    .get();
    
  const docs = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }) as AuctionReservation)
    .filter(r => r.status === "waiting" || r.status === "won")
    .sort((a, b) => b.joinedAt - a.joinedAt);

  return docs;
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

    // Check if already reserved — query by auctionId only (no composite index needed)
    const existingSnapshot = await t.get(
      auctionReservationsRef()
        .where("auctionId", "==", auctionId)
    );
    const alreadyReserved = existingSnapshot.docs.some(
      d => d.data().userId === userId && d.data().status === "waiting"
    );
    if (alreadyReserved) {
      return { success: false, error: "You are already in this queue" };
    }

    // Count current waiting queue
    const queueCount = existingSnapshot.docs.filter(
      d => d.data().status === "waiting"
    ).length;
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

    // Recount waiting queue (single field query — no composite index needed)
    const queueSnapshot = await t.get(
      auctionReservationsRef().where("auctionId", "==", auctionId)
    );

    t.update(resDoc.ref, { 
      status: isAdmin && reservation.userId !== userId ? "removed" : "cancelled", 
      updatedAt: Date.now() 
    });

    const newCount = Math.max(0,
      queueSnapshot.docs.filter(d => d.data().status === "waiting" && d.id !== reservationId).length
    );
    
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
