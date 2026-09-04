"use client";

import { CheckSquare, CalendarDays, CheckCircle2, XCircle } from "lucide-react";

export default function AttendancePage() {
  return (
    <div className="space-y-6 bg-[#f0f6fc] min-h-screen p-4 lg:py-8 lg:px-12 xl:px-24 2xl:px-32 relative" style={{ zoom: 0.85 }}>
      <div className="bg-white rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between shadow-sm border border-slate-200">
        <div className="flex items-center space-x-4 mb-4 md:mb-0">
          <div className="bg-[#0f4b7a] p-3 rounded-xl text-white shadow-md">
            <CheckSquare size={32} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-wide text-[#0b3d63]">เช็คชื่อกิลด์วอร์</h1>
            <p className="text-slate-500 text-sm md:text-base font-medium mt-1">เช็คชื่อประจำวัน คัดลอกรายชื่อส่งบอท</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0b3d63] text-white rounded-lg font-bold hover:bg-[#0f4b7a] transition-colors shadow-sm">
            <CalendarDays size={18} />
            <span>ดูประวัติย้อนหลัง</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[400px]">
          <h2 className="text-xl font-bold text-[#0b3d63] mb-4 flex items-center gap-2">
            รายชื่อเช็คชื่อ
          </h2>
          <div className="flex items-center justify-center h-64 text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
            ระบบเช็คชื่อกำลังพัฒนา
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-green-500" /> สรุปมาวอ
            </h2>
            <div className="text-4xl font-bold text-[#0b3d63]">0 <span className="text-lg text-slate-500 font-medium">คน</span></div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
              <XCircle size={18} className="text-red-500" /> สรุปขาดวอ / ลา
            </h2>
            <div className="text-4xl font-bold text-red-500">0 <span className="text-lg text-slate-500 font-medium">คน</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
