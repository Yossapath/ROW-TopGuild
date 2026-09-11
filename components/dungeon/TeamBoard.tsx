"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, RefreshCw, Users, Shield, Plus, X } from "lucide-react";
import { DungeonTeamResource } from "@/types";
import { JOB_COLORS } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";
import { useState } from "react";
import { Droppable } from "@hello-pangea/dnd";

interface TeamBoardProps {
  teams: DungeonTeamResource[];
  isLoading: boolean;
  rosterMembers: { name: string; job: string }[];
}

export function TeamBoard({ teams, isLoading, rosterMembers }: TeamBoardProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const actionMutation = useMutation({
    mutationFn: async ({ teamId, action, payload }: { teamId: string; action: string; payload?: any }) => {
      const res = await fetch(`/api/dungeon/teams/${teamId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || "เกิดข้อผิดพลาด");
      }
      return json;
    },
    onSuccess: (data, variables) => {
      if (variables.action === "assign") {
        if (data.assignedCount === 0) {
          alert(data.reason || data.message || "ไม่สามารถจัดทีมอัตโนมัติได้: ไม่มีผู้เล่นอาชีพ Priest ในคิว หรือทีมเต็มแล้ว");
        }
      }
      // Invalidate the unified dungeon data query so the parent re-fetches
      queryClient.invalidateQueries({ queryKey: ["dungeon_data"] });
    },
    onError: (err: any) => {
      alert(err.message);
    },
  });

  if (isLoading) return <div className="text-center py-4"><RefreshCw className="animate-spin inline mr-2" /> โหลดข้อมูลทีม...</div>;
  if (!teams || teams.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {teams.map((team, idx) => (
        <TeamCard
          key={team.id}
          team={team}
          index={idx + 1}
          isAdmin={isAdmin}
          rosterMembers={rosterMembers}
          onAction={(action, payload) => actionMutation.mutate({ teamId: team.id, action, payload })}
          isLoading={actionMutation.isPending}
        />
      ))}
    </div>
  );
}

function TeamCard({ team, index, isAdmin, rosterMembers, onAction, isLoading }: {
  team: DungeonTeamResource;
  index: number;
  isAdmin: boolean;
  rosterMembers: { name: string; job: string }[];
  onAction: (action: string, payload?: any) => void;
  isLoading: boolean;
}) {
  const [newCarrier, setNewCarrier] = useState("");
  const carrierCount = team.carriers?.length || 0;
  const maxQueueSlots = Math.max(0, 5 - carrierCount);
  const activeCount = team.activeMembers?.length || 0;
  const hasCarrierPriest = (team.carriers || []).some((c) => rosterMembers.find((m) => m.name === c)?.job === "Priest");
  const hasActivePriest = (team.activeMembers || []).some((m) => m.job === "Priest");
  const needsPriest = !hasCarrierPriest && !hasActivePriest;

  const handleAddCarrier = () => {
    if (!newCarrier.trim()) return;
    const updatedCarriers = [...(team.carriers || []), newCarrier.trim()];
    onAction("update-carriers", { carriers: updatedCarriers });
    setNewCarrier("");
  };

  const handleRemoveCarrier = (idx: number) => {
    const updatedCarriers = (team.carriers || []).filter((_, i) => i !== idx);
    onAction("update-carriers", { carriers: updatedCarriers });
  };

  return (
    <div className="bg-white dark:bg-[#232733] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#3B66D1]" />
          <h2 className="font-bold text-base text-slate-800 dark:text-white">Carry Team {index}</h2>
        </div>
        {activeCount > 0 ? (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
            กำลังลง {activeCount}/{maxQueueSlots} คน
          </span>
        ) : (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            ว่าง — รับได้ {maxQueueSlots} คน
          </span>
        )}
      </div>

      {/* Carriers */}
      <div>
        <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
          คนแบก (Carriers) · {carrierCount}/5
        </div>
        <div className="space-y-1">
          {(!team.carriers || team.carriers.length === 0) ? (
            <div className="text-xs text-slate-400 italic py-1">ยังไม่มีคนแบก</div>
          ) : (
            team.carriers.map((c, i) => {
              const job = rosterMembers.find((m) => m.name === c)?.job || "Unknown";
              return (
                <div key={i} className="flex justify-between items-center text-xs bg-slate-50 dark:bg-[#1E212B] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: JOB_COLORS[job] || "#888" }} />
                    {c}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{job}</span>
                    {isAdmin && (
                      <button onClick={() => handleRemoveCarrier(i)} className="text-red-400 hover:text-red-600 p-0.5 rounded" title="ลบคนแบก">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {isAdmin && carrierCount < 5 && (
          <div className="flex gap-1 mt-1.5 relative">
            <div className="flex-1 relative">
              <input
                type="text"
                value={newCarrier}
                onChange={(e) => setNewCarrier(e.target.value)}
                onFocus={() => { document.getElementById(`cd-${index}`)?.style.setProperty("display","block"); }}
                onBlur={() => { setTimeout(() => document.getElementById(`cd-${index}`)?.style.setProperty("display","none"), 200); }}
                placeholder="พิมพ์ชื่อคนแบก..."
                className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E212B] focus:outline-none focus:ring-1 focus:ring-[#3B66D1]"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddCarrier(); }}
              />
              <div id={`cd-${index}`} className="hidden absolute z-50 w-full mt-0.5 bg-white dark:bg-[#272C38] border border-slate-200 dark:border-[#2D3342] rounded-lg shadow-lg max-h-36 overflow-auto">
                {rosterMembers.filter(m => newCarrier === "" || m.name.toLowerCase().includes(newCarrier.toLowerCase())).filter(m => !(team.carriers || []).includes(m.name)).map(m => (
                  <div key={m.name} className="px-3 py-1 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-[#323847] flex justify-between items-center" onClick={() => setNewCarrier(m.name)}>
                    <span className="font-medium">{m.name}</span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: JOB_COLORS[m.job] || "#888" }} />{m.job}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleAddCarrier} disabled={isLoading || !newCarrier.trim()} className="px-2 py-1 bg-[#3B66D1] text-white rounded-lg text-xs hover:bg-blue-600 disabled:opacity-50">
              <Plus size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Queue Slots — Google Sheets style */}
      <div>
        <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
          ผู้เล่นในรอบ (Queue Slots) · {activeCount}/{maxQueueSlots}
        </div>
        <Droppable droppableId={`team_${team.id}`}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`rounded-xl border overflow-hidden transition-all ${
                snapshot.isDraggingOver
                  ? "border-2 border-dashed border-blue-500 bg-blue-50/50 dark:bg-blue-950/30"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              {maxQueueSlots === 0 ? (
                <div className="text-xs text-slate-400 italic p-3 text-center bg-slate-50 dark:bg-[#1E212B]">ทีมมีคนแบกเต็ม 5 คน</div>
              ) : (
                Array.from({ length: maxQueueSlots }).map((_, slotIdx) => {
                  const m = team.activeMembers[slotIdx];
                  if (m) {
                    const jc = JOB_COLORS[m.job] || "#888";
                    return (
                      <div key={m.queueItemId} className="flex items-center h-8 px-2 border-b last:border-b-0 border-slate-100 dark:border-slate-800/60 bg-white dark:bg-[#232733] gap-2">
                        <span className="font-mono text-[10px] text-slate-400 w-4 text-center shrink-0">{slotIdx + 1}</span>
                        <span className="font-semibold text-xs text-slate-800 dark:text-white flex-1 min-w-0 truncate">{m.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: jc + "22", color: jc, border: `1px solid ${jc}44` }}>{m.job}</span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">R{m.roundNumber}</span>
                        {isAdmin && (
                          <button onClick={() => onAction("eject", { queueItemId: m.queueItemId, name: m.name })} className="text-red-400 hover:text-red-600 p-0.5 rounded shrink-0" title="เตะออก">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    );
                  }
                  const isReservedForPriest = needsPriest && slotIdx === maxQueueSlots - 1;
                  return (
                    <div key={`empty_${slotIdx}`} className="flex items-center h-8 px-2 border-b last:border-b-0 border-slate-100 dark:border-slate-800/40 text-[10px] text-slate-300 dark:text-slate-600 gap-2">
                      <span className="font-mono w-4 text-center shrink-0">{slotIdx + 1}</span>
                      <span className={`italic ${isReservedForPriest ? "text-emerald-500/80 font-medium" : ""}`}>
                        {snapshot.isDraggingOver
                          ? "วางที่นี่..."
                          : isReservedForPriest
                            ? "— ช่องว่าง (เว้นไว้สำหรับ Priest) —"
                            : "— ช่องว่าง —"}
                      </span>
                    </div>
                  );
                })
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>

      {/* Action Buttons */}
      {isAdmin && (
        <div className="flex flex-col gap-2 pt-1 border-t border-slate-100 dark:border-[#2D3342]">
          {activeCount > 0 && (
            <button
              onClick={() => onAction("complete")}
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <CheckCircle size={18} />
              ลงเสร็จสิ้น — จบรอบดันนี้
            </button>
          )}
          {activeCount < maxQueueSlots && (
            <button
              onClick={() => onAction("assign")}
              disabled={isLoading}
              className={`w-full flex items-center justify-center gap-2 font-bold rounded-xl transition-all disabled:opacity-50 ${
                activeCount === 0
                  ? "py-2.5 text-sm bg-[#3B66D1] hover:bg-[#4D73CD] text-white shadow-md shadow-[#3B66D1]/20"
                  : "py-2 text-xs bg-blue-50 dark:bg-[#272C38] text-[#3B66D1] dark:text-[#82A0F5] border border-blue-200 dark:border-slate-700 hover:bg-blue-100 dark:hover:bg-[#2A2F3E]"
              }`}
            >
              <Users size={activeCount === 0 ? 17 : 14} />
              {activeCount === 0 ? "จัดทีมอัตโนมัติ (Auto-Assign)" : "เติมสมาชิกเพิ่ม"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
