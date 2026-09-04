"use client";

import { useAuthStore } from "@/stores/useAuthStore";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Menu as MenuIcon, User as UserIcon, LifeBuoy, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import axios from "axios";

// Map routes to titles
const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/roster": "รายชื่อสมาชิก",
  "/dashboard/teams": "จัดทีม GVG",
  "/dashboard/dungeon": "ดันเจี้ยน",
  "/dashboard/attendance": "เช็คชื่อวอ",
  "/dashboard/leave": "แจ้งลา",
  "/dashboard/users": "User Management",
  "/dashboard/log": "Activity Log",
};

export default function TopHeader({ 
  isSidebarExpanded, 
  toggleSidebar 
}: { 
  isSidebarExpanded: boolean;
  toggleSidebar: () => void;
}) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const title = ROUTE_TITLES[pathname] || "Dashboard";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await axios.post("/api/auth", { action: "logout" });
    logout();
    router.push("/login");
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 shadow-sm sticky top-0 z-20">
      
      {/* Left section: Hamburger + Title */}
      <div className="flex items-center space-x-4">
        <button 
          onClick={toggleSidebar}
          className="text-slate-500 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition-colors"
        >
          <MenuIcon size={24} />
        </button>
        <h1 className="text-lg font-bold text-slate-800 hidden sm:block">{title}</h1>
      </div>

      {/* Right section: Notifications + Profile */}
      <div className="flex items-center space-x-4">
        
        {/* Notification Bell */}
        <button className="relative p-2 text-slate-500 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            2
          </span>
        </button>

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-2 p-1 pr-2 rounded-full border border-slate-200 hover:border-slate-300 transition-colors shadow-sm bg-white"
          >
            <div className="bg-[#0052cc] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm">
              {user?.username ? user.username.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="hidden md:flex flex-col items-start leading-none mr-2">
              <span className="text-sm font-bold text-slate-800">{user?.username || "Guest"}</span>
              <span className="text-[10px] font-bold text-[#0052cc] uppercase bg-blue-50 px-1 rounded mt-0.5">{user?.role || "MEMBER"}</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-2 border-b border-slate-100 mb-1">
                <p className="text-[10px] font-bold text-slate-500 tracking-wider">SIGNED IN AS</p>
                <p className="text-sm font-bold text-slate-800 truncate">{user?.username}</p>
              </div>
              
              <button className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0052cc] transition-colors flex items-center gap-3">
                <UserIcon size={16} className="text-slate-400" />
                Account Settings
              </button>
              
              <button className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0052cc] transition-colors flex items-center gap-3">
                <LifeBuoy size={16} className="text-green-600" />
                Help & Support (Line)
              </button>
              
              <div className="border-t border-slate-100 my-1"></div>
              
              <button 
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3 uppercase tracking-wider"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
