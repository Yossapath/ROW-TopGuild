"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { JOB_COLORS, JOB_LIST } from "@/lib/utils";
import { Shield } from "lucide-react";

export default function RosterPage() {
  const { data: roster, isLoading } = useQuery({
    queryKey: ["roster"],
    queryFn: async () => (await axios.get("/api/roster")).data.data,
  });

  if (isLoading) return <div className="flex h-screen items-center justify-center font-bold text-gray-500">กำลังโหลดรายชื่อ...</div>;

  // Calculate totals and sort jobs by member count (descending)
  const totalMembers = JOB_LIST.reduce((acc, job) => acc + (roster?.[job]?.length || 0), 0);
  
  const sortedJobs = [...JOB_LIST].sort((a, b) => {
    const aCount = roster?.[a]?.length || 0;
    const bCount = roster?.[b]?.length || 0;
    return bCount - aCount;
  }).filter(job => (roster?.[job]?.length || 0) > 0); // Only show jobs that have members? Or show all? The screenshot shows top 10. Let's show all that have members, or all jobs if we want to keep the structure. Let's show all jobs but sort them.
  
  // If we want to show exactly 10, or just all jobs, let's use all jobs sorted.
  const displayJobs = sortedJobs.length > 0 ? sortedJobs : JOB_LIST;

  // Helper to convert hex to rgba for light backgrounds
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <div className="space-y-6 bg-[#f0f6fc] min-h-screen p-4 lg:p-8">
      {/* Top Banner */}
      <div className="bg-[#0f4b7a] rounded-2xl p-6 text-white flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-4">
          <div className="bg-[#1b5d92] p-3 rounded-xl">
            <Shield className="w-8 h-8 text-blue-200" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-wide">สมาชิกทั้งหมดในกิลด์</h1>
            <p className="text-blue-200 text-sm font-medium mt-1">จำแนกตาม {displayJobs.length} สายอาชีพ</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black">{totalMembers} <span className="text-xl font-medium">คน</span></div>
        </div>
      </div>

      {/* Summary Pills */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {displayJobs.map(job => {
          const count = roster?.[job]?.length || 0;
          const color = JOB_COLORS[job] || "#000";
          return (
            <div 
              key={`pill-${job}`} 
              className="bg-white rounded-xl p-3 flex items-center justify-between shadow-sm border-y border-r border-slate-100"
              style={{ borderLeft: `5px solid ${color}` }}
            >
              <div className="flex items-center space-x-2 font-bold text-sm" style={{ color: color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></span>
                <span>{job}</span>
              </div>
              <div 
                className="px-2.5 py-0.5 rounded-md text-xs font-black"
                style={{ backgroundColor: hexToRgba(color, 0.15), color: color }}
              >
                {count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        {displayJobs.map(job => {
          const members = roster?.[job] || [];
          const color = JOB_COLORS[job] || "#000";
          
          return (
            <div key={`col-${job}`} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              {/* Header */}
              <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 bg-white">
                <div className="flex items-center space-x-2 font-black text-sm" style={{ color: color }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                  <span>{job}</span>
                </div>
                <div 
                  className="px-2.5 py-1 rounded-md text-xs font-black text-white"
                  style={{ backgroundColor: color }}
                >
                  {members.length} คน
                </div>
              </div>

              {/* Table Column Headers */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 text-center">
                <div className="col-span-1 text-left">#</div>
                <div className="col-span-5 text-left">ชื่อ</div>
                <div className="col-span-3">ค่าพลัง</div>
                <div className="col-span-3">การจัดการ</div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto max-h-[600px] p-0">
                {members.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400 font-medium">ไม่มีข้อมูล</div>
                ) : (
                  <ul className="divide-y divide-slate-50">
                    {members.map((m: any, idx: number) => (
                      <li key={m.name} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-slate-50 transition-colors text-xs font-bold">
                        <div className="col-span-1 text-slate-400 text-left font-medium">{idx + 1}</div>
                        <div className="col-span-5 text-left truncate" style={{ color: color }}>
                          {m.name}
                        </div>
                        <div className="col-span-3 text-center" style={{ color: color }}>
                          {m.power.toLocaleString()}
                        </div>
                        <div className="col-span-3 text-center">
                          <button className="px-2 py-1 border border-slate-200 rounded text-[10px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors bg-white shadow-sm">
                            แก้ไข
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
    </div>
  );
}
