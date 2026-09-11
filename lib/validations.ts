import { z } from "zod";

// ── Teams Schema ─────────────────────────────────────────────
export const teamMemberSchema = z.string().max(100).nullable();

export const teamColumnSchema = z.object({
  id: z.string().max(50),
  title: z.string().max(100),
  type: z.enum(["main", "sub", "unassigned"]),
  memberIds: z.array(teamMemberSchema).max(100),
  locked: z.boolean().optional(),
});

// Dynamic zone schema — each zone has an id, a display name, a field type
// and an ordered list of team column IDs that belong to it.
export const zoneSchema = z.object({
  id: z.string().max(100),
  name: z.string().min(1).max(100),
  type: z.enum(["main", "sub"]),
  teamOrder: z.array(z.string().max(50)).max(50),
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
      id: z.string().max(100),
      name: z.string().min(1).max(100),
      job: z.string().max(50),
      power: z.number().nonnegative(),
      warRole: z.string().max(100).optional(),
    })
  ).optional(),
  columns: z.record(z.string(), teamColumnSchema),
  // New dynamic zones field (v2)
  zones: z.array(zoneSchema).max(20).optional(),
  // Legacy fixed-zone fields kept for backward compatibility
  mainZone1Order: z.array(z.string().max(50)).max(50).optional().default([]),
  mainZone2Order: z.array(z.string().max(50)).max(50).optional().default([]),
  subOrder: z.array(z.string().max(50)).max(50).optional().default([]),
  offlineIds: z.array(z.string().max(100)).max(200).optional().default([]),
  main: z.array(teamZoneRowSchema).max(50).optional(),
  sub: z.array(teamZoneRowSchema).max(50).optional(),
});

// ── Roster Member Update Schema ──────────────────────────────
export const rosterMemberUpdateSchema = z.object({
  targetDiscordId: z.string().min(1).max(50),
  originalName: z.string().max(100).optional(),
  originalJob: z.string().max(50).optional(),
  name: z.string().min(1).max(100),
  job: z.string().min(1).max(50),
  power: z.union([z.number().nonnegative(), z.string().regex(/^\d+$/)]).transform((v) => Number(v)),
  warRole: z.string().max(100).optional(),
});

// ── Leave Request Schema ─────────────────────────────────────
export const leaveSubmitSchema = z.object({
  name: z.string().min(1).max(100),
  job: z.string().max(50).optional().default(""),
  date: z.string().max(50).optional().default(""),
  day: z.string().max(50).optional().default(""),
  reason: z.string().max(500).optional().default(""),
}).refine((data) => data.date || data.day, {
  message: "ต้องระบุ วันที่ หรือ วันในสัปดาห์ อย่างน้อย 1 อย่าง",
});

export const leaveDeleteSchema = z.object({
  id: z.string().min(1).max(100),
});

// ── Dungeon Queue Schemas ────────────────────────────────────
export const dungeonQueueBookingSchema = z.object({
  name: z.string().min(1).max(100),
  job: z.string().min(1).max(50),
  dungeon: z.string().max(100).optional().default("ดันมายา"),
  power: z.union([z.number().nonnegative(), z.string().regex(/^\d+$/)]).optional().transform((v) => Number(v) || 0),
  rounds: z.union([z.literal(1), z.literal(2)]).default(1),
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
  name: z.string().min(1).max(100),
  status: z.enum(["present", "late", "absent", "leave"]).nullable(),
  note: z.string().max(200).optional(),
});

export const attendancePostSchema = z.object({
  date: z.string().min(1).max(50),
  records: z.array(attendanceRecordItemSchema).max(300),
});

// ── User Management Schema ───────────────────────────────────
export const userRoleUpdateSchema = z.object({
  discordId: z.string().min(1).max(50),
  role: z.enum(["admin", "member", "owner"]),
});

export const userDeleteSchema = z.object({
  discordId: z.string().min(1).max(50),
});

// ── Complete Profile Schema ──────────────────────────────────
export const completeProfileSchema = z.object({
  gameUsername: z.string().min(1).max(100),
  class: z.string().min(1).max(50),
  power: z.union([z.number().nonnegative(), z.string().regex(/^\d+$/)]).transform((v) => Number(v)),
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
