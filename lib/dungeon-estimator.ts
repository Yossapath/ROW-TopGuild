import type { DungeonQueue } from "@/types";

export interface QueueEstimate {
  queueId: string;
  name: string;
  job: string;
  status: "waiting" | "active" | "done";
  partyNumber: number; // ลำดับตี้ เช่น 1, 2, 3... (0 ถ้า done หรือ active)
  partySlot: number; // ตำแหน่งในตี้ 1..5
  globalQueueIndex: number; // ลำดับรวมในคิวรอ
  queuesAhead: number; // จำนวนคิวตี้ที่ต้องรอก่อนหน้า (0, 1, 2, ...)
  waitMinutesMin: number;
  waitMinutesMax: number;
  estimatedWaitText: string; // เช่น "อีก 1 คิว (~11-12 นาที)" หรือ "ถึงคิวแล้ว (คิวถัดไป)"
  estimatedStartTimeText: string; // เช่น "~14:35 - 14:38 น."
  isCurrentParty: boolean;
}

export interface DungeonPartyGroup {
  partyNumber: number;
  queuesAhead: number;
  waitMinutesMin: number;
  waitMinutesMax: number;
  estimatedWaitText: string;
  estimatedStartTimeText: string;
  members: DungeonQueue[];
}

export interface DungeonEstimateResult {
  hasActiveParty: boolean;
  activeCount: number;
  totalWaitingCount: number;
  totalDoneCount: number;
  totalPartiesCount: number;
  parties: DungeonPartyGroup[];
  estimatesById: Record<string, QueueEstimate>;
  estimatesByName: Record<string, QueueEstimate>;
}

export const MINUTES_PER_RUN_MIN = 11;
export const MINUTES_PER_RUN_MAX = 12;
export const PARTY_CAPACITY = 5;

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
 * คำนวณการจัดตี้ คิวก่อนหน้า และเวลาคาดการณ์ในการลงดันเจี้ยน
 * โดย 1 คิว (ตี้) ใช้เวลาเฉลี่ย 11-12 นาที
 */
