"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { X, Swords, Shield, Activity, Calendar, ShieldAlert } from "lucide-react";

function formatDateTH(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

interface MemberProfileModalProps {
  member: any;
  onClose: () => void;
}

export function MemberProfileModal({ member, onClose }: MemberProfileModalProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["member_stats", member.name],
    queryFn: async () => {
      const res = await axios.get(`/api/stats/member?name=${encodeURIComponent(member.name)}`);
      return res.data.data;
    },
    staleTime: 60 * 1000,
  });

  if (!member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-[#1C1F27] w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#2D3342] bg-slate-50 dark:bg-[#232733]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-[#2D3342] flex items-center justify-center text-slate-500 dark:text-[#8B93A7] font-bold text-lg">
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                {member.name}
              </h2>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-[#8B93A7]">
                <span>คลาส: {member.job || "-"}</span>
                <span>•</span>
                <span>Gear: {member.power ? member.power.toLocaleString() : "-"}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:text-[#8B93A7] dark:hover:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-[#2D3342] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
          
          {/* Points & Dungeon Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-1">
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-1">
                <Activity size={16} className="text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-xs font-bold text-amber-600/70 dark:text-amber-400/70">แต้มกิจกรรมสัปดาห์</span>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {member.activity ? member.activity.toLocaleString() : "0"}
              </span>
            </div>
            
            <div className="bg-[#0b3d63]/5 dark:bg-[#3B66D1]/10 border border-[#0b3d63]/10 dark:border-[#3B66D1]/20 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-1">
              <div className="w-8 h-8 rounded-full bg-[#0b3d63]/10 dark:bg-[#3B66D1]/20 flex items-center justify-center mb-1">
                <Shield size={16} className="text-[#0b3d63] dark:text-[#82A0F5]" />
              </div>
              <span className="text-xs font-bold text-[#0b3d63]/70 dark:text-[#82A0F5]/70">รอบลงดันเจี้ยนสะสม</span>
              <span className="text-2xl font-black text-[#0b3d63] dark:text-white">
                {isLoading ? "..." : (data?.dungeon?.totalRuns || "0")}
              </span>
            </div>
          </div>

          {/* War Stats */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-[#2D3342] pb-2">
              <Swords size={16} className="text-emerald-500" />
              สถิติเข้าร่วมกิลด์วอร์
            </h3>
            
            {isLoading ? (
              <div className="text-center py-8 text-slate-400 text-sm">กำลังโหลดข้อมูล...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-400 text-sm">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>
            ) : !data?.attendance ? (
              <div className="text-center py-8 text-slate-400 text-sm">ไม่พบข้อมูลสถิติ</div>
            ) : (
              <>
                {/* Progress Bar / Summary */}
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-slate-500 dark:text-[#8B93A7]">เข้าร่วมทั้งหมด: {data.attendance.total} ครั้ง</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{data.attendance.presentPercent}%</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100 dark:bg-[#2D3342]">
                    <div style={{ width: `${data.attendance.presentPercent}%` }} className="bg-emerald-500 h-full" title="มา"></div>
                    <div style={{ width: `${data.attendance.leavePercent}%` }} className="bg-amber-400 h-full" title="ลา"></div>
                    <div style={{ width: `${data.attendance.absentPercent}%` }} className="bg-red-500 h-full" title="ขาด"></div>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex justify-between text-xs font-bold mt-1">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      มา: {data.attendance.present}
                    </div>
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                      ลา: {data.attendance.leave}
                    </div>
                    <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      ขาด: {data.attendance.absent}
                    </div>
                  </div>
                </div>

                {/* History List */}
                <div className="mt-2 flex flex-col gap-2">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-[#8B93A7] mb-1 uppercase tracking-wider">ประวัติวอร์ย้อนหลัง</h4>
                  {data.attendance.history.length === 0 ? (
                    <div className="text-center py-4 text-slate-400 text-xs">ยังไม่มีประวัติการเช็คชื่อ</div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-2 border border-slate-100 dark:border-[#2D3342] rounded-xl p-2 bg-slate-50/50 dark:bg-[#232733]/50">
                      {data.attendance.history.map((log: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#1C1F27] border border-slate-100 dark:border-[#2D3342] shadow-sm">
                          <div className="flex items-center gap-3">
                            <Calendar size={14} className="text-slate-400" />
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-700 dark:text-white">
                                {formatDateTH(log.date)}
                              </span>
                              {log.note && (
                                <span className="text-[10px] text-slate-400 max-w-[200px] truncate">
                                  {log.note}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                            log.status === "มา" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
                            log.status === "ขาด" ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" :
                            "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                          }`}>
                            {log.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
