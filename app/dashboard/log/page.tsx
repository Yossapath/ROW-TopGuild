"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ScrollText,
  Search,
  Trash2,
  Filter,
  CalendarOff,
  Swords,
  ChevronLeft,
  ChevronRight,
  ShieldOff,
} from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { JOB_COLORS, formatTimestamp } from "@/lib/utils";
import type { SystemLog, LeaveRecord, DungeonQueue } from "@/types";

// ── Module badge config ────────────────────────────────────────
const MODULE_COLORS: Record<string, string> = {
  dungeon:    "bg-purple-100 text-purple-700",
  attendance: "bg-green-100 text-green-700",
  leave:      "bg-yellow-100 text-yellow-700",
  roster:     "bg-blue-100 text-blue-700",
  teams:      "bg-orange-100 text-orange-700",
  auth:       "bg-slate-100 text-slate-600",
};

function moduleBadgeClass(mod: string) {
  const key = mod.toLowerCase();
  for (const k of Object.keys(MODULE_COLORS)) {
    if (key.includes(k)) return MODULE_COLORS[k];
  }
  return "bg-slate-100 text-slate-600";
}

function QueueStatusBadge({ status }: { status: string }) {
  if (status === "waiting")
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">รอคิว</span>;
  if (status === "active")
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">กำลังลง</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">เสร็จแล้ว</span>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 py-4 px-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-slate-400">
      <ScrollText size={40} className="mx-auto mb-3 opacity-30" />
      <p className="font-medium">{message}</p>
    </div>
  );
}

const ROWS_PER_PAGE = 50;

