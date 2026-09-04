"use client";

import { useEffect, useState } from "react";
import { Shield, Users, Save, Loader2, GripVertical, Lock, Unlock, X, ChevronLeft, ChevronRight, LayoutGrid, RefreshCw, Wand2 } from "lucide-react";
import axios from "axios";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { JOB_COLORS, JOB_LIST } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";

type Member = { id: string; name: string; job: string; power: number; };
type Column = { id: string; title: string; memberIds: (string | null)[]; type: "main" | "sub" | "unassigned"; locked: boolean; };
type DataState = {
  members: Record<string, Member>;
  columns: Record<string, Column>;
  mainZone1Order: string[];
  mainZone2Order: string[];
  subOrder: string[];
  offlineIds: string[];
};

export default function TeamsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const [data, setData] = useState<DataState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const [activeTab, setActiveTab] = useState<"main" | "sub" | "leave">("main");
  const [unassignedFilterJob, setUnassignedFilterJob] = useState<string>("All");
  const [isUnassignedCollapsed, setIsUnassignedCollapsed] = useState(false);
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
  const [autoModalText, setAutoModalText] = useState("");
  const [leaveRecords, setLeaveRecords] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rosterRes, teamsRes, leaveRes] = await Promise.all([ 
        axios.get("/api/roster"), 
        axios.get("/api/teams"),
        axios.get("/api/leave").catch(() => ({ data: [] }))
      ]);
      const rosterPayload = rosterRes.data;
      const savedTeams = teamsRes.data;
      const membersMap: Record<string, Member> = {};
      
      if (leaveRes.data) {
        // data.data is an array if ok, or just the array directly depending on api format
        setLeaveRecords(leaveRes.data.data || leaveRes.data || []);
      }
      
      if (rosterPayload.ok && rosterPayload.data) {
        Object.entries(rosterPayload.data).forEach(([jobName, members]: [string, any]) => {
          if (Array.isArray(members)) {
            members.forEach(m => { membersMap[m.name] = { id: m.name, name: m.name, job: jobName, power: Number(m.power || 0) }; });
          }
        });
      }

      let initialData: DataState = { members: membersMap, columns: {}, mainZone1Order: [], mainZone2Order: [], subOrder: [], offlineIds: savedTeams?.offlineIds || [] };
      let hasData = false;
      let unassignedMembers = new Set(Object.keys(membersMap));
      
      const processLegacyFormat = (groupsObj: any, prefix: string, type: "main"|"sub") => {
         const order: string[] = [];
         let num = 1;
         Object.keys(groupsObj).sort((a,b) => {
           const numA = parseInt(a.replace(/\D/g, '')) || 0;
           const numB = parseInt(b.replace(/\D/g, '')) || 0;
           return numA - numB;
         }).forEach(teamKey => {
           const group = groupsObj[teamKey];
           const colId = `${prefix}-${num}`;
           order.push(colId);
           const validIds: (string|null)[] = [null, null, null, null, null];
           group.forEach((m: any, idx: number) => {
             if (idx < 5 && m && m.name && membersMap[m.name]) {
               validIds[idx] = m.name;
               unassignedMembers.delete(m.name);
             }
           });
           initialData.columns[colId] = { id: colId, title: `ทีม ${num}`, memberIds: validIds, type, locked: false };
           num++;
         });
         return order;
      };

      if (savedTeams && savedTeams.data && Array.isArray(savedTeams.data)) {
        hasData = true;
        const mainObj = savedTeams.data[0]?.teams || {};
        const subObj = savedTeams.data[1]?.teams || {};
        const allMainOrder = processLegacyFormat(mainObj, "main", "main");
        initialData.mainZone1Order = allMainOrder.slice(0, 6);
        initialData.mainZone2Order = allMainOrder.slice(6, 12);
        initialData.subOrder = processLegacyFormat(subObj, "sub", "sub");
        initialData.columns["unassigned"] = { id: "unassigned", title: "ยังไม่ได้จัดทีม", memberIds: Array.from(unassignedMembers), type: "unassigned", locked: false };
      } else if (savedTeams && savedTeams.main && savedTeams.main.length > 0) {
        hasData = true;
        const createColumns = (groups: any[][], prefix: string, type: "main"|"sub", startIdx = 1) => {
          const order: string[] = [];
          groups.forEach((group, idx) => {
            const num = startIdx + idx;
            const colId = `${prefix}-${num}`;
            order.push(colId);
            const validIds: (string|null)[] = [null, null, null, null, null];
            group.forEach((m: any, mIdx: number) => {
              if (mIdx < 5 && m && m.name && membersMap[m.name]) {
                validIds[mIdx] = m.name;
                unassignedMembers.delete(m.name);
              }
            });
            initialData.columns[colId] = { id: colId, title: `ทีม ${num}`, memberIds: validIds, type, locked: false };
          });
          return order;
        };
        const allMainOrder = createColumns(savedTeams.main || [], "main", "main", 1);
        initialData.mainZone1Order = allMainOrder.slice(0, 6);
        initialData.mainZone2Order = allMainOrder.slice(6, 12);
        initialData.subOrder = createColumns(savedTeams.sub || [], "sub", "sub", 1);
        initialData.columns["unassigned"] = { id: "unassigned", title: "ยังไม่ได้จัดทีม", memberIds: Array.from(unassignedMembers), type: "unassigned", locked: false };
      }

      if (!hasData) {
        initialData.columns["unassigned"] = { id: "unassigned", title: "รายชื่อทั้งหมด (ยังไม่ได้จัด)", memberIds: Object.keys(membersMap), type: "unassigned", locked: false };
        for (let i = 1; i <= 12; i++) {
          const id = `main-${i}`;
          initialData.columns[id] = { id, title: `ทีม ${i}`, memberIds: [null, null, null, null, null], type: "main", locked: false };
          if (i <= 6) initialData.mainZone1Order.push(id); else initialData.mainZone2Order.push(id);
        }
        for (let i = 1; i <= 6; i++) {
          const id = `sub-${i}`;
          initialData.columns[id] = { id, title: `ทีมรอง ${i}`, memberIds: [null, null, null, null, null], type: "sub", locked: false };
          initialData.subOrder.push(id);
        }
      }

      // Ensure offline members are not in unassigned
      if (initialData.columns["unassigned"] && initialData.offlineIds && initialData.offlineIds.length > 0) {
        initialData.columns["unassigned"].memberIds = initialData.columns["unassigned"].memberIds.filter(
          id => id && !initialData.offlineIds.includes(id)
        );
      }

      // Merge saved teams if it's the newer format
      if (savedTeams && savedTeams.columns) {
        initialData = { ...initialData, ...savedTeams, offlineIds: savedTeams.offlineIds || [] };
        
        // Final sanity check for offline members
        if (initialData.offlineIds && initialData.offlineIds.length > 0) {
          Object.keys(initialData.columns).forEach(colId => {
            initialData.columns[colId].memberIds = initialData.columns[colId].memberIds.map(
              id => (id && initialData.offlineIds.includes(id)) ? null : id
            );
          });
          if (initialData.columns["unassigned"]) {
            initialData.columns["unassigned"].memberIds = initialData.columns["unassigned"].memberIds.filter(id => id !== null);
          }
        }
      }

      setData(initialData);
    } catch (error) {
      alert("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePullTop60 = () => {
    if (!data) return;
    const allMembers = Object.values(data.members).sort((a, b) => b.power - a.power);
    const priests = allMembers.filter(m => m.job === "Priest");
    const nonPriests = allMembers.filter(m => m.job !== "Priest");
    const selectedPriests = priests.slice(0, 12);
    const selectedNonPriests = nonPriests.slice(0, 48);
    const combined = [...selectedPriests, ...selectedNonPriests].sort((a, b) => b.power - a.power);
    setAutoModalText(combined.map(m => m.name).join('\n'));
  };

  const handleProcessAutoMatch = () => {
    if (!data) return;
    const names = autoModalText.split('\n').map(n => n.trim()).filter(n => n);
    
    if (names.length !== 60) {
      if (!confirm(`คุณระบุรายชื่อมา ${names.length} คน (ต้องการ 60 คน) ต้องการดำเนินการต่อหรือไม่? ระบบจะพยายามจัดให้ดีที่สุด`)) return;
    }

    const newData = { ...data };
    const lockedMemberIds = new Set<string>();
    Object.values(newData.columns).forEach(col => {
      if (col.locked && col.type !== "unassigned") {
        col.memberIds.forEach(id => { if (id) lockedMemberIds.add(id); });
      }
    });

    Object.keys(newData.columns).forEach(colId => {
      if (!newData.columns[colId].locked && colId !== "unassigned") {
        newData.columns[colId].memberIds = [null, null, null, null, null];
      }
    });

    const mainFieldMembers = names
      .map(name => newData.members[name])
      .filter(m => m && !lockedMemberIds.has(m.id))
      .sort((a, b) => b.power - a.power);

    const mainFieldIdsSet = new Set(mainFieldMembers.map(m => m.id));
    const subFieldMembers = Object.values(newData.members)
      .filter(m => !mainFieldIdsSet.has(m.id) && !lockedMemberIds.has(m.id))
      .sort((a, b) => b.power - a.power);

    const mainPriests = mainFieldMembers.filter(m => m.job === "Priest");
    const mainOthers = mainFieldMembers.filter(m => m.job !== "Priest");
    
    const mainCols = [...newData.mainZone1Order, ...newData.mainZone2Order];
    
    let pIdx = 0;
    mainCols.forEach(colId => {
      if (newData.columns[colId].locked) return;
      const firstNull = newData.columns[colId].memberIds.indexOf(null);
      if (pIdx < mainPriests.length && firstNull !== -1) {
        newData.columns[colId].memberIds[firstNull] = mainPriests[pIdx].id;
        pIdx++;
      }
    });
    
    const remainingToPlace = [...mainPriests.slice(pIdx), ...mainOthers].sort((a, b) => b.power - a.power);
    
    let mIdx = 0;
    mainCols.forEach(colId => {
      if (newData.columns[colId].locked) return;
      for (let i = 0; i < 5; i++) {
        if (newData.columns[colId].memberIds[i] === null && mIdx < remainingToPlace.length) {
          newData.columns[colId].memberIds[i] = remainingToPlace[mIdx].id;
          mIdx++;
        }
      }
    });

    let subTeamCount = 1;
    newData.subOrder = [];
    let sIdx = 0;
    
    const fillSubColumn = (colId: string) => {
      if (newData.columns[colId].locked) return;
      for (let i = 0; i < 5; i++) {
        if (newData.columns[colId].memberIds[i] === null && sIdx < subFieldMembers.length) {
          newData.columns[colId].memberIds[i] = subFieldMembers[sIdx].id;
          sIdx++;
        }
      }
    };

    while (sIdx < subFieldMembers.length) {
      const colId = `sub-${subTeamCount}`;
      if (!newData.columns[colId]) newData.columns[colId] = { id: colId, title: `ทีม ${subTeamCount}`, memberIds: [null, null, null, null, null], type: "sub", locked: false };
      newData.subOrder.push(colId);
      fillSubColumn(colId);
      subTeamCount++;
    }

    while (newData.subOrder.length < 5) {
      const colId = `sub-${subTeamCount}`;
      if (!newData.columns[colId]) newData.columns[colId] = { id: colId, title: `ทีม ${subTeamCount}`, memberIds: [null, null, null, null, null], type: "sub", locked: false };
      if (!newData.subOrder.includes(colId)) newData.subOrder.push(colId);
      subTeamCount++;
    }

    newData.columns["unassigned"].memberIds = [];
    setData(newData);
    setIsAutoModalOpen(false);
  };

  const handleClearAll = () => {
    if (!data) return;
    if (!confirm('ลบทุกคนออกจากทุกทีม (ยกเว้นทีมที่ล็อกไว้) ไปยังยังไม่ได้จัดทีม แน่ใจหรือไม่?')) return;
    const newData = { ...data };
    Object.keys(newData.columns).forEach(colId => {
      if (!newData.columns[colId].locked && colId !== 'unassigned') {
        newData.columns[colId].memberIds.forEach(id => {
           if (id) newData.columns['unassigned'].memberIds.push(id);
        });
        newData.columns[colId].memberIds = [null, null, null, null, null];
      }
    });
    setData(newData);
  };

  const handleSave = async () => {
    if (!data) return;
    setIsSaving(true);
    try {
      const payload = {
        columns: data.columns,
        mainZone1Order: data.mainZone1Order,
        mainZone2Order: data.mainZone2Order,
        subOrder: data.subOrder,
        offlineIds: data.offlineIds,
        main: [...data.mainZone1Order, ...data.mainZone2Order].map(colId => data.columns[colId].memberIds.map(id => id ? data.members[id] : { name: "", job: "", power: null })),
        sub: data.subOrder.map(colId => data.columns[colId].memberIds.map(id => id ? data.members[id] : { name: "", job: "", power: null }))
      };
      await axios.put("/api/teams", payload);
      alert("บันทึกการจัดทีมเรียบร้อย!");
    } catch (error) {
      alert("บันทึกไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleLock = (colId: string) => {
    if (!data) return;
    setData({
      ...data,
      columns: {
        ...data.columns,
        [colId]: { ...data.columns[colId], locked: !data.columns[colId].locked }
      }
    });
  };

  const clearTeam = (colId: string) => {
    if (!data || data.columns[colId].locked) return;
    const newData = { ...data };
    newData.columns[colId].memberIds.forEach(id => {
       if (id) newData.columns["unassigned"].memberIds.push(id);
    });
    newData.columns[colId].memberIds = [null, null, null, null, null];
    setData(newData);
  };

  const removeMember = (colId: string, memberId: string) => {
    if (!data || data.columns[colId].locked) return;
    const newData = { ...data };
    const idx = newData.columns[colId].memberIds.indexOf(memberId);
    if (idx !== -1) newData.columns[colId].memberIds[idx] = null;
    newData.columns["unassigned"].memberIds.unshift(memberId);
    setData(newData);
  };

  const markAsOffline = (memberId: string) => {
    if (!data || !memberId) return;
    const newData = { ...data };
    
    // Add to offlineIds
    if (!newData.offlineIds.includes(memberId)) {
      newData.offlineIds = [...newData.offlineIds, memberId];
    }
    
    // Remove from unassigned
    newData.columns["unassigned"].memberIds = newData.columns["unassigned"].memberIds.filter(id => id !== memberId);
    
    // Remove from any team column
    Object.keys(newData.columns).forEach(colId => {
      if (colId === "unassigned") return;
      const idx = newData.columns[colId].memberIds.indexOf(memberId);
      if (idx !== -1) newData.columns[colId].memberIds[idx] = null;
    });
    
    setData(newData);
    // Auto-save logic? Optional, but good to have. The user can click Save.
  };

  const removeFromOffline = (memberId: string) => {
    if (!data || !memberId) return;
    const newData = { ...data };
    
    newData.offlineIds = newData.offlineIds.filter(id => id !== memberId);
    // Put back to unassigned if they exist in roster
    if (newData.members[memberId] && !newData.columns["unassigned"].memberIds.includes(memberId)) {
      newData.columns["unassigned"].memberIds.unshift(memberId);
    }
    
    setData(newData);
  };

  const onDragEnd = (result: DropResult) => {
    if (!data) return;
    const { destination, source, draggableId, type } = result;

    if (!destination) return;

    const newData = { ...data };

    if (type === "TEAM") {
      if (destination.droppableId === source.droppableId && destination.index === source.index) return;
      const destListId = destination.droppableId;
      const sourceListId = source.droppableId;
      let sourceList = sourceListId === "mainZone1" ? newData.mainZone1Order : 
                       sourceListId === "mainZone2" ? newData.mainZone2Order : newData.subOrder;
      let destList = destListId === "mainZone1" ? newData.mainZone1Order : 
                     destListId === "mainZone2" ? newData.mainZone2Order : newData.subOrder;

      if (sourceListId === destListId) {
        sourceList.splice(source.index, 1);
        sourceList.splice(destination.index, 0, draggableId);
      } else {
        sourceList.splice(source.index, 1);
        destList.splice(destination.index, 0, draggableId);
      }
      setData(newData);
      return;
    }

    if (source.droppableId === "unassigned" && destination.droppableId === "unassigned") {
      const newMemberIds = Array.from(newData.columns["unassigned"].memberIds);
      newMemberIds.splice(source.index, 1);
      newMemberIds.splice(destination.index, 0, draggableId);
      newData.columns["unassigned"].memberIds = newMemberIds;
      setData(newData);
      return;
    }

    const isSourceUnassigned = source.droppableId === "unassigned";
    const [sourceColId, sourceSlotIdxStr] = source.droppableId.split('::');
    const sourceSlotIdx = parseInt(sourceSlotIdxStr);
    
    const isDestUnassigned = destination.droppableId === "unassigned";
    const [destColId, destSlotIdxStr] = destination.droppableId.split('::');
    const destSlotIdx = parseInt(destSlotIdxStr);

    if (!isSourceUnassigned && newData.columns[sourceColId].locked) return;
    if (!isDestUnassigned && newData.columns[destColId].locked) return;

    if (isSourceUnassigned && !isDestUnassigned) {
      const memberToMove = newData.columns["unassigned"].memberIds[source.index];
      const memberAtDest = newData.columns[destColId].memberIds[destSlotIdx];
      
      newData.columns["unassigned"].memberIds.splice(source.index, 1);
      if (memberAtDest) {
         newData.columns["unassigned"].memberIds.splice(source.index, 0, memberAtDest);
      }
      newData.columns[destColId].memberIds[destSlotIdx] = memberToMove;
    } else if (!isSourceUnassigned && isDestUnassigned) {
      const memberToMove = newData.columns[sourceColId].memberIds[sourceSlotIdx];
      newData.columns[sourceColId].memberIds[sourceSlotIdx] = null;
      if (memberToMove) {
         newData.columns["unassigned"].memberIds.splice(destination.index, 0, memberToMove);
      }
    } else if (!isSourceUnassigned && !isDestUnassigned) {
      const memberA = newData.columns[sourceColId].memberIds[sourceSlotIdx];
      const memberB = newData.columns[destColId].memberIds[destSlotIdx];
      newData.columns[sourceColId].memberIds[sourceSlotIdx] = memberB;
      newData.columns[destColId].memberIds[destSlotIdx] = memberA;
    }

    setData(newData);
  };

  if (!isMounted || isLoading) return <div className="flex h-screen items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2" /> โหลดข้อมูล...</div>;
  if (!data) return null;

  const filteredUnassignedIds = (data.columns["unassigned"].memberIds as string[]).filter(id => {
    if (unassignedFilterJob === "All") return true;
    return data.members[id]?.job === unassignedFilterJob;
  });

  const AutoMatchModal = () => {
    if (!isAutoModalOpen) return null;
    const names = autoModalText.split('\n').map(n => n.trim()).filter(n => n);
    return (
      <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-theme-panel rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-theme-border animate-in zoom-in-95 duration-200">
          <div className="p-4 border-b border-theme-border flex items-center justify-between">
            <h3 className="font-bold text-lg text-theme-text">กำหนดรายชื่อสนามหลัก (60 คน) เพื่อจัดทีม</h3>
            <button onClick={() => setIsAutoModalOpen(false)} className="text-theme-textSecondary hover:text-theme-text"><X size={20}/></button>
          </div>
          <div className="p-4 flex-1 flex flex-col gap-4">
            <p className="text-sm text-theme-textSecondary">
              ระบุหรือวางรายชื่อสมาชิก 60 คนสำหรับสนามหลัก (บรรทัดละ 1 ชื่อ) ระบบจะจัดสนามหลักตามรายชื่อนี้ และนำสมาชิกคนที่เหลือทั้งหมดไปจัดลงสนามรองตามกฏกิลด์ให้อัตโนมัติ
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-[#065bca] flex items-start gap-2">
              <span className="font-bold">✨ คำแนะนำ:</span> จำนวนที่ดึงอัตโนมัติ จะคัดเลือกมี Priest 12 คนสำหรับสนามหลักให้อัตโนมัติ
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-theme-text">ตรวจพบรายชื่อ: {names.length} / 60 คน</span>
              <button onClick={handlePullTop60} className="text-[#065bca] font-bold text-sm bg-[#065bca]/10 px-4 py-1.5 rounded-lg hover:bg-[#065bca]/20 transition-colors border border-[#065bca]/20 flex items-center gap-1">
                ✨ ดึง 60 พลังสูงสุดมาวางให้ก่อน
              </button>
            </div>
            <textarea 
              className="w-full h-[250px] bg-theme-bg border border-theme-border rounded-lg p-3 text-sm text-theme-text font-mono resize-none focus:ring-2 focus:ring-[#065bca] outline-none"
              value={autoModalText}
              onChange={e => setAutoModalText(e.target.value)}
              placeholder="วางรายชื่อที่นี่ (1 บรรทัดต่อ 1 ชื่อ)"
            />
          </div>
          <div className="p-4 border-t border-theme-border flex items-center justify-end gap-3 bg-theme-bg/50">
            <button onClick={() => setIsAutoModalOpen(false)} className="px-5 py-2 rounded-lg font-bold text-theme-textSecondary hover:bg-theme-border/50 transition-colors border border-theme-border bg-theme-panel">ยกเลิก</button>
            <button onClick={handleProcessAutoMatch} className="px-5 py-2 rounded-lg font-bold text-white bg-[#10b981] hover:bg-[#059669] transition-colors shadow-sm flex items-center gap-2">
              🚀 ประมวลผลและจัดทีมทันที
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 bg-theme-bg min-h-screen p-4 xl:p-6 pb-20">
      <AutoMatchModal />
      
      <div className="bg-theme-panel rounded-xl p-4 md:p-6 flex flex-col lg:flex-row items-center justify-between shadow-sm border border-theme-border relative">
        <div className="flex items-center space-x-4 mb-4 lg:mb-0">
          <div className="bg-[#065bca] p-2.5 rounded-lg text-white shadow-sm"><Shield size={28} /></div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-wide text-theme-text">จัดทีม GVG</h1>
            <p className="text-theme-textSecondary text-xs md:text-sm font-medium mt-0.5">ลากและวางเพื่อจัดทีม หรือใช้ออโต้แมตช์</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={handleClearAll} className="flex items-center gap-2 px-4 py-2 bg-theme-panel text-theme-danger border border-theme-danger rounded-lg font-bold hover:bg-theme-danger/5 transition-colors text-sm shadow-sm">
            <span>ล้างทั้งหมด</span>
          </button>
          <button onClick={() => setIsAutoModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-theme-panel text-[#065bca] border border-[#065bca] rounded-lg font-bold hover:bg-[#065bca]/5 transition-colors text-sm shadow-sm">
            <span>ออโต้จัดทีม (Auto)</span>
          </button>
          <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-5 py-2 bg-[#065bca] text-white rounded-lg font-bold hover:bg-[#054bb0] transition-colors shadow-sm disabled:opacity-50 text-sm">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} <span>บันทึกการจัดทีม</span>
          </button>
        </div>
      </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 items-start">
            {isAdmin && !isUnassignedCollapsed && (
              <div className="w-[300px] flex-shrink-0 bg-theme-panel rounded-xl shadow-sm border border-theme-border h-[calc(100vh-140px)] flex flex-col sticky top-28 z-10 transition-all">
                <div className="p-3 border-b border-theme-divider bg-theme-bg/50 rounded-t-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-theme-text flex items-center gap-2 text-sm"><Users size={16} /> ยังไม่ได้จัด ({data.columns["unassigned"].memberIds.length})</h2>
                    <button onClick={() => setIsUnassignedCollapsed(true)} className="text-theme-textSecondary hover:text-theme-text bg-theme-panel border border-theme-border rounded p-1"><ChevronLeft size={14}/></button>
                  </div>
                  <select 
                    value={unassignedFilterJob} 
                    onChange={e => setUnassignedFilterJob(e.target.value)}
                    className="w-full bg-theme-bg border border-theme-border rounded-md px-2 py-1.5 text-xs font-bold text-theme-text outline-none"
                  >
                    <option value="All">ทุกอาชีพ</option>
                    {JOB_LIST.map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
                
                <Droppable droppableId="unassigned" type="MEMBER">
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className={`flex-1 overflow-y-auto p-2 space-y-1.5 transition-colors ${snapshot.isDraggingOver ? 'bg-theme-bg/80' : ''}`}>
                      {filteredUnassignedIds.map((id, index) => {
                        return <MemberCard key={id} member={data.members[id]} index={index} />;
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )}
            
            {isAdmin && isUnassignedCollapsed && (
              <div className="flex-shrink-0 bg-theme-panel rounded-xl shadow-sm border border-theme-border h-[calc(100vh-140px)] flex flex-col items-center py-4 sticky top-28 z-10 w-12 cursor-pointer hover:bg-theme-bg transition-colors" onClick={() => setIsUnassignedCollapsed(false)}>
                <ChevronRight size={20} className="text-theme-textSecondary mb-4"/>
                <div className="writing-vertical-rl transform rotate-180 text-theme-text font-bold tracking-widest flex items-center gap-2">
                  ยังไม่ได้จัด <span className="bg-[#065bca] text-white text-xs px-2 py-0.5 rounded-full">{data.columns["unassigned"].memberIds.length}</span>
                </div>
              </div>
            )}

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex gap-2 mb-4 bg-theme-panel p-1.5 rounded-lg border border-theme-border self-start">
              <button 
                onClick={() => setActiveTab("main")}
                className={`px-6 py-2 rounded-md font-bold text-sm transition-all ${activeTab === 'main' ? 'bg-[#065bca] text-white shadow-sm' : 'text-theme-textSecondary hover:text-theme-text hover:bg-theme-bg'}`}
              >
                สนามหลัก (60 คน)
              </button>
              <button 
                onClick={() => setActiveTab("sub")}
                className={`px-6 py-2 rounded-md font-bold text-sm transition-all ${activeTab === 'sub' ? 'bg-[#065bca] text-white shadow-sm' : 'text-theme-textSecondary hover:text-theme-text hover:bg-theme-bg'}`}
              >
                สนามรอง ({Object.keys(data.members).length - 60 > 0 ? Object.keys(data.members).length - 60 : 0} คน)
              </button>
              {isAdmin && (
                <button 
                  onClick={() => setActiveTab("leave")}
                  className={`px-6 py-2 rounded-md font-bold text-sm transition-all ${activeTab === 'leave' ? 'bg-[#e74c3c] text-white shadow-sm' : 'text-theme-textSecondary hover:text-theme-text hover:bg-theme-bg'}`}
                >
                  ลา/ออฟไลน์
                </button>
              )}
            </div>

            <div className="flex-1">
              {activeTab === "main" ? (
                <div className="space-y-8 pb-12">
                  <div>
                    <h2 className="text-lg font-bold text-theme-text flex items-center gap-2 mb-4"><LayoutGrid size={18} className="text-[#065bca]"/> โซน 1 (ทีม 1-6)</h2>
                    <Droppable droppableId="mainZone1" direction="horizontal" type="TEAM">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 xl:gap-6">
                          {data.mainZone1Order.map((colId, index) => (
                            <TeamCard key={colId} column={data.columns[colId]} members={data.members} index={index} toggleLock={toggleLock} clearTeam={clearTeam} removeMember={removeMember} />
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-theme-text flex items-center gap-2 mb-4"><LayoutGrid size={18} className="text-[#065bca]"/> โซน 2 (ทีม 7-12)</h2>
                    <Droppable droppableId="mainZone2" direction="horizontal" type="TEAM">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 xl:gap-6">
                          {data.mainZone2Order.map((colId, index) => (
                            <TeamCard key={colId} column={data.columns[colId]} members={data.members} index={index} toggleLock={toggleLock} clearTeam={clearTeam} removeMember={removeMember} />
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                </div>
              ) : activeTab === "sub" ? (
                <div className="pb-12">
                   <h2 className="text-lg font-bold text-theme-text flex items-center gap-2 mb-4"><LayoutGrid size={18} className="text-theme-warning"/> ทีมสนามรอง</h2>
                   <Droppable droppableId="subZone" direction="horizontal" type="TEAM">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 xl:gap-6">
                          {data.subOrder.map((colId, index) => (
                            <TeamCard key={colId} column={data.columns[colId]} members={data.members} index={index} toggleLock={toggleLock} clearTeam={clearTeam} removeMember={removeMember} />
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                </div>
              ) : (
                  <div className="pb-12 space-y-12">
                    
                    {/* Offline Section */}
                    <div>
                      <h2 className="text-lg font-bold text-theme-danger flex items-center gap-2 mb-4">
                        <X size={18} /> รายชื่อผู้เล่นออฟไลน์
                      </h2>
                      <div className="bg-theme-panel rounded-xl border border-theme-border p-6 shadow-sm">
                        <div className="flex flex-col md:flex-row gap-4 mb-6">
                          <select
                            className="bg-theme-bg border border-theme-border rounded-lg px-4 py-2 flex-1 focus:ring-2 focus:ring-[#065bca] outline-none text-sm font-bold text-theme-text cursor-pointer"
                            onChange={(e) => {
                              if (e.target.value) {
                                markAsOffline(e.target.value);
                                e.target.value = "";
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="" disabled>+ เลือกรายชื่อเพื่อทำให้ออฟไลน์ (นำออกจากทีม)</option>
                            {Object.values(data.members)
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .filter(m => !data.offlineIds.includes(m.id))
                              .map(m => (
                                <option key={m.id} value={m.id}>{m.name} ({m.job})</option>
                              ))}
                          </select>
                        </div>

                        {data.offlineIds.length === 0 ? (
                          <div className="text-center py-8 text-theme-textMuted font-bold border-2 border-dashed border-theme-divider rounded-lg">
                            ไม่มีผู้เล่นที่ถูกทำเครื่องหมายว่าออฟไลน์
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-3">
                            {data.offlineIds.map(id => {
                              const m = data.members[id];
                              if (!m) return null;
                              return (
                                <div key={id} className="flex items-center gap-2 bg-theme-bg/80 border border-theme-border rounded-full py-1.5 pl-3 pr-1.5 shadow-sm">
                                  <span className="text-sm font-bold text-theme-text">{m.name}</span>
                                  <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: JOB_COLORS[m.job] || "#475569" }}>
                                    {m.job}
                                  </span>
                                  <button
                                    onClick={() => removeFromOffline(id)}
                                    className="p-1 hover:bg-theme-danger hover:text-white rounded-full text-theme-textSecondary transition-colors"
                                    title="นำกลับเข้าระบบ (ออนไลน์)"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Leave Records Section */}
                    <div>
                      <h2 className="text-lg font-bold text-theme-text flex items-center gap-2 mb-4">
                        <LayoutGrid size={18} className="text-[#065bca]" /> บันทึกการลาจากระบบแจ้งลา
                      </h2>
                      {leaveRecords.length === 0 ? (
                        <div className="text-center p-12 bg-theme-panel rounded-xl text-theme-textMuted border border-theme-border font-bold">
                          ไม่มีข้อมูลการลาในช่วงนี้
                        </div>
                      ) : (
                        <div className="bg-theme-panel rounded-xl border border-theme-border overflow-hidden">
                          <table className="w-full text-left">
                            <thead className="bg-theme-bg/50 border-b border-theme-divider text-xs uppercase tracking-wider text-theme-textMuted">
                              <tr>
                                <th className="p-4 font-bold">ชื่อในเกม</th>
                                <th className="p-4 font-bold">วันที่ลา</th>
                                <th className="p-4 font-bold">เหตุผล</th>
                                <th className="p-4 font-bold w-20 text-center">จัดการ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-theme-divider">
                              {leaveRecords.map((r: any, i) => (
                                <tr key={r.id || i} className="hover:bg-theme-bg/30">
                                  <td className="p-4 font-bold text-theme-text">{r.name}</td>
                                  <td className="p-4 font-bold text-theme-textSecondary">{r.date || r.day}</td>
                                  <td className="p-4 text-sm text-theme-textMuted">{r.reason || "-"}</td>
                                  <td className="p-4 text-center">
                                    <button
                                      onClick={async () => {
                                        if (confirm(`ต้องการลบรายการลาของ ${r.name} ใช่หรือไม่?`)) {
                                          try {
                                            await axios.delete('/api/leave', { data: { id: r.id } });
                                            setLeaveRecords(prev => prev.filter(rec => rec.id !== r.id));
                                          } catch (err) {
                                            alert("ลบไม่สำเร็จ");
                                          }
                                        }
                                      }}
                                      className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"
                                      title="ลบรายการ"
                                    >
                                      <X size={16} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
              )}
            </div>
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}

function TeamCard({ column, members, index, toggleLock, clearTeam, removeMember }: { column: Column; members: Record<string, Member>; index: number; toggleLock: (id: string) => void; clearTeam: (id: string) => void; removeMember: (colId: string, memId: string) => void; }) {
  const isFull = column.memberIds.filter(id => id).length === 5;
  const totalPower = column.memberIds.reduce((sum, id) => sum + (id ? (members[id]?.power || 0) : 0), 0);

  return (
    <Draggable draggableId={column.id} index={index}>
      {(providedTeam, snapshotTeam) => (
        <div ref={providedTeam.innerRef} {...providedTeam.draggableProps} className={`bg-theme-panel rounded-xl shadow-md border overflow-hidden ${snapshotTeam.isDragging ? 'shadow-xl ring-2 ring-[#065bca] border-[#065bca] z-50' : 'border-theme-border'} ${column.locked ? 'opacity-90 border-[#f59e0b]' : ''}`}>
          <div className="bg-[#1C6BA0] p-3 text-white flex items-center justify-between" {...providedTeam.dragHandleProps}>
            <div className="flex items-center gap-2">
              <GripVertical size={16} className="opacity-50 cursor-grab active:cursor-grabbing" />
              <h3 className="font-bold text-sm tracking-wide">{column.title}</h3>
              <span className="text-xs bg-black/20 px-2 py-0.5 rounded font-mono">{totalPower.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isFull ? 'bg-[#50b1e5] text-white' : 'bg-white/20 text-white'}`}>
                {isFull ? 'ครบ 5/5' : `${column.memberIds.filter(id => id).length}/5`}
              </span>
              <button onClick={() => toggleLock(column.id)} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${column.locked ? 'bg-[#F1C40F] text-black' : 'bg-black/20 hover:bg-black/40 text-white'}`}>
                {column.locked ? <Lock size={12}/> : <Unlock size={12}/>} {column.locked ? 'ล็อก' : 'ปลดล็อก'}
              </button>
              <button onClick={() => clearTeam(column.id)} className="bg-[#E74C3C] hover:bg-red-600 text-white p-1 rounded transition-colors disabled:opacity-50" disabled={column.locked} title="ลล้างทีม">
                <X size={12} strokeWidth={3}/>
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-[30px_1fr_120px_70px_30px] gap-2 px-3 py-2 bg-theme-bg/50 border-b border-theme-border text-[11px] font-bold text-theme-textSecondary">
            <div></div>
            <div>ชื่อ</div>
            <div className="text-center">อาชีพ</div>
            <div className="text-right">ค่าพลัง</div>
            <div></div>
          </div>

          <div className="p-2 min-h-[220px] flex flex-col gap-1.5 relative z-10">
             {Array.from({ length: 5 }).map((_, slotIdx) => {
                const memberId = column.memberIds[slotIdx];
                const droppableId = `${column.id}::${slotIdx}`;
                return (
                  <Droppable key={droppableId} droppableId={droppableId} type="MEMBER" isDropDisabled={column.locked}>
                    {(provided, snapshot) => (
                      <div 
                        ref={provided.innerRef} 
                        {...provided.droppableProps} 
                        className={`h-[34px] rounded border ${snapshot.isDraggingOver ? 'bg-[#065bca]/20 border-[#065bca]' : 'border-transparent bg-theme-bg/30'} flex items-center relative transition-colors`}
                      >
                         {!memberId && !snapshot.isDraggingOver && (
                           <div className="absolute inset-0 border border-dashed border-theme-border/50 rounded flex items-center justify-center bg-transparent pointer-events-none">
                             <span className="text-[10px] text-theme-textMuted font-bold tracking-widest">ว่าง {slotIdx + 1}</span>
                           </div>
                         )}

                         {memberId && (
                           <Draggable draggableId={memberId} index={0} isDragDisabled={column.locked}>
                             {(prov, snap) => {
                                const m = members[memberId];
                                const color = m ? (JOB_COLORS[m.job] || "#475569") : "#475569";
                                return (
                                  <div ref={prov.innerRef} {...prov.draggableProps} className={`absolute inset-0 w-full h-full grid grid-cols-[30px_1fr_120px_70px_30px] gap-2 items-center px-1 py-1 rounded bg-theme-panel hover:bg-theme-bg/90 group ${snap.isDragging ? 'shadow-lg border-theme-border ring-1 ring-[#065bca]/20 z-50' : 'shadow-sm border-theme-border'}`} style={prov.draggableProps.style}>
                                    <div className="flex items-center justify-center text-theme-textMuted cursor-grab" {...prov.dragHandleProps}><GripVertical size={14}/></div>
                                    <div className="text-xs font-bold text-theme-text truncate flex items-center gap-2"><span className="text-[#065bca] opacity-70 w-3 text-right">{slotIdx+1}</span>{m ? m.name : "Unknown"}</div>
                                    {m && <div className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full text-center truncate" style={{backgroundColor: color}}>{m.job}</div>}
                                    {m && <div className="text-[11px] font-bold text-theme-textSecondary text-right tabular-nums">{m.power.toLocaleString()}</div>}
                                    <button onClick={() => removeMember(column.id, memberId)} disabled={column.locked} className="text-theme-textMuted hover:text-theme-danger opacity-0 group-hover:opacity-100 transition-opacity flex justify-center disabled:hidden"><X size={14}/></button>
                                  </div>
                                )
                             }}
                           </Draggable>
                         )}
                         <div className="hidden">{provided.placeholder}</div>
                      </div>
                    )}
                  </Droppable>
                )
             })}
          </div>
        </div>
      )}
    </Draggable>
  );
}

function MemberCard({ member, index }: { member: Member; index: number; }) {
  const color = JOB_COLORS[member.job] || "#475569";
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
            snapshot.isDragging ? 'shadow-lg border-[#065bca] z-50 ring-2 ring-[#065bca]/20' : 'border-theme-border hover:border-theme-borderHover'
          }`}
          style={{
            ...provided.draggableProps.style,
            backgroundColor: snapshot.isDragging ? 'var(--theme-panel)' : hexToRgba(color, 0.04),
            borderLeftWidth: '4px',
            borderLeftColor: color
          }}
        >
          <div className="flex flex-col truncate pr-2 min-w-0">
            <span className="text-[12px] font-bold text-theme-text truncate">{member.name}</span>
            <span className="text-[9px] font-bold truncate opacity-80" style={{ color }}>{member.job}</span>
          </div>
          <div className="text-[11px] font-bold tabular-nums tracking-tight flex-shrink-0" style={{ color }}>
            {member.power.toLocaleString()}
          </div>
        </div>
      )}
    </Draggable>
  );
}
