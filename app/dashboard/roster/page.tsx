"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { JOB_COLORS, JOB_LIST } from "@/lib/utils";
import { Search, X, Shield } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";

export default function RosterPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState("ทั้งหมด");
  const [editingMember, setEditingMember] = useState<any>(null);
  
  // Modal states
  const [editName, setEditName] = useState("");
  const [editJob, setEditJob] = useState("");
  const [editPower, setEditPower] = useState("");
  const [editRole, setEditRole] = useState("อิสระ (ให้ระบบจัดให้)");
  const [editDiscordUsername, setEditDiscordUsername] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);

  const { data: roster, isLoading } = useQuery({
    queryKey: ["roster"],
    queryFn: async () => (await axios.get("/api/roster")).data.data,
  });

  const mutation = useMutation({
    mutationFn: async (newRoster) => {
      await axios.put("/api/roster", newRoster);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roster"] });
      setEditingMember(null);
      setIsAddingNew(false);
    },
  });

  const totalMembers = useMemo(() => {
    return JOB_LIST.reduce((acc, job) => acc + (roster?.[job]?.length || 0), 0);
  }, [roster]);

  const sortedJobs = useMemo(() => {
    return [...JOB_LIST].sort((a, b) => {
      const aCount = roster?.[a]?.length || 0;
      const bCount = roster?.[b]?.length || 0;
      return bCount - aCount;
    });
  }, [roster]);

  const displayJobs = useMemo(() => {
    const jobs = sortedJobs.length > 0 ? sortedJobs : JOB_LIST;
    if (selectedJob !== "ทั้งหมด") {
      return jobs.filter(job => job === selectedJob);
    }
    return jobs;
  }, [sortedJobs, selectedJob]);

  const hexToRgba = (hex: string, alpha: number) => {
    let cleanHex = hex.replace("#", "");
    if (cleanHex.length === 3) cleanHex = cleanHex.split("").map(c => c + c).join("");
    if (cleanHex.length !== 6) return `rgba(0, 0, 0, ${alpha})`;
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const openEditModal = (member: any, job: string) => {
    setEditingMember({ ...member, originalJob: job });
    setEditName(member.name);
    setEditJob(job);
    setEditPower(member.power?.toString() || "");
    setEditRole(member.role || "อิสระ (ให้ระบบจัดให้)");
    setEditDiscordUsername(member.discordUsername || "");
    setIsAddingNew(false);
  };

  const openAddModal = () => {
    setEditingMember(null);
    setEditName("");
    setEditJob(JOB_LIST[0]);
    setEditPower("");
    setEditRole("อิสระ (ให้ระบบจัดให้)");
    setIsAddingNew(true);
  };

  const handleSave = async () => {
    if (!editName || !editJob || !editPower) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    
    if (isAddingNew) {
      // Add new is still handled by full roster mutation (admin only)
      const newRoster = JSON.parse(JSON.stringify(roster || {}));
      if (!newRoster[editJob]) newRoster[editJob] = [];
      newRoster[editJob].push({ 
        name: editName, 
        power: Number(editPower), 
        role: editRole,
        discordId: `manual_${Date.now()}` // Mock ID for manual adds
      });
      mutation.mutate(newRoster);
    } else {
      // Edit existing user via targeted API
      try {
        await axios.put("/api/roster/member", {
          targetDiscordId: editingMember.discordId || editingMember.name, // fallback
          originalName: editingMember.name,
          originalJob: editingMember.originalJob,
          name: editName,
          job: editJob,
          power: editPower,
          warRole: editRole
        });
        queryClient.invalidateQueries({ queryKey: ["roster"] });
        setEditingMember(null);
      } catch (err: any) {
        alert(err.response?.data?.error || "เกิดข้อผิดพลาดในการบันทึก");
      }
    }
  };

  const handleDelete = async () => {
    if (!editingMember) return;
    if (!confirm("ยืนยันการลบสมาชิกนี้? การลบนี้จะลบข้อมูลของ User คนนี้ออกจากระบบทั้งหมด")) return;
    
    try {
      await axios.delete("/api/roster", {
        data: {
          discordId: editingMember.discordId,
          name: editingMember.name,
          job: editingMember.originalJob
        }
      });
      queryClient.invalidateQueries({ queryKey: ["roster"] });
      setEditingMember(null);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการลบสมาชิก");
    }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center font-bold text-gray-500">กำลังโหลดรายชื่อ...</div>;

  return (
    <div className="space-y-6 bg-[#f0f6fc] dark:bg-[#1C1F27] min-h-screen p-4 lg:py-8 lg:px-12 xl:px-24 2xl:px-32 relative" style={{ zoom: 0.85 }}>
      
      {/* Top Banner */}
      <div className="bg-[#0b3d63] rounded-2xl p-6 text-white flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-4">
          <div className="bg-white/10 p-3 rounded-xl hidden sm:block">
            <Shield className="w-8 h-8 text-blue-200" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-wide">สมาชิกทั้งหมดในกิลด์</h1>
            <p className="text-blue-200 text-sm md:text-base font-medium mt-1">จำแนกตาม {displayJobs.length} สายอาชีพ</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl md:text-5xl font-bold">{totalMembers} <span className="text-xl md:text-2xl font-medium">คน</span></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-theme-panel p-4 rounded-2xl shadow-sm border border-theme-border">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-4 w-4 text-theme-textMuted" />
            </div>
            <input
              type="text"
              placeholder="ค้นหาชื่อสมาชิก..."
              className="block w-full rounded-full border border-theme-border bg-theme-bg py-2.5 pl-11 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#6B7280] focus:bg-theme-panel focus:ring-2 focus:ring-[#4D73CD] dark:focus:ring-[#4D73CD] sm:text-sm font-medium transition-colors outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {isAdmin && (
            <button 
              onClick={openAddModal}
              className="w-full sm:w-auto flex-shrink-0 rounded-full bg-[#3B66D1] hover:bg-[#4D73CD] px-6 py-2.5 text-sm font-bold text-white transition-colors shadow-sm"
            >
              เพิ่มสมาชิกใหม่
            </button>
          )}
        </div>
        {isAdmin && (
          <button 
            onClick={() => alert("ระบบ Import Excel กำลังพัฒนา")}
            className="w-full md:w-auto rounded-full bg-theme-panel border border-[#0b3d63] dark:border-[#4D73CD] px-6 py-2.5 text-sm font-bold text-[#0b3d63] dark:text-white hover:bg-blue-50 dark:hover:bg-[#2A2F3E] transition-colors shadow-sm"
          >
            เพิ่มกลุ่ม (Excel)
          </button>
        )}
      </div>

      {/* Summary Pills (Wrap naturally without horizontal scrollbar) */}
      <div className="flex flex-wrap items-center gap-2.5 pb-1">
        {/* All jobs button */}
        <button 
          onClick={() => setSelectedJob("ทั้งหมด")}
          className={`rounded-2xl px-4 py-2 flex items-center gap-2.5 shadow-sm border transition-all flex-shrink-0 cursor-pointer ${
            selectedJob === "ทั้งหมด" 
              ? "bg-[#14161D] border-[#4D73CD] text-white ring-1 ring-[#4D73CD]/50" 
              : "bg-[#14161D] border-[#262A35] hover:border-slate-500 text-slate-300"
          }`}
        >
          <span className="font-bold text-sm">ทั้งหมด</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            selectedJob === "ทั้งหมด" 
              ? "bg-[#1E2330] text-[#4D73CD] border border-[#4D73CD]/40" 
              : "bg-[#1E2330] text-slate-400"
          }`}>
            {totalMembers}
          </span>
        </button>

        {sortedJobs.map(job => {
          const count = roster?.[job]?.length || 0;
          if (count === 0 && searchQuery) return null; // Hide if empty during search
          const color = JOB_COLORS[job] || "#000";
          const isSelected = selectedJob === job;

          return (
            <button 
              key={`pill-${job}`} 
              onClick={() => setSelectedJob(isSelected ? "ทั้งหมด" : job)}
              className={`rounded-2xl px-4 py-2 flex items-center gap-2.5 shadow-sm border transition-all hover:border-slate-400 flex-shrink-0 cursor-pointer ${
                isSelected 
                  ? "bg-[#14161D] border-[#4D73CD] ring-1 ring-[#4D73CD]/50" 
                  : "bg-[#14161D] border-[#262A35]"
              }`}
            >
              <div className="flex items-center space-x-2 font-bold text-sm text-slate-200">
                <span className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: color }}></span>
                <span>{job}</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#1E2330] text-slate-400">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tables Grid (Auto-fit Cards with comfortable min-width and auto-fit height) */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5 items-start">
        {displayJobs.map(job => {
          const rawMembers = roster?.[job] || [];
          
          // Filter by search query
          const filteredMembers = rawMembers.filter((m: any) => {
            if (searchQuery && !m.name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
          });

          // Sort by power descending
          const members = [...filteredMembers].sort((a, b) => (Number(b.power) || 0) - (Number(a.power) || 0));
          
          if (members.length === 0 && searchQuery) return null; // Hide column if search gives no results

          const color = JOB_COLORS[job] || "#000";
          
          return (
            <div 
              key={`col-${job}`} 
              className="bg-[#14161D] rounded-2xl shadow-sm border border-[#262A35] overflow-hidden flex flex-col transition-all hover:shadow-md h-fit"
              style={{ borderTop: `3px solid ${color}` }}
            >
              {/* Header */}
              <div className="px-5 py-4 flex items-center justify-between border-b border-[#232938]">
                <div className="flex items-center space-x-2.5 font-bold text-base text-white min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: color }}></span>
                  <span className="truncate">{job}</span>
                </div>
                <div 
                  className="px-3 py-0.5 rounded-full text-xs font-medium text-slate-400 bg-[#1E2330] border border-[#2A3040] shrink-0 ml-2"
                >
                  {members.length} คน
                </div>
              </div>

              {/* Table Column Headers */}
              <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-[#232938] text-[11px] font-medium text-slate-500">
                <div className="w-6 text-left flex-shrink-0">#</div>
                <div className="flex-1 min-w-0 text-left">ชื่อ</div>
                <div className="flex-shrink-0 text-right whitespace-nowrap">คะแนน</div>
                {isAdmin && <div className="w-12 text-center flex-shrink-0 ml-1">จัดการ</div>}
              </div>

              {/* List */}
              <div className="p-0 bg-[#14161D] flex flex-col">
                {members.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 px-4">
                    <div className="w-10 h-10 rounded-full border border-dashed border-[#262A35] flex items-center justify-center mb-2.5">
                      <span className="text-slate-600 text-sm font-bold">—</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">ไม่มีข้อมูลสมาชิก</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-[#232938]/60">
                    {members.map((m: any, idx: number) => {
                      const rank = idx + 1;
                      return (
                        <li key={m.name || idx} className="flex items-center justify-between gap-2 px-5 py-3.5 hover:bg-[#1A1F2C] transition-colors text-[13px] group">
                          {/* Rank Number without border/frame */}
                          <div className="w-6 text-left flex-shrink-0 text-slate-400 font-mono text-sm font-medium">
                            {rank}
                          </div>

                          {/* Member Name */}
                          <div className="flex-1 min-w-0 text-left truncate text-white font-bold text-sm" title={m.name}>
                            {m.name || "Unknown"}
                          </div>

                          {/* Score / Power without 'หน่วย' */}
                          <div className="flex-shrink-0 text-right tabular-nums whitespace-nowrap pl-2">
                            <span className="font-bold text-white text-sm">
                              {m.power != null ? Number(m.power).toLocaleString('en-US') : '-'}
                            </span>
                          </div>

                          {/* Admin Management Button */}
                          {isAdmin && (
                            <div className="w-12 flex-shrink-0 flex justify-center ml-1">
                              <button 
                                onClick={() => openEditModal(m, job)}
                                className="px-2.5 py-1 bg-[#1E2330] border border-[#2D3342] hover:border-[#4D73CD] rounded-md text-[11px] font-bold text-slate-300 hover:text-white shadow-sm hover:bg-[#3B66D1] transition-colors"
                              >
                                แก้ไข
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit/Add Modal */}
      {(editingMember || isAddingNew) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-theme-panel rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden flex flex-col font-prompt border border-theme-border animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-theme-border/50">
              <h2 className="text-xl font-bold text-[#0b3d63] dark:text-white">
                {isAddingNew ? "เพิ่มสมาชิกใหม่" : "แก้ไขข้อมูลสมาชิก"}
              </h2>
              <button 
                onClick={() => { setEditingMember(null); setIsAddingNew(false); }}
                className="text-theme-textMuted hover:bg-theme-divider rounded-full p-1.5 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {!isAddingNew && editDiscordUsername && (
                <div>
                  <label className="block text-sm font-bold text-[#0b3d63] dark:text-white mb-1.5">Discord Username</label>
                  <input 
                    type="text" 
                    value={editDiscordUsername}
                    disabled
                    className="w-full border border-gray-200 dark:border-[#2D3342] rounded-xl px-4 py-3 text-gray-500 dark:text-[#8B93A7] font-medium bg-gray-100 dark:bg-[#272C38] cursor-not-allowed outline-none"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-[#0b3d63] dark:text-white mb-1.5">ชื่อสมาชิก (ในเกม)</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full border border-blue-100 dark:border-[#2D3342] rounded-xl px-4 py-3 text-theme-text font-bold focus:ring-2 focus:ring-[#4D73CD] dark:focus:ring-[#4D73CD] focus:border-[#0b3d63] bg-blue-50/40 dark:bg-[#272C38] transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-[#6B7280]"
                  placeholder="กรอกชื่อตัวละคร..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-[#0b3d63] dark:text-white mb-1.5">อาชีพ</label>
                <select 
                  value={editJob}
                  onChange={e => setEditJob(e.target.value)}
                  className="w-full border border-blue-100 dark:border-[#2D3342] rounded-xl px-4 py-3 text-[#0b3d63] dark:text-white font-bold focus:ring-2 focus:ring-[#4D73CD] dark:focus:ring-[#4D73CD] focus:border-[#0b3d63] bg-blue-50/40 dark:bg-[#272C38] transition-all outline-none appearance-none cursor-pointer"
                >
                  {JOB_LIST.map(job => (
                    <option key={job} value={job}>{job}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#0b3d63] dark:text-white mb-1.5">ค่าพลัง</label>
                <input 
                  type="number" 
                  value={editPower}
                  onChange={e => setEditPower(e.target.value)}
                  className="w-full border border-blue-100 dark:border-[#2D3342] rounded-xl px-4 py-3 text-[#0b3d63] dark:text-white font-bold focus:ring-2 focus:ring-[#4D73CD] dark:focus:ring-[#4D73CD] focus:border-[#0b3d63] bg-blue-50/40 dark:bg-[#272C38] transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-[#6B7280]"
                  placeholder="เช่น 150000"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#0b3d63] dark:text-white mb-1.5">
                  ตำแหน่งวอ (สนามหลัก/สนามรอง) {user?.role !== "admin" && <span className="text-red-500 text-xs ml-2">(แอดมินเท่านั้น)</span>}
                </label>
                <select 
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  disabled={user?.role !== "admin"}
                  className={`w-full border rounded-xl px-4 py-3 font-bold transition-all outline-none appearance-none ${user?.role === "admin" ? "border-blue-100 dark:border-[#2D3342] text-[#0b3d63] dark:text-white focus:ring-2 focus:ring-[#4D73CD] dark:focus:ring-[#4D73CD] focus:border-[#0b3d63] bg-blue-50/40 dark:bg-[#272C38] cursor-pointer" : "bg-gray-100 dark:bg-[#272C38] text-gray-500 dark:text-[#8B93A7] cursor-not-allowed border-gray-200 dark:border-[#2D3342]"}`}
                >
                  <option value="อิสระ (ให้ระบบจัดให้)">อิสระ (ให้ระบบจัดให้)</option>
                  <option value="สนามหลัก">สนามหลัก</option>
                  <option value="สนามรอง">สนามรอง</option>
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-theme-bg flex items-center justify-between border-t border-theme-border/50">
              {!isAddingNew ? (
                <button 
                  onClick={handleDelete}
                  className="bg-[#e74c3c] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#c0392b] transition-all shadow-sm hover:shadow"
                >
                  ลบสมาชิกนี้
                </button>
              ) : <div></div>}
              
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => { setEditingMember(null); setIsAddingNew(false); }}
                  className="bg-theme-panel border border-theme-border text-[#0b3d63] dark:text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-theme-bg transition-all shadow-sm"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={handleSave}
                  disabled={mutation.isPending}
                  className="bg-[#3B66D1] hover:bg-[#4D73CD] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow disabled:opacity-70"
                >
                  {mutation.isPending ? "กำลังบันทึก..." : "บันทึกสมาชิก"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
