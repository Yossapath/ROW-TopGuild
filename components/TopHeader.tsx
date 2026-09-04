"use client";

import { useAuthStore } from "@/stores/useAuthStore";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Menu as MenuIcon, User as UserIcon, LifeBuoy, LogOut, Moon, Sun } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useTheme } from "next-themes";

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
  
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const title = ROUTE_TITLES[pathname] || "Dashboard";

  useEffect(() => {
    setMounted(true);
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
    <header className="h-16 bg-theme-panel border-b border-theme-border flex items-center justify-between px-4 lg:px-6 shadow-sm sticky top-0 z-50 transition-colors duration-300">
      
      {/* Left section: Hamburger + Title */}
      <div className="flex items-center space-x-4">
        <button 
          onClick={toggleSidebar}
          className="text-theme-textSecondary hover:text-theme-text p-1 rounded-md hover:bg-theme-bg transition-colors"
        >
          <MenuIcon size={24} />
        </button>
        <h1 className="text-lg font-bold text-theme-text hidden sm:block">{title}</h1>
      </div>

      {/* Right section: Notifications + Profile */}
      <div className="flex items-center space-x-4">
        
        {/* Theme Toggle */}
        {mounted && (
          <button 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 text-theme-textSecondary hover:text-theme-text rounded-full hover:bg-theme-bg transition-colors"
            title="Toggle Theme"
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        )}

        {/* Notification Bell */}
        <button className="relative p-2 text-theme-textSecondary hover:text-theme-text rounded-full hover:bg-theme-bg transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-theme-danger text-[9px] font-bold text-white">
            2
          </span>
        </button>

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-2 p-1 pr-2 rounded-full border border-theme-border hover:border-theme-borderHover transition-colors shadow-sm bg-theme-panel"
          >
            <div className="bg-theme-primary text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm">
              {user?.discordUsername ? user.discordUsername.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="hidden md:flex flex-col items-start leading-none mr-2">
              <span className="text-sm font-bold text-theme-text">{user?.gameUsername || user?.discordUsername || "Guest"}</span>
              <span className="text-[10px] font-bold text-theme-primary uppercase bg-theme-primary/10 px-1 rounded mt-0.5">{user?.role || "MEMBER"}</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-theme-textMuted">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-theme-panel rounded-xl shadow-lg border border-theme-border py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-2 border-b border-theme-divider mb-1">
                <p className="text-[10px] font-bold text-theme-textSecondary tracking-wider">SIGNED IN AS</p>
                <p className="text-sm font-bold text-theme-text truncate">{user?.gameUsername || user?.discordUsername}</p>
              </div>
              
              <div className="px-4 py-2.5 text-sm font-medium text-theme-text flex items-center gap-3">
                <UserIcon size={16} className="text-theme-textMuted" />
                <span className="truncate">{user?.discordUsername || "No Discord Name"}</span>
              </div>
              
              <div className="px-4 py-2.5 text-sm font-medium text-theme-text flex items-center gap-3">
                <LifeBuoy size={16} className="text-theme-success" />
                <span className="truncate">{user?.class || "No Class"} / {user?.power?.toLocaleString('en-US') || "0"}</span>
              </div>
              
              <div className="border-t border-theme-divider my-1"></div>
              
              <button 
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-sm font-bold text-theme-danger hover:bg-theme-danger/10 transition-colors flex items-center gap-3 uppercase tracking-wider"
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
