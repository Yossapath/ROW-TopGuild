"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CalendarDays,
  Copy,
  ClipboardCheck,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import type { LeaveRecord } from "@/types";

type WarDay = "อังคาร" | "พฤหัสบดี" | "อาทิตย์";
type Status = "มา" | "ขาด" | "ลา" | null;

interface AttendanceRow {
  name: string;
  job: string;
  status: Status;
}

const WAR_DAYS: WarDay[] = ["อังคาร", "พฤหัสบดี", "อาทิตย์"];
const DAY_ISO: Record<WarDay, number> = { อังคาร: 2, พฤหัสบดี: 4, อาทิตย์: 0 };
const DAY_LABEL: Record<number, string> = {
  0: "อาทิตย์", 1: "จันทร์", 2: "อังคาร",
  3: "พุธ", 4: "พฤหัสบดี", 5: "ศุกร์", 6: "เสาร์",
};
const JOB_COLORS: Record<string, string> = {
  "Lord Knight": "#c13829", Paladin: "#e18028", "High Wizard": "#2c7eb9",
  Sniper: "#d4a015", Priest: "#25ae62", Champion: "#15a083",
  "Assassin Cross": "#8b46af", Merchant: "#c2185d", Gunslinger: "#894517", Druid: "#41b388",
};
const STATUS_CONFIG: Record<NonNullable<Status>, { emoji: string; bg: string; text: string }> = {
  มา:  { emoji: "✅", bg: "bg-green-100",  text: "text-green-700"  },
  ขาด: { emoji: "❌", bg: "bg-red-100",    text: "text-red-700"    },
  ลา:  { emoji: "🟡", bg: "bg-yellow-100", text: "text-yellow-700" },
};

const BASE_DATE = new Date("2026-09-06T00:00:00+07:00"); // Sunday 6 Sep 2026

function getWeekDates(weeksSinceBase: number): Record<WarDay, string> {
  const sunday = new Date(BASE_DATE);
  sunday.setDate(sunday.getDate() + weeksSinceBase * 7);
  
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  
  const t = new Date(sunday); t.setDate(sunday.getDate() + 2);
  const th = new Date(sunday); th.setDate(sunday.getDate() + 4);
  const su = new Date(sunday); // Sunday is index 0
  // Note: For Sunday war, is it the Sunday *at the start* of the week or *end* of the week? 
  // Base date is Sunday 06/09. If war is Sunday, it's that day.
  
  return {
    "อาทิตย์": fmt(su),
    "อังคาร": fmt(t),
    "พฤหัสบดี": fmt(th)
  };
}

function getCurrentWeekIndex(): number {
  const now = new Date();
  const diffTime = now.getTime() - BASE_DATE.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekIdx = Math.floor(diffDays / 7);
  return Math.max(0, weekIdx);
}

