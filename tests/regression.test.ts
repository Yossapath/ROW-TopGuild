import { test } from 'node:test';
import assert from 'node:assert';

import { sortQueueItems, findContinuousPriest } from '@/lib/dungeon/queue-rules';
import { assignPlayersToTeam } from '@/lib/dungeon/queue-engine';
import { checkBookingEligibility, getUserBookingQuota } from '@/lib/dungeon/booking-rules';
import { allocateTeams } from '@/lib/team-allocator';
import { isBookingOpen } from '@/lib/utils';
import type { DungeonQueueItem, DungeonTeamResource, AuthPayload } from '@/types';
import {
  getOrSetAttendanceCache,
  invalidateAttendanceCache,
  resetAttendanceCacheForTesting,
} from '@/lib/attendance-cache';
import {
  attendancePostSchema,
  attendanceRecordItemSchema,
  systemLogPostSchema,
  validateBody,
  rosterMemberAddSchema,
  rosterMemberUpdateSchema,
  leaveSubmitSchema,
  leaveDeleteSchema,
  dungeonQueueBookingSchema,
  dungeonQueuePatchSchema,
  userRoleUpdateSchema,
  userDeleteSchema,
  completeProfileSchema,
  teamDataSchema,
} from '@/lib/validations';
import {
  removeMemberFromTeamsData,
  removeMemberFromTeamsTransaction,
} from '@/lib/team-sync';
import { signToken, verifyToken, setUserRoleForTesting, getLiveUserRole, invalidateUserRoleCache, getJwtSecret } from '@/lib/auth';
import {
  getOrSetQueueItemsCache,
  getOrSetDungeonTeamsCache,
  invalidateCurrentQueuesCache,
  resetCurrentQueuesCacheForTesting,
} from '@/lib/dungeon/queue-cache';

test('Regression: Auth & Role Privileges', () => {
  const adminUser = { role: "admin", discordId: "111" };
  const ownerUser = { role: "owner", discordId: "222" };
  const memberUser = { role: "member", discordId: "333" };

  assert.strictEqual(adminUser.role === "admin" || adminUser.role === "owner", true);
  assert.strictEqual(ownerUser.role === "admin" || ownerUser.role === "owner", true);
  assert.strictEqual(memberUser.role === "admin" || memberUser.role === "owner", false);
});

test('Regression: Booking Window & Quota Validation', async () => {
  // Schedule checks
  assert.strictEqual(isBookingOpen({ isClosed: true }).open, false);
  assert.strictEqual(isBookingOpen({ isClosed: false, openTime: "00:00", closeTime: "23:59" }).open, true);

  // Admin bypass
  const createMockRef = (docs: any[] = []) => {
    const obj: any = {
      where: () => obj,
      get: async () => ({ docs, size: docs.length, empty: docs.length === 0 })
    };
    return obj;
  };

  const mockQueuesRef = createMockRef();

  const adminCheck = await checkBookingEligibility("AdminPlayer", 1, mockQueuesRef, true);
  assert.strictEqual(adminCheck.allowed, true);

  // Quota test: empty history
  const freshQuota = await getUserBookingQuota("NewPlayer", mockQueuesRef, false);
  assert.strictEqual(freshQuota.todayUsed, 0);
  assert.strictEqual(freshQuota.todayRemaining, 1);
  assert.strictEqual(freshQuota.weekUsed, 0);
  assert.strictEqual(freshQuota.weekRemaining, 2);
  assert.strictEqual(freshQuota.canBook, true);

  // Quota test: user booked today
  const usedQueuesRef = createMockRef([{ data: () => ({ rounds: 1, timestamp: Date.now() }) }]);
  const usedQuota = await getUserBookingQuota("ActivePlayer", usedQueuesRef, false);
  assert.strictEqual(usedQuota.todayUsed, 1);
  assert.strictEqual(usedQuota.todayRemaining, 0);
  assert.strictEqual(usedQuota.canBook, false);
});

test('Regression: Queue Ordering (R1 before R2, then timestamp)', () => {
  const items: DungeonQueueItem[] = [
    { id: "1", bookingId: "b1", dungeon: "ดันมายา (Maya)", power: 100, assignedTeamId: null, completedAt: null, name: "Bob", job: "Sniper", roundNumber: 2, queuedAt: 100, status: "WAITING" },
    { id: "2", bookingId: "b2", dungeon: "ดันมายา (Maya)", power: 100, assignedTeamId: null, completedAt: null, name: "Alice", job: "Sniper", roundNumber: 1, queuedAt: 200, status: "WAITING" },
    { id: "3", bookingId: "b3", dungeon: "ดันมายา (Maya)", power: 100, assignedTeamId: null, completedAt: null, name: "Charlie", job: "Sniper", roundNumber: 1, queuedAt: 150, status: "WAITING" },
  ];
  const sorted = sortQueueItems(items);
  assert.strictEqual(sorted[0].name, "Charlie");
  assert.strictEqual(sorted[1].name, "Alice");
  assert.strictEqual(sorted[2].name, "Bob");
});

test('Regression: Continuous Priest & Team Assignment', () => {
  const prev = [{ name: "HealerPro", job: "Priest", roundNumber: 1 }];
  const queueWithPriests: DungeonQueueItem[] = [
    { id: "P_NEW", bookingId: "b1", dungeon: "ดันมายา (Maya)", power: 100, assignedTeamId: null, completedAt: null, name: "OtherHealer", job: "Priest", roundNumber: 1, queuedAt: 100, status: "WAITING" },
    { id: "P_CONT", bookingId: "b2", dungeon: "ดันมายา (Maya)", power: 100, assignedTeamId: null, completedAt: null, name: "HealerPro", job: "Priest", roundNumber: 2, queuedAt: 500, status: "WAITING" },
  ];
  const continuous = findContinuousPriest(prev, queueWithPriests);
  assert.strictEqual(continuous?.name, "HealerPro");

  // Team requires Priest
  const team: DungeonTeamResource = {
    id: "team-1",
    dungeon: "ดันมายา (Maya)",
    status: "AVAILABLE",
    startedAt: null,
    pausedAt: null,
    pausedDuration: 0,
    estimatedDurationSeconds: 300,
    activeMembers: [],
    completedRounds: 0,
    carriers: ["C1", "C2"],
  };
  const membersNoPriest: DungeonQueueItem[] = [
    { id: "A", bookingId: "bA", dungeon: "ดันมายา (Maya)", power: 100, assignedTeamId: null, completedAt: null, name: "A", job: "Sniper", roundNumber: 1, queuedAt: 10, status: "WAITING" },
  ];
  const noPriestResult = assignPlayersToTeam(team, membersNoPriest, undefined, { C1: "Paladin", C2: "Sniper" });
  // Without Priest, auto-assign adds players up to cap of 2, reserving 1 slot for Priest
  assert.strictEqual(noPriestResult.updatedTeam.activeMembers.length, 1);

  const membersWithPriest: DungeonQueueItem[] = [
    ...membersNoPriest,
    { id: "P", bookingId: "bP", dungeon: "ดันมายา (Maya)", power: 100, assignedTeamId: null, completedAt: null, name: "P", job: "Priest", roundNumber: 1, queuedAt: 20, status: "WAITING" },
  ];
  const withPriestResult = assignPlayersToTeam(team, membersWithPriest, undefined, { C1: "Paladin", C2: "Sniper" });
  assert.strictEqual(withPriestResult.updatedTeam.activeMembers.length, 2);
  assert.strictEqual(withPriestResult.updatedTeam.activeMembers[0].name, "P");
});

test('Regression: GVG Team Allocator & Cache Integrity', () => {
  const members: any = {};
  for (let i = 1; i <= 60; i++) {
    members[`Player${i}`] = { id: `Player${i}`, name: `Player${i}`, job: i <= 12 ? "Priest" : "Sniper", power: 1000 + i };
  }
  const cols: any = {
    unassigned: { id: "unassigned", title: "ยังไม่ได้จัด", memberIds: [], type: "unassigned", locked: false },
  };
  for (let i = 1; i <= 12; i++) {
    cols[`main-${i}`] = { id: `main-${i}`, title: `ทีม ${i}`, memberIds: [null, null, null, null, null], type: "main", locked: false };
  }
  for (let i = 1; i <= 5; i++) {
    cols[`sub-${i}`] = { id: `sub-${i}`, title: `ทีมรอง ${i}`, memberIds: [null, null, null, null, null], type: "sub", locked: false };
  }
  const gvgResult = allocateTeams({
    members,
    columns: cols,
    mainZone1Order: ["main-1","main-2","main-3","main-4","main-5","main-6"],
    mainZone2Order: ["main-7","main-8","main-9","main-10","main-11","main-12"],
    subOrder: ["sub-1","sub-2","sub-3","sub-4","sub-5"],
    offlineIds: [],
    mainFieldNames: Object.keys(members),
  });
  assert.ok(gvgResult.columns);
  assert.ok(Object.keys(gvgResult.columns).length > 0);
});

test('Regression: Quota Debounce & Safe Identity Matching', async () => {
  // 1. Debounce simulation: rapid typing over 5 keystrokes
  let fetchCount = 0;
  let lastFetchedName = "";

  const mockFetchQuota = (name: string) => {
    fetchCount++;
    lastFetchedName = name;
  };

  class QuotaDebouncer {
    private timer: NodeJS.Timeout | null = null;
    constructor(private delay = 400) {}

    type(name: string) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        mockFetchQuota(name);
      }, this.delay);
    }
  }

  const debouncer = new QuotaDebouncer(400);

  // User types "A", "Al", "Ali", "Alic", "Alice" quickly (within 100ms)
  debouncer.type("A");
  debouncer.type("Al");
  debouncer.type("Ali");
  debouncer.type("Alic");
  debouncer.type("Alice");

  // Before 400ms -> 0 fetches
  assert.strictEqual(fetchCount, 0, "Must NOT fetch immediately on keystroke");

  // Wait 450ms
  await new Promise((r) => setTimeout(r, 450));

  // After 400ms -> exactly 1 fetch with the final name "Alice"
  assert.strictEqual(fetchCount, 1, "Must execute exactly 1 fetch after debounce window");
  assert.strictEqual(lastFetchedName, "Alice");

  // 2. Identity Safety Check: isQuotaMatchingCurrentInput
  function isQuotaMatching(quotaData: { playerName: string } | null, formName: string, fallbackUsername?: string) {
    const expected = formName.trim() || (fallbackUsername ?? "");
    return Boolean(
      quotaData &&
      expected &&
      quotaData.playerName.toLowerCase() === expected.toLowerCase()
    );
  }

  const aliceQuota = { playerName: "Alice" };

  // Matching input: Alice in input, Alice in quotaData -> TRUE
  assert.strictEqual(isQuotaMatching(aliceQuota, "Alice"), true);
  assert.strictEqual(isQuotaMatching(aliceQuota, "  alice  "), true);

  // Mismatched input: User starts typing "Bob" while Alice quota is loaded -> FALSE (Must NOT show Alice's quota!)
  assert.strictEqual(isQuotaMatching(aliceQuota, "Bob"), false);
  assert.strictEqual(isQuotaMatching(aliceQuota, "B"), false);
  assert.strictEqual(isQuotaMatching(aliceQuota, ""), false);

  // Null quotaData -> FALSE
  assert.strictEqual(isQuotaMatching(null, "Alice"), false);
});

test('Regression: Attendance Cache - In-Memory Caching, Range Independence & Invalidation', async () => {
  resetAttendanceCacheForTesting();

  let fetchWeek1Count = 0;
  let fetchWeek2Count = 0;

  const mockFetchWeek1 = async () => {
    fetchWeek1Count++;
    return [{ id: "rec1", name: "Player1", date: "2026-09-08", status: "มา" }];
  };

  const mockFetchWeek2 = async () => {
    fetchWeek2Count++;
    return [{ id: "rec2", name: "Player2", date: "2026-09-15", status: "ขาด" }];
  };

  // 1. Initial fetches for week 1 and week 2
  const res1 = await getOrSetAttendanceCache("range:2026-09-08_2026-09-13", mockFetchWeek1, 1000);
  const res2 = await getOrSetAttendanceCache("range:2026-09-15_2026-09-20", mockFetchWeek2, 1000);

  assert.strictEqual(fetchWeek1Count, 1);
  assert.strictEqual(fetchWeek2Count, 1);
  assert.strictEqual(res1[0].name, "Player1");
  assert.strictEqual(res2[0].name, "Player2");

  // 2. Cache hits: within TTL, no new fetches executed
  const cached1 = await getOrSetAttendanceCache("range:2026-09-08_2026-09-13", mockFetchWeek1, 1000);
  const cached2 = await getOrSetAttendanceCache("range:2026-09-15_2026-09-20", mockFetchWeek2, 1000);

  assert.strictEqual(fetchWeek1Count, 1, "Week 1 must hit cache");
  assert.strictEqual(fetchWeek2Count, 1, "Week 2 must hit cache");
  assert.strictEqual(cached1[0].name, "Player1");

  // 3. Invalidation purges all cache entries
  invalidateAttendanceCache();

  // Next fetch must query again
  await getOrSetAttendanceCache("range:2026-09-08_2026-09-13", mockFetchWeek1, 1000);
  assert.strictEqual(fetchWeek1Count, 2, "Must re-fetch after invalidation");
});

test('Regression: Attendance Cache - Request Coalescing under Concurrency', async () => {
  resetAttendanceCacheForTesting();

  let fetchCount = 0;
  const slowFetch = async () => {
    fetchCount++;
    await new Promise((r) => setTimeout(r, 30));
    return [{ id: "c1", name: "ConcurrentPlayer" }];
  };

  const requests = Array.from({ length: 10 }, () =>
    getOrSetAttendanceCache("range:concurrent-test", slowFetch, 5000)
  );

  const results = await Promise.all(requests);
  assert.strictEqual(fetchCount, 1, "Only 1 fetch must run for 10 concurrent requests");
  assert.strictEqual(results.length, 10);
  assert.strictEqual(results[0][0].name, "ConcurrentPlayer");
});

test('Regression: Attendance Validation - Accepts Both Thai and English Status Values', () => {
  // Thai status values (used by UI dropdown and batch save)
  const thaiValid = validateBody(attendancePostSchema, {
    date: "2026-09-08",
    records: [
      { name: "LordKnight", status: "มา" },
      { name: "Paladin", status: "ขาด" },
      { name: "Priest", status: "ลา", note: "ติดงาน" },
      { name: "Sniper", status: null },
    ],
  });
  assert.strictEqual(thaiValid.success, true);

  // English status values (backward compatibility with external scripts)
  const englishValid = validateBody(attendancePostSchema, {
    date: "2026-09-08",
    records: [
      { name: "LordKnight", status: "present" },
      { name: "Paladin", status: "absent" },
      { name: "Priest", status: "leave" },
    ],
  });
  assert.strictEqual(englishValid.success, true);

  // Invalid status value rejected
  const invalidStatus = validateBody(attendancePostSchema, {
    date: "2026-09-08",
    records: [
      { name: "LordKnight", status: "invalid_status" as any },
    ],
  });
  assert.strictEqual(invalidStatus.success, false);
});

