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
      className={`flex-shrink-0 bg-theme-sidebar h-screen flex flex-col transition-all duration-300 shadow-xl border-r border-theme-border z-30 ${
        isExpanded ? "w-64" : "w-20"
      }`}
    >
      <div className={`p-5 flex flex-col justify-center min-h-[64px] border-b border-theme-divider/20 ${isExpanded ? "items-start" : "items-center"}`}>
        <div className="flex items-center space-x-2">
          <Settings size={22} className="text-theme-sidebarTextInactive flex-shrink-0" />
          {isExpanded && <h2 className="font-extrabold text-xl tracking-tight text-white dark:text-theme-text uppercase whitespace-nowrap">TOPGUILD OS</h2>}
        </div>
        {isExpanded && <p className="text-theme-sidebarTextInactive opacity-80 text-xs mt-1 ml-8 whitespace-nowrap font-medium">Guild Management</p>}
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto overflow-x-hidden">
        {MENUS.map((menu) => {
          const isActive = pathname === menu.path;
          const Icon = menu.icon;
          return (
            <Link
              key={menu.path}
              href={menu.path}
              title={menu.name}
              className={`flex items-center transition-all ${
                isExpanded ? "px-4 py-3 space-x-3 rounded-lg" : "px-0 py-3 justify-center rounded-lg"
              } ${
                isActive
                  ? "bg-theme-sidebarActive text-theme-sidebarTextActive font-bold shadow-sm"
                  : "text-theme-sidebarTextInactive hover:bg-theme-sidebarActive/20 hover:text-white dark:hover:text-theme-text font-medium"
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
