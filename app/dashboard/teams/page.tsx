"use client";

import { Shield, Users, ArrowRightLeft, Wand2 } from "lucide-react";

export default function TeamsPage() {
  return (
    <div className="space-y-6 bg-[#f0f6fc] min-h-screen p-4 lg:py-8 lg:px-12 xl:px-24 2xl:px-32 relative" style={{ zoom: 0.85 }}>
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between shadow-sm border border-slate-200">
        <div className="flex items-center space-x-4 mb-4 md:mb-0">
          <div className="bg-[#0f4b7a] p-3 rounded-xl text-white shadow-md">
            <Shield size={32} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-wide text-[#0b3d63]">จัดทีม GVG (Guild vs Guild)</h1>
            <p className="text-slate-500 text-sm md:text-base font-medium mt-1">ระบบจัดทีมอัตโนมัติและจัดการทีมกิลด์วอร์</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition-colors shadow-sm border border-slate-200">
            <Wand2 size={18} />
            <span>จัดทีม Auto-Match</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0b3d63] text-white rounded-lg font-bold hover:bg-[#0f4b7a] transition-colors shadow-sm">
            <ArrowRightLeft size={18} />
            <span>บันทึกการจัดทีม</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center min-h-[400px]">
        <Users size={64} className="text-slate-300 mb-4" />
        <h2 className="text-2xl font-bold text-slate-600 mb-2">กำลังพัฒนาระบบจัดทีม GVG</h2>
        <p className="text-slate-500 font-medium max-w-md">
          ระบบจัดทีมกำลังถูกย้ายมาจากเวอร์ชันเดิม (Drag & Drop และ Auto Match) จะเปิดใช้งานในอัปเดตถัดไป
        </p>
      </div>
    </div>
  );
}
