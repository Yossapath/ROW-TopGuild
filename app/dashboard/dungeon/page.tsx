"use client";

import { useEffect, useState } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  Swords,
  ListPlus,
  Clock,
  CheckCircle,
  Copy,
  Share2,
  Calendar,
  RefreshCw,
  Shield,
} from "lucide-react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  JOB_COLORS,
  JOB_LIST,
  isBookingOpen,
} from "@/lib/utils";
import type { DungeonSchedule, DungeonTeamResource, DungeonQueueItem } from "@/types";
import { TeamBoard } from "@/components/dungeon/TeamBoard";
import { QueueBoard } from "@/components/dungeon/QueueBoard";

// ────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────
export default function DungeonPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const queryClient = useQueryClient();

  const assignMutation = useMutation({
    mutationFn: async ({ teamId, queueItemId }: { teamId: string; queueItemId: string }) => {
      const res = await fetch(`/api/dungeon/teams/${teamId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "manual-assign", queueItemId }),
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || "เกิดข้อผิดพลาดในการดึงข้อมูล");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dungeon_data"] });
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.droppableId.startsWith("queue_group_") && result.destination.droppableId.startsWith("team_")) {
      const teamId = result.destination.droppableId.replace("team_", "");
      const queueItemId = result.draggableId;
      assignMutation.mutate({ teamId, queueItemId });
    }
  };

  // ── Unified React Query for all dungeon data ──────────────
  const { data: dungeonData, isLoading: loading } = useQuery({
    queryKey: ["dungeon_data"],
    queryFn: async () => {
      // Only fetch data used by the dashboard. The legacy /queues endpoint
      // is no longer needed here because active queue state is represented by
      // dungeon_queue_items.
      let rosterData = queryClient.getQueryData<any>(["roster"]);
      const [resT, resQI, resS, resR] = await Promise.all([
        fetch("/api/dungeon/teams"),
        fetch("/api/dungeon/queue-items"),
        fetch("/api/dungeon/schedule"),
        rosterData ? Promise.resolve(null) : fetch("/api/roster"),
      ]);
      const [jsonT, jsonQI, jsonS, jsonR] = await Promise.all([
        resT.json(),
        resQI.json(),
        resS.json(),
        resR ? resR.json() : Promise.resolve({ ok: true, data: rosterData }),
      ]);

      if (!rosterData && jsonR?.ok && jsonR?.data) {
        rosterData = jsonR.data;
        queryClient.setQueryData(["roster"], rosterData);
      }

      const teams: DungeonTeamResource[] = jsonT.ok && Array.isArray(jsonT.data) ? jsonT.data : [];
      const queueItems: DungeonQueueItem[] = jsonQI.ok && Array.isArray(jsonQI.data) ? jsonQI.data : [];
      const schedule: DungeonSchedule = jsonS.ok && jsonS.data ? jsonS.data : {
        openDate: "",
        openTime: "06:00",
        closeTime: "23:59",
        carryTeamsCount: 1,
        isClosed: false,
      };

      const rosterMembers: { name: string; job: string }[] = [];
      const sourceRoster = rosterData || (jsonR?.ok ? jsonR.data : null);
      if (sourceRoster) {
        for (const [job, arr] of Object.entries(sourceRoster as Record<string, { name: string }[]>)) {
          for (const m of arr) {
            rosterMembers.push({ name: m.name, job });
          }
        }
      }

      return { teams, queueItems, schedule, rosterMembers };
    },
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const teams = dungeonData?.teams ?? [];
  const queueItems = dungeonData?.queueItems ?? [];
  const rosterMembers = dungeonData?.rosterMembers ?? [];

  // Schedule local state synced with query
  const [schedule, setSchedule] = useState<DungeonSchedule>({
    openDate: "",
    openTime: "06:00",
    closeTime: "23:59",
    carryTeamsCount: 1,
  });
  const [carryTeamsCount, setCarryTeamsCount] = useState<number>(1);
  const [schedDate, setSchedDate] = useState("");
  const [schedOpen, setSchedOpen] = useState("06:00");
  const [schedClose, setSchedClose] = useState("23:59");
  const [schedUnlimited, setSchedUnlimited] = useState(false);
  const [schedSaving, setSchedSaving] = useState(false);
  const [carrySaving, setCarrySaving] = useState(false);
  const [schedMsg, setSchedMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (dungeonData?.schedule) {
      const s = dungeonData.schedule;
      setSchedule(s);
      setSchedDate(s.openDate ?? "");
      setSchedOpen(s.openTime ?? "06:00");
      setSchedClose(s.closeTime ?? "23:59");
      if (typeof s.carryTeamsCount === "number" && s.carryTeamsCount > 0) {
        setCarryTeamsCount(s.carryTeamsCount);
      }
    }
  }, [dungeonData?.schedule]);

  // Form state
  const [formName, setFormName] = useState("");
  const [formJob, setFormJob] = useState(JOB_LIST[0] ?? "");
  const [formRounds, setFormRounds] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Clipboard toast
  const [copied, setCopied] = useState(false);

  // ── Update carry teams count (auto-saved) ──────────────────
  const updateCarryTeamsCount = async (count: number) => {
    const validCount = Math.max(1, count);
    setCarryTeamsCount(validCount);
    setCarrySaving(true);
    try {
      await fetch("/api/dungeon/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carryTeamsCount: validCount }),
      });
      queryClient.invalidateQueries({ queryKey: ["dungeon_data"] });
    } catch {
      /* silent */
    } finally {
      setCarrySaving(false);
    }
  };

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
        queryClient.invalidateQueries({ queryKey: ["dungeon_data"] });
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
        ? { openDate: "", openTime: "", closeTime: "", carryTeamsCount, isClosed: false }
        : { openDate: schedDate, openTime: schedOpen, closeTime: schedClose, carryTeamsCount, isClosed: false };
      const res = await fetch("/api/dungeon/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.ok) {
        setSchedule(body);
        setSchedMsg({ type: "ok", text: "บันทึกสำเร็จ" });
        queryClient.invalidateQueries({ queryKey: ["dungeon_data"] });
      } else {
        setSchedMsg({ type: "err", text: json.error ?? "เกิดข้อผิดพลาด" });
      }
    } catch {
      setSchedMsg({ type: "err", text: "ไม่สามารถเชื่อมต่อได้" });
    } finally {
      setSchedSaving(false);
    }
  };

  const handleCloseBooking = async () => {
    if (!confirm("แน่ใจที่จะปิดจองดันเจี้ยนใช่ไหม?")) return;
    setSchedSaving(true);
    setSchedMsg(null);
    try {
      const body: DungeonSchedule = { openDate: "", openTime: "06:00", closeTime: "23:59", carryTeamsCount, isClosed: true };
      const res = await fetch("/api/dungeon/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.ok) {
        setSchedule(body);
        setSchedDate("");
        setSchedOpen("06:00");
        setSchedClose("23:59");
        setSchedUnlimited(false);
        setSchedMsg({ type: "ok", text: "ปิดจองสำเร็จ" });
        queryClient.invalidateQueries({ queryKey: ["dungeon_data"] });
      } else {
        setSchedMsg({ type: "err", text: json.error ?? "เกิดข้อผิดพลาด" });
      }
    } catch {
      setSchedMsg({ type: "err", text: "ไม่สามารถเชื่อมต่อได้" });
    } finally {
      setSchedSaving(false);
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
  const isUnlimited = !schedule.openTime && !schedule.closeTime && !schedule.openDate;

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
                        .filter((m) => {
                          // ไม่ให้คนแบกจองคิว
                          const isCarrier = teams.some(t => t.carriers?.includes(m.name));
                          if (isCarrier) return false;
                          
                          // Active queue items are the source of truth for
                          // players who already have a live dungeon queue.
                          const hasActiveQueue = queueItems.some((item) => item.name === m.name);
                          if (hasActiveQueue) return false;

                          return formName === "" || m.name.toLowerCase().includes(formName.toLowerCase());
                        })
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

              {/* Rounds toggle — members get 1 round/day max */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-white mb-2">จำนวนรอบ</label>
                {isAdmin ? (
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
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 py-2 rounded-lg text-sm font-medium text-center bg-[#0b3d63] dark:bg-[#3B66D1] text-white">
                      1 รอบ
                    </span>
                    <p className="text-[11px] text-slate-400 dark:text-[#6B7280]">จองได้ 1 รอบ/วัน · สูงสุด 2 รอบ/อาทิตย์</p>
                  </div>
                )}
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
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#e5edf5] dark:hover:bg-[#2A2F3E] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-[#0b3d63] dark:text-white" />
                  <h3 className="font-bold text-sm text-[#0b3d63] dark:text-white">ตั้งค่าช่วงเวลาเปิดจอง</h3>
                </div>
                <span className="text-[#0b3d63] dark:text-white text-lg">{schedCollapsed ? "▸" : "▾"}</span>
              </button>

              {!schedCollapsed && <div className="px-5 pb-5 flex flex-col gap-3">
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

                {/* Save button */}
                <div className="flex flex-col gap-2 mt-1">
                  <button
                    onClick={handleSaveSchedule}
                    disabled={schedSaving}
                    className="flex items-center justify-center gap-2 bg-[#3B66D1] hover:bg-[#4D73CD] text-white rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {schedSaving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    {schedSaving ? "กำลังบันทึก…" : "บันทึกตั้งค่าเวลา"}
                  </button>

                  <button
                    onClick={handleCloseBooking}
                    disabled={schedSaving}
                    className="flex items-center justify-center gap-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    ปิดจองดันเจี้ยน
                  </button>
                </div>

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

          {/* Carry Teams Card (admin/owner only) */}
          {isAdmin && (
            <div className="bg-[#eef3f8] dark:bg-[#232733] rounded-2xl border border-slate-200 dark:border-[#2D3342] overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-[#0b3d63] dark:text-white" />
                  <h3 className="font-bold text-sm text-[#0b3d63] dark:text-white flex items-center gap-2">
                    ตั้งค่าจำนวนทีมแบก
                    {carrySaving && <RefreshCw size={12} className="animate-spin text-[#3B66D1]" />}
                  </h3>
                </div>
                <span className="text-[#3B66D1] dark:text-[#82A0F5] font-bold text-sm">{carryTeamsCount} ทีม</span>
              </div>
              <div className="px-5 pb-5 flex flex-col gap-3">
                <div className="grid grid-cols-4 gap-1.5 mb-1">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => updateCarryTeamsCount(num)}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                        carryTeamsCount === num
                          ? "bg-[#0b3d63] dark:bg-[#3B66D1] text-white border-transparent shadow-xs"
                          : "bg-white dark:bg-[#272C38] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2D3342] hover:bg-slate-50 dark:hover:bg-[#2F3547]"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <div className="bg-blue-50/80 dark:bg-[#202636] border border-blue-100 dark:border-[#2D3342] rounded-lg p-2.5 text-[11px] text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-blue-800 dark:text-[#82A0F5] mb-1">
                    รองรับผู้เล่นจากคิว:
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-[#8B93A7]">
                    • พระ {carryTeamsCount * 1} คน / รอบ
                    <br/>
                    • อาชีพอื่น {carryTeamsCount * 2} คน / รอบ
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════
            RIGHT PANEL — Team & Queue List
        ═══════════════════════════════════════════════════ */}
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 min-w-0 relative">
            {/* Global Loading State for Right Panel */}
            {loading && (
               <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-50 flex items-center justify-center rounded-2xl backdrop-blur-[1px]">
                 <div className="bg-white dark:bg-[#272C38] px-4 py-2 rounded-lg shadow border border-slate-200 dark:border-[#2D3342] flex items-center gap-2 font-medium text-sm text-[#3B66D1]">
                   <RefreshCw className="animate-spin" size={16} /> กำลังโหลด...
                 </div>
               </div>
            )}
            <TeamBoard
              teams={teams}
              isLoading={loading}
              rosterMembers={rosterMembers}
            />
            <QueueBoard
              queueItems={queueItems}
              isLoading={loading}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["dungeon_data"] })}
            />
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
