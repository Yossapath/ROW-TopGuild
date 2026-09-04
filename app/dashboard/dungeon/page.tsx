"use client";

import { Swords, ListPlus, UsersRound } from "lucide-react";
import Link from "next/link";

export default function DungeonPage() {
  return (
    <div className="space-y-6 bg-[#f0f6fc] min-h-screen p-4 lg:py-8 lg:px-12 xl:px-24 2xl:px-32 relative" style={{ zoom: 0.85 }}>
      <div className="bg-white rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between shadow-sm border border-slate-200">
        <div className="flex items-center space-x-4 mb-4 md:mb-0">
          <div className="bg-[#0f4b7a] p-3 rounded-xl text-white shadow-md">
            <Swords size={32} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-wide text-[#0b3d63]">จัดการคิวดันเจี้ยน</h1>
            <p className="text-slate-500 text-sm md:text-base font-medium mt-1">ระบบดึงคิวและจัดปาร์ตี้ลงดันเจี้ยนประจำวัน</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Link href="/booking" target="_blank" className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition-colors shadow-sm border border-slate-200">
            <span>ไปหน้าจองคิว (Public)</span>
          </Link>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#0b3d63] text-white rounded-lg font-bold hover:bg-[#0f4b7a] transition-colors shadow-sm">
            <ListPlus size={18} />
            <span>จัดการตารางเวลา</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[400px]">
          <h2 className="text-xl font-bold text-[#0b3d63] mb-4 flex items-center gap-2">
            <ListPlus size={20} /> คิวที่รอจัดทีม
          </h2>
          <div className="flex items-center justify-center h-64 text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
            ไม่มีคิวรอ
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[400px]">
          <h2 className="text-xl font-bold text-[#0b3d63] mb-4 flex items-center gap-2">
            <UsersRound size={20} /> ปาร์ตี้ที่จัดแล้ว
          </h2>
          <div className="flex items-center justify-center h-64 text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
            ไม่มีปาร์ตี้
          </div>
        </div>
      </div>
    </div>
  );
}
