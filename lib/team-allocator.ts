/**
 * lib/team-allocator.ts
 *
 * Engine สำหรับจัดทีม GVG สนามหลัก (12 ทีม / 60 คน) และสนามรอง
 *
 * กฎหลัก:
 * 1. สนามหลัก 12 ทีม ครบ 60 คน — จัดก่อนเสมอ
 * 2. ทุกทีมสนามหลักมี Priest อย่างน้อย 1 คน (ถ้า Priest มีพอ)
 * 3. คนที่เหลือทั้งหมดจัดลงสนามรองอัตโนมัติ (ทีมละ 5 คน)
 * 4. สมาชิก 1 คนอยู่ได้แค่ 1 ทีม
 * 5. ทีมที่ล็อกไว้ (locked) ไม่ถูกแตะต้อง
 */

// ── Types ──────────────────────────────────────────────────────

export interface AllocatorMember {
  id: string;     // ใช้ชื่อเป็น ID (เหมือนกับที่หน้า teams ทำ)
  name: string;
  job: string;
  power: number;
}

export interface AllocatorColumn {
  id: string;
  title: string;
  memberIds: (string | null)[];
  type: "main" | "sub" | "unassigned";
  locked: boolean;
}

export interface AllocatorInput {
  /** Map ชื่อ → Member */
  members: Record<string, AllocatorMember>;
  /** Column definitions (รวม "unassigned") */
  columns: Record<string, AllocatorColumn>;
  mainZone1Order: string[];
  mainZone2Order: string[];
  subOrder: string[];
  offlineIds: string[];
  /** รายชื่อ 60 คนสนามหลักที่ admin เลือกมา (อาจมีน้อยกว่าหรือมากกว่า 60) */
  mainFieldNames: string[];
}

export interface AllocatorStats {
  mainTotal: number;        // จำนวนคนที่จัดลงสนามหลักจริง
  mainTeams: number;        // จำนวนทีมสนามหลัก (12 เสมอ)
  priestPerTeam: number[];  // จำนวน Priest ในแต่ละทีมสนามหลัก
  priestFullTeams: number;  // กี่ทีมที่มี Priest ≥ 1 คน
  subTotal: number;         // จำนวนคนที่จัดลงสนามรอง
  subTeams: number;         // จำนวนทีมสนามรอง
  unplacedNames: string[];  // รายชื่อที่ระบุมาแต่ไม่มีใน roster
}

export interface AllocatorWarning {
  type: "PRIEST_MISSING" | "DUPLICATE_NAME" | "NOT_IN_ROSTER" | "BELOW_60";
  message: string;
}

export interface AllocatorResult {
  /** DataState ที่อัปเดตแล้ว พร้อมสำหรับส่งไป setData() */
  columns: Record<string, AllocatorColumn>;
  mainZone1Order: string[];
  mainZone2Order: string[];
  subOrder: string[];
  stats: AllocatorStats;
  warnings: AllocatorWarning[];
}

// ── Main Allocator Function ────────────────────────────────────

