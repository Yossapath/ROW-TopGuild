"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Pause, CheckCircle, RefreshCw, Users, Shield, Plus, X } from "lucide-react";
import { DungeonTeamResource } from "@/types";
import { JOB_COLORS } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";
import { useEffect, useState, useMemo } from "react";

export function TeamBoard() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const { data: teams, isLoading } = useQuery<DungeonTeamResource[]>({
    queryKey: ["dungeon_teams"],
    queryFn: async () => {
      const res = await fetch("/api/dungeon/teams");
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 5000,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ teamId, action, payload }: { teamId: string; action: string; payload?: any }) => {
      const res = await fetch(`/api/dungeon/teams/${teamId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dungeon_teams"] });
      queryClient.invalidateQueries({ queryKey: ["dungeon_queue_items"] });
    },
  });

  const { data: rosterData } = useQuery({
    queryKey: ["roster"],
    queryFn: async () => {
      const res = await fetch("/api/roster");
      const json = await res.json();
      return json.data;
    }
  });

  const rosterMembers = useMemo(() => {
    if (!rosterData) return [];
    const members: {name: string, job: string}[] = [];
    for (const [job, arr] of Object.entries(rosterData as Record<string, { name: string }[]>)) {
      for (const m of arr) {
        members.push({ name: m.name, job });
      }
    }
    return members;
  }, [rosterData]);

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
  rosterMembers: {name: string, job: string}[];
  onAction: (action: string, payload?: any) => void;
  isLoading: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  const [newCarrier, setNewCarrier] = useState("");
  
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getStatusColor = () => {
    if (team.status === "AVAILABLE") return "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 border-green-200 dark:border-green-800";
    if (team.status === "RUNNING") return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800";
    if (team.status === "PAUSED") return "bg-slate-100 text-slate-700 dark:bg-[#272C38] dark:text-slate-300 border-slate-200 dark:border-[#2D3342]"; // Changed from yellow to slate
    return "bg-slate-100 text-slate-700 dark:bg-[#272C38] dark:text-slate-300 border-slate-200 dark:border-[#2D3342]";
  };

  const getStatusLabel = () => {
    if (team.status === "AVAILABLE") return "ว่าง / รอลูกทีม";
    if (team.status === "RUNNING") return "กำลังลง";
    if (team.status === "PAUSED") return "หยุดพัก";
    return team.status;
  };

  // Timer logic
  let timeDisplay = "--:--";
  let isOvertime = false;
  if (team.status === "RUNNING" && team.startedAt) {
    const elapsedMs = now - team.startedAt - team.pausedDuration;
    const remainingMs = team.estimatedDurationSeconds * 1000 - elapsedMs;
    if (remainingMs < 0) {
      isOvertime = true;
      const over = Math.abs(remainingMs);
      const m = Math.floor(over / 60000);
      const s = Math.floor((over % 60000) / 1000);
      timeDisplay = `+${m}:${s.toString().padStart(2, '0')}`;
    } else {
      const m = Math.floor(remainingMs / 60000);
      const s = Math.floor((remainingMs % 60000) / 1000);
      timeDisplay = `${m}:${s.toString().padStart(2, '0')}`;
    }
  } else if (team.status === "PAUSED" && team.pausedAt && team.startedAt) {
    const elapsedBeforePause = team.pausedAt - team.startedAt - team.pausedDuration;
    const remainingMs = team.estimatedDurationSeconds * 1000 - elapsedBeforePause;
    if (remainingMs < 0) {
      const over = Math.abs(remainingMs);
      const m = Math.floor(over / 60000);
      const s = Math.floor((over % 60000) / 1000);
      timeDisplay = `+${m}:${s.toString().padStart(2, '0')} (Paused)`;
    } else {
      const m = Math.floor(remainingMs / 60000);
      const s = Math.floor((remainingMs % 60000) / 1000);
      timeDisplay = `${m}:${s.toString().padStart(2, '0')} (Paused)`;
    }
  }

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
      <div className="mb-4 bg-white/40 dark:bg-black/20 p-2 rounded-lg">
        <div className="text-xs font-bold mb-1 opacity-70">คนแบก (Carriers)</div>
        <div className="flex flex-wrap gap-1 mb-2">
          {(!team.carriers || team.carriers.length === 0) ? (
            <span className="text-xs opacity-50 italic">ยังไม่มีคนแบก</span>
          ) : (
            team.carriers.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs font-bold bg-white dark:bg-[#323847] px-2 py-0.5 rounded shadow-sm">
                {c}
                {isAdmin && (
                  <button onClick={() => handleRemoveCarrier(i)} className="text-red-500 hover:text-red-700"><X size={12}/></button>
                )}
              </span>
            ))
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-1 relative">
            <div className="flex-1 relative">
              <input 
                type="text" 
                value={newCarrier}
                onChange={(e) => setNewCarrier(e.target.value)}
                onFocus={() => {
                  const dropdownState = document.getElementById(`carrier-dropdown-${index}`);
                  if(dropdownState) dropdownState.style.display = "block";
                }}
                onBlur={() => {
                  setTimeout(() => {
                    const dropdownState = document.getElementById(`carrier-dropdown-${index}`);
                    if(dropdownState) dropdownState.style.display = "none";
                  }, 200);
                }}
                placeholder="เพิ่มชื่อคนแบก..." 
                className="w-full text-xs px-2 py-1.5 rounded border border-transparent bg-white/60 dark:bg-black/30 focus:outline-none focus:bg-white dark:focus:bg-[#232733]"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCarrier(); }}
              />
              <div id={`carrier-dropdown-${index}`} className="hidden absolute z-50 w-full mt-1 bg-white dark:bg-[#272C38] border border-slate-200 dark:border-[#2D3342] rounded-lg shadow-lg max-h-48 overflow-auto">
                {rosterMembers
                  .filter(m => newCarrier === "" || m.name.toLowerCase().includes(newCarrier.toLowerCase()))
                  .map((m) => (
                  <div 
                    key={m.name} 
                    className="px-3 py-1.5 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-[#323847] text-slate-800 dark:text-white flex items-center justify-between"
                    onClick={() => {
                      setNewCarrier(m.name);
                    }}
                  >
                    <span className="font-medium">{m.name}</span>
                    <span className="opacity-60 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: JOB_COLORS[m.job] || '#888' }} />
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
      <div className="flex flex-col gap-2 mb-4">
        <div className="text-xs font-bold mb-0 opacity-70">ผู้เล่นในคิว (Players)</div>
        {team.activeMembers.length === 0 ? (
          <div className="text-sm opacity-60 italic py-1">รอการจัดคิว...</div>
        ) : (
          team.activeMembers.map((m) => (
            <div key={m.queueItemId} className="flex justify-between items-center text-sm bg-white/40 dark:bg-black/20 px-2 py-1.5 rounded group">
              <span className="font-bold flex items-center">
                <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: JOB_COLORS[m.job] || '#888' }} />
                {m.name}
              </span>
              <div className="flex items-center gap-2">
                <span className="opacity-70 text-xs font-medium bg-black/10 px-1.5 py-0.5 rounded">รอบ {m.roundNumber} ({m.job})</span>
                {isAdmin && (team.status === "AVAILABLE" || team.status === "PAUSED") && (
                  <button 
                    onClick={() => onAction("eject", { queueItemId: m.queueItemId })}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-100 p-0.5 rounded transition-all"
                    title="เตะออกจากทีม (กลับไปต่อคิว)"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between mt-auto">
        <div className={`font-mono font-bold text-lg ${isOvertime ? 'text-red-500' : ''}`}>
          {timeDisplay}
        </div>
        
        {isAdmin && (
          <div className="flex gap-2">
            {team.status === "AVAILABLE" && (
              <>
                <button onClick={() => onAction("assign")} disabled={isLoading} className="p-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition" title="Auto Assign (ดึงคิว)"><Users size={16} /></button>
                <button onClick={() => onAction("start")} disabled={isLoading || team.activeMembers.length === 0} className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 transition disabled:opacity-50" title="เริ่มลงดัน"><Play size={16} /></button>
              </>
            )}
            {team.status === "RUNNING" && (
              <>
                <button onClick={() => onAction("pause")} disabled={isLoading} className="p-1.5 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition" title="หยุดชั่วคราว"><Pause size={16} /></button>
                <button onClick={() => onAction("complete")} disabled={isLoading} className="p-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition" title="จบการลงดัน (ครบ 10 นาที)"><CheckCircle size={16} /></button>
              </>
            )}
            {team.status === "PAUSED" && (
              <>
                <button onClick={() => onAction("start")} disabled={isLoading} className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 transition" title="ดำเนินการต่อ"><Play size={16} /></button>
                <button onClick={() => onAction("complete")} disabled={isLoading} className="p-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition" title="จบการลงดัน"><CheckCircle size={16} /></button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
