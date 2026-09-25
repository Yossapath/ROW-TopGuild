"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/useAuthStore";
import { Gavel, RefreshCw, PackageOpen, LayoutGrid, Sword, Layers, Plus } from "lucide-react";
import { AuctionItem, AuctionCategory } from "@/types";
import { AuctionItemCard } from "@/components/auction/AuctionItemCard";
import { AddAuctionModal } from "@/components/auction/AddAuctionModal";
import { AuctionQueuesView } from "@/components/auction/AuctionQueuesView";

const CATEGORIES: { id: AuctionCategory | "all" | "my"; label: string; icon: any }[] = [
  { id: "all", label: "ทั้งหมด", icon: LayoutGrid },
  { id: "gear", label: "Gear", icon: Sword },
  { id: "card", label: "Card", icon: Layers },
  { id: "pet", label: "Pet", icon: PackageOpen },
  { id: "relic", label: "Relic", icon: Gavel },
  { id: "my", label: "รายการจอง", icon: Gavel }, // Special tab
];

export default function AuctionPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  
  const [activeTab, setActiveTab] = useState<AuctionCategory | "all" | "my">("all");
  const [viewMode, setViewMode] = useState<"reserve" | "queues">("reserve");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Fetch all auctions
  const { data: auctionsRes, isLoading: loadingAuctions, refetch } = useQuery({
    queryKey: ["auctions"],
    queryFn: async () => {
      const res = await fetch("/api/auctions");
      if (!res.ok) throw new Error("Failed to load auctions");
      return res.json() as Promise<{ data: AuctionItem[] }>;
    },
  });

  // Fetch my reservations
  const { data: myRes, isLoading: loadingMy } = useQuery({
    queryKey: ["my-reservations"],
    queryFn: async () => {
      const res = await fetch("/api/auctions/my");
      if (!res.ok) throw new Error("Failed to load my reservations");
      return res.json() as Promise<{ data: any[] }>;
    },
    enabled: activeTab === "my" && !!user,
  });

  const auctions = auctionsRes?.data || [];
  const myReservations = myRes?.data || [];

  // Filter logic
  let displayedAuctions = auctions;
  if (activeTab === "my") {
    const myAuctionIds = myReservations.map(r => r.auctionId);
    displayedAuctions = auctions.filter(a => myAuctionIds.includes(a.id));
  } else if (activeTab !== "all") {
    displayedAuctions = auctions.filter(a => a.category === activeTab);
  }

  const isLoading = loadingAuctions || (activeTab === "my" && loadingMy);

  return (
    <div className="w-full max-w-[1400px] mx-auto pb-20 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            <Gavel className="text-sky-500" />
            �ͧ��ǻ�����
          </h1>
          <p className="text-sm text-slate-500 dark:text-[#8B93A7] mt-1">
            ระบบจองคิวไอเทมประมูลของ Guild ({auctions.length} ไอเทมทั้งหมด)
          </p>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-[#272C38] text-slate-700 dark:text-white rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-[#2A2F3E] transition-colors"
          >
            <RefreshCw size={14} />
            รีเฟรช
          </button>
          
          {isAdmin && auctions.length === 0 && (
              <button
                onClick={async () => {
                  if (!confirm('Are you sure you want to seed 32 default items?')) return;
                  const res = await fetch('/api/auctions/seed');
                  if (res.ok) {
                    alert('Success! Please wait 1-2 seconds and click Refresh.');
                    refetch();
                  } else {
                    alert('Error');
                  }
                }}
                className='flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-colors shadow-sm'
              >
                ?? Seed Default Items
              </button>
            )}
            {isAdmin && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#0b3d63] dark:bg-[#3B66D1] text-white rounded-xl font-bold text-sm hover:bg-[#093250] dark:hover:bg-[#4D73CD] transition-colors shadow-sm"
            >
              <Plus size={16} />
              เพิ่มไอเทม
            </button>
          )}
        </div>
      </div>

      <div className="flex bg-slate-100 dark:bg-[#272C38] p-1 rounded-xl w-full sm:w-fit mb-6">
        <button 
          onClick={() => setViewMode("reserve")}
          className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === "reserve" ? "bg-white dark:bg-[#3B66D1] text-[#0b3d63] dark:text-white shadow-sm" : "text-slate-500 dark:text-[#8B93A7] hover:text-slate-700 dark:hover:text-slate-300"}`}
        >
          🛒 จองคิว
        </button>
        <button 
          onClick={() => setViewMode("queues")}
          className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === "queues" ? "bg-white dark:bg-[#3B66D1] text-[#0b3d63] dark:text-white shadow-sm" : "text-slate-500 dark:text-[#8B93A7] hover:text-slate-700 dark:hover:text-slate-300"}`}
        >
          📋 ดูคิว
        </button>
      </div>

      {viewMode === "reserve" && (<>
      <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-6 pb-1">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all flex-shrink-0 ${
                activeTab === cat.id
                  ? "bg-[#0b3d63] dark:bg-[#3B66D1] text-white shadow-md"
                  : "bg-white dark:bg-[#232733] text-slate-600 dark:text-[#8B93A7] hover:bg-slate-50 dark:hover:bg-[#2A2F3E] border border-slate-200 dark:border-[#2D3342]"
              }`}
            >
              <Icon size={16} />
              {cat.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-[#232733] rounded-2xl border border-slate-200 dark:border-[#2D3342] overflow-hidden shadow-sm">
        {/* Table Header */}
        <div className="hidden sm:grid grid-cols-[1fr_120px_120px_140px] gap-4 px-6 py-4 bg-slate-50 dark:bg-[#272C38]/60 border-b border-slate-200 dark:border-[#2D3342] text-xs font-bold text-slate-500 dark:text-[#8B93A7] uppercase tracking-wider">
          <div>ไอเทมประมูล</div>
          <div className="text-center">สถานะ</div>
          <div className="text-center">คิวรอ</div>
          <div className="text-right">จัดการ</div>
        </div>

        {/* List */}
        <div className="divide-y divide-slate-100 dark:divide-[#2D3342]">
          {isLoading ? (
            <div className="p-8 flex justify-center text-slate-400">
              <RefreshCw className="animate-spin" size={24} />
            </div>
          ) : displayedAuctions.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center text-slate-500 dark:text-[#8B93A7]">
              <PackageOpen size={48} className="mb-3 opacity-20" />
              <p className="font-bold text-lg">ไม่มีไอเทมประมูล</p>
              <p className="text-sm opacity-80 mt-1">ยังไม่มีไอเทมในหมวดหมู่นี้ หรือคุณยังไม่ได้จองไอเทมใดๆ</p>
            </div>
          ) : (
            displayedAuctions.map(auction => (
              <AuctionItemCard 
                key={auction.id} 
                auction={auction} 
                isAdmin={isAdmin}
                myReservations={myReservations}
              />
            ))
          )}
        </div>
      </div>
      </>)}

      {viewMode === "queues" && (
        <AuctionQueuesView auctions={auctions} />
      )}

      {isAddModalOpen && (
        <AddAuctionModal onClose={() => setIsAddModalOpen(false)} />
      )}
    </div>
  );
}