function formatDateTH(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function getDayName(dateStr: string): string {
  if (!dateStr) return "";
  return DAY_LABEL[new Date(dateStr + "T00:00:00").getDay()] ?? "";
}

function flattenRoster(roster: Record<string, { name: string; power?: number }[]>): AttendanceRow[] {
  const rows: AttendanceRow[] = [];
  for (const [job, members] of Object.entries(roster)) {
    for (const m of members) {
      rows.push({ name: m.name, job, status: null });
    }
  }
  return rows.sort((a, b) => a.job.localeCompare(b.job) || a.name.localeCompare(b.name));
}

export default function AttendancePage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<WarDay | "">("");
  const [weekOffset, setWeekOffset] = useState<number>(0); // 0 = this week, -1 = last week
  const [roster, setRoster] = useState<Record<string, { name: string; power?: number }[]>>({});
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [search, setSearch] = useState("");
  
  // Import Modal
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<{ match: number, unmatch: string[] } | null>(null);

  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(true);

  useEffect(() => {
    const curWeek = getCurrentWeekIndex();
    setWeekOffset(curWeek);
    const dates = getWeekDates(curWeek);
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    
    // Default to the first day of the week, or the current/upcoming day
    let initialDay: WarDay = "อาทิตย์";
    if (todayStr >= dates["พฤหัสบดี"]) initialDay = "พฤหัสบดี";
    else if (todayStr >= dates["อังคาร"]) initialDay = "อังคาร";

    const savedDate = localStorage.getItem("att_date");
    if (savedDate) {
      setSelectedDate(savedDate);
      const dayIdx = new Date(savedDate + "T00:00:00").getDay();
      setSelectedDay(WAR_DAYS.find((d) => DAY_ISO[d] === dayIdx) ?? "");
      // Calculate week offset based on saved date to sync the dropdown
      const d = new Date(savedDate + "T00:00:00");
      const diffTime = d.getTime() - BASE_DATE.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const wIdx = Math.floor(diffDays / 7);
      if (wIdx >= 0) setWeekOffset(wIdx);
    } else {
      setSelectedDate(dates[initialDay]);
      setSelectedDay(initialDay);
    }
  }, []);

  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoadingRoster(true);
      try {
        const [rRes, lRes, aRes] = await Promise.all([
          fetch("/api/roster"),
          fetch("/api/leave"),
          fetch("/api/attendance"),
        ]);
        const rJson = rRes.ok ? await rRes.json() : { data: {} };
        const lJson = lRes.ok ? await lRes.json() : { data: [] };
        const aJson = aRes.ok ? await aRes.json() : { data: [] };
        const rData = rJson.data ?? rJson;
        const lData = lJson.data ?? lJson;
        const aData = aJson.data ?? aJson;
        setRoster(typeof rData === "object" && !Array.isArray(rData) ? rData : {});
        setLeaveRecords(Array.isArray(lData) ? lData : []);
        setAttendanceRecords(Array.isArray(aData) ? aData : []);
      } catch { /* silently fail */ } finally {
        setLoadingRoster(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedDate) { setRows([]); return; }
    localStorage.setItem("att_date", selectedDate);
    const dayName = getDayName(selectedDate);
    const baseRows = flattenRoster(roster);
    
    // Map existing attendance for this date
    const attMap = new Map<string, Status>();
    for (const ar of attendanceRecords) {
      if (ar.date === selectedDate && ar.status) {
        attMap.set(ar.name, ar.status as Status);
      }
    }

    const leaveNames = new Set<string>();
    for (const lr of leaveRecords) {
      if (lr.date === selectedDate || lr.day === dayName) {
        leaveNames.add(lr.name);
      }
    }

    setRows(
      baseRows.map((r) => {
        if (attMap.has(r.name)) {
          return { ...r, status: attMap.get(r.name)! };
        }
        if (leaveNames.has(r.name)) {
          return { ...r, status: "ลา" as Status };
        }
        return { ...r, status: null };
      })
    );
  }, [selectedDate, roster, leaveRecords, attendanceRecords]);

  const handleDayBtn = (day: WarDay) => {
    setSelectedDay(day);
    const dates = getWeekDates(weekOffset);
    setSelectedDate(dates[day]);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSelectedDate(v);
    if (v) {
      const dayIdx = new Date(v + "T00:00:00").getDay();
      setSelectedDay(WAR_DAYS.find((d) => DAY_ISO[d] === dayIdx) ?? "");
    } else {
      setSelectedDay("");
    }
  };

  const setStatus = useCallback((idx: number, status: Status) => {
    if (!isAdmin) return;
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, status } : r))
    );
  }, [isAdmin]);

  const handleImport = () => {
    if (!importText.trim()) return;
    const lines = importText.split("\n").map(l => l.trim().toLowerCase()).filter(Boolean);
    const unmatch: string[] = [];
    let matchCount = 0;
    
    setRows(prev => {
      const next = [...prev];
      for (const line of lines) {
        const cleanLine = line.replace(/[^a-z0-9ก-๙]/g, '');
        const matchedIdx = next.findIndex(r => {
          const nm = r.name.toLowerCase();
          return nm.includes(line) || (cleanLine && nm.replace(/[^a-z0-9ก-๙]/g, '').includes(cleanLine));
        });
        
        if (matchedIdx >= 0) {
          if (next[matchedIdx].status !== "มา") {
            next[matchedIdx] = { ...next[matchedIdx], status: "มา" };
            matchCount++;
          }
        } else {
          unmatch.push(line);
        }
      }
      return next;
    });
    setImportResult({ match: matchCount, unmatch });
  };

  const handleSave = async () => {
    if (!selectedDate || rows.length === 0) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          records: rows.map((r) => ({
            name: r.name,
            present: r.status === "มา",
            status: r.status,
          })),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "ไม่สามารถบันทึกได้");
      setMsg({ type: "ok", text: "บันทึกเช็คชื่อสำเร็จ ✅" });
    } catch (e: unknown) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "เกิดข้อผิดพลาด" });
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (!selectedDate || rows.length === 0) return;
    const present = rows.filter((r) => r.status === "มา");
    const absent = rows.filter((r) => r.status !== "มา");
    const text = [
      `เช็คชื่อวันที่ ${formatDateTH(selectedDate)} (${getDayName(selectedDate)})`,
      `✅ มาวอ (${present.length} คน)`,
      present.map((r) => r.name).join(", "),
      `❌ ขาด/ลา (${absent.length} คน)`,
      absent.map((r) => r.name).join(", "),
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const countMa = rows.filter((r) => r.status === "มา").length;
  const countKhad = rows.filter((r) => r.status === "ขาด").length;
  const countLa = rows.filter((r) => r.status === "ลา").length;
  const laList = rows.filter((r) => r.status === "ลา");

  return (
    <div
      className="bg-[#f0f6fc] min-h-screen p-4 lg:py-8 lg:px-12 xl:px-24 2xl:px-32"
      style={{ zoom: 0.85 }}
    >
      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "#0b3d63" }}
          >
            <CheckSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">เช็คชื่อกิลด์วอร์</h1>
            <p className="text-sm text-slate-500">
              บันทึกการเข้าร่วมวอร์ | อังคาร · พฤหัสบดี · อาทิตย์
            </p>
          </div>
        </div>
        <button
          onClick={handleCopy}
          disabled={rows.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: copied ? "#25ae62" : "#0b3d63", color: "white" }}
        >
          {copied ? (
            <ClipboardCheck className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          {copied ? "คัดลอกแล้ว!" : "คัดลอกรายชื่อ"}
        </button>
      </div>

      {/* Day Selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-5 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4" /> สัปดาห์:
        </span>
        <select
          value={weekOffset}
          onChange={(e) => {
            const offset = Number(e.target.value);
            setWeekOffset(offset);
            const dates = getWeekDates(offset);
            const day = selectedDay as WarDay | "";
            if (day && dates[day as WarDay]) {
              setSelectedDate(dates[day as WarDay]);
            } else {
              setSelectedDate(dates["อาทิตย์"]);
              setSelectedDay("อาทิตย์");
            }
          }}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 bg-white"
        >
          {Array.from({ length: getCurrentWeekIndex() + 1 }, (_, i) => {
            const wIdx = getCurrentWeekIndex() - i;
            const dates = getWeekDates(wIdx);
            const sunDate = formatDateTH(dates["อาทิตย์"]);
            const thuDate = formatDateTH(dates["พฤหัสบดี"]);
            const label = i === 0 ? `สัปดาห์นี้ (${sunDate} – ${thuDate})`
                        : i === 1 ? `สัปดาห์ที่แล้ว (${sunDate} – ${thuDate})`
                        : `${i} สัปดาห์ที่แล้ว (${sunDate} – ${thuDate})`;
            return (
              <option key={wIdx} value={wIdx}>{label}</option>
            );
          })}
        </select>

        <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>

        <span className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
          วัน:
        </span>
        {(["อาทิตย์", "อังคาร", "พฤหัสบดี"] as WarDay[]).map((day) => {
          const dates = getWeekDates(weekOffset);
          const dateStr = dates[day];
          return (
            <button
              key={day}
              onClick={() => handleDayBtn(day)}
              className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all flex flex-col items-center"
              style={
                selectedDay === day
                  ? { backgroundColor: "#0b3d63", color: "white", borderColor: "#0b3d63" }
                  : { backgroundColor: "white", color: "#0b3d63", borderColor: "#0b3d63" }
              }
            >
              <span>{day}</span>
              <span className="text-[10px] opacity-70">{formatDateTH(dateStr)}</span>
            </button>
          );
        })}
        {selectedDate && (
          <div className="ml-auto">
            <span className="text-sm font-medium text-slate-700">
              📅{" "}
              <span className="font-bold" style={{ color: "#0b3d63" }}>
                {formatDateTH(selectedDate)} ({getDayName(selectedDate)})
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Left — Table */}
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-400" />
              <span className="font-semibold text-slate-700">รายชื่อสมาชิก</span>
              {rows.length > 0 && (
                <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {rows.length} คน
                </span>
              )}
            </div>
            {isAdmin && rows.length > 0 && (
              <button
                onClick={() => setShowImport(true)}
                className="text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
              >
                นำเข้ารายชื่อ (Import)
              </button>
            )}
            <div className="w-full sm:w-auto mt-2 sm:mt-0 flex-1 sm:max-w-xs">
              <input 
                type="text" 
                placeholder="ค้นหาชื่อ..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>

          {loadingRoster ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
              กำลังโหลดข้อมูล...
            </div>
          ) : !selectedDate ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <CalendarDays className="w-10 h-10 opacity-30" />
              <p className="text-sm">เลือกวันก่อนเพื่อแสดงรายชื่อ</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
              <Users className="w-10 h-10 opacity-30" />
              <p className="text-sm">ไม่มีข้อมูลสมาชิกใน Roster</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <th className="px-3 py-3 text-left w-8">#</th>
                    <th className="px-3 py-3 text-left">ชื่อ</th>
                    <th className="px-3 py-3 text-left">อาชีพ</th>
                    <th className="px-3 py-3 text-center min-w-[120px]">สถานะ</th>
                  </tr>
                </thead>
                 <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => {
                    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return null;
                    const jobColor = JOB_COLORS[r.job] ?? "#64748b";
                    return (
                      <tr key={`${r.name}-${i}`} className={`transition-colors ${r.status === "มา" ? "bg-green-50/40" : r.status === "ลา" ? "bg-yellow-50/40" : r.status === "ขาด" ? "bg-red-50/40" : "hover:bg-slate-50"}`}>
                        <td className="px-3 py-3 text-slate-400 text-sm font-medium">{i + 1}</td>
                        <td className="px-3 py-3">
                          <span className="font-bold text-slate-800 text-base">{r.name}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className="px-2.5 py-1 rounded-full text-xs font-bold text-white whitespace-nowrap"
                            style={{ backgroundColor: jobColor }}
                          >
                            {r.job}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-center">
                          {isAdmin ? (
                            <div className="flex items-center justify-center gap-2">
                              {/* มา */}
                              <button
                                onClick={() => setStatus(i, "มา")}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm border-2 ${
                                  r.status === "มา"
                                    ? "bg-green-500 border-green-500 text-white shadow-green-200"
                                    : "bg-white border-green-200 text-green-500 hover:bg-green-50"
                                }`}
                              >
                                ✅ มา
                              </button>
                              {/* ลา */}
                              <button
                                onClick={() => setStatus(i, "ลา")}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm border-2 ${
                                  r.status === "ลา"
                                    ? "bg-yellow-400 border-yellow-400 text-white shadow-yellow-200"
                                    : "bg-white border-yellow-200 text-yellow-600 hover:bg-yellow-50"
                                }`}
                              >
                                🟡 ลา
                              </button>
                              {/* ขาด */}
                              <button
                                onClick={() => setStatus(i, "ขาด")}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm border-2 ${
                                  r.status === "ขาด"
                                    ? "bg-red-500 border-red-500 text-white shadow-red-200"
                                    : "bg-white border-red-200 text-red-500 hover:bg-red-50"
                                }`}
                              >
                                ❌ ขาด
                              </button>
                              {/* clear */}
                              <button
                                onClick={() => setStatus(i, null)}
                                className="p-2 rounded-xl border-2 border-slate-200 text-slate-300 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-400 transition-all text-xs"
                                title="ล้างสถานะ"
                              >
                                ✖
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${r.status ? `${STATUS_CONFIG[r.status].bg} ${STATUS_CONFIG[r.status].text}` : "bg-slate-100 text-slate-400"}`}
                            >
                              {r.status ? (
                                <>
                                  {STATUS_CONFIG[r.status].emoji} {r.status}
                                </>
                              ) : "ยังไม่เช็ค"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {isAdmin && rows.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                style={{ backgroundColor: "#0b3d63" }}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4" />
                    บันทึกเช็คชื่อ
                  </>
                )}
              </button>
              {msg && (
                <span
                  className={`text-sm font-medium ${
                    msg.type === "ok" ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {msg.text}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right — Summary */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-500 mb-4">สรุปการเข้าร่วม</p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-100">
                <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-green-600 font-medium">มาวอ</p>
                  <p className="text-3xl font-extrabold text-green-700 leading-none">{countMa}</p>
                </div>
                <span className="ml-auto text-xs text-green-500">คน</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                <XCircle className="w-8 h-8 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-red-500 font-medium">ขาดวอ</p>
                  <p className="text-3xl font-extrabold text-red-600 leading-none">{countKhad}</p>
                </div>
                <span className="ml-auto text-xs text-red-400">คน</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-50 border border-yellow-100">
                <AlertCircle className="w-8 h-8 text-yellow-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-yellow-600 font-medium">ลา</p>
                  <p className="text-3xl font-extrabold text-yellow-600 leading-none">{countLa}</p>
                </div>
                <span className="ml-auto text-xs text-yellow-500">คน</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex-1">
            <p className="text-sm font-semibold text-slate-500 mb-3">รายชื่อผู้ลา</p>
            {laList.length === 0 ? (
              <div className="bg-slate-50 rounded-xl p-4 text-center text-slate-400 text-sm">
                ไม่มีผู้ลาในวันนี้
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {laList.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 bg-yellow-50 rounded-xl px-3 py-2.5 border border-yellow-100"
                  >
                    <span className="text-yellow-500 mt-0.5">🟡</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{r.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">นำเข้ารายชื่อผู้เข้าร่วม (มา)</h3>
              <button 
                onClick={() => {
                  setShowImport(false);
                  setImportResult(null);
                  setImportText("");
                }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-3 flex-1 min-h-[300px]">
              <p className="text-xs text-slate-500">
                วางรายชื่อที่ต้องการติ๊ก <b>&quot;มา&quot;</b> ลงในกล่องข้อความด้านล่าง (บรรทัดละ 1 ชื่อ) ระบบจะค้นหาและติ๊กให้อัตโนมัติ
              </p>
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder="Name1\nName2\n..."
                className="flex-1 w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none min-h-[150px]"
              />
              
              {importResult && (
                <div className={`p-3 rounded-xl border ${importResult.unmatch.length > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
                  <p className="text-sm font-bold text-slate-700">ผลลัพธ์การนำเข้า:</p>
                  <p className="text-xs text-green-600 mt-1">✅ ค้นพบและติ๊ก &quot;มา&quot; แล้ว: {importResult.match} คน</p>
                  {importResult.unmatch.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-amber-600 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> ไม่พบรายชื่อเหล่านี้ในระบบ (โปรดตรวจสอบตัวสะกด):
                      </p>
                      <ul className="list-disc list-inside text-xs text-amber-700 mt-1 max-h-24 overflow-y-auto pl-1">
                        {importResult.unmatch.map((u, i) => <li key={i}>{u}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
              <button
                onClick={() => {
                  setShowImport(false);
                  setImportResult(null);
                  setImportText("");
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                ปิด
              </button>
              <button
                onClick={handleImport}
                disabled={!importText.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: "#0b3d63" }}
              >
                ดำเนินการนำเข้า
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