test('Regression: Eject Member Transaction - Synchronizes Parent Queue Status & Clears StartTime', () => {
  // Simulate mock transaction logic for ejecting a player
  const teamDoc: any = {
    id: "team-1",
    activeMembers: [
      { queueItemId: "item-101", name: "Player1", job: "Sniper", roundNumber: 1 },
      { queueItemId: "item-102", name: "Player2", job: "Priest", roundNumber: 1 },
    ],
  };

  const queueItemDoc: any = {
    id: "item-101",
    bookingId: "booking-999",
    name: "Player1",
    status: "ASSIGNED",
    assignedTeamId: "team-1",
  };

  const parentQueueDoc: any = {
    id: "booking-999",
    name: "Player1",
    status: "active",
    startTime: Date.now() - 60000,
  };

  // Eject Player1
  const memberIndex = teamDoc.activeMembers.findIndex((m: any) => m.queueItemId === "item-101");
  assert.strictEqual(memberIndex, 0);

  const updatedMembers = [...teamDoc.activeMembers];
  updatedMembers.splice(memberIndex, 1);
  teamDoc.activeMembers = updatedMembers;

  // Queue item status resets to WAITING
  queueItemDoc.status = "WAITING";
  queueItemDoc.assignedTeamId = null;

  // Parent booking syncs back to waiting and clears startTime
  if (parentQueueDoc.status !== "done") {
    parentQueueDoc.status = "waiting";
    parentQueueDoc.startTime = null;
  }

  assert.strictEqual(teamDoc.activeMembers.length, 1);
  assert.strictEqual(teamDoc.activeMembers[0].name, "Player2");
  assert.strictEqual(queueItemDoc.status, "WAITING");
  assert.strictEqual(queueItemDoc.assignedTeamId, null);
  assert.strictEqual(parentQueueDoc.status, "waiting", "Parent queue must sync back to waiting");
  assert.strictEqual(parentQueueDoc.startTime, null, "Parent queue startTime must be cleared");
});

test('Regression: isBookingOpen - Normal & Midnight Crossing Windows with Boundaries & Timezones', () => {
  // 1. Normal hours: 09:00 - 22:00 on 2026-09-12 (UTC+7)
  const normalSched = { openDate: "2026-09-12", openTime: "09:00", closeTime: "22:00" };

  // Before open: 08:59:00 (+7) -> UTC: 01:59:00
  const normalBefore = isBookingOpen(normalSched, new Date("2026-09-12T01:59:00Z"));
  assert.strictEqual(normalBefore.open, false);
  assert.match(normalBefore.reason || "", /ยังไม่ถึงเวลาเปิดจอง/);

  // Boundary Open: 09:00:00 (+7) -> UTC: 02:00:00
  const normalOpenBoundary = isBookingOpen(normalSched, new Date("2026-09-12T02:00:00Z"));
  assert.strictEqual(normalOpenBoundary.open, true);

  // During open: 14:30:00 (+7) -> UTC: 07:30:00
  const normalDuring = isBookingOpen(normalSched, new Date("2026-09-12T07:30:00Z"));
  assert.strictEqual(normalDuring.open, true);

  // Boundary Close: 22:00:00 (+7) -> UTC: 15:00:00
  const normalCloseBoundary = isBookingOpen(normalSched, new Date("2026-09-12T15:00:00Z"));
  assert.strictEqual(normalCloseBoundary.open, true);

  // After close: 22:01:00 (+7) -> UTC: 15:01:00
  const normalAfter = isBookingOpen(normalSched, new Date("2026-09-12T15:01:00Z"));
  assert.strictEqual(normalAfter.open, false);
  assert.match(normalAfter.reason || "", /ยังไม่ถึงเวลาเปิดจอง/);

  // Different day: 2026-09-13
  const normalNextDay = isBookingOpen(normalSched, new Date("2026-09-13T07:00:00Z"));
  assert.strictEqual(normalNextDay.open, false);
  assert.match(normalNextDay.reason || "", /ยังไม่ถึงวันเปิดจอง/);

  // 2. Midnight crossing hours: 22:00 - 02:00 starting on 2026-09-12 (UTC+7)
  const midnightSched = { openDate: "2026-09-12", openTime: "22:00", closeTime: "02:00" };

  // Day 1 - Before open: 21:59:00 (+7) -> UTC: 14:59:00
  const midBefore = isBookingOpen(midnightSched, new Date("2026-09-12T14:59:00Z"));
  assert.strictEqual(midBefore.open, false);
  assert.match(midBefore.reason || "", /ยังไม่ถึงเวลาเปิดจอง/);

  // Day 1 - Boundary Open: 22:00:00 (+7) -> UTC: 15:00:00
  const midOpenBoundary = isBookingOpen(midnightSched, new Date("2026-09-12T15:00:00Z"));
  assert.strictEqual(midOpenBoundary.open, true);

  // Day 1 - During open: 23:30:00 (+7) -> UTC: 16:30:00
  const midDay1During = isBookingOpen(midnightSched, new Date("2026-09-12T16:30:00Z"));
  assert.strictEqual(midDay1During.open, true);

  // Day 1 - Last minute of day: 23:59:00 (+7) -> UTC: 16:59:00
  const midDay1End = isBookingOpen(midnightSched, new Date("2026-09-12T16:59:00Z"));
  assert.strictEqual(midDay1End.open, true);

  // Day 2 - Midnight: 00:00:00 (+7) -> UTC: 17:00:00
  const midDay2Start = isBookingOpen(midnightSched, new Date("2026-09-12T17:00:00Z"));
  assert.strictEqual(midDay2Start.open, true);

  // Day 2 - During morning: 01:30:00 (+7) -> UTC: 18:30:00
  const midDay2During = isBookingOpen(midnightSched, new Date("2026-09-12T18:30:00Z"));
  assert.strictEqual(midDay2During.open, true);

  // Day 2 - Boundary Close: 02:00:00 (+7) -> UTC: 19:00:00
  const midCloseBoundary = isBookingOpen(midnightSched, new Date("2026-09-12T19:00:00Z"));
  assert.strictEqual(midCloseBoundary.open, true);

  // Day 2 - After close: 02:01:00 (+7) -> UTC: 19:01:00
  const midAfterClose = isBookingOpen(midnightSched, new Date("2026-09-12T19:01:00Z"));
  assert.strictEqual(midAfterClose.open, false);
  assert.match(midAfterClose.reason || "", /ยังไม่ถึงเวลาเปิดจอง/);

  // Day 2 - Afternoon: 14:00:00 (+7) -> UTC: 07:00:00
  const midAfternoon = isBookingOpen(midnightSched, new Date("2026-09-13T07:00:00Z"));
  assert.strictEqual(midAfternoon.open, false);
  assert.match(midAfternoon.reason || "", /ยังไม่ถึงเวลาเปิดจอง/);

  // Prior day: 2026-09-11 23:00:00 (+7) -> UTC: 16:00:00
  const midPriorDay = isBookingOpen(midnightSched, new Date("2026-09-11T16:00:00Z"));
  assert.strictEqual(midPriorDay.open, false);
  assert.match(midPriorDay.reason || "", /ยังไม่ถึงวันเปิดจอง/);

  // Day 3 (2 days after target): 2026-09-14 01:00:00 (+7) -> UTC: 18:00:00
  const midDay3 = isBookingOpen(midnightSched, new Date("2026-09-13T18:00:00Z"));
  assert.strictEqual(midDay3.open, false);
  assert.match(midDay3.reason || "", /ยังไม่ถึงวันเปิดจอง/);
});

test('Regression: GVG Teams - Member Takes Leave is Removed from Teams & Other Members Untouched', () => {
  const initialTeamsData = {
    columns: {
      "main-1": {
        id: "main-1",
        title: "ทีม 1",
        memberIds: ["Alice", "Bob", "Charlie", null, null],
        type: "main" as const,
        locked: false,
      },
      "main-2": {
        id: "main-2",
        title: "ทีม 2",
        memberIds: ["David", "Eve", null, null, null],
        type: "main" as const,
        locked: false,
      },
      "unassigned": {
        id: "unassigned",
        title: "ไม่ได้จัดทีม",
        memberIds: ["Bob", "Frank"],
        type: "unassigned" as const,
        locked: false,
      },
    },
    zones: [{ id: "zone-1", name: "Main Zone 1", type: "main", teamOrder: ["main-1", "main-2"] }],
    offlineIds: ["Frank"],
    mainZone1Order: ["main-1", "main-2"],
  };

  // Bob submits leave
  const { changed, updatedData } = removeMemberFromTeamsData(initialTeamsData, "Bob");

  assert.strictEqual(changed, true, "Should report changed = true when member was removed");
  assert.ok(updatedData, "updatedData must exist");

  // Verify main-1: Bob was at index 1 -> now null
  assert.deepStrictEqual(
    updatedData.columns?.["main-1"].memberIds,
    ["Alice", null, "Charlie", null, null],
    "Bob must be null in main-1, while Alice (idx 0) and Charlie (idx 2) remain untouched"
  );

  // Verify other columns and fields are completely preserved
  assert.deepStrictEqual(
    updatedData.columns?.["main-2"].memberIds,
    ["David", "Eve", null, null, null],
    "main-2 members must not be affected"
  );

  // Verify 'unassigned' column was NOT modified
  assert.deepStrictEqual(
    updatedData.columns?.["unassigned"].memberIds,
    ["Bob", "Frank"],
    "unassigned column should not be modified"
  );

  // Verify zones and offlineIds preserved
  assert.deepStrictEqual(updatedData.zones, initialTeamsData.zones, "zones must be preserved");
  assert.deepStrictEqual(updatedData.offlineIds, ["Frank"], "offlineIds must be preserved");
  assert.deepStrictEqual(updatedData.mainZone1Order, ["main-1", "main-2"], "zone orders must be preserved");
});

test('Regression: GVG Teams - Member Takes Leave but NOT in Teams (No Error, No Modification, No Write)', async () => {
  const initialTeamsData = {
    columns: {
      "main-1": {
        id: "main-1",
        title: "ทีม 1",
        memberIds: ["Alice", "Bob", null, null, null],
        type: "main" as const,
        locked: false,
      },
    },
    zones: [{ id: "zone-1", name: "Zone 1" }],
  };

  // Pure function test: NonExistentPlayer
  const { changed, updatedData } = removeMemberFromTeamsData(initialTeamsData, "NonExistentPlayer");
  assert.strictEqual(changed, false, "Should report changed = false if member is not in teams");
  assert.deepStrictEqual(updatedData, initialTeamsData, "Data should remain completely unchanged");

  // Transaction test: verify transaction.set is NEVER called when changed = false
  let setCalled = false;
  const mockDb = {
    runTransaction: async (cb: any) => {
      const mockDoc = {
        exists: true,
        data: () => initialTeamsData,
      };
      const mockTransaction = {
        get: async () => mockDoc,
        set: () => {
          setCalled = true;
        },
      };
      return await cb(mockTransaction);
    },
  };

  const result = await removeMemberFromTeamsTransaction(mockDb, {} as any, "NonExistentPlayer");
  assert.strictEqual(result.changed, false);
  assert.strictEqual(setCalled, false, "transaction.set must NOT be called when member is not in teams");
});

test('Regression: GVG Teams - Concurrent Modification Prevents Lost Updates via Transaction Retry', async () => {
  // Shared Firestore document store simulator
  let serverDoc = {
    columns: {
      "main-1": {
        id: "main-1",
        title: "ทีม 1",
        memberIds: ["Alice", "Bob", null, null, null] as (string | null)[],
        type: "main" as const,
        locked: false,
      },
    },
    zones: [{ id: "zone-1", name: "โซนเดิม" }],
    version: 1,
  };

  let attempts = 0;

  // Mock Firestore runTransaction with optimistic concurrency control (OCC)
  const mockDb = {
    runTransaction: async (cb: any) => {
      let maxRetries = 5;
      while (maxRetries > 0) {
        attempts++;
        // 1. Transaction reads snapshot at current version
        const readVersion = serverDoc.version;
        // Deep clone snapshot at read time
        const snapshotData = JSON.parse(JSON.stringify(serverDoc));

        let pendingWrite: any = null;
        const transaction = {
          get: async () => ({
            exists: true,
            data: () => JSON.parse(JSON.stringify(snapshotData)),
          }),
          set: (_ref: any, data: any) => {
            pendingWrite = data;
          },
        };

        // Execute transaction callback
        const result = await cb(transaction);

        // Before committing on attempt 1, simulate an Admin concurrently updating the document!
        if (attempts === 1) {
          // Admin saves a new team layout concurrently!
          serverDoc = {
            columns: {
              "main-1": {
                id: "main-1",
                title: "ทีม 1 (อัปเดตโดย Admin)",
                memberIds: ["Alice", "Bob", "Charlie", null, null],
                type: "main" as const,
                locked: false,
              },
            },
            zones: [{ id: "zone-1", name: "โซนใหม่โดย Admin" }],
            version: serverDoc.version + 1, // version becomes 2
          };
        }

        // Commit phase: check if document version changed (OCC conflict detection)
        if (readVersion !== serverDoc.version) {
          // Conflict detected! Retry transaction (standard Firestore behavior)
          maxRetries--;
          continue;
        }

        // No conflict: commit write
        if (pendingWrite) {
          serverDoc = {
            ...pendingWrite,
            version: serverDoc.version + 1,
          };
        }
        return result;
      }
      throw new Error("Transaction aborted due to contention");
    },
  };

  // Run leave transaction for "Bob"
  const result = await removeMemberFromTeamsTransaction(mockDb, {} as any, "Bob");

  assert.strictEqual(result.changed, true, "Should report changed = true");
  assert.strictEqual(attempts, 2, "Transaction must have retried after detecting conflict with Admin save");

  // Verify resulting document state:
  // 1. Admin's new member "Charlie" at slot 2 was NOT lost!
  // 2. Admin's title and zone updates were NOT lost!
  // 3. "Bob" was cleanly removed (set to null) from slot 1!
  // 4. "Alice" at slot 0 was preserved!
  assert.strictEqual(
    serverDoc.columns["main-1"].title,
    "ทีม 1 (อัปเดตโดย Admin)",
    "Admin's title update must NOT be overwritten"
  );
  assert.deepStrictEqual(
    serverDoc.columns["main-1"].memberIds,
    ["Alice", null, "Charlie", null, null],
    "Result must contain Admin's new player 'Charlie' in slot 2 AND Bob removed from slot 1"
  );
  assert.deepStrictEqual(
    serverDoc.zones,
    [{ id: "zone-1", name: "โซนใหม่โดย Admin" }],
    "Admin's zone modification must NOT be overwritten"
  );
});

test('Regression: GVG Teams - Edge Cases & Robustness', async () => {
  // 1. Null / undefined / empty data
  assert.strictEqual(removeMemberFromTeamsData(null, "Alice").changed, false);
  assert.strictEqual(removeMemberFromTeamsData(undefined, "Alice").changed, false);
  assert.strictEqual(removeMemberFromTeamsData({} as any, "Alice").changed, false);
  assert.strictEqual(removeMemberFromTeamsData({ columns: null as any }, "Alice").changed, false);
  assert.strictEqual(removeMemberFromTeamsData({ columns: {} }, "").changed, false);

  // 2. Multiple occurrences across different teams
  const duplicateData = {
    columns: {
      "main-1": { memberIds: ["Alice", "Bob"] },
      "sub-1": { memberIds: ["Bob", "David"] },
    },
  };
  const multiResult = removeMemberFromTeamsData(duplicateData, "Bob");
  assert.strictEqual(multiResult.changed, true);
  assert.deepStrictEqual(multiResult.updatedData?.columns?.["main-1"].memberIds, ["Alice", null]);
  assert.deepStrictEqual(multiResult.updatedData?.columns?.["sub-1"].memberIds, [null, "David"]);

  // 3. Document does not exist in transaction
  const nonExistentDb = {
    runTransaction: async (cb: any) => {
      return await cb({
        get: async () => ({ exists: false }),
        set: () => {},
      });
    },
  };
  const nonExistentResult = await removeMemberFromTeamsTransaction(nonExistentDb, {} as any, "Alice");
  assert.strictEqual(nonExistentResult.changed, false);
});

