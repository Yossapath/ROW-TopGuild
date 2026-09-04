"use client";

import { useAuthStore } from "@/stores/useAuthStore";
import { UserCog } from "lucide-react";

export default function UsersPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6 bg-[#f0f6fc] min-h-screen p-4 lg:py-8 lg:px-12 xl:px-24 2xl:px-32 relative" style={{ zoom: 0.85 }}>
      <div className="bg-white rounded-2xl p-6 flex items-center space-x-4 shadow-sm border border-slate-200">
        <div className="bg-[#0f4b7a] p-3 rounded-xl text-white shadow-md">
          <UserCog size={32} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-wide text-[#0b3d63]">จัดการผู้ใช้ (User Management)</h1>
          <p className="text-slate-500 text-sm md:text-base font-medium mt-1">ระบบจัดการผู้ใช้และสิทธิ์การเข้าถึง</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 min-h-[400px]">
        {user?.role !== "admin" ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg font-bold border border-red-100 flex items-center justify-center h-32 text-lg">
            คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะ Admin เท่านั้น)
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <UserCog size={64} className="text-slate-300 mb-4" />
            <h2 className="text-2xl font-bold text-slate-600 mb-2">กำลังพัฒนาระบบจัดการผู้ใช้</h2>
            <p className="text-slate-500 font-medium">แอดมินจะสามารถแก้ไขรหัสผ่านและสิทธิ์ของสมาชิกได้ที่นี่</p>
          </div>
        )}
      </div>
    </div>
  );
}
