"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { JOB_COLORS, JOB_LIST } from "@/lib/utils";
import { Search, X } from "lucide-react";

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

  const allMembers = useMemo(() => {
    if (!roster) return [];
    const list: any[] = [];
    for (const job of JOB_LIST) {
      const mems = roster[job] || [];
      mems.forEach((m: any) => list.push({ ...m, job, originalJob: job }));
    }
    // Sort by power descending
    return list.sort((a, b) => Number(b.power || 0) - Number(a.power || 0));
  }, [roster]);

  const filteredMembers = useMemo(() => {
    return allMembers.filter(m => {
      if (selectedJob !== "ทั้งหมด" && m.job !== selectedJob) return false;
      if (searchQuery && !m.name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [allMembers, selectedJob, searchQuery]);

  const hexToRgba = (hex: string, alpha: number) => {
    let cleanHex = hex.replace("#", "");
    if (cleanHex.length === 3) cleanHex = cleanHex.split("").map(c => c + c).join("");
    if (cleanHex.length !== 6) return `rgba(0, 0, 0, ${alpha})`;
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const openEditModal = (member: any) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditJob(member.job);
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
    <div className="space-y-6 bg-[#f0f6fc] min-h-screen p-4 lg:p-8 relative">
      
      {/* Top Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="ค้นหาชื่อสมาชิก..."
              className="block w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-11 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 sm:text-sm transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={openAddModal}
            className="flex-shrink-0 rounded-full bg-[#1e76b9] px-6 py-2 text-sm font-bold text-white hover:bg-[#165a8e] transition-colors shadow-sm"
          >
            เพิ่มสมาชิกใหม่
          </button>
        </div>
        <button 
          onClick={() => alert("ระบบ Import Excel กำลังพัฒนา")}
          className="w-full md:w-auto rounded-full bg-white border border-[#1e76b9] px-6 py-2 text-sm font-bold text-[#1e76b9] hover:bg-blue-50 transition-colors"
        >
          เพิ่มกลุ่ม (Excel)
        </button>
      </div>

      {/* Class Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedJob("ทั้งหมด")}
          className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors shadow-sm ${
            selectedJob === "ทั้งหมด" 
              ? "bg-[#0b3d63] text-white border-[#0b3d63]" 
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          ทั้งหมด ({allMembers.length})
        </button>
        {JOB_LIST.map(job => {
          const color = JOB_COLORS[job];
          const count = roster?.[job]?.length || 0;
          if (count === 0) return null; // hide empty jobs in filter
          const isSelected = selectedJob === job;
          return (
            <button
              key={job}
              onClick={() => setSelectedJob(job)}
              className="px-4 py-2 rounded-full text-sm font-bold border transition-colors shadow-sm flex items-center space-x-2"
              style={{ 
                backgroundColor: isSelected ? color : "white",
                color: isSelected ? "white" : color,
                borderColor: isSelected ? color : "var(--slate-200)"
              }}
            >
              {!isSelected && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></span>}
              <span>{job} ({count})</span>
            </button>
          );
        })}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#0b3d63] text-white text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4 text-center rounded-tl-2xl">#</th>
                <th className="px-6 py-4">รายชื่อ / Guild</th>
                <th className="px-6 py-4 text-center">อาชีพ / Class</th>
                <th className="px-6 py-4 text-center">ค่าพลัง / Power</th>
                <th className="px-6 py-4 text-center rounded-tr-2xl">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">ไม่มีข้อมูลสมาชิก</td>
                </tr>
              ) : (
                filteredMembers.map((m, idx) => {
                  const color = JOB_COLORS[m.job];
                  return (
                    <tr key={m.name} className="hover:bg-slate-50 transition-colors group font-bold">
                      <td className="px-6 py-3.5 text-center text-slate-400">{idx + 1}</td>
                      <td className="px-6 py-3.5 text-slate-800 text-base">{m.name}</td>
                      <td className="px-6 py-3.5 text-center">
                        <span 
                          className="px-3 py-1 rounded-full text-xs"
                          style={{ backgroundColor: hexToRgba(color, 0.1), color: color, border: `1px solid ${hexToRgba(color, 0.2)}` }}
                        >
                          {m.job}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center text-[15px]" style={{ color: color }}>
                        {Number(m.power || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <button 
                          onClick={() => openEditModal(m)}
                          className="px-4 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors bg-white shadow-sm font-bold"
                        >
                          แก้ไข
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Add Modal */}
      {(editingMember || isAddingNew) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden flex flex-col font-prompt animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
              <h2 className="text-lg font-black text-[#0b3d63]">
                {isAddingNew ? "เพิ่มสมาชิกใหม่" : "แก้ไขข้อมูลสมาชิก"}
              </h2>
              <button 
                onClick={() => { setEditingMember(null); setIsAddingNew(false); }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#0b3d63] mb-1.5">ชื่อสมาชิก</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full border border-blue-100 rounded-lg px-4 py-2.5 text-slate-800 font-bold focus:ring-2 focus:ring-[#1e76b9] focus:border-[#1e76b9] bg-blue-50/30"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-[#0b3d63] mb-1.5">อาชีพ</label>
                <select 
                  value={editJob}
                  onChange={e => setEditJob(e.target.value)}
                  className="w-full border border-blue-100 rounded-lg px-4 py-2.5 text-[#0b3d63] font-bold focus:ring-2 focus:ring-[#1e76b9] focus:border-[#1e76b9] bg-blue-50/30 appearance-none"
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
                  className="w-full border border-blue-100 rounded-lg px-4 py-2.5 text-[#0b3d63] font-bold focus:ring-2 focus:ring-[#1e76b9] focus:border-[#1e76b9] bg-blue-50/30"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#0b3d63] mb-1.5">ตำแหน่งวอ (สนามหลัก/สนามรอง)</label>
                <select 
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  className="w-full border border-blue-100 rounded-lg px-4 py-2.5 text-[#0b3d63] font-bold focus:ring-2 focus:ring-[#1e76b9] focus:border-[#1e76b9] bg-blue-50/30 appearance-none"
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
                  className="bg-[#e74c3c] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#c0392b] transition-colors"
                >
                  ลบสมาชิกนี้
                </button>
              ) : <div></div>}
              
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => { setEditingMember(null); setIsAddingNew(false); }}
                  className="bg-white border border-slate-200 text-[#0b3d63] px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={handleSave}
                  disabled={mutation.isPending}
                  className="bg-[#1e76b9] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#165a8e] transition-colors"
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
