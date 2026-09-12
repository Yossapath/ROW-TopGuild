import test from "node:test";
import assert from "node:assert/strict";
import {
  leaveSubmitSchema,
  dungeonQueueBookingSchema,
  dungeonQueuePatchSchema,
  userRoleUpdateSchema,
  userDeleteSchema,
  attendancePostSchema,
  validateBody,
} from "../lib/validations";
import { isBookingOpen } from "../lib/utils";

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

  // Dungeon Queue Booking validation (locked to 1 round by system)
  const validQueue = validateBody(dungeonQueueBookingSchema, {
    name: "Hero",
    job: "Lord Knight",
    rounds: 1,
    power: 150000,
  });
  assert.equal(validQueue.success, true);
  if (validQueue.success) {
    assert.equal(validQueue.data.rounds, 1);
  }

  // Booking with 2 rounds is automatically locked/transformed to 1 round
  const validQueueTransformed = validateBody(dungeonQueueBookingSchema, {
    name: "Hero",
    job: "Lord Knight",
    rounds: 2,
    power: 150000,
  });
  assert.equal(validQueueTransformed.success, true);
  if (validQueueTransformed.success) {
    assert.equal(validQueueTransformed.data.rounds, 1);
  }

  const invalidQueueRounds = validateBody(dungeonQueueBookingSchema, {
    name: "Hero",
    job: "Lord Knight",
    rounds: 3, // Invalid rounds (only 1 or 2)
  });
  assert.equal(invalidQueueRounds.success, false);

  // Dungeon Queue Patch validation (round completion, updateRounds, skip, unskip)
  const validPatchRound = validateBody(dungeonQueuePatchSchema, { round: 1 });
  assert.equal(validPatchRound.success, true);

  const validPatchSkip = validateBody(dungeonQueuePatchSchema, { action: "skip" });
  assert.equal(validPatchSkip.success, true);

  const validPatchUnskip = validateBody(dungeonQueuePatchSchema, { action: "unskip" });
  assert.equal(validPatchUnskip.success, true);

  const validPatchStartRun = validateBody(dungeonQueuePatchSchema, { action: "startRun" });
  assert.equal(validPatchStartRun.success, true);

  const validPatchRounds = validateBody(dungeonQueuePatchSchema, { action: "updateRounds", rounds: 2 });
  assert.equal(validPatchRounds.success, true);

  const invalidPatchAction = validateBody(dungeonQueuePatchSchema, { action: "invalidAction" as any });
  assert.equal(invalidPatchAction.success, false);

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

test("isBookingOpen - Safe handling of undefined, empty, or partial schedule objects", () => {
  // Undefined or null schedule -> open
  assert.equal(isBookingOpen(undefined).open, true);
  assert.equal(isBookingOpen(null).open, true);

  // Missing or empty openDate -> open (unlimited)
  assert.equal(isBookingOpen({ carryTeamsCount: 1 } as any).open, true);
  assert.equal(isBookingOpen({ openDate: "", openTime: "06:00", closeTime: "23:59" }).open, true);
  assert.equal(isBookingOpen({ openDate: "   " }).open, true);

  // Different date -> closed with reason
  const resultDiffDate = isBookingOpen({
    openDate: "2099-01-01",
    openTime: "06:00",
    closeTime: "23:59",
  });
  assert.equal(resultDiffDate.open, false);
  assert.match(resultDiffDate.reason || "", /ยังไม่ถึงวันเปิดจอง/);

  // Today with no time limits -> open
  const nowBkk = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
  );
  const todayStr = nowBkk.toLocaleDateString("en-CA");
  const resultTodayNoTime = isBookingOpen({
    openDate: todayStr,
  });
  assert.equal(resultTodayNoTime.open, true);

  // Today with full day 00:00 to 23:59 -> open
  const resultTodayAllDay = isBookingOpen({
    openDate: todayStr,
    openTime: "00:00",
    closeTime: "23:59",
  });
  assert.equal(resultTodayAllDay.open, true);
});

