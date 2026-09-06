"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search, Trash2, ArrowDownToLine } from "lucide-react";
import { useState, useEffect } from "react";
import { DungeonQueueItem } from "@/types";
import { JOB_COLORS } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";
import type { QueueEstimate } from "@/lib/dungeon-estimator";

import { Droppable, Draggable } from "@hello-pangea/dnd";

export function QueueBoard({ userEstimate }: { userEstimate?: QueueEstimate | null }) {
  const [search, setSearch] = useState("");
  const [editingQueueId, setEditingQueueId] = useState<{ id: string; rounds: 1|2 } | null>(null);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const queryClient = useQueryClient();

  const { data: queueItems, isLoading, refetch } = useQuery<DungeonQueueItem[]>({
    queryKey: ["dungeon_queue_items"],
    queryFn: async () => {
      const res = await fetch("/api/dungeon/queue-items");
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 5000,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "delete" | "skip" }) => {
      if (action === "delete") {
        await fetch(`/api/dungeon/queues/${id}`, { method: "DELETE" });
      } else if (action === "skip") {
        await fetch(`/api/dungeon/queues/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "skip" })
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dungeon_queue_items"] });
      queryClient.invalidateQueries({ queryKey: ["dungeon_teams"] });
    }
  });

  const editRoundsMutation = useMutation({
    mutationFn: async ({ id, rounds }: { id: string; rounds: 1 | 2 }) => {
      const res = await fetch(`/api/dungeon/queues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateRounds", rounds })
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dungeon_queue_items"] });
    }
  });

  const filteredItems = (queueItems || []).filter((q) => {
    return !search || q.name.toLowerCase().includes(search.toLowerCase());
  });

  // Group items
  const activeItems = filteredItems.filter(q => q.status === "ASSIGNED");
  const waitingR1Priest = filteredItems.filter(q => q.status === "WAITING" && q.roundNumber === 1 && q.job === "Priest");
  const waitingR1Others = filteredItems.filter(q => q.status === "WAITING" && q.roundNumber === 1 && q.job !== "Priest");
  const waitingR2Priest = filteredItems.filter(q => q.status === "WAITING" && q.roundNumber === 2 && q.job === "Priest");
  const waitingR2Others = filteredItems.filter(q => q.status === "WAITING" && q.roundNumber === 2 && q.job !== "Priest");
  
  let globalIdx = 1;

  const renderGroup = (items: DungeonQueueItem[], title: string, titleColorCls: string) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4 last:mb-0">
        <div className={`text-xs font-bold ${titleColorCls} mb-2 px-1`}>{title} ({items.length})</div>
        <Droppable droppableId={`queue_group_${title.replace(/\s+/g, '')}`} isDropDisabled={true}>
          {(provided) => (
            <div className="space-y-2" ref={provided.innerRef} {...provided.droppableProps}>
              {items.map((q) => {
                const currentIdx = globalIdx++;
                const isOwner = user?.gameUsername === q.name;
                const isDraggable = isAdmin && q.status === "WAITING";
                
                const hasR2 = filteredItems.some(i => i.bookingId === q.bookingId && i.roundNumber === 2);
                
                const card = (
                  <QueueItemCard 
                    key={q.id} 
                    q={q} 
                    idx={currentIdx} 
                    isAdmin={isAdmin}
                    isOwner={isOwner}
                    totalRounds={hasR2 ? 2 : 1}
                    onAction={(action) => {
                      if (action === 'delete' && !confirm('แน่ใจที่จะลบคิวนี้ใช่ไหม?')) return;
                      actionMutation.mutate({ id: q.bookingId, action });
                    }}
                    onEditRounds={() => {
                      const hasR2 = filteredItems.some(i => i.bookingId === q.bookingId && i.roundNumber === 2);
                      setEditingQueueId({ id: q.bookingId, rounds: hasR2 ? 2 : 1 });
                    }}
                    isLoading={actionMutation.isPending || editRoundsMutation.isPending}
                  />
                );

                if (!isDraggable) return card;

                return (
                  <Draggable key={q.id} draggableId={q.id} index={currentIdx}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={{
                          ...provided.draggableProps.style,
                          opacity: snapshot.isDragging ? 0.8 : 1,
                        }}
                      >
                        {card}
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    );
  };

  return (
    <div className="flex-1 min-w-0">
      {/* User Estimate Banner */}
      {userEstimate && userEstimate.status !== 'done' && userEstimate.status !== 'skipped' && (
        <div className="mb-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                สถานะคิวของคุณ ({userEstimate.name})
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {userEstimate.status === 'active' 
                  ? "กำลังลงดันเจี้ยน" 
                  : userEstimate.queuesAhead === 0
                    ? "คิวต่อไป (พร้อมลงทันทีเมื่อทีมว่าง)"
                    : `เหลืออีก ${userEstimate.queuesAhead} คิว ก่อนถึงคิวคุณ`}
              </p>
            </div>
            <div className="bg-white dark:bg-[#232733] px-4 py-2 rounded-lg shadow-sm border border-blue-100 dark:border-blue-800 text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">เวลาโดยประมาณ</div>
              <div className="font-mono font-bold text-blue-700 dark:text-blue-400">
                {userEstimate.status === 'active' ? "Now" : userEstimate.estimatedStartTimeText}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-700 dark:text-white">รายชื่อคิว (รายรอบ)</span>
          <span className="bg-[#0b3d63] dark:bg-[#3B66D1] text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {filteredItems.length} คิว
          </span>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#8B93A7]" />
            <input
              type="text"
              placeholder="ค้นหาชื่อตัวละคร..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-[#2D3342] rounded-lg text-xs bg-white dark:bg-[#272C38] text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-[#8B93A7] focus:outline-none focus:ring-2 focus:ring-[#4D73CD]"
            />
          </div>
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#272C38] transition-colors text-slate-500 dark:text-[#8B93A7] hover:text-slate-800 dark:hover:text-white"
            title="รีเฟรช"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-[#232733] rounded-2xl border border-slate-200 dark:border-[#2D3342] p-4">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400"><RefreshCw className="animate-spin mx-auto mb-2" />กำลังโหลด...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-slate-400">ไม่พบคิว</div>
        ) : (
          <div>
            {renderGroup(activeItems, "กำลังลง (Active)", "text-blue-600 dark:text-[#82A0F5]")}
            {renderGroup(waitingR1Priest, "พระ (Priest) - รอคิวรอบ 1", "text-blue-700 dark:text-white")}
            {renderGroup(waitingR1Others, "อาชีพอื่นๆ - รอคิวรอบ 1", "text-slate-500 dark:text-[#8B93A7]")}
            {renderGroup(waitingR2Priest, "พระ (Priest) - รอคิวรอบ 2", "text-purple-700 dark:text-purple-400")}
            {renderGroup(waitingR2Others, "อาชีพอื่นๆ - รอคิวรอบ 2", "text-purple-700 dark:text-purple-400")}
          </div>
        )}
      </div>

      {editingQueueId && (
        <EditRoundsModal
          isOpen={!!editingQueueId}
          currentRounds={editingQueueId.rounds}
          onClose={() => setEditingQueueId(null)}
          onConfirm={(newRounds) => {
            if (newRounds !== editingQueueId.rounds) {
               editRoundsMutation.mutate({ id: editingQueueId.id, rounds: newRounds });
            }
            setEditingQueueId(null);
          }}
        />
      )}
    </div>
  );
}

function EditRoundsModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  currentRounds 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: (rounds: 1|2) => void; 
  currentRounds: 1|2; 
}) {
  // Use state to track the selection before confirming
  const [selected, setSelected] = useState<1|2>(currentRounds);

  // Sync state if currentRounds changes while open
  useEffect(() => {
    setSelected(currentRounds);
  }, [currentRounds]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-[#232733] rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-[#2D3342]">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2D3342]">
          <h3 className="font-bold text-lg text-slate-800 dark:text-white">แก้ไขจำนวนรอบ</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">เลือกรอบที่ต้องการแล้วกดยืนยัน</p>
        </div>
        <div className="p-5 flex gap-3">
          <button
            onClick={() => setSelected(1)}
            className={`flex-1 py-2.5 rounded-lg border-2 font-bold transition-all ${selected === 1 ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' : 'border-slate-200 dark:border-[#2D3342] text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500'}`}
          >
            1 รอบ
          </button>
          <button
            onClick={() => setSelected(2)}
            className={`flex-1 py-2.5 rounded-lg border-2 font-bold transition-all ${selected === 2 ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' : 'border-slate-200 dark:border-[#2D3342] text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500'}`}
          >
            2 รอบ
          </button>
        </div>
        <div className="px-5 py-3 bg-slate-50 dark:bg-[#1E212B] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#2D3342] rounded-lg transition-colors">
            ยกเลิก
          </button>
          <button onClick={() => onConfirm(selected)} className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}

function QueueItemCard({ q, idx, isAdmin, isOwner, totalRounds, onAction, onEditRounds, isLoading }: { 
  q: DungeonQueueItem; 
  idx: number; 
  isAdmin: boolean;
  isOwner: boolean;
  totalRounds: 1 | 2;
  onAction: (action: "delete" | "skip") => void;
  onEditRounds: () => void;
  isLoading: boolean;
}) {
  const jobColor = JOB_COLORS[q.job] ?? "#888";
  const isAssigned = q.status === "ASSIGNED";

  return (
    <div className={`rounded-xl p-3.5 flex items-center justify-between gap-3 border transition-colors ${
      isAssigned
      ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-300/70 dark:border-blue-700/50 shadow-sm"
      : "bg-slate-50 dark:bg-[#272C38] border-slate-200 dark:border-[#2D3342]"
    }`}>
      <span className="font-mono text-xs font-bold text-slate-400 w-6 text-center">{idx}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400">name:</span>
          <span className="font-bold text-slate-800 dark:text-white">{q.name}</span>
          <span className="text-slate-300 mx-1">|</span>
          <span className="text-xs text-slate-400">class:</span>
          <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: jobColor + "44", color: jobColor, border: `1px solid ${jobColor}66` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: jobColor }} />
            {q.job}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.roundNumber === 1 ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" : "bg-purple-200 text-purple-700 dark:bg-purple-900 dark:text-purple-300"}`}>
            {totalRounds === 2 ? `รอบ ${q.roundNumber}/2` : `รอบ ${q.roundNumber}`}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isAssigned ? (
          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">กำลังลง (ทีม {q.assignedTeamId?.replace('team-', '')})</span>
        ) : (
          <span className="bg-slate-100 text-slate-600 dark:bg-[#2D3342] dark:text-[#8B93A7] text-xs font-bold px-2 py-1 rounded">รอคิว</span>
        )}
        
        {isAdmin && (
          <div className="flex items-center gap-1">
            {!isAssigned && (
                <button 
                  onClick={() => onAction("skip")} 
                  disabled={isLoading}
                  className="px-2 py-1 text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 rounded transition" 
                  title="ดันรายชื่อไปต่อท้ายสุด (ข้ามคิว)"
                >
                  ข้าม
                </button>
            )}
          </div>
        )}
        
        {(isAdmin || isOwner) && (
          <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-2">
            {!isAssigned && (
               <button 
                 onClick={() => onEditRounds()} 
                 disabled={isLoading}
                 className="px-2 py-1 text-xs font-bold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 rounded transition" 
                 title="แก้ไขจำนวนรอบ"
               >
                 แก้ไขรอบ
               </button>
            )}
            <button 
              onClick={() => onAction("delete")} 
              disabled={isLoading}
              className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition" 
              title="ลบคิว"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
