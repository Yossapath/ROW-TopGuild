import { test } from 'node:test';
import assert from 'node:assert';
import { assignPlayersToTeam } from '../lib/dungeon/queue-engine';
import { DungeonTeamResource, DungeonQueueItem } from '../types';

test('Queue Engine: Sort by Round Number then QueuedAt', () => {
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
  };

  const queueItems: DungeonQueueItem[] = [
    { id: "A2", bookingId: "bA", name: "A", job: "Sniper", power: 100, dungeon: "ดันมายา (Maya)", roundNumber: 2, status: "WAITING", queuedAt: 100, assignedTeamId: null, completedAt: null },
    { id: "B1", bookingId: "bB", name: "B", job: "Sniper", power: 100, dungeon: "ดันมายา (Maya)", roundNumber: 1, status: "WAITING", queuedAt: 200, assignedTeamId: null, completedAt: null },
    { id: "C1", bookingId: "bC", name: "C", job: "Sniper", power: 100, dungeon: "ดันมายา (Maya)", roundNumber: 1, status: "WAITING", queuedAt: 300, assignedTeamId: null, completedAt: null },
    { id: "A1", bookingId: "bA", name: "A", job: "Sniper", power: 100, dungeon: "ดันมายา (Maya)", roundNumber: 1, status: "WAITING", queuedAt: 50, assignedTeamId: null, completedAt: null },
  ];

  const result = assignPlayersToTeam(team, queueItems);

  // Expected order: A1, B1, C1 (Round 1 first, then sorted by queuedAt)
  // Max members = 3, so A2 is left waiting.
  assert.strictEqual(result.updatedTeam.activeMembers.length, 3);
  assert.strictEqual(result.updatedTeam.activeMembers[0].name, "A");
  assert.strictEqual(result.updatedTeam.activeMembers[0].roundNumber, 1);
  assert.strictEqual(result.updatedTeam.activeMembers[1].name, "B");
  assert.strictEqual(result.updatedTeam.activeMembers[2].name, "C");
});

test('Queue Engine: Priest Continuous Run', () => {
  const team: DungeonTeamResource = {
    id: "team-1",
    dungeon: "ดันมายา (Maya)",
    status: "AVAILABLE",
    startedAt: null,
    pausedAt: null,
    pausedDuration: 0,
    estimatedDurationSeconds: 300,
    activeMembers: [],
    completedRounds: 1,
  };

  const prevMembers = [
    { name: "P", job: "Priest", roundNumber: 1 },
    { name: "B", job: "Sniper", roundNumber: 1 },
    { name: "C", job: "Sniper", roundNumber: 1 }
  ];

  const queueItems: DungeonQueueItem[] = [
    { id: "P2", bookingId: "bP", name: "P", job: "Priest", power: 100, dungeon: "ดันมายา (Maya)", roundNumber: 2, status: "WAITING", queuedAt: 900, assignedTeamId: null, completedAt: null }, // Queued late
    { id: "D1", bookingId: "bD", name: "D", job: "Sniper", power: 100, dungeon: "ดันมายา (Maya)", roundNumber: 1, status: "WAITING", queuedAt: 100, assignedTeamId: null, completedAt: null },
    { id: "E1", bookingId: "bE", name: "E", job: "Sniper", power: 100, dungeon: "ดันมายา (Maya)", roundNumber: 1, status: "WAITING", queuedAt: 200, assignedTeamId: null, completedAt: null },
    { id: "F1", bookingId: "bF", name: "F", job: "Sniper", power: 100, dungeon: "ดันมายา (Maya)", roundNumber: 1, status: "WAITING", queuedAt: 300, assignedTeamId: null, completedAt: null },
  ];

  const result = assignPlayersToTeam(team, queueItems, prevMembers);

  // Priest P should get Priority for R2 despite queuing late and being R2
  assert.strictEqual(result.updatedTeam.activeMembers.length, 3);
  assert.strictEqual(result.updatedTeam.activeMembers[0].name, "P");
  assert.strictEqual(result.updatedTeam.activeMembers[0].roundNumber, 2);
  assert.strictEqual(result.updatedTeam.activeMembers[1].name, "D");
  assert.strictEqual(result.updatedTeam.activeMembers[2].name, "E");
});
