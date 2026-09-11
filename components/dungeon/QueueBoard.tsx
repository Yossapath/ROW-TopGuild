"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search, Trash2, GripVertical } from "lucide-react";
import { useState } from "react";
import { DungeonQueueItem, DungeonTeamResource } from "@/types";
import { JOB_COLORS } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";
import { Droppable, Draggable } from "@hello-pangea/dnd";

interface QueueBoardProps {
  queueItems: DungeonQueueItem[];
  teams?: DungeonTeamResource[];
  isLoading: boolean;
  onRefresh?: () => void;
  onAssign?: (teamId: string, queueItemId: string) => void;
}

export function QueueBoard({ queueItems, teams = [], isLoading, onRefresh, onAssign }: QueueBoardProps) {
  const [search, setSearch] = useState("");
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const queryClient = useQueryClient();

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "delete" | "skip" }) => {
      let res: Response;
      if (action === "delete") {
        res = await fetch(`/api/dungeon/queues/${id}`, { method: "DELETE" });
      } else {
        res = await fetch(`/api/dungeon/queues/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "skip" }),
        });
      }
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "ดำเนินการไม่สำเร็จ");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dungeon_data"] });
    },
    onError: (error: Error) => alert(error.message),
  });

  const editRoundsMutation = useMutation({
    mutationFn: async ({ id, rounds }: { id: string; rounds: 1 | 2 }) => {
      const res = await fetch(`/api/dungeon/queues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateRounds", rounds }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "แก้ไขจำนวนรอบไม่สำเร็จ");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dungeon_data"] });
    },
    onError: (error: Error) => alert(error.message),
  });

  const filteredItems = (queueItems || []).filter((q) => {
    return !search || q.name.toLowerCase().includes(search.toLowerCase());
  });

  // Split waiting (draggable) and assigned (locked)
  const assignedItems = filteredItems.filter((q) => q.status === "ASSIGNED");
  const waitingPriest = filteredItems.filter((q) => q.status === "WAITING" && q.job === "Priest");
  const waitingOthers = filteredItems.filter((q) => q.status === "WAITING" && q.job !== "Priest");

  // Available teams for quick assign buttons (not full)
  const availableTeams = teams.filter((t) => {
    const maxSlots = Math.max(0, 5 - (t.carriers?.length || 0));
    return t.activeMembers.length < maxSlots;
  });

  let globalIdx = 0;

  const renderGroup = (items: DungeonQueueItem[], title: string, titleColorCls: string, isDraggableGroup: boolean) => {
    if (items.length === 0) return null;
    const groupKey = `queue_group_${title.replace(/\W+/g, "")}`;
    return (
      <div className="mb-4 last:mb-0">
        <div className={`text-[11px] font-bold uppercase tracking-wider ${titleColorCls} mb-2 px-1`}>{title} · {items.length} คน</div>
        <Droppable droppableId={groupKey} isDropDisabled={true}>
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-1.5"
            >
              {items.map((q, localIdx) => {
                const currentIdx = ++globalIdx;
                const isOwner = user?.gameUsername === q.name;
                const canDrag = isAdmin && isDraggableGroup;
                const jc = JOB_COLORS[q.job] || "#888";

                const row = (
                  <div
                    className={`flex items-center h-11 px-3 gap-2.5 rounded-xl border transition-all ${
                      q.status === "ASSIGNED"
                        ? "bg-blue-50/60 dark:bg-blue-950/25 border-blue-200 dark:border-blue-800/50"
                        : "bg-white dark:bg-[#272C38] border-slate-200 dark:border-[#2D3342]"
                    } text-xs shadow-sm`}
                  >
                    {/* Drag handle / number */}
                    {canDrag ? (
                      <span className="text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing shrink-0">
                        <GripVertical size={14} />
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-slate-400 w-4 text-center shrink-0">{currentIdx}</span>
                    )}

                    {/* Name */}
                    <span className={`font-semibold flex-1 min-w-0 truncate text-sm ${isOwner ? "text-[#3B66D1] dark:text-[#82A0F5]" : "text-slate-800 dark:text-white"}`}>
                      {q.name}
                      {isOwner && <span className="ml-1 text-[9px] font-bold opacity-70">(คุณ)</span>}
                    </span>

                    {/* Job Badge */}
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: jc + "22", color: jc, border: `1px solid ${jc}44` }}
                    >
                      {q.job}
                    </span>

                    {/* Round Badge */}
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono shrink-0 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      รอบ {q.roundNumber}
                    </span>

                    {/* Status badge */}
                    {q.status === "ASSIGNED" ? (
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold shrink-0">
                        กำลังลง
                      </span>
                    ) : null}

                    {/* Admin Actions */}
                    {isAdmin && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Skip */}
                        {q.status === "WAITING" && (
                          <button
                            onClick={() => actionMutation.mutate({ id: q.bookingId, action: "skip" })}
                            disabled={actionMutation.isPending}
                            className="text-[10px] font-bold px-2 py-1 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 rounded-lg border border-amber-200 dark:border-amber-800 disabled:opacity-50 transition-colors"
                            title="ข้ามคิว"
                          >
                            ข้าม
                          </button>
                        )}

                        {/* Delete */}
                        {(isAdmin || isOwner) && (
                          <button
                            onClick={() => { if (!confirm("แน่ใจที่จะลบคิวนี้ใช่ไหม?")) return; actionMutation.mutate({ id: q.bookingId, action: "delete" }); }}
                            disabled={actionMutation.isPending}
                            className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors"
                            title="ลบคิว"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );

                return canDrag ? (
                  <Draggable key={q.id} draggableId={q.id} index={localIdx} isDragDisabled={false}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        style={{
                          ...dragProvided.draggableProps.style,
                          opacity: snapshot.isDragging ? 0.85 : 1,
                          boxShadow: snapshot.isDragging ? "0 4px 16px rgba(59,102,209,0.20)" : undefined,
                        }}
                      >
                        {row}
                      </div>
                    )}
                  </Draggable>
                ) : (
                  <div key={q.id}>{row}</div>
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
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#272C38] transition-colors text-slate-500 dark:text-[#8B93A7] hover:text-slate-800 dark:hover:text-white"
              title="รีเฟรช"
            >
              <RefreshCw size={15} />
            </button>
          )}
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
            {renderGroup(assignedItems.filter(q => q.job === "Priest"), "กำลังลง · Priest", "text-blue-700 dark:text-blue-400", false)}
            {renderGroup(assignedItems.filter(q => q.job !== "Priest"), "กำลังลง · อาชีพอื่นๆ", "text-blue-600 dark:text-[#82A0F5]", false)}
            {renderGroup(waitingPriest, "รอคิว · Priest (Priest)", "text-emerald-700 dark:text-emerald-400", true)}
            {renderGroup(waitingOthers, "รอคิว · อาชีพอื่นๆ", "text-slate-500 dark:text-[#8B93A7]", true)}
          </div>
        )}
      </div>
    </div>
  );
}
