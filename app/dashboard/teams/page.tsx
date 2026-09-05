"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Shield, Users, Save, Loader2, GripVertical, Lock, Unlock, X, ChevronLeft, ChevronRight, LayoutGrid, RefreshCw, Wand2, ChevronDown } from "lucide-react";
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
  
  const [unassignedSearch, setUnassignedSearch] = useState("");
  const [offlineSearch, setOfflineSearch] = useState("");
  const [isOfflineDropdownOpen, setIsOfflineDropdownOpen] = useState(false);
  const offlineDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    fetchData();

    function handleClickOutside(event: MouseEvent) {
      if (offlineDropdownRef.current && !offlineDropdownRef.current.contains(event.target as Node)) {
        setIsOfflineDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
    if (unassignedFilterJob !== "All" && data.members[id]?.job !== unassignedFilterJob) return false;
    if (unassignedSearch && !data.members[id]?.name.toLowerCase().includes(unassignedSearch.toLowerCase())) return false;
    return true;
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
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg p-3 text-sm text-[#0b3d63] dark:text-white flex items-start gap-2">
              <span className="font-bold">✨ คำแนะนำ:</span> จำนวนที่ดึงอัตโนมัติ จะคัดเลือกมี Priest 12 คนสำหรับสนามหลักให้อัตโนมัติ
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-theme-text">ตรวจพบรายชื่อ: {names.length} / 60 คน</span>
              <button onClick={handlePullTop60} className="text-[#0b3d63] dark:text-white font-bold text-sm bg-[#0b3d63]/10 dark:bg-[#3B66D1]/20 px-4 py-1.5 rounded-lg hover:bg-[#0b3d63]/20 dark:hover:bg-[#4D73CD]/25 transition-colors border border-[#0b3d63]/20 dark:border-[#4D73CD]/40 flex items-center gap-1">
                ✨ ดึง 60 พลังสูงสุดมาวางให้ก่อน
              </button>
            </div>
            <textarea 
              className="w-full h-[250px] bg-theme-bg border border-theme-border rounded-lg p-3 text-sm text-theme-text font-mono resize-none focus:ring-2 focus:ring-[#4D73CD] dark:focus:ring-[#4D73CD] outline-none"
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
    <div className="space-y-6 bg-[#f0f6fc] dark:bg-[#1C1F27] min-h-screen p-4 lg:py-6 lg:px-6 2xl:px-8 relative" style={{ zoom: 0.85 }}>
      <AutoMatchModal />
      
      {/* Header Card */}
      <div className="bg-white dark:bg-[#232733] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] p-5 mb-5 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#0b3d63] dark:bg-[#3B66D1] shadow-sm"
          >
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">จัดทีม GVG</h1>
            <p className="text-sm text-slate-500 dark:text-[#8B93A7]">
              {isAdmin ? "ลากและวางเพื่อจัดทีม หรือใช้ออโต้แมตช์" : "รายชื่อและสมาชิกทีมสำหรับกิลด์วอร์"}
            </p>
          </div>
        </div>
        
        {isAdmin && (
          <div className="flex items-center gap-3 w-full lg:w-auto justify-end flex-wrap">
            <button onClick={handleClearAll} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#272C38] text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-xl font-bold hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-sm shadow-sm">
              <span>ล้างทั้งหมด</span>
            </button>
            <button onClick={() => setIsAutoModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#272C38] text-[#0b3d63] dark:text-white border border-[#0b3d63] dark:border-[#4D73CD] rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-sky-950/30 transition-colors text-sm shadow-sm">
              <Wand2 size={16} /> <span>ออโต้จัดทีม (Auto)</span>
            </button>
            <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-5 py-2 bg-[#3B66D1] hover:bg-[#4D73CD] text-white rounded-xl font-bold transition-colors shadow-sm disabled:opacity-50 text-sm">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} <span>บันทึกการจัดทีม</span>
            </button>
          </div>
        )}
      </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 items-start">
            {isAdmin && !isUnassignedCollapsed && (
              <div className="w-[260px] 2xl:w-[280px] flex-shrink-0 bg-white dark:bg-[#232733] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] h-[calc(100vh-2rem)] flex flex-col sticky top-4 z-20 transition-all">
                <div className="p-3 border-b border-slate-100 dark:border-[#2D3342] bg-slate-50/70 dark:bg-[#272C38]/50 rounded-t-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm"><Users size={16} /> ยังไม่ได้จัด ({data.columns["unassigned"].memberIds.length})</h2>
                    <button onClick={() => setIsUnassignedCollapsed(true)} className="text-slate-400 dark:text-[#8B93A7] hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-[#272C38] border border-slate-200 dark:border-[#2D3342] rounded-lg p-1"><ChevronLeft size={14}/></button>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อ..."
                      value={unassignedSearch}
                      onChange={e => setUnassignedSearch(e.target.value)}
                      className="w-full bg-white dark:bg-[#272C38] border border-slate-200 dark:border-[#2D3342] rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#6B7280] outline-none focus:ring-2 focus:ring-[#4D73CD] dark:focus:ring-[#4D73CD]"
                    />
                    <select 
                      value={unassignedFilterJob} 
                      onChange={e => setUnassignedFilterJob(e.target.value)}
                      className="w-full bg-white dark:bg-[#272C38] border border-slate-200 dark:border-[#2D3342] rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-white outline-none"
                    >
                      <option value="All">ทุกอาชีพ</option>
                      {JOB_LIST.map(j => <option key={j} value={j}>{j}</option>)}
                    </select>
                  </div>
                </div>
                
                <Droppable droppableId="unassigned" type="MEMBER">
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className={`flex-1 overflow-y-auto p-2 space-y-1.5 transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50/50 dark:bg-[#3B66D1]/25' : ''}`}>
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
              <div className="flex-shrink-0 bg-white dark:bg-[#232733] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] h-[calc(100vh-2rem)] flex flex-col items-center py-4 sticky top-4 z-10 w-12 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#2A2F3E] transition-colors" onClick={() => setIsUnassignedCollapsed(false)}>
                <ChevronRight size={20} className="text-slate-400 mb-4"/>
                <Users size={18} className="text-slate-400 mb-2"/>
                <span className="bg-[#0b3d63] dark:bg-[#3B66D1] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{data.columns["unassigned"].memberIds.length}</span>
              </div>
            )}

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex gap-2 mb-4 bg-white dark:bg-[#232733] p-1.5 rounded-xl border border-slate-200 dark:border-[#2D3342] shadow-sm self-start">
              <button 
                onClick={() => setActiveTab("main")}
                className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'main' ? 'bg-[#0b3d63] dark:bg-[#3B66D1] text-white shadow-sm' : 'text-slate-600 dark:text-white hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#2A2F3E]'}`}
              >
                สนามหลัก (60 คน)
              </button>
              <button 
                onClick={() => setActiveTab("sub")}
                className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'sub' ? 'bg-[#0b3d63] dark:bg-[#3B66D1] text-white shadow-sm' : 'text-slate-600 dark:text-white hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#2A2F3E]'}`}
              >
                สนามรอง ({Object.keys(data.members).length - 60 > 0 ? Object.keys(data.members).length - 60 : 0} คน)
              </button>
              {isAdmin && (
                <button 
                  onClick={() => setActiveTab("leave")}
                  className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'leave' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 dark:text-white hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#2A2F3E]'}`}
                >
                  ลา/ออฟไลน์
                </button>
              )}
            </div>

            <div className="flex-1">
              {activeTab === "main" ? (
                <div className="space-y-8 pb-12">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4"><LayoutGrid size={18} className="text-[#0b3d63] dark:text-white"/> โซน 1 (ทีม 1-6)</h2>
                    <Droppable droppableId="mainZone1" direction="horizontal" type="TEAM" isDropDisabled={!isAdmin}>
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 xl:gap-6">
                          {data.mainZone1Order.map((colId, index) => (
                            <TeamCard key={colId} column={data.columns[colId]} members={data.members} index={index} toggleLock={toggleLock} clearTeam={clearTeam} removeMember={removeMember} isAdmin={isAdmin} />
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4"><LayoutGrid size={18} className="text-[#0b3d63] dark:text-white"/> โซน 2 (ทีม 7-12)</h2>
                    <Droppable droppableId="mainZone2" direction="horizontal" type="TEAM" isDropDisabled={!isAdmin}>
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 xl:gap-6">
                          {data.mainZone2Order.map((colId, index) => (
                            <TeamCard key={colId} column={data.columns[colId]} members={data.members} index={index} toggleLock={toggleLock} clearTeam={clearTeam} removeMember={removeMember} isAdmin={isAdmin} />
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                </div>
              ) : activeTab === "sub" ? (
                <div className="pb-12">
                   <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4"><LayoutGrid size={18} className="text-[#0b3d63] dark:text-white"/> ทีมสนามรอง</h2>
                   <Droppable droppableId="subZone" direction="horizontal" type="TEAM" isDropDisabled={!isAdmin}>
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 xl:gap-6">
                          {data.subOrder.map((colId, index) => (
                            <TeamCard key={colId} column={data.columns[colId]} members={data.members} index={index} toggleLock={toggleLock} clearTeam={clearTeam} removeMember={removeMember} isAdmin={isAdmin} />
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
                          <div className="relative flex-1" ref={offlineDropdownRef}>
                            <div 
                              className="bg-theme-bg border border-theme-border rounded-lg px-4 py-2 flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-[#0b3d63]"
                              onClick={() => setIsOfflineDropdownOpen(true)}
                            >
                              <input
                                type="text"
                                placeholder="+ ค้นหารายชื่อผู้เล่นเพื่อทำให้ออฟไลน์ (นำออกจากทีม)..."
                                className="bg-transparent border-none outline-none text-sm font-bold text-theme-text w-full"
                                value={offlineSearch}
                                onChange={e => {
                                  setOfflineSearch(e.target.value);
                                  setIsOfflineDropdownOpen(true);
                                }}
                                onFocus={() => setIsOfflineDropdownOpen(true)}
                              />
                            </div>

                            {isOfflineDropdownOpen && (
                              <div className="absolute z-50 w-full mt-2 bg-theme-panel border border-theme-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                {Object.values(data.members)
                                  .filter(m => !data.offlineIds.includes(m.id))
                                  .filter(m => m.name.toLowerCase().includes(offlineSearch.toLowerCase()) || m.job.toLowerCase().includes(offlineSearch.toLowerCase()))
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(m => (
                                    <div 
                                      key={m.id} 
                                      className="px-4 py-2.5 hover:bg-theme-bg cursor-pointer text-sm font-bold text-theme-text flex justify-between items-center border-b border-theme-divider last:border-0"
                                      onClick={() => {
                                        markAsOffline(m.id);
                                        setOfflineSearch("");
                                        setIsOfflineDropdownOpen(false);
                                      }}
                                    >
                                      <span>{m.name}</span>
                                      <span className="text-[10px] text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: JOB_COLORS[m.job] || "#475569" }}>{m.job}</span>
                                    </div>
                                  ))}
                                  
                                {Object.values(data.members).filter(m => !data.offlineIds.includes(m.id) && (m.name.toLowerCase().includes(offlineSearch.toLowerCase()) || m.job.toLowerCase().includes(offlineSearch.toLowerCase()))).length === 0 && (
                                  <div className="px-4 py-4 text-sm font-bold text-theme-textMuted text-center bg-theme-bg/50">ไม่พบรายชื่อ</div>
                                )}
                              </div>
                            )}
                          </div>
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
                        <LayoutGrid size={18} className="text-[#0b3d63]" /> บันทึกการลาจากระบบแจ้งลา
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

function TeamCard({ 
  column, 
  members, 
  index, 
  toggleLock, 
  clearTeam, 
  removeMember,
  isAdmin = false
}: { 
  column: Column; 
  members: Record<string, Member>; 
  index: number; 
  toggleLock: (id: string) => void; 
  clearTeam: (id: string) => void; 
  removeMember: (colId: string, memId: string) => void; 
  isAdmin?: boolean;
}) {
  const isFull = column.memberIds.filter(id => id).length === 5;
  const totalPower = column.memberIds.reduce((sum, id) => sum + (id ? (members[id]?.power || 0) : 0), 0);
  const isSub = column.type === "sub";

  return (
    <Draggable draggableId={column.id} index={index} isDragDisabled={!isAdmin}>
      {(providedTeam, snapshotTeam) => (
        <div ref={providedTeam.innerRef} {...providedTeam.draggableProps} className={`bg-white dark:bg-[#232733] rounded-2xl shadow-sm border overflow-hidden ${snapshotTeam.isDragging ? 'shadow-xl ring-2 ring-[#0b3d63] dark:ring-[#4D73CD] border-[#0b3d63] dark:border-[#4D73CD] z-50' : 'border-slate-200 dark:border-[#2D3342]'} ${column.locked ? 'opacity-95 border-amber-400 dark:border-amber-500' : ''}`}>
          {/* Header */}
          <div className={`${isSub ? 'bg-[#154a72] dark:bg-[#1E2536]' : 'bg-[#0b3d63] dark:bg-[#252E42]'} p-3.5 text-white flex items-center justify-between border-b border-transparent dark:border-[#2D3342]`} {...(isAdmin ? providedTeam.dragHandleProps : {})}>
            <div className="flex items-center gap-2">
              {isAdmin && <GripVertical size={16} className="opacity-50 cursor-grab active:cursor-grabbing" />}
              <h3 className="font-bold text-sm tracking-wide">{column.title}</h3>
              <span className="text-xs bg-black/20 px-2 py-0.5 rounded-md font-mono">{totalPower.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isFull ? 'bg-emerald-500 text-white' : 'bg-white/20 text-white'}`}>
                {isFull ? 'ครบ 5/5' : `${column.memberIds.filter(id => id).length}/5`}
              </span>
              {isAdmin && (
                <>
                  <button onClick={() => toggleLock(column.id)} className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${column.locked ? 'bg-amber-400 text-slate-900 shadow-sm' : 'bg-white/15 hover:bg-white/25 text-white'}`}>
                    {column.locked ? <Lock size={12}/> : <Unlock size={12}/>} {column.locked ? 'ล็อก' : 'ปลดล็อก'}
                  </button>
                  <button onClick={() => clearTeam(column.id)} className="bg-red-500/80 hover:bg-red-600 text-white p-1 rounded-md transition-colors disabled:opacity-40" disabled={column.locked} title="ล้างทีม">
                    <X size={12} strokeWidth={3}/>
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div className={`grid ${isAdmin ? 'grid-cols-[36px_minmax(0,1fr)_115px_60px_24px]' : 'grid-cols-[36px_minmax(0,1fr)_115px_60px]'} gap-2 px-3 py-2 bg-slate-50 dark:bg-[#272C38]/60 border-b border-slate-100 dark:border-[#2D3342] text-[11px] font-bold text-slate-500 dark:text-[#8B93A7]`}>
            <div></div>
            <div>ชื่อ</div>
            <div className="text-center">อาชีพ</div>
            <div className="text-right">ค่าพลัง</div>
            {isAdmin && <div></div>}
          </div>

          <div className="p-2 min-h-[220px] flex flex-col gap-1.5 relative bg-white dark:bg-[#232733]">
             {Array.from({ length: 5 }).map((_, slotIdx) => {
                const memberId = column.memberIds[slotIdx];
                const droppableId = `${column.id}::${slotIdx}`;
                return (
                  <Droppable key={droppableId} droppableId={droppableId} type="MEMBER" isDropDisabled={!isAdmin || column.locked}>
                    {(provided, snapshot) => (
                      <div 
                        ref={provided.innerRef} 
                        {...provided.droppableProps} 
                        className={`h-[38px] rounded-xl border ${snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-[#3B66D1]/25 border-[#0b3d63] dark:border-[#4D73CD]' : 'border-transparent bg-slate-50/70 dark:bg-[#272C38]/40'} flex items-center relative transition-colors`}
                      >
                         {!memberId && !snapshot.isDraggingOver && (
                           <div className="absolute inset-0 border border-dashed border-slate-200 dark:border-[#2D3342] rounded-xl flex items-center justify-center bg-transparent pointer-events-none">
                             <span className="text-[10px] text-slate-400 dark:text-[#6B7280] font-bold tracking-wider">ว่าง {slotIdx + 1}</span>
                           </div>
                         )}

                         {memberId && (
                           <Draggable draggableId={memberId} index={0} isDragDisabled={!isAdmin || column.locked}>
                             {(prov, snap) => {
                                const m = members[memberId];
                                const color = m ? (JOB_COLORS[m.job] || "#475569") : "#475569";
                                const rowContent = (
                                  <div 
                                    ref={prov.innerRef} 
                                    {...prov.draggableProps} 
                                    className={`w-full h-[38px] grid ${isAdmin ? 'grid-cols-[36px_minmax(0,1fr)_115px_60px_24px]' : 'grid-cols-[36px_minmax(0,1fr)_115px_60px]'} gap-2 items-center px-2 py-1 rounded-xl bg-white dark:bg-[#272C38] hover:bg-slate-50 dark:hover:bg-[#2A2F3E] group border border-slate-100 dark:border-[#2D3342] ${snap.isDragging ? 'shadow-2xl border-blue-400 dark:border-[#4D73CD] ring-2 ring-[#0b3d63]/20 dark:ring-[#4D73CD]/20 z-[99999]' : 'shadow-xs'}`} 
                                    style={prov.draggableProps.style}
                                  >
                                    <div className="flex items-center gap-1 text-slate-400 dark:text-[#6B7280] cursor-grab" {...(isAdmin ? prov.dragHandleProps : {})}>
                                      {isAdmin ? <GripVertical size={14} className="text-sky-300 dark:text-sky-400 shrink-0" /> : null}
                                      <span className="text-xs font-bold text-sky-500 font-mono w-3 text-center">{slotIdx + 1}</span>
                                    </div>
                                    <div className="min-w-0 pr-1">
                                      <span className="text-xs font-bold text-slate-800 dark:text-white truncate block" title={m?.name}>{m ? m.name : "Unknown"}</span>
                                    </div>
                                    {m && (
                                      <div 
                                        className="h-[26px] px-3 rounded-full text-xs font-bold text-white flex items-center justify-center gap-1 shadow-sm shrink-0 w-[115px]" 
                                        style={{ backgroundColor: color }}
                                      >
                                        <span className="truncate">{m.job}</span>
                                        <ChevronDown size={11} className="opacity-80 shrink-0 stroke-[2.5]" />
                                      </div>
                                    )}
                                    {m && <div className="text-xs font-bold text-[#0b3d63] dark:text-white text-right tabular-nums shrink-0">{m.power.toLocaleString()}</div>}
                                    {isAdmin && (
                                      <button 
                                        onClick={() => removeMember(column.id, memberId)} 
                                        disabled={column.locked} 
                                        className="text-sky-300 hover:text-red-500 dark:text-sky-400 dark:hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity flex justify-center disabled:hidden"
                                        title="นำออกจากทีม"
                                      >
                                        <X size={15} strokeWidth={2.5} />
                                      </button>
                                    )}
                                  </div>
                                );

                                if (snap.isDragging && typeof document !== "undefined") {
                                  return createPortal(rowContent, document.body);
                                }
                                return rowContent;
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
      {(provided, snapshot) => {
        const content = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={`flex items-center justify-between p-2 rounded-xl border shadow-sm select-none transition-all ${
              snapshot.isDragging
                ? 'shadow-2xl border-[#0b3d63] dark:border-[#4D73CD] z-[99999] ring-2 ring-[#0b3d63]/20 dark:ring-[#4D73CD]/20 bg-white dark:bg-[#272C38]'
                : 'border-slate-200 dark:border-[#2D3342] hover:border-slate-300 dark:hover:border-slate-600'
            }`}
            style={{
              ...provided.draggableProps.style,
              backgroundColor: snapshot.isDragging ? undefined : hexToRgba(color, 0.05),
              borderLeftWidth: '4px',
              borderLeftColor: color
            }}
          >
            <div className="flex flex-col truncate pr-2 min-w-0">
              <span className="text-[12px] font-bold text-slate-800 dark:text-white truncate">{member.name}</span>
              <span className="text-[9px] font-bold truncate opacity-90" style={{ color }}>{member.job}</span>
            </div>
            <div className="text-[11px] font-bold tabular-nums tracking-tight flex-shrink-0" style={{ color }}>
              {member.power.toLocaleString()}
            </div>
          </div>
        );

        if (snapshot.isDragging && typeof document !== "undefined") {
          return createPortal(content, document.body);
        }
        return content;
      }}
    </Draggable>
  );
}
