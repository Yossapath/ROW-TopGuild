"use client";

import { useAuthStore } from "@/stores/useAuthStore";
import { UserCog, Shield, User, Loader2 } from "lucide-react";
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

  const { data: users = [], isLoading } = useQuery<UserData[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await axios.get("/api/users");
      return res.data;
    },
    enabled: user?.role === "admin",
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

  if (user?.role !== "admin") {
    return (
      <div className="space-y-6 bg-theme-bg min-h-screen p-4 lg:py-8 lg:px-12 xl:px-24 2xl:px-32 relative" style={{ zoom: 0.85 }}>
        <div className="bg-theme-panel rounded-2xl p-6 flex items-center space-x-4 shadow-sm border border-theme-border">
          <div className="bg-theme-danger p-3 rounded-xl text-white shadow-md">
            <UserCog size={32} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-wide text-theme-danger">Access Denied</h1>
            <p className="text-theme-textSecondary text-sm md:text-base font-medium mt-1">คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะ Admin เท่านั้น)</p>
          </div>
        </div>
      </div>
    );
  }

  const [searchQuery, setSearchQuery] = useState("");

  // Sort and filter users: admins first, then by gameUsername
  const filteredUsers = users.filter((u) => {
    const search = searchQuery.toLowerCase();
    const discordName = u.discordUsername?.toLowerCase() || "";
    const gameName = u.gameUsername?.toLowerCase() || "";
    return discordName.includes(search) || gameName.includes(search);
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (a.role === "admin" && b.role !== "admin") return -1;
    if (a.role !== "admin" && b.role === "admin") return 1;
    const nameA = a.gameUsername || a.discordUsername || "";
    const nameB = b.gameUsername || b.discordUsername || "";
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="space-y-6 bg-theme-bg min-h-screen p-4 lg:py-8 lg:px-12 xl:px-24 2xl:px-32 relative" style={{ zoom: 0.85 }}>
      <div className="bg-theme-panel rounded-2xl p-6 flex items-center space-x-4 shadow-sm border border-theme-border justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-4">
          <div className="bg-theme-primary p-3 rounded-xl text-white shadow-md">
            <UserCog size={32} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-wide text-theme-text">จัดการผู้ใช้ (User Management)</h1>
            <p className="text-theme-textSecondary text-sm md:text-base font-medium mt-1">ตั้งค่าและจัดการสิทธิ์สมาชิกในกิลด์</p>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            placeholder="ค้นหาชื่อในเกม หรือ Discord..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-theme-border bg-theme-bg text-theme-text font-medium focus:outline-none focus:ring-2 focus:ring-theme-primary transition-all"
          />
          <svg className="w-5 h-5 absolute right-3 top-3 text-theme-textMuted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
      </div>

      <div className="bg-theme-panel p-6 rounded-2xl shadow-sm border border-theme-border min-h-[400px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 size={48} className="text-theme-primary animate-spin mb-4" />
            <p className="text-theme-textSecondary font-bold text-lg animate-pulse">กำลังโหลดข้อมูลผู้ใช้...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-theme-divider">
                  <th className="py-3 px-4 font-bold text-theme-textMuted uppercase tracking-wider text-xs">Discord</th>
                  <th className="py-3 px-4 font-bold text-theme-textMuted uppercase tracking-wider text-xs">Game Name</th>
                  <th className="py-3 px-4 font-bold text-theme-textMuted uppercase tracking-wider text-xs">Class / Power</th>
                  <th className="py-3 px-4 font-bold text-theme-textMuted uppercase tracking-wider text-xs text-center">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-divider">
                {sortedUsers.map((u) => (
                  <tr key={u.discordId} className={`hover:bg-theme-bg/50 transition-colors ${u.role === 'admin' ? 'bg-theme-primary/5' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white ${u.role === 'admin' ? 'bg-theme-warning' : 'bg-slate-400'}`}>
                          {u.discordUsername?.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-theme-text">{u.discordUsername}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-theme-text">{u.gameUsername || "-"}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-theme-text">{u.class || "-"}</span>
                        <span className="text-xs text-theme-textSecondary">{u.power?.toLocaleString() || "0"} CP</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center items-center">
                        <select
                          value={u.role || "member"}
                          onChange={(e) => {
                            if (window.confirm(`ต้องการเปลี่ยนยศของ ${u.discordUsername} เป็น ${e.target.value} ใช่หรือไม่?`)) {
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
