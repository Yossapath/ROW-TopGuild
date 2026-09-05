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
type Status = "มา" | "ขาด" | "ลา";

interface AttendanceRow {
  name: string;
  job: string;
  status: Status;
  note: string;
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
const STATUS_CONFIG: Record<Status, { emoji: string; bg: string; text: string }> = {
  มา:  { emoji: "✅", bg: "bg-green-100",  text: "text-green-700"  },
  ขาด: { emoji: "❌", bg: "bg-red-100",    text: "text-red-700"    },
  ลา:  { emoji: "🟡", bg: "bg-yellow-100", text: "text-yellow-700" },
};
const STATUS_CYCLE: Record<Status, Status> = { มา: "ขาด", ขาด: "ลา", ลา: "มา" };

function getNextWeekday(day: WarDay): string {
  const target = DAY_ISO[day];
  const now = new Date();
  const diff = (target - now.getDay() + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  return next.toISOString().split("T")[0];
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
      rows.push({ name: m.name, job, status: "มา", note: "" });
    }
  }
  return rows.sort((a, b) => a.job.localeCompare(b.job) || a.name.localeCompare(b.name));
}

export default function AttendancePage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<WarDay | "">("");
  const [roster, setRoster] = useState<Record<string, { name: string; power?: number }[]>>({});
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoadingRoster(true);
      try {
        const [rRes, lRes] = await Promise.all([
          fetch("/api/roster"),
          fetch("/api/leave"),
        ]);
        const rJson = rRes.ok ? await rRes.json() : { data: {} };
        const lJson = lRes.ok ? await lRes.json() : { data: [] };
        const rData = rJson.data ?? rJson;
        const lData = lJson.data ?? lJson;
        setRoster(typeof rData === "object" && !Array.isArray(rData) ? rData : {});
        setLeaveRecords(Array.isArray(lData) ? lData : []);
      } catch { /* silently fail */ } finally {
        setLoadingRoster(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedDate) { setRows([]); return; }
    const dayName = getDayName(selectedDate);
    const baseRows = flattenRoster(roster);
    const leaveNames = new Set<string>();
    const leaveReasons: Record<string, string> = {};
    for (const lr of leaveRecords) {
      if (lr.date === selectedDate || lr.day === dayName) {
        leaveNames.add(lr.name);
        if (lr.reason) leaveReasons[lr.name] = lr.reason;
      }
    }
    setRows(
      baseRows.map((r) => ({
        ...r,
        status: leaveNames.has(r.name) ? ("ลา" as Status) : ("มา" as Status),
        note: leaveNames.has(r.name) ? (leaveReasons[r.name] ?? "ลา") : "",
      }))
    );
  }, [selectedDate, roster, leaveRecords]);

  const handleDayBtn = (day: WarDay) => {
    setSelectedDay(day);
    setSelectedDate(getNextWeekday(day));
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

  const toggleStatus = useCallback((idx: number) => {
    if (!isAdmin) return;
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, status: STATUS_CYCLE[r.status] } : r))
    );
  }, [isAdmin]);

  const updateNote = useCallback((idx: number, val: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, note: val } : r)));
  }, []);

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
            note: r.note,
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
          <CalendarDays className="w-4 h-4" /> เลือกวัน:
        </span>
        {WAR_DAYS.map((day) => (
          <button
            key={day}
            onClick={() => handleDayBtn(day)}
            className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all"
            style={
              selectedDay === day
                ? { backgroundColor: "#0b3d63", color: "white", borderColor: "#0b3d63" }
                : { backgroundColor: "white", color: "#0b3d63", borderColor: "#0b3d63" }
            }
          >
            {day}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-slate-500">หรือเลือกวันที่:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        {selectedDate && (
          <div className="w-full mt-1">
            <span className="text-sm font-medium text-slate-700">
              📅 วันที่เลือก:{" "}
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
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-400" />
            <span className="font-semibold text-slate-700">รายชื่อสมาชิก</span>
            {rows.length > 0 && (
              <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {rows.length} คน
              </span>
            )}
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
                    <th className="px-3 py-3 text-center">สถานะ</th>
                    <th className="px-3 py-3 text-left">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => {
                    const sc = STATUS_CONFIG[r.status];
                    const jobColor = JOB_COLORS[r.job] ?? "#64748b";
                    return (
                      <tr key={`${r.name}-${i}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2.5 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-slate-800">{r.name}</td>
                        <td className="px-3 py-2.5">
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-semibold text-white whitespace-nowrap"
                            style={{ backgroundColor: jobColor }}
                          >
                            {r.job}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {isAdmin ? (
                            <button
                              onClick={() => toggleStatus(i)}
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all hover:scale-105 ${sc.bg} ${sc.text}`}
                            >
                              {sc.emoji} {r.status}
                            </button>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${sc.bg} ${sc.text}`}
                            >
                              {sc.emoji} {r.status}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {isAdmin ? (
                            <input
                              type="text"
                              value={r.note}
                              onChange={(e) => updateNote(i, e.target.value)}
                              placeholder="—"
                              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 text-slate-700"
                            />
                          ) : (
                            <span className="text-xs text-slate-500">{r.note || "—"}</span>
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
                      {r.note && (
                        <p className="text-xs text-slate-500 mt-0.5">{r.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
