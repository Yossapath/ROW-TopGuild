import type { DungeonQueue } from "@/types";

export interface QueueEstimate {
  queueId: string;
  name: string;
  job: string;
  status: "waiting" | "active" | "done";
  track: "priest" | "others";
  assignedRound: number; // รอบการลงดัน เช่น รอบที่ 1, รอบที่ 2... (0 ถ้า active/done)
  assignedTeam: number; // ทีมแบกที่จะได้ลง เช่น ทีม 1, ทีม 2...
  slotInTeam: number; // ช่องในทีมแบก (พระ: 1, อาชีพอื่น: 1..2)
  trackPosition: number; // ลำดับในสายตนเอง (พระคนที่ X, อาชีพอื่นคนที่ Y)
  queuesAhead: number; // จำนวนรอบที่ต้องรอก่อนหน้า (0, 1, 2, ...)
  waitMinutesMin: number;
  waitMinutesMax: number;
  estimatedWaitText: string;
  estimatedStartTimeText: string;
  isCurrentParty: boolean;

  // Compatibility fields
  partyNumber: number; // = assignedRound (รอบที่ X)
  partySlot: number;
  partyMemberCount: number;
  globalQueueIndex: number;
}

export interface DungeonCarryRound {
  roundNumber: number;
  queuesAhead: number;
  waitMinutesMin: number;
  waitMinutesMax: number;
  estimatedWaitText: string;
  estimatedStartTimeText: string;
  priestMembers: DungeonQueue[];
  otherMembers: DungeonQueue[];
  totalMembers: number;
  maxCapacity: number; // carryTeamsCount * 3
}

export interface DungeonPartyGroup {
  partyNumber: number;
  memberCount: number;
  queuesAhead: number;
  waitMinutesMin: number;
  waitMinutesMax: number;
  estimatedWaitText: string;
  estimatedStartTimeText: string;
  members: DungeonQueue[];
}

export interface DungeonEstimateResult {
  carryTeamsCount: number;
  capacityPerRound: {
    priest: number; // carryTeamsCount * 1
    others: number; // carryTeamsCount * 2
    total: number; // carryTeamsCount * 3
  };
  hasActiveParty: boolean;
  activeCount: number;
  totalWaitingCount: number;
  waitingPriestsCount: number;
  waitingOthersCount: number;
  totalDoneCount: number;
  totalRoundsCount: number;
  rounds: DungeonCarryRound[];

  // Compatibility fields
  totalPartiesCount: number;
  parties: DungeonPartyGroup[];
  estimatesById: Record<string, QueueEstimate>;
  estimatesByName: Record<string, QueueEstimate>;
}

export const MINUTES_PER_RUN_MIN = 11;
export const MINUTES_PER_RUN_MAX = 12;
export const PRIEST_PER_CARRY_TEAM = 1;
export const OTHERS_PER_CARRY_TEAM = 2;

/**
 * ฟอร์แมตเวลา TimeZone กรุงเทพฯ เป็น HH:mm
 */
