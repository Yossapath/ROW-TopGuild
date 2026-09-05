"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Swords,
  ListPlus,
  Clock,
  Trash2,
  CheckCircle,
  Copy,
  Share2,
  Calendar,
  RefreshCw,
  Shield,
  Search,
  FastForward,
  RotateCcw,
} from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  JOB_COLORS,
  JOB_LIST,
  isBookingOpen,
  formatTimestamp,
} from "@/lib/utils";
import { calculateDungeonEstimates } from "@/lib/dungeon-estimator";
import type { DungeonQueue, DungeonSchedule } from "@/types";

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  waiting: { label: "รอคิว", cls: "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400" },
  active:  { label: "กำลังลง", cls: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-white" },
  done:    { label: "เสร็จแล้ว", cls: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400" },
  skipped: { label: "ข้าม (ไม่อยู่)", cls: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/40" },
};

// ────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────
export default function DungeonPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  // Queue state
  const [queues, setQueues] = useState<DungeonQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [carryTeamsCount, setCarryTeamsCount] = useState<number>(1);

  // ── Real-time clock for countdown display ─────────────────
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const estimates = useMemo(
    () => calculateDungeonEstimates(queues, new Date(now), carryTeamsCount),
    [queues, carryTeamsCount, now]
  );

  // Form state
  const [formName, setFormName] = useState("");
  const [formJob, setFormJob] = useState(JOB_LIST[0] ?? "");
  const [formRounds, setFormRounds] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Schedule state
  const [schedule, setSchedule] = useState<DungeonSchedule>({
    openDate: "",
    openTime: "06:00",
    closeTime: "23:59",
    carryTeamsCount: 1,
  });
  const [schedDate, setSchedDate] = useState("");
  const [schedOpen, setSchedOpen] = useState("06:00");
  const [schedClose, setSchedClose] = useState("23:59");
  const [schedUnlimited, setSchedUnlimited] = useState(false);
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedMsg, setSchedMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Roster autocomplete
  const [rosterMembers, setRosterMembers] = useState<{name: string, job: string}[]>([]);

  // Clipboard toast
  const [copied, setCopied] = useState(false);

  // Search & filter state
  const [search, setSearch] = useState("");
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);

  const filteredQueues = useMemo(() => {
    return queues.filter((q) => {
      const matchSearch = !search || q.name.toLowerCase().includes(search.toLowerCase());
      const matchJob = selectedJobs.length === 0 || selectedJobs.includes(q.job);
      return matchSearch && matchJob;
    });
  }, [queues, search, selectedJobs]);

  // ── Fetch queues ──────────────────────────────────────────
  const fetchQueues = useCallback(async () => {
    try {
      const res = await fetch("/api/dungeon/queues");
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setQueues(json.data as DungeonQueue[]);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch schedule ────────────────────────────────────────
  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch("/api/dungeon/schedule");
      const json = await res.json();
      if (json.ok && json.data) {
        const s: DungeonSchedule = json.data;
        setSchedule(s);
        setSchedDate(s.openDate ?? "");
        setSchedOpen(s.openTime ?? "06:00");
        setSchedClose(s.closeTime ?? "23:59");
        if (s.carryTeamsCount) {
          setCarryTeamsCount(s.carryTeamsCount);
        }
      }
    } catch {
      /* silent */
    }
  }, []);

  // ── Update carry teams count (auto-saved) ──────────────────
  const updateCarryTeamsCount = async (count: number) => {
    const validCount = Math.max(1, count);
    setCarryTeamsCount(validCount);
    try {
      await fetch("/api/dungeon/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carryTeamsCount: validCount }),
      });
    } catch {
      /* silent */
    }
  };

  // ── Fetch roster names ────────────────────────────────────
  const fetchRoster = useCallback(async () => {
    try {
      const res = await fetch("/api/roster");
      const json = await res.json();
      if (json.ok && json.data) {
        const members: {name: string, job: string}[] = [];
        for (const [job, arr] of Object.entries(json.data as Record<string, { name: string }[]>)) {
          for (const m of arr) {
            members.push({ name: m.name, job });
          }
        }
        setRosterMembers(members);
      }
    } catch {
      /* silent */
    }
  }, []);

  // ── Polling ───────────────────────────────────────────────
  useEffect(() => {
    fetchQueues();
    fetchSchedule();
    fetchRoster();
    const interval = setInterval(fetchQueues, 10_000);
    return () => clearInterval(interval);
  }, [fetchQueues, fetchSchedule, fetchRoster]);

  // ── Auto-fill & Lock for Member ───────────────────────────
  useEffect(() => {
    if (!isAdmin && user?.gameUsername) {
      setFormName(user.gameUsername);
      if (user.class) {
        setFormJob(user.class);
      }
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (!isAdmin && user?.gameUsername && rosterMembers.length > 0) {
      const found = rosterMembers.find((m) => m.name === user.gameUsername);
      if (found) {
        setFormJob(found.job);
      }
    }
  }, [user, isAdmin, rosterMembers]);

  // ── Submit queue booking ──────────────────────────────────
  const handleSubmit = async () => {
    if (!formName.trim()) {
      setFormMsg({ type: "err", text: "กรุณากรอกชื่อตัวละคร" });
      return;
    }
    if (!formJob) {
      setFormMsg({ type: "err", text: "กรุณาเลือกอาชีพ" });
      return;
    }
    setSubmitting(true);
    setFormMsg(null);
    try {
      const res = await fetch("/api/dungeon/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          job: formJob,
          dungeon: "maya",
          power: 0,
          rounds: formRounds,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setFormMsg({ type: "ok", text: "จองคิวสำเร็จ! 🎉" });
        if (isAdmin) {
          setFormName("");
          setFormJob(JOB_LIST[0] ?? "");
        }
        setFormRounds(1);
        fetchQueues();
      } else {
        setFormMsg({ type: "err", text: json.error ?? "เกิดข้อผิดพลาด" });
      }
    } catch {
      setFormMsg({ type: "err", text: "ไม่สามารถเชื่อมต่อได้" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Save schedule ─────────────────────────────────────────
  const handleSaveSchedule = async () => {
    setSchedSaving(true);
    setSchedMsg(null);
    try {
      const body: DungeonSchedule = schedUnlimited
        ? { openDate: "", openTime: "", closeTime: "", carryTeamsCount }
        : { openDate: schedDate, openTime: schedOpen, closeTime: schedClose, carryTeamsCount };
      const res = await fetch("/api/dungeon/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.ok) {
        setSchedule(body);
        setSchedMsg({ type: "ok", text: "บันทึกสำเร็จ" });
      } else {
        setSchedMsg({ type: "err", text: json.error ?? "เกิดข้อผิดพลาด" });
      }
    } catch {
      setSchedMsg({ type: "err", text: "ไม่สามารถเชื่อมต่อได้" });
    } finally {
      setSchedSaving(false);
    }
  };

  // ── Mark round done ───────────────────────────────────────
  const handleRound = async (queueId: string, round: 1 | 2) => {
    try {
      const res = await fetch(`/api/dungeon/queues/${queueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round }),
      });
      const json = await res.json();
      if (json.ok) fetchQueues();
    } catch {
      /* silent */
    }
  };

  // ── Skip / Unskip queue item ──────────────────────────────
  const handleSkip = async (queueId: string, currentStatus: string) => {
    const action = currentStatus === "skipped" ? "unskip" : "skip";
    try {
      const res = await fetch(`/api/dungeon/queues/${queueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.ok) fetchQueues();
    } catch {
      /* silent */
    }
  };

  // ── Start run (เริ่มรันคิว → sets status active + startTime) ───
  const handleStartRun = async (queueId: string) => {
    try {
      const res = await fetch(`/api/dungeon/queues/${queueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "startRun" }),
      });
      const json = await res.json();
      if (json.ok) fetchQueues();
    } catch {
      /* silent */
    }
  };


  // ── Delete queue item ─────────────────────────────────────
  const handleDelete = async (queueId: string) => {
    if (!confirm("ลบรายการนี้ออกจากคิว?")) return;
    try {
      await fetch(`/api/dungeon/queues/${queueId}`, { method: "DELETE" });
      fetchQueues();
    } catch {
      /* silent */
    }
  };

  // ── Copy booking link ─────────────────────────────────────
  const handleCopyLink = () => {
    const url = `${window.location.origin}/booking`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Booking status ────────────────────────────────────────
  const bookingStatus = isBookingOpen(schedule);
  const isUnlimited = !schedule.openTime && !schedule.closeTime;

  // Collapsible panels
  const [formCollapsed, setFormCollapsed] = useState(false);
  const [schedCollapsed, setSchedCollapsed] = useState(false);

  // ────────────────────────────────────────────────────────────
  return (
    <div style={{ zoom: 0.85 }} className="min-h-screen bg-[#f0f6fc] dark:bg-[#1C1F27] p-4 lg:py-8 lg:px-12 xl:px-24 2xl:px-32">

      {/* Header Card */}
      <div className="bg-white dark:bg-[#232733] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] p-5 mb-5 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#0b3d63] dark:bg-[#3B66D1] shadow-sm">
          <Swords className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">ระบบจองดันมายา</h1>
          <p className="text-sm text-slate-500 dark:text-[#8B93A7]">จองคิวดันเจี้ยนมายา · 5 คนต่อทีม · 1-2 รอบต่อรอบ</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">

        {/* ═══════════════════════════════════════════════════
            LEFT PANEL
        ═══════════════════════════════════════════════════ */}
        <div className="lg:max-w-sm w-full flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">

          {/* Booking Form Card */}
          <div className="bg-white dark:bg-[#232733] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] overflow-hidden">
            <button
              type="button"
              onClick={() => setFormCollapsed(c => !c)}
              className="w-full bg-[#0b3d63] dark:bg-[#252E42] px-5 py-4 flex items-center justify-between border-b border-transparent dark:border-[#2D3342]"
            >
              <div className="flex items-center gap-2">
                <Swords className="text-white" size={20} />
                <h2 className="text-white font-bold text-base">ระบบจองคิว ดันมายา (Maya)</h2>
              </div>
              <span className="text-blue-200 text-lg">{formCollapsed ? "▸" : "▾"}</span>
            </button>
            {!formCollapsed && <p className="text-[#0b3d63] dark:text-white text-xs px-5 pt-2 pb-1 font-medium">5 คนต่อทีม · จองได้ 1-2 รอบต่อรอบ</p>}

            {!formCollapsed && <div className="p-5 flex flex-col gap-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-white mb-1">
                  ชื่อตัวละคร <span className="text-red-500">*</span>
                </label>
                {isAdmin ? (
                  <>
                    <input
                      list="roster-names"
                      value={formName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormName(val);
                        const member = rosterMembers.find((m) => m.name === val);
                        if (member) {
                          setFormJob(member.job);
                        }
                      }}
                      placeholder="พิมพ์หรือเลือกชื่อ…"
                      className="w-full border border-slate-200 dark:border-[#2D3342] rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#272C38] text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#4D73CD] dark:focus:ring-[#4D73CD]"
                    />
                    <datalist id="roster-names">
                      {rosterMembers.map((m) => (
                        <option key={m.name} value={m.name} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={formName}
                      placeholder="ใส่ชื่อตัวละคร..."
                      className="w-full border border-slate-200 dark:border-[#2D3342] rounded-lg px-3 py-2 text-sm bg-slate-100 dark:bg-[#272C38] text-slate-500 dark:text-[#8B93A7] cursor-not-allowed font-medium"
                    />
                    <p className="text-[11px] text-slate-400 dark:text-[#6B7280] mt-1">ชื่อและอาชีพถูกดึงจากโปรไฟล์ของคุณ</p>
                  </div>
                )}
              </div>

              {/* Job */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-white mb-1">
                  อาชีพ <span className="text-red-500">*</span>
                </label>
                {isAdmin ? (
                  <select
                    value={formJob}
                    onChange={(e) => setFormJob(e.target.value)}
                    className="w-full border border-slate-200 dark:border-[#2D3342] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4D73CD] dark:focus:ring-[#4D73CD] bg-white dark:bg-[#272C38] text-slate-800 dark:text-white"
                  >
                    {JOB_LIST.map((j) => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full border border-slate-200 dark:border-[#2D3342] rounded-lg px-3 py-2 text-sm bg-slate-100 dark:bg-[#272C38] text-slate-500 dark:text-[#8B93A7] cursor-not-allowed font-medium flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{ backgroundColor: JOB_COLORS[formJob] ?? "#94a3b8" }}
                    />
                    {formJob || "กำลังโหลด..."}
                  </div>
                )}
              </div>

              {/* Rounds toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-white mb-2">จำนวนรอบ</label>
                <div className="flex gap-2">
                  {([1, 2] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setFormRounds(r)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formRounds === r
                          ? "bg-[#0b3d63] dark:bg-[#3B66D1] text-white"
                          : "bg-slate-100 dark:bg-[#272C38] text-slate-600 dark:text-white hover:bg-slate-200 dark:hover:bg-[#2F3547]"
                      }`}
                    >
                      {r === 1 ? "↑ 1 รอบ" : "✕ 2 รอบ"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-[#3B66D1] hover:bg-[#4D73CD] text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <ListPlus size={16} />
                {submitting ? "กำลังจอง…" : "จองคิวดันมายา"}
              </button>

              {/* Form message */}
              {formMsg && (
                <p className={`text-sm rounded-lg px-3 py-2 ${
                  formMsg.type === "ok"
                    ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400"
                    : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                }`}>
                  {formMsg.text}
                </p>
              )}
            </div>}
          </div>

          {/* Schedule Settings Card (admin/owner only) */}
          {isAdmin && (
            <div className="bg-[#eef3f8] dark:bg-[#232733] rounded-2xl border border-slate-200 dark:border-[#2D3342] overflow-hidden">
              <button
                type="button"
                onClick={() => setSchedCollapsed(c => !c)}
                className="w-full px-5 py-4 border-b border-slate-200 dark:border-[#2D3342] flex items-center justify-between hover:bg-[#e5edf5] dark:hover:bg-[#2A2F3E] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-[#0b3d63] dark:text-white" />
                  <h3 className="font-bold text-sm text-[#0b3d63] dark:text-white">ตั้งค่าช่วงเวลาเปิดจอง</h3>
                </div>
                <span className="text-[#0b3d63] dark:text-white text-lg">{schedCollapsed ? "▸" : "▾"}</span>
              </button>

              {!schedCollapsed && <div className="p-5 flex flex-col gap-3">
                {/* Open date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-white mb-1">
                    <Calendar size={12} className="inline mr-1" />วันที่เปิดจอง
                  </label>
                  <input
                    type="date"
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    disabled={schedUnlimited}
                    className="w-full border border-slate-200 dark:border-[#2D3342] rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#272C38] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4D73CD] dark:focus:ring-[#4D73CD] disabled:opacity-40"
                  />
                </div>

                {/* Open / Close time */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-white mb-1">เวลาเปิด</label>
                    <input
                      type="time"
                      lang="en-GB"
                      value={schedOpen}
                      onChange={(e) => setSchedOpen(e.target.value)}
                      disabled={schedUnlimited}
                      className="w-full border border-slate-200 dark:border-[#2D3342] rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#272C38] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4D73CD] dark:focus:ring-[#4D73CD] disabled:opacity-40"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-white mb-1">เวลาปิด</label>
                    <input
                      type="time"
                      lang="en-GB"
                      value={schedClose}
                      onChange={(e) => setSchedClose(e.target.value)}
                      disabled={schedUnlimited}
                      className="w-full border border-slate-200 dark:border-[#2D3342] rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#272C38] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4D73CD] dark:focus:ring-[#4D73CD] disabled:opacity-40"
                    />
                  </div>
                </div>

                {/* Unlimited toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={schedUnlimited}
                    onChange={(e) => setSchedUnlimited(e.target.checked)}
                    className="w-4 h-4 accent-[#0b3d63] dark:accent-sky-500"
                  />
                  <span className="text-xs text-slate-600 dark:text-white">เปิดจองไม่จำกัดเวลา</span>
                </label>

                {/* Carry Teams setting */}
                <div className="pt-2 border-t border-slate-200 dark:border-[#2D3342]">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-white mb-1.5 flex items-center justify-between">
                    <span>🛡️ จำนวนทีมแบก (Carry Teams)</span>
                    <span className="text-[#3B66D1] dark:text-[#82A0F5] font-bold">{carryTeamsCount} ทีม</span>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {[1, 2, 3, 4].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => updateCarryTeamsCount(num)}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                          carryTeamsCount === num
                            ? "bg-[#0b3d63] dark:bg-[#3B66D1] text-white border-transparent shadow-xs"
                            : "bg-white dark:bg-[#272C38] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D3342] hover:bg-slate-50 dark:hover:bg-[#2F3547]"
                        }`}
                      >
                        {num} ทีม
                      </button>
                    ))}
                  </div>
                  <div className="bg-blue-50/80 dark:bg-[#202636] border border-blue-100 dark:border-[#2D3342] rounded-lg p-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <p className="font-semibold text-blue-800 dark:text-[#82A0F5]">
                      กำลังแบก: {carryTeamsCount} ทีม (~11-12 นาที/รอบ)
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-[#8B93A7] mt-0.5">
                      • พระ {carryTeamsCount * 1} คน/รอบ (ทีมละ 1)
                      {" • "}
                      อาชีพอื่น {carryTeamsCount * 2} คน/รอบ (ทีมละ 2)
                    </p>
                  </div>
                </div>

                {/* Save button */}
                <button
                  onClick={handleSaveSchedule}
                  disabled={schedSaving}
                  className="flex items-center justify-center gap-2 bg-[#3B66D1] hover:bg-[#4D73CD] text-white rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-50 mt-1"
                >
                  <CheckCircle size={14} />
                  {schedSaving ? "กำลังบันทึก…" : "บันทึกตั้งค่า"}
                </button>

                {/* Schedule message */}
                {schedMsg && (
                  <p className={`text-xs rounded-lg px-3 py-2 ${
                    schedMsg.type === "ok" ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                  }`}>
                    {schedMsg.text}
                  </p>
                )}

                {/* Booking status badge */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500 dark:text-[#8B93A7]">สถานะ:</span>
                  {isUnlimited ? (
                    <span className="text-xs bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 rounded-full px-2 py-0.5 font-medium">
                      เปิดจองไม่จำกัดเวลา
                    </span>
                  ) : bookingStatus.open ? (
                    <span className="text-xs bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 rounded-full px-2 py-0.5 font-medium">
                      เปิดจองอยู่
                    </span>
                  ) : (
                    <span className="text-xs bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-full px-2 py-0.5 font-medium">
                      ปิดจอง
                    </span>
                  )}
                </div>
              </div>}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════
            RIGHT PANEL — Queue List
        ═══════════════════════════════════════════════════ */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-700 dark:text-white">รายชื่อคิว</span>
              <span className="bg-[#0b3d63] dark:bg-[#3B66D1] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {queues.length} คน
              </span>
              <span className="text-xs font-bold text-blue-700 dark:text-[#82A0F5] bg-blue-50 dark:bg-[#3B66D1]/20 border border-blue-200 dark:border-[#4D73CD]/30 px-2.5 py-1 rounded-lg">
                🛡️ ทีมแบก {carryTeamsCount} ทีม (พระ {estimates.capacityPerRound.priest} + อื่นๆ {estimates.capacityPerRound.others}/รอบ)
              </span>
              <span className="text-xs font-bold text-slate-600 dark:text-[#8B93A7] bg-white dark:bg-[#232733] border border-slate-200 dark:border-[#2D3342] px-2.5 py-1 rounded-lg">
                ⏱️ {estimates.totalRoundsCount} รอบ (~11-12 นาที/รอบ)
              </span>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#8B93A7]" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อตัวละคร..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-[#2D3342] rounded-lg text-xs bg-white dark:bg-[#272C38] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-[#8B93A7] focus:outline-none focus:ring-2 focus:ring-[#4D73CD]"
                />
              </div>
              <button
                onClick={fetchQueues}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#272C38] transition-colors text-slate-500 dark:text-[#8B93A7] hover:text-slate-800 dark:hover:text-white"
                title="รีเฟรช"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {/* Job Filter Pills */}
          <div className="flex items-center gap-1.5 mb-4 flex-wrap">
            <button
              onClick={() => setSelectedJobs([])}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                selectedJobs.length === 0
                  ? "bg-[#0b3d63] dark:bg-[#3B66D1] text-white"
                  : "bg-white dark:bg-[#272C38] text-slate-600 dark:text-[#8B93A7] border border-slate-200 dark:border-[#2D3342] hover:bg-slate-50 dark:hover:bg-[#2F3547]"
              }`}
            >
              ทั้งหมด ({queues.length})
            </button>
            {JOB_LIST.map((job) => {
              const count = queues.filter((q) => q.job === job).length;
              if (count === 0) return null;
              const isSelected = selectedJobs.includes(job);
              return (
                <button
                  key={job}
                  onClick={() => {
                    setSelectedJobs(prev =>
                      prev.includes(job) ? prev.filter(j => j !== job) : [...prev, job]
                    );
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-[#0b3d63] dark:bg-[#3B66D1] text-white shadow-xs"
                      : "bg-white dark:bg-[#272C38] text-slate-600 dark:text-[#8B93A7] border border-slate-200 dark:border-[#2D3342] hover:bg-slate-50 dark:hover:bg-[#2F3547]"
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: JOB_COLORS[job] ?? "#94a3b8" }}
                  />
                  {job} ({count})
                </button>
              );
            })}
          </div>

          {/* Queue list container */}
          <div className="bg-white dark:bg-[#232733] rounded-2xl border border-slate-200 dark:border-[#2D3342] p-4">
            {loading ? (
              <div className="text-center py-12 text-slate-400 dark:text-[#8B93A7]">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                กำลังโหลดคิว…
              </div>
            ) : filteredQueues.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-[#8B93A7]">
                <Swords size={36} className="mx-auto mb-2 opacity-30" />
                {search || selectedJobs.length > 0 ? "ไม่พบรายการที่ตรงกับตัวกรอง" : "ยังไม่มีคิว"}
              </div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  let currentGlobalIdx = 1;

                  const waitingR1Priests = filteredQueues.filter(q => q.status === "waiting" && !(q.rounds === 2 && q.round1 === true) && q.job === "Priest");
                  const waitingR1Others = filteredQueues.filter(q => q.status === "waiting" && !(q.rounds === 2 && q.round1 === true) && q.job !== "Priest");
                  const waitingR2Priests = filteredQueues.filter(q => q.status === "waiting" && (q.rounds === 2 && q.round1 === true) && q.job === "Priest");
                  const waitingR2Others = filteredQueues.filter(q => q.status === "waiting" && (q.rounds === 2 && q.round1 === true) && q.job !== "Priest");
                  const activeQueues = filteredQueues.filter(q => q.status === "active");
                  const skippedQueues = filteredQueues.filter(q => q.status === "skipped");
                  const doneQueues = filteredQueues.filter(q => q.status === "done");

                  const renderQueue = (q: DungeonQueue, idx: number, isDone: boolean, isR2 = false) => {
                    const statusBadge = STATUS_BADGE[q.status] ?? STATUS_BADGE.waiting;
                    const jobColor = JOB_COLORS[q.job] ?? "#888";
                    const qEst = estimates.estimatesById[q.id] || estimates.estimatesByName[q.name.toLowerCase()];
                    const isSkipped = q.status === "skipped";

                    return (
                      <div
                        key={q.id}
                        className={`rounded-xl p-3.5 flex items-center justify-between gap-3 border transition-colors ${
                          isDone
                            ? "bg-slate-50 dark:bg-[#272C38] border-slate-100 dark:border-[#2D3342] opacity-50"
                            : isSkipped
                            ? "bg-amber-50/20 dark:bg-amber-950/10 border-amber-300/70 dark:border-amber-700/50"
                            : q.status === "active"
                            ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-300/70 dark:border-blue-700/50 shadow-sm"
                            : "bg-slate-50 dark:bg-[#272C38] border-slate-200 dark:border-[#2D3342]"
                        } ${isR2 && !isDone && !isSkipped ? "border-l-4 border-l-purple-500" : ""}`}
                      >
                        {/* Number */}
                        <span className="font-mono text-xs font-bold text-slate-400 dark:text-[#8B93A7] w-6 shrink-0 text-center">
                          {idx}
                        </span>

                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* name : {q.name}   |   class : {q.job} */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs text-slate-400 dark:text-[#8B93A7] font-medium">name :</span>
                              <span className="font-bold text-slate-800 dark:text-white text-base">{q.name}</span>

                              <span className="text-slate-300 dark:text-[#4B5563] mx-1">|</span>

                              <span className="text-xs text-slate-400 dark:text-[#8B93A7] font-medium">class :</span>
                              <span
                                className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: jobColor + "44",
                                  color: jobColor,
                                  border: `1px solid ${jobColor}66`,
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: jobColor }}
                                />
                                {q.job}
                              </span>
                            </div>

                            {/* 2 rounds badge */}
                            {q.rounds === 2 && (
                              <span className="text-xs bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-medium px-2 py-0.5 rounded-full">
                                ✕ 2 รอบ
                              </span>
                            )}

                            {/* Carry Round & Team Badge — no slot number */}
                            {qEst && qEst.assignedRound > 0 && !isDone && !isSkipped && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#0b3d63]/10 dark:bg-[#3B66D1]/20 text-[#0b3d63] dark:text-[#82A0F5] border border-[#0b3d63]/20 dark:border-[#4D73CD]/30">
                                {qEst.track === "priest"
                                  ? `โควตาพระ · รอบที่ ${qEst.assignedRound} (ทีม ${qEst.assignedTeam})`
                                  : `รอบที่ ${qEst.assignedRound} · ทีม ${qEst.assignedTeam}`}
                              </span>
                            )}

                            {/* Status badge */}
                            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusBadge.cls}`}>
                              {statusBadge.label}
                            </span>
                          </div>

                          {/* Estimated time for waiting */}
                          {qEst && qEst.status === "waiting" && (
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                              {qEst.queuesAhead === 0 ? (
                                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1">
                                  🚀 ถึงคิวแล้ว (ทีมแบก {qEst.assignedTeam} · รอเริ่มรัน)
                                </span>
                              ) : (
                                <>
                                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/40 flex items-center gap-1">
                                    <Clock size={11} />
                                    อีก {qEst.queuesAhead} รอบ (~{qEst.waitMinutesMin}-{qEst.waitMinutesMax} นาที)
                                  </span>
                                  <span className="text-[11px] font-bold text-blue-600 dark:text-[#82A0F5]">
                                    🕒 คาดว่าได้ลง {qEst.estimatedStartTimeText}
                                  </span>
                                </>
                              )}
                            </div>
                          )}

                          {/* Real-time elapsed + ETA for active players */}
                          {q.status === "active" && q.startTime && !isDone && (
                            (() => {
                              const elapsed = Math.floor((now - q.startTime) / 1000);
                              const elapsedMin = Math.floor(elapsed / 60);
                              const elapsedSec = elapsed % 60;
                              // Each run is 11–12 min; show how long until done
                              const etaMaxSec = 12 * 60 - elapsed;
                              const etaStr = etaMaxSec > 0
                                ? `เหลืออีกประมาณ ${Math.floor(etaMaxSec / 60)} นาที ${etaMaxSec % 60} วินาที`
                                : "ครบเวลาแล้ว";
                              return (
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                                  <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800/40 flex items-center gap-1">
                                    ⏱ กำลังลง {elapsedMin} นาที {String(elapsedSec).padStart(2, "0")} วินาที
                                  </span>
                                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                    {etaStr}
                                  </span>
                                </div>
                              );
                            })()
                          )}

                          {isSkipped && (
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                              ⚠️ ผู้เล่นไม่อยู่ขณะเรียกคิว (สามารถกดปุ่ม &quot;กลับเข้าคิว&quot; เมื่อผู้เล่นกลับมา)
                            </div>
                          )}

                          {/* Power + timestamp */}
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {q.power > 0 && (
                              <span className="text-xs text-slate-500 dark:text-[#8B93A7]">
                                <Shield size={11} className="inline mr-0.5" />
                                {q.power.toLocaleString()}
                              </span>
                            )}
                            <span className="text-xs text-slate-400 dark:text-[#6B7280]">{formatTimestamp(q.timestamp)}</span>
                          </div>
                        </div>

                        {/* Round indicators + Admin actions */}
                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                          {isSkipped ? (
                            <>
                              {/* Return to queue button */}
                              {isAdmin && (
                                <button
                                  onClick={() => handleSkip(q.id, q.status)}
                                  className="text-sm font-semibold px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                  title="นำผู้เล่นกลับเข้าคิว (ต่อท้ายคิวปัจจุบัน)"
                                >
                                  <RotateCcw size={15} />
                                  กลับเข้าคิว
                                </button>
                              )}

                              {/* Admin delete */}
                              {isAdmin && (
                                <button
                                  onClick={() => handleDelete(q.id)}
                                  className="text-sm font-semibold px-3.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/30 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Trash2 size={15} />
                                  ลบ
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              {/* เริ่มรันคิว — only show when waiting & it's this player's turn (queuesAhead===0) */}
                              {isAdmin && q.status === "waiting" && qEst && qEst.queuesAhead === 0 && (
                                <button
                                  onClick={() => handleStartRun(q.id)}
                                  className="text-sm font-semibold px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                                  title="กดเพื่อเริ่มรันคิว (ตั้งสถานะกำลังลง)"
                                >
                                  🎮 เริ่มรันคิว
                                </button>
                              )}

                              {/* Round 1 — mark round 1 as done */}
                              {!isDone && (
                                <button
                                  onClick={() => isAdmin && handleRound(q.id, 1)}
                                  disabled={q.status !== "active"}
                                  className={`text-sm font-semibold px-3.5 py-1.5 rounded-xl transition-all ${
                                    q.round1
                                      ? "bg-emerald-600 text-white shadow-xs"
                                      : q.status !== "active"
                                      ? "bg-slate-100 dark:bg-[#202636] text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-[#3A4256] cursor-not-allowed opacity-50"
                                      : "bg-slate-100 dark:bg-[#202636] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#3A4256] " +
                                        (isAdmin
                                          ? "hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600 hover:border-transparent cursor-pointer"
                                          : "cursor-default")
                                  }`}
                                  title={q.status !== "active" ? "กดเริ่มรันคิวก่อน" : (isAdmin ? "คลิกเพื่อทำเครื่องหมายรอบ 1 เสร็จ" : undefined)}
                                >
                                  รอบ 1
                                </button>
                              )}

                              {/* Round 2 (only if rounds=2) — mark round 2 as done */}
                              {q.rounds === 2 && !isDone && (
                                <button
                                  onClick={() => isAdmin && handleRound(q.id, 2)}
                                  disabled={!q.round1}
                                  className={`text-sm font-semibold px-3.5 py-1.5 rounded-xl transition-all ${
                                    q.round2
                                      ? "bg-purple-600 text-white shadow-xs"
                                      : !q.round1
                                      ? "bg-slate-100 dark:bg-[#202636] text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-[#3A4256] cursor-not-allowed opacity-50"
                                      : "bg-slate-100 dark:bg-[#202636] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#3A4256] " +
                                        (isAdmin
                                          ? "hover:bg-purple-500 hover:text-white dark:hover:bg-purple-600 hover:border-transparent cursor-pointer"
                                          : "cursor-default")
                                  }`}
                                  title={!q.round1 ? "ต้องทำเครื่องหมายรอบ 1 ก่อน" : (isAdmin ? "คลิกเพื่อทำเครื่องหมายรอบ 2 เสร็จ" : undefined)}
                                >
                                  รอบ 2
                                </button>
                              )}

                              {/* Skip button (ถ้าผู้เล่นไม่อยู่) */}
                              {isAdmin && !isDone && q.status !== "active" && (
                                <button
                                  onClick={() => handleSkip(q.id, q.status)}
                                  className="text-sm font-semibold px-3.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 transition-colors flex items-center gap-1.5 cursor-pointer"
                                  title="ผู้เล่นไม่อยู่ - กดข้ามเพื่อให้คิวถัดไปได้ลงก่อน"
                                >
                                  <FastForward size={15} />
                                  ข้าม
                                </button>
                              )}

                              {/* Admin delete */}
                              {isAdmin && (
                                <button
                                  onClick={() => handleDelete(q.id)}
                                  className="text-sm font-semibold px-3.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/30 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Trash2 size={15} />
                                  ลบ
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <>
                      {activeQueues.length > 0 && (
                        <div className="text-xs font-bold text-blue-600 dark:text-[#82A0F5] mt-2 px-2 flex items-center gap-1.5">
                          <span>กำลังลงดันเจี้ยน (Active)</span>
                          <span className="bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-[#82A0F5] text-[10px] px-2 py-0.5 rounded-full font-bold">
                            {activeQueues.length}
                          </span>
                        </div>
                      )}
                      {activeQueues.map(q => renderQueue(q, currentGlobalIdx++, false))}

                      {waitingR1Priests.length > 0 && (
                        <div className="text-xs font-bold text-blue-700 dark:text-white mt-2 px-2">พระ (Priest) - รอคิวรอบ 1</div>
                      )}
                      {waitingR1Priests.map(q => renderQueue(q, currentGlobalIdx++, false))}
                      
                      {waitingR1Others.length > 0 && (
                        <div className="text-xs font-bold text-slate-500 dark:text-[#8B93A7] mt-2 px-2">อาชีพอื่นๆ - รอคิวรอบ 1</div>
                      )}
                      {waitingR1Others.map(q => renderQueue(q, currentGlobalIdx++, false))}

                      {waitingR2Priests.length > 0 && (
                        <div className="text-xs font-bold text-purple-700 dark:text-purple-400 mt-2 px-2 border-t border-slate-200 dark:border-[#2D3342] pt-3">พระ (Priest) - รอคิวรอบ 2</div>
                      )}
                      {waitingR2Priests.map(q => renderQueue(q, currentGlobalIdx++, false, true))}
                      
                      {waitingR2Others.length > 0 && (
                        <div className="text-xs font-bold text-purple-700 dark:text-purple-400 mt-2 px-2 border-t border-slate-200 dark:border-[#2D3342] pt-3">อาชีพอื่นๆ - รอคิวรอบ 2</div>
                      )}
                      {waitingR2Others.map(q => renderQueue(q, currentGlobalIdx++, false, true))}

                      {skippedQueues.length > 0 && (
                        <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-2 px-2 border-t border-slate-200 dark:border-[#2D3342] pt-3 flex items-center gap-1.5">
                          <span>ข้ามคิว (ไม่อยู่ / รอเรียกใหม่)</span>
                          <span className="bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            {skippedQueues.length}
                          </span>
                        </div>
                      )}
                      {skippedQueues.map(q => renderQueue(q, currentGlobalIdx++, false))}

                      {doneQueues.length > 0 && (
                        <div className="text-xs font-bold text-green-600 dark:text-emerald-400 mt-2 px-2 border-t border-slate-200 dark:border-[#2D3342] pt-3">ลงเสร็จแล้ว</div>
                      )}
                      {doneQueues.map(q => renderQueue(q, currentGlobalIdx++, true))}
                    </>
                  );
              })()}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}