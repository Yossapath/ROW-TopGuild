"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Users, 
  Shield, 
  Swords, 
  CheckSquare, 
  CalendarOff, 
  ScrollText, 
  UserCog,
  Settings
} from "lucide-react";

const MENUS = [
  { name: "รายชื่อสมาชิก", path: "/dashboard/roster", icon: Users },
  { name: "จัดทีม GVG", path: "/dashboard/teams", icon: Shield },
  { name: "ดันเจี้ยน", path: "/dashboard/dungeon", icon: Swords },
  { name: "เช็คชื่อวอ", path: "/dashboard/attendance", icon: CheckSquare },
  { name: "แจ้งลา", path: "/dashboard/leave", icon: CalendarOff },
  { name: "จัดการผู้ใช้", path: "/dashboard/users", icon: UserCog },
  { name: "ประวัติระบบ", path: "/dashboard/log", icon: ScrollText },
];

export default function Sidebar({ isExpanded }: { isExpanded: boolean }) {
  const pathname = usePathname();

  return (
    <aside 
      className={`flex-shrink-0 bg-[#0b3d63] dark:bg-[#171D27] h-screen flex flex-col transition-all duration-300 shadow-xl border-r border-[#082e4b] dark:border-[#1F2430] z-30 ${
        isExpanded ? "w-64" : "w-20"
      }`}
    >
      <div className={`p-5 flex flex-col justify-center min-h-[64px] border-b border-white/10 dark:border-white/10 ${isExpanded ? "items-start" : "items-center"}`}>
        <div className="flex items-center space-x-2">
          <Settings size={22} className="text-white flex-shrink-0" />
          {isExpanded && <h2 className="font-extrabold text-xl tracking-tight text-white uppercase whitespace-nowrap">TOPGUILD OS</h2>}
        </div>
        {isExpanded && <p className="text-blue-200 dark:text-[#8B93A7] opacity-90 text-xs mt-1 ml-8 whitespace-nowrap font-medium">Guild Management</p>}
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto overflow-x-hidden">
        {MENUS.map((menu) => {
          const isActive = pathname === menu.path;
          const Icon = menu.icon;
          return (
            <Link
              key={menu.path}
              href={menu.path}
              title={menu.name}
              className={`flex items-center transition-all ${
                isExpanded ? "px-4 py-3 space-x-3 rounded-xl" : "px-0 py-3 justify-center rounded-xl"
              } ${
                isActive
                  ? "bg-white text-[#0b3d63] font-bold shadow-md dark:bg-[#3B66D1] dark:text-white dark:shadow-lg dark:shadow-[#3B66D1]/25"
                  : "text-blue-100 hover:bg-white/10 hover:text-white dark:text-[#8B93A7] dark:hover:bg-[#232733] dark:hover:text-white font-medium"
              }`}
            >
              <Icon size={isExpanded ? 20 : 22} className="flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
              {isExpanded && <span className="whitespace-nowrap">{menu.name}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
