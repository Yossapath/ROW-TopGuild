"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, RefreshCw } from "lucide-react";
import { AuctionCategory } from "@/types";

interface Props {
  onClose: () => void;
}

export function AddAuctionModal({ onClose }: Props) {
  const queryClient = useQueryClient();
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState<AuctionCategory>("gear");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auctions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName, category }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auctions"] });
      onClose();
    },
    onError: (err: any) => alert(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-[#2D3342]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#2D3342]">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">เพิ่มไอเทมประมูล</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
              ชื่อไอเทม
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Royal - Bradium Brooch I"
              className="w-full px-4 py-2 bg-slate-50 dark:bg-[#232733] border border-slate-200 dark:border-[#2D3342] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3B66D1] text-slate-800 dark:text-white"
              autoFocus
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
              หมวดหมู่
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AuctionCategory)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-[#232733] border border-slate-200 dark:border-[#2D3342] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3B66D1] text-slate-800 dark:text-white appearance-none"
            >
              <option value="gear">Gear (อุปกรณ์)</option>
              <option value="card">Card (การ์ด)</option>
              <option value="pet">Pet (สัตว์เลี้ยง)</option>
              <option value="relic">Relic (เรลิค)</option>
            </select>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-100 dark:bg-[#2D3342] text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-[#3B4358] transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !itemName.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#0b3d63] dark:bg-[#3B66D1] text-white font-bold rounded-xl hover:bg-[#093250] dark:hover:bg-[#4D73CD] transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? <RefreshCw className="animate-spin" size={16} /> : null}
              บันทึกไอเทม
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
