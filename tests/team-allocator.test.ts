import test from "node:test";
import assert from "node:assert/strict";
import { allocateTeams, AllocatorInput, AllocatorMember, AllocatorColumn } from "../lib/team-allocator";

// ── Helper ─────────────────────────────────────────────────────

function buildMembers(names: string[], job = "Lord Knight", startPower = 1000): Record<string, AllocatorMember> {
  const map: Record<string, AllocatorMember> = {};
  names.forEach((name, i) => {
    map[name] = { id: name, name, job, power: startPower + i };
  });
  return map;
}

function buildDefaultColumns(): Record<string, AllocatorColumn> {
  const cols: Record<string, AllocatorColumn> = {
    unassigned: { id: "unassigned", title: "ยังไม่ได้จัด", memberIds: [], type: "unassigned", locked: false },
  };
  for (let i = 1; i <= 12; i++) {
    cols[`main-${i}`] = { id: `main-${i}`, title: `ทีม ${i}`, memberIds: [null, null, null, null, null], type: "main", locked: false };
  }
  for (let i = 1; i <= 5; i++) {
    cols[`sub-${i}`] = { id: `sub-${i}`, title: `ทีมรอง ${i}`, memberIds: [null, null, null, null, null], type: "sub", locked: false };
  }
  return cols;
}

function buildMainOrders() {
  return {
    mainZone1Order: ["main-1","main-2","main-3","main-4","main-5","main-6"],
    mainZone2Order: ["main-7","main-8","main-9","main-10","main-11","main-12"],
  };
}

// ── Tests ──────────────────────────────────────────────────────

test("Allocator: ลงสนามหลัก 60 คน ครบทุกทีม", () => {
  const others60 = Array.from({ length: 60 }, (_, i) => `Player${i + 1}`);
  const members = buildMembers(others60);

  const input: AllocatorInput = {
    members,
    columns: buildDefaultColumns(),
    ...buildMainOrders(),
    subOrder: ["sub-1","sub-2","sub-3","sub-4","sub-5"],
    offlineIds: [],
    mainFieldNames: others60,
  };

  const result = allocateTeams(input);
  assert.equal(result.stats.mainTotal, 60, "สนามหลักต้องมี 60 คน");
});

test("Allocator: ทุกทีมสนามหลักมี Priest 1 คน (มี Priest พอ)", () => {
  // 12 Priests + 48 others = 60
  const priestNames = Array.from({ length: 12 }, (_, i) => `Priest${i + 1}`);
  const otherNames = Array.from({ length: 48 }, (_, i) => `Knight${i + 1}`);
  const mainFieldNames = [...priestNames, ...otherNames];

  const membersRaw: Record<string, AllocatorMember> = {};
  priestNames.forEach((n, i) => { membersRaw[n] = { id: n, name: n, job: "Priest", power: 2000 + i }; });
  otherNames.forEach((n, i) => { membersRaw[n] = { id: n, name: n, job: "Lord Knight", power: 1000 + i }; });

  const input: AllocatorInput = {
    members: membersRaw,
    columns: buildDefaultColumns(),
    ...buildMainOrders(),
    subOrder: ["sub-1","sub-2","sub-3","sub-4","sub-5"],
    offlineIds: [],
    mainFieldNames,
  };

  const result = allocateTeams(input);
  assert.equal(result.stats.priestFullTeams, 12, "ทุก 12 ทีมต้องมี Priest ≥ 1 คน");
  assert.equal(result.warnings.filter(w => w.type === "PRIEST_MISSING").length, 0, "ไม่มี PRIEST_MISSING warning");
});

