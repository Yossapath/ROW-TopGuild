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
    onSuccess: () => {
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

  const getStatusColor = () => {
    return "bg-white text-slate-800 dark:bg-[#232733] dark:text-white border-slate-200 dark:border-[#2D3342]";
  };

  const getStatusLabel = () => {
    if (team.activeMembers.length > 0) return "กำลังลง";
    return "ว่าง / รอผู้เล่น";
  };

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
    <div className={`bg-white dark:bg-[#232733] rounded-2xl shadow-sm border p-4 ${getStatusColor()}`}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 opacity-70" />
          <h2 className="font-bold text-lg">Carry Team {index}</h2>
        </div>
        <div className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/50 dark:bg-black/20">
          {getStatusLabel()}
        </div>
      </div>

      {/* Carriers Section */}
      <div className="flex flex-col gap-1.5 mb-4 px-1">
        <div className="text-xs font-bold mb-1 opacity-70">คนแบก (Carriers)</div>
        {(!team.carriers || team.carriers.length === 0) ? (
          <div className="text-sm opacity-60 italic py-1">ยังไม่มีคนแบก...</div>
        ) : (
          team.carriers.map((c, i) => {
            const rosterMember = rosterMembers.find((m) => m.name === c);
            const job = rosterMember?.job || "Unknown";
            return (
              <div key={i} className="flex justify-between items-center text-sm bg-white/60 dark:bg-black/20 px-2 py-1.5 rounded border border-slate-200/50 dark:border-slate-700/50">
                <span className="font-bold flex items-center">
                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: JOB_COLORS[job] || "#888" }} />
                  {c}
                </span>
                <div className="flex items-center gap-2">
                  <span className="opacity-70 text-xs font-medium bg-black/10 px-1.5 py-0.5 rounded">{job}</span>
                  {isAdmin && (
                    <button
                      onClick={() => handleRemoveCarrier(i)}
                      className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 p-0.5 rounded transition-all"
                      title="ลบคนแบกออก"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        {isAdmin && (
          <div className="flex gap-1 relative mt-1">
            <div className="flex-1 relative">
              <input
                type="text"
                value={newCarrier}
                onChange={(e) => setNewCarrier(e.target.value)}
                onFocus={() => {
                  const dropdownState = document.getElementById(`carrier-dropdown-${index}`);
                  if (dropdownState) dropdownState.style.display = "block";
                }}
                onBlur={() => {
                  setTimeout(() => {
                    const dropdownState = document.getElementById(`carrier-dropdown-${index}`);
                    if (dropdownState) dropdownState.style.display = "none";
                  }, 200);
                }}
                placeholder="พิมพ์ชื่อคนแบก..."
                className="w-full text-xs px-2 py-1.5 rounded border border-slate-200/50 dark:border-slate-700/50 bg-white/60 dark:bg-black/20 focus:outline-none focus:bg-white dark:focus:bg-[#232733]"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddCarrier(); }}
              />
              <div id={`carrier-dropdown-${index}`} className="hidden absolute z-50 w-full mt-1 bg-white dark:bg-[#272C38] border border-slate-200 dark:border-[#2D3342] rounded-lg shadow-lg max-h-48 overflow-auto">
                {rosterMembers
                  .filter((m) => newCarrier === "" || m.name.toLowerCase().includes(newCarrier.toLowerCase()))
                  .filter((m) => !(team.carriers || []).includes(m.name))
                  .map((m) => (
                    <div
                      key={m.name}
                      className="px-3 py-1.5 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-[#323847] text-slate-800 dark:text-white flex items-center justify-between"
                      onClick={() => { setNewCarrier(m.name); }}
                    >
                      <span className="font-medium">{m.name}</span>
                      <span className="opacity-60 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: JOB_COLORS[m.job] || "#888" }} />
                        {m.job}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            <button
              onClick={handleAddCarrier}
              disabled={isLoading || !newCarrier.trim()}
              className="px-2 py-1 bg-indigo-500 text-white rounded text-xs hover:bg-indigo-600 disabled:opacity-50"
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Players Section */}
      <div className="flex flex-col gap-1.5 mb-4 px-1">
        <div className="text-xs font-bold mb-1 opacity-70">ผู้เล่นในคิว (Players)</div>
        <Droppable droppableId={`team_${team.id}`}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`min-h-[40px] rounded-lg transition-colors ${snapshot.isDraggingOver ? "bg-blue-100/50 dark:bg-blue-900/30" : ""}`}
            >
              {team.activeMembers.length === 0 ? (
                <div className="text-sm opacity-60 italic py-1">รอการจัดคิว...</div>
              ) : (
                team.activeMembers.map((m) => (
                  <div key={m.queueItemId} className="flex justify-between items-center text-sm bg-white/60 dark:bg-black/20 px-2 py-1.5 rounded border border-slate-200/50 dark:border-slate-700/50 mb-1.5 last:mb-0">
                    <span className="font-bold flex items-center">
                      <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: JOB_COLORS[m.job] || "#888" }} />
                      {m.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="opacity-70 text-xs font-medium bg-black/10 px-1.5 py-0.5 rounded">รอบ {m.roundNumber} ({m.job})</span>
                      {isAdmin && team.activeMembers.length > 0 && (
                        <button
                          onClick={() => onAction("eject", { queueItemId: m.queueItemId })}
                          className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 p-0.5 rounded transition-all"
                          title="เตะออกจากทีม (กลับไปต่อคิว)"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>

      <div className="flex items-center justify-between mt-auto">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {team.activeMembers.length > 0 ? "ทีมกำลังลงดันเจี้ยน" : "พร้อมรับผู้เล่น"}
        </div>

        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => onAction("assign")}
              disabled={isLoading || team.activeMembers.length >= (5 - (team.carriers?.length || 0))}
              className="p-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition disabled:opacity-50"
              title="จัดทีมอัตโนมัติ"
            >
              <Users size={16} />
            </button>
            {team.activeMembers.length > 0 && (
              <button
                onClick={() => onAction("complete")}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition disabled:opacity-50 text-xs font-semibold"
                title="ลงเสร็จ"
              >
                <CheckCircle size={15} />
                ลงเสร็จ
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
