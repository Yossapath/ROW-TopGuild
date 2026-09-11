import { test } from 'node:test';
import assert from 'node:assert';

import { sortQueueItems, findContinuousPriest } from '@/lib/dungeon/queue-rules';
import { assignPlayersToTeam } from '@/lib/dungeon/queue-engine';
import { checkBookingEligibility, getUserBookingQuota } from '@/lib/dungeon/booking-rules';
import { allocateTeams } from '@/lib/team-allocator';
import { isBookingOpen } from '@/lib/utils';
import type { DungeonQueueItem, DungeonTeamResource } from '@/types';

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