export function calculateDungeonEstimates(
  queues: DungeonQueue[],
  now: Date = new Date()
): DungeonEstimateResult {
  const activeQueues = queues.filter((q) => q.status === "active");
  const doneQueues = queues.filter((q) => q.status === "done");
  const waitingQueues = queues.filter(
    (q) => q.status !== "active" && q.status !== "done"
  );

  const hasActiveParty = activeQueues.length > 0;

  // แบ่งกลุ่มคิวรอตามรอบและอาชีพ
  const r1Priests = waitingQueues.filter(
    (q) => !(q.rounds === 2 && q.round1 === true) && q.job === "Priest"
  );
  const r1Others = waitingQueues.filter(
    (q) => !(q.rounds === 2 && q.round1 === true) && q.job !== "Priest"
  );
  const r2Priests = waitingQueues.filter(
    (q) => q.rounds === 2 && q.round1 === true && q.job === "Priest"
  );
  const r2Others = waitingQueues.filter(
    (q) => q.rounds === 2 && q.round1 === true && q.job !== "Priest"
  );

  const priestsPool = [...r1Priests, ...r2Priests];
  const othersPool = [...r1Others, ...r2Others];

  const parties: DungeonPartyGroup[] = [];
  let partyCounter = 1;

  // จัดตี้ละ 5 คน (พระ 1 คน + อาชีพอื่น 4 คน)
  while (priestsPool.length > 0 || othersPool.length > 0) {
    const currentMembers: DungeonQueue[] = [];

    // ดึงพระ 1 คนถ้ามี
    if (priestsPool.length > 0) {
      currentMembers.push(priestsPool.shift()!);
    }

    // ดึงอาชีพอื่นให้ครบตี้ (5 คน)
    while (currentMembers.length < PARTY_CAPACITY && othersPool.length > 0) {
      currentMembers.push(othersPool.shift()!);
    }

    // ถ้าอาชีพอื่นหมด แต่ยังมีพระเหลืออยู่ ให้ดึงพระมาช่วยเติมจนครบ 5 คน
    while (currentMembers.length < PARTY_CAPACITY && priestsPool.length > 0) {
      currentMembers.push(priestsPool.shift()!);
    }

    const currentPartyNum = partyCounter++;

    // คำนวณจำนวนคิวก่อนหน้า
    let queuesAhead = 0;
    let waitMin = 0;
    let waitMax = 0;

    if (hasActiveParty) {
      // มีตี้กำลังลงอยู่
      queuesAhead = currentPartyNum; // ตี้ปัจจุบัน (1) + ตี้ก่อนหน้า (currentPartyNum - 1)
      if (currentPartyNum === 1) {
        waitMin = 3; // ตี้ปัจจุบันใกล้เสร็จ
        waitMax = MINUTES_PER_RUN_MIN;
      } else {
        waitMin = (currentPartyNum - 1) * MINUTES_PER_RUN_MIN + 3;
        waitMax = currentPartyNum * MINUTES_PER_RUN_MAX;
      }
    } else {
      // ไม่มีตี้กำลังลง
      queuesAhead = currentPartyNum - 1;
      if (currentPartyNum === 1) {
        waitMin = 0;
        waitMax = 0;
      } else {
        waitMin = (currentPartyNum - 1) * MINUTES_PER_RUN_MIN;
        waitMax = (currentPartyNum - 1) * MINUTES_PER_RUN_MAX;
      }
    }

    // ข้อความประเมินเวลา
    let estimatedWaitText = "";
    let estimatedStartTimeText = "";

    if (queuesAhead === 0) {
      estimatedWaitText = "ถึงคิวแล้ว (คิวถัดไป)";
      estimatedStartTimeText = "กำลังจะลงดัน";
    } else if (queuesAhead === 1) {
      estimatedWaitText = `อีก 1 คิว (~${waitMin}-${waitMax} นาที)`;
      const tMin = new Date(now.getTime() + waitMin * 60000);
      const tMax = new Date(now.getTime() + waitMax * 60000);
      const strMin = formatBkkTime(tMin);
      const strMax = formatBkkTime(tMax);
      estimatedStartTimeText = strMin === strMax ? `~${strMin} น.` : `~${strMin} - ${strMax} น.`;
    } else {
      estimatedWaitText = `อีก ${queuesAhead} คิว (~${waitMin}-${waitMax} นาที)`;
      const tMin = new Date(now.getTime() + waitMin * 60000);
      const tMax = new Date(now.getTime() + waitMax * 60000);
      const strMin = formatBkkTime(tMin);
      const strMax = formatBkkTime(tMax);
      estimatedStartTimeText = strMin === strMax ? `~${strMin} น.` : `~${strMin} - ${strMax} น.`;
    }

    parties.push({
      partyNumber: currentPartyNum,
      queuesAhead,
      waitMinutesMin: waitMin,
      waitMinutesMax: waitMax,
      estimatedWaitText,
      estimatedStartTimeText,
      members: currentMembers,
    });
  }

  // สร้างแมปปิ้งรายบุคคล
  const estimatesById: Record<string, QueueEstimate> = {};
  const estimatesByName: Record<string, QueueEstimate> = {};

  let globalWaitingIdx = 1;

  // สมาชิกในตี้ที่กำลังรอ
  parties.forEach((party) => {
    party.members.forEach((m, slotIdx) => {
      const est: QueueEstimate = {
        queueId: m.id,
        name: m.name,
        job: m.job,
        status: m.status,
        partyNumber: party.partyNumber,
        partySlot: slotIdx + 1,
        globalQueueIndex: globalWaitingIdx++,
        queuesAhead: party.queuesAhead,
        waitMinutesMin: party.waitMinutesMin,
        waitMinutesMax: party.waitMinutesMax,
        estimatedWaitText: party.estimatedWaitText,
        estimatedStartTimeText: party.estimatedStartTimeText,
        isCurrentParty: party.queuesAhead === 0,
      };

      estimatesById[m.id] = est;
      estimatesByName[m.name.toLowerCase()] = est;
    });
  });

  // สมาชิกที่กำลังลงดัน (active)
  activeQueues.forEach((m, idx) => {
    const est: QueueEstimate = {
      queueId: m.id,
      name: m.name,
      job: m.job,
      status: "active",
      partyNumber: 0,
      partySlot: idx + 1,
      globalQueueIndex: 0,
      queuesAhead: 0,
      waitMinutesMin: 0,
      waitMinutesMax: 0,
      estimatedWaitText: "กำลังลงดันเจี้ยน ⚔️",
      estimatedStartTimeText: "กำลังลงดันเจี้ยน",
      isCurrentParty: true,
    };
    estimatesById[m.id] = est;
    estimatesByName[m.name.toLowerCase()] = est;
  });

  // สมาชิกที่ลงเสร็จแล้ว (done)
  doneQueues.forEach((m) => {
    const est: QueueEstimate = {
      queueId: m.id,
      name: m.name,
      job: m.job,
      status: "done",
      partyNumber: 0,
      partySlot: 0,
      globalQueueIndex: 0,
      queuesAhead: 0,
      waitMinutesMin: 0,
      waitMinutesMax: 0,
      estimatedWaitText: "ลงเสร็จสิ้นแล้ว 🎉",
      estimatedStartTimeText: "เสร็จสิ้น",
      isCurrentParty: false,
    };
    estimatesById[m.id] = est;
    estimatesByName[m.name.toLowerCase()] = est;
  });

  return {
    hasActiveParty,
    activeCount: activeQueues.length,
    totalWaitingCount: waitingQueues.length,
    totalDoneCount: doneQueues.length,
    totalPartiesCount: parties.length,
    parties,
    estimatesById,
    estimatesByName,
  };
}
