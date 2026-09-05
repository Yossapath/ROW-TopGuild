// ============================================================
// TypeScript Types — Topguild V2
// Maps 1:1 with Firebase Firestore schema (guild_system/*)
// ============================================================

// ── User / Auth ──────────────────────────────────────────────
export type UserRole = "admin" | "owner" | "member";

export interface GuildUser {
  discordId: string;
  discordUsername: string;
  gameUsername?: string;
  role: UserRole;
  class?: string;
  power?: number;
  createdAt?: number;
}

export interface AuthPayload {
  discordId: string;
  discordUsername: string;
  gameUsername?: string;
  role: UserRole;
  class?: string;
  power?: number;
  isProfileComplete: boolean;
}

// ── Roster ───────────────────────────────────────────────────
export type JobClass =
  | "Lord Knight"
  | "Paladin"
  | "High Wizard"
  | "Sniper"
  | "Priest"
  | "Champion"
  | "Assassin Cross"
  | "Merchant"
  | "Gunslinger"
  | "Druid";

export interface Member {
  name: string;
  power: number;
  fieldPref?: "any" | "main" | "sub";
}

export type Roster = Record<JobClass, Member[]>;

// ── War Teams ─────────────────────────────────────────────────
export interface TeamSlot {
  name: string;
  job: string;
  power: number | null;
}

export interface WarField {
  title: string;
  isMain?: boolean;
  teams: Record<string, TeamSlot[]>;
}

// ── Dungeon ───────────────────────────────────────────────────
export type DungeonType =
  | "ดันมายา (Maya)"
  | "ฟองสบู่ (Bubble)"
  | "กระจก (Mirror)";

export type QueueStatus = "waiting" | "active" | "done";

export interface DungeonQueue {
  id: string;
  name: string;
  job: string;
  dungeon: DungeonType;
  power: number;
  status: QueueStatus;
  rounds: 1 | 2;
  round1?: boolean;
  round2?: boolean;
  timestamp: number;
}

export interface DungeonTeamMember {
  name: string;
  job: string;
  power: number;
}

export interface DungeonTeam {
  id: string;
  type: DungeonType;
  dungeonName: string;
  capacity: number;
  members: (DungeonTeamMember | null)[];
}

export interface DungeonSchedule {
  openDate: string;   // "YYYY-MM-DD"
  openTime: string;   // "HH:MM"
  closeTime: string;  // "HH:MM"
}

// ── Attendance ────────────────────────────────────────────────
export interface AttendanceRecord {
  id: string;
  name: string;
  job?: string;
  date: string;       // "YYYY-MM-DD"
  present: boolean;
  note?: string;
  timestamp: number;
}

// ── Leave ────────────────────────────────────────────────────
export interface LeaveRecord {
  id: string;
  name: string;
  job?: string;
  date?: string;
  day?: string;
  reason?: string;
  timestamp: number;
}

// ── System Log ───────────────────────────────────────────────
export interface SystemLog {
  id: string;
  module: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  extra?: unknown;
  timestamp: number;
}

// ── API Response ─────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
