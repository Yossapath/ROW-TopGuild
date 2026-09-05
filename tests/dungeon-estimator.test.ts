import test from "node:test";
import assert from "node:assert/strict";
import { calculateDungeonEstimates } from "../lib/dungeon-estimator";
import type { DungeonQueue } from "../types";

test("Dungeon Estimator - Empty queue returns empty summary", () => {
  const result = calculateDungeonEstimates([]);
  assert.equal(result.totalWaitingCount, 0);
  assert.equal(result.totalPartiesCount, 0);
  assert.equal(result.hasActiveParty, false);
});

test("Dungeon Estimator - 1 Party without active run", () => {
  const queues: DungeonQueue[] = [
    { id: "1", name: "Alice", job: "Priest", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 1 },
    { id: "2", name: "Bob", job: "High Wizard", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 2 },
    { id: "3", name: "Charlie", job: "Sniper", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 3 },
  ];

  const now = new Date("2026-09-06T14:00:00Z");
  const result = calculateDungeonEstimates(queues, now);

  assert.equal(result.totalPartiesCount, 1);
  assert.equal(result.hasActiveParty, false);

  const alice = result.estimatesByName["alice"];
  assert.ok(alice);
  assert.equal(alice.partyNumber, 1);
  assert.equal(alice.queuesAhead, 0);
  assert.equal(alice.estimatedWaitText, "ถึงคิวแล้ว (คิวถัดไป)");
});

test("Dungeon Estimator - 2 Parties with 11-12 min queue calculation", () => {
  const queues: DungeonQueue[] = [
    // Party 1
    { id: "1", name: "Priest1", job: "Priest", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 1 },
    { id: "2", name: "DPS1", job: "High Wizard", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 2 },
    { id: "3", name: "DPS2", job: "Sniper", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 3 },
    { id: "4", name: "DPS3", job: "Lord Knight", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 4 },
    { id: "5", name: "DPS4", job: "Assassin Cross", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 5 },
    // Party 2
    { id: "6", name: "Priest2", job: "Priest", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 6 },
    { id: "7", name: "DPS5", job: "Gunslinger", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 7 },
  ];

  const now = new Date("2026-09-06T14:00:00Z");
  const result = calculateDungeonEstimates(queues, now);

  assert.equal(result.totalPartiesCount, 2);

  // Party 1 members: queuesAhead = 0
  const dps1 = result.estimatesByName["dps1"];
  assert.equal(dps1.partyNumber, 1);
  assert.equal(dps1.queuesAhead, 0);

  // Party 2 members: queuesAhead = 1, ~11-12 mins
  const dps5 = result.estimatesByName["dps5"];
  assert.equal(dps5.partyNumber, 2);
  assert.equal(dps5.queuesAhead, 1);
  assert.equal(dps5.waitMinutesMin, 11);
  assert.equal(dps5.waitMinutesMax, 12);
  assert.ok(dps5.estimatedWaitText.includes("อีก 1 คิว"));
  assert.ok(dps5.estimatedWaitText.includes("11-12 นาที"));
});

test("Dungeon Estimator - Active party increases wait by 1 queue", () => {
  const queues: DungeonQueue[] = [
    { id: "act1", name: "Active1", job: "Priest", dungeon: "ดันมายา (Maya)", power: 100, status: "active", rounds: 1, timestamp: 1 },
    { id: "w1", name: "Wait1", job: "High Wizard", dungeon: "ดันมายา (Maya)", power: 100, status: "waiting", rounds: 1, timestamp: 2 },
  ];

  const now = new Date("2026-09-06T14:00:00Z");
  const result = calculateDungeonEstimates(queues, now);

  assert.equal(result.hasActiveParty, true);
  assert.equal(result.activeCount, 1);

  const active1 = result.estimatesByName["active1"];
  assert.equal(active1.status, "active");
  assert.equal(active1.estimatedWaitText, "กำลังลงดันเจี้ยน ⚔️");

  const wait1 = result.estimatesByName["wait1"];
  assert.equal(wait1.partyNumber, 1);
  assert.equal(wait1.queuesAhead, 1); // active run is ahead
});