export default function LogPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0);
  const [search, setSearch] = useState("");

  // Tab 0 — System Log
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsFetched, setLogsFetched] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [moduleFilter, setModuleFilter] = useState("all");

  // Tab 1 — Leave
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [leavesFetched, setLeavesFetched] = useState(false);

  // Tab 2 — Dungeon Queue
  const [queues, setQueues] = useState<DungeonQueue[]>([]);
  const [queuesLoading, setQueuesLoading] = useState(false);
  const [queuesFetched, setQueuesFetched] = useState(false);

  // ── Fetch on tab switch ──────────────────────────────────────
  useEffect(() => {
    if (activeTab === 0 && isAdmin && !logsFetched) {
      setLogsLoading(true);
      fetch("/api/logs")
        .then((r) => r.json())
        .then((d) => { setLogs(d.data ?? []); setLogsFetched(true); })
        .catch(() => setLogs([]))
        .finally(() => setLogsLoading(false));
    }
  }, [activeTab, isAdmin, logsFetched]);

  useEffect(() => {
    if (activeTab === 1 && !leavesFetched) {
      setLeavesLoading(true);
      fetch("/api/leave")
        .then((r) => r.json())
        .then((d) => { setLeaves(d.data ?? []); setLeavesFetched(true); })
        .catch(() => setLeaves([]))
        .finally(() => setLeavesLoading(false));
    }
  }, [activeTab, leavesFetched]);

  useEffect(() => {
    if (activeTab === 2 && !queuesFetched) {
      setQueuesLoading(true);
      fetch("/api/dungeon/queues")
        .then((r) => r.json())
        .then((d) => { setQueues(d.data ?? []); setQueuesFetched(true); })
        .catch(() => setQueues([]))
        .finally(() => setQueuesLoading(false));
    }
  }, [activeTab, queuesFetched]);

  // ── Delete leave ─────────────────────────────────────────────
  async function handleDeleteLeave(id: string) {
    if (!window.confirm("ยืนยันลบรายการนี้?")) return;
    try {
      await fetch("/api/leave", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setLeaves((prev) => prev.filter((l) => l.id !== id));
    } catch { /* silently fail */ }
  }

  // ── Filter helpers ───────────────────────────────────────────
  const q = search.toLowerCase();

  const filteredLogs = useMemo(() => {
    let list = logs;
    if (moduleFilter !== "all") {
      list = list.filter((l) => l.module.toLowerCase().includes(moduleFilter));
    }
    if (q) {
      list = list.filter(
        (l) =>
          l.module.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.actor.toLowerCase().includes(q) ||
          l.target.toLowerCase().includes(q) ||
          l.detail.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => b.timestamp - a.timestamp);
  }, [logs, q, moduleFilter]);

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / ROWS_PER_PAGE));
  const pagedLogs = filteredLogs.slice((logPage - 1) * ROWS_PER_PAGE, logPage * ROWS_PER_PAGE);

  const filteredLeaves = useMemo(() => {
    const list = q
      ? leaves.filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            (l.reason ?? "").toLowerCase().includes(q) ||
            (l.date ?? "").includes(q) ||
            (l.day ?? "").toLowerCase().includes(q)
        )
      : leaves;
    return [...list].sort((a, b) => b.timestamp - a.timestamp);
  }, [leaves, q]);

  const filteredQueues = useMemo(() => {
    const list = q
      ? queues.filter(
          (qr) =>
            qr.name.toLowerCase().includes(q) ||
            qr.job.toLowerCase().includes(q) ||
            qr.status.toLowerCase().includes(q)
        )
      : queues;
    return [...list].sort((a, b) => b.timestamp - a.timestamp);
  }, [queues, q]);

  const moduleOptions = useMemo(() => {
    const mods = new Set(logs.map((l) => l.module.toLowerCase()));
    return Array.from(mods).sort();
  }, [logs]);

  const TABS = ["📋 System Log", "🏖️ ลาออฟไลน์", "⚔️ จองคิวดันเจี้ยน"];

  return (
    <div
      className="space-y-6 bg-[#f0f6fc] min-h-screen p-4 lg:py-8 lg:px-12 xl:px-24 2xl:px-32 relative"
      style={{ zoom: 0.85 }}
    >
      {/* ── Header Card ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between shadow-sm border border-slate-200 gap-4">
        <div className="flex items-center space-x-4">
          <div className="bg-[#0f4b7a] p-3 rounded-xl text-white shadow-md">
            <ScrollText size={32} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-wide text-[#0b3d63]">
              ประวัติระบบ
            </h1>
            <p className="text-slate-500 text-sm md:text-base font-medium mt-1">
              ดูประวัติการทำรายการทั้งหมด
            </p>
          </div>
        </div>
        <div className="relative w-full md:w-auto">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหา..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setLogPage(1); }}
            className="pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium w-full md:w-72 text-sm"
          />
        </div>
      </div>

      {/* ── Tab Bar ──────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i as 0 | 1 | 2)}
            className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all ${
              activeTab === i
                ? "bg-[#0b3d63] text-white shadow-md"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab 0: System Log ────────────────────────────────── */}
      {activeTab === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {!isAdmin ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <ShieldOff size={48} className="opacity-30" />
              <p className="font-bold text-lg">ไม่มีสิทธิ์เข้าถึง</p>
              <p className="text-sm">เฉพาะ Admin และ Owner เท่านั้น</p>
            </div>
          ) : logsLoading ? (
            <LoadingSkeleton />
          ) : (
            <>
              {/* Filter bar */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                <Filter size={16} className="text-slate-400" />
                <select
                  value={moduleFilter}
                  onChange={(e) => { setModuleFilter(e.target.value); setLogPage(1); }}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="all">ทุก Module</option>
                  {moduleOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <span className="text-sm text-slate-400 ml-auto">
                  {filteredLogs.length} รายการ
                </span>
              </div>

              {filteredLogs.length === 0 ? (
                <EmptyState message="ไม่มีประวัติที่ค้นหา" />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wide">
                        <tr>
                          <th className="px-4 py-3 text-left whitespace-nowrap">วันเวลา</th>
                          <th className="px-4 py-3 text-left">Module</th>
                          <th className="px-4 py-3 text-left">Action</th>
                          <th className="px-4 py-3 text-left">ผู้ทำ</th>
                          <th className="px-4 py-3 text-left">Target</th>
                          <th className="px-4 py-3 text-left">รายละเอียด</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pagedLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-xs">
                              {formatTimestamp(log.timestamp)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${moduleBadgeClass(log.module)}`}>
                                {log.module}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                              {log.action}
                            </td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{log.actor}</td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{log.target}</td>
                            <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={log.detail}>
                              {log.detail}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalLogPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                      <span className="text-sm text-slate-400">
                        หน้า {logPage} / {totalLogPages}
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={logPage <= 1}
                          onClick={() => setLogPage((p) => p - 1)}
                          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          disabled={logPage >= totalLogPages}
                          onClick={() => setLogPage((p) => p + 1)}
                          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Tab 1: ลาออฟไลน์ ─────────────────────────────────── */}
      {activeTab === 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
            <CalendarOff size={18} className="text-yellow-500" />
            <span className="font-bold text-slate-700">รายการแจ้งลา</span>
            <span className="text-sm text-slate-400 ml-auto">{filteredLeaves.length} รายการ</span>
          </div>

          {leavesLoading ? (
            <LoadingSkeleton />
          ) : filteredLeaves.length === 0 ? (
            <EmptyState message="ไม่มีรายการแจ้งลา" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-center w-10">#</th>
                    <th className="px-4 py-3 text-left">ชื่อ</th>
                    <th className="px-4 py-3 text-left">วันที่ลา</th>
                    <th className="px-4 py-3 text-left">วัน</th>
                    <th className="px-4 py-3 text-left">เหตุผล</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">เวลาแจ้ง</th>
                    {isAdmin && <th className="px-4 py-3 text-center w-16">ลบ</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeaves.map((leave, idx) => (
                    <tr key={leave.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{leave.name}</td>
                      <td className="px-4 py-3 text-slate-600">{leave.date ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{leave.day ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={leave.reason}>
                        {leave.reason ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">
                        {formatTimestamp(leave.timestamp)}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteLeave(leave.id)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="ลบรายการ"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: จองคิวดันเจี้ยน ───────────────────────────── */}
      {activeTab === 2 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
            <Swords size={18} className="text-purple-500" />
            <span className="font-bold text-slate-700">ประวัติการจองคิวดันเจี้ยน</span>
            <span className="text-sm text-slate-400 ml-auto">{filteredQueues.length} รายการ</span>
          </div>

          {queuesLoading ? (
            <LoadingSkeleton />
          ) : filteredQueues.length === 0 ? (
            <EmptyState message="ไม่มีรายการจองคิว" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-center w-10">#</th>
                    <th className="px-4 py-3 text-left">ชื่อ</th>
                    <th className="px-4 py-3 text-left">อาชีพ</th>
                    <th className="px-4 py-3 text-right">พลัง</th>
                    <th className="px-4 py-3 text-center">รอบ</th>
                    <th className="px-4 py-3 text-center">สถานะ</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">เวลาจอง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQueues.map((qr, idx) => (
                    <tr key={qr.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{qr.name}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                            style={{ backgroundColor: JOB_COLORS[qr.job] ?? "#94a3b8" }}
                          />
                          <span className="text-slate-600 font-medium">{qr.job}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 font-mono tabular-nums">
                        {qr.power.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          qr.rounds === 2
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {qr.rounds === 2 ? "รอบ 1+2" : "รอบ 1"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <QueueStatusBadge status={qr.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">
                        {formatTimestamp(qr.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