test("Allocator: Priest น้อยกว่า 12 — แจ้งเตือนและจัดได้บางส่วน", () => {
  const priestNames = Array.from({ length: 6 }, (_, i) => `Priest${i + 1}`);
  const otherNames = Array.from({ length: 54 }, (_, i) => `Knight${i + 1}`);
  const mainFieldNames = [...priestNames, ...otherNames];

  const membersRaw: Record<string, AllocatorMember> = {};
  priestNames.forEach((n) => { membersRaw[n] = { id: n, name: n, job: "Priest", power: 2000 }; });
  otherNames.forEach((n, i) => { membersRaw[n] = { id: n, name: n, job: "Lord Knight", power: 1000 + i }; });

  const input: AllocatorInput = {
    members: membersRaw,
    columns: buildDefaultColumns(),
    ...buildMainOrders(),
    subOrder: ["sub-1","sub-2","sub-3","sub-4","sub-5"],
    offlineIds: [],
    mainFieldNames,
  };

  const result = allocateTeams(input);
  assert.equal(result.stats.priestFullTeams, 6, "ต้องมี Priest ครบ 6 ทีม");
  assert.ok(result.warnings.some(w => w.type === "PRIEST_MISSING"), "ต้องมี PRIEST_MISSING warning");
});

test("Allocator: คนที่เหลือลงสนามรองอัตโนมัติ", () => {
  const mainNames = Array.from({ length: 60 }, (_, i) => `Main${i + 1}`);
  const subNames = Array.from({ length: 25 }, (_, i) => `Sub${i + 1}`);
  const allMembers: Record<string, AllocatorMember> = {};
  [...mainNames, ...subNames].forEach((n, i) => {
    allMembers[n] = { id: n, name: n, job: "Lord Knight", power: 1000 + i };
  });

  const input: AllocatorInput = {
    members: allMembers,
    columns: buildDefaultColumns(),
    ...buildMainOrders(),
    subOrder: ["sub-1","sub-2","sub-3","sub-4","sub-5"],
    offlineIds: [],
    mainFieldNames: mainNames,
  };

  const result = allocateTeams(input);
  assert.equal(result.stats.mainTotal, 60, "สนามหลักต้องมี 60 คน");
  assert.equal(result.stats.subTotal, 25, "สนามรองต้องมี 25 คน");
  assert.equal(result.stats.subTeams, 5, "ต้องมี 5 ทีมสนามรอง (5 x 5 = 25)");
});

test("Allocator: สมาชิก 1 คนไม่อยู่ในทีมมากกว่า 1 ทีม", () => {
  const mainNames = Array.from({ length: 60 }, (_, i) => `Player${i + 1}`);
  const allMembers: Record<string, AllocatorMember> = {};
  mainNames.forEach((n, i) => {
    allMembers[n] = { id: n, name: n, job: "Lord Knight", power: 1000 + i };
  });

  const input: AllocatorInput = {
    members: allMembers,
    columns: buildDefaultColumns(),
    ...buildMainOrders(),
    subOrder: ["sub-1","sub-2","sub-3","sub-4","sub-5"],
    offlineIds: [],
    mainFieldNames: mainNames,
  };

  const result = allocateTeams(input);

  // Collect all assigned member IDs across all non-unassigned columns
  const allAssigned: string[] = [];
  for (const [colId, col] of Object.entries(result.columns)) {
    if (colId === "unassigned") continue;
    col.memberIds.forEach((id) => { if (id) allAssigned.push(id); });
  }

  const uniqueAssigned = new Set(allAssigned);
  assert.equal(allAssigned.length, uniqueAssigned.size, "ไม่มีสมาชิกซ้ำในหลายทีม");
});

test("Allocator: ทีมที่ล็อกไว้ไม่ถูกแตะต้อง", () => {
  const mainNames = Array.from({ length: 60 }, (_, i) => `Player${i + 1}`);
  const allMembers: Record<string, AllocatorMember> = {};
  mainNames.forEach((n, i) => {
    allMembers[n] = { id: n, name: n, job: "Lord Knight", power: 1000 + i };
  });

  const cols = buildDefaultColumns();
  // Lock main-1 with specific members
  cols["main-1"].locked = true;
  cols["main-1"].memberIds = ["Player1", "Player2", null, null, null];

  const input: AllocatorInput = {
    members: allMembers,
    columns: cols,
    ...buildMainOrders(),
    subOrder: ["sub-1","sub-2","sub-3","sub-4","sub-5"],
    offlineIds: [],
    mainFieldNames: mainNames,
  };

  const result = allocateTeams(input);
  assert.deepEqual(
    result.columns["main-1"].memberIds,
    ["Player1", "Player2", null, null, null],
    "ทีมที่ล็อกต้องไม่เปลี่ยนแปลง"
  );
});

