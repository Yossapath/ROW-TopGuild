"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export default function DashboardHome() {
  const { data: roster } = useQuery({
    queryKey: ["roster"],
    queryFn: async () => (await axios.get("/api/roster")).data.data
  });

  const { data: queues } = useQuery({
    queryKey: ["queues"],
    queryFn: async () => (await axios.get("/api/dungeon/queues")).data.data
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">ยินดีต้อนรับสู่ TOPGUILD</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-medium text-gray-500">จำนวนสายอาชีพ (Classes)</h3>
          <p className="text-4xl font-bold text-guild-600 mt-2">
            {roster ? Object.keys(roster).length : 0}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-medium text-gray-500">คิวดันเจี้ยนทั้งหมด</h3>
          <p className="text-4xl font-bold text-orange-500 mt-2">
            {queues ? queues.length : 0}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-medium text-gray-500">ระบบเช็คชื่อ</h3>
          <p className="text-4xl font-bold text-green-500 mt-2">พร้อมใช้งาน</p>
        </div>
      </div>
    </div>
  );
}
