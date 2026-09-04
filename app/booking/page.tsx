"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { JOB_LIST } from "@/lib/utils";

export default function PublicBookingPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", job: JOB_LIST[0], power: "", dungeon: "ดันมายา (Maya)", rounds: 1 });
  const [message, setMessage] = useState({ type: "", text: "" });

  const { data: schedule } = useQuery({
    queryKey: ["schedule"],
    queryFn: async () => (await axios.get("/api/dungeon/schedule")).data.data
  });

  const { data: queues, isLoading } = useQuery({
    queryKey: ["queues"],
    queryFn: async () => (await axios.get("/api/dungeon/queues")).data.data
  });

  const mutation = useMutation({
    mutationFn: (newQueue: any) => axios.post("/api/dungeon/queues", newQueue),
    onSuccess: () => {
      setMessage({ type: "success", text: "จองคิวสำเร็จ!" });
      queryClient.invalidateQueries({ queryKey: ["queues"] });
      setForm({ ...form, name: "", power: "" }); // reset
    },
    onError: (err: any) => {
      setMessage({ type: "error", text: err.response?.data?.error || "เกิดข้อผิดพลาด" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <div className="min-h-screen bg-[url('https://c4.wallpaperflare.com/wallpaper/435/334/115/ragnarok-online-mmorpg-fantasy-anime-wallpaper-preview.jpg')] bg-cover bg-center bg-fixed font-sans text-gray-800">
      <div className="min-h-screen bg-black/60 backdrop-blur-sm flex flex-col items-center py-10 px-4">
        
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border-t-4 border-guild-500">
          <div className="bg-guild-900 text-white p-8 text-center">
            <h1 className="text-4xl font-black mb-2 tracking-wide">🏰 TOPGUILD DUNGEON QUEUE</h1>
            <p className="text-guild-200">ระบบจองคิวดันเจี้ยนกิลด์</p>
            {schedule && (
              <div className="mt-4 inline-block bg-guild-800 rounded-full px-6 py-2 text-sm text-guild-100 border border-guild-600">
                เวลาเปิดจอง: <span className="font-bold text-yellow-400">{schedule.openTime} - {schedule.closeTime} น.</span> (วันที่ {schedule.openDate})
              </div>
            )}
          </div>

          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Form Section */}
            <div>
              <h2 className="text-2xl font-bold mb-6 text-guild-800 border-b pb-2">📝 ลงชื่อเข้าคิว</h2>
              
              {message.text && (
                <div className={`p-4 mb-6 rounded-md ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                  {message.text}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">ชื่อตัวละคร</label>
                  <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full p-3 border rounded-md" placeholder="ระบุชื่อในเกม" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">อาชีพ</label>
                  <select value={form.job} onChange={e => setForm({...form, job: e.target.value})} className="w-full p-3 border rounded-md">
                    {JOB_LIST.map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">พลังต่อสู้ (Power)</label>
                  <input type="number" required value={form.power} onChange={e => setForm({...form, power: e.target.value})} className="w-full p-3 border rounded-md" placeholder="เช่น 150000" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">ดันเจี้ยน</label>
                  <select value={form.dungeon} onChange={e => setForm({...form, dungeon: e.target.value})} className="w-full p-3 border rounded-md">
                    <option value="ดันมายา (Maya)">ดันมายา (Maya)</option>
                    <option value="ฟองสบู่ (Bubble)">ฟองสบู่ (Bubble)</option>
                    <option value="กระจก (Mirror)">กระจก (Mirror)</option>
                  </select>
                </div>
                
                <button type="submit" disabled={mutation.isPending} className="w-full py-4 bg-guild-600 hover:bg-guild-700 text-white font-bold rounded-lg shadow-lg text-lg transition-transform active:scale-95 disabled:opacity-50 mt-4">
                  {mutation.isPending ? "กำลังลงชื่อ..." : "ส่งคิว (Submit)"}
                </button>
              </form>
            </div>

            {/* Queue List Section */}
            <div>
              <h2 className="text-2xl font-bold mb-6 text-guild-800 border-b pb-2">📋 คิวปัจจุบัน</h2>
              
              <div className="bg-gray-50 rounded-lg border h-[500px] overflow-y-auto">
                {isLoading ? (
                  <div className="p-8 text-center text-gray-500">กำลังโหลดข้อมูล...</div>
                ) : queues?.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">ยังไม่มีคนในคิว</div>
                ) : (
                  <ul className="divide-y">
                    {queues?.map((q: any, i: number) => (
                      <li key={q.id} className="p-4 hover:bg-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-guild-200 text-guild-800 rounded-full flex items-center justify-center font-bold">
                            {i + 1}
                          </div>
                          <div>
                            <div className="font-bold">{q.name} <span className="text-sm font-normal text-gray-500 ml-2">({q.job})</span></div>
                            <div className="text-xs text-gray-500 mt-1">
                              พลัง: {q.power} | ลง {q.rounds} รอบ | {q.dungeon}
                            </div>
                          </div>
                        </div>
                        <div>
                           <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                             q.status === 'waiting' ? 'bg-yellow-100 text-yellow-700' : 
                             q.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                           }`}>
                             {q.status.toUpperCase()}
                           </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
