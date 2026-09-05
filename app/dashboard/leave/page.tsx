"use client";

import { useEffect, useState, useCallback } from "react";
import { CalendarOff, Send, Trash2, Calendar, Filter, User, Clock } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import type { LeaveRecord } from "@/types";

type LeaveMode = "date" | "day";
type WarDay = "อังคาร" | "พฤหัสบดี" | "อาทิตย์";
type FilterTab = "ทั้งหมด" | "วันนี้" | "สัปดาห์นี้";

const WAR_DAYS: WarDay[] = ["อังคาร", "พฤหัสบดี", "อาทิตย์"];
const DAY_LABEL: Record<number, string> = {
  0: "อาทิตย์", 1: "จันทร์", 2: "อังคาร",
  3: "พุธ", 4: "พฤหัสบดี", 5: "ศุกร์", 6: "เสาร์",
};

function formatDateTH(dateStr: string): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("th-TH", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getThisWeekRange(): [Date, Date] {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

function getDayName(dateStr: string): string {
  if (!dateStr) return "";
  return DAY_LABEL[new Date(dateStr + "T00:00:00").getDay()] ?? "";
}

export default function LeavePage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const [name, setName] = useState<string>("");
  const [job, setJob] = useState<string>("Priest");
  const [leaveDay, setLeaveDay] = useState<WarDay>("อังคาร");
  const [leaveDate, setLeaveDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [allRecords, setAllRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>("ทั้งหมด");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin && user?.gameUsername) {
      setName(user.gameUsername);
      // Auto fetch job
      fetch("/api/roster").then(r => r.json()).then(json => {
        if (json.ok && json.data) {
          for (const [j, arr] of Object.entries(json.data as Record<string, {name:string}[]>)) {
            if (arr.some(m => m.name === user.gameUsername)) {
              setJob(j); break;
            }
          }
        }
      }).catch(()=>{});
    }
  }, [user, isAdmin]);

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leave");
      const json = res.ok ? await res.json() : {};
      const data = json.data ?? json;
      const arr: LeaveRecord[] = Array.isArray(data) ? data : [];
      arr.sort((a, b) => b.timestamp - a.timestamp);
      setAllRecords(arr);
    } catch {
      setAllRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  const filteredRecords = (() => {
    let records = allRecords;
    if (!isAdmin) {
      const myName = user?.gameUsername ?? "";
      records = records.filter((r) => r.name === myName);
    }
    const today = getToday();
    const todayDayName = getDayName(today);
    if (filterTab === "วันนี้") {
      records = records.filter(
        (r) => r.date === today || r.day === todayDayName
      );
    } else if (filterTab === "สัปดาห์นี้") {
      const [wStart, wEnd] = getThisWeekRange();
      records = records.filter((r) => {
        if (r.date) {
          const d = new Date(r.date + "T00:00:00");
          return d >= wStart && d <= wEnd;
        }
        return true;
      });
    }
    return records;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormMsg({ type: "err", text: "กรุณาระบุชื่อตัวละคร" });
      return;
    }
    if (!leaveDate) {
      setFormMsg({ type: "err", text: "กรุณาเลือกวันที่ลา (ปฏิทิน)" });
      return;
    }
    if (!reason.trim()) {
      setFormMsg({ type: "err", text: "กรุณาระบุเหตุผลที่ขอลา" });
      return;
    }
    
    setSubmitting(true);
    setFormMsg(null);
    try {
      const body = {
        name: name.trim(),
        job: job,
        date: leaveDate,
        day: leaveDay,
        reason: reason.trim(),
      };

      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "ไม่สามารถแจ้งลาได้");
      setFormMsg({ type: "ok", text: "แจ้งลาสำเร็จ ✅" });
      setLeaveDate("");
      setReason("");
      await fetchLeaves();
    } catch (err: unknown) {
      setFormMsg({
        type: "err",
        text: err instanceof Error ? err.message : "เกิดข้อผิดพลาด",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    setDeletingId(id);
    try {
      await fetch("/api/leave", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await fetchLeaves();
    } catch {
      /* silently fail */
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="bg-[#f0f6fc] min-h-screen p-4 lg:py-8 lg:px-12 xl:px-24 2xl:px-32"
      style={{ zoom: 0.85 }}
    >
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6 flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "#0b3d63" }}
        >
          <CalendarOff className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">แจ้งลากิลด์วอร์</h1>
          <p className="text-sm text-slate-500">
            แจ้งลาล่วงหน้า | อังคาร · พฤหัสบดี · อาทิตย์
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-5">
              <h2 className="font-bold text-[#0b3d63] text-lg">แบบฟอร์มแจ้งลาวอ</h2>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">ชื่อตัวละคร</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    readOnly={!isAdmin}
                    placeholder="ชื่อตัวละคร"
                    className={`w-full border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-blue-300 ${
                      !isAdmin ? "bg-slate-50 border-slate-200 text-slate-600 cursor-not-allowed" : "border-blue-200 text-[#0b3d63] bg-white"
                    }`}
                  />
                </div>

                {/* Job */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">อาชีพ</label>
                  {!isAdmin ? (
                    <div className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 cursor-not-allowed">
                      {job || "ไม่ระบุ"}
                    </div>
                  ) : (
                    <select
                      value={job}
                      onChange={(e) => setJob(e.target.value)}
                      className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-semibold text-[#0b3d63] bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 appearance-none"
                    >
                      {["Priest", "Lord Knight", "Paladin", "High Wizard", "Sniper", "Champion", "Assassin Cross", "Merchant", "Gunslinger", "Druid"].map(j => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Event Day */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">วันที่มีกิจกรรม</label>
                  <select
                    value={leaveDay}
                    onChange={(e) => setLeaveDay(e.target.value as WarDay)}
                    className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-semibold text-[#0b3d63] bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 appearance-none"
                  >
                    {WAR_DAYS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Leave Date */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5">วันที่ลา (ปฏิทิน)</label>
                  <input
                    type="date"
                    required
                    value={leaveDate}
                    onChange={(e) => {
                      setLeaveDate(e.target.value);
                      const d = new Date(e.target.value);
                      if (!isNaN(d.getTime())) {
                        const day = DAY_LABEL[d.getDay()];
                        if (WAR_DAYS.includes(day as WarDay)) {
                          setLeaveDay(day as WarDay);
                        }
                      }
                    }}
                    className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-semibold text-[#0b3d63] bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">เหตุผลการลา <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="ระบุเหตุผลที่ขอลา (บังคับใส่)"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
              </div>

              {/* Submit */}
              <div className="mt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#0b3d63] text-white rounded-lg font-bold text-sm hover:bg-[#0f4b7a] transition-all disabled:opacity-50"
                >
                  {submitting ? "กำลังบันทึก..." : "บันทึกการลา"}
                </button>
              </div>

              {formMsg && (
                <div
                  className={`mt-2 text-sm p-3 rounded-xl border ${
                    formMsg.type === "ok"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  {formMsg.text}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right: Leave List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-400" />
                <span className="font-semibold text-slate-700">รายการแจ้งลา</span>
                <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {filteredRecords.length}
                </span>
              </div>
              <div className="flex gap-1">
                {(["ทั้งหมด", "วันนี้", "สัปดาห์นี้"] as FilterTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilterTab(tab)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={
                      filterTab === tab
                        ? { backgroundColor: "#0b3d63", color: "white" }
                        : { backgroundColor: "#f1f5f9", color: "#475569" }
                    }
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                กำลังโหลด...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                <CalendarOff className="w-10 h-10 opacity-30" />
                <p className="text-sm">ไม่มีรายการแจ้งลา</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 h-[600px] overflow-y-auto">
                {filteredRecords.map((rec) => {
                  const leaveLabel = rec.date
                    ? `วันที่ ${formatDateTH(rec.date)} (${getDayName(rec.date)})`
                    : `ทุกวัน${rec.day}`;
                  const isDeleting = deletingId === rec.id;
                  return (
                    <div
                      key={rec.id}
                      className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors"
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                        style={{ backgroundColor: "#0f4b7a" }}
                      >
                        {rec.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-800 text-sm">{rec.name}</p>
                              {rec.job && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  {rec.job}
                               </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Calendar className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                              <span className="text-xs text-blue-600 font-medium">
                                {leaveLabel}
                              </span>
                            </div>
                            {rec.reason && (
                              <p className="text-xs text-slate-500 mt-1 italic">
                                &ldquo;{rec.reason}&rdquo;
                              </p>
                            )}
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(rec.id)}
                              disabled={isDeleting}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0 disabled:opacity-40"
                              title="ลบ"
                            >
                              {isDeleting ? (
                                <div className="w-4 h-4 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                          <Clock className="w-3 h-3 text-slate-300" />
                          <span className="text-xs text-slate-400">
                            แจ้งเมื่อ {formatTimestamp(rec.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
