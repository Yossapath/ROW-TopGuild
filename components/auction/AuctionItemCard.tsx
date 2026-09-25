"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/useAuthStore";
import { ChevronDown, ChevronUp, Check, X, Shield, Users, Clock, RefreshCw } from "lucide-react";
import { AuctionItem, AuctionReservation } from "@/types";

interface Props {
  auction: AuctionItem;
  isAdmin: boolean;
  myReservations: any[];
}

export function AuctionItemCard({ auction, isAdmin, myReservations }: Props) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);

  const myReservation = myReservations.find(r => r.auctionId === auction.id && r.status === "waiting");
  const isMyReservation = !!myReservation;

  const { data: queueRes, isLoading: loadingQueue } = useQuery({
    queryKey: ["auction-queue", auction.id],
    queryFn: async () => {
      const res = await fetch(`/api/auctions/${auction.id}/reserve`);
      if (!res.ok) throw new Error("Failed to load queue");
      return res.json() as Promise<{ data: AuctionReservation[] }>;
    },
    enabled: isExpanded,
  });

  const queue = queueRes?.data || [];

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!user?.gameUsername || !user?.class) throw new Error("Please complete your profile first");
      const res = await fetch(`/api/auctions/${auction.id}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterName: user.gameUsername, job: user.class }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to join");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auctions"] });
      queryClient.invalidateQueries({ queryKey: ["auction-queue", auction.id] });
      queryClient.invalidateQueries({ queryKey: ["my-reservations"] });
    },
    onError: (err: any) => alert(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      const res = await fetch(`/api/auctions/${auction.id}/reserve?reservationId=${reservationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to cancel");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auctions"] });
      queryClient.invalidateQueries({ queryKey: ["auction-queue", auction.id] });
      queryClient.invalidateQueries({ queryKey: ["my-reservations"] });
    },
    onError: (err: any) => alert(err.message),
  });

  const awardMutation = useMutation({
    mutationFn: async (resInfo: { resId: string, charName: string, userId: string }) => {
      if (!confirm(`ยืนยันการมอบไอเทมนี้ให้ ${resInfo.charName} หรือไม่?`)) throw new Error("Cancelled");
      const res = await fetch(`/api/auctions/${auction.id}/award?reservationId=${resInfo.resId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterName: resInfo.charName, userId: resInfo.userId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to award");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auctions"] });
      queryClient.invalidateQueries({ queryKey: ["auction-queue", auction.id] });
    },
    onError: (err: any) => {
      if (err.message !== "Cancelled") alert(err.message);
    },
  });

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_140px] gap-4 px-6 py-4 items-center bg-white dark:bg-[#232733] hover:bg-slate-50 dark:hover:bg-[#2A2F3E] transition-colors">
        
        {/* Item Info */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-[#2D3342] border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
            <span className="text-xl">📦</span>
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-800 dark:text-white truncate">{auction.itemName}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#2D3342] text-slate-500 dark:text-[#8B93A7]">
                {auction.category}
              </span>
              {isMyReservation && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400">
                  คุณจองคิวที่ {myReservation.queueNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="hidden sm:flex justify-center">
          {auction.status === "open" ? (
            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-transparent">
              OPEN
            </span>
          ) : auction.status === "closed" ? (
            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-transparent">
              CLOSED
            </span>
          ) : (
            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-transparent">
              AWARDED
            </span>
          )}
        </div>

        {/* Queue Count */}
        <div className="hidden sm:flex flex-col items-center">
          <div className="text-lg font-black text-slate-700 dark:text-white">{auction.queueCount}</div>
          <div className="text-[10px] font-bold text-slate-400 dark:text-[#8B93A7] uppercase">Players</div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 mt-2 sm:mt-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#2D3342] hover:bg-slate-200 dark:hover:bg-[#3B4358] text-slate-600 dark:text-slate-300 transition-colors"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {auction.status === "open" && !isMyReservation && (
            <button
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
              className="px-4 py-1.5 bg-[#0b3d63] dark:bg-[#3B66D1] text-white text-xs font-bold rounded-lg hover:bg-[#093250] dark:hover:bg-[#4D73CD] transition-colors disabled:opacity-50"
            >
              {joinMutation.isPending ? "..." : "Join Queue"}
            </button>
          )}

          {isMyReservation && (
            <button
              onClick={() => cancelMutation.mutate(myReservation.id)}
              disabled={cancelMutation.isPending}
              className="px-4 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors border border-red-200 dark:border-red-500/30 disabled:opacity-50"
            >
              {cancelMutation.isPending ? "..." : "Cancel"}
            </button>
          )}
          
          {isAdmin && (
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
              <button
                onClick={async () => {
                  const newStatus = auction.status === "open" ? "closed" : "open";
                  if (!confirm(`เปลี่ยนสถานะเป็น ${newStatus}?`)) return;
                  await fetch(`/api/auctions/${auction.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: newStatus }),
                  });
                  queryClient.invalidateQueries({ queryKey: ["auctions"] });
                }}
                className="px-2 py-1.5 text-[10px] font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {auction.status === "open" ? "ปิดรับ" : "เปิดรับ"}
              </button>
              <button
                onClick={async () => {
                  if (!confirm("ยืนยันการลบไอเทมนี้ทิ้ง? การกระทำนี้ไม่สามารถย้อนกลับได้")) return;
                  await fetch(`/api/auctions/${auction.id}`, { method: "DELETE" });
                  queryClient.invalidateQueries({ queryKey: ["auctions"] });
                }}
                className="px-2 py-1.5 text-[10px] font-bold rounded-md bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
              >
                ลบทิ้ง
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Queue View */}
      {isExpanded && (
        <div className="bg-slate-50 dark:bg-[#1A1D27] border-t border-slate-100 dark:border-[#2D3342] px-6 py-4">
          <h4 className="text-sm font-bold text-slate-700 dark:text-white mb-3 flex items-center gap-2">
            <Users size={14} /> คิวการจอง ({queue.length})
          </h4>
          
          {loadingQueue ? (
            <div className="flex justify-center py-4"><RefreshCw className="animate-spin text-slate-400" size={16} /></div>
          ) : queue.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400">ยังไม่มีคนจองคิวไอเทมนี้</div>
          ) : (
            <div className="flex flex-col gap-2">
              {queue.map((res, index) => (
                <div key={res.id} className="flex items-center justify-between bg-white dark:bg-[#232733] border border-slate-200 dark:border-[#2D3342] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-4">
                    <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-[#2D3342] flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-300">
                      #{index + 1}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-800 dark:text-white">
                        {res.characterName}
                        {user?.discordId === res.userId && <span className="ml-2 text-[10px] bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded">You</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-[#8B93A7]">{res.job}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-xs text-slate-400 flex items-center gap-1 hidden sm:flex">
                      <Clock size={12} />
                      {new Date(res.joinedAt).toLocaleTimeString('th-TH')}
                    </div>
                    
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => cancelMutation.mutate(res.id)}
                          className="px-2 py-1 text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 rounded hover:bg-red-100 dark:hover:bg-red-500/20"
                        >
                          เตะออก
                        </button>
                        {auction.status === "open" && index === 0 && (
                          <button 
                            onClick={() => awardMutation.mutate({ resId: res.id, charName: res.characterName, userId: res.userId })}
                            disabled={awardMutation.isPending}
                            className="px-2 py-1 text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-500/10 rounded hover:bg-green-100 dark:hover:bg-green-500/20 flex items-center gap-1"
                          >
                            <Check size={10} /> แจกของ
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
