"use client";

import { ScrollText, History, Search } from "lucide-react";

export default function LogPage() {
  return (
    <div className="space-y-6 bg-[#f0f6fc] min-h-screen p-4 lg:py-8 lg:px-12 xl:px-24 2xl:px-32 relative" style={{ zoom: 0.85 }}>
      <div className="bg-white rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between shadow-sm border border-slate-200">
        <div className="flex items-center space-x-4 mb-4 md:mb-0">
          <div className="bg-[#0f4b7a] p-3 rounded-xl text-white shadow-md">
            <ScrollText size={32} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-wide text-[#0b3d63]">ประวัติระบบ (System History)</h1>
            <p className="text-slate-500 text-sm md:text-base font-medium mt-1">ดูประวัติการทำรายการและการแก้ไขข้อมูลในระบบ</p>
          </div>
        </div>
        
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="ค้นหาประวัติ..." 
            className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center min-h-[400px]">
        <History size={64} className="text-slate-300 mb-4" />
        <h2 className="text-2xl font-bold text-slate-600 mb-2">กำลังพัฒนาระบบบันทึกประวัติ</h2>
        <p className="text-slate-500 font-medium max-w-md">
          ระบบจะบันทึกการกระทำต่างๆ เช่น การแก้ไขชื่อ เพิ่มคน ลดค่าพลัง ไว้ที่นี่ในอนาคต
        </p>
      </div>
    </div>
  );
}
