"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
} from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  JOB_COLORS,
  JOB_LIST,
  isBookingOpen,
  formatTimestamp,
} from "@/lib/utils";
import type { DungeonQueue, DungeonSchedule } from "@/types";

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  waiting: { label: "รอคิว", cls: "bg-yellow-100 text-yellow-700" },
  active:  { label: "กำลังลง", cls: "bg-blue-100 text-blue-700" },
  done:    { label: "เสร็จแล้ว", cls: "bg-green-100 text-green-700" },
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

  // Search state
  const [search, setSearch] = useState("");

  // ── Fetch queues ──────────────────────────────────────────
  const fetchQueues = useCallback(async () => {
    try {
      const res = await fetch("/api/dungeon/queues");
      const json = await res.json();
      if (json.ok) {
        const all = json.data as DungeonQueue[];
        
        const waitingRound1Priest: DungeonQueue[] = [];
        const waitingRound1Other: DungeonQueue[] = [];
        const waitingRound2Priest: DungeonQueue[] = [];
        const waitingRound2Other: DungeonQueue[] = [];
        const doneQueues: DungeonQueue[] = [];

        all.forEach((q) => {
          if (q.status === "done") {
            doneQueues.push(q);
          } else {
            // Check if they are waiting for Round 1 or Round 2
            const isWaitingRound2 = q.rounds === 2 && q.round1 === true;
            if (isWaitingRound2) {
              if (q.job === "Priest") waitingRound2Priest.push(q);
              else waitingRound2Other.push(q);
            } else {
              if (q.job === "Priest") waitingRound1Priest.push(q);
              else waitingRound1Other.push(q);
            }
          }
        });

        setQueues([
          ...waitingRound1Priest, 
          ...waitingRound1Other, 
          ...waitingRound2Priest, 
          ...waitingRound2Other, 
          ...doneQueues
        ]);
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
      }
    } catch {
      /* silent */
    }
  }, []);

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
        setFormName("");
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
        ? { openDate: "", openTime: "", closeTime: "" }
        : { openDate: schedDate, openTime: schedOpen, closeTime: schedClose };
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
    <div style={{ zoom: 0.85 }} className="min-h-screen bg-[#f0f6fc] p-4 lg:py-8 lg:px-12 xl:px-24 2xl:px-32">

      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-5 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#0b3d63" }}>
          <Swords className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">ระบบจองดันมายา</h1>
          <p className="text-sm text-slate-500">จองคิวดันเจี้ยนมายา · 5 คนต่อทีม · 1-2 รอบต่อรอบ</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">

        {/* ═══════════════════════════════════════════════════
            LEFT PANEL
        ═══════════════════════════════════════════════════ */}
        <div className="lg:max-w-sm w-full flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">

          {/* Booking Form Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setFormCollapsed(c => !c)}
              className="w-full bg-[#0b3d63] px-5 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Swords className="text-white" size={20} />
                <h2 className="text-white font-bold text-base">ระบบจองคิว ดันมายา (Maya)</h2>
              </div>
              <span className="text-blue-200 text-lg">{formCollapsed ? "▸" : "▾"}</span>
            </button>
            {!formCollapsed && <p className="text-[#0b3d63] text-xs px-5 pt-2 pb-1 font-medium">5 คนต่อทีม · จองได้ 1-2 รอบต่อรอบ</p>}

            {!formCollapsed && <div className="p-5 flex flex-col gap-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อตัวละคร</label>
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
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b3d63]/30"
                />
                <datalist id="roster-names">
                  {rosterMembers.map((m) => (
                    <option key={m.name} value={m.name} />
                  ))}
                </datalist>
              </div>

              {/* Job */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">อาชีพ</label>
                <select
                  value={formJob}
                  onChange={(e) => setFormJob(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b3d63]/30 bg-white"
                >
                  {JOB_LIST.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
              </div>

              {/* Rounds toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">จำนวนรอบ</label>
                <div className="flex gap-2">
                  {([1, 2] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setFormRounds(r)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formRounds === r
                          ? "bg-[#0b3d63] text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
                className="w-full flex items-center justify-center gap-2 bg-[#0b3d63] hover:bg-[#0f4b7a] text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <ListPlus size={16} />
                {submitting ? "กำลังจอง…" : "จองคิวดันมายา"}
              </button>

              {/* Form message */}
              {formMsg && (
                <p className={`text-sm rounded-lg px-3 py-2 ${
                  formMsg.type === "ok"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-600"
                }`}>
                  {formMsg.text}
                </p>
              )}
            </div>}
          </div>

          {/* Schedule Settings Card (admin/owner only) */}
          {isAdmin && (
            <div className="bg-[#eef3f8] rounded-2xl border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setSchedCollapsed(c => !c)}
                className="w-full px-5 py-4 border-b border-slate-200 flex items-center justify-between hover:bg-[#e5edf5] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-[#0b3d63]" />
                  <h3 className="font-bold text-sm text-[#0b3d63]">ตั้งค่าช่วงเวลาเปิดจอง</h3>
                </div>
                <span className="text-[#0b3d63] text-lg">{schedCollapsed ? "▸" : "▾"}</span>
              </button>

              {!schedCollapsed && <div className="p-5 flex flex-col gap-3">
                {/* Open date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    <Calendar size={12} className="inline mr-1" />วันที่เปิดจอง
                  </label>
                  <input
                    type="date"
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    disabled={schedUnlimited}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3d63]/30 disabled:opacity-40"
                  />
                </div>

                {/* Open / Close time */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">เวลาเปิด</label>
                    <input
                      type="time"
                      lang="en-GB"
                      value={schedOpen}
                      onChange={(e) => setSchedOpen(e.target.value)}
                      disabled={schedUnlimited}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3d63]/30 disabled:opacity-40"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">เวลาปิด</label>
                    <input
                      type="time"
                      lang="en-GB"
                      value={schedClose}
                      onChange={(e) => setSchedClose(e.target.value)}
                      disabled={schedUnlimited}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3d63]/30 disabled:opacity-40"
                    />
                  </div>
                </div>

                {/* Unlimited toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={schedUnlimited}
                    onChange={(e) => setSchedUnlimited(e.target.checked)}
                    className="w-4 h-4 accent-[#0b3d63]"
                  />
                  <span className="text-xs text-slate-600">เปิดจองไม่จำกัดเวลา</span>
                </label>

                {/* Save button */}
                <button
                  onClick={handleSaveSchedule}
                  disabled={schedSaving}
                  className="flex items-center justify-center gap-2 bg-[#0b3d63] hover:bg-[#0f4b7a] text-white rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  <CheckCircle size={14} />
                  {schedSaving ? "กำลังบันทึก…" : "บันทึกตั้งค่า"}
                </button>

                {/* Schedule message */}
                {schedMsg && (
                  <p className={`text-xs rounded-lg px-3 py-2 ${
                    schedMsg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                  }`}>
                    {schedMsg.text}
                  </p>
                )}

                {/* Booking status badge */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500">สถานะ:</span>
                  {isUnlimited ? (
                    <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">
                      เปิดจองไม่จำกัดเวลา
                    </span>
                  ) : bookingStatus.open ? (
                    <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">
                      เปิดจองอยู่
                    </span>
                  ) : (
                    <span className="text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5 font-medium">
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
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">รายชื่อคิว</span>
              <span className="bg-[#0b3d63] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {queues.length} คน
              </span>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="ค้นหาชื่อ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-40 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchQueues}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-[#0b3d63] transition-colors px-2 py-1 rounded-lg hover:bg-slate-100"
              >
                <RefreshCw size={13} />
                รีเฟรช
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shadow-sm"
              >
                {copied ? <CheckCircle size={13} className="text-green-600" /> : <Share2 size={13} />}
                {copied ? "คัดลอกแล้ว!" : "แชร์ลิงก์จองตัว"}
              </button>
            </div>
          </div>

          {/* Queue list */}
          {loading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center text-slate-400 text-sm">
              กำลังโหลด…
            </div>
          ) : queues.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center">
              <Swords size={32} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">ยังไม่มีคิว · รอคิวแรก!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {(() => {
                // Actually `queues` is already sorted by `fetchQueues` into 4 active lists + done list.
                // But we still want the headers. Let's filter the local `queues` array again to put headers.
                // Or just use the pre-sorted state.
                const filteredQueues = queues.filter(q => !search || q.name.toLowerCase().includes(search.toLowerCase()));

                const waitingR1Priests = filteredQueues.filter(q => q.status !== "done" && !(q.rounds === 2 && q.round1 === true) && q.job === "Priest");
                const waitingR1Others = filteredQueues.filter(q => q.status !== "done" && !(q.rounds === 2 && q.round1 === true) && q.job !== "Priest");
                const waitingR2Priests = filteredQueues.filter(q => q.status !== "done" && (q.rounds === 2 && q.round1 === true) && q.job === "Priest");
                const waitingR2Others = filteredQueues.filter(q => q.status !== "done" && (q.rounds === 2 && q.round1 === true) && q.job !== "Priest");
                const doneQueuesList = filteredQueues.filter(q => q.status === "done");
                
                let currentGlobalIdx = 1;

                const renderQueue = (q: DungeonQueue, idx: number, isDone: boolean, isR2 = false) => {
                  const statusBadge = STATUS_BADGE[q.status] ?? STATUS_BADGE.waiting;
                  const jobColor = JOB_COLORS[q.job] ?? "#888";

                  return (
                    <div
                      key={q.id}
                      className={`bg-white rounded-2xl shadow-sm border border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${isDone ? "opacity-60" : ""} ${isR2 && !isDone ? "border-l-4 border-l-purple-500" : ""}`}
                    >
                      {/* Number */}
                      <span className="text-slate-400 font-bold text-sm w-6 shrink-0">
                        {idx}
                      </span>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm">{q.name}</span>

                          {/* Job badge */}
                          <span
                            className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: jobColor + "22",
                              color: jobColor,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: jobColor }}
                            />
                            {q.job}
                          </span>

                          {/* 2 rounds badge */}
                          {q.rounds === 2 && (
                            <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full">
                              ✕ 2 รอบ
                            </span>
                          )}

                          {/* Status badge */}
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge.cls}`}>
                            {statusBadge.label}
                          </span>
                        </div>

                        {/* Power + timestamp */}
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {q.power > 0 && (
                            <span className="text-xs text-slate-500">
                              <Shield size={11} className="inline mr-0.5" />
                              {q.power.toLocaleString()}
                            </span>
                          )}
                          <span className="text-xs text-slate-400">{formatTimestamp(q.timestamp)}</span>
                        </div>
                      </div>

                      {/* Round indicators + Admin actions */}
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        {/* Round 1 */}
                        <button
                          onClick={() => isAdmin && handleRound(q.id, 1)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                            q.round1
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-100 text-slate-400 " + (isAdmin ? "hover:bg-green-50 hover:text-green-600 cursor-pointer" : "cursor-default")
                          }`}
                          title={isAdmin ? "คลิกเพื่อทำเครื่องหมายรอบ 1" : undefined}
                        >
                          รอบ 1
                        </button>

                        {/* Round 2 (only if rounds=2) */}
                        {q.rounds === 2 && (
                          <button
                            onClick={() => isAdmin && handleRound(q.id, 2)}
                            className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                              q.round2
                                ? "bg-orange-100 text-orange-700"
                                : "bg-slate-100 text-slate-400 " + (isAdmin ? "hover:bg-orange-50 hover:text-orange-600 cursor-pointer" : "cursor-default")
                            }`}
                            title={isAdmin ? "คลิกเพื่อทำเครื่องหมายรอบ 2" : undefined}
                          >
                            รอบ 2
                          </button>
                        )}

                        {/* Admin delete */}
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(q.id)}
                            className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-medium px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Trash2 size={12} />
                            ลบ
                          </button>
                        )}
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {waitingR1Priests.length > 0 && (
                      <div className="text-xs font-bold text-blue-700 mt-2 px-2">พระ (Priest) - รอคิวรอบ 1</div>
                    )}
                    {waitingR1Priests.map(q => renderQueue(q, currentGlobalIdx++, false))}
                    
                    {waitingR1Others.length > 0 && (
                      <div className="text-xs font-bold text-slate-500 mt-2 px-2">อาชีพอื่นๆ - รอคิวรอบ 1</div>
                    )}
                    {waitingR1Others.map(q => renderQueue(q, currentGlobalIdx++, false))}

                    {waitingR2Priests.length > 0 && (
                      <div className="text-xs font-bold text-purple-700 mt-2 px-2 border-t border-slate-200 pt-3">พระ (Priest) - รอคิวรอบ 2</div>
                    )}
                    {waitingR2Priests.map(q => renderQueue(q, currentGlobalIdx++, false, true))}
                    
                    {waitingR2Others.length > 0 && (
                      <div className="text-xs font-bold text-purple-700 mt-2 px-2">อาชีพอื่นๆ - รอคิวรอบ 2</div>
                    )}
                    {waitingR2Others.map(q => renderQueue(q, currentGlobalIdx++, false, true))}

                    {doneQueuesList.length > 0 && (
                      <div className="text-xs font-bold text-green-600 mt-2 px-2 border-t border-slate-200 pt-3">ลงเสร็จแล้ว</div>
                    )}
                    {doneQueuesList.map(q => renderQueue(q, currentGlobalIdx++, true))}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}