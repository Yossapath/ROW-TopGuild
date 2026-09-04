import { useAuthStore } from "@/stores/useAuthStore";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Menu as MenuIcon, User as UserIcon, LifeBuoy, LogOut, Moon, Sun, Settings, X, Save, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useTheme } from "next-themes";
import { JOB_LIST } from "@/lib/utils";

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
  const { user, logout, setUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Profile Edit State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editJob, setEditJob] = useState("");
  const [editPower, setEditPower] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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

  const openSettings = () => {
    setIsDropdownOpen(false);
    setEditName(user?.gameUsername || "");
    setEditJob(user?.class || JOB_LIST[0]);
    setEditPower(user?.power?.toString() || "");
    setIsSettingsOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName || !editJob || !editPower) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    setIsSaving(true);
    try {
      await axios.put("/api/roster/member", {
        targetDiscordId: user?.discordId,
        originalName: user?.gameUsername,
        originalJob: user?.class,
        name: editName,
        job: editJob,
        power: editPower
      });
      // Update local user state
      if (user) {
        setUser({
          ...user,
          gameUsername: editName,
          class: editJob,
          power: Number(editPower)
        });
      }
      setIsSettingsOpen(false);
      window.location.reload(); // Reload to refresh data in other components
    } catch (err: any) {
      alert(err.response?.data?.error || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <header className="h-16 flex-shrink-0 bg-theme-panel border-b border-theme-border flex items-center justify-between px-4 lg:px-6 shadow-sm transition-colors duration-300">
      
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
                onClick={openSettings}
                className="w-full text-left px-4 py-2.5 text-sm font-bold text-theme-text hover:bg-theme-bg transition-colors flex items-center gap-3"
              >
                <Settings size={16} className="text-theme-textSecondary" />
                Account Settings
              </button>

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

      {/* Account Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-theme-panel rounded-2xl w-full max-w-md shadow-2xl border border-theme-border flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-theme-divider flex justify-between items-center bg-theme-bg/50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-theme-primary/10 flex items-center justify-center text-theme-primary">
                  <Settings size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-theme-text tracking-tight">Account Settings</h2>
                  <p className="text-xs text-theme-textSecondary font-bold">แก้ไขข้อมูลตัวละครของคุณ</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 hover:bg-theme-bg rounded-full text-theme-textSecondary hover:text-theme-text transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-theme-text mb-1.5">ชื่อในเกม (Game Name)</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-xl px-4 py-3 text-theme-text font-medium focus:ring-2 focus:ring-theme-primary focus:border-theme-primary outline-none transition-all"
                  placeholder="กรอกชื่อในเกม"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-theme-text mb-1.5">อาชีพ (Class)</label>
                <select 
                  value={editJob}
                  onChange={e => setEditJob(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-xl px-4 py-3 text-theme-text font-medium focus:ring-2 focus:ring-theme-primary focus:border-theme-primary outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="" disabled>เลือกอาชีพ</option>
                  {JOB_LIST.map(job => (
                    <option key={job} value={job}>{job}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-theme-text mb-1.5">ค่าพลัง (Power)</label>
                <input 
                  type="number" 
                  value={editPower}
                  onChange={e => setEditPower(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-xl px-4 py-3 text-theme-text font-medium focus:ring-2 focus:ring-theme-primary focus:border-theme-primary outline-none transition-all"
                  placeholder="เช่น 150000"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-theme-textSecondary hover:text-theme-text hover:bg-theme-bg transition-colors"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-theme-primary hover:bg-[#1a66a1] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#065bca]/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isSaving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
