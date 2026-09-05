"use client";

import { useEffect, useState, useCallback } from "react";
import { CalendarOff, Trash2, Calendar } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import type { LeaveRecord } from "@/types";

type WarDay = "อังคาร" | "พฤหัสบดี" | "อาทิตย์";

const WAR_DAYS: WarDay[] = ["อาทิตย์", "อังคาร", "พฤหัสบดี"];
const DAY_LABEL: Record<number, string> = {
  0: "อาทิตย์", 1: "จันทร์", 2: "อังคาร",
  3: "พุธ", 4: "พฤหัสบดี", 5: "ศุกร์", 6: "เสาร์",
};
const JOB_LIST = [
  "Priest", "Lord Knight", "Paladin", "High Wizard",
  "Sniper", "Champion", "Assassin Cross", "Merchant", "Gunslinger", "Druid",
];

function formatDateTH(dateStr: string): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function getDayName(dateStr: string): string {
  if (!dateStr) return "";
  return DAY_LABEL[new Date(dateStr + "T00:00:00").getDay()] ?? "";
}

export default function LeavePage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const [rosterMembers, setRosterMembers] = useState<{ name: string; job: string }[]>([]);
  const [name, setName] = useState("");
  const [job, setJob] = useState("Priest");
  const [leaveDay, setLeaveDay] = useState<WarDay>("อังคาร");
  const [leaveDate, setLeaveDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [allRecords, setAllRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load roster for admin dropdown + auto-class
  useEffect(() => {
    fetch("/api/roster").then(r => r.json()).then(json => {
      if (json.ok && json.data) {
        const members: { name: string; job: string }[] = [];
        for (const [j, arr] of Object.entries(json.data as Record<string, { name: string }[]>)) {
          for (const m of arr) members.push({ name: m.name, job: j });
        }
        setRosterMembers(members.sort((a, b) => a.name.localeCompare(b.name)));

        // For non-admin: auto-lock name + auto-class
        if (!isAdmin && user?.gameUsername) {
          setName(user.gameUsername);
          const found = members.find(m => m.name === user.gameUsername);
          if (found) setJob(found.job);
        }
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.gameUsername]);

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leave");
      const json = res.ok ? await res.json() : {};
      const data = json.data ?? json;
      const arr: LeaveRecord[] = Array.isArray(data) ? data : [];
      arr.sort((a, b) => b.timestamp - a.timestamp);
      setAllRecords(arr);
    } catch { setAllRecords([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setFormMsg({ type: "err", text: "กรุณาระบุชื่อตัวละคร" }); return; }
    if (!leaveDate) { setFormMsg({ type: "err", text: "กรุณาเลือกวันที่ลา" }); return; }
    if (!reason.trim()) { setFormMsg({ type: "err", text: "กรุณาระบุเหตุผล" }); return; }
    setSubmitting(true); setFormMsg(null);
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), job, date: leaveDate, day: leaveDay, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "ไม่สามารถแจ้งลาได้");
      setFormMsg({ type: "ok", text: "แจ้งลาสำเร็จ ✅" });
      setLeaveDate(""); setReason("");
      if (isAdmin) { setName(""); setJob("Priest"); }
      await fetchLeaves();
    } catch (err: unknown) {
      setFormMsg({ type: "err", text: err instanceof Error ? err.message : "เกิดข้อผิดพลาด" });
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    setDeletingId(id);
    try {
      await fetch("/api/leave", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await fetchLeaves();
    } catch { /* silent */ } finally { setDeletingId(null); }
  };

  const inputCls = "w-full border border-slate-200 dark:border-[#2D3342] rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-white bg-white dark:bg-[#272C38] focus:outline-none focus:ring-2 focus:ring-[#4D73CD] placeholder:text-slate-400 dark:placeholder:text-[#6B7280]";
  const lockedCls = "w-full border border-slate-200 dark:border-[#2D3342] rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-500 dark:text-gray-300 bg-slate-50 dark:bg-[#272C38]/60 select-none";

  return (
    <div className="bg-[#f0f6fc] dark:bg-[#1C1F27] min-h-screen p-4 lg:py-8 lg:px-12 xl:px-24 2xl:px-32" style={{ zoom: 0.85 }}>

      {/* Header Card */}
      <div className="bg-white dark:bg-[#232733] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] p-5 mb-5 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#0b3d63] dark:bg-[#3B66D1] shadow-sm">
          <CalendarOff className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">ระบบแจ้งลาวอ</h1>
          <p className="text-sm text-slate-500 dark:text-[#8B93A7]">แจ้งลาการเข้าร่วมวอร์ | อังคาร · พฤหัสบดี · อาทิตย์</p>
        </div>
      </div>

      {/* ── FORM CARD ── */}
      <div className="bg-white dark:bg-[#232733] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] p-6 mb-4">
        <h2 className="font-bold text-[#0b3d63] dark:text-white text-base mb-5">แบบฟอร์มแจ้งลาวอ</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">

            {/* Name */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">ชื่อตัวละคร</label>
              {isAdmin ? (
                <>
                  <input
                    list="roster-list"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      const found = rosterMembers.find(m => m.name === e.target.value);
                      if (found) setJob(found.job);
                    }}
                    placeholder="พิมพ์หรือเลือกชื่อ…"
                    className={inputCls}
                  />
                  <datalist id="roster-list">
                    {rosterMembers.map(m => <option key={m.name} value={m.name} />)}
                  </datalist>
                </>
              ) : (
                <div className={lockedCls}>{name || "—"}</div>
              )}
            </div>

            {/* Job */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">อาชีพ</label>
              {isAdmin ? (
                <select value={job} onChange={e => setJob(e.target.value)} className={inputCls}>
                  {JOB_LIST.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              ) : (
                <div className={lockedCls}>{job || "—"}</div>
              )}
            </div>

            {/* War day */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">วันที่มีกิจกรรม</label>
              <select value={leaveDay} onChange={e => setLeaveDay(e.target.value as WarDay)} className={inputCls}>
                {WAR_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">วันที่ลา (ปฏิทิน)</label>
              <input
                type="date" required value={leaveDate}
                onChange={(e) => {
                  setLeaveDate(e.target.value);
                  const d = new Date(e.target.value);
                  if (!isNaN(d.getTime())) {
                    const dn = DAY_LABEL[d.getDay()];
                    if (WAR_DAYS.includes(dn as WarDay)) setLeaveDay(dn as WarDay);
                  }
                }}
                className={inputCls}
              />
            </div>
          </div>

          {/* Reason */}
          <div className="mb-5">
            <label className="block text-xs text-slate-400 mb-1.5">เหตุผลการลา <span className="text-red-400">*</span></label>
            <input
              type="text" required value={reason} onChange={e => setReason(e.target.value)}
              placeholder="ระบุเหตุผลที่ขอลา (บังคับใส่)"
              className={inputCls}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit" disabled={submitting}
              className="px-6 py-2.5 bg-[#3B66D1] hover:bg-[#4D73CD] text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50 shadow-sm"
            >
              {submitting ? "กำลังบันทึก..." : "บันทึกการลา"}
            </button>
            {formMsg && (
              <span className={`text-sm font-medium ${formMsg.type === "ok" ? "text-green-600" : "text-red-500"}`}>
                {formMsg.text}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* ── LIST CARD ── */}
      <div className="bg-white dark:bg-[#232733] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#2D3342] flex items-center gap-3">
          <CalendarOff className="w-5 h-5 text-[#0b3d63] dark:text-white" />
          <h2 className="font-bold text-[#0b3d63] dark:text-white">รายการแจ้งลาล่วงหน้า</h2>
          <span className="bg-slate-100 dark:bg-[#333333] text-slate-500 dark:text-white text-xs font-bold px-2 py-0.5 rounded-full ml-auto">
            {allRecords.length} รายการ
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
            <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 rounded-full animate-spin" />
            กำลังโหลด...
          </div>
        ) : allRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Calendar className="w-10 h-10 opacity-30" />
            <p className="text-sm">ไม่มีรายการแจ้งลา</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#eef4fb] dark:bg-[#272C38] text-[#0b3d63] dark:text-white text-xs font-semibold border-b border-slate-100 dark:border-[#2D3342]">
                  <th className="px-5 py-3 text-left">วันที่ลา</th>
                  <th className="px-5 py-3 text-left">วัน</th>
                  <th className="px-5 py-3 text-left">ชื่อตัวละคร</th>
                  <th className="px-5 py-3 text-left">อาชีพ</th>
                  <th className="px-5 py-3 text-left">ผู้แจ้งลา</th>
                  <th className="px-5 py-3 text-left">เหตุผล</th>
                  {isAdmin && <th className="px-5 py-3 text-center">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#333333]">
                {allRecords.map((rec) => {
                  const dayName = rec.day || getDayName(rec.date ?? "");
                  const isDeleting = deletingId === rec.id;
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-[#2A2F3E] transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-700 dark:text-white whitespace-nowrap">
                        {formatDateTH(rec.date ?? "")}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-[#3B66D1]/40 text-blue-600 dark:text-white rounded text-xs font-bold">
                          {dayName}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-white">{rec.name}</td>
                      <td className="px-5 py-3.5">
                        {rec.job
                          ? <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#333333] text-slate-600 dark:text-white rounded text-xs font-semibold border border-slate-200 dark:border-[#2D3342]">{rec.job}</span>
                          : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">{rec.name}</td>
                      <td className="px-5 py-3.5 text-slate-400 italic text-xs max-w-[180px] truncate">
                        {rec.reason || "—"}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => handleDelete(rec.id)}
                            disabled={isDeleting}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 border border-red-200 transition-colors disabled:opacity-40"
                          >
                            {isDeleting
                              ? <div className="w-3 h-3 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                              : <Trash2 className="w-3 h-3" />}
                            ลบ
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-slate-400 mt-6">
        ข้อมูลอัพเดตล่าสุดและจัดการผ่านระบบ Firebase / LocalStorage
      </p>
    </div>
  );
}

