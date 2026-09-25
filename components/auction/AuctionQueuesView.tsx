"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuctionItem, AuctionReservation } from "@/types";
import { Search, PackageOpen, Users, GripVertical, Check, Plus, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface Props {
  auctions: AuctionItem[];
}

export function AuctionQueuesView({ auctions }: Props) {
  const [selectedAuctionId, setSelectedAuctionId] = useState<string>(auctions[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const queryClient = useQueryClient();

  const [isAdding, setIsAdding] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");

  const selectedAuction = auctions.find(a => a.id === selectedAuctionId);

  const { data: queue, isLoading } = useQuery<AuctionReservation[]>({
    queryKey: ["auction_queue", selectedAuctionId],
    queryFn: async () => {
      if (!selectedAuctionId) return [];
      const res = await fetch(`/api/auctions/${selectedAuctionId}/reserve`);
      if (!res.ok) throw new Error("Failed to fetch queue");
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!selectedAuctionId,
  });

  const { data: rosterRes } = useQuery({
    queryKey: ["roster"],
    queryFn: async () => {
      const res = await fetch("/api/roster");
      return res.json();
    },
    enabled: isAdmin,
  });
  const roster = rosterRes?.data || [];

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await fetch(`/api/auctions/${selectedAuctionId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds })
      });
      if (!res.ok) throw new Error("Failed to reorder");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auction_queue", selectedAuctionId] });
    }
  });

  const addManualMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const member = roster.find((m: any) => m.discordId === memberId);
      if (!member) throw new Error("Member not found");
      const res = await fetch(`/api/auctions/${selectedAuctionId}/reserve-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: member.discordId,
          characterName: member.gameUsername,
          job: member.class || "Novice"
        })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auction_queue", selectedAuctionId] });
      queryClient.invalidateQueries({ queryKey: ["auctions"] });
      setIsAdding(false);
      setSelectedMember("");
    },
    onError: (err: any) => alert(err.message)
  });

  const cancelMutation = useMutation({
    mutationFn: async (resId: string) => {
      if (!confirm("Are you sure you want to remove this user from the queue?")) throw new Error("Cancelled");
      const res = await fetch(`/api/auctions/${selectedAuctionId}/reserve`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: resId })
      });
      if (!res.ok) throw new Error("Failed to remove");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auction_queue", selectedAuctionId] });
      queryClient.invalidateQueries({ queryKey: ["auctions"] });
    },
    onError: (err: any) => {
      if (err.message !== "Cancelled") alert(err.message);
    }
  });

  const filteredAuctions = auctions.filter(a => a.itemName.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !queue) return;
    
    const items = Array.from(queue);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Optimistically update UI
    queryClient.setQueryData(["auction_queue", selectedAuctionId], items);

    // Send new order to server
    reorderMutation.mutate(items.map(item => item.id));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar */}
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
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full lg:w-2/3">
        <div className="bg-white dark:bg-[#1A1D27] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] overflow-hidden flex flex-col h-[600px]">
          {selectedAuction ? (
            <>
              <div className="p-6 border-b border-slate-200 dark:border-[#2D3342] flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
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
                
                {isAdmin && (
                  <button 
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-xl font-bold text-sm hover:bg-sky-600 transition-colors shadow-sm"
                  >
                    <Plus size={16} />
                    เพิ่มคนเข้าคิว
                  </button>
                )}
              </div>

              {isAdmin && isAdding && (
                <div className="p-4 bg-sky-50 dark:bg-sky-500/10 border-b border-sky-100 dark:border-sky-500/20 flex gap-2 items-center">
                  <select 
                    value={selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-sky-200 dark:border-sky-500/30 bg-white dark:bg-[#1A1D27] text-sm"
                  >
                    <option value="">-- เลือกรายชื่อสมาชิก --</option>
                    {roster.map((r: any) => (
                      <option key={r.discordId} value={r.discordId}>
                        {r.gameUsername} ({r.class || "Novice"})
                      </option>
                    ))}
                  </select>
                  <button 
                    onClick={() => addManualMutation.mutate(selectedMember)}
                    disabled={!selectedMember || addManualMutation.isPending}
                    className="px-4 py-2 bg-[#0b3d63] dark:bg-[#3B66D1] text-white rounded-lg font-bold text-sm hover:bg-[#093250] dark:hover:bg-[#4D73CD] disabled:opacity-50"
                  >
                    {addManualMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : "เพิ่มเข้าคิว"}
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-0">
                {isLoading ? (
                  <div className="p-12 text-center text-slate-400">กำลังโหลด...</div>
                ) : !queue || queue.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center text-slate-400">
                    <PackageOpen size={48} className="mb-3 opacity-20" />
                    <p className="font-bold">ยังไม่มีคนจองคิวไอเทมชิ้นนี้</p>
                  </div>
                ) : (
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 dark:bg-[#232733] sticky top-0 z-10 border-b border-slate-200 dark:border-[#2D3342]">
                        <tr>
                          {isAdmin && <th className="w-10"></th>}
                          <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">คิวที่</th>
                          <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">ชื่อตัวละคร</th>
                          <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">อาชีพ</th>
                          <th className="py-3 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">จัดการ</th>
                        </tr>
                      </thead>
                      
                      <Droppable droppableId="queue-list" isDropDisabled={!isAdmin}>
                        {(provided) => (
                          <tbody 
                            className="divide-y divide-slate-100 dark:divide-[#2D3342]"
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                          >
                            {queue.map((res, idx) => (
                              <Draggable key={res.id} draggableId={res.id} index={idx} isDragDisabled={!isAdmin}>
                                {(provided, snapshot) => (
                                  <tr 
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    style={provided.draggableProps.style}
                                    className={`transition-colors ${snapshot.isDragging ? "bg-white dark:bg-[#2A2F3E] shadow-lg border border-sky-500" : "hover:bg-slate-50 dark:hover:bg-[#232733]/50"}`}
                                  >
                                    {isAdmin && (
                                      <td className="pl-4 py-4 w-10">
                                        <div {...provided.dragHandleProps} className="text-slate-400 hover:text-slate-600 cursor-grab">
                                          <GripVertical size={16} />
                                        </div>
                                      </td>
                                    )}
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
                                      {isAdmin ? (
                                        <button 
                                          onClick={() => cancelMutation.mutate(res.id)}
                                          className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded"
                                        >
                                          ลบทิ้ง
                                        </button>
                                      ) : (
                                        <span className="px-2 py-1 text-[10px] font-bold rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                                          {res.status}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </tbody>
                        )}
                      </Droppable>
                    </table>
                  </DragDropContext>
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
