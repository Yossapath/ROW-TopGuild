"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { JOB_COLORS, JOB_LIST } from "@/lib/utils";
import { Search, X, Shield } from "lucide-react";

export default function RosterPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState("ทั้งหมด");
  const [editingMember, setEditingMember] = useState<any>(null);
  
  // Modal states
  const [editName, setEditName] = useState("");
  const [editJob, setEditJob] = useState("");
  const [editPower, setEditPower] = useState("");
  const [editRole, setEditRole] = useState("อิสระ (ให้ระบบจัดให้)");
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

  const handleSave = () => {
    if (!editName || !editJob || !editPower) return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    
    // Deep copy roster
    const newRoster = JSON.parse(JSON.stringify(roster || {}));
    
    if (isAddingNew) {
      if (!newRoster[editJob]) newRoster[editJob] = [];
      newRoster[editJob].push({ name: editName, power: Number(editPower), role: editRole });
    } else {
      // Find and update or move
      if (editingMember.originalJob === editJob) {
        // Just update in place
        const arr = newRoster[editJob] || [];
        const idx = arr.findIndex((m: any) => m.name === editingMember.name);
        if (idx !== -1) {
          arr[idx] = { name: editName, power: Number(editPower), role: editRole };
        }
      } else {
        // Remove from old job
        if (newRoster[editingMember.originalJob]) {
          newRoster[editingMember.originalJob] = newRoster[editingMember.originalJob].filter((m: any) => m.name !== editingMember.name);
        }
        // Add to new job
        if (!newRoster[editJob]) newRoster[editJob] = [];
        newRoster[editJob].push({ name: editName, power: Number(editPower), role: editRole });
      }
    }
    
    mutation.mutate(newRoster);
  };

  const handleDelete = () => {
    if (!editingMember) return;
    if (!confirm("ยืนยันการลบสมาชิกนี้?")) return;
    
    const newRoster = JSON.parse(JSON.stringify(roster || {}));
    if (newRoster[editingMember.originalJob]) {
      newRoster[editingMember.originalJob] = newRoster[editingMember.originalJob].filter((m: any) => m.name !== editingMember.name);
    }
    
    mutation.mutate(newRoster);
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center font-bold text-gray-500">กำลังโหลดรายชื่อ...</div>;

  return (
    <div className="space-y-6 bg-[#f0f6fc] min-h-screen p-4 lg:p-8 relative" style={{ zoom: 0.75 }}>
      
      {/* Top Banner */}
      <div className="bg-[#0f4b7a] rounded-2xl p-6 text-white flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-4">
          <div className="bg-[#1b5d92] p-3 rounded-xl hidden sm:block">
            <Shield className="w-8 h-8 text-blue-200" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-wide">สมาชิกทั้งหมดในกิลด์</h1>
            <p className="text-blue-200 text-sm md:text-base font-medium mt-1">จำแนกตาม {displayJobs.length} สายอาชีพ</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl md:text-5xl font-black">{totalMembers} <span className="text-xl md:text-2xl font-medium">คน</span></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="ค้นหาชื่อสมาชิก..."
              className="block w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1e76b9] sm:text-sm font-medium transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={openAddModal}
            className="w-full sm:w-auto flex-shrink-0 rounded-full bg-[#1e76b9] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#165a8e] transition-colors shadow-sm"
          >
            เพิ่มสมาชิกใหม่
          </button>
        </div>
        <button 
          onClick={() => alert("ระบบ Import Excel กำลังพัฒนา")}
          className="w-full md:w-auto rounded-full bg-white border border-[#1e76b9] px-6 py-2.5 text-sm font-bold text-[#1e76b9] hover:bg-blue-50 transition-colors shadow-sm"
        >
          เพิ่มกลุ่ม (Excel)
        </button>
      </div>

      {/* Summary Pills (Click to Filter) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* All jobs button */}
        <button 
          onClick={() => setSelectedJob("ทั้งหมด")}
          className={`rounded-xl p-3.5 flex items-center justify-between shadow-sm border transition-all ${
            selectedJob === "ทั้งหมด" 
              ? "bg-[#0b3d63] border-[#0b3d63] text-white ring-2 ring-offset-2 ring-[#0b3d63]" 
              : "bg-white border-slate-200 hover:border-[#0b3d63] hover:shadow-md"
          }`}
        >
          <div className="flex items-center space-x-2 font-black text-sm lg:text-base">
            <span>ทั้งหมด</span>
          </div>
          <div className={`px-3 py-1 rounded-lg text-sm font-black ${selectedJob === "ทั้งหมด" ? "bg-white/20" : "bg-slate-100 text-slate-700"}`}>
            {totalMembers}
          </div>
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
              className="bg-white rounded-xl p-3.5 flex items-center justify-between shadow-sm border-y border-r border-slate-200 transition-all hover:shadow-md cursor-pointer text-left"
              style={{ 
                borderLeft: `6px solid ${color}`,
                boxShadow: isSelected ? `0 0 0 2px ${hexToRgba(color, 0.3)}` : undefined,
                backgroundColor: isSelected ? hexToRgba(color, 0.05) : "white"
              }}
            >
              <div className="flex items-center space-x-2 font-black text-sm lg:text-base" style={{ color: color }}>
                <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: color }}></span>
                <span>{job}</span>
              </div>
              <div 
                className="px-3 py-1 rounded-lg text-sm font-black"
                style={{ backgroundColor: hexToRgba(color, 0.15), color: color }}
              >
                {count}
              </div>
            </button>
          );
        })}
      </div>

      {/* Tables Grid (Separated by Class) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
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
              className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all hover:shadow-md"
              style={{ borderTop: `4px solid ${color}` }}
            >
              {/* Header - Styled like old repo */}
              <div 
                className="px-5 py-4 flex items-center justify-between border-b border-slate-100"
                style={{ backgroundColor: hexToRgba(color, 0.08) }}
              >
                <div className="flex items-center space-x-2 font-black text-lg" style={{ color: color }}>
                  <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: color }}></span>
                  <span>{job}</span>
                </div>
                <div 
                  className="px-3 py-1.5 rounded-xl text-xs font-black text-white shadow-sm tracking-wide"
                  style={{ backgroundColor: color }}
                >
                  {members.length} คน
                </div>
              </div>

              {/* Table Column Headers */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50/50 border-b border-slate-100 text-[10.5px] font-bold text-slate-500 uppercase tracking-widest text-left">
                <div className="col-span-2">#</div>
                <div className="col-span-5">ชื่อ</div>
                <div className="col-span-3 text-right">ค่าพลัง</div>
                <div className="col-span-2 text-center">จัดการ</div>
              </div>

              {/* List */}
              <div className="flex-1 p-0">
                {members.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400 font-medium bg-slate-50/50">
                    ไม่มีข้อมูลสมาชิก
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100/60">
                    {members.map((m: any, idx: number) => (
                      <li key={m.name || idx} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-50 transition-colors text-xs sm:text-[13.5px] font-bold group">
                        <div className="col-span-2 text-slate-400 text-left font-medium tabular-nums text-xs">{idx + 1}</div>
                        <div className="col-span-5 text-left truncate text-slate-900 font-black">
                          {m.name || "Unknown"}
                        </div>
                        <div className="col-span-3 text-right tabular-nums tracking-tight" style={{ color: color }}>
                          {m.power != null ? Number(m.power).toLocaleString('en-US') : '-'}
                        </div>
                        <div className="col-span-2 flex justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openEditModal(m, job)}
                            className="px-2 py-1 rounded text-[11px] text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors font-bold"
                          >
                            แก้ไข
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit/Add Modal */}
      {(editingMember || isAddingNew) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden flex flex-col font-prompt animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
              <h2 className="text-xl font-black text-[#0b3d63]">
                {isAddingNew ? "เพิ่มสมาชิกใหม่" : "แก้ไขข้อมูลสมาชิก"}
              </h2>
              <button 
                onClick={() => { setEditingMember(null); setIsAddingNew(false); }}
                className="text-slate-400 hover:bg-slate-100 rounded-full p-1.5 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-[#0b3d63] mb-1.5">ชื่อสมาชิก</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full border border-blue-100 rounded-xl px-4 py-3 text-slate-800 font-bold focus:ring-2 focus:ring-[#1e76b9] focus:border-[#1e76b9] bg-blue-50/40 transition-all outline-none"
                  placeholder="กรอกชื่อตัวละคร..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-[#0b3d63] mb-1.5">อาชีพ</label>
                <select 
                  value={editJob}
                  onChange={e => setEditJob(e.target.value)}
                  className="w-full border border-blue-100 rounded-xl px-4 py-3 text-[#0b3d63] font-bold focus:ring-2 focus:ring-[#1e76b9] focus:border-[#1e76b9] bg-blue-50/40 transition-all outline-none appearance-none cursor-pointer"
                >
                  {JOB_LIST.map(job => (
                    <option key={job} value={job}>{job}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#0b3d63] mb-1.5">ค่าพลัง</label>
                <input 
                  type="number" 
                  value={editPower}
                  onChange={e => setEditPower(e.target.value)}
                  className="w-full border border-blue-100 rounded-xl px-4 py-3 text-[#0b3d63] font-bold focus:ring-2 focus:ring-[#1e76b9] focus:border-[#1e76b9] bg-blue-50/40 transition-all outline-none"
                  placeholder="เช่น 150000"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#0b3d63] mb-1.5">ตำแหน่งวอ (สนามหลัก/สนามรอง)</label>
                <select 
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  className="w-full border border-blue-100 rounded-xl px-4 py-3 text-[#0b3d63] font-bold focus:ring-2 focus:ring-[#1e76b9] focus:border-[#1e76b9] bg-blue-50/40 transition-all outline-none appearance-none cursor-pointer"
                >
                  <option value="อิสระ (ให้ระบบจัดให้)">อิสระ (ให้ระบบจัดให้)</option>
                  <option value="สนามหลัก">สนามหลัก</option>
                  <option value="สนามรอง">สนามรอง</option>
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 flex items-center justify-between border-t border-slate-100">
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
                  className="bg-white border border-slate-200 text-[#0b3d63] px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={handleSave}
                  disabled={mutation.isPending}
                  className="bg-[#1e76b9] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#165a8e] transition-all shadow-sm hover:shadow disabled:opacity-70"
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