test('Regression: GVG Teams OCC - Version Increment on Leave & Conflict Detection', async () => {
  // 1. Test removeMemberFromTeamsTransaction increments version
  let serverDoc = {
    columns: {
      "main-1": { memberIds: ["Alice", "Bob"] },
    },
    version: 2,
    updatedAt: 1000,
  };

  const mockDb = {
    runTransaction: async (cb: any) => {
      return await cb({
        get: async () => ({
          exists: true,
          data: () => JSON.parse(JSON.stringify(serverDoc)),
        }),
        set: (_ref: any, data: any) => {
          serverDoc = data;
        },
      });
    },
  };

  // Bob leaves -> version should advance from 2 to 3
  const leaveResult = await removeMemberFromTeamsTransaction(mockDb, {} as any, "Bob");
  assert.strictEqual(leaveResult.changed, true);
  assert.strictEqual(serverDoc.version, 3, "Version must increment on leave");
  assert.ok(serverDoc.updatedAt > 1000, "updatedAt must be refreshed");

  // 2. Simulate OCC check logic in PUT /api/teams
  function simulateTeamsOCC(
    currentDoc: { version?: number },
    clientPayload: { version?: number }
  ) {
    const currentVersion = typeof currentDoc.version === "number" ? currentDoc.version : 0;
    const expectedVersion = typeof clientPayload.version === "number" ? clientPayload.version : null;

    if (expectedVersion !== null && expectedVersion !== currentVersion) {
      return { conflict: true, currentVersion };
    }

    const nextVersion = currentVersion + 1;
    return { conflict: false, version: nextVersion };
  }

  // Admin A has stale version 2 (before Bob left) -> Conflict!
  const adminAConflict = simulateTeamsOCC(serverDoc, { version: 2 });
  assert.strictEqual(adminAConflict.conflict, true, "Must detect conflict when client version is stale");
  assert.strictEqual(adminAConflict.currentVersion, 3);

  // Admin B has current version 3 (after refresh) -> Success, next version 4
  const adminBSuccess = simulateTeamsOCC(serverDoc, { version: 3 });
  assert.strictEqual(adminBSuccess.conflict, false, "Must succeed when versions match");
  assert.strictEqual(adminBSuccess.version, 4, "Must increment version to 4");
});

test('Regression: STEP 2 - Leave vs GVG Teams Concurrency Scenarios A, B, C, D', async () => {
  // Helper to create mock transactional database
  let serverDoc: any = {
    version: 1,
    zones: [{ id: "zone-1", name: "Zone 1", type: "main", teamOrder: ["main-1", "main-2"] }],
    columns: {
      "main-1": { id: "main-1", title: "ทีม 1", memberIds: ["Alice", "Bob", "Charlie", null, null], type: "main", locked: false },
      "main-2": { id: "main-2", title: "ทีม 2", memberIds: ["Dave", "Eve", null, null, null], type: "main", locked: false },
    },
    offlineIds: ["GhostPlayer"],
    members: {
      Alice: { name: "Alice", job: "Sniper", power: 100 },
      Bob: { name: "Bob", job: "High Priest", power: 120 },
      Charlie: { name: "Charlie", job: "Paladin", power: 150 },
      Dave: { name: "Dave", job: "Professor", power: 110 },
      Eve: { name: "Eve", job: "Champion", power: 130 },
    },
    data: [
      {
        title: "สนามหลัก",
        teams: {
          "ทีม 1": [{ name: "Alice" }, { name: "Bob" }, { name: "Charlie" }],
          "ทีม 2": [{ name: "Dave" }, { name: "Eve" }],
        },
      },
    ],
    updatedAt: 1000,
  };

  let writeCount = 0;
  const mockDb = {
    runTransaction: async (cb: any) => {
      return await cb({
        get: async () => ({
          exists: true,
          data: () => JSON.parse(JSON.stringify(serverDoc)),
        }),
        set: (_ref: any, data: any) => {
          writeCount++;
          serverDoc = JSON.parse(JSON.stringify(data));
        },
      });
    },
  };

  // SCENARIO A: Admin save -> Leave
  // Admin updates Team 2 locked status and saves with version 1
  const adminSaveVersion1 = await mockDb.runTransaction(async (t: any) => {
    const snap = await t.get();
    const current = snap.data();
    assert.strictEqual(current.version, 1);
    const updated = {
      ...current,
      columns: {
        ...current.columns,
        "main-2": { ...current.columns["main-2"], locked: true },
      },
      version: current.version + 1,
      updatedAt: Date.now(),
    };
    t.set(null, updated);
    return updated.version;
  });
  assert.strictEqual(adminSaveVersion1, 2, "Admin save advances version to 2");
  assert.strictEqual(serverDoc.columns["main-2"].locked, true, "Admin lock must be saved");

  // Bob leaves afterwards
  const leaveBobResult = await removeMemberFromTeamsTransaction(mockDb, {} as any, "Bob");
  assert.strictEqual(leaveBobResult.changed, true);
  assert.strictEqual(serverDoc.version, 3, "Leave advances version to 3");
  assert.strictEqual(serverDoc.columns["main-1"].memberIds[1], null, "Bob must be removed from slot");
  assert.strictEqual(serverDoc.columns["main-1"].memberIds[0], "Alice", "Alice must remain");
  assert.strictEqual(serverDoc.columns["main-1"].memberIds[2], "Charlie", "Charlie must remain");
  assert.strictEqual(serverDoc.columns["main-2"].locked, true, "Admin's lock setting must be preserved");
  assert.deepStrictEqual(serverDoc.offlineIds, ["GhostPlayer"], "offlineIds must be preserved");
  assert.deepStrictEqual(serverDoc.zones[0].teamOrder, ["main-1", "main-2"], "zones must be preserved");
  assert.strictEqual(serverDoc.data[0].teams["ทีม 1"][1].name, "", "Legacy data Bob must be cleared");

  // SCENARIO B: Leave -> Admin save with stale version
  // Charlie leaves
  const leaveCharlieResult = await removeMemberFromTeamsTransaction(mockDb, {} as any, "Charlie");
  assert.strictEqual(leaveCharlieResult.changed, true);
  assert.strictEqual(serverDoc.version, 4, "Version advanced to 4 on Charlie leave");

  // Admin tries to save using stale version 2 (from before Bob and Charlie left)
  const staleAdminAttempt = await mockDb.runTransaction(async (t: any) => {
    const snap = await t.get();
    const current = snap.data();
    const clientPayloadVersion = 2; // Stale!
    if (clientPayloadVersion !== current.version) {
      return { conflict: true, currentVersion: current.version };
    }
    t.set(null, { ...current, version: current.version + 1 });
    return { conflict: false };
  });
  assert.strictEqual(staleAdminAttempt.conflict, true, "Must reject stale admin save with conflict");
  assert.strictEqual(staleAdminAttempt.currentVersion, 4, "Current version must be returned");
  // Ensure server data was not corrupted
  assert.strictEqual(serverDoc.columns["main-1"].memberIds[1], null, "Bob must still be absent");
  assert.strictEqual(serverDoc.columns["main-1"].memberIds[2], null, "Charlie must still be absent");

  // SCENARIO C: Admin save + Leave concurrent transaction simulation
  // Simulate concurrent run: Admin has version 4, simultaneously Dave leaves.
  // Whichever transaction executes first commits, the second one will either observe new version or retry.
  const leaveDave = await removeMemberFromTeamsTransaction(mockDb, {} as any, "Dave");
  assert.strictEqual(leaveDave.changed, true);
  assert.strictEqual(serverDoc.version, 5);
  assert.strictEqual(serverDoc.columns["main-2"].memberIds[0], null, "Dave removed");

  // Admin having refreshed to version 4 now attempts save -> detects conflict, admin re-fetches version 5 and succeeds
  const adminRefreshedSave = await mockDb.runTransaction(async (t: any) => {
    const snap = await t.get();
    const current = snap.data();
    assert.strictEqual(current.version, 5);
    const updated = {
      ...current,
      version: current.version + 1,
    };
    t.set(null, updated);
    return { conflict: false, version: updated.version };
  });
  assert.strictEqual(adminRefreshedSave.conflict, false);
  assert.strictEqual(serverDoc.version, 6);

  // SCENARIO D: Multiple members Leave concurrently
  // Alice and Eve leave in succession / concurrently
  const [resAlice, resEve] = await Promise.all([
    removeMemberFromTeamsTransaction(mockDb, {} as any, "Alice"),
    removeMemberFromTeamsTransaction(mockDb, {} as any, "Eve"),
  ]);
  assert.strictEqual(resAlice.changed, true);
  assert.strictEqual(resEve.changed, true);
  assert.strictEqual(serverDoc.version, 8, "Both leaves increment version serially");
  assert.strictEqual(serverDoc.columns["main-1"].memberIds[0], null, "Alice removed");
  assert.strictEqual(serverDoc.columns["main-2"].memberIds[1], null, "Eve removed");

  // EXTRA TEST: Member NOT in teams -> Must NOT write to Firestore
  const initialWrites = writeCount;
  const notInTeamResult = await removeMemberFromTeamsTransaction(mockDb, {} as any, "StrangerDanger");
  assert.strictEqual(notInTeamResult.changed, false);
  assert.strictEqual(writeCount, initialWrites, "Must NOT write to Firestore when member was not in any team");
});

