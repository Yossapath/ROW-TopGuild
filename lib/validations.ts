import { z } from "zod";

// ── Teams Schema ─────────────────────────────────────────────
export const teamMemberSchema = z.string().trim().max(100).nullable();

export const teamColumnSchema = z.object({
  id: z.string().trim().min(1).max(50),
  title: z.string().trim().max(100),
  type: z.enum(["main", "sub", "unassigned"]),
  memberIds: z.array(teamMemberSchema).max(100),
  locked: z.boolean().optional(),
});

// Dynamic zone schema — each zone has an id, a display name, a field type
// and an ordered list of team column IDs that belong to it.
export const zoneSchema = z.object({
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  type: z.enum(["main", "sub"]),
  teamOrder: z.array(z.string().trim().min(1).max(50)).max(50),
});

// Precomputed display rows saved alongside the team layout so pages that
// only need to *render* the war plan don't have to re-join columns with
// members. Loosely typed (z.any()) since it's a denormalized read model,
// not the source of truth.
const teamZoneRowSchema = z.array(z.any()).max(200);

export const teamDataSchema = z.object({
  members: z.record(
    z.string(),
    z.object({
      id: z.string().trim().min(1).max(100),
      name: z.string().trim().min(1).max(100),
      job: z.string().trim().max(50),
      power: z.number().nonnegative().refine(Number.isFinite, "Invalid power"),
      warRole: z.string().trim().max(100).optional(),
    })
  ).optional(),
  columns: z.record(z.string(), teamColumnSchema),
  // New dynamic zones field (v2)
  zones: z.array(zoneSchema).max(20).optional(),
  // Legacy fixed-zone fields kept for backward compatibility
  mainZone1Order: z.array(z.string().trim().max(50)).max(50).optional().default([]),
  mainZone2Order: z.array(z.string().trim().max(50)).max(50).optional().default([]),
  subOrder: z.array(z.string().trim().max(50)).max(50).optional().default([]),
  offlineIds: z.array(z.string().trim().max(100)).max(200).optional().default([]),
  data: z.array(z.any()).optional(), // Legacy read-only format
  version: z.number().int().nonnegative().optional(),
  updatedAt: z.number().optional(),
  updatedBy: z.string().trim().max(100).optional(),
});

// ── Roster Member Schemas ────────────────────────────────────
export const rosterMemberAddSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อ").max(100),
  job: z.string().trim().min(1, "กรุณาระบุอาชีพ").max(50),
  power: z.union([z.number().nonnegative(), z.string().regex(/^\d+$/)])
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER, "พลังรบไม่ถูกต้อง"),
  warRole: z.string().trim().max(100).optional().default("อิสระ (ให้ระบบจัดให้)"),
  discordId: z.string().trim().max(100).optional(),
});

export const rosterMemberUpdateSchema = z.object({
  targetDiscordId: z.string().trim().min(1).max(50),
  originalName: z.string().trim().max(100).optional(),
  originalJob: z.string().trim().max(50).optional(),
  name: z.string().trim().min(1, "กรุณาระบุชื่อ").max(100),
  job: z.string().trim().min(1, "กรุณาระบุอาชีพ").max(50),
  power: z.union([z.number().nonnegative(), z.string().regex(/^\d+$/)])
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER, "พลังรบไม่ถูกต้อง"),
  warRole: z.string().trim().max(100).optional(),
});

// ── Leave Request Schema ─────────────────────────────────────
export const leaveSubmitSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อ").max(100),
  job: z.string().trim().max(50).optional().default(""),
  date: z.string().trim().max(50).optional().default(""),
  day: z.string().trim().max(50).optional().default(""),
  reason: z.string().trim().max(500).optional().default(""),
}).refine((data) => (data.date && data.date.trim().length > 0) || (data.day && data.day.trim().length > 0), {
  message: "ต้องระบุ วันที่ หรือ วันในสัปดาห์ อย่างน้อย 1 อย่าง",
});

export const leaveDeleteSchema = z.object({
  id: z.string().trim().min(1, "ID ไม่ถูกต้อง").max(100),
});

// ── Dungeon Queue Schemas ────────────────────────────────────
export const dungeonQueueBookingSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อ").max(100),
  job: z.string().trim().min(1, "กรุณาระบุอาชีพ").max(50),
  dungeon: z.string().trim().max(100).optional().default("ดันมายา"),
  power: z.union([z.number().nonnegative(), z.string().regex(/^\d+$/)])
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : 0))
    .refine((v) => Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER, "พลังรบไม่ถูกต้อง"),
  rounds: z.union([z.literal(1), z.literal(2)]).default(1).transform(() => 1 as const),
});

export const dungeonQueuePatchSchema = z.object({
  round: z.union([z.literal(1), z.literal(2)]).optional(),
  action: z.enum(["updateRounds", "skip", "unskip", "startRun"]).optional(),
  rounds: z.union([z.literal(1), z.literal(2)]).optional(),
}).refine((data) => {
  if (data.action === "updateRounds") return data.rounds === 1 || data.rounds === 2;
  if (data.action === "skip" || data.action === "unskip" || data.action === "startRun") return true;
  return data.round === 1 || data.round === 2;
}, {
  message: "ข้อมูลรอบไม่ถูกต้อง",
});

// ── Attendance Schema ────────────────────────────────────────
export const attendanceRecordItemSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อ").max(100),
  status: z.enum(["present", "late", "absent", "leave", "มา", "ขาด", "ลา"]).nullable(),
  note: z.string().trim().max(200).optional(),
  clear: z.boolean().optional(),
});

export const attendancePostSchema = z.object({
  date: z.string().trim().min(1, "กรุณาระบุวันที่").max(50),
  action: z.enum(["save", "reset"]).optional().default("save"),
  records: z.array(attendanceRecordItemSchema).max(300),
});

// ── User Management Schema ───────────────────────────────────
export const userRoleUpdateSchema = z.object({
  discordId: z.string().trim().min(1, "ID ไม่ถูกต้อง").max(50),
  role: z.enum(["admin", "member", "owner"]),
});

export const userDeleteSchema = z.object({
  discordId: z.string().trim().min(1, "ID ไม่ถูกต้อง").max(50),
});

// ── System Log Schema ─────────────────────────────────────────
export const systemLogPostSchema = z.object({
  module: z.enum(["SYSTEM", "CLIENT", "UI", "DEBUG"]).default("SYSTEM"),
  action: z.string().trim().min(1, "กรุณาระบุ action").max(50),
  target: z.string().trim().max(100).optional().default(""),
  detail: z.string().trim().min(1, "กรุณาระบุ detail").max(500),
  extra: z.record(z.string(), z.unknown()).optional(),
});

// ── Complete Profile Schema ──────────────────────────────────
export const completeProfileSchema = z.object({
  gameUsername: z.string().trim().min(1, "กรุณาระบุชื่อในเกม").max(100),
  class: z.string().trim().min(1, "กรุณาระบุอาชีพ").max(50),
  power: z.union([z.number().nonnegative(), z.string().regex(/^\d+$/)])
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER, "พลังรบไม่ถูกต้อง"),
});

// ── Validation Helper ────────────────────────────────────────
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const message = firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "ข้อมูลไม่ถูกต้อง";
    return { success: false, error: message };
  }
  return { success: true, data: result.data };
}
