/**
 * Booking Rules — Dungeon Queue
 *
 * Rules:
 * 1. จองได้ 1 รอบ ต่อคน ต่อวัน (calendar day, Asia/Bangkok)
 * 2. จองได้สูงสุด 2 รอบ ต่อคน ต่ออาทิตย์ (นับรอบ ไม่ใช่นับครั้งจอง)
 * 3. Week รีเซ็ตทุกวันจันทร์ 05:00 (Asia/Bangkok)
 * 4. จำกัดรวม 30 คน ต่อวัน (นับ booking ไม่ใช่รอบ)
 */

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7

/** Returns start/end ms for today in Bangkok time (day boundary = 00:00 local) */
export function getTodayRange(): { start: number; end: number } {
  const now = Date.now();
  const bangkokNow = now + BANGKOK_OFFSET_MS;
  const d = new Date(bangkokNow);
  // midnight of today in Bangkok = start of UTC day shifted by +7h
  const todayMidnightBangkok = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const start = todayMidnightBangkok - BANGKOK_OFFSET_MS;
  const end = start + 24 * 60 * 60 * 1000 - 1;
  return { start, end };
}

/**
 * Returns start/end ms for the current "dungeon week".
 * Week starts: Monday 05:00 Bangkok time.
 */
export function getWeekRange(): { start: number; end: number } {
  const now = Date.now();
  const bangkokNow = now + BANGKOK_OFFSET_MS;
  const d = new Date(bangkokNow);

  // Days since last Monday (Mon=1, Sun=0)
  const daysSinceMonday = d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1;

  // Start of Monday in UTC (midnight Bangkok = -7h UTC)
  const mondayMidnightUTC =
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
    daysSinceMonday * 24 * 60 * 60 * 1000 -
    BANGKOK_OFFSET_MS;

  // Monday 05:00 Bangkok = Monday 05:00 local
  const weekStart = mondayMidnightUTC + 5 * 60 * 60 * 1000;

  // If current time is before Monday 05:00 this week, go back one more week
  const correctedWeekStart = now < weekStart ? weekStart - 7 * 24 * 60 * 60 * 1000 : weekStart;
  const weekEnd = correctedWeekStart + 7 * 24 * 60 * 60 * 1000 - 1;

  return { start: correctedWeekStart, end: weekEnd };
}

export interface BookingEligibilityResult {
  allowed: boolean;
  reason?: string;
}

export const getBookingTimestamp = (docData: any): number => {
  return typeof docData?.bookedAt === "number"
    ? docData.bookedAt
    : typeof docData?.timestamp === "number"
    ? docData.timestamp
    : 0;
};

/**
 * Checks all booking rules for a given player.
 * @param playerName - ชื่อตัวละครในเกม
 * @param requestedRounds - จำนวนรอบที่ต้องการจอง (1 หรือ 2) — always 1 now
 * @param queuesRef - Firestore collection ref for "queues"
 * @param isAdmin - admins bypass all rules
 */
export async function checkBookingEligibility(
  playerName: string,
  requestedRounds: number,
  queuesRef: FirebaseFirestore.CollectionReference,
  isAdmin = false
): Promise<BookingEligibilityResult> {
  // Admins bypass all booking restrictions
  if (isAdmin) return { allowed: true };

  const today = getTodayRange();
  const week = getWeekRange();

  // NOTE: Firestore requires a composite index for equality + range on DIFFERENT
  // fields (name == x AND timestamp >= y). Since we can't guarantee that index
  // exists, we split into two simple queries that work without any composite index:
  //   - playerSnap: equality only on "name" → no composite index needed
  //   - dailyTotalSnap: range only on "timestamp" → no composite index needed
  // Timestamp filtering is then done in-memory, which is safe given that each
  // player has at most a few bookings per week.
  const [playerSnap, dailyTotalSnap] = await Promise.all([
    queuesRef.where("name", "==", playerName).get(), // equality only — no index required
    queuesRef
      .where("timestamp", ">=", today.start)
      .where("timestamp", "<=", today.end)
      .get(), // range on single field — no composite index required
  ]);


  // ── Rule 1: วันละ 1 รอบ ต่อคน ─────────────────────────────────
  const hasBookedToday = playerSnap.docs.some((doc) => {
    const ts = getBookingTimestamp(doc.data());
    return ts >= today.start && ts <= today.end;
  });

  if (hasBookedToday) {
    return {
      allowed: false,
      reason: "คุณจองคิวไปแล้ววันนี้ — จองได้สูงสุด 1 ครั้ง (1 รอบ) ต่อวัน",
    };
  }

  // ── Rule 2: อาทิตย์ละ 2 รอบ ต่อคน ────────────────────────────
  let roundsThisWeek = 0;
  for (const doc of playerSnap.docs) {
    const data = doc.data();
    const ts = getBookingTimestamp(data);
    if (ts >= week.start && ts <= week.end) {
      roundsThisWeek += Number(data.rounds) || 1;
    }
  }
  if (roundsThisWeek + requestedRounds > 2) {
    const remaining = Math.max(0, 2 - roundsThisWeek);
    return {
      allowed: false,
      reason: `คุณใช้สิทธิ์ไปแล้ว ${roundsThisWeek}/2 รอบสัปดาห์นี้ — เหลือสิทธิ์ ${remaining} รอบ (รีเซ็ตทุกจันทร์ 05:00)`,
    };
  }

  // ── Rule 3: จำกัด 30 คน ต่อวัน ───────────────────────────────
  const uniquePlayersToday = new Set<string>();
  for (const doc of dailyTotalSnap.docs) {
    const data = doc.data();
    const ts = getBookingTimestamp(data);
    if (ts >= today.start && ts <= today.end && data.name) {
      uniquePlayersToday.add(data.name as string);
    }
  }
  if (!uniquePlayersToday.has(playerName) && uniquePlayersToday.size >= 30) {
    return {
      allowed: false,
      reason: "วันนี้มีผู้เล่นจองครบ 30 คนแล้ว — ระบบปิดรับจองสำหรับวันนี้",
    };
  }

  return { allowed: true };
}