export function formatBkkTime(date: Date): string {
  return date.toLocaleTimeString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * คำนวณการจัดคิวรอบทีมแบก (Carry Teams)
 * - 1 ทีมแบก รองรับ: พระ 1 คน + อาชีพอื่น 2 คน ต่อรอบ (~11-12 นาที)
 * - คิวแยกสายอิสระ: อาชีพอื่นไม่นับพระ และพระไม่นับอาชีพอื่น
 * - หากมี N ทีมแบก: รองรับ พระ N คน + อาชีพอื่น N*2 คน ต่อรอบ
 */
export function calculateDungeonEstimates(
  queues: DungeonQueue[],
  now: Date = new Date(),
  carryTeamsCount: number = 1
): DungeonEstimateResult {
  const teamsCount = Math.max(1, Math.floor(carryTeamsCount || 1));
  const priestPerRound = teamsCount * PRIEST_PER_CARRY_TEAM;
  const othersPerRound = teamsCount * OTHERS_PER_CARRY_TEAM;

  const activeQueues = queues.filter((q) => q.status === "active");
  const doneQueues = queues.filter((q) => q.status === "done");
  const waitingQueues = queues.filter(
    (q) => q.status !== "active" && q.status !== "done"
  );

  const hasActiveParty = activeQueues.length > 0;

  // คิวรอ: รอบ 1 มาก่อน รอบ 2
  const r1Priests = waitingQueues.filter(
    (q) => !(q.rounds === 2 && q.round1 === true) && q.job === "Priest"
  );
  const r2Priests = waitingQueues.filter(
    (q) => q.rounds === 2 && q.round1 === true && q.job === "Priest"
  );
  const priestsQueue = [...r1Priests, ...r2Priests];

  const r1Others = waitingQueues.filter(
    (q) => !(q.rounds === 2 && q.round1 === true) && q.job !== "Priest"
  );
  const r2Others = waitingQueues.filter(
    (q) => q.rounds === 2 && q.round1 === true && q.job !== "Priest"
  );
  const othersQueue = [...r1Others, ...r2Others];

  const priestRoundsNeeded = Math.ceil(priestsQueue.length / priestPerRound);
  const othersRoundsNeeded = Math.ceil(othersQueue.length / othersPerRound);
  const totalRoundsNeeded = Math.max(priestRoundsNeeded, othersRoundsNeeded);

  const rounds: DungeonCarryRound[] = [];
  const parties: DungeonPartyGroup[] = [];

  for (let r = 1; r <= totalRoundsNeeded; r++) {
    const roundIndex = r - 1;
    const pSlice = priestsQueue.slice(
      roundIndex * priestPerRound,
      (roundIndex + 1) * priestPerRound
    );
    const oSlice = othersQueue.slice(
      roundIndex * othersPerRound,
      (roundIndex + 1) * othersPerRound
    );

    let queuesAhead = 0;
    let waitMin = 0;
    let waitMax = 0;

    if (hasActiveParty) {
      queuesAhead = r; // รอบที่ active กำลังลงอยู่
      if (roundIndex === 0) {
        waitMin = 3;
        waitMax = MINUTES_PER_RUN_MIN;
      } else {
        waitMin = roundIndex * MINUTES_PER_RUN_MIN + 3;
        waitMax = r * MINUTES_PER_RUN_MAX;
      }
    } else {
      queuesAhead = roundIndex;
      if (roundIndex === 0) {
        waitMin = 0;
        waitMax = 0;
      } else {
        waitMin = roundIndex * MINUTES_PER_RUN_MIN;
        waitMax = roundIndex * MINUTES_PER_RUN_MAX;
      }
    }

    let estimatedWaitText = "";
    let estimatedStartTimeText = "";

    if (queuesAhead === 0) {
      estimatedWaitText = "รอบแรก (พร้อมลงทันที)";
      estimatedStartTimeText = "รอบถัดไป";
    } else if (queuesAhead === 1) {
      estimatedWaitText = `อีก 1 รอบ (~${waitMin}-${waitMax} นาที)`;
      const tMin = new Date(now.getTime() + waitMin * 60000);
      const tMax = new Date(now.getTime() + waitMax * 60000);
      const strMin = formatBkkTime(tMin);
      const strMax = formatBkkTime(tMax);
      estimatedStartTimeText = strMin === strMax ? `~${strMin} น.` : `~${strMin} - ${strMax} น.`;
    } else {
      estimatedWaitText = `อีก ${queuesAhead} รอบ (~${waitMin}-${waitMax} นาที)`;
      const tMin = new Date(now.getTime() + waitMin * 60000);
      const tMax = new Date(now.getTime() + waitMax * 60000);
      const strMin = formatBkkTime(tMin);
      const strMax = formatBkkTime(tMax);
      estimatedStartTimeText = strMin === strMax ? `~${strMin} น.` : `~${strMin} - ${strMax} น.`;
    }

    const roundMembers = [...pSlice, ...oSlice];

    rounds.push({
      roundNumber: r,
      queuesAhead,
      waitMinutesMin: waitMin,
      waitMinutesMax: waitMax,
      estimatedWaitText,
      estimatedStartTimeText,
      priestMembers: pSlice,
      otherMembers: oSlice,
      totalMembers: roundMembers.length,
      maxCapacity: teamsCount * 3,
    });

    parties.push({
      partyNumber: r,
      memberCount: roundMembers.length,
      queuesAhead,
      waitMinutesMin: waitMin,
      waitMinutesMax: waitMax,
      estimatedWaitText,
      estimatedStartTimeText,
      members: roundMembers,
    });
  }

  const estimatesById: Record<string, QueueEstimate> = {};
  const estimatesByName: Record<string, QueueEstimate> = {};

  // แมปปิ้งสายพระ (Priest Track)
  priestsQueue.forEach((m, idx) => {
    const roundIndex = Math.floor(idx / priestPerRound);
    const assignedRound = roundIndex + 1;
    const slotInRound = idx % priestPerRound;
    const assignedTeam = slotInRound + 1;
    const roundInfo = rounds[roundIndex];

    const est: QueueEstimate = {
      queueId: m.id,
      name: m.name,
      job: m.job,
      status: m.status,
      track: "priest",
      assignedRound,
      assignedTeam,
      slotInTeam: 1,
      trackPosition: idx + 1,
      queuesAhead: roundInfo ? roundInfo.queuesAhead : 0,
      waitMinutesMin: roundInfo ? roundInfo.waitMinutesMin : 0,
      waitMinutesMax: roundInfo ? roundInfo.waitMinutesMax : 0,
      estimatedWaitText: roundInfo ? roundInfo.estimatedWaitText : "รอบแรก (พร้อมลงทันที)",
      estimatedStartTimeText: roundInfo ? roundInfo.estimatedStartTimeText : "รอบถัดไป",
      isCurrentParty: roundInfo ? roundInfo.queuesAhead === 0 : true,
      partyNumber: assignedRound,
      partySlot: slotInRound + 1,
      partyMemberCount: roundInfo ? roundInfo.totalMembers : 1,
      globalQueueIndex: idx + 1,
    };

    estimatesById[m.id] = est;
    estimatesByName[m.name.toLowerCase()] = est;
  });

  // แมปปิ้งสายอาชีพอื่น (Others Track)
  othersQueue.forEach((m, idx) => {
    const roundIndex = Math.floor(idx / othersPerRound);
    const assignedRound = roundIndex + 1;
    const slotInRound = idx % othersPerRound;
    const assignedTeam = Math.floor(slotInRound / OTHERS_PER_CARRY_TEAM) + 1;
    const slotInTeam = (slotInRound % OTHERS_PER_CARRY_TEAM) + 1;
    const roundInfo = rounds[roundIndex];

    const est: QueueEstimate = {
      queueId: m.id,
      name: m.name,
      job: m.job,
      status: m.status,
      track: "others",
      assignedRound,
      assignedTeam,
      slotInTeam,
      trackPosition: idx + 1,
      queuesAhead: roundInfo ? roundInfo.queuesAhead : 0,
      waitMinutesMin: roundInfo ? roundInfo.waitMinutesMin : 0,
      waitMinutesMax: roundInfo ? roundInfo.waitMinutesMax : 0,
      estimatedWaitText: roundInfo ? roundInfo.estimatedWaitText : "รอบแรก (พร้อมลงทันที)",
      estimatedStartTimeText: roundInfo ? roundInfo.estimatedStartTimeText : "รอบถัดไป",
      isCurrentParty: roundInfo ? roundInfo.queuesAhead === 0 : true,
      partyNumber: assignedRound,
      partySlot: slotInRound + 1,
      partyMemberCount: roundInfo ? roundInfo.totalMembers : 1,
      globalQueueIndex: idx + 1,
    };

    estimatesById[m.id] = est;
    estimatesByName[m.name.toLowerCase()] = est;
  });

  // สมาชิกที่กำลังลงดัน (active)
  activeQueues.forEach((m, idx) => {
    const isPriest = m.job === "Priest";
    const est: QueueEstimate = {
      queueId: m.id,
      name: m.name,
      job: m.job,
      status: "active",
      track: isPriest ? "priest" : "others",
      assignedRound: 0,
      assignedTeam: 1,
      slotInTeam: idx + 1,
      trackPosition: idx + 1,
      queuesAhead: 0,
      waitMinutesMin: 0,
      waitMinutesMax: 0,
      estimatedWaitText: "กำลังลงดันเจี้ยน ⚔️",
      estimatedStartTimeText: "กำลังลงดันเจี้ยน",
      isCurrentParty: true,
      partyNumber: 0,
      partySlot: idx + 1,
      partyMemberCount: activeQueues.length,
      globalQueueIndex: 0,
    };
    estimatesById[m.id] = est;
    estimatesByName[m.name.toLowerCase()] = est;
  });

  // สมาชิกที่ลงเสร็จแล้ว (done)
  doneQueues.forEach((m) => {
    const isPriest = m.job === "Priest";
    const est: QueueEstimate = {
      queueId: m.id,
      name: m.name,
      job: m.job,
      status: "done",
      track: isPriest ? "priest" : "others",
      assignedRound: 0,
      assignedTeam: 0,
      slotInTeam: 0,
      trackPosition: 0,
      queuesAhead: 0,
      waitMinutesMin: 0,
      waitMinutesMax: 0,
      estimatedWaitText: "ลงเสร็จสิ้นแล้ว 🎉",
      estimatedStartTimeText: "เสร็จสิ้น",
      isCurrentParty: false,
      partyNumber: 0,
      partySlot: 0,
      partyMemberCount: 0,
      globalQueueIndex: 0,
    };
    estimatesById[m.id] = est;
    estimatesByName[m.name.toLowerCase()] = est;
  });

  return {
    carryTeamsCount: teamsCount,
    capacityPerRound: {
      priest: priestPerRound,
      others: othersPerRound,
      total: priestPerRound + othersPerRound,
    },
    hasActiveParty,
    activeCount: activeQueues.length,
    totalWaitingCount: waitingQueues.length,
    waitingPriestsCount: priestsQueue.length,
    waitingOthersCount: othersQueue.length,
    totalDoneCount: doneQueues.length,
    totalRoundsCount: rounds.length,
    rounds,
    totalPartiesCount: parties.length,
    parties,
    estimatesById,
    estimatesByName,
  };
}
