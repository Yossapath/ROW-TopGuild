"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import axios from "axios";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";

const JOB_CLASSES = [
  "Lord Knight", "Paladin", "High Wizard", "Sniper", 
  "Priest", "Champion", "Assassin Cross", "Merchant", 
  "Gunslinger", "Druid"
];

export default function CompleteProfilePopup() {
  const { user, setUser } = useAuthStore();
  const router = useRouter();
  
  const [gameUsername, setGameUsername] = useState("");
  const [userClass, setUserClass] = useState("");
  const [power, setPower] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isOpen = user && !user.isProfileComplete;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameUsername || !userClass || !power) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      const res = await axios.post("/api/auth/complete-profile", {
        gameUsername,
        class: userClass,
        power: Number(power)
      });

      if (res.data.ok) {
        setUser(res.data.data.user);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={!!isOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              เติมเต็มข้อมูลโปรไฟล์ให้สมบูรณ์
            </Dialog.Title>
            <Dialog.Description className="text-sm text-gray-500">
              กรุณาระบุข้อมูลเกมของคุณเพื่อเข้าใช้งานระบบ
            </Dialog.Description>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Discord Username</label>
              <input 
                type="text" 
                value={user?.discordUsername || ""}
                disabled
                className="flex h-10 w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-gray-700">Username Game (ชื่อในเกม)</label>
              <input 
                type="text" 
                required
                value={gameUsername}
                onChange={(e) => setGameUsername(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="ชื่อตัวละครหลัก"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-gray-700">สายอาชีพ (Class)</label>
              <select 
                required
                value={userClass}
                onChange={(e) => setUserClass(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <option value="" disabled>เลือกสายอาชีพ</option>
                {JOB_CLASSES.map((job) => (
                  <option key={job} value={job}>{job}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-gray-700">พลังต่อสู้ (Power)</label>
              <input 
                type="number" 
                required
                min="0"
                value={power}
                onChange={(e) => setPower(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                placeholder="เช่น 150000"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                type="submit" 
                disabled={loading}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 w-full sm:w-auto"
              >
                {loading ? "กำลังบันทึก..." : "ยืนยันข้อมูล"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
