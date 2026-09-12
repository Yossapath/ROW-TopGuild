import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
// ── Tailwind class merge ──────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Job class → color ─────────────────────────────────────────
export const JOB_COLORS: Record<string, string> = {
  "Lord Knight":    "#c13829",
  "Paladin":        "#e18028",
  "High Wizard":    "#2c7eb9",
  "Sniper":         "#d4a015",
  "Priest":         "#25ae62",
  "Champion":       "#15a083",
  "Assassin Cross": "#8b46af",
  "Merchant":       "#c2185d",
  "Gunslinger":     "#894517",
  "Druid":          "#41b388",
};

export const JOB_LIST = Object.keys(JOB_COLORS);

// ── Booking time check (Bangkok timezone) ────────────────────
export function isBookingOpen(
  schedule?: {
    openDate?: string;
    openTime?: string;
    closeTime?: string;
    carryTeamsCount?: number;
    isClosed?: boolean;
  } | null,
  now?: Date
): { open: boolean; reason?: string } {
  // No schedule configured yet (or none of openDate/openTime/closeTime
  // set) means the admin hasn't restricted booking at all — default to
  // OPEN, not closed. This matches how the rest of the schedule form
  // treats an unset field as "no restriction" rather than "blocked".
  if (!schedule) {
    return { open: true };
  }

  // Manual override: admin explicitly closed booking
  if (schedule.isClosed === true) {
    return { open: false, reason: "🔒 ปิดรับจองโดยผู้ดูแลระบบ" };
  }

  const isUnlimited = !schedule.openTime && !schedule.closeTime && !schedule.openDate;
  if (isUnlimited) {
    return { open: true };
  }

  if (!schedule.openDate || !schedule.openDate.trim()) {
    return { open: true };
  }

  const nowBkk = now
    ? new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }))
    : new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const todayStr = nowBkk.toLocaleDateString("en-CA"); // YYYY-MM-DD
  const targetDate = schedule.openDate.trim();

  const parts = targetDate.split("-");
  const dateReason = parts.length === 3
    ? `⏰ ยังไม่ถึงวันเปิดจอง (เปิดวันที่ ${parts[2]}/${parts[1]}/${parts[0]})`
    : `⏰ ยังไม่ถึงวันเปิดจอง`;

  // If time is not restricted but date is set, open all day on target date
  if (!schedule.openTime || !schedule.closeTime) {
    if (todayStr !== targetDate) {
      return { open: false, reason: dateReason };
    }
    return { open: true };
  }

  const [oh, om] = schedule.openTime.split(":").map(Number);
  const [ch, cm] = schedule.closeTime.split(":").map(Number);
  const nowMins   = nowBkk.getHours() * 60 + nowBkk.getMinutes();
  const openMins  = (isNaN(oh) ? 0 : oh) * 60 + (isNaN(om) ? 0 : om);
  const closeMins = (isNaN(ch) ? 23 : ch) * 60 + (isNaN(cm) ? 59 : cm);
  const timeReason = `⏰ ยังไม่ถึงเวลาเปิดจอง (เปิด ${schedule.openTime} – ${schedule.closeTime} น.)`;

  if (openMins <= closeMins) {
    // Normal window (e.g. 09:00 - 22:00)
    if (todayStr !== targetDate) {
      return { open: false, reason: dateReason };
    }
    if (nowMins < openMins || nowMins > closeMins) {
      return { open: false, reason: timeReason };
    }
    return { open: true };
  } else {
    // Midnight crossing window (e.g. 22:00 - 02:00)
    const [ty, tm, td] = parts.map(Number);
    const nextDayDate = new Date(Date.UTC(ty, tm - 1, td + 1));
    const nextDayStr = nextDayDate.toISOString().split("T")[0];

    if (todayStr === targetDate) {
      // Day 1 (starts at openMins)
      if (nowMins < openMins) {
        return { open: false, reason: timeReason };
      }
      return { open: true };
    }

    if (todayStr === nextDayStr) {
      // Day 2 (ends at closeMins)
      if (nowMins <= closeMins) {
        return { open: true };
      }
      return { open: false, reason: timeReason };
    }

    // Outside both Day 1 and Day 2
    return { open: false, reason: dateReason };
  }
}

// ── Timestamp helpers ─────────────────────────────────────────
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