test("Allocator: สมาชิกออฟไลน์ไม่ถูกจัดเข้าทีม", () => {
  const names = Array.from({ length: 65 }, (_, i) => `Player${i + 1}`);
  const allMembers: Record<string, AllocatorMember> = {};
  names.forEach((n, i) => {
    allMembers[n] = { id: n, name: n, job: "Lord Knight", power: 1000 + i };
  });

  const offlineIds = ["Player1", "Player2", "Player3", "Player4", "Player5"];

  const input: AllocatorInput = {
    members: allMembers,
    columns: buildDefaultColumns(),
    ...buildMainOrders(),
    subOrder: ["sub-1","sub-2","sub-3","sub-4","sub-5"],
    offlineIds,
    // mainFieldNames includes offline players — engine should skip them
    mainFieldNames: names.slice(0, 60),
  };

  const result = allocateTeams(input);

  // Check no offline player is in any team
  for (const [colId, col] of Object.entries(result.columns)) {
    if (colId === "unassigned") continue;
    for (const memberId of col.memberIds) {
      if (memberId) {
        assert.ok(!offlineIds.includes(memberId), `${memberId} เป็นออฟไลน์แต่ถูกจัดเข้าทีม`);
      }
    }
  }
});

test("Allocator: แจ้งเตือน NOT_IN_ROSTER เมื่อชื่อไม่อยู่ใน members", () => {
  const mainNames = Array.from({ length: 55 }, (_, i) => `Player${i + 1}`);
  const allMembers: Record<string, AllocatorMember> = {};
  mainNames.forEach((n, i) => {
    allMembers[n] = { id: n, name: n, job: "Lord Knight", power: 1000 + i };
  });

  const inputNames = [...mainNames, "Ghost1", "Ghost2", "Ghost3", "Ghost4", "Ghost5"];

  const input: AllocatorInput = {
    members: allMembers,
    columns: buildDefaultColumns(),
    ...buildMainOrders(),
    subOrder: ["sub-1","sub-2","sub-3","sub-4","sub-5"],
    offlineIds: [],
    mainFieldNames: inputNames,
  };

  const result = allocateTeams(input);
  const notInRoster = result.warnings.filter(w => w.type === "NOT_IN_ROSTER");
  assert.equal(notInRoster.length, 5, "ต้องมี 5 NOT_IN_ROSTER warnings");
  assert.equal(result.stats.unplacedNames.length, 5);
});

test("Allocator: รายชื่อซ้ำกันใน mainFieldNames จัดแค่ครั้งเดียว", () => {
  const mainNames = Array.from({ length: 60 }, (_, i) => `Player${i + 1}`);
  const allMembers: Record<string, AllocatorMember> = {};
  mainNames.forEach((n, i) => {
    allMembers[n] = { id: n, name: n, job: "Lord Knight", power: 1000 + i };
  });

  // Add duplicates
  const inputNames = [...mainNames, "Player1", "Player2"];

  const input: AllocatorInput = {
    members: allMembers,
    columns: buildDefaultColumns(),
    ...buildMainOrders(),
    subOrder: ["sub-1","sub-2","sub-3","sub-4","sub-5"],
    offlineIds: [],
    mainFieldNames: inputNames,
  };

  const result = allocateTeams(input);
  const allAssigned: string[] = [];
  for (const [colId, col] of Object.entries(result.columns)) {
    if (colId === "unassigned") continue;
    col.memberIds.forEach((id) => { if (id) allAssigned.push(id); });
  }
  const uniqueAssigned = new Set(allAssigned);
  assert.equal(allAssigned.length, uniqueAssigned.size, "ไม่มีสมาชิกซ้ำแม้จะส่งรายชื่อซ้ำมา");
});
