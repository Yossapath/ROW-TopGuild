"use client";

import { useEffect, useState, useRef } from "react";
import {
  Swords,
  CheckCircle,
  XCircle,
  RefreshCw,
  Users,
  Share2,
  Info,
} from "lucide-react";
import { JOB_LIST, JOB_COLORS, isBookingOpen, formatTimestamp } from "@/lib/utils";
import type { DungeonQueue, DungeonSchedule } from "@/types";

// ── Booking status badge ──────────────────────────────────────
function StatusBadge({ open, reason }: { open: boolean; reason?: string }) {
  if (open) {
    return (
      <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-green-500/20 text-green-200 font-bold text-sm border border-green-400/30">
        🟢 เปิดรับจองตอนนี้
      </span>
    );
  }
  return (
    <div className="text-right">
      <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-500/20 text-red-200 font-bold text-sm border border-red-400/30">
        🔴 ปิดรับจอง
      </span>
      {reason && (
        <p className="text-blue-200 text-xs mt-1 max-w-xs">{reason}</p>
      )}
    </div>
  );
}

// ── Queue row status dot ──────────────────────────────────────
function QueueDot({ status }: { status: string }) {
  if (status === "active") return <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />;
  if (status === "waiting") return <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />;
  return <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />;
}

// ─────────────────────────────────────────────────────────────
export default function BookingPage() {
  // Schedule / open state
  const [schedule, setSchedule] = useState<DungeonSchedule | null>(null);
  const [bookingStatus, setBookingStatus] = useState<{ open: boolean; reason?: string }>({
    open: false,
    reason: "กำลังโหลดข้อมูล...",
  });

  // Form fields
  const [name, setName] = useState("");
  const [job, setJob] = useState(JOB_LIST[0]);
  const [twoRounds, setTwoRounds] = useState(false);

  // Submission state
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ name: string; job: string; rounds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Queue preview
  const [queues, setQueues] = useState<DungeonQueue[]>([]);
  const [queuesLoading, setQueuesLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Copy link feedback
  const [copied, setCopied] = useState(false);

  // ── Fetch schedule ───────────────────────────────────────────
  useEffect(() => {
    fetch("/api/dungeon/schedule")
      .then((r) => r.json())
      .then((d) => {
        const sched = d.data ?? d;
        if (sched && sched.openDate) {
          setSchedule(sched);
          setBookingStatus(isBookingOpen(sched));
        } else {
          // No schedule set — show as open (no time limit)
          setBookingStatus({ open: true });
        }
      })
      .catch(() => setBookingStatus({ open: false, reason: "ไม่สามารถโหลดข้อมูลได้" }));
  }, []);

  // ── Fetch queue preview ──────────────────────────────────────
  function fetchQueues() {
    setQueuesLoading(true);
    fetch("/api/dungeon/queues")
      .then((r) => r.json())
      .then((d) => {
        const all: DungeonQueue[] = d.data ?? [];
        setQueues(all.filter((q) => q.status === "waiting" || q.status === "active"));
        setLastRefresh(Date.now());
      })
      .catch(() => {})
      .finally(() => setQueuesLoading(false));
  }

  useEffect(() => {
    fetchQueues();
    timerRef.current = setInterval(fetchQueues, 15000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Submit booking ───────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dungeon/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          job,
          dungeon: "ดันมายา (Maya)",
          power: 0,
          rounds: twoRounds ? 2 : 1,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
      } else {
        setSuccess({ name: name.trim(), job, rounds: twoRounds ? 2 : 1 });
        fetchQueues();
      }
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setJob(JOB_LIST[0]);
    setTwoRounds(false);
    setSuccess(null);
    setError(null);
  }

  async function handleShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const visibleQueues = queues.slice(0, 20);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* ── Header Banner ──────────────────────────────────── */}
        <div className="bg-[#0b3d63] text-white rounded-2xl p-8 shadow-xl relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute -right-6 -bottom-8 w-32 h-32 rounded-full bg-white/5" />

          <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                <Swords size={28} className="text-blue-300 flex-shrink-0" />
                จองคิวดันมายา (Maya)
              </h1>
              <p className="text-blue-200 mt-2 font-medium text-sm sm:text-base">
                ระบบจองคิวสำหรับสมาชิกกิลด์ Topguild
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-3 flex-shrink-0">
              <StatusBadge open={bookingStatus.open} reason={bookingStatus.reason} />
              <button
                onClick={handleShareLink}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium text-blue-100"
              >
                <Share2 size={14} />
                {copied ? "คัดลอกแล้ว ✓" : "แชร์ลิงก์"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Info Strip ─────────────────────────────────────── */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-wrap gap-4 items-center">
          <Info size={18} className="text-blue-400 flex-shrink-0" />
          {[
            { label: "ขนาดทีม", value: "5 คน/ทีม" },
            { label: "รอบต่อคน", value: "1-2 รอบ/คน" },
            { label: "ดันเจี้ยน", value: "ดันมายา" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">
                {item.label}
              </span>
              <span className="text-sm font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full">
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* ── Booking Form Card ───────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-xl font-bold text-[#0b3d63] mb-6 flex items-center gap-2">
            <Users size={22} className="text-[#0f4b7a]" />
            ลงทะเบียนจองคิว
          </h2>

          {/* Success state */}
          {success ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-green-700 mb-1">จองสำเร็จ! 🎉</h3>
                <p className="text-green-600 font-medium">{success.name}</p>
                <div className="flex justify-center gap-3 mt-3 flex-wrap">
                  <span
                    className="px-3 py-1 rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: JOB_COLORS[success.job] ?? "#64748b" }}
                  >
                    {success.job}
                  </span>
                  <span className="px-3 py-1 rounded-full text-sm font-bold bg-indigo-100 text-indigo-700">
                    {success.rounds === 2 ? "รอบ 1 + รอบ 2" : "รอบ 1"}
                  </span>
                </div>
              </div>
              <button
                onClick={resetForm}
                className="w-full py-3 rounded-xl border-2 border-[#0b3d63] text-[#0b3d63] font-bold hover:bg-[#0b3d63] hover:text-white transition-all"
              >
                จองอีกคน
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <XCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 font-medium text-sm">{error}</p>
                </div>
              )}

              {/* Character name */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  ชื่อตัวละคร <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ใส่ชื่อตัวละครของคุณ..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium text-slate-800 placeholder:text-slate-300 transition-shadow"
                />
              </div>

              {/* Job class */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  อาชีพ <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={job}
                    onChange={(e) => setJob(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium text-slate-800 appearance-none bg-white"
                  >
                    {JOB_LIST.map((j) => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                  <span
                    className="absolute right-10 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full pointer-events-none"
                    style={{ backgroundColor: JOB_COLORS[job] ?? "#94a3b8" }}
                  />
                </div>
              </div>

              {/* Round toggle */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  รอบที่ต้องการ
                </label>
                <div className="flex rounded-xl overflow-hidden border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setTwoRounds(false)}
                    className={`flex-1 py-3 text-sm font-bold transition-all ${
                      !twoRounds
                        ? "bg-[#0b3d63] text-white"
                        : "bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    ↑ รอบ 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setTwoRounds(true)}
                    className={`flex-1 py-3 text-sm font-bold transition-all border-l border-slate-200 ${
                      twoRounds
                        ? "bg-[#0b3d63] text-white"
                        : "bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    ✕ รอบ 1 + 2
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !bookingStatus.open}
                className="w-full py-4 bg-[#0b3d63] text-white rounded-xl font-bold text-lg shadow-md hover:bg-[#0f4b7a] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" />
                    กำลังจอง...
                  </>
                ) : (
                  <>
                    <Swords size={20} />
                    จองคิวดันมายา
                  </>
                )}
              </button>

              {!bookingStatus.open && (
                <p className="text-center text-sm text-slate-400 font-medium">
                  ⏰ {bookingStatus.reason ?? "ระบบจองปิดอยู่ในขณะนี้"}
                </p>
              )}
            </form>
          )}
        </div>

        {/* ── Queue Preview ───────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
            <Users size={18} className="text-[#0b3d63]" />
            <span className="font-bold text-slate-700">
              คิวปัจจุบัน ({queues.length} คน)
            </span>
            <button
              onClick={fetchQueues}
              disabled={queuesLoading}
              className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
              title="รีเฟรช"
            >
              <RefreshCw size={16} className={queuesLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {queues.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Swords size={36} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium text-sm">ยังไม่มีคิว</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-center w-10">ลำดับ</th>
                    <th className="px-4 py-3 text-left">ชื่อ</th>
                    <th className="px-4 py-3 text-left">อาชีพ</th>
                    <th className="px-4 py-3 text-center">รอบ</th>
                    <th className="px-4 py-3 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleQueues.map((qr, idx) => (
                    <tr key={qr.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs font-bold">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{qr.name}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: JOB_COLORS[qr.job] ?? "#94a3b8" }}
                          />
                          <span className="text-slate-600">{qr.job}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          qr.rounds === 2
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {qr.rounds === 2 ? "1+2" : "1"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <QueueDot status={qr.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-400 font-medium">
              * รายชื่อนี้เป็นข้อมูลสด อัปเดตทุก 15 วินาที
              {" · "}
              <span className="font-mono">{formatTimestamp(lastRefresh)}</span>
            </p>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="text-center py-4">
          <p className="text-slate-400 text-sm font-medium">
            © TOPGUILD — Guild Management System
          </p>
        </div>

      </div>
    </div>
  );
}
