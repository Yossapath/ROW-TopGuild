"use client";

import { Swords, Clock } from "lucide-react";
import Link from "next/link";

export default function BookingPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-[#0b3d63] text-white p-8 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between text-center md:text-left">
          <div>
            <h1 className="text-3xl font-bold flex items-center justify-center md:justify-start gap-3">
              <Swords size={32} /> จองคิวดันเจี้ยนมายา
            </h1>
            <p className="text-blue-200 mt-2 font-medium">ระบบจองคิวสำหรับสมาชิกกิลด์ Topguild</p>
          </div>
          <div className="mt-6 md:mt-0 bg-white/10 p-4 rounded-xl flex items-center gap-3">
            <Clock size={24} className="text-blue-300" />
            <div className="text-left">
              <div className="text-sm text-blue-200 font-bold">สถานะระบบ</div>
              <div className="font-bold text-lg text-green-400">กำลังพัฒนาระบบ</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center">
          <h2 className="text-2xl font-bold text-slate-700 mb-4">ฟอร์มจองคิวกำลังถูกสร้าง</h2>
          <p className="text-slate-500 font-medium mb-8">
            เตรียมพบกับระบบจองคิวรูปแบบใหม่ เร็วๆ นี้!
          </p>
          <Link href="/login" className="px-6 py-3 bg-[#0b3d63] text-white rounded-lg font-bold shadow-md hover:bg-[#0f4b7a] transition-all inline-block">
            กลับหน้าเข้าสู่ระบบ
          </Link>
        </div>

      </div>
    </div>
  );
}
