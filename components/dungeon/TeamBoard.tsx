"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Pause, CheckCircle, RefreshCw, Users, Shield } from "lucide-react";
import { DungeonTeamResource } from "@/types";
import { JOB_COLORS } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";
import { useEffect, useState } from "react";

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
    mutationFn: async ({ teamId, action }: { teamId: string; action: string }) => {
      const res = await fetch(`/api/dungeon/teams/${teamId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dungeon_teams"] });
      queryClient.invalidateQueries({ queryKey: ["dungeon_queue_items"] });
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
          onAction={(action) => actionMutation.mutate({ teamId: team.id, action })}
          isLoading={actionMutation.isPending}
        />
      ))}
    </div>
  );
}

function TeamCard({ team, index, isAdmin, onAction, isLoading }: { 
  team: DungeonTeamResource; 
  index: number; 
  isAdmin: boolean;
  onAction: (action: string) => void;
  isLoading: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getStatusColor = () => {
    if (team.status === "AVAILABLE") return "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 border-green-200 dark:border-green-800";
    if (team.status === "RUNNING") return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800";
    if (team.status === "PAUSED") return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800";
    return "bg-slate-100 text-slate-700";
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

      <div className="flex flex-col gap-2 mb-4">
        {team.activeMembers.length === 0 ? (
          <div className="text-sm opacity-60 italic py-2">ไม่มีผู้เล่นในทีม</div>
        ) : (
          team.activeMembers.map((m) => (
            <div key={m.queueItemId} className="flex justify-between text-sm bg-white/40 dark:bg-black/20 px-2 py-1 rounded">
              <span className="font-bold">
                <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: JOB_COLORS[m.job] || '#888' }} />
                {m.name}
              </span>
              <span className="opacity-70">รอบ {m.roundNumber} ({m.job})</span>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className={`font-mono font-bold text-lg ${isOvertime ? 'text-red-500' : ''}`}>
          {timeDisplay}
        </div>
        
        {isAdmin && (
          <div className="flex gap-2">
            {team.status === "AVAILABLE" && (
              <>
                <button onClick={() => onAction("assign")} disabled={isLoading} className="p-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition" title="Auto Assign"><Users size={16} /></button>
                <button onClick={() => onAction("start")} disabled={isLoading || team.activeMembers.length === 0} className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 transition disabled:opacity-50" title="เริ่มลง"><Play size={16} /></button>
              </>
            )}
            {team.status === "RUNNING" && (
              <>
                <button onClick={() => onAction("pause")} disabled={isLoading} className="p-1.5 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition" title="หยุดชั่วคราว"><Pause size={16} /></button>
                <button onClick={() => onAction("complete")} disabled={isLoading} className="p-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition" title="จบการลง"><CheckCircle size={16} /></button>
              </>
            )}
            {team.status === "PAUSED" && (
              <>
                <button onClick={() => onAction("start")} disabled={isLoading} className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 transition" title="ดำเนินการต่อ"><Play size={16} /></button>
                <button onClick={() => onAction("complete")} disabled={isLoading} className="p-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition" title="จบการลง"><CheckCircle size={16} /></button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
