"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import axios from "axios";

const MENUS = [
  { name: "ภาพรวม (Dashboard)", path: "/dashboard" },
  { name: "รายชื่อสมาชิก", path: "/dashboard/roster" },
  { name: "จัดทีม GVG", path: "/dashboard/teams" },
  { name: "ดันเจี้ยน", path: "/dashboard/dungeon" },
  { name: "เช็คชื่อวอ", path: "/dashboard/attendance" },
  { name: "แจ้งลา", path: "/dashboard/leave" },
  { name: "บันทึกระบบ", path: "/dashboard/log" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await axios.post("/api/auth", { action: "logout" });
    logout();
    router.push("/login");
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-guild-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-guild-700">
        <h2 className="text-2xl font-bold">TOPGUILD</h2>
        {user && (
          <div className="mt-2 text-sm text-guild-300">
            <div>User: {user.username}</div>
            <div>Role: <span className="uppercase text-green-400">{user.role}</span></div>
          </div>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {MENUS.map((menu) => {
          const isActive = pathname === menu.path;
          return (
            <Link
              key={menu.path}
              href={menu.path}
              className={`block px-4 py-2 rounded-md transition-colors ${
                isActive
                  ? "bg-guild-600 text-white font-medium"
                  : "text-guild-100 hover:bg-guild-800"
              }`}
            >
              {menu.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-guild-700">
        <Link href="/booking" target="_blank" className="block w-full text-center px-4 py-2 mb-2 rounded border border-guild-500 text-guild-300 hover:bg-guild-800 text-sm">
          หน้าจองคิวสาธารณะ ↗
        </Link>
        <button
          onClick={handleLogout}
          className="w-full rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}
