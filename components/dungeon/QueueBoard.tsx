"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { DungeonQueueItem } from "@/types";
import { JOB_COLORS, JOB_LIST } from "@/lib/utils";

export function QueueBoard() {
  const [search, setSearch] = useState("");
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);

  const { data: queueItems, isLoading, refetch } = useQuery<DungeonQueueItem[]>({
    queryKey: ["dungeon_queue_items"],
    queryFn: async () => {
      const res = await fetch("/api/dungeon/queue-items");
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 5000,
  });

  const filteredItems = (queueItems || []).filter((q) => {
    const matchSearch = !search || q.name.toLowerCase().includes(search.toLowerCase());
    const matchJob = selectedJobs.length === 0 || selectedJobs.includes(q.job);
    return matchSearch && matchJob;
  });

  return (
    <div className="flex-1 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-700 dark:text-white">รายชื่อคิว (รายรอบ)</span>
          <span className="bg-[#0b3d63] dark:bg-[#3B66D1] text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {filteredItems.length} คิว
          </span>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#8B93A7]" />
            <input
              type="text"
              placeholder="ค้นหาชื่อตัวละคร..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-[#2D3342] rounded-lg text-xs bg-white dark:bg-[#272C38] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-[#8B93A7] focus:outline-none focus:ring-2 focus:ring-[#4D73CD]"
            />
          </div>
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#272C38] transition-colors text-slate-500 dark:text-[#8B93A7] hover:text-slate-800 dark:hover:text-white"
            title="รีเฟรช"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Job Filters */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <button
          onClick={() => setSelectedJobs([])}
          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
            selectedJobs.length === 0
              ? "bg-[#0b3d63] dark:bg-[#3B66D1] text-white"
              : "bg-white dark:bg-[#272C38] text-slate-600 dark:text-[#8B93A7] border border-slate-200 dark:border-[#2D3342]"
          }`}
        >
          ทั้งหมด
        </button>
        {JOB_LIST.map((job) => {
          const isSelected = selectedJobs.includes(job);
          return (
            <button
              key={job}
              onClick={() => setSelectedJobs(prev => prev.includes(job) ? prev.filter(j => j !== job) : [...prev, job])}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors flex items-center gap-1.5 ${
                isSelected
                  ? "bg-[#0b3d63] dark:bg-[#3B66D1] text-white shadow-xs"
                  : "bg-white dark:bg-[#272C38] text-slate-600 dark:text-[#8B93A7] border border-slate-200 dark:border-[#2D3342]"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: JOB_COLORS[job] ?? "#94a3b8" }} />
              {job}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="bg-white dark:bg-[#232733] rounded-2xl border border-slate-200 dark:border-[#2D3342] p-4">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400"><RefreshCw className="animate-spin mx-auto mb-2" />กำลังโหลด...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-slate-400">ไม่พบคิว</div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((q, idx) => (
              <QueueItemCard key={q.id} q={q} idx={idx + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QueueItemCard({ q, idx }: { q: DungeonQueueItem; idx: number }) {
  const jobColor = JOB_COLORS[q.job] ?? "#888";
  const isAssigned = q.status === "ASSIGNED";

  return (
    <div className={`rounded-xl p-3.5 flex items-center justify-between gap-3 border transition-colors ${
      isAssigned
      ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-300/70 dark:border-blue-700/50 shadow-sm"
      : "bg-slate-50 dark:bg-[#272C38] border-slate-200 dark:border-[#2D3342]"
    }`}>
      <span className="font-mono text-xs font-bold text-slate-400 w-6 text-center">{idx}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400">name:</span>
          <span className="font-bold text-slate-800 dark:text-white">{q.name}</span>
          <span className="text-slate-300 mx-1">|</span>
          <span className="text-xs text-slate-400">class:</span>
          <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: jobColor + "44", color: jobColor, border: `1px solid ${jobColor}66` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: jobColor }} />
            {q.job}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.roundNumber === 1 ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" : "bg-purple-200 text-purple-700 dark:bg-purple-900 dark:text-purple-300"}`}>
            รอบ {q.roundNumber}
          </span>
        </div>
      </div>
      <div>
        {isAssigned ? (
          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">กำลังลง</span>
        ) : (
          <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-1 rounded">รอคิว</span>
        )}
      </div>
    </div>
  );
}
