"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  Swords,
  CheckCircle,
  XCircle,
  RefreshCw,
  Users,
  Share2,
  Info,
  Clock,
  Search,
  Sparkles,
} from "lucide-react";
import { JOB_LIST, JOB_COLORS, isBookingOpen, formatTimestamp } from "@/lib/utils";
import { calculateDungeonEstimates, type QueueEstimate } from "@/lib/dungeon-estimator";
import type { DungeonQueue, DungeonSchedule } from "@/types";
import { useAuthStore } from "@/stores/useAuthStore";
import Link from "next/link";

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
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  waiting: { label: "รอคิว", cls: "bg-yellow-100 text-yellow-700" },
  active: { label: "กำลังลง", cls: "bg-blue-100 text-blue-700" },
  done: { label: "เสร็จแล้ว", cls: "bg-green-100 text-green-700" },
};

export default function BookingPage() {
  const user = useAuthStore(s => s.user);

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

  // Auto set name from user
  useEffect(() => {
    if (user?.gameUsername) {
      setName(user.gameUsername);
      // Try to fetch roster to auto-set job
      fetch("/api/roster")
        .then(res => res.json())
        .then(json => {
          if (json.ok && json.data) {
            for (const [jobKey, arr] of Object.entries(json.data as Record<string, {name:string}[]>)) {
              if (arr.some(m => m.name === user.gameUsername)) {
                setJob(jobKey);
                break;
              }
            }
          }
        }).catch(() => {});
    }
  }, [user]);

  // Submission state
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ id: string; name: string; job: string; rounds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Queue preview
  const [queues, setQueues] = useState<DungeonQueue[]>([]);
  const [queuesLoading, setQueuesLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
        
        const waitingRound1Priest: DungeonQueue[] = [];
        const waitingRound1Other: DungeonQueue[] = [];
        const waitingRound2Priest: DungeonQueue[] = [];
        const waitingRound2Other: DungeonQueue[] = [];
        const doneQueues: DungeonQueue[] = [];

        all.forEach((q) => {
          if (q.status === "done") {
            doneQueues.push(q);
          } else {
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

  // ── Edit Rounds ──────────────────────────────────────────────
  async function handleEditRounds(id: string, newRounds: 1 | 2) {
    try {
      const res = await fetch(`/api/dungeon/queues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateRounds", rounds: newRounds }),
      });
      if (res.ok) {
        setSuccess((prev) => (prev ? { ...prev, rounds: newRounds } : prev));
        fetchQueues();
      }
    } catch {
      /* silent */
    }
  }

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
        setSuccess({ id: data.data.id, name: name.trim(), job, rounds: twoRounds ? 2 : 1 });
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

  const [selectedCheckName, setSelectedCheckName] = useState<string>("");

  const estimates = useMemo(() => {
    return calculateDungeonEstimates(queues);
  }, [queues]);

  const inspectedName = selectedCheckName || success?.name || user?.gameUsername || "";
  const myQueueEstimate = useMemo(() => {
    if (!inspectedName) return null;
    return estimates.estimatesByName[inspectedName.toLowerCase()] || null;
  }, [inspectedName, estimates]);

  const waitingMembers = useMemo(() => {
    return queues.filter(q => q.status !== "done");
  }, [queues]);

  const visibleQueues = queues;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 dark:from-[#1C1F27] dark:to-[#1C1F27] py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* ── Header Banner ──────────────────────────────────── */}
        <div className="bg-[#0b3d63] dark:bg-[#3B66D1] text-white rounded-2xl p-8 shadow-xl relative overflow-hidden border border-transparent dark:border-[#2D3342]">
          {/* Decorative circles */}
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute -right-6 -bottom-8 w-32 h-32 rounded-full bg-white/5" />

          <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                <Swords size={28} className="text-blue-300 dark:text-white flex-shrink-0" />
                จองคิวดันมายา (Maya)
              </h1>
              <p className="text-blue-200 dark:text-white mt-2 font-medium text-sm sm:text-base">
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
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-xl p-4 flex flex-wrap gap-4 items-center">
          <Info size={18} className="text-blue-400 dark:text-white flex-shrink-0" />
          {[
            { label: "ขนาดทีม", value: "5 คน/ทีม" },
            { label: "รอบต่อคน", value: "1-2 รอบ/คน" },
            { label: "ดันเจี้ยน", value: "ดันมายา" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-400 dark:text-white uppercase tracking-wide">
                {item.label}
              </span>
              <span className="text-sm font-bold text-blue-700 dark:text-white bg-blue-100 dark:bg-blue-900/50 px-2.5 py-0.5 rounded-full">
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* ── Booking Form Card ───────────────────────────────── */}
        <div className="bg-white dark:bg-[#232733] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] p-8">
          <h2 className="text-xl font-bold text-[#0b3d63] dark:text-white mb-6 flex items-center gap-2">
            <Users size={22} className="text-[#0f4b7a] dark:text-white" />
            ลงทะเบียนจองคิว
          </h2>

          {/* Success state */}
          {success ? (
            (() => {
              const myQueueIdx = queues.findIndex(q => q.id === success.id);
              const myQueue = myQueueIdx >= 0 ? queues[myQueueIdx] : null;
              const myEst = (success.id && estimates.estimatesById[success.id]) || (success.name && estimates.estimatesByName[success.name.toLowerCase()]);
              
              return (
                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40 rounded-xl p-6 text-center">
                    <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
                    <h3 className="text-xl font-bold text-green-700 dark:text-green-400 mb-1">จองสำเร็จ! 🎉</h3>
                    <p className="text-green-600 dark:text-green-300 font-medium text-lg">{success.name}</p>
                    
                    {myEst && (
                      <div className="mt-4 bg-white/90 dark:bg-[#232733] p-4 rounded-xl border border-green-200 dark:border-[#2D3342] text-left max-w-md mx-auto space-y-2 shadow-xs">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-white">
                          <span>ตำแหน่งคิว:</span>
                          <span className="text-[#3B66D1] dark:text-[#82A0F5] text-sm font-extrabold">
                            ตี้ที่ {myEst.partyNumber} (ลำดับที่ {myQueueIdx + 1})
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-white">
                          <span>คิวก่อนหน้า:</span>
                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                            {myEst.queuesAhead === 0 ? "ถึงคิวแล้ว (คิวถัดไป)" : `อีก ${myEst.queuesAhead} คิว`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-white">
                          <span>เวลารอโดยประมาณ:</span>
                          <span className="text-slate-800 dark:text-slate-200 font-bold">
                            {myEst.queuesAhead === 0 ? "~0-3 นาที" : `~${myEst.waitMinutesMin} - ${myEst.waitMinutesMax} นาที`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-white">
                          <span>คาดว่าจะถึงคิว:</span>
                          <span className="text-blue-600 dark:text-[#82A0F5] font-extrabold">
                            {myEst.estimatedStartTimeText}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-center gap-3 mt-4 flex-wrap">
                      <span
                        className="px-3 py-1.5 rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: JOB_COLORS[success.job] ?? "#64748b" }}
                      >
                        {success.job}
                      </span>
                      <span className="px-3 py-1.5 rounded-full text-sm font-bold bg-indigo-100 text-indigo-700">
                        {success.rounds === 2 ? "รอบ 1 + รอบ 2" : "รอบ 1"}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                    <p className="text-sm font-bold text-slate-700 mb-2 text-center">แก้ไขจำนวนรอบ</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditRounds(success.id, 1)}
                        disabled={success.rounds === 1}
                        className="flex-1 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:bg-[#3B66D1] disabled:text-white bg-white border border-slate-200 text-slate-600"
                      >
                        เปลี่ยนเป็น 1 รอบ
                      </button>
                      <button
                        onClick={() => handleEditRounds(success.id, 2)}
                        disabled={success.rounds === 2}
                        className="flex-1 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:bg-[#3B66D1] disabled:text-white bg-white border border-slate-200 text-slate-600"
                      >
                        เปลี่ยนเป็น 2 รอบ
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={resetForm}
                    className="w-full py-3 rounded-xl border-2 border-[#3B66D1] text-[#3B66D1] dark:text-[#4D73CD] font-bold hover:bg-[#3B66D1] hover:text-white hover:text-white transition-all mt-4"
                  >
                    จองใหม่อีกคน
                  </button>
                </div>
              );
            })()
          ) : !user ? (
            <div className="text-center py-10 space-y-4">
              <Users size={48} className="mx-auto text-slate-300 dark:text-slate-600" />
              <h3 className="text-lg font-bold text-slate-700 dark:text-white">โปรดเข้าสู่ระบบเพื่อจองคิว</h3>
              <p className="text-sm text-slate-500 dark:text-[#8B93A7] max-w-sm mx-auto">ระบบจำเป็นต้องใช้ข้อมูลผู้ใช้งานจาก Discord ของคุณ เพื่อบันทึกรายชื่อและอาชีพให้อัตโนมัติ</p>
              <Link
                href="/login?callbackUrl=/booking"
                className="inline-block px-6 py-3 rounded-xl bg-[#5865F2] text-white font-bold hover:bg-[#4752C4] transition-colors shadow-sm"
              >
                เข้าสู่ระบบด้วย Discord
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error */}
              {error && (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl p-4 flex items-start gap-3">
                  <XCircle size={20} className="text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 dark:text-red-300 font-medium text-sm">{error}</p>
                </div>
              )}

              {/* Character name */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">
                  ชื่อตัวละคร <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  readOnly={!!user?.gameUsername}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ใส่ชื่อตัวละครของคุณ..."
                  className={`w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2D3342] focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-[#4D73CD] font-medium transition-shadow ${
                    user?.gameUsername ? "bg-slate-100 dark:bg-[#272C38] text-slate-500 dark:text-[#8B93A7] cursor-not-allowed" : "bg-white dark:bg-[#272C38] text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#6B7280]"
                  }`}
                />
                {user?.gameUsername && (
                  <p className="text-xs text-slate-400 dark:text-[#6B7280] mt-1">ชื่อและอาชีพถูกดึงจากโปรไฟล์ของคุณ</p>
                )}
              </div>

              {/* Job class */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">
                  อาชีพ <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  {user?.gameUsername ? (
                    <div className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2D3342] bg-slate-100 dark:bg-[#272C38] text-slate-500 dark:text-[#8B93A7] font-medium cursor-not-allowed flex items-center gap-2">
                      {job}
                    </div>
                  ) : (
                    <select
                      required
                      value={job}
                      onChange={(e) => setJob(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2D3342] focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-[#4D73CD] font-medium text-slate-800 dark:text-white appearance-none bg-white dark:bg-[#272C38]"
                    >
                      {JOB_LIST.map((j) => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                    </select>
                  )}
                  <span
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full pointer-events-none"
                    style={{ backgroundColor: JOB_COLORS[job] ?? "#94a3b8" }}
                  />
                </div>
              </div>

              {/* Round toggle */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-white mb-2">
                  รอบที่ต้องการ
                </label>
                <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-[#2D3342]">
                  <button
                    type="button"
                    onClick={() => setTwoRounds(false)}
                    className={`flex-1 py-3 text-sm font-bold transition-all ${
                      !twoRounds
                        ? "bg-[#0b3d63] dark:bg-[#3B66D1] text-white"
                        : "bg-white dark:bg-[#272C38] text-slate-500 dark:text-[#8B93A7] hover:bg-slate-50 dark:hover:bg-[#2A2F3E]"
                    }`}
                  >
                    ↑ รอบ 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setTwoRounds(true)}
                    className={`flex-1 py-3 text-sm font-bold transition-all border-l border-slate-200 dark:border-[#2D3342] ${
                      twoRounds
                        ? "bg-[#0b3d63] dark:bg-[#3B66D1] text-white"
                        : "bg-white dark:bg-[#272C38] text-slate-500 dark:text-[#8B93A7] hover:bg-slate-50 dark:hover:bg-[#2A2F3E]"
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
                className="w-full py-4 bg-[#3B66D1] hover:bg-[#4D73CD] text-white rounded-xl font-bold text-lg shadow-md shadow-[#3B66D1]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

        {/* ── Queue & Time Estimator Card ────────────────────── */}
        <div className="bg-white dark:bg-[#232733] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-[#2D3342] pb-3">
            <div className="flex items-center gap-2">
              <Clock size={20} className="text-[#3B66D1] dark:text-[#4D73CD]" />
              <h2 className="font-bold text-slate-800 dark:text-white text-base">
                ระบบคำนวณคิวและเวลาโดยประมาณ
              </h2>
            </div>
            <span className="text-xs font-bold text-slate-600 dark:text-[#8B93A7] bg-slate-100 dark:bg-[#272C38] px-3 py-1 rounded-full border border-slate-200 dark:border-[#2D3342] w-fit">
              ⏱️ 1 คิว (ตี้) ลงประมาณ 11 - 12 นาที
            </span>
          </div>

          {/* Quick Check Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0 flex items-center gap-1.5">
              <Search size={14} className="text-[#3B66D1]" />
              ตรวจเช็คคิวของตัวละคร:
            </label>
            <div className="relative flex-1">
              <select
                value={selectedCheckName || (user?.gameUsername ?? "")}
                onChange={(e) => setSelectedCheckName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2D3342] bg-slate-50 dark:bg-[#272C38] text-slate-800 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#4D73CD]"
              >
                <option value="">-- เลือกหรือค้นหาชื่อตัวละครในคิว ({waitingMembers.length} คน) --</option>
                {waitingMembers.map((q: DungeonQueue) => (
                  <option key={q.id} value={q.name}>
                    {q.name} ({q.job}) - {q.status === "active" ? "กำลังลง" : `รอคิว`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Result Card */}
          {myQueueEstimate ? (
            <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-blue-50/90 dark:from-[#252E42] dark:via-[#22293A] dark:to-[#252E42] border-2 border-[#3B66D1] dark:border-[#4D73CD] rounded-xl p-4 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#3B66D1] text-white">
                      คิวของคุณ
                    </span>
                    <span className="font-bold text-base text-slate-800 dark:text-white">
                      {myQueueEstimate.name}
                    </span>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: JOB_COLORS[myQueueEstimate.job] ?? "#475569" }}
                    >
                      {myQueueEstimate.job}
                    </span>
                  </div>

                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">
                    {myQueueEstimate.status === "active" ? (
                      <span className="text-blue-600 dark:text-blue-400 font-bold">⚔️ กำลังลงดันเจี้ยนอยู่ในขณะนี้!</span>
                    ) : myQueueEstimate.status === "done" ? (
                      <span className="text-green-600 dark:text-emerald-400 font-bold">🎉 ลงดันเจี้ยนเสร็จสิ้นเรียบร้อยแล้ว</span>
                    ) : myQueueEstimate.queuesAhead === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        ✨ ถึงคิวของคุณแล้ว! คุณอยู่ใน <span className="underline">ตี้ที่ {myQueueEstimate.partyNumber}</span> (คิวถัดไปที่จะได้ลง)
                      </span>
                    ) : (
                      <>
                        คุณอยู่ <span className="font-bold text-[#0b3d63] dark:text-[#82A0F5]">คิวตี้ที่ {myQueueEstimate.partyNumber}</span>
                        {" · "}
                        เหลืออีก <span className="font-bold text-amber-600 dark:text-amber-400">{myQueueEstimate.queuesAhead} คิว</span> จะถึงคุณ
                      </>
                    )}
                  </p>
                </div>

                {myQueueEstimate.status === "waiting" && (
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <div className="bg-white dark:bg-[#232733] border border-slate-200 dark:border-[#2D3342] rounded-xl px-3.5 py-2 text-center flex-1 sm:flex-initial min-w-[110px]">
                      <span className="block text-[10px] font-bold text-slate-400 dark:text-[#8B93A7] uppercase tracking-wider">
                        อีกกี่คิวถึงเรา
                      </span>
                      <span className="font-extrabold text-sm text-amber-600 dark:text-amber-400">
                        {myQueueEstimate.queuesAhead === 0 ? "คิวถัดไป" : `อีก ${myQueueEstimate.queuesAhead} คิว`}
                      </span>
                    </div>

                    <div className="bg-white dark:bg-[#232733] border border-slate-200 dark:border-[#2D3342] rounded-xl px-3.5 py-2 text-center flex-1 sm:flex-initial min-w-[120px]">
                      <span className="block text-[10px] font-bold text-slate-400 dark:text-[#8B93A7] uppercase tracking-wider">
                        เวลารอประมาณ
                      </span>
                      <span className="font-extrabold text-sm text-[#0b3d63] dark:text-white">
                        {myQueueEstimate.queuesAhead === 0 ? "~0-3 นาที" : `~${myQueueEstimate.waitMinutesMin}-${myQueueEstimate.waitMinutesMax} นาที`}
                      </span>
                    </div>

                    <div className="bg-white dark:bg-[#232733] border border-slate-200 dark:border-[#2D3342] rounded-xl px-3.5 py-2 text-center flex-1 sm:flex-initial min-w-[130px]">
                      <span className="block text-[10px] font-bold text-slate-400 dark:text-[#8B93A7] uppercase tracking-wider">
                        เวลาประมาณการ
                      </span>
                      <span className="font-extrabold text-sm text-[#3B66D1] dark:text-[#82A0F5]">
                        {myQueueEstimate.estimatedStartTimeText}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-[#272C38]/40 border border-dashed border-slate-200 dark:border-[#2D3342] rounded-xl p-3 text-center text-xs text-slate-500 dark:text-[#8B93A7]">
              {user?.gameUsername ? (
                <span>ตัวละครของคุณ <span className="font-bold">{user.gameUsername}</span> ยังไม่ได้อยู่ในคิวจอง สามารถกรอกแบบฟอร์มด้านบนเพื่อจองคิว หรือเลือกชื่อตัวละครเพื่อดูเวลาคิว</span>
              ) : (
                <span>เข้าสู่ระบบด้วย Discord หรือเลือกชื่อตัวละครด้านบน เพื่อดูเวลาคาดการณ์ที่จะถึงคิวของคุณ</span>
              )}
            </div>
          )}
        </div>

        {/* ── Queue Preview ───────────────────────────────────── */}
        <div className="bg-white dark:bg-[#232733] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-[#2D3342]">
            <Users size={18} className="text-[#0b3d63] dark:text-white" />
            <span className="font-bold text-slate-700 dark:text-white">
              คิวปัจจุบัน ({queues.length} คน)
            </span>
            <button
              onClick={fetchQueues}
              disabled={queuesLoading}
              className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2A2F3E] transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="รีเฟรช"
            >
              <RefreshCw size={16} className={queuesLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {queues.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-[#6B7280]">
              <Swords size={36} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium text-sm">ยังไม่มีคิว</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-4">
              {(() => {
                const waitingRound1Priests = queues.filter(q => q.status !== "done" && !(q.rounds === 2 && q.round1 === true) && q.job === "Priest");
                const waitingRound1Others = queues.filter(q => q.status !== "done" && !(q.rounds === 2 && q.round1 === true) && q.job !== "Priest");
                const waitingRound2Priests = queues.filter(q => q.status !== "done" && (q.rounds === 2 && q.round1 === true) && q.job === "Priest");
                const waitingRound2Others = queues.filter(q => q.status !== "done" && (q.rounds === 2 && q.round1 === true) && q.job !== "Priest");
                const doneQueues = queues.filter(q => q.status === "done");
                
                let currentGlobalIdx = 1;

                const renderQueue = (q: DungeonQueue, idx: number, isDone: boolean, isR2 = false) => {
                  const statusBadge = STATUS_BADGE[q.status] ?? STATUS_BADGE.waiting;
                  const jobColor = JOB_COLORS[q.job] ?? "#888";
                  const isMe = (user?.gameUsername && user.gameUsername === q.name) || (inspectedName && inspectedName.toLowerCase() === q.name.toLowerCase());
                  const qEst = estimates.estimatesById[q.id] || estimates.estimatesByName[q.name.toLowerCase()];

                  return (
                    <div
                      key={q.id}
                      className={`bg-white dark:bg-[#272C38] rounded-2xl shadow-sm border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors ${
                        isMe ? "border-[#3B66D1] dark:border-[#4D73CD] ring-2 ring-[#3B66D1]/20 dark:ring-[#4D73CD]/20 bg-blue-50/50 dark:bg-[#3B66D1]/25" : "border-slate-200 dark:border-[#2D3342]"
                      } ${isDone ? "opacity-60" : ""} ${isR2 && !isDone && !isMe ? "border-l-4 border-l-purple-500" : ""}`}
                    >
                      {/* Number */}
                      <span className={`font-bold text-sm w-6 shrink-0 ${isMe ? "text-blue-600 dark:text-white" : "text-slate-400 dark:text-[#6B7280]"}`}>
                        {idx}
                      </span>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold text-sm ${isMe ? "text-blue-900 dark:text-white" : "text-slate-800 dark:text-white"}`}>{q.name} {isMe && "(คุณ)"}</span>

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
                            <span className="text-xs bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-medium px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800/40">
                              ✕ 2 รอบ
                            </span>
                          )}

                          {/* Party Badge */}
                          {qEst && qEst.partyNumber > 0 && !isDone && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#0b3d63]/10 dark:bg-[#3B66D1]/20 text-[#0b3d63] dark:text-[#82A0F5] border border-[#0b3d63]/20 dark:border-[#4D73CD]/30">
                              ตี้ที่ {qEst.partyNumber}
                            </span>
                          )}

                          {/* Status badge */}
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge.cls}`}>
                            {statusBadge.label}
                          </span>
                        </div>

                        {/* Estimated Time for Waiting queue */}
                        {qEst && qEst.status === "waiting" && (
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/40 flex items-center gap-1">
                              <Clock size={11} />
                              {qEst.queuesAhead === 0 ? "คิวถัดไป (~0-3 นาที)" : `อีก ${qEst.queuesAhead} คิว (~${qEst.waitMinutesMin}-${qEst.waitMinutesMax} นาที)`}
                            </span>
                            <span className="text-[11px] font-bold text-blue-600 dark:text-[#82A0F5]">
                              🕒 ถึงคิวประมาณ {qEst.estimatedStartTimeText}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Power + timestamp (right aligned on desktop) */}
                      <div className="flex items-center gap-3 shrink-0 sm:flex-col sm:items-end sm:gap-1">
                        {q.power > 0 && (
                          <span className="text-xs text-slate-500 dark:text-[#8B93A7] bg-slate-100 dark:bg-[#232733] px-2 py-0.5 rounded-lg border border-transparent dark:border-[#2D3342]">
                            พลัง <span className="font-bold text-slate-700 dark:text-white">{q.power.toLocaleString()}</span>
                          </span>
                        )}
                        <span className="text-xs text-slate-400 dark:text-[#6B7280] flex items-center gap-1">
                          <CheckCircle size={10} />
                          {formatTimestamp(q.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {waitingRound1Priests.length > 0 && (
                      <div className="text-xs font-bold text-blue-700 dark:text-white mt-2 px-2">พระ (Priest) - รอคิวรอบ 1</div>
                    )}
                    {waitingRound1Priests.map(q => renderQueue(q, currentGlobalIdx++, false))}
                    
                    {waitingRound1Others.length > 0 && (
                      <div className="text-xs font-bold text-slate-500 dark:text-[#8B93A7] mt-2 px-2">อาชีพอื่นๆ - รอคิวรอบ 1</div>
                    )}
                    {waitingRound1Others.map(q => renderQueue(q, currentGlobalIdx++, false))}

                    {waitingRound2Priests.length > 0 && (
                      <div className="text-xs font-bold text-purple-700 dark:text-purple-300 mt-2 px-2 border-t border-slate-200 dark:border-[#2D3342] pt-3">พระ (Priest) - รอคิวรอบ 2</div>
                    )}
                    {waitingRound2Priests.map(q => renderQueue(q, currentGlobalIdx++, false, true))}
                    
                    {waitingRound2Others.length > 0 && (
                      <div className="text-xs font-bold text-purple-700 dark:text-purple-300 mt-2 px-2">อาชีพอื่นๆ - รอคิวรอบ 2</div>
                    )}
                    {waitingRound2Others.map(q => renderQueue(q, currentGlobalIdx++, false, true))}

                    {doneQueues.length > 0 && (
                      <div className="text-xs font-bold text-green-600 dark:text-emerald-400 mt-2 px-2 border-t border-slate-200 dark:border-[#2D3342] pt-3">ลงเสร็จแล้ว</div>
                    )}
                    {doneQueues.map(q => renderQueue(q, currentGlobalIdx++, true))}
                  </>
                );
              })()}
            </div>
          )}

          <div className="px-6 py-3 bg-slate-50 dark:bg-[#272C38]/60 border-t border-slate-100 dark:border-[#2D3342]">
            <p className="text-xs text-slate-400 dark:text-[#6B7280] font-medium">
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
