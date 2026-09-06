import { Swords } from "lucide-react";

export function DungeonHeader() {
  return (
    <div className="bg-white dark:bg-[#232733] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] p-5 mb-5 flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#0b3d63] dark:bg-[#3B66D1] shadow-sm">
        <Swords className="w-6 h-6 text-white" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">ระบบจองดันมายา</h1>
        <p className="text-sm text-slate-500 dark:text-[#8B93A7]">จองคิวดันเจี้ยนมายา · 5 คนต่อทีม · 1-2 รอบต่อรอบ</p>
      </div>
    </div>
  );
}
