"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import axios from "axios";
import { useState } from "react";
import { 
  LayoutDashboard, 
  Users, 
  Shield, 
  Swords, 
  CheckSquare, 
  CalendarOff, 
  ScrollText, 
  UserCog,
  LogOut,
  ExternalLink,
  ChevronLeft,
  Menu
} from "lucide-react";

const MENUS = [
  { name: "ภาพรวม (Dashboard)", path: "/dashboard", icon: LayoutDashboard },
  { name: "รายชื่อสมาชิก", path: "/dashboard/roster", icon: Users },
  { name: "จัดทีม GVG", path: "/dashboard/teams", icon: Shield },
  { name: "ดันเจี้ยน", path: "/dashboard/dungeon", icon: Swords },
  { name: "เช็คชื่อวอ", path: "/dashboard/attendance", icon: CheckSquare },
  { name: "แจ้งลา", path: "/dashboard/leave", icon: CalendarOff },
  { name: "จัดการผู้ใช้", path: "/dashboard/users", icon: UserCog },
  { name: "บันทึกระบบ", path: "/dashboard/log", icon: ScrollText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isExpanded, setIsExpanded] = useState(true);

  const handleLogout = async () => {
    await axios.post("/api/auth", { action: "logout" });
    logout();
    router.push("/login");
  };

  return (
    <aside 
      className={`flex-shrink-0 bg-guild-900 text-white min-h-screen flex flex-col transition-all duration-300 relative ${
        isExpanded ? "w-64" : "w-20"
      }`}
    >
      {/* Toggle Button */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3 top-6 bg-guild-500 text-white rounded-full p-1 shadow-md border border-guild-900 hover:bg-guild-400 z-10"
      >
        {isExpanded ? <ChevronLeft size={16} /> : <Menu size={16} />}
      </button>

      <div className={`p-6 border-b border-guild-700 flex flex-col ${isExpanded ? "items-start" : "items-center"}`}>
        <h2 className={`font-bold transition-all ${isExpanded ? "text-2xl" : "text-sm text-center"}`}>
          {isExpanded ? "TOPGUILD" : "TG"}
        </h2>
        {user && isExpanded && (
          <div className="mt-2 text-sm text-guild-300 animate-in fade-in duration-300">
            <div>User: {user.username}</div>
            <div>Role: <span className="uppercase text-green-400">{user.role}</span></div>
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-2 overflow-y-auto overflow-x-hidden">
        {MENUS.map((menu) => {
          const isActive = pathname === menu.path;
          const Icon = menu.icon;
          return (
            <Link
              key={menu.path}
              href={menu.path}
              title={menu.name}
              className={`flex items-center rounded-lg transition-colors ${
                isExpanded ? "px-4 py-3 space-x-3" : "px-0 py-3 justify-center"
              } ${
                isActive
                  ? "bg-guild-600 text-white font-bold"
                  : "text-guild-200 hover:bg-guild-800 hover:text-white"
              }`}
            >
              <Icon size={isExpanded ? 20 : 22} className="flex-shrink-0" />
              {isExpanded && <span className="whitespace-nowrap">{menu.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={`p-4 border-t border-guild-700 flex flex-col gap-2 ${isExpanded ? "" : "items-center"}`}>
        <Link 
          href="/booking" 
          target="_blank" 
          title="หน้าจองคิวสาธารณะ"
          className={`flex items-center justify-center rounded border border-guild-500 text-guild-300 hover:bg-guild-800 transition-colors ${
            isExpanded ? "px-4 py-2 space-x-2" : "p-2"
          }`}
        >
          {isExpanded ? (
            <>
              <span className="text-sm">หน้าจองคิวสาธารณะ</span>
              <ExternalLink size={16} />
            </>
          ) : (
            <ExternalLink size={20} />
          )}
        </Link>
        <button
          onClick={handleLogout}
          title="ออกจากระบบ"
          className={`flex items-center justify-center rounded bg-red-600 text-white hover:bg-red-700 transition-colors ${
            isExpanded ? "px-4 py-2 space-x-2" : "p-2"
          }`}
        >
          <LogOut size={isExpanded ? 18 : 20} />
          {isExpanded && <span>ออกจากระบบ</span>}
        </button>
      </div>
    </aside>
  );
}