export interface UserQuotaInfo {
  playerName: string;
  todayUsed: number;
  todayRemaining: number;
  weekUsed: number;
  weekRemaining: number;
  dailyTotalBooked: number;
  dailyTotalLimit: number;
  canBook: boolean;
  reason?: string;
}

/**
 * Calculates current booking quota and remaining rights for a player.
 */
export async function getUserBookingQuota(
  playerName: string,
  queuesRef: FirebaseFirestore.CollectionReference,
  isAdmin = false
): Promise<UserQuotaInfo> {
  const today = getTodayRange();
  const week = getWeekRange();

  // Same fix as checkBookingEligibility: avoid composite index requirement
  // by querying only by name (equality only) and filtering timestamp in-memory.
  const [playerSnap, dailyTotalSnap] = await Promise.all([
    queuesRef.where("name", "==", playerName).get(), // equality only — no composite index
    queuesRef
      .where("timestamp", ">=", today.start)
      .where("timestamp", "<=", today.end)
      .get(),
  ]);


  const hasBookedToday = playerSnap.docs.some((doc) => {
    const ts = getBookingTimestamp(doc.data());
    return ts >= today.start && ts <= today.end;
  });

  let roundsThisWeek = 0;
  for (const doc of playerSnap.docs) {
    const data = doc.data();
    const ts = getBookingTimestamp(data);
    if (ts >= week.start && ts <= week.end) {
      roundsThisWeek += Number(data.rounds) || 1;
    }
  }

  const uniquePlayersToday = new Set<string>();
  for (const doc of dailyTotalSnap.docs) {
    const data = doc.data();
    const ts = getBookingTimestamp(data);
    if (ts >= today.start && ts <= today.end && data.name) {
      uniquePlayersToday.add(data.name as string);
    }
  }

  const todayRemaining = hasBookedToday ? 0 : 1;
  const weekRemaining = Math.max(0, 2 - roundsThisWeek);
  const dailyCapReached = !uniquePlayersToday.has(playerName) && uniquePlayersToday.size >= 30;

  let canBook = true;
  let reason: string | undefined;

  if (!isAdmin) {
    if (hasBookedToday) {
      canBook = false;
      reason = "คุณจองคิวไปแล้ววันนี้ (จำกัด 1 รอบ/วัน)";
    } else if (weekRemaining <= 0) {
      canBook = false;
      reason = "คุณใช้สิทธิ์ครบ 2 รอบในสัปดาห์นี้แล้ว (รีเซ็ตวันจันทร์ 05:00 น.)";
    } else if (dailyCapReached) {
      canBook = false;
      reason = "วันนี้มีผู้จองครบ 30 คนแล้ว";
    }
  }

  return {
    playerName,
    todayUsed: hasBookedToday ? 1 : 0,
    todayRemaining,
    weekUsed: roundsThisWeek,
    weekRemaining,
    dailyTotalBooked: uniquePlayersToday.size,
    dailyTotalLimit: 30,
    canBook,
    reason,
  };
}

