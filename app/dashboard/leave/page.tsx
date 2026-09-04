"use client";

import { CalendarOff, Send } from "lucide-react";

export default function LeavePage() {
  return (
    <div className="space-y-6 bg-[#f0f6fc] min-h-screen p-4 lg:py-8 lg:px-12 xl:px-24 2xl:px-32 relative" style={{ zoom: 0.85 }}>
      <div className="bg-white rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between shadow-sm border border-slate-200">
        <div className="flex items-center space-x-4">
          <div className="bg-[#0f4b7a] p-3 rounded-xl text-white shadow-md">
            <CalendarOff size={32} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-wide text-[#0b3d63]">แจ้งลากิลด์วอร์</h1>
            <p className="text-slate-500 text-sm md:text-base font-medium mt-1">แจ้งลางาน หรือติดธุระล่วงหน้า</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-2xl mx-auto mt-8">
        <form className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อตัวละคร</label>
            <input 
              type="text" 
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              placeholder="ใส่ชื่อตัวละครของคุณ..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">วันที่ต้องการลา</label>
            <input 
              type="date" 
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">เหตุผลที่ลา</label>
            <textarea 
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium h-32 resize-none"
              placeholder="ระบุเหตุผลที่ต้องการลา..."
            />
          </div>

          <button 
            type="button"
            className="w-full py-3 bg-[#0b3d63] text-white rounded-xl font-bold shadow-md hover:bg-[#0f4b7a] transition-all flex justify-center items-center gap-2"
          >
            <Send size={18} /> แจ้งลา
          </button>
        </form>
      </div>
    </div>
  );
}