export function allocateTeams(input: AllocatorInput): AllocatorResult {
  const {
    members,
    columns: originalColumns,
    mainZone1Order,
    mainZone2Order,
    subOrder,
    offlineIds,
    mainFieldNames,
  } = input;

  const warnings: AllocatorWarning[] = [];

  // ── 1. Collect locked member IDs (ไม่แตะ) ──────────────────
  const lockedMemberIds = new Set<string>();
  Object.values(originalColumns).forEach((col) => {
    if (col.locked && col.type !== "unassigned") {
      col.memberIds.forEach((id) => { if (id) lockedMemberIds.add(id); });
    }
  });

  // ── 2. Deep clone columns, reset unlocked non-unassigned ────
  const columns: Record<string, AllocatorColumn> = {};
  for (const [colId, col] of Object.entries(originalColumns)) {
    columns[colId] = { ...col, memberIds: [...col.memberIds] };
  }
  for (const colId of Object.keys(columns)) {
    if (!columns[colId].locked && colId !== "unassigned") {
      columns[colId].memberIds = [null, null, null, null, null];
    }
  }

  // ── 3. Resolve mainFieldNames → valid, non-locked, non-offline members ──
  const mainFieldNames60: string[] = [];
  const unplacedNames: string[] = [];
  const seenNames = new Set<string>();

  for (const name of mainFieldNames) {
    if (seenNames.has(name)) continue; // กรองซ้ำ
    seenNames.add(name);

    const member = members[name];
    if (!member) {
      warnings.push({ type: "NOT_IN_ROSTER", message: `"${name}" ไม่อยู่ใน Roster` });
      unplacedNames.push(name);
      continue;
    }
    if (offlineIds.includes(name)) continue; // ออฟไลน์ข้ามไป
    if (lockedMemberIds.has(name)) continue; // ล็อกแล้วข้ามไป

    mainFieldNames60.push(name);
  }

  if (mainFieldNames60.length < 60) {
    warnings.push({
      type: "BELOW_60",
      message: `รายชื่อสนามหลักมีเพียง ${mainFieldNames60.length} คน (ต้องการ 60 คน)`,
    });
  }

  // ── 4. Sort main field: Power DESC, Priests first ───────────
  const mainPriests = mainFieldNames60
    .filter((n) => members[n]?.job === "Priest")
    .sort((a, b) => (members[b]?.power || 0) - (members[a]?.power || 0));
  const mainOthers = mainFieldNames60
    .filter((n) => members[n]?.job !== "Priest")
    .sort((a, b) => (members[b]?.power || 0) - (members[a]?.power || 0));

  // ── 5. จัดสนามหลัก 12 ทีม ──────────────────────────────────
  const mainCols = [...mainZone1Order, ...mainZone2Order];

  // Pass 1: ใส่ Priest 1 คนต่อทีมก่อน
  let pIdx = 0;
  for (const colId of mainCols) {
    if (columns[colId].locked) continue;
    if (pIdx >= mainPriests.length) break;
    const firstNull = columns[colId].memberIds.indexOf(null);
    if (firstNull !== -1) {
      columns[colId].memberIds[firstNull] = mainPriests[pIdx];
      pIdx++;
    }
  }
  // Priest ที่เหลือ (เกิน 12 คน หรือ ไม่มีที่ใส่) ไปรวมกับ Others
  const remainingPriests = mainPriests.slice(pIdx);
  const remainingToPlace = [...remainingPriests, ...mainOthers].sort(
    (a, b) => (members[b]?.power || 0) - (members[a]?.power || 0)
  );

  // Pass 2: เติมสล็อตที่เหลือในสนามหลัก
  let mIdx = 0;
  for (const colId of mainCols) {
    if (columns[colId].locked) continue;
    for (let i = 0; i < 5; i++) {
      if (columns[colId].memberIds[i] === null && mIdx < remainingToPlace.length) {
        columns[colId].memberIds[i] = remainingToPlace[mIdx];
        mIdx++;
      }
    }
  }

  // ── 6. สถิติสนามหลัก ────────────────────────────────────────
  const priestPerTeam: number[] = mainCols.map((colId) =>
    columns[colId].memberIds.filter((id) => id && members[id]?.job === "Priest").length
  );
  const priestFullTeams = priestPerTeam.filter((c) => c >= 1).length;
  const mainTotal = mainCols.reduce(
    (sum, colId) => sum + columns[colId].memberIds.filter(Boolean).length,
    0
  );

  if (priestFullTeams < mainCols.length) {
    warnings.push({
      type: "PRIEST_MISSING",
      message: `มี Priest ไม่พอ: ${priestFullTeams}/${mainCols.length} ทีมสนามหลักที่มี Priest`,
    });
  }

  // ── 7. จัดสนามรอง ───────────────────────────────────────────
  const mainFieldSet = new Set(mainFieldNames60);
  const subFieldMembers = Object.values(members)
    .filter(
      (m) =>
        !mainFieldSet.has(m.id) &&
        !lockedMemberIds.has(m.id) &&
        !offlineIds.includes(m.id)
    )
    .sort((a, b) => b.power - a.power);

  // Reset sub columns (ยกเว้นที่ล็อก)
  for (const colId of Object.keys(columns)) {
    if (columns[colId].type === "sub" && !columns[colId].locked) {
      columns[colId].memberIds = [null, null, null, null, null];
    }
  }

  // Bug Fix: start subTeamCount after the highest existing sub team number to avoid collision with locked teams
  const existingSubNums = Object.keys(columns)
    .filter(id => id.startsWith("sub-"))
    .map(id => parseInt(id.split("-")[1]))
    .filter(n => !isNaN(n));
  let subTeamCount = existingSubNums.length > 0 ? Math.max(...existingSubNums) + 1 : 1;

  const newSubOrder: string[] = [];
  let sIdx = 0;

  while (sIdx < subFieldMembers.length) {
    const colId = `sub-${subTeamCount}`;
    if (!columns[colId]) {
      columns[colId] = {
        id: colId,
        title: `ทีมรอง ${subTeamCount}`,
        memberIds: [null, null, null, null, null],
        type: "sub",
        locked: false,
      };
    }
    if (!columns[colId].locked) {
      newSubOrder.push(colId);
      for (let i = 0; i < 5; i++) {
        if (columns[colId].memberIds[i] === null && sIdx < subFieldMembers.length) {
          columns[colId].memberIds[i] = subFieldMembers[sIdx].id;
          sIdx++;
        }
      }
    } else {
      newSubOrder.push(colId); // locked team stays
    }
    subTeamCount++;
  }

  // Ensure at least 5 sub teams exist (สร้างเพิ่มถ้าไม่พอ)
  while (newSubOrder.length < 5) {
    const colId = `sub-${subTeamCount}`;
    if (!columns[colId]) {
      columns[colId] = {
        id: colId,
        title: `ทีมรอง ${subTeamCount}`,
        memberIds: [null, null, null, null, null],
        type: "sub",
        locked: false,
      };
    }
    if (!newSubOrder.includes(colId)) newSubOrder.push(colId);
    subTeamCount++;
  }

  const subTotal = newSubOrder.reduce(
    (sum, colId) => sum + (columns[colId]?.memberIds.filter(Boolean).length || 0),
    0
  );

  // ── 8. Clear unassigned (ทุกคนถูกจัดแล้ว) ─────────────────
  if (columns["unassigned"]) {
    columns["unassigned"].memberIds = [];
  }

  return {
    columns,
    mainZone1Order,
    mainZone2Order,
    subOrder: newSubOrder,
    stats: {
      mainTotal,
      mainTeams: mainCols.length,
      priestPerTeam,
      priestFullTeams,
      subTotal,
      subTeams: newSubOrder.length,
      unplacedNames,
    },
    warnings,
  };
}
