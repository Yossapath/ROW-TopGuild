import test from "node:test";
import assert from "node:assert/strict";
import { calculateDungeonEstimates } from "../lib/dungeon-estimator";
import type { DungeonQueue } from "../types";

test("Dungeon Estimator - Empty queue returns empty summary", () => {
  const result = calculateDungeonEstimates([]);
  assert.equal(result.totalWaitingCount, 0);
  assert.equal(result.totalRoundsCount, 0);
  assert.equal(result.hasActiveParty, false);
});

test("Dungeon Estimator - 1 Carry Team (1 Priest + 2 Others per round)", () => {
  const queues: DungeonQueue[] = [
    { id: "p1", name: "Alice", job: "Priest", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 1 },
    { id: "o1", name: "Bob", job: "High Wizard", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 2 },
    { id: "o2", name: "Charlie", job: "Sniper", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 3 },
    { id: "o3", name: "David", job: "Lord Knight", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 4 },
  ];

  const now = new Date("2026-09-06T14:00:00Z");
  const result = calculateDungeonEstimates(queues, now, 1);

  assert.equal(result.carryTeamsCount, 1);
  assert.equal(result.totalRoundsCount, 2); // 3 others need 2 rounds (capacity 2/round)

  // Alice (Priest): Round 1
  const alice = result.estimatesByName["alice"];
  assert.equal(alice.assignedRound, 1);
  assert.equal(alice.queuesAhead, 0);
  assert.equal(alice.estimatedWaitText, "รอบแรก (พร้อมลงทันที)");

  // Bob (Other 1): Round 1, Team 1, Slot 1
  const bob = result.estimatesByName["bob"];
  assert.equal(bob.assignedRound, 1);
  assert.equal(bob.assignedTeam, 1);
  assert.equal(bob.slotInTeam, 1);
  assert.equal(bob.queuesAhead, 0);

  // Charlie (Other 2): Round 1, Team 1, Slot 2
  const charlie = result.estimatesByName["charlie"];
  assert.equal(charlie.assignedRound, 1);
  assert.equal(charlie.assignedTeam, 1);
  assert.equal(charlie.slotInTeam, 2);
  assert.equal(charlie.queuesAhead, 0);

  // David (Other 3): Round 2, Team 1, Slot 1, wait 11-12 min
  const david = result.estimatesByName["david"];
  assert.equal(david.assignedRound, 2);
  assert.equal(david.queuesAhead, 1);
  assert.equal(david.waitMinutesMin, 11);
  assert.equal(david.waitMinutesMax, 12);
  assert.ok(david.estimatedWaitText.includes("อีก 1 รอบ"));
});

test("Dungeon Estimator - 2 Carry Teams (2 Priests + 4 Others per round doubles speed)", () => {
  const queues: DungeonQueue[] = [
    // 2 Priests
    { id: "p1", name: "Priest1", job: "Priest", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 1 },
    { id: "p2", name: "Priest2", job: "Priest", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 2 },
    // 5 Others
    { id: "o1", name: "Other1", job: "High Wizard", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 3 },
    { id: "o2", name: "Other2", job: "Sniper", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 4 },
    { id: "o3", name: "Other3", job: "Lord Knight", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 5 },
    { id: "o4", name: "Other4", job: "Assassin Cross", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 6 },
    { id: "o5", name: "Other5", job: "Gunslinger", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 7 },
  ];

  const now = new Date("2026-09-06T14:00:00Z");
  const result = calculateDungeonEstimates(queues, now, 2);

  assert.equal(result.carryTeamsCount, 2);
  assert.equal(result.capacityPerRound.priest, 2);
  assert.equal(result.capacityPerRound.others, 4);

  // Both Priests are in Round 1
  assert.equal(result.estimatesByName["priest1"].assignedRound, 1);
  assert.equal(result.estimatesByName["priest1"].assignedTeam, 1);
  assert.equal(result.estimatesByName["priest2"].assignedRound, 1);
  assert.equal(result.estimatesByName["priest2"].assignedTeam, 2);

  // Others 1 to 4 are ALL in Round 1
  assert.equal(result.estimatesByName["other1"].assignedRound, 1);
  assert.equal(result.estimatesByName["other1"].assignedTeam, 1);
  assert.equal(result.estimatesByName["other1"].queuesAhead, 0);

  assert.equal(result.estimatesByName["other2"].assignedRound, 1);
  assert.equal(result.estimatesByName["other2"].assignedTeam, 1);
  assert.equal(result.estimatesByName["other2"].queuesAhead, 0);

  assert.equal(result.estimatesByName["other3"].assignedRound, 1);
  assert.equal(result.estimatesByName["other3"].assignedTeam, 2);
  assert.equal(result.estimatesByName["other3"].queuesAhead, 0);

  assert.equal(result.estimatesByName["other4"].assignedRound, 1);
  assert.equal(result.estimatesByName["other4"].assignedTeam, 2);
  assert.equal(result.estimatesByName["other4"].queuesAhead, 0);

  // Other 5 is in Round 2 (1 round wait: 11-12 min)
  const o5 = result.estimatesByName["other5"];
  assert.equal(o5.assignedRound, 2);
  assert.equal(o5.assignedTeam, 1);
  assert.equal(o5.queuesAhead, 1);
  assert.equal(o5.waitMinutesMin, 11);
  assert.equal(o5.waitMinutesMax, 12);
});

test("Dungeon Estimator - Priests do not affect Others queue position or time", () => {
  const queuesWithLotsOfPriests: DungeonQueue[] = [
    { id: "p1", name: "Priest1", job: "Priest", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 1 },
    { id: "p2", name: "Priest2", job: "Priest", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 2 },
    { id: "p3", name: "Priest3", job: "Priest", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 3 },
    { id: "o1", name: "Other1", job: "Sniper", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 4 },
    { id: "o2", name: "Other2", job: "Lord Knight", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 5 },
  ];

  const now = new Date("2026-09-06T14:00:00Z");
  // 1 Carry Team
  const result = calculateDungeonEstimates(queuesWithLotsOfPriests, now, 1);

  // Even though there are 3 priests ahead of Other1, Other1 and Other2 are STILL in Round 1!
  const o1 = result.estimatesByName["other1"];
  const o2 = result.estimatesByName["other2"];
  assert.equal(o1.assignedRound, 1);
  assert.equal(o1.queuesAhead, 0);
  assert.equal(o2.assignedRound, 1);
  assert.equal(o2.queuesAhead, 0);

  // Meanwhile, Priest3 is in Round 3 because 1 carry team takes 1 priest per round
  const p3 = result.estimatesByName["priest3"];
  assert.equal(p3.assignedRound, 3);
  assert.equal(p3.queuesAhead, 2);
});

test("Dungeon Estimator - Active party increases wait by 1 round", () => {
  const queues: DungeonQueue[] = [
    { id: "act1", name: "Active1", job: "Priest", dungeon: "ดันมายา (Maya)", power: 100, status: "active", rounds: 1, timestamp: 1 },
    { id: "w1", name: "Wait1", job: "High Wizard", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 2 },
  ];

  const now = new Date("2026-09-06T14:00:00Z");
  const result = calculateDungeonEstimates(queues, now, 1);

  assert.equal(result.hasActiveParty, true);
  assert.equal(result.activeCount, 1);

  const wait1 = result.estimatesByName["wait1"];
  assert.equal(wait1.assignedRound, 1);
  assert.equal(wait1.queuesAhead, 1); // active run is ahead
});
