"use client";

import { useAuthStore } from "@/stores/useAuthStore";
import { UserCog, Shield, User, Loader2, Trash2, AlertTriangle, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";

type UserData = {
  discordId: string;
  discordUsername: string;
  gameUsername?: string;
  class?: string;
  power?: number;
  role: string;
  createdAt: number;
};

export default function UsersPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const { data: users = [], isLoading, isError } = useQuery<UserData[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await axios.get("/api/users");
      const list = res.data?.data ?? res.data;
      return Array.isArray(list) ? list : [];
    },
    enabled: isAdmin,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ discordId, role }: { discordId: string; role: string }) => {
      await axios.put("/api/users", { discordId, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      alert("อัปเดต Role สำเร็จ!");
    },
    onError: () => {
      alert("เกิดข้อผิดพลาดในการอัปเดต Role");
    },
  });

  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [confirmInput, setConfirmInput] = useState("");

  const deleteUserMutation = useMutation({
    mutationFn: async (discordId: string) => {
      await axios.delete("/api/users", { data: { discordId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setUserToDelete(null);
      setConfirmInput("");
      alert("ลบผู้ใช้เรียบร้อยแล้ว");
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || "เกิดข้อผิดพลาดในการลบผู้ใช้";
      alert(msg);
    },
  });

  const [searchQuery, setSearchQuery] = useState("");

  if (!isAdmin) {
    return (
      <div className="space-y-6 bg-[#f0f6fc] min-h-screen p-4 lg:py-8 lg:px-12 xl:px-24 2xl:px-32 relative" style={{ zoom: 0.85 }}>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-600 text-white">
            <UserCog className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-red-600">Access Denied</h1>
            <p className="text-slate-500 text-sm font-medium mt-0.5">คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะ Admin เท่านั้น)</p>
          </div>
        </div>
      </div>
    );
  }

  const userList = Array.isArray(users) ? users : [];

  // Sort and filter users: admins first, then by gameUsername
  const filteredUsers = userList.filter((u) => {
    if (!u) return false;
    const search = searchQuery.toLowerCase();
    const discordName = (u.discordUsername || "").toLowerCase();
    const gameName = (u.gameUsername || "").toLowerCase();
    return discordName.includes(search) || gameName.includes(search);
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (!a || !b) return 0;
    if (a.role === "admin" && b.role !== "admin") return -1;
    if (a.role !== "admin" && b.role === "admin") return 1;
    const nameA = a.gameUsername || a.discordUsername || "";
    const nameB = b.gameUsername || b.discordUsername || "";
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="space-y-6 bg-[#f0f6fc] dark:bg-[#0a1420] min-h-screen p-4 lg:py-8 lg:px-12 xl:px-24 2xl:px-32 relative" style={{ zoom: 0.85 }}>
      {/* Header Card */}
      <div className="bg-white dark:bg-[#112236] rounded-2xl shadow-sm border border-slate-200 dark:border-[#1e3550] p-5 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#0b3d63]"
          >
            <UserCog className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">จัดการผู้ใช้ (User Management)</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">ตั้งค่าและจัดการสิทธิ์สมาชิกในกิลด์</p>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            placeholder="ค้นหาชื่อในเกม หรือ Discord..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-[#1e3550] bg-white dark:bg-[#15263d] text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-[#0b3d63] dark:focus:ring-sky-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          <svg className="w-5 h-5 absolute right-3 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
      </div>

      <div className="bg-white dark:bg-[#112236] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-[#1e3550] min-h-[400px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 size={48} className="text-[#0b3d63] dark:text-sky-400 animate-spin mb-4" />
            <p className="text-slate-500 dark:text-slate-400 font-bold text-lg animate-pulse">กำลังโหลดข้อมูลผู้ใช้...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-4">
            <AlertTriangle size={48} className="text-red-500 mb-4" />
            <p className="text-red-500 font-bold text-lg">ไม่สามารถโหลดข้อมูลผู้ใช้ได้</p>
            <p className="text-slate-400 text-sm mt-1">กรุณาลองรีเฟรชหน้าใหม่อีกครั้ง หรือตรวจสอบสิทธิ์ Admin</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#1e3550]">
                  <th className="py-3 px-4 font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider text-xs">Discord</th>
                  <th className="py-3 px-4 font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider text-xs">Game Name</th>
                  <th className="py-3 px-4 font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider text-xs">Class / Power</th>
                  <th className="py-3 px-4 font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider text-xs text-center">Role</th>
                  <th className="py-3 px-4 font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider text-xs text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1e3550]">
                {sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500 font-medium">
                      {searchQuery ? "ไม่พบผู้ใช้ที่ตรงกับคำค้นหา" : "ไม่มีข้อมูลผู้ใช้ในระบบ"}
                    </td>
                  </tr>
                ) : (
                  sortedUsers.map((u, index) => (
                    <tr key={u.discordId || `user-${index}`} className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${u.role === 'admin' ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white ${u.role === 'admin' ? 'bg-theme-warning' : 'bg-slate-400'}`}>
                            {u.discordUsername ? u.discordUsername.charAt(0).toUpperCase() : "U"}
                          </div>
                          <span className="font-bold text-theme-text">{u.discordUsername || "Unknown"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-theme-text">{u.gameUsername || "-"}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-theme-text">{u.class || "-"}</span>
                          <span className="text-xs text-theme-textSecondary">{u.power ? u.power.toLocaleString() : "0"} CP</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center items-center">
                          <select
                            value={u.role || "member"}
                            onChange={(e) => {
                              if (window.confirm(`ต้องการเปลี่ยนยศของ ${u.discordUsername || 'ผู้ใช้'} เป็น ${e.target.value} ใช่หรือไม่?`)) {
                                updateRoleMutation.mutate({ discordId: u.discordId, role: e.target.value });
                              }
                            }}
                            disabled={updateRoleMutation.isPending}
                            className={`px-3 py-1.5 rounded-lg font-bold text-sm border-2 outline-none cursor-pointer transition-colors ${
                              u.role === 'admin' 
                                ? 'bg-theme-warning/10 text-theme-warning border-theme-warning/30 hover:border-theme-warning' 
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                            }`}
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                          </select>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isAdmin && (
                          u.discordId === user?.discordId ? (
                            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#15263d] px-2.5 py-1 rounded-md">
                              คุณเอง
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setUserToDelete(u);
                                setConfirmInput("");
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-900/50 transition-colors cursor-pointer"
                              title="ลบผู้ใช้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              ลบ
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal ยืนยันการลบผู้ใช้ */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#112236] border border-slate-200 dark:border-[#1e3550] rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 relative">
            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                if (!deleteUserMutation.isPending) {
                  setUserToDelete(null);
                  setConfirmInput("");
                }
              }}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-[#15263d] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon & Title */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">ยืนยันการลบผู้ใช้</h3>
                <p className="text-xs text-red-500 font-medium">การกระทำนี้จะลบผู้ใช้และไม่สามารถย้อนกลับได้</p>
              </div>
            </div>

            {/* Target User Info */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#15263d] border border-slate-200 dark:border-[#1e3550] space-y-1.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-xs font-semibold">ชื่อตัวละคร:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{userToDelete.gameUsername || "-"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-xs font-semibold">Discord:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{userToDelete.discordUsername}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-xs font-semibold">ตำแหน่ง / ยศ:</span>
                <span className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">{userToDelete.role}</span>
              </div>
            </div>

            {/* Instruction & Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                พิมพ์คำว่า <span className="font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-1.5 py-0.5 rounded">ยืนยัน</span> ในช่องด้านล่างเพื่อดำเนินการลบ:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="พิมพ์ ยืนยัน"
                disabled={deleteUserMutation.isPending}
                autoFocus
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-[#1e3550] bg-white dark:bg-[#0a1420] text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setUserToDelete(null);
                  setConfirmInput("");
                }}
                disabled={deleteUserMutation.isPending}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#15263d] transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => deleteUserMutation.mutate(userToDelete.discordId)}
                disabled={confirmInput.trim() !== "ยืนยัน" || deleteUserMutation.isPending}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all ${
                  confirmInput.trim() === "ยืนยัน" && !deleteUserMutation.isPending
                    ? "bg-red-600 hover:bg-red-700 shadow-md shadow-red-600/30 cursor-pointer"
                    : "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                }`}
              >
                {deleteUserMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังลบ...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    ลบผู้ใช้
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
