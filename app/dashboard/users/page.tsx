"use client";

import { useAuthStore } from "@/stores/useAuthStore";
import { UserCog } from "lucide-react";

export default function UsersPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-4 mb-4">
          <div className="bg-blue-100 p-3 rounded-xl text-[#0b3d63]">
            <UserCog size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#0b3d63]">จัดการผู้ใช้ (User Management)</h1>
            <p className="text-slate-500">ระบบจัดการผู้ใช้และสิทธิ์การเข้าถึง</p>
          </div>
        </div>

        {user?.role !== "admin" ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg font-medium border border-red-100 mt-6">
            คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะ Admin เท่านั้น)
          </div>
        ) : (
          <div className="mt-8">
            <p className="text-slate-600">กำลังพัฒนาระบบ...</p>
          </div>
        )}
      </div>
    </div>
  );
}
