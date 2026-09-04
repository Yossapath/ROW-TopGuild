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
export function isBookingOpen(schedule: {
  openDate: string;
  openTime: string;
  closeTime: string;
}): { open: boolean; reason?: string } {
  const nowBkk = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
  );
  const todayStr = nowBkk.toLocaleDateString("en-CA"); // YYYY-MM-DD

  if (todayStr !== schedule.openDate) {
    const [y, m, d] = schedule.openDate.split("-");
    return {
      open: false,
      reason: `⏰ ยังไม่ถึงวันเปิดจอง (เปิดวันที่ ${d}/${m}/${y})`,
    };
  }

  const [oh, om] = schedule.openTime.split(":").map(Number);
  const [ch, cm] = schedule.closeTime.split(":").map(Number);
  const nowMins   = nowBkk.getHours() * 60 + nowBkk.getMinutes();
  const openMins  = oh * 60 + om;
  const closeMins = ch * 60 + cm;

  if (nowMins < openMins || nowMins > closeMins) {
    return {
      open: false,
      reason: `⏰ ยังไม่ถึงเวลาเปิดจอง (เปิด ${schedule.openTime} – ${schedule.closeTime} น.)`,
    };
  }

  return { open: true };
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