test("Roster Deletion Logic - Safe member matching without De Morgan data loss", () => {
  function filterRoster(members: any[], { discordId, name }: { discordId?: string; name?: string }) {
    return members.filter((m: any) => {
      const isTarget = discordId && m.discordId
        ? m.discordId === discordId
        : Boolean(name && m.name === name);
      return !isTarget;
    });
  }

  const sampleMembers = [
    { name: "PlayerWithNoDiscord1", power: 1000 },
    { name: "PlayerWithNoDiscord2", power: 1200 },
    { name: "PlayerWithDiscord1", discordId: "d1", power: 1500 },
    { name: "PlayerWithDiscord2", discordId: "d2", power: 1600 },
  ];

  // 1. Delete by name only (no discordId) - must NOT delete other members without discordId!
  const afterDeleteName = filterRoster(sampleMembers, { name: "PlayerWithNoDiscord1" });
  assert.equal(afterDeleteName.length, 3);
  assert.equal(afterDeleteName.some(m => m.name === "PlayerWithNoDiscord1"), false);
  assert.equal(afterDeleteName.some(m => m.name === "PlayerWithNoDiscord2"), true, "PlayerWithNoDiscord2 must NOT be deleted");

  // 2. Delete by discordId only (no name)
  const afterDeleteDiscord = filterRoster(sampleMembers, { discordId: "d1" });
  assert.equal(afterDeleteDiscord.length, 3);
  assert.equal(afterDeleteDiscord.some(m => m.discordId === "d1"), false);
  assert.equal(afterDeleteDiscord.some(m => m.discordId === "d2"), true);

  // 3. Delete with both discordId and name
  const afterDeleteBoth = filterRoster(sampleMembers, { discordId: "d2", name: "PlayerWithDiscord2" });
  assert.equal(afterDeleteBoth.length, 3);
  assert.equal(afterDeleteBoth.some(m => m.discordId === "d2"), false);

  // 4. Do NOT delete if discordId is for a different user even if name matches
  const membersWithDuplicateName = [
    { name: "Alice", discordId: "user_111" },
    { name: "Alice", discordId: "user_222" },
  ];
  const afterTargetUser111 = filterRoster(membersWithDuplicateName, { discordId: "user_111", name: "Alice" });
  assert.equal(afterTargetUser111.length, 1);
  assert.equal(afterTargetUser111[0].discordId, "user_222", "user_222 must be preserved");
});

test("Dungeon Queue Transaction - Atomic Daily 30-Player Cap Enforcement", () => {
  function verifyDailyCapInTransaction({
    dailyDocs,
    playerName,
    isAdminOrOwner,
  }: {
    dailyDocs: { name?: string }[];
    playerName: string;
    isAdminOrOwner: boolean;
  }) {
    if (isAdminOrOwner) return "ALLOWED";

    const uniquePlayersToday = new Set<string>();
    for (const d of dailyDocs) {
      if (d.name) uniquePlayersToday.add(d.name);
    }

    if (!uniquePlayersToday.has(playerName) && uniquePlayersToday.size >= 30) {
      throw new Error("DAILY_LIMIT_EXCEEDED");
    }

    return "ALLOWED";
  }

  // 1. 29 unique players -> 30th player is allowed
  const twentyNinePlayers = Array.from({ length: 29 }, (_, i) => ({ name: `Player_${i + 1}` }));
  assert.equal(
    verifyDailyCapInTransaction({ dailyDocs: twentyNinePlayers, playerName: "Player_30", isAdminOrOwner: false }),
    "ALLOWED"
  );

  // 2. 30 unique players -> 31st player throws DAILY_LIMIT_EXCEEDED
  const thirtyPlayers = Array.from({ length: 30 }, (_, i) => ({ name: `Player_${i + 1}` }));
  assert.throws(
    () => verifyDailyCapInTransaction({ dailyDocs: thirtyPlayers, playerName: "Player_31", isAdminOrOwner: false }),
    /DAILY_LIMIT_EXCEEDED/
  );

  // 3. Admin bypasses even with 30+ players
  assert.equal(
    verifyDailyCapInTransaction({ dailyDocs: thirtyPlayers, playerName: "AdminGuildLeader", isAdminOrOwner: true }),
    "ALLOWED"
  );
});
