"use client";

import { useEffect, useState } from "react";
import { Shield, Users, ArrowRightLeft, Wand2, Save, Loader2 } from "lucide-react";
import axios from "axios";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { JOB_COLORS } from "@/lib/utils";

// --- Types ---
type Member = {
  id: string; // name
  name: string;
  job: string;
  power: number;
};

type Column = {
  id: string;
  title: string;
  memberIds: string[];
  type: "main" | "sub" | "unassigned";
};

type DataState = {
  members: Record<string, Member>;
  columns: Record<string, Column>;
  mainOrder: string[];
  subOrder: string[];
};

export default function TeamsPage() {
  const [data, setData] = useState<DataState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Load data on mount
  useEffect(() => {
    setIsMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rosterRes, teamsRes] = await Promise.all([
        axios.get("/api/roster"),
        axios.get("/api/teams")
      ]);

      const rosterPayload = rosterRes.data;
      const savedTeams = teamsRes.data;

      const membersMap: Record<string, Member> = {};
      
      // Parse roster response: { ok: true, data: { "JobName": [ {name, power}, ... ] } }
      if (rosterPayload.ok && rosterPayload.data) {
        Object.entries(rosterPayload.data).forEach(([jobName, members]: [string, any]) => {
          if (Array.isArray(members)) {
            members.forEach(m => {
              membersMap[m.name] = { 
                id: m.name, 
                name: m.name, 
                job: jobName, 
                power: Number(m.power || 0) 
              };
            });
          }
        });
      }

      let initialData: DataState = {
        members: membersMap,
        columns: {},
        mainOrder: [],
        subOrder: []
      };

      // Check if we have saved team layouts and they match current members roughly
      // (If a member left the guild, they won't be in membersMap, we'll filter them out)
      if (savedTeams && savedTeams.main && savedTeams.main.length > 0) {
        // Reconstruct from DB
        let unassignedMembers = new Set(Object.keys(membersMap));

        const createColumns = (groups: any[][], prefix: string, type: "main"|"sub") => {
          const order: string[] = [];
          groups.forEach((group, idx) => {
            const colId = `${prefix}-${idx + 1}`;
            order.push(colId);
            const validIds = group
              .map((m: any) => m.name)
              .filter((name: string) => membersMap[name]); // only keep existing members
            
            validIds.forEach((id: string) => unassignedMembers.delete(id));

            initialData.columns[colId] = {
              id: colId,
              title: `ทีม ${idx + 1}`,
              memberIds: validIds,
              type
            };
          });
          return order;
        };

        initialData.mainOrder = createColumns(savedTeams.main || [], "main", "main");
        initialData.subOrder = createColumns(savedTeams.sub || [], "sub", "sub");

        initialData.columns["unassigned"] = {
          id: "unassigned",
          title: "ยังไม่ได้จัดทีม",
          memberIds: Array.from(unassignedMembers),
          type: "unassigned"
        };
      } else {
        // First time load: put everyone in unassigned
        initialData.columns["unassigned"] = {
          id: "unassigned",
          title: "รายชื่อทั้งหมด (ยังไม่ได้จัด)",
          memberIds: Object.keys(membersMap),
          type: "unassigned"
        };
        // Create empty main teams (15 teams)
        for (let i = 1; i <= 15; i++) {
          const id = `main-${i}`;
          initialData.columns[id] = { id, title: `ทีม ${i}`, memberIds: [], type: "main" };
          initialData.mainOrder.push(id);
        }
        // Create empty sub teams (5 teams)
        for (let i = 1; i <= 5; i++) {
          const id = `sub-${i}`;
          initialData.columns[id] = { id, title: `ทีม ${i}`, memberIds: [], type: "sub" };
          initialData.subOrder.push(id);
        }
      }

      setData(initialData);
    } catch (error) {
      console.error("Failed to load teams", error);
      alert("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoMatch = () => {
    if (!data) return;
    if (!confirm("การจัดทีมอัตโนมัติจะลบการจัดทีมปัจจุบันทั้งหมด และจัดใหม่ตามค่าพลัง (เรียงจากมากไปน้อย) ต้องการดำเนินการต่อหรือไม่?")) return;

    // Sort ALL members by power desc
    const allMembers = Object.values(data.members).sort((a, b) => b.power - a.power);
    
    const newData = { ...data };
    // Clear all columns
    Object.keys(newData.columns).forEach(colId => {
      newData.columns[colId].memberIds = [];
    });

    let currentMemberIndex = 0;

    // Fill Main Field (up to 15 teams)
    for (const colId of newData.mainOrder) {
      for (let i = 0; i < 5; i++) {
        if (currentMemberIndex < allMembers.length) {
          newData.columns[colId].memberIds.push(allMembers[currentMemberIndex].id);
          currentMemberIndex++;
        }
      }
    }

    // Fill Sub Field (up to 15 teams or however many needed)
    // Let's dynamically add sub teams if we have more members
    newData.subOrder = [];
    let subTeamCount = 1;
    while (currentMemberIndex < allMembers.length) {
      const colId = `sub-${subTeamCount}`;
      newData.columns[colId] = { id: colId, title: `ทีม ${subTeamCount}`, memberIds: [], type: "sub" };
      newData.subOrder.push(colId);

      for (let i = 0; i < 5; i++) {
        if (currentMemberIndex < allMembers.length) {
          newData.columns[colId].memberIds.push(allMembers[currentMemberIndex].id);
          currentMemberIndex++;
        }
      }
      subTeamCount++;
    }

    // Any completely empty sub teams? Keep at least 5 empty ones for UI flexibility
    while (newData.subOrder.length < 5) {
      const colId = `sub-${subTeamCount}`;
      newData.columns[colId] = { id: colId, title: `ทีม ${subTeamCount}`, memberIds: [], type: "sub" };
      newData.subOrder.push(colId);
      subTeamCount++;
    }

    setData(newData);
  };

  const handleSave = async () => {
    if (!data) return;
    setIsSaving(true);
    try {
      // Reconstruct payload
      const payload = {
        main: data.mainOrder.map(colId => data.columns[colId].memberIds.map(id => data.members[id])),
        sub: data.subOrder.map(colId => data.columns[colId].memberIds.map(id => data.members[id]))
      };
      await axios.put("/api/teams", payload);
      alert("บันทึกการจัดทีมเรียบร้อย!");
    } catch (error) {
      console.error(error);
      alert("บันทึกไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!data) return;
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const startCol = data.columns[source.droppableId];
    const finishCol = data.columns[destination.droppableId];

    // Limit teams to 5 members (except unassigned)
    if (startCol !== finishCol && finishCol.type !== "unassigned" && finishCol.memberIds.length >= 5) {
      alert("หนึ่งทีมสามารถมีสมาชิกได้สูงสุด 5 คน");
      return;
    }

    const newData = { ...data };

    if (startCol === finishCol) {
      const newMemberIds = Array.from(startCol.memberIds);
      newMemberIds.splice(source.index, 1);
      newMemberIds.splice(destination.index, 0, draggableId);

      newData.columns[startCol.id] = { ...startCol, memberIds: newMemberIds };
    } else {
      const startMemberIds = Array.from(startCol.memberIds);
      startMemberIds.splice(source.index, 1);
      
      const finishMemberIds = Array.from(finishCol.memberIds);
      finishMemberIds.splice(destination.index, 0, draggableId);

      newData.columns[startCol.id] = { ...startCol, memberIds: startMemberIds };
      newData.columns[finishCol.id] = { ...finishCol, memberIds: finishMemberIds };
    }

    setData(newData);
  };

  if (!isMounted || isLoading) {
    return <div className="flex h-screen items-center justify-center font-bold text-theme-textSecondary"><Loader2 className="animate-spin mr-2" /> กำลังโหลดข้อมูล...</div>;
  }

  if (!data) return null;

  return (
    <div className="space-y-6 bg-[#f0f6fc] min-h-screen p-4 lg:py-6 lg:px-8 xl:px-12 2xl:px-20 relative" style={{ zoom: 0.85 }}>
      {/* Top Banner */}
      <div className="bg-theme-panel rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between shadow-sm border border-theme-border sticky top-4 z-10">
        <div className="flex items-center space-x-4 mb-4 md:mb-0">
          <div className="bg-[#065bca] p-3 rounded-xl text-white shadow-md">
            <Shield size={32} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-wide text-[#0b3d63]">จัดทีม GVG</h1>
            <p className="text-theme-textSecondary text-sm md:text-base font-medium mt-1">ลากและวางเพื่อจัดทีม หรือใช้ออโต้แมตช์</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={handleAutoMatch}
            className="flex items-center gap-2 px-4 py-2.5 bg-theme-panel text-[#065bca] rounded-lg font-bold hover:bg-[#eff6ff] transition-colors shadow-sm border border-[#065bca]"
          >
            <Wand2 size={18} />
            <span>ออโต้จัดทีม (Auto-Match)</span>
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#065bca] text-white rounded-lg font-bold hover:bg-[#054bb0] transition-colors shadow-sm disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            <span>บันทึกการจัดทีม</span>
          </button>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Unassigned Pool */}
          <div className="lg:w-1/4 xl:w-1/5 flex-shrink-0">
            <div className="bg-theme-panel rounded-2xl shadow-sm border border-theme-border h-[calc(100vh-180px)] flex flex-col">
              <div className="p-4 border-b border-theme-border/50 flex items-center justify-between bg-theme-bg rounded-t-2xl">
                <h2 className="font-bold text-theme-text flex items-center gap-2">
                  <Users size={18} /> ยังไม่ได้จัดทีม
                </h2>
                <span className="bg-theme-divider text-theme-text text-xs font-bold px-2 py-1 rounded-full">
                  {data.columns["unassigned"].memberIds.length}
                </span>
              </div>
              
              <Droppable droppableId="unassigned">
                {(provided, snapshot) => (
                  <div 
                    ref={provided.innerRef} 
                    {...provided.droppableProps}
                    className={`flex-1 overflow-y-auto p-3 space-y-2 transition-colors ${snapshot.isDraggingOver ? 'bg-theme-bg' : 'bg-theme-panel'} rounded-b-2xl`}
                  >
                    {data.columns["unassigned"].memberIds.map((id, index) => {
                      const m = data.members[id];
                      return <MemberCard key={id} member={m} index={index} />;
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </div>

          {/* Teams Grid */}
          <div className="flex-1 overflow-y-auto h-[calc(100vh-180px)] space-y-8 pr-2">
            
            {/* Main Field */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-extrabold text-[#065bca] uppercase tracking-wide">สนามหลัก (Main Field)</h2>
                <div className="h-px bg-theme-divider flex-1"></div>
                <span className="text-sm font-bold text-theme-textSecondary bg-theme-panel px-3 py-1 rounded-full border border-theme-border shadow-sm">
                  {data.mainOrder.reduce((acc, colId) => acc + data.columns[colId].memberIds.length, 0)} คน / {data.mainOrder.length} ทีม
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {data.mainOrder.map((colId, index) => (
                  <TeamColumn key={colId} column={data.columns[colId]} members={data.members} index={index} />
                ))}
              </div>
            </div>

            {/* Sub Field */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-extrabold text-theme-warning uppercase tracking-wide">สนามรอง (Sub Field)</h2>
                <div className="h-px bg-theme-divider flex-1"></div>
                <span className="text-sm font-bold text-theme-textSecondary bg-theme-panel px-3 py-1 rounded-full border border-theme-border shadow-sm">
                  {data.subOrder.reduce((acc, colId) => acc + data.columns[colId].memberIds.length, 0)} คน / {data.subOrder.length} ทีม
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {data.subOrder.map((colId, index) => (
                  <TeamColumn key={colId} column={data.columns[colId]} members={data.members} index={index} />
                ))}
              </div>
            </div>

          </div>
        </div>
      </DragDropContext>
    </div>
  );
}

// --- Subcomponents ---

function TeamColumn({ column, members, index }: { column: Column; members: Record<string, Member>; index: number }) {
  const isFull = column.memberIds.length >= 5;
  const isMain = column.type === "main";

  return (
    <div className={`bg-theme-panel rounded-xl shadow-sm border ${isMain ? 'border-theme-primary/20' : 'border-theme-warning/20'} flex flex-col overflow-hidden`}>
      <div className={`p-2.5 flex items-center justify-between border-b ${isMain ? 'bg-theme-primary/5 border-theme-primary/20' : 'bg-theme-warning/5 border-theme-warning/20'}`}>
        <h3 className={`font-bold text-sm ${isMain ? 'text-[#065bca]' : 'text-theme-warning'}`}>{column.title}</h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isFull ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-theme-textSecondary'}`}>
          {column.memberIds.length}/5
        </span>
      </div>
      
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div 
            ref={provided.innerRef} 
            {...provided.droppableProps}
            className={`p-2 min-h-[220px] transition-colors space-y-1.5 ${snapshot.isDraggingOver ? (isFull ? 'bg-red-50' : 'bg-theme-bg') : 'bg-theme-panel'}`}
          >
            {column.memberIds.map((id, idx) => {
              const m = members[id];
              return <MemberCard key={id} member={m} index={idx} inTeam={true} />;
            })}
            {provided.placeholder}
            
            {/* Empty Slots Fillers for visual guide */}
            {column.memberIds.length < 5 && Array.from({ length: 5 - column.memberIds.length }).map((_, i) => (
              <div key={`empty-${i}`} className="h-10 border border-dashed border-theme-border rounded-lg flex items-center justify-center bg-theme-bg/50">
                <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Empty Slot</span>
              </div>
            ))}
          </div>
        )}
      </Droppable>
    </div>
  );
}

function MemberCard({ member, index, inTeam = false }: { member: Member; index: number; inTeam?: boolean }) {
  const color = JOB_COLORS[member.job] || "#475569";
  
  // Create a tinted background using CSS string manipulation for simplicity
  const hexToRgba = (hex: string, alpha: number) => {
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <Draggable draggableId={member.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`flex items-center justify-between p-2 rounded-lg border shadow-sm select-none transition-shadow ${
            snapshot.isDragging ? 'shadow-lg border-theme-primary z-50 ring-2 ring-theme-primary/20' : 'border-theme-border hover:border-theme-borderHover'
          }`}
          style={{
            ...provided.draggableProps.style,
            backgroundColor: snapshot.isDragging ? 'white' : hexToRgba(color, 0.04),
            borderLeftWidth: '4px',
            borderLeftColor: color
          }}
        >
          <div className="flex flex-col truncate pr-2 min-w-0">
            <span className="text-[12px] font-bold text-theme-text truncate">{member.name}</span>
            <span className="text-[9px] font-bold truncate opacity-80" style={{ color }}>{member.job}</span>
          </div>
          <div className="text-[11px] font-bold tabular-nums tracking-tight flex-shrink-0" style={{ color }}>
            {member.power.toLocaleString('en-US')}
          </div>
        </div>
      )}
    </Draggable>
  );
}
