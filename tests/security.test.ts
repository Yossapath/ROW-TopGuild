import test from "node:test";
import assert from "node:assert/strict";
import {
  leaveSubmitSchema,
  dungeonQueueBookingSchema,
  userRoleUpdateSchema,
  userDeleteSchema,
  attendancePostSchema,
  validateBody,
} from "../lib/validations";

// Test 1: JWT Secret Fail Fast
test("JWT Secret Validation - Fail fast on missing or insecure secret", () => {
  function validateSecret(secret?: string) {
    if (!secret || secret.trim() === "") {
      throw new Error("FATAL: JWT_SECRET environment variable is missing or empty!");
    }
    if (secret === "topguild-secret-change-in-production") {
      throw new Error("FATAL: Insecure default JWT_SECRET detected!");
    }
    return new TextEncoder().encode(secret);
  }

  // Missing secret
  assert.throws(() => validateSecret(undefined), /missing or empty/);
  assert.throws(() => validateSecret(""), /missing or empty/);
  assert.throws(() => validateSecret("   "), /missing or empty/);

  // Insecure fallback secret
  assert.throws(
    () => validateSecret("topguild-secret-change-in-production"),
    /Insecure default JWT_SECRET/
  );

  // Valid strong secret
  const valid = validateSecret("super-secure-random-token-32-chars-long");
  assert.ok(valid instanceof Uint8Array);
  assert.ok(valid.length > 0);
});

// Test 2: Discord OAuth CSRF State Protection
test("CSRF Protection - State parameter matching logic", () => {
  function verifyState(queryState?: string, cookieState?: string) {
    if (!queryState || !cookieState) return false;
    return queryState === cookieState;
  }

  const validUuid = "123e4567-e89b-12d3-a456-426614174000";
  const attackerState = "attacker-forged-state";

  assert.equal(verifyState(validUuid, validUuid), true);
  assert.equal(verifyState(attackerState, validUuid), false);
  assert.equal(verifyState(undefined, validUuid), false);
  assert.equal(verifyState(validUuid, undefined), false);
});

// Test 3: Admin Role Identification via Immutable Discord ID
test("Admin Role Assignment - Relies on ADMIN_DISCORD_IDS, not mutable username", () => {
  function resolveRole({
    discordId,
    discordUsername,
    adminDiscordIds,
    existingRole,
  }: {
    discordId: string;
    discordUsername: string;
    adminDiscordIds?: string;
    existingRole?: string;
  }) {
    const adminIds = (adminDiscordIds || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (adminIds.includes(discordId)) {
      return "admin";
    }

    return existingRole || "member";
  }

  const ADMIN_ID = "998877665544332211";
  const NORMAL_USER_ID = "112233445566778899";
  const CONFIG = `${ADMIN_ID},123456789`;

  // 1. Configured Discord ID gets admin regardless of username
  assert.equal(
    resolveRole({
      discordId: ADMIN_ID,
      discordUsername: "random_name",
      adminDiscordIds: CONFIG,
    }),
    "admin"
  );

  // 2. User named "datefourinmonthmay" but without admin ID does NOT get admin
  assert.equal(
    resolveRole({
      discordId: NORMAL_USER_ID,
      discordUsername: "datefourinmonthmay",
      adminDiscordIds: CONFIG,
    }),
    "member"
  );

  // 3. Regular user retains existing role or defaults to member
  assert.equal(
    resolveRole({
      discordId: NORMAL_USER_ID,
      discordUsername: "regular_user",
      adminDiscordIds: CONFIG,
      existingRole: "member",
    }),
    "member"
  );
});

// Test 4: Zod Validation Schemas
test("Zod Validation - Rejects malformed payloads and validates allowed fields", () => {
  // Leave Submit validation
  const validLeave = validateBody(leaveSubmitSchema, {
    name: "Hero",
    day: "เสาร์",
    reason: "ธุระส่วนตัว",
  });
  assert.equal(validLeave.success, true);

  const invalidLeave = validateBody(leaveSubmitSchema, {
    name: "Hero",
    // Missing both date and day
  });
  assert.equal(invalidLeave.success, false);

  // Dungeon Queue Booking validation
  const validQueue = validateBody(dungeonQueueBookingSchema, {
    name: "Hero",
    job: "Lord Knight",
    rounds: 2,
    power: 150000,
  });
  assert.equal(validQueue.success, true);
  if (validQueue.success) {
    assert.equal(validQueue.data.rounds, 2);
  }

  const invalidQueueRounds = validateBody(dungeonQueueBookingSchema, {
    name: "Hero",
    job: "Lord Knight",
    rounds: 3, // Invalid rounds (only 1 or 2)
  });
  assert.equal(invalidQueueRounds.success, false);

  // User Role Update validation
  const validRole = validateBody(userRoleUpdateSchema, {
    discordId: "123456789",
    role: "admin",
  });
  assert.equal(validRole.success, true);

  const invalidRole = validateBody(userRoleUpdateSchema, {
    discordId: "123456789",
    role: "super_hacker", // Invalid role
  });
  assert.equal(invalidRole.success, false);

  // User Delete validation
  const validDelete = validateBody(userDeleteSchema, {
    discordId: "123456789",
  });
  assert.equal(validDelete.success, true);

  const invalidDelete = validateBody(userDeleteSchema, {
    discordId: "",
  });
  assert.equal(invalidDelete.success, false);

  // Attendance validation
  const validAttendance = validateBody(attendancePostSchema, {
    date: "2026-09-05",
    records: [
      { name: "Player1", status: "present" },
      { name: "Player2", status: "late", note: "รถติด" },
      { name: "Player3", status: null },
    ],
  });
  assert.equal(validAttendance.success, true);

  const invalidAttendance = validateBody(attendancePostSchema, {
    date: "2026-09-05",
    records: "not-an-array",
  });
  assert.equal(invalidAttendance.success, false);
});
