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

export type QueueStatus = "waiting" | "active" | "done" | "skipped";

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
  startTime?: number; // set when status transitions to "active" via startRun
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
  carryTeamsCount?: number; // จำนวนทีมแบก (ค่าเริ่มต้น 1 หรือ 2)
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

// ── Automated Dungeon Queue Engine ───────────────────────────

export type QueueItemStatus = "WAITING" | "ASSIGNED" | "COMPLETED" | "SKIPPED";

export interface DungeonQueueItem {
  id: string;
  bookingId: string;
  name: string;
  job: string;
  power: number;
  dungeon: DungeonType;
  roundNumber: 1 | 2;
  status: QueueItemStatus;
  queuedAt: number;
  assignedTeamId: string | null;
  completedAt: number | null;
}

export type TeamStatus = "AVAILABLE" | "RUNNING" | "PAUSED";

export interface ActiveTeamMember {
  queueItemId: string;
  name: string;
  job: string;
  roundNumber: 1 | 2;
}

export interface DungeonTeamResource {
  id: string;
  dungeon: DungeonType;
  status: TeamStatus;
  startedAt: number | null;
  pausedAt: number | null;
  pausedDuration: number;
  estimatedDurationSeconds: number;
  activeMembers: ActiveTeamMember[];
  completedRounds: number;
}
