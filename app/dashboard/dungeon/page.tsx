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
  Play,
  AlertCircle,
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
import { TeamBoard } from "@/components/dungeon/TeamBoard";
import { QueueBoard } from "@/components/dungeon/QueueBoard";

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
        setFormMsg({ type: "ok", text: "จองคิวสำเร็จ" });
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
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-600 dark:text-white mb-1">
                  ชื่อตัวละคร <span className="text-red-500">*</span>
                </label>
                {isAdmin ? (
                  <div className="relative">
                    <input
                      value={formName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormName(val);
                      }}
                      onFocus={() => {
                        const dropdownState = document.getElementById("roster-dropdown");
                        if(dropdownState) dropdownState.style.display = "block";
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          const dropdownState = document.getElementById("roster-dropdown");
                          if(dropdownState) dropdownState.style.display = "none";
                        }, 200);
                      }}
                      placeholder="พิมพ์หรือเลือกชื่อ…"
                      className="w-full border border-slate-200 dark:border-[#2D3342] rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#272C38] text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#4D73CD] dark:focus:ring-[#4D73CD]"
                    />
                    <div id="roster-dropdown" className="hidden absolute z-50 w-full mt-1 bg-white dark:bg-[#272C38] border border-slate-200 dark:border-[#2D3342] rounded-lg shadow-lg max-h-60 overflow-auto">
                      {rosterMembers
                        .filter(m => !queues.some(q => (q.status === 'waiting' || q.status === 'active') && q.name === m.name))
                        .filter(m => formName === "" || m.name.toLowerCase().includes(formName.toLowerCase()))
                        .map((m) => (
                        <div 
                          key={m.name} 
                          className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-[#323847] text-slate-800 dark:text-white flex items-center justify-between"
                          onClick={() => {
                            setFormName(m.name);
                            setFormJob(m.job);
                          }}
                        >
                          <span className="font-medium">{m.name}</span>
                          <span className="text-xs opacity-60 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: JOB_COLORS[m.job] || '#888' }} />
                            {m.job}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
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
                      {r === 1 ? "1 รอบ" : "2 รอบ"}
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
                    <span>จำนวนทีมแบก (Carry Teams)</span>
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
            RIGHT PANEL — Team & Queue List
        ═══════════════════════════════════════════════════ */}
        <div className="flex-1 min-w-0">
          <TeamBoard />
          <QueueBoard />
        </div>
      </div>
    </div>
  );
}