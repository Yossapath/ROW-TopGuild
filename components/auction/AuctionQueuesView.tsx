"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuctionItem, AuctionReservation } from "@/types";
import { Search, PackageOpen } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";

interface Props {
  auctions: AuctionItem[];
}

export function AuctionQueuesView({ auctions }: Props) {
  const [selectedAuctionId, setSelectedAuctionId] = useState<string>(auctions[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const selectedAuction = auctions.find(a => a.id === selectedAuctionId);

  const { data: queue, isLoading } = useQuery<AuctionReservation[]>({
    queryKey: ["auction_queue", selectedAuctionId],
    queryFn: async () => {
      if (!selectedAuctionId) return [];
      const res = await fetch(`/api/auctions/${selectedAuctionId}/reserve`);
      if (!res.ok) throw new Error("Failed to fetch queue");
      return res.json();
    },
    enabled: !!selectedAuctionId,
  });

  const filteredAuctions = auctions.filter(a => a.itemName.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar / Filter */}
      <div className="w-full lg:w-1/3 flex flex-col gap-4">
        <div className="bg-white dark:bg-[#1A1D27] p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] flex flex-col gap-4 h-[600px]">
          <h3 className="font-bold text-slate-800 dark:text-white text-lg">เลือกไอเทม</h3>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="ค้นหาไอเทม..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#232733] border border-slate-200 dark:border-[#2D3342] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3B66D1] text-slate-800 dark:text-white text-sm"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {filteredAuctions.map(auction => (
              <button
                key={auction.id}
                onClick={() => setSelectedAuctionId(auction.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between transition-colors ${selectedAuctionId === auction.id ? "bg-[#3B66D1]/10 border border-[#3B66D1]/30" : "hover:bg-slate-50 dark:hover:bg-[#232733] border border-transparent"}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded bg-slate-100 dark:bg-[#2D3342] flex items-center justify-center shrink-0 overflow-hidden">
                    {auction.imageUrl ? (
                      <img src={auction.imageUrl} alt={auction.itemName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs">📦</span>
                    )}
                  </div>
                  <span className={`text-sm truncate font-bold ${selectedAuctionId === auction.id ? "text-[#0b3d63] dark:text-[#5B86F1]" : "text-slate-700 dark:text-slate-300"}`}>
                    {auction.itemName}
                  </span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#2D3342] text-slate-500">
                  {auction.queueCount}
                </span>
              </button>
            ))}
            {filteredAuctions.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">ไม่พบไอเทม</div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content / Queue Table */}
      <div className="w-full lg:w-2/3">
        <div className="bg-white dark:bg-[#1A1D27] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] overflow-hidden flex flex-col h-[600px]">
          {selectedAuction ? (
            <>
              <div className="p-6 border-b border-slate-200 dark:border-[#2D3342] flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-[#2D3342] flex items-center justify-center shrink-0 overflow-hidden">
                  {selectedAuction.imageUrl ? (
                    <img src={selectedAuction.imageUrl} alt={selectedAuction.itemName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">📦</span>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">{selectedAuction.itemName}</h2>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#2D3342] text-slate-500">
                      {selectedAuction.category}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400">
                      คิวรอ: {selectedAuction.queueCount}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-0">
                {isLoading ? (
                  <div className="p-12 text-center text-slate-400">กำลังโหลด...</div>
                ) : !queue || queue.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center text-slate-400">
                    <PackageOpen size={48} className="mb-3 opacity-20" />
                    <p className="font-bold">ยังไม่มีคนจองคิวไอเทมชิ้นนี้</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-[#232733] sticky top-0 z-10 border-b border-slate-200 dark:border-[#2D3342]">
                      <tr>
                        <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">คิวที่</th>
                        <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">ชื่อตัวละคร</th>
                        <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">อาชีพ</th>
                        <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#2D3342]">
                      {queue.map((res, idx) => (
                        <tr key={res.id} className="hover:bg-slate-50 dark:hover:bg-[#232733]/50 transition-colors">
                          <td className="py-4 px-6 text-sm font-bold text-slate-700 dark:text-white">
                            #{idx + 1}
                          </td>
                          <td className="py-4 px-6 text-sm font-bold text-slate-700 dark:text-white flex items-center gap-2">
                            {res.characterName}
                            {res.userId === user?.discordId && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 px-1.5 py-0.5 rounded uppercase">You</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-sm text-slate-600 dark:text-[#8B93A7]">{res.job}</td>
                          <td className="py-4 px-6 text-sm text-right">
                            <span className="px-2 py-1 text-[10px] font-bold rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                              {res.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 p-8">
              <p>กรุณาเลือกไอเทมจากเมนูด้านซ้าย</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