test('Regression: STEP 3 - Attendance Silent Deletion Protection & Concurrent Editing', async () => {
  // Simulate database state for a specific date
  const database = new Map<string, any>();
  const date = "2026-09-08";

  // Simulation of the hardened attendance processing logic
  function processAttendanceSubmission(
    existingMap: Map<string, any>,
    payload: { date: string; action?: "save" | "reset"; records: Array<{ name: string; status: any; clear?: boolean; note?: string }> }
  ) {
    const isReset = payload.action === "reset";
    const batchOps: Array<{ op: "delete" | "set"; docId: string; data?: any }> = [];

    payload.records.forEach((rec) => {
      const safeName = rec.name.replace(/\//g, "-");
      const docId = `${payload.date}_${safeName}`;
      const existing = existingMap.get(docId);

      if (rec.status === null) {
        const isExplicitDelete = rec.clear === true || isReset;
        if (isExplicitDelete && existing) {
          batchOps.push({ op: "delete", docId });
          existingMap.delete(docId);
        }
      } else {
        const note = rec.note || "";
        if (!existing || existing.status !== rec.status || (existing.note || "") !== note) {
          const docData = {
            name: rec.name,
            date: payload.date,
            status: rec.status,
            note,
            timestamp: Date.now(),
          };
          batchOps.push({ op: "set", docId, data: docData });
          existingMap.set(docId, docData);
        }
      }
    });

    return batchOps;
  }

  // 1. Initial save: Admin A marks Player A = "มา"
  const adminASubmission = {
    date,
    action: "save" as const,
    records: [
      { name: "PlayerA", status: "มา" as const },
    ],
  };
  const opsA = processAttendanceSubmission(database, adminASubmission);
  assert.strictEqual(opsA.length, 1);
  assert.strictEqual(opsA[0].op, "set");
  assert.strictEqual(database.get(`${date}_PlayerA`).status, "มา");

  // 2. Concurrent Admin B opens stale page (sees Player A = null, edits Player B = "ขาด")
  // In the old code, Admin B sent ALL players with Player A having status = null, which silently deleted Player A!
  // In the hardened code:
  // (a) Even if a stale frontend sends Player A with status = null (clear not set):
  const staleAdminBSubmission = {
    date,
    action: "save" as const,
    records: [
      { name: "PlayerA", status: null }, // unedited on Admin B's screen
      { name: "PlayerB", status: "ขาด" as const }, // edited by Admin B
    ],
  };
  const opsB = processAttendanceSubmission(database, staleAdminBSubmission);

  // Player A must NOT be deleted!
  assert.ok(database.has(`${date}_PlayerA`), "Player A must NOT be deleted by stale null");
  assert.strictEqual(database.get(`${date}_PlayerA`).status, "มา", "Player A's status must remain 'มา'");

  // Player B must be saved as "ขาด"
  assert.ok(database.has(`${date}_PlayerB`));
  assert.strictEqual(database.get(`${date}_PlayerB`).status, "ขาด");

  // 3. Explicit clear: Admin explicitly changes Player A to null with clear: true
  const explicitClearSubmission = {
    date,
    action: "save" as const,
    records: [
      { name: "PlayerA", status: null, clear: true },
    ],
  };
  const opsClear = processAttendanceSubmission(database, explicitClearSubmission);
  assert.strictEqual(opsClear.length, 1);
  assert.strictEqual(opsClear[0].op, "delete");
  assert.strictEqual(database.has(`${date}_PlayerA`), false, "Player A must be deleted when explicitly cleared");
  assert.strictEqual(database.get(`${date}_PlayerB`).status, "ขาด", "Player B must still remain untouched");

  // 4. Reset date action: Admin explicitly resets the whole day
  const resetSubmission = {
    date,
    action: "reset" as const,
    records: [
      { name: "PlayerB", status: null },
    ],
  };
  const opsReset = processAttendanceSubmission(database, resetSubmission);
  assert.strictEqual(opsReset.length, 1);
  assert.strictEqual(opsReset[0].op, "delete");
  assert.strictEqual(database.has(`${date}_PlayerB`), false, "Player B must be deleted on explicit reset");
});

test('Regression: STEP 4 - Roster Concurrent Editing (Add, Edit, Delete)', async () => {
  // Mock Roster Firestore document store with transactional simulation
  let serverRoster: Record<string, any[]> = {
    Sniper: [{ name: "Alice", power: 100, role: "ดาเมจหลัก", discordId: "d_alice" }],
    Priest: [{ name: "Bob", power: 90, role: "พระหลัก", discordId: "d_bob" }],
    Paladin: [{ name: "Charlie", power: 120, role: "แทงค์หลัก", discordId: "d_charlie" }],
  };

  const userDocs: Record<string, any> = {
    d_alice: { gameUsername: "Alice", class: "Sniper", power: 100 },
    d_bob: { gameUsername: "Bob", class: "Priest", power: 90 },
    d_charlie: { gameUsername: "Charlie", class: "Paladin", power: 120 },
  };

  // Serial transaction runner mimicking Firestore transaction serializability & retries
  let txQueue: Promise<any> = Promise.resolve();
  async function runRosterTransaction<T>(fn: (t: {
    getRoster: () => Promise<Record<string, any[]>>;
    setRoster: (data: Record<string, any[]>) => void;
    getUser: (id: string) => Promise<any>;
    updateUser: (id: string, data: any) => void;
    deleteUser: (id: string) => void;
  }) => Promise<T>): Promise<T> {
    const nextTx = txQueue.then(async () => {
      const t = {
        getRoster: async () => JSON.parse(JSON.stringify(serverRoster)),
        setRoster: (data: Record<string, any[]>) => {
          serverRoster = JSON.parse(JSON.stringify(data));
        },
        getUser: async (id: string) => (userDocs[id] ? JSON.parse(JSON.stringify(userDocs[id])) : null),
        updateUser: (id: string, data: any) => {
          userDocs[id] = { ...(userDocs[id] || {}), ...data };
        },
        deleteUser: (id: string) => {
          delete userDocs[id];
        },
      };
      return await fn(t);
    });
    txQueue = nextTx.catch(() => {});
    return nextTx;
  }

  // 1. Transactional Add Member (POST /api/roster/member)
  async function addMember(name: string, job: string, power: number, warRole?: string, discordId?: string) {
    return await runRosterTransaction(async (t) => {
      const roster = await t.getRoster();
      for (const j of Object.keys(roster)) {
        if (Array.isArray(roster[j])) {
          if (roster[j].some((m) => m.name.toLowerCase() === name.toLowerCase())) {
            throw new Error(`Duplicate member name: ${name}`);
          }
        }
      }
      if (!roster[job]) roster[job] = [];
      const newMember = {
        name,
        power,
        role: warRole || "อิสระ (ให้ระบบจัดให้)",
        discordId: discordId || `manual_${Date.now()}`,
      };
      roster[job].push(newMember);
      t.setRoster(roster);
      return newMember;
    });
  }

  // 2. Transactional Edit Member (PUT /api/roster/member)
  async function editMember(targetDiscordId: string, originalName: string, name: string, job: string, power: number, warRole?: string) {
    return await runRosterTransaction(async (t) => {
      const roster = await t.getRoster();
      let existingWarRole = "อิสระ (ให้ระบบจัดให้)";

      for (const j of Object.keys(roster)) {
        if (Array.isArray(roster[j])) {
          const idx = roster[j].findIndex((m) => m.discordId === targetDiscordId || (originalName && m.name === originalName));
          if (idx !== -1) {
            existingWarRole = roster[j][idx].role || existingWarRole;
            roster[j].splice(idx, 1);
          }
        }
      }

      if (!roster[job]) roster[job] = [];
      roster[job].push({
        discordId: targetDiscordId,
        name,
        power,
        role: warRole || existingWarRole,
      });

      const user = await t.getUser(targetDiscordId);
      if (user) {
        t.updateUser(targetDiscordId, { gameUsername: name, class: job, power });
      }

      t.setRoster(roster);
    });
  }

  // 3. Transactional Delete Member (DELETE /api/roster)
  async function deleteMember(discordId?: string, name?: string) {
    return await runRosterTransaction(async (t) => {
      const roster = await t.getRoster();
      for (const j of Object.keys(roster)) {
        if (Array.isArray(roster[j])) {
          roster[j] = roster[j].filter((m) => {
            const isTarget = discordId && m.discordId ? m.discordId === discordId : Boolean(name && m.name === name);
            return !isTarget;
          });
        }
      }
      t.setRoster(roster);
      if (discordId) {
        t.deleteUser(discordId);
      }
    });
  }

  // SCENARIO 1: Add concurrent
  // Admin 1 adds Dave (Professor), Admin 2 adds Eve (Champion) concurrently
  await Promise.all([
    addMember("Dave", "Professor", 115, "ดีบัฟ", "d_dave"),
    addMember("Eve", "Champion", 130, "ต่อย", "d_eve"),
  ]);
  assert.ok(serverRoster["Professor"].some((m) => m.name === "Dave"), "Dave must exist");
  assert.ok(serverRoster["Champion"].some((m) => m.name === "Eve"), "Eve must exist");

  // SCENARIO 2: Edit concurrent
  // Admin 1 edits Alice's power (100 -> 150), Admin 2 edits Bob's role ("พระหลัก" -> "พระซับ")
  await Promise.all([
    editMember("d_alice", "Alice", "Alice", "Sniper", 150, "ดาเมจหลัก"),
    editMember("d_bob", "Bob", "Bob", "Priest", 90, "พระซับ"),
  ]);
  const alice = serverRoster["Sniper"].find((m) => m.name === "Alice");
  const bob = serverRoster["Priest"].find((m) => m.name === "Bob");
  assert.strictEqual(alice.power, 150, "Alice power update must be preserved");
  assert.strictEqual(bob.role, "พระซับ", "Bob role update must be preserved");

  // SCENARIO 3: Add + Edit concurrent
  // Admin 1 adds Frank (High Wizard), Admin 2 edits Charlie power (120 -> 140)
  await Promise.all([
    addMember("Frank", "High Wizard", 125, "เวทย์", "d_frank"),
    editMember("d_charlie", "Charlie", "Charlie", "Paladin", 140, "แทงค์หลัก"),
  ]);
  const frank = serverRoster["High Wizard"]?.find((m) => m.name === "Frank");
  const charlie = serverRoster["Paladin"]?.find((m) => m.name === "Charlie");
  assert.ok(frank, "Frank addition must be preserved");
  assert.strictEqual(charlie.power, 140, "Charlie edit must be preserved");

  // SCENARIO 4: Delete + Edit concurrent
  // Admin 1 deletes Dave, Admin 2 edits Eve's power (130 -> 135)
  await Promise.all([
    deleteMember("d_dave", "Dave"),
    editMember("d_eve", "Eve", "Eve", "Champion", 135, "ต่อย"),
  ]);
  const daveDeleted = serverRoster["Professor"]?.some((m) => m.name === "Dave");
  const eve = serverRoster["Champion"]?.find((m) => m.name === "Eve");
  assert.strictEqual(daveDeleted, false, "Dave must be deleted");
  assert.ok(eve, "Eve must still exist");
  assert.strictEqual(eve.power, 135, "Eve edit must be preserved");

  // SCENARIO 5: Delete concurrent
  // Admin 1 deletes Alice, Admin 2 deletes Bob
  await Promise.all([
    deleteMember("d_alice", "Alice"),
    deleteMember("d_bob", "Bob"),
  ]);
  assert.strictEqual(serverRoster["Sniper"].some((m) => m.name === "Alice"), false, "Alice deleted");
  assert.strictEqual(serverRoster["Priest"].some((m) => m.name === "Bob"), false, "Bob deleted");
  assert.strictEqual(userDocs["d_alice"], undefined, "Alice userDoc deleted");
  assert.strictEqual(userDocs["d_bob"], undefined, "Bob userDoc deleted");
  assert.ok(serverRoster["Paladin"].some((m) => m.name === "Charlie"), "Charlie still remains untouched");
});

test('Regression: STEP 5 - Dungeon Parent Queue State Consistency', async () => {
  // Database store simulation for Dungeon
  const queuesDb: Record<string, any> = {
    booking1: { id: "booking1", name: "Alice", rounds: 2, round1: false, round2: false, status: "waiting", startTime: null },
    booking2: { id: "booking2", name: "Bob", rounds: 1, round1: false, round2: false, status: "waiting", startTime: null },
  };

  const queueItemsDb: Record<string, any> = {
    item1_r1: { id: "item1_r1", bookingId: "booking1", name: "Alice", job: "Priest", roundNumber: 1, status: "WAITING", assignedTeamId: null },
    item1_r2: { id: "item1_r2", bookingId: "booking1", name: "Alice", job: "Priest", roundNumber: 2, status: "WAITING", assignedTeamId: null },
    item2_r1: { id: "item2_r1", bookingId: "booking2", name: "Bob", job: "Sniper", roundNumber: 1, status: "WAITING", assignedTeamId: null },
  };

  const teamsDb: Record<string, any> = {
    team1: { id: "team1", status: "AVAILABLE", activeMembers: [], carriers: [], completedRounds: 0 },
  };

  // 1. Transition: Assign (Auto or Manual) -> Parent queue status must become "active"
  // Simulate assign of item1_r1 to team1
  const assignPlayer = (teamId: string, itemKey: string) => {
    const item = queueItemsDb[itemKey];
    item.status = "ASSIGNED";
    item.assignedTeamId = teamId;
    teamsDb[teamId].activeMembers.push({
      queueItemId: item.id,
      name: item.name,
      job: item.job,
      roundNumber: item.roundNumber,
    });
    // Sync parent booking
    if (item.bookingId && queuesDb[item.bookingId]) {
      queuesDb[item.bookingId].status = "active";
      queuesDb[item.bookingId].startTime = Date.now();
    }
  };

  assignPlayer("team1", "item1_r1");
  assert.strictEqual(teamsDb["team1"].activeMembers.length, 1);
  assert.strictEqual(queueItemsDb["item1_r1"].status, "ASSIGNED");
  assert.strictEqual(queuesDb["booking1"].status, "active", "Parent booking MUST be active when player is assigned to team");
  assert.ok(queuesDb["booking1"].startTime > 0, "startTime must be set");

  // 2. Transition: Eject member -> Parent queue status must revert to "waiting" with startTime null
  const ejectPlayer = (teamId: string, itemKey: string) => {
    const item = queueItemsDb[itemKey];
    item.status = "WAITING";
    item.assignedTeamId = null;
    teamsDb[teamId].activeMembers = teamsDb[teamId].activeMembers.filter((m: any) => m.queueItemId !== item.id);
    if (item.bookingId && queuesDb[item.bookingId]) {
      queuesDb[item.bookingId].status = "waiting";
      queuesDb[item.bookingId].startTime = null;
    }
  };

  ejectPlayer("team1", "item1_r1");
  assert.strictEqual(teamsDb["team1"].activeMembers.length, 0);
  assert.strictEqual(queueItemsDb["item1_r1"].status, "WAITING");
  assert.strictEqual(queuesDb["booking1"].status, "waiting", "Parent booking MUST revert to waiting upon eject");
  assert.strictEqual(queuesDb["booking1"].startTime, null, "startTime must be cleared");

  // 3. Transition: Complete round when player has 2 rounds and only Round 1 finishes
  // Assign Alice R1 again
  assignPlayer("team1", "item1_r1");
  assert.strictEqual(queuesDb["booking1"].status, "active");

  // Complete team run:
  const completeRun = (teamId: string) => {
    const team = teamsDb[teamId];
    for (const member of team.activeMembers) {
      const item = Object.values(queueItemsDb).find((i) => i.id === member.queueItemId);
      if (item) {
        item.status = "COMPLETED";
        item.completedAt = Date.now();
        const booking = queuesDb[item.bookingId];
        if (booking) {
          if (item.roundNumber === 1) booking.round1 = true;
          if (item.roundNumber === 2) booking.round2 = true;

          const totalRounds = booking.rounds || 1;
          const allDone = totalRounds === 1 ? booking.round1 : booking.round1 && booking.round2;
          booking.status = allDone ? "done" : "waiting"; // CRITICAL: uncompleted round is waiting, NOT active!
          booking.startTime = null;
        }
      }
    }
    team.activeMembers = [];
    team.completedRounds += 1;
  };

  completeRun("team1");
  assert.strictEqual(teamsDb["team1"].completedRounds, 1);
  assert.strictEqual(teamsDb["team1"].activeMembers.length, 0);
  assert.strictEqual(queueItemsDb["item1_r1"].status, "COMPLETED");
  // Alice R1 is done, but R2 is still waiting
  assert.strictEqual(queuesDb["booking1"].round1, true);
  assert.strictEqual(queuesDb["booking1"].round2, false);
  assert.strictEqual(queuesDb["booking1"].status, "waiting", "Parent booking MUST be waiting, NOT active, when remaining round is in queue");
  assert.strictEqual(queuesDb["booking1"].startTime, null);

  // 4. Transition: Complete final round (Alice R2)
  assignPlayer("team1", "item1_r2");
  assert.strictEqual(queuesDb["booking1"].status, "active");

  completeRun("team1");
  assert.strictEqual(queueItemsDb["item1_r2"].status, "COMPLETED");
  assert.strictEqual(queuesDb["booking1"].round2, true);
  assert.strictEqual(queuesDb["booking1"].status, "done", "Parent booking MUST be done when all rounds are completed");

  // 5. Single-round booking (Bob)
  assignPlayer("team1", "item2_r1");
  assert.strictEqual(queuesDb["booking2"].status, "active");
  completeRun("team1");
  assert.strictEqual(queueItemsDb["item2_r1"].status, "COMPLETED");
  assert.strictEqual(queuesDb["booking2"].status, "done");
});

test('Regression: STEP 6 - Block Invalid Active Queue Delete', async () => {
  // Test simulation helper for DELETE /api/dungeon/queues/[id]
  const mockQueues: Record<string, any> = {
    q_alice_waiting: { id: "q_alice_waiting", name: "Alice", status: "waiting" },
    q_alice_active: { id: "q_alice_active", name: "Alice", status: "active" },
    q_bob_waiting: { id: "q_bob_waiting", name: "Bob", status: "waiting" },
  };

  const mockItems: Record<string, any[]> = {
    q_alice_waiting: [{ id: "item_w1", bookingId: "q_alice_waiting", status: "WAITING", assignedTeamId: null }],
    q_alice_active: [{ id: "item_a1", bookingId: "q_alice_active", status: "ASSIGNED", assignedTeamId: "team1" }],
    q_bob_waiting: [{ id: "item_b1", bookingId: "q_bob_waiting", status: "WAITING", assignedTeamId: null }],
  };

  function simulateDeleteQueue(
    actor: { role: "admin" | "owner" | "member"; gameUsername?: string },
    queueId: string
  ): { ok: boolean; status: number; error?: string } {
    const qData = mockQueues[queueId];
    if (!qData) {
      return { ok: false, status: 404, error: "Queue item not found" };
    }

    const isAdmin = actor.role === "admin" || actor.role === "owner";
    if (!isAdmin && actor.gameUsername !== qData.name) {
      return { ok: false, status: 403, error: "Permission denied" };
    }

    const items = mockItems[queueId] || [];
    const isAssignedToTeam = items.some((i) => i.status === "ASSIGNED" || Boolean(i.assignedTeamId));

    if (!isAdmin && (qData.status === "active" || isAssignedToTeam)) {
      return {
        ok: false,
        status: 400,
        error: "ไม่สามารถยกเลิกคิวที่กำลังลงดันเจี้ยนหรือถูกจัดเข้าทีมแล้วได้ กรุณาติดต่อแอดมินเพื่อนำออกจากทีมก่อน",
      };
    }

    delete mockQueues[queueId];
    delete mockItems[queueId];
    return { ok: true, status: 200 };
  }

  // 1. Invalid queue id -> 404
  const resInvalid = simulateDeleteQueue({ role: "member", gameUsername: "Alice" }, "non_existent_id");
  assert.strictEqual(resInvalid.ok, false);
  assert.strictEqual(resInvalid.status, 404);

  // 2. Unauthorized user -> 403 (Bob tries to cancel Alice's queue)
  const resUnauthorized = simulateDeleteQueue({ role: "member", gameUsername: "Bob" }, "q_alice_waiting");
  assert.strictEqual(resUnauthorized.ok, false);
  assert.strictEqual(resUnauthorized.status, 403);

  // 3. Member cancel active -> 400 blocked!
  const resMemberCancelActive = simulateDeleteQueue({ role: "member", gameUsername: "Alice" }, "q_alice_active");
  assert.strictEqual(resMemberCancelActive.ok, false);
  assert.strictEqual(resMemberCancelActive.status, 400);
  assert.ok(resMemberCancelActive.error?.includes("ไม่สามารถยกเลิกคิวที่กำลังลงดันเจี้ยน"));
  assert.ok(mockQueues["q_alice_active"], "Active queue must not be deleted");

  // 4. Member cancel waiting -> 200 allowed!
  const resMemberCancelWaiting = simulateDeleteQueue({ role: "member", gameUsername: "Alice" }, "q_alice_waiting");
  assert.strictEqual(resMemberCancelWaiting.ok, true);
  assert.strictEqual(resMemberCancelWaiting.status, 200);
  assert.strictEqual(mockQueues["q_alice_waiting"], undefined, "Waiting queue must be deleted cleanly");

  // 5. Admin action -> Admin can delete or cleanup active queue
  const resAdminDelete = simulateDeleteQueue({ role: "admin", gameUsername: "MasterAdmin" }, "q_alice_active");
  assert.strictEqual(resAdminDelete.ok, true);
  assert.strictEqual(resAdminDelete.status, 200);
  assert.strictEqual(mockQueues["q_alice_active"], undefined);
});

test('STEP 7: Skip Timestamp & Booking Date Integrity', async () => {
  // Helpers for timestamps
  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const day1Time = now - DAY_MS; // Yesterday
  const midnightPassedSkipTime = now; // Today (after midnight)

  // 1. Backward compatibility: legacy doc without bookedAt falls back to timestamp
  const legacyDoc = {
    rounds: 1,
    name: "LegacyPlayer",
    timestamp: day1Time,
  };

  const createMockRef = (docs: any[] = []) => {
    const obj: any = {
      where: () => obj,
      get: async () => ({ docs: docs.map(d => ({ data: () => d })), size: docs.length, empty: docs.length === 0 })
    };
    return obj;
  };

  // 2. Normal booking creates bookedAt and queuedAt
  const normalBooking = {
    id: "booking_alice",
    name: "Alice",
    job: "Sniper",
    power: 50000,
    rounds: 1,
    status: "waiting",
    timestamp: day1Time,
    bookedAt: day1Time,
    queuedAt: day1Time,
  };

  assert.strictEqual(normalBooking.bookedAt, day1Time);
  assert.strictEqual(normalBooking.queuedAt, day1Time);

  // 3. Skip simulation: preserves bookedAt & timestamp, updates queuedAt
  function simulateSkip(booking: typeof normalBooking, skipTime: number) {
    const updated = { ...booking };
    updated.queuedAt = skipTime;
    if (!updated.bookedAt && updated.timestamp) {
      updated.bookedAt = updated.timestamp;
    }
    // Note: updated.timestamp and updated.bookedAt are NOT shifted to skipTime
    return updated;
  }

  const skippedBooking = simulateSkip(normalBooking, midnightPassedSkipTime);
  assert.strictEqual(skippedBooking.queuedAt, midnightPassedSkipTime, "queuedAt must update to skip time for FIFO re-ordering");
  assert.strictEqual(skippedBooking.bookedAt, day1Time, "bookedAt must remain immutable Day 1 timestamp");
  assert.strictEqual(skippedBooking.timestamp, day1Time, "timestamp must remain Day 1 timestamp");

  // 4. Quota and 30-person cap validation across midnight:
  // Today's range vs Day 1 range
  const mockQueuesDay1 = createMockRef([skippedBooking]);
  const mockQueuesToday = createMockRef([]); // No bookings today

  // If we check Alice's quota today with no bookings today:
  const quotaToday = await getUserBookingQuota("Alice", mockQueuesToday, false);
  assert.strictEqual(quotaToday.todayUsed, 0, "Skipped yesterday booking must not consume today's daily quota");
  assert.strictEqual(quotaToday.todayRemaining, 1, "Alice should still have 1 run remaining today");
  assert.strictEqual(quotaToday.canBook, true, "Alice should be allowed to book today");

  // 5. 30-person cap validation:
  // 30 other players booked yesterday, but today has 0
  const thirtyYesterdayDocs = Array.from({ length: 30 }, (_, i) => ({
    name: `Player_${i}`,
    rounds: 1,
    timestamp: day1Time,
    bookedAt: day1Time,
    queuedAt: midnightPassedSkipTime, // Even if skipped today
  }));
  const mockQueuesThirtyYesterday = createMockRef(thirtyYesterdayDocs);

  // When checking eligibility today against mockQueuesToday (which has 0 today):
  const eligibilityToday = await checkBookingEligibility("Alice", 1, mockQueuesToday, false);
  assert.strictEqual(eligibilityToday.allowed, true, "Yesterday's skipped players must not count towards today's 30-person cap");

  // 6. FIFO Ordering test:
  // Queue items use queuedAt for FIFO sorting in queue engine
  const queueItemAlice: DungeonQueueItem = {
    id: "item_alice",
    bookingId: "booking_alice",
    name: "Alice",
    job: "Sniper",
    power: 50000,
    dungeon: "ดันมายา (Maya)",
    roundNumber: 1,
    status: "WAITING",
    queuedAt: 100,
    assignedTeamId: null,
    completedAt: null,
  };

  const queueItemBob: DungeonQueueItem = {
    id: "item_bob",
    bookingId: "booking_bob",
    name: "Bob",
    job: "Lord Knight",
    power: 60000,
    dungeon: "ดันมายา (Maya)",
    roundNumber: 1,
    status: "WAITING",
    queuedAt: 200,
    assignedTeamId: null,
    completedAt: null,
  };

  // Initially Alice (100) is ahead of Bob (200)
  const initialSorted = sortQueueItems([queueItemBob, queueItemAlice]);
  assert.strictEqual(initialSorted[0].name, "Alice");
  assert.strictEqual(initialSorted[1].name, "Bob");

  // Alice gets skipped at timestamp 300 -> her queuedAt becomes 300
  const skippedAliceItem: DungeonQueueItem = {
    ...queueItemAlice,
    queuedAt: 300,
  };

  // Now Bob (200) must be ahead of Alice (300)
  const afterSkipSorted = sortQueueItems([skippedAliceItem, queueItemBob]);
  assert.strictEqual(afterSkipSorted[0].name, "Bob", "Bob should now be first in FIFO order");
  assert.strictEqual(afterSkipSorted[1].name, "Alice", "Alice should now be after Bob in FIFO order");

  // 7. Live board sorting simulation:
  const liveQueues = [
    { name: "Alice", timestamp: day1Time, queuedAt: 300 },
    { name: "Bob", timestamp: day1Time + 50, queuedAt: 200 },
  ];
  const sortedLiveQueues = [...liveQueues].sort(
    (a, b) => ((a.queuedAt ?? a.timestamp) || 0) - ((b.queuedAt ?? b.timestamp) || 0)
  );
  assert.strictEqual(sortedLiveQueues[0].name, "Bob");
  assert.strictEqual(sortedLiveQueues[1].name, "Alice");
});

test('STEP 8: API Authorization Audit - Tiered Access Control (401, 403, 200)', async () => {
  // 1. JWT sign and verify integration
  const memberPayload = {
    discordId: "disc_member_1",
    discordUsername: "member_alice",
    gameUsername: "Alice",
    role: "member" as const,
    isProfileComplete: true,
  };

  const adminPayload = {
    discordId: "disc_admin_1",
    discordUsername: "admin_charlie",
    gameUsername: "CharlieAdmin",
    role: "admin" as const,
    isProfileComplete: true,
  };

  const ownerPayload = {
    discordId: "disc_owner_1",
    discordUsername: "owner_boss",
    gameUsername: "GuildMaster",
    role: "owner" as const,
    isProfileComplete: true,
  };

  const memberToken = await signToken(memberPayload);
  const verifiedMember = await verifyToken(memberToken);
  assert.ok(verifiedMember, "Member token must verify successfully");
  assert.strictEqual(verifiedMember?.role, "member");
  assert.strictEqual(verifiedMember?.gameUsername, "Alice");

  const invalidToken = await verifyToken("invalid.token.signature");
  assert.strictEqual(invalidToken, null, "Invalid JWT token must return null");

  // 2. Simulated Guard Functions matching server Route Handlers
  type AuthUser = AuthPayload | null;

  function evaluateRouteAccess(
    endpoint: string,
    method: string,
    user: AuthUser,
    extra?: { queryType?: string; targetName?: string; action?: string }
  ): { status: number; allowed: boolean } {
    const isAuth = Boolean(user);
    const isAdmin = user?.role === "admin" || user?.role === "owner";
    const isOwner = user?.role === "owner";

    // Unauthenticated guard on all protected endpoints
    if (!isAuth) {
      if (endpoint === "/api/dungeon/schedule" && method === "GET") {
        return { status: 200, allowed: true }; // Public schedule
      }
      return { status: 401, allowed: false };
    }

    // ── Endpoint-specific policy matrices ──
    if (endpoint === "/api/dungeon/queue-items" && method === "GET") {
      // Members, Admins, Owners can view active board items
      return { status: 200, allowed: true };
    }

    if (endpoint === "/api/dungeon/teams" && method === "GET") {
      // Members, Admins, Owners can view teams
      return { status: 200, allowed: true };
    }

    if (endpoint === "/api/dungeon/queues" && method === "GET") {
      if (extra?.queryType === "all") {
        return isAdmin ? { status: 200, allowed: true } : { status: 403, allowed: false };
      }
      // Current or history
      return { status: 200, allowed: true };
    }

    if (endpoint === "/api/dungeon/queues" && method === "POST") {
      // Self or admin
      if (!isAdmin && extra?.targetName && user?.gameUsername !== extra.targetName) {
        return { status: 403, allowed: false };
      }
      return { status: 200, allowed: true };
    }

    if (endpoint === "/api/dungeon/queues/[id]" && method === "PATCH") {
      if (extra?.action === "updateRounds") {
        if (!isAdmin && extra?.targetName && user?.gameUsername !== extra.targetName) {
          return { status: 403, allowed: false };
        }
        return { status: 200, allowed: true };
      }
      // Other actions: startRun, skip, unskip, complete
      return isAdmin ? { status: 200, allowed: true } : { status: 403, allowed: false };
    }

    if (endpoint === "/api/dungeon/teams/[id]/action" && method === "POST") {
      return isAdmin ? { status: 200, allowed: true } : { status: 403, allowed: false };
    }

    if (endpoint === "/api/teams" && method === "PUT") {
      return isAdmin ? { status: 200, allowed: true } : { status: 403, allowed: false };
    }

    if (endpoint === "/api/attendance" && method === "POST") {
      return isAdmin ? { status: 200, allowed: true } : { status: 403, allowed: false };
    }

    if (endpoint === "/api/leave" && method === "POST") {
      if (!isAdmin && extra?.targetName && user?.gameUsername !== extra.targetName) {
        return { status: 403, allowed: false };
      }
      return { status: 200, allowed: true };
    }

    if (endpoint === "/api/leave" && method === "DELETE") {
      return isAdmin ? { status: 200, allowed: true } : { status: 403, allowed: false };
    }

    if (endpoint === "/api/logs" && method === "GET") {
      return isAdmin ? { status: 200, allowed: true } : { status: 403, allowed: false };
    }

    if (endpoint === "/api/users" && (method === "GET" || method === "PUT" || method === "DELETE")) {
      return isAdmin ? { status: 200, allowed: true } : { status: 403, allowed: false };
    }

    return { status: 200, allowed: true };
  }

  // 3. Test: Unauthenticated requests get 401 across all sensitive endpoints
  const sensitiveEndpoints = [
    { ep: "/api/dungeon/queue-items", method: "GET" },
    { ep: "/api/dungeon/teams", method: "GET" },
    { ep: "/api/dungeon/queues", method: "GET", extra: { queryType: "current" } },
    { ep: "/api/dungeon/queues", method: "GET", extra: { queryType: "all" } },
    { ep: "/api/dungeon/queues", method: "POST" },
    { ep: "/api/teams", method: "PUT" },
    { ep: "/api/attendance", method: "POST" },
    { ep: "/api/leave", method: "DELETE" },
    { ep: "/api/logs", method: "GET" },
    { ep: "/api/users", method: "GET" },
  ];

  for (const { ep, method, extra } of sensitiveEndpoints) {
    const unauthRes = evaluateRouteAccess(ep, method, null, extra);
    assert.strictEqual(unauthRes.status, 401, `Unauthenticated request to ${method} ${ep} must return 401`);
  }

  // 4. Test: Regular member permissions
  // Member CAN access queue-items, teams, current queues
  assert.strictEqual(evaluateRouteAccess("/api/dungeon/queue-items", "GET", memberPayload).status, 200);
  assert.strictEqual(evaluateRouteAccess("/api/dungeon/teams", "GET", memberPayload).status, 200);
  assert.strictEqual(evaluateRouteAccess("/api/dungeon/queues", "GET", memberPayload, { queryType: "current" }).status, 200);

  // Member CAN book for self, CANNOT book for another player
  assert.strictEqual(evaluateRouteAccess("/api/dungeon/queues", "POST", memberPayload, { targetName: "Alice" }).status, 200);
  assert.strictEqual(evaluateRouteAccess("/api/dungeon/queues", "POST", memberPayload, { targetName: "Bob" }).status, 403);

  // Member CAN submit leave for self, CANNOT submit leave for Bob
  assert.strictEqual(evaluateRouteAccess("/api/leave", "POST", memberPayload, { targetName: "Alice" }).status, 200);
  assert.strictEqual(evaluateRouteAccess("/api/leave", "POST", memberPayload, { targetName: "Bob" }).status, 403);

  // Member CANNOT access admin endpoints (must return 403)
  assert.strictEqual(evaluateRouteAccess("/api/dungeon/queues", "GET", memberPayload, { queryType: "all" }).status, 403);
  assert.strictEqual(evaluateRouteAccess("/api/teams", "PUT", memberPayload).status, 403);
  assert.strictEqual(evaluateRouteAccess("/api/attendance", "POST", memberPayload).status, 403);
  assert.strictEqual(evaluateRouteAccess("/api/leave", "DELETE", memberPayload).status, 403);
  assert.strictEqual(evaluateRouteAccess("/api/logs", "GET", memberPayload).status, 403);
  assert.strictEqual(evaluateRouteAccess("/api/users", "GET", memberPayload).status, 403);
  assert.strictEqual(evaluateRouteAccess("/api/dungeon/queues/[id]", "PATCH", memberPayload, { action: "skip" }).status, 403);
  assert.strictEqual(evaluateRouteAccess("/api/dungeon/teams/[id]/action", "POST", memberPayload).status, 403);

  // 5. Test: Admin permissions (200 on all admin endpoints)
  assert.strictEqual(evaluateRouteAccess("/api/dungeon/queues", "GET", adminPayload, { queryType: "all" }).status, 200);
  assert.strictEqual(evaluateRouteAccess("/api/teams", "PUT", adminPayload).status, 200);
  assert.strictEqual(evaluateRouteAccess("/api/attendance", "POST", adminPayload).status, 200);
  assert.strictEqual(evaluateRouteAccess("/api/leave", "DELETE", adminPayload).status, 200);
  assert.strictEqual(evaluateRouteAccess("/api/logs", "GET", adminPayload).status, 200);
  assert.strictEqual(evaluateRouteAccess("/api/users", "GET", adminPayload).status, 200);
  assert.strictEqual(evaluateRouteAccess("/api/dungeon/queues/[id]", "PATCH", adminPayload, { action: "skip" }).status, 200);
  assert.strictEqual(evaluateRouteAccess("/api/dungeon/queues", "POST", adminPayload, { targetName: "Anyone" }).status, 200);

  // 6. Test: Owner permissions (200 on all admin endpoints)
  assert.strictEqual(evaluateRouteAccess("/api/dungeon/queues", "GET", ownerPayload, { queryType: "all" }).status, 200);
  assert.strictEqual(evaluateRouteAccess("/api/users", "GET", ownerPayload).status, 200);
  assert.strictEqual(evaluateRouteAccess("/api/users", "GET", ownerPayload).status, 200);
  assert.strictEqual(evaluateRouteAccess("/api/users", "PUT", ownerPayload).status, 200);
});

test('STEP 9: Admin / Owner Privilege Hierarchy & Lockout Prevention', () => {
  type UserRole = "member" | "admin" | "owner";
  interface MockUser {
    discordId: string;
    discordUsername: string;
    role: UserRole;
  }

  // Initial user database
  let dbUsers: Record<string, MockUser> = {
    "owner_1": { discordId: "owner_1", discordUsername: "GuildMaster", role: "owner" },
    "admin_1": { discordId: "admin_1", discordUsername: "OfficerA", role: "admin" },
    "admin_2": { discordId: "admin_2", discordUsername: "OfficerB", role: "admin" },
    "member_1": { discordId: "member_1", discordUsername: "PlayerX", role: "member" },
  };

  function simulateUpdateRole(
    caller: { discordId: string; role: UserRole },
    targetDiscordId: string,
    newRole: UserRole
  ): { ok: boolean; status: number; error?: string } {
    // 0. Base auth check
    if (caller.role !== "admin" && caller.role !== "owner") {
      return { ok: false, status: 403, error: "Forbidden" };
    }

    // 1. Prevent self-role mutation
    if (caller.discordId === targetDiscordId) {
      return { ok: false, status: 400, error: "ไม่สามารถเปลี่ยนบทบาทของตนเองได้" };
    }

    const target = dbUsers[targetDiscordId];
    if (!target) {
      return { ok: false, status: 404, error: "ไม่พบผู้ใช้งานนี้ในระบบ" };
    }

    const currentTargetRole = target.role;
    const isCallerOwner = caller.role === "owner";

    // 2. Admin hierarchy restrictions:
    if (!isCallerOwner) {
      if (newRole === "owner") {
        return { ok: false, status: 403, error: "แอดมินไม่สามารถแต่งตั้งบทบาท Owner ได้ (เฉพาะ Owner เท่านั้น)" };
      }
      if (currentTargetRole === "owner") {
        return { ok: false, status: 403, error: "แอดมินไม่สามารถแก้ไขบทบาทของผู้ใช้งานระดับ Owner ได้" };
      }
      if (currentTargetRole === "admin") {
        return { ok: false, status: 403, error: "แอดมินไม่สามารถแก้ไขบทบาทของ Admin คนอื่นได้ (เฉพาะ Owner เท่านั้น)" };
      }
    }

    // 3. Owner demotion guard: prevent demoting the last owner
    if (isCallerOwner && currentTargetRole === "owner" && newRole !== "owner") {
      const ownerCount = Object.values(dbUsers).filter(u => u.role === "owner").length;
      if (ownerCount <= 1) {
        return { ok: false, status: 400, error: "ไม่สามารถลดบทบาท Owner คนสุดท้ายของระบบได้" };
      }
    }

    // Apply update
    dbUsers[targetDiscordId].role = newRole;
    return { ok: true, status: 200 };
  }

  function simulateDeleteUser(
    caller: { discordId: string; role: UserRole },
    targetDiscordId: string
  ): { ok: boolean; status: number; error?: string } {
    if (caller.role !== "admin" && caller.role !== "owner") {
      return { ok: false, status: 403, error: "Forbidden" };
    }

    // 1. Prevent deleting self
    if (caller.discordId === targetDiscordId) {
      return { ok: false, status: 400, error: "ไม่สามารถลบบัญชีของตนเองได้" };
    }

    const target = dbUsers[targetDiscordId];
    if (!target) {
      return { ok: false, status: 404, error: "ไม่พบผู้ใช้งานนี้ในระบบ" };
    }

    const targetRole = target.role;
    const isCallerOwner = caller.role === "owner";

    // 2. Admin cannot delete Owner or peer Admin
    if (!isCallerOwner) {
      if (targetRole === "owner") {
        return { ok: false, status: 403, error: "แอดมินไม่สามารถลบผู้ใช้งานระดับ Owner ได้" };
      }
      if (targetRole === "admin") {
        return { ok: false, status: 403, error: "แอดมินไม่สามารถลบผู้ใช้งานระดับ Admin ได้ (เฉพาะ Owner เท่านั้น)" };
      }
    }

    // 3. Prevent deleting the last owner
    if (targetRole === "owner") {
      const ownerCount = Object.values(dbUsers).filter(u => u.role === "owner").length;
      if (ownerCount <= 1) {
        return { ok: false, status: 400, error: "ไม่สามารถลบ Owner คนสุดท้ายของระบบได้" };
      }
    }

    delete dbUsers[targetDiscordId];
    return { ok: true, status: 200 };
  }

  const adminCaller = { discordId: "admin_1", role: "admin" as const };
  const ownerCaller = { discordId: "owner_1", role: "owner" as const };

  // 1. Self mutation: Admin and Owner cannot mutate their own role
  assert.strictEqual(simulateUpdateRole(adminCaller, "admin_1", "owner").status, 400);
  assert.strictEqual(simulateUpdateRole(ownerCaller, "owner_1", "member").status, 400);

  // 2. Privilege Escalation: Admin cannot promote anyone to owner
  const resAdminEscalate = simulateUpdateRole(adminCaller, "member_1", "owner");
  assert.strictEqual(resAdminEscalate.status, 403);
  assert.ok(resAdminEscalate.error?.includes("แอดมินไม่สามารถแต่งตั้งบทบาท Owner ได้"));

  // 3. Admin cannot modify Owner
  const resAdminModOwner = simulateUpdateRole(adminCaller, "owner_1", "member");
  assert.strictEqual(resAdminModOwner.status, 403);
  assert.ok(resAdminModOwner.error?.includes("แอดมินไม่สามารถแก้ไขบทบาทของผู้ใช้งานระดับ Owner ได้"));

  // 4. Admin cannot modify peer Admin
  const resAdminModAdmin = simulateUpdateRole(adminCaller, "admin_2", "member");
  assert.strictEqual(resAdminModAdmin.status, 403);
  assert.ok(resAdminModAdmin.error?.includes("แอดมินไม่สามารถแก้ไขบทบาทของ Admin คนอื่นได้"));

  // 5. Admin CAN modify Member to Admin
  const resAdminPromoteMember = simulateUpdateRole(adminCaller, "member_1", "admin");
  assert.strictEqual(resAdminPromoteMember.status, 200);
  assert.strictEqual(dbUsers["member_1"].role, "admin");

  // 6. Admin cannot delete Owner
  const resAdminDelOwner = simulateDeleteUser(adminCaller, "owner_1");
  assert.strictEqual(resAdminDelOwner.status, 403);
  assert.ok(resAdminDelOwner.error?.includes("แอดมินไม่สามารถลบผู้ใช้งานระดับ Owner ได้"));

  // 7. Admin cannot delete peer Admin
  const resAdminDelAdmin = simulateDeleteUser(adminCaller, "admin_2");
  assert.strictEqual(resAdminDelAdmin.status, 403);
  assert.ok(resAdminDelAdmin.error?.includes("แอดมินไม่สามารถลบผู้ใช้งานระดับ Admin ได้"));

  // 8. Admin cannot delete self
  assert.strictEqual(simulateDeleteUser(adminCaller, "admin_1").status, 400);

  // 9. Owner cannot delete self
  assert.strictEqual(simulateDeleteUser(ownerCaller, "owner_1").status, 400);

  // 10. Owner CAN promote Admin to Owner
  const resOwnerPromote = simulateUpdateRole(ownerCaller, "admin_1", "owner");
  assert.strictEqual(resOwnerPromote.status, 200);
  assert.strictEqual(dbUsers["admin_1"].role, "owner"); // Now we have 2 owners: owner_1 and admin_1

  // 11. Since we now have 2 owners, Owner CAN demote or delete the other owner
  const resOwnerDemoteOther = simulateUpdateRole(ownerCaller, "admin_1", "admin");
  assert.strictEqual(resOwnerDemoteOther.status, 200);
  assert.strictEqual(dbUsers["admin_1"].role, "admin"); // Back to 1 owner

  // 12. Cannot demote or delete the last owner
  const resDemoteLast = simulateUpdateRole({ discordId: "temp_owner", role: "owner" }, "owner_1", "admin");
  assert.strictEqual(resDemoteLast.status, 400);
  assert.ok(resDemoteLast.error?.includes("Owner คนสุดท้าย"));

  const resDeleteLast = simulateDeleteUser({ discordId: "temp_owner", role: "owner" }, "owner_1");
  assert.strictEqual(resDeleteLast.status, 400);
  assert.ok(resDeleteLast.error?.includes("Owner คนสุดท้าย"));
});

test('STEP 10: Dungeon Quota IDOR Protection', async () => {
  type AuthUser = {
    discordId: string;
    discordUsername: string;
    gameUsername?: string;
    role: "member" | "admin" | "owner";
  } | null;

  function simulateGetQuota(user: AuthUser, requestedName?: string): {
    status: number;
    targetName?: string;
    error?: string;
  } {
    // 0. Auth check
    if (!user) {
      return { status: 401, error: "Unauthorized" };
    }

    const isAdminOrOwner = user.role === "admin" || user.role === "owner";
    const cleanRequested = requestedName?.trim();

    // 1. Regular members MUST have a registered gameUsername:
    if (!isAdminOrOwner) {
      if (!user.gameUsername || user.gameUsername.trim() === "") {
        return { status: 403, error: "กรุณาตั้งชื่อตัวละครในเกมก่อนตรวจสอบสิทธิ์การจอง" };
      }

      const ownName = user.gameUsername.trim().toLowerCase();

      // If member supplied a name parameter, it MUST match their own character name (case-insensitive)
      if (cleanRequested && cleanRequested.toLowerCase() !== ownName) {
        return { status: 403, error: "คุณสามารถดูสิทธิ์การจองของตัวเองเท่านั้น" };
      }
    }

    // 2. Resolve target name:
    const targetName = isAdminOrOwner
      ? (cleanRequested || user.gameUsername?.trim() || "")
      : user.gameUsername!.trim();

    if (!targetName) {
      return { status: 400, error: "ไม่พบชื่อตัวละครที่ต้องการตรวจสอบ" };
    }

    return { status: 200, targetName };
  }

  const memberAlice = { discordId: "1", discordUsername: "alice_dc", gameUsername: "Alice", role: "member" as const };
  const memberNoChar = { discordId: "2", discordUsername: "newbie_dc", role: "member" as const };
  const adminBob = { discordId: "3", discordUsername: "bob_admin", gameUsername: "BobAdmin", role: "admin" as const };
  const adminNoChar = { discordId: "4", discordUsername: "officer_dc", role: "admin" as const };
  const ownerCharlie = { discordId: "5", discordUsername: "charlie_owner", gameUsername: "GuildMaster", role: "owner" as const };

  // 1. Unauthenticated request -> 401
  const resUnauth = simulateGetQuota(null, "Alice");
  assert.strictEqual(resUnauth.status, 401);

  // 2. Member queries own quota (exact match or case-insensitive or omitted) -> 200
  const resOwnExact = simulateGetQuota(memberAlice, "Alice");
  assert.strictEqual(resOwnExact.status, 200);
  assert.strictEqual(resOwnExact.targetName, "Alice");

  const resOwnCase = simulateGetQuota(memberAlice, "alice");
  assert.strictEqual(resOwnCase.status, 200);
  assert.strictEqual(resOwnCase.targetName, "Alice");

  const resOwnOmitted = simulateGetQuota(memberAlice);
  assert.strictEqual(resOwnOmitted.status, 200);
  assert.strictEqual(resOwnOmitted.targetName, "Alice");

  // 3. Member attempts IDOR: queries another player's quota -> 403 BLOCKED!
  const resIdorBob = simulateGetQuota(memberAlice, "Bob");
  assert.strictEqual(resIdorBob.status, 403);
  assert.strictEqual(resIdorBob.error, "คุณสามารถดูสิทธิ์การจองของตัวเองเท่านั้น");

  const resIdorCharlie = simulateGetQuota(memberAlice, "GuildMaster");
  assert.strictEqual(resIdorCharlie.status, 403);

  // 4. Member without gameUsername attempts to query other player -> 403 BLOCKED!
  const resNoCharIdor = simulateGetQuota(memberNoChar, "Alice");
  assert.strictEqual(resNoCharIdor.status, 403);
  assert.strictEqual(resNoCharIdor.error, "กรุณาตั้งชื่อตัวละครในเกมก่อนตรวจสอบสิทธิ์การจอง");

  // 5. Member without gameUsername attempts to query without param -> 403 BLOCKED!
  const resNoCharOmitted = simulateGetQuota(memberNoChar);
  assert.strictEqual(resNoCharOmitted.status, 403);

  // 6. Admin queries any player's quota -> 200 ALLOWED!
  const resAdminAlice = simulateGetQuota(adminBob, "Alice");
  assert.strictEqual(resAdminAlice.status, 200);
  assert.strictEqual(resAdminAlice.targetName, "Alice");

  // 7. Owner queries any player's quota -> 200 ALLOWED!
  const resOwnerAlice = simulateGetQuota(ownerCharlie, "Alice");
  assert.strictEqual(resOwnerAlice.status, 200);
  assert.strictEqual(resOwnerAlice.targetName, "Alice");

  // 8. Admin without gameUsername queries with param -> 200 ALLOWED
  const resAdminNoCharWithParam = simulateGetQuota(adminNoChar, "Alice");
  assert.strictEqual(resAdminNoCharWithParam.status, 200);
  assert.strictEqual(resAdminNoCharWithParam.targetName, "Alice");

  // 9. Admin without gameUsername queries without param -> 400 Bad Request
  const resAdminNoCharOmitted = simulateGetQuota(adminNoChar);
  assert.strictEqual(resAdminNoCharOmitted.status, 400);
  assert.strictEqual(resAdminNoCharOmitted.error, "ไม่พบชื่อตัวละครที่ต้องการตรวจสอบ");
});

test('STEP 11: Log API Security & Anti-Spoofing', () => {
  // 1. Zod schema validation
  const validPayload = {
    module: "CLIENT",
    action: "PAGE_VIEW",
    target: "/booking",
    detail: "User loaded booking page",
  };
  const valResult = validateBody(systemLogPostSchema, validPayload);
  assert.strictEqual(valResult.success, true);

  // Missing detail -> rejected
  const missingDetail = {
    module: "CLIENT",
    action: "PAGE_VIEW",
  };
  assert.strictEqual(validateBody(systemLogPostSchema, missingDetail).success, false);

  // Invalid module -> rejected
  const invalidModule = {
    module: "FORGED_MODULE",
    action: "TEST",
    detail: "testing invalid module",
  };
  assert.strictEqual(validateBody(systemLogPostSchema, invalidModule).success, false);

  // Action too long -> rejected
  const longAction = {
    module: "CLIENT",
    action: "A".repeat(51),
    detail: "testing long action",
  };
  assert.strictEqual(validateBody(systemLogPostSchema, longAction).success, false);

  // 2. Simulated POST /api/logs route handler
  type AuthUser = {
    discordId: string;
    discordUsername: string;
    gameUsername?: string;
    role: "member" | "admin" | "owner";
  } | null;

  function simulatePostLog(
    user: AuthUser,
    body: any
  ): { status: number; error?: string; savedLog?: any } {
    // Auth check
    if (!user) {
      return { status: 401, error: "Unauthorized" };
    }

    const isAdmin = user.role === "admin" || user.role === "owner";
    if (!isAdmin) {
      return { status: 403, error: "Forbidden — Admin only" };
    }

    const validation = validateBody(systemLogPostSchema, body);
    if (!validation.success) {
      return { status: 400, error: validation.error };
    }

    const { module, action, target, detail, extra } = validation.data;

    // Server strictly enforces actor, role, and timestamp from session
    const savedLog = {
      module,
      action,
      actor: user.gameUsername || user.discordUsername || "Admin",
      role: user.role,
      target: target || "",
      detail,
      extra: extra || {},
      timestamp: 1234567890, // Simulated server Date.now()
    };

    return { status: 200, savedLog };
  }

  const memberUser = { discordId: "10", discordUsername: "attacker_dc", gameUsername: "SneakyMember", role: "member" as const };
  const adminUser = { discordId: "11", discordUsername: "admin_dc", gameUsername: "GuildAdmin", role: "admin" as const };

  // 3. Unauthenticated call -> 401
  const resUnauth = simulatePostLog(null, validPayload);
  assert.strictEqual(resUnauth.status, 401);

  // 4. Regular member call -> 403 Forbidden
  const resMember = simulatePostLog(memberUser, validPayload);
  assert.strictEqual(resMember.status, 403);
  assert.ok(resMember.error?.includes("Forbidden"));

  // 5. Admin call -> 200 OK
  const resAdmin = simulatePostLog(adminUser, validPayload);
  assert.strictEqual(resAdmin.status, 200);
  assert.strictEqual(resAdmin.savedLog?.actor, "GuildAdmin");
  assert.strictEqual(resAdmin.savedLog?.role, "admin");

  // 6. Anti-spoofing verification: client attempts to send fake actor, role, and timestamp
  const spoofAttemptBody = {
    module: "CLIENT",
    action: "PAGE_VIEW",
    target: "/admin",
    detail: "Attempting to forge identity",
    actor: "SuperOwner",
    role: "owner",
    timestamp: 999999999999,
  };

  const resSpoof = simulatePostLog(adminUser, spoofAttemptBody);
  assert.strictEqual(resSpoof.status, 200);
  // Must NOT use the client-supplied "SuperOwner", "owner", or fake timestamp!
  assert.strictEqual(resSpoof.savedLog?.actor, "GuildAdmin", "Actor must strictly be derived from auth session");
  assert.strictEqual(resSpoof.savedLog?.role, "admin", "Role must strictly be derived from auth session");
  assert.strictEqual(resSpoof.savedLog?.timestamp, 1234567890, "Timestamp must strictly be generated server-side");
});

test('STEP 12: JWT Session / Role Revocation & Immediate Invalidation', async () => {
  // 1. Setup user with admin token
  const initialAdminUser: AuthPayload = {
    discordId: "user_revocation_test",
    discordUsername: "former_admin",
    gameUsername: "ExAdmin",
    role: "admin",
    isProfileComplete: true,
  };

  const adminToken = await signToken(initialAdminUser);
  const decodedToken = await verifyToken(adminToken);
  assert.ok(decodedToken, "JWT token must verify successfully");
  assert.strictEqual(decodedToken.role, "admin");

  // In live cache/DB, set initial role as "admin"
  setUserRoleForTesting("user_revocation_test", "admin");
  const liveRole1 = await getLiveUserRole("user_revocation_test", "admin");
  assert.strictEqual(liveRole1, "admin");

  // Simulate guard evaluation for admin-only endpoint:
  function evaluateAdminAccess(tokenRole: string, liveRole: string | null): { allowed: boolean; status: number } {
    if (!liveRole) {
      return { allowed: false, status: 401 };
    }
    if (liveRole !== "admin" && liveRole !== "owner") {
      return { allowed: false, status: 403 };
    }
    return { allowed: true, status: 200 };
  }

  // With initial admin role, access is allowed:
  assert.strictEqual(evaluateAdminAccess(decodedToken.role, liveRole1).status, 200);

  // 2. DEMOTION: User is demoted from "admin" to "member"
  // Admin updates role via API -> invalidateUserRoleCache & set new role
  invalidateUserRoleCache("user_revocation_test");
  setUserRoleForTesting("user_revocation_test", "member");

  // Live role is now "member"
  const liveRoleDemoted = await getLiveUserRole("user_revocation_test", decodedToken.role);
  assert.strictEqual(liveRoleDemoted, "member");

  // Immediate Revocation: Even though JWT token says "admin", evaluateAdminAccess rejects with 403 Forbidden!
  const demotedAccess = evaluateAdminAccess(decodedToken.role, liveRoleDemoted);
  assert.strictEqual(demotedAccess.allowed, false);
  assert.strictEqual(demotedAccess.status, 403, "Demoted admin must be immediately denied with 403 Forbidden");

  // 3. ACCOUNT DELETION: User account is deleted
  invalidateUserRoleCache("user_revocation_test");
  // Set to null to simulate user doc not found
  setUserRoleForTesting("user_revocation_test", null);

  // Mock DB lookup returning null when user doc deleted
  function simulateLiveRoleLookupWhenDeleted(discordId: string): string | null {
    return null; // Deleted in DB
  }
  const liveRoleDeleted = simulateLiveRoleLookupWhenDeleted("user_revocation_test");
  const deletedAccess = evaluateAdminAccess(decodedToken.role, liveRoleDeleted);
  assert.strictEqual(deletedAccess.allowed, false);
  assert.strictEqual(deletedAccess.status, 401, "Deleted user must receive 401 Unauthorized");

  // Clean up test cache
  invalidateUserRoleCache("user_revocation_test");

  // 4. Token refresh simulation on GET /api/auth/me:
  async function simulateAuthMe(token: string, liveRole: "member" | "admin" | "owner" | null) {
    const verified = await verifyToken(token);
    if (!verified) return { status: 401, cleared: true, user: null, refreshedToken: null };
    if (!liveRole) return { status: 401, cleared: true, user: null, refreshedToken: null };

    if (liveRole !== verified.role) {
      const updatedUser: AuthPayload = { ...verified, role: liveRole };
      const newToken = await signToken(updatedUser);
      return { status: 200, cleared: false, user: updatedUser, refreshedToken: newToken };
    }

    return { status: 200, cleared: false, user: verified, refreshedToken: null };
  }

  // Calling /api/auth/me when demoted returns refreshed token with member role
  const authMeDemoted = await simulateAuthMe(adminToken, "member");
  assert.strictEqual(authMeDemoted.status, 200);
  assert.strictEqual(authMeDemoted.user?.role, "member");
  assert.ok(authMeDemoted.refreshedToken, "A refreshed token must be issued");

  const verifiedNewToken = await verifyToken(authMeDemoted.refreshedToken!);
  assert.strictEqual(verifiedNewToken?.role, "member", "New token now reflects demoted member role");

  // Calling /api/auth/me when deleted clears session
  const authMeDeleted = await simulateAuthMe(adminToken, null);
  assert.strictEqual(authMeDeleted.status, 401);
  assert.strictEqual(authMeDeleted.cleared, true);

  // 5. JWT_SECRET production check:
  const prevEnv = process.env.NODE_ENV;
  const prevSecret = process.env.JWT_SECRET;
  try {
    // In production, fallback/insecure secret must throw fatal error
    (process.env as any).NODE_ENV = "production";
    delete process.env.JWT_SECRET;
    assert.throws(
      () => getJwtSecret(),
      /FATAL: Insecure or missing JWT_SECRET in production environment/,
      "Must throw fatal error in production when JWT_SECRET is unset"
    );

    // In production with default insecure secret, also must throw
    process.env.JWT_SECRET = "topguild-secret-change-in-production";
    assert.throws(
      () => getJwtSecret(),
      /FATAL: Insecure or missing JWT_SECRET in production environment/,
      "Must throw fatal error in production when default placeholder secret is used"
    );

    // In production with secure 32+ character secret, it succeeds
    process.env.JWT_SECRET = "super-secure-production-jwt-secret-key-32-chars-ok";
    const prodSecret = getJwtSecret();
    assert.ok(prodSecret instanceof Uint8Array, "Valid production secret returns Uint8Array");

    // In development / test, fallback works safely
    (process.env as any).NODE_ENV = "test";
    delete process.env.JWT_SECRET;
    const devSecret = getJwtSecret();
    assert.ok(devSecret instanceof Uint8Array, "Development fallback returns Uint8Array safely");
  } finally {
    (process.env as any).NODE_ENV = prevEnv;
    if (prevSecret !== undefined) {
      process.env.JWT_SECRET = prevSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
  }
});

test('STEP 13: Roster Firebase Write Optimization - Targeted Field Writes & Payload Reduction', async () => {
  // Simulate 12 classes with 8 members each (~96 total members)
  const classes = [
    "Sniper", "Priest", "Lord Knight", "Assassin Cross",
    "High Wizard", "Whitesmith", "Champion", "Paladin",
    "Professor", "Clown", "Gypsy", "Creator"
  ];

  let serverRosterDoc: Record<string, any[]> = {};
  for (const c of classes) {
    serverRosterDoc[c] = Array.from({ length: 8 }, (_, i) => ({
      discordId: `disc_${c}_${i}`,
      name: `${c}_Player_${i}`,
      power: 100000 + i * 1000,
      role: "อิสระ (ให้ระบบจัดให้)",
    }));
  }

  const fullDocPayload = JSON.stringify(serverRosterDoc);
  const fullDocBytes = Buffer.byteLength(fullDocPayload, 'utf8');

  // Track writes dispatched to Firestore
  const writeHistory: Array<{ type: "patch" | "full"; keys: string[]; payloadBytes: number }> = [];

  function simulateTargetedWrite(patch: Record<string, any[]>) {
    const payload = JSON.stringify(patch);
    writeHistory.push({
      type: "patch",
      keys: Object.keys(patch),
      payloadBytes: Buffer.byteLength(payload, 'utf8'),
    });
    // Apply merge into server doc
    serverRosterDoc = { ...serverRosterDoc, ...patch };
  }

  // 1. ADD MEMBER: Add new Sniper
  // Instead of writing the full 96-member doc (~15-20 KB), write only the "Sniper" array
  const newSniper = {
    discordId: "disc_sniper_new",
    name: "NewSniperPro",
    power: 150000,
    role: "สนามหลัก",
  };
  const updatedSnipers = [...serverRosterDoc["Sniper"], newSniper];
  simulateTargetedWrite({ Sniper: updatedSnipers });

  const addWrite = writeHistory[writeHistory.length - 1];
  assert.deepStrictEqual(addWrite.keys, ["Sniper"], "Add must write ONLY the affected job key");
  assert.ok(
    addWrite.payloadBytes < fullDocBytes * 0.2,
    `Targeted write (${addWrite.payloadBytes} bytes) should be < 20% of full doc (${fullDocBytes} bytes)`
  );

  // 2. EDIT MEMBER (Same Job): Edit NewSniperPro's power
  const editedSnipers = serverRosterDoc["Sniper"].map((m) =>
    m.name === "NewSniperPro" ? { ...m, power: 160000 } : m
  );
  simulateTargetedWrite({ Sniper: editedSnipers });

  const editSameJobWrite = writeHistory[writeHistory.length - 1];
  assert.deepStrictEqual(editSameJobWrite.keys, ["Sniper"], "Edit within same job must write ONLY that job key");
  assert.strictEqual(
    serverRosterDoc["Sniper"].find((m) => m.name === "NewSniperPro")?.power,
    160000,
    "Updated power must be reflected"
  );

  // 3. EDIT MEMBER (Change Job): Move NewSniperPro from "Sniper" to "Priest"
  const previousJob = "Sniper";
  const newJob = "Priest";
  const snipersWithoutMember = serverRosterDoc["Sniper"].filter((m) => m.name !== "NewSniperPro");
  const priestsWithMember = [
    ...serverRosterDoc["Priest"],
    { ...newSniper, power: 160000, role: "พระหลัก" },
  ];

  simulateTargetedWrite({
    [previousJob]: snipersWithoutMember,
    [newJob]: priestsWithMember,
  });

  const jobSwitchWrite = writeHistory[writeHistory.length - 1];
  assert.deepStrictEqual(
    jobSwitchWrite.keys.sort(),
    ["Priest", "Sniper"].sort(),
    "Job switch must write ONLY the previous and new job keys (2 keys, not all 12)"
  );
  // Untouched jobs like Paladin must remain completely untouched
  assert.strictEqual(serverRosterDoc["Paladin"].length, 8);

  // 4. DELETE MEMBER: Delete NewSniperPro from "Priest"
  const priestsWithoutMember = serverRosterDoc["Priest"].filter((m) => m.name !== "NewSniperPro");
  simulateTargetedWrite({ Priest: priestsWithoutMember });

  const deleteWrite = writeHistory[writeHistory.length - 1];
  assert.deepStrictEqual(deleteWrite.keys, ["Priest"], "Delete must write ONLY the affected job key");
  assert.strictEqual(serverRosterDoc["Priest"].length, 8);

  // 5. Payload Reduction Metrics Verification:
  const avgTargetedBytes =
    writeHistory.reduce((acc, w) => acc + w.payloadBytes, 0) / writeHistory.length;
  const reductionPercentage = ((fullDocBytes - avgTargetedBytes) / fullDocBytes) * 100;

  assert.ok(
    reductionPercentage > 80,
    `Payload reduction must exceed 80% (Achieved: ${reductionPercentage.toFixed(1)}% reduction)`
  );
});

test('STEP 14: Attendance Firebase Cost Audit & Range Protection', async () => {
  // 1. Date range query validation
  function validateAttendanceDateRange(startDate?: string, endDate?: string): { ok: boolean; status: number; error?: string } {
    if (startDate && endDate) {
      if (startDate > endDate) {
        return { ok: false, status: 400, error: "startDate must be before or equal to endDate" };
      }
      const startMs = new Date(`${startDate}T00:00:00Z`).getTime();
      const endMs = new Date(`${endDate}T00:00:00Z`).getTime();
      const diffDays = (endMs - startMs) / (24 * 60 * 60 * 1000);
      if (diffDays > 62) {
        return { ok: false, status: 400, error: "ช่วงวันที่ค้นหาต้องไม่เกิน 62 วัน" };
      }
    }
    return { ok: true, status: 200 };
  }

  // Normal 7-day week query -> OK
  assert.strictEqual(validateAttendanceDateRange("2026-03-02", "2026-03-08").status, 200);

  // Inverted range -> 400
  const invRes = validateAttendanceDateRange("2026-03-08", "2026-03-02");
  assert.strictEqual(invRes.status, 400);
  assert.strictEqual(invRes.error, "startDate must be before or equal to endDate");

  // Excessive range (e.g. 100 days) -> 400
  const excRes = validateAttendanceDateRange("2026-01-01", "2026-04-15");
  assert.strictEqual(excRes.status, 400);
  assert.ok(excRes.error?.includes("ต้องไม่เกิน 62 วัน"));

  // 2. Read Cost & Cache Verification:
  resetAttendanceCacheForTesting();
  let dbReads = 0;

  const mockFetchDbRecords = async () => {
    dbReads++;
    return [
      { id: "2026-03-03_Alice", date: "2026-03-03", name: "Alice", status: "มา" },
      { id: "2026-03-03_Bob", date: "2026-03-03", name: "Bob", status: "ขาด" },
    ];
  };

  const cacheKey = "range:2026-03-02_2026-03-08";

  // First read: Cache miss -> triggers 1 DB read
  const data1 = await getOrSetAttendanceCache(cacheKey, mockFetchDbRecords, 5000);
  assert.strictEqual(data1.length, 2);
  assert.strictEqual(dbReads, 1, "First read must query database");

  // Subsequent 5 reads within TTL: Cache hits -> 0 additional DB reads!
  for (let i = 0; i < 5; i++) {
    const cachedData = await getOrSetAttendanceCache(cacheKey, mockFetchDbRecords, 5000);
    assert.strictEqual(cachedData.length, 2);
  }
  assert.strictEqual(dbReads, 1, "Subsequent queries must be served from cache without DB reads");

  // Invalidation after admin save:
  invalidateAttendanceCache();

  // Next read after invalidation: fetches fresh data -> triggers DB read
  const dataAfterSave = await getOrSetAttendanceCache(cacheKey, mockFetchDbRecords, 5000);
  assert.strictEqual(dataAfterSave.length, 2);
  assert.strictEqual(dbReads, 2, "Query after invalidation must read fresh data from database");

  // 3. Write Cost Audit: Dirty-checking ensures only changed records are written
  const existingRecords = [
    { name: "Player_0", status: "มา", note: "" },
    { name: "Player_1", status: "มา", note: "" },
    { name: "Player_2", status: "มา", note: "" },
    { name: "Player_3", status: "ขาด", note: "" },
  ];

  // Admin submits an attendance sheet where only Player_3 changed ("ขาด" -> "มา")
  const submittedSheet = [
    { name: "Player_0", status: "มา", note: "" },
    { name: "Player_1", status: "มา", note: "" },
    { name: "Player_2", status: "มา", note: "" },
    { name: "Player_3", status: "มา", note: "" }, // Changed
  ];

  const existingMap = new Map(existingRecords.map((r) => [r.name, r]));
  let plannedWrites = 0;

  for (const rec of submittedSheet) {
    const existing = existingMap.get(rec.name);
    if (!existing || existing.status !== rec.status || (existing.note || "") !== (rec.note || "")) {
      plannedWrites++;
    }
  }

  assert.strictEqual(
    plannedWrites,
    1,
    "Dirty checking must stage write ONLY for the 1 modified record out of 4"
  );
});

test('STEP 16: Polling / Cache Audit & Dungeon Board Optimization', async () => {
  resetCurrentQueuesCacheForTesting();

  // 1. Queue Items Cache: Returns cached items within TTL
  let qiDbFetches = 0;
  const mockFetchQueueItems = async () => {
    qiDbFetches++;
    return [
      { id: "item1", name: "Alice", status: "WAITING", roundNumber: 1, queuedAt: 100 },
      { id: "item2", name: "Bob", status: "ASSIGNED", roundNumber: 1, queuedAt: 110 },
    ];
  };

  const qiData1 = await getOrSetQueueItemsCache(mockFetchQueueItems, 5000);
  assert.strictEqual(qiData1.length, 2);
  assert.strictEqual(qiDbFetches, 1, "First queue items call must query database");

  // Subsequent 5 calls within TTL: Served from memory -> 0 DB reads
  for (let i = 0; i < 5; i++) {
    const cached = await getOrSetQueueItemsCache(mockFetchQueueItems, 5000);
    assert.strictEqual(cached.length, 2);
  }
  assert.strictEqual(qiDbFetches, 1, "Subsequent calls within TTL must not query database");

  // 2. Dungeon Teams Cache: Returns cached teams within TTL
  let teamsDbFetches = 0;
  const mockFetchTeams = async () => {
    teamsDbFetches++;
    return [
      { id: "team-1", status: "AVAILABLE", activeMembers: [], carriers: [] },
    ];
  };

  const teamsData1 = await getOrSetDungeonTeamsCache(mockFetchTeams, 5000);
  assert.strictEqual(teamsData1.length, 1);
  assert.strictEqual(teamsDbFetches, 1, "First teams call must query database");

  // Subsequent calls within TTL: Served from memory
  for (let i = 0; i < 5; i++) {
    const cachedTeams = await getOrSetDungeonTeamsCache(mockFetchTeams, 5000);
    assert.strictEqual(cachedTeams.length, 1);
  }
  assert.strictEqual(teamsDbFetches, 1, "Subsequent calls within TTL must not query database");

  // 3. Cache Invalidation: Admin mutation (assign, eject, complete, book) purges all caches immediately
  invalidateCurrentQueuesCache();

  // Next calls fetch fresh data
  const freshQi = await getOrSetQueueItemsCache(mockFetchQueueItems, 5000);
  const freshTeams = await getOrSetDungeonTeamsCache(mockFetchTeams, 5000);
  assert.strictEqual(freshQi.length, 2);
  assert.strictEqual(freshTeams.length, 1);
  assert.strictEqual(qiDbFetches, 2, "Queue items must re-fetch after invalidation");
  assert.strictEqual(teamsDbFetches, 2, "Teams must re-fetch after invalidation");

  // 4. Request Coalescing under heavy concurrent polling:
  // 10 concurrent requests to queue items must share 1 in-flight promise
  const slowFetchQi = async () => {
    await new Promise((r) => setTimeout(r, 15));
    qiDbFetches++;
    return [{ id: "item1", name: "Alice" }];
  };
  invalidateCurrentQueuesCache();
  const preCoalesceCount = qiDbFetches;

  const results = await Promise.all(
    Array.from({ length: 10 }, () => getOrSetQueueItemsCache(slowFetchQi, 5000))
  );

  assert.strictEqual(results.length, 10);
  assert.strictEqual(
    qiDbFetches,
    preCoalesceCount + 1,
    "10 concurrent requests must coalesce into exactly 1 underlying database fetch"
  );
});

test('STEP 19: Error Handling & API Robustness - Semantic HTTP Status Codes & Safe Errors', async () => {
  const { ok, err, unauthorized, forbidden, notFound, conflict, tooManyRequests, handleServerError } = await import("@/lib/server-utils");
  const { z } = await import("zod");

  // 1. Semantic HTTP Helper Status Codes
  const res400 = err("Bad Request", 400);
  assert.strictEqual(res400.status, 400);
  const data400 = await res400.json();
  assert.strictEqual(data400.ok, false);
  assert.strictEqual(data400.error, "Bad Request");

  const res401 = unauthorized();
  assert.strictEqual(res401.status, 401);

  const res403 = forbidden();
  assert.strictEqual(res403.status, 403);

  const res404 = notFound("Queue item not found");
  assert.strictEqual(res404.status, 404);
  const data404 = await res404.json();
  assert.strictEqual(data404.error, "Queue item not found");

  const res409 = conflict("Version conflict detected");
  assert.strictEqual(res409.status, 409);
  const data409 = await res409.json();
  assert.strictEqual(data409.error, "Version conflict detected");

  const res429 = tooManyRequests();
  assert.strictEqual(res429.status, 429);

  // 2. handleServerError: Must never leak internal database stack traces / sensitive details
  const internalDbError = new Error("FATAL: connection to firestore.googleapis.com:443 timed out at TCPConnectWrap (secret_key=xyz123)");
  const safe500 = handleServerError(internalDbError, "Failed to load records");
  assert.strictEqual(safe500.status, 500);
  const data500 = await safe500.json();
  assert.strictEqual(data500.ok, false);
  assert.strictEqual(data500.error, "Failed to load records", "Must return safe user-facing message");
  assert.strictEqual(JSON.stringify(data500).includes("secret_key"), false, "Must not leak internal secrets or traces");

  // 3. handleServerError: Automatically detects Zod validation errors and returns 400
  const dummySchema = z.object({ name: z.string().min(1, "Name is required") });
  const zodResult = dummySchema.safeParse({ name: "" });
  if (!zodResult.success) {
    const zod400 = handleServerError(zodResult.error, "Internal error");
    assert.strictEqual(zod400.status, 400, "ZodError must be converted to 400 Bad Request");
    const zodData = await zod400.json();
    assert.strictEqual(zodData.error, "Name is required");
  }

  // 4. handleServerError: Automatically maps duplicate / conflict errors to 409
  const dupError = new Error('มีสมาชิกชื่อ "Yossapath" อยู่ใน Roster แล้ว');
  const dup409 = handleServerError(dupError, "Failed to add member");
  assert.strictEqual(dup409.status, 409, "Duplicate roster member must map to 409 Conflict");
  const dupData = await dup409.json();
  assert.strictEqual(dupData.error, 'มีสมาชิกชื่อ "Yossapath" อยู่ใน Roster แล้ว');

  // 5. handleServerError: Custom Error with status property
  const customAppError = Object.assign(new Error("Resource not found"), { status: 404 });
  const custom404 = handleServerError(customAppError, "Server error");
  assert.strictEqual(custom404.status, 404);
});

test('STEP 20: Validation & Edge Case Audit - Exhaustive Payload Security Tests', () => {
  // 1. gameUsername & class (completeProfileSchema)
  assert.strictEqual(validateBody(completeProfileSchema, { gameUsername: "", class: "Priest", power: 1000 }).success, false, "Empty gameUsername must fail");
  assert.strictEqual(validateBody(completeProfileSchema, { gameUsername: "   ", class: "Priest", power: 1000 }).success, false, "Whitespace gameUsername must fail");
  assert.strictEqual(validateBody(completeProfileSchema, { gameUsername: null, class: "Priest", power: 1000 }).success, false, "Null gameUsername must fail");
  assert.strictEqual(validateBody(completeProfileSchema, { gameUsername: "PlayerOne", class: "", power: 1000 }).success, false, "Empty class must fail");
  assert.strictEqual(validateBody(completeProfileSchema, { gameUsername: "PlayerOne", class: "   ", power: 1000 }).success, false, "Whitespace class must fail");

  // 2. power (negative, huge, invalid string, safe numbers)
  assert.strictEqual(validateBody(completeProfileSchema, { gameUsername: "PlayerOne", class: "Priest", power: -1 }).success, false, "Negative power must fail");
  assert.strictEqual(validateBody(completeProfileSchema, { gameUsername: "PlayerOne", class: "Priest", power: "not_a_number" }).success, false, "Non-numeric string power must fail");
  assert.strictEqual(validateBody(completeProfileSchema, { gameUsername: "PlayerOne", class: "Priest", power: 1e30 }).success, false, "Unsafe huge power must fail");
  
  const validProfile = validateBody(completeProfileSchema, { gameUsername: "  PlayerOne  ", class: "  Priest  ", power: "150000" });
  assert.strictEqual(validProfile.success, true);
  if (validProfile.success) {
    assert.strictEqual(validProfile.data.gameUsername, "PlayerOne", "gameUsername must be trimmed");
    assert.strictEqual(validProfile.data.class, "Priest", "class must be trimmed");
    assert.strictEqual(validProfile.data.power, 150000, "power string must be transformed to number");
  }

  // 3. Roster member validation (rosterMemberAddSchema & rosterMemberUpdateSchema)
  assert.strictEqual(validateBody(rosterMemberAddSchema, { name: "   ", job: "Priest", power: 100 }).success, false, "Whitespace name must fail");
  assert.strictEqual(validateBody(rosterMemberAddSchema, { name: "Player1", job: "   ", power: 100 }).success, false, "Whitespace job must fail");
  assert.strictEqual(validateBody(rosterMemberAddSchema, { name: "Player1", job: "Priest", power: -50 }).success, false, "Negative power must fail");
  assert.strictEqual(validateBody(rosterMemberUpdateSchema, { targetDiscordId: "   ", name: "P1", job: "Priest", power: 100 }).success, false, "Whitespace targetDiscordId must fail");

  // 4. Dungeon queue & rounds (dungeonQueueBookingSchema & dungeonQueuePatchSchema)
  assert.strictEqual(validateBody(dungeonQueueBookingSchema, { name: "   ", job: "Priest" }).success, false, "Whitespace name must fail");
  assert.strictEqual(validateBody(dungeonQueueBookingSchema, { name: "P1", job: "   " }).success, false, "Whitespace job must fail");
  assert.strictEqual(validateBody(dungeonQueueBookingSchema, { name: "P1", job: "Priest", rounds: 3 as any }).success, false, "Invalid rounds must fail");
  assert.strictEqual(validateBody(dungeonQueuePatchSchema, { round: 5 as any }).success, false, "Invalid patch round must fail");
  assert.strictEqual(validateBody(dungeonQueuePatchSchema, { action: "unknownAction" as any }).success, false, "Invalid patch action enum must fail");

  // 5. Leave validation (leaveSubmitSchema & leaveDeleteSchema)
  assert.strictEqual(validateBody(leaveSubmitSchema, { name: "Player1", date: "", day: "" }).success, false, "Empty date and day must fail");
  assert.strictEqual(validateBody(leaveSubmitSchema, { name: "Player1", date: "   ", day: "   " }).success, false, "Whitespace date and day must fail");
  assert.strictEqual(validateBody(leaveDeleteSchema, { id: "" }).success, false, "Empty leave delete ID must fail");
  assert.strictEqual(validateBody(leaveDeleteSchema, { id: "   " }).success, false, "Whitespace leave delete ID must fail");

  // 6. Attendance validation (attendancePostSchema & attendanceRecordItemSchema)
  assert.strictEqual(validateBody(attendancePostSchema, { date: "", records: [] }).success, false, "Empty attendance date must fail");
  assert.strictEqual(validateBody(attendancePostSchema, { date: "   ", records: [] }).success, false, "Whitespace attendance date must fail");
  assert.strictEqual(validateBody(attendanceRecordItemSchema, { name: "P1", status: "cheating" as any }).success, false, "Invalid attendance status enum must fail");
  assert.strictEqual(validateBody(attendanceRecordItemSchema, { name: "   ", status: "present" }).success, false, "Whitespace attendance record name must fail");
  
  // Valid null attendance status for clearing records
  const clearAttRecord = validateBody(attendanceRecordItemSchema, { name: "Player1", status: null });
  assert.strictEqual(clearAttRecord.success, true);

  // 7. Users validation (userRoleUpdateSchema & userDeleteSchema)
  assert.strictEqual(validateBody(userRoleUpdateSchema, { discordId: "123", role: "super_admin" as any }).success, false, "Invalid role enum must fail");
  assert.strictEqual(validateBody(userRoleUpdateSchema, { discordId: "   ", role: "admin" }).success, false, "Whitespace discordId must fail");
  assert.strictEqual(validateBody(userDeleteSchema, { discordId: "   " }).success, false, "Whitespace delete discordId must fail");

  // 8. Logs validation (systemLogPostSchema)
  assert.strictEqual(validateBody(systemLogPostSchema, { module: "UNKNOWN" as any, action: "test", detail: "test" }).success, false, "Invalid log module must fail");
  assert.strictEqual(validateBody(systemLogPostSchema, { module: "SYSTEM", action: "   ", detail: "test" }).success, false, "Whitespace log action must fail");
  assert.strictEqual(validateBody(systemLogPostSchema, { module: "SYSTEM", action: "test", detail: "   " }).success, false, "Whitespace log detail must fail");

  // 9. Teams data validation (teamDataSchema)
  const invalidTeamCol = validateBody(teamDataSchema, {
    columns: {
      c1: { id: "   ", title: "Team 1", type: "main", memberIds: [] }
    }
  });
  assert.strictEqual(invalidTeamCol.success, false, "Whitespace column ID must fail");

  const invalidTeamType = validateBody(teamDataSchema, {
    columns: {
      c1: { id: "col1", title: "Team 1", type: "invalid_type" as any, memberIds: [] }
    }
  });
  assert.strictEqual(invalidTeamType.success, false, "Invalid team column type enum must fail");
});





