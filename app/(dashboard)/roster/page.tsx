"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { JOB_COLORS, JOB_LIST } from "@/lib/utils";

export default function RosterPage() {
  const { data: roster, isLoading } = useQuery({
    queryKey: ["roster"],
    queryFn: async () => (await axios.get("/api/roster")).data.data
  });

  if (isLoading) return <div>กำลังโหลดรายชื่อ...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">รายชื่อสมาชิก (Roster)</h1>
        <button className="bg-guild-600 hover:bg-guild-700 text-white px-4 py-2 rounded-md shadow">
          + เพิ่มสมาชิกใหม่
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {JOB_LIST.map((job) => {
          const members = roster?.[job] || [];
          const jobColor = JOB_COLORS[job];
          
          return (
            <div key={job} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div 
                className="px-4 py-3 text-white font-bold flex justify-between"
                style={{ backgroundColor: jobColor }}
              >
                <span>{job}</span>
                <span>{members.length} คน</span>
              </div>
              <div className="p-0">
                {members.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">ไม่มีสมาชิกอาชีพนี้</div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {members.map((m: any, idx: number) => (
                      <li key={idx} className="px-4 py-3 flex justify-between hover:bg-gray-50">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-sm text-gray-500">พลัง: {m.power}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
