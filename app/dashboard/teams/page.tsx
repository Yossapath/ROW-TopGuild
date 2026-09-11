"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Shield, Users, Loader2, GripVertical, Lock, Unlock, X, ChevronLeft, ChevronRight, LayoutGrid, Wand2, ChevronDown, Plus, Trash2, Edit2, Check, CheckCircle2, Search, Download } from "lucide-react";
import axios from "axios";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { JOB_COLORS, JOB_LIST } from "@/lib/utils";
import { useAuthStore } from "@/stores/useAuthStore";
import { allocateTeams, AllocatorResult } from "@/lib/team-allocator";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

type Member = { id: string; name: string; job: string; power: number };
type Column = { id: string; title: string; memberIds: (string | null)[]; type: "main" | "sub" | "unassigned"; locked: boolean };
type Zone = { id: string; name: string; type: "main" | "sub"; teamOrder: string[] };
type DataState = {
  members: Record<string, Member>;
  columns: Record<string, Column>;
  zones: Zone[];
  offlineIds: string[];
};

const genId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function buildDefaultColumns(prefix: string, type: "main" | "sub", count: number, startNum: number, cols: Record<string, Column>) {
  const order: string[] = [];
  for (let i = 0; i < count; i++) {
    const num = startNum + i;
    const id = `${prefix}-${num}`;
    order.push(id);
    if (!cols[id]) {
      cols[id] = { id, title: type === "main" ? `ทีม ${num}` : `ทีมรอง ${num}`, memberIds: [null, null, null, null, null], type, locked: false };
    }
  }
  return order;
}

function migrateToZones(savedData: any, cols: Record<string, Column>): Zone[] {
  if (savedData?.zones && Array.isArray(savedData.zones) && savedData.zones.length > 0) {
    const hasSub = (savedData.zones as Zone[]).some(z => z.type === "sub");
    if (!hasSub) {
      return [...(savedData.zones as Zone[]), { id: "zone-sub-1", name: "สนามรอง", type: "sub", teamOrder: [] }];
    }
    return savedData.zones as Zone[];
  }
  const zones: Zone[] = [];
  const z1 = savedData?.mainZone1Order ?? [];
  const z2 = savedData?.mainZone2Order ?? [];
  const sub = savedData?.subOrder ?? [];
  zones.push({ id: "zone-main-1", name: "โซน 1", type: "main", teamOrder: z1.length > 0 ? z1 : buildDefaultColumns("main", "main", 6, 1, cols) });
  zones.push({ id: "zone-main-2", name: "โซน 2", type: "main", teamOrder: z2.length > 0 ? z2 : buildDefaultColumns("main", "main", 6, 7, cols) });
  zones.push({ id: "zone-sub-1", name: "สนามรอง", type: "sub", teamOrder: sub.length > 0 ? sub : buildDefaultColumns("sub", "sub", 6, 1, cols) });
  return zones;
}

export default function TeamsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const [data, setData] = useState<DataState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveErrorMsg, setSaveErrorMsg] = useState("");
  const initialLoadRef = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [activeTab, setActiveTab] = useState<"main" | "sub" | "leave">("main");
  const [unassignedFilterJobs, setUnassignedFilterJobs] = useState<string[]>([]);
  const [isJobFilterOpen, setIsJobFilterOpen] = useState(false);
  const jobFilterDropdownRef = useRef<HTMLDivElement>(null);
  const [isUnassignedCollapsed, setIsUnassignedCollapsed] = useState(false);
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
  const [autoModalText, setAutoModalText] = useState("");
  const [previewResult, setPreviewResult] = useState<AllocatorResult | null>(null);
  const [leaveRecords, setLeaveRecords] = useState<any[]>([]);
  const [unassignedSearch, setUnassignedSearch] = useState("");
  const [offlineSearch, setOfflineSearch] = useState("");
  const [isOfflineDropdownOpen, setIsOfflineDropdownOpen] = useState(false);
  const offlineDropdownRef = useRef<HTMLDivElement>(null);

  // Player search feature
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");

  // Zone editing state
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingZoneName, setEditingZoneName] = useState("");

  const exportContainerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!exportContainerRef.current) return;
    setIsExporting(true);
    try {
      const element = exportContainerRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: document.documentElement.classList.contains("dark") ? "#1C1F27" : "#f0f6fc",
      });
      
      const imgData = canvas.toDataURL("image/jpeg", 1.0);
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height);
      const dateStr = new Date().toISOString().split('T')[0];
      pdf.save(`gvg-teams-${dateStr}.pdf`);
    } catch (err) {
      console.error("Failed to export PDF", err);
      alert("เกิดข้อผิดพลาดในการสร้าง PDF");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchData();
    function handleClickOutside(event: MouseEvent) {
      if (offlineDropdownRef.current && !offlineDropdownRef.current.contains(event.target as Node)) setIsOfflineDropdownOpen(false);
      if (jobFilterDropdownRef.current && !jobFilterDropdownRef.current.contains(event.target as Node)) setIsJobFilterOpen(false);
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
      if (leaveRes.data) setLeaveRecords(leaveRes.data.data || leaveRes.data || []);

      if (rosterPayload.ok && rosterPayload.data) {
        Object.entries(rosterPayload.data).forEach(([jobName, members]: [string, any]) => {
          if (Array.isArray(members)) {
            members.forEach(m => { 
              // Parse power safely (remove commas, handle NaN)
              let parsedPower = typeof m.power === 'string' ? Number(m.power.replace(/,/g, '')) : Number(m.power);
              if (isNaN(parsedPower)) parsedPower = 0;
              membersMap[m.name] = { id: m.name, name: m.name, job: jobName, power: parsedPower }; 
            });
          }
        });
      }

      const cols: Record<string, Column> = {};
      let zones: Zone[] = [];
      let unassignedMembers = new Set(Object.keys(membersMap));
      const offlineIds: string[] = savedTeams?.offlineIds || [];

      if (savedTeams && savedTeams.columns) {
        // New format
        Object.assign(cols, savedTeams.columns);
        zones = migrateToZones(savedTeams, cols);
      } else if (savedTeams && savedTeams.data && Array.isArray(savedTeams.data)) {
        // Legacy API format
        const processGroup = (groupsObj: any, prefix: string, type: "main" | "sub") => {
          const order: string[] = [];
          let num = 1;
          Object.keys(groupsObj).sort((a, b) => (parseInt(a.replace(/\D/g, "")) || 0) - (parseInt(b.replace(/\D/g, "")) || 0)).forEach(teamKey => {
            const colId = `${prefix}-${num}`;
            order.push(colId);
            const validIds: (string | null)[] = [null, null, null, null, null];
            (groupsObj[teamKey] as any[]).forEach((m, idx) => {
              if (idx < 5 && m && m.name && membersMap[m.name]) { validIds[idx] = m.name; unassignedMembers.delete(m.name); }
            });
            cols[colId] = { id: colId, title: `${type === "main" ? "ทีม" : "ทีมรอง"} ${num}`, memberIds: validIds, type, locked: false };
            num++;
          });
          return order;
        };
        const allMain = processGroup(savedTeams.data[0]?.teams || {}, "main", "main");
        const subOrder = processGroup(savedTeams.data[1]?.teams || {}, "sub", "sub");
        zones = [
          { id: "zone-main-1", name: "โซน 1", type: "main", teamOrder: allMain.slice(0, 6) },
          { id: "zone-main-2", name: "โซน 2", type: "main", teamOrder: allMain.slice(6, 12) },
          { id: "zone-sub-1", name: "สนามรอง", type: "sub", teamOrder: subOrder },
        ];
      } else if (savedTeams && savedTeams.main && savedTeams.main.length > 0) {
        // Semi-new format
        const createCols = (groups: any[][], prefix: string, type: "main" | "sub", startIdx = 1) => {
          const order: string[] = [];
          groups.forEach((group, idx) => {
            const num = startIdx + idx;
            const colId = `${prefix}-${num}`;
            order.push(colId);
            const validIds: (string | null)[] = [null, null, null, null, null];
            group.forEach((m: any, mIdx: number) => {
              if (mIdx < 5 && m && m.name && membersMap[m.name]) { validIds[mIdx] = m.name; unassignedMembers.delete(m.name); }
            });
            cols[colId] = { id: colId, title: `${type === "main" ? "ทีม" : "ทีมรอง"} ${num}`, memberIds: validIds, type, locked: false };
          });
          return order;
        };
        const allMain = createCols(savedTeams.main || [], "main", "main", 1);
        const subOrder = createCols(savedTeams.sub || [], "sub", "sub", 1);
        zones = migrateToZones({ mainZone1Order: allMain.slice(0, 6), mainZone2Order: allMain.slice(6, 12), subOrder }, cols);
      } else {
        zones = migrateToZones({}, cols);
      }

      if (!cols["unassigned"]) cols["unassigned"] = { id: "unassigned", title: "ยังไม่ได้จัดทีม", memberIds: [], type: "unassigned", locked: false };

      const assignedIds = new Set<string>();
      zones.forEach(z => z.teamOrder.forEach(colId => {
        if (cols[colId]) cols[colId].memberIds.forEach(id => { if (id) assignedIds.add(id); });
      }));

      const unassignedIds = Object.keys(membersMap).filter(id => !assignedIds.has(id) && !offlineIds.includes(id));
      cols["unassigned"] = { id: "unassigned", title: "ยังไม่ได้จัดทีม", memberIds: unassignedIds, type: "unassigned", locked: false };

      if (offlineIds.length > 0) {
        Object.keys(cols).forEach(colId => {
          if (colId === "unassigned") return;
          cols[colId].memberIds = cols[colId].memberIds.map(id => (id && offlineIds.includes(id) ? null : id));
        });
      }

      setData({ members: membersMap, columns: cols, zones, offlineIds });
    } catch {
      alert("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = useCallback(async (currentData: DataState) => {
    if (!isAdmin) return;
    setSaveStatus("saving");
    try {
      const mainZones = currentData.zones.filter(z => z.type === "main");
      const subZones = currentData.zones.filter(z => z.type === "sub");
      const payload = {
        members: currentData.members,
        columns: currentData.columns,
        zones: currentData.zones,
        mainZone1Order: mainZones[0]?.teamOrder || [],
        mainZone2Order: mainZones[1]?.teamOrder || [],
        subOrder: subZones.flatMap(z => z.teamOrder),
        offlineIds: currentData.offlineIds,
        data: [
          {
            title: "สนามหลัก",
            teams: mainZones.flatMap(z => z.teamOrder).reduce((acc, colId, idx) => {
              const col = currentData.columns[colId];
              acc[`ทีม ${idx + 1}`] = col ? col.memberIds.map(id => id && currentData.members[id] ? currentData.members[id] : { name: "", job: "", power: 0 }) : Array(5).fill({ name: "", job: "", power: 0 });
              return acc;
            }, {} as Record<string, any>)
          },
          {
            title: "สนามรอง",
            teams: subZones.flatMap(z => z.teamOrder).reduce((acc, colId, idx) => {
              const col = currentData.columns[colId];
              acc[`ทีมรอง ${idx + 1}`] = col ? col.memberIds.map(id => id && currentData.members[id] ? currentData.members[id] : { name: "", job: "", power: 0 }) : Array(5).fill({ name: "", job: "", power: 0 });
              return acc;
            }, {} as Record<string, any>)
          }
        ]
      };
      await axios.put("/api/teams", payload);
      setSaveStatus("saved");
      setSaveErrorMsg("");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err: any) {
      console.error("Save error:", err.response?.data || err);
      setSaveStatus("error");
      setSaveErrorMsg(err.response?.data?.error || err.message || "Unknown error");
    }
  }, [isAdmin]);

  // Auto-save trigger
  useEffect(() => {
    if (!isMounted || !data || !isAdmin) return;
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      handleSave(data);
    }, 1500); // Debounce auto-save
    return () => clearTimeout(timer);
  }, [data, handleSave, isMounted, isAdmin]);

  // ── Player Search ───────────────────────────────────────────
  const handleSearchPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerSearchQuery.trim() || !data) return;
    
    // Find member by name (case insensitive)
    const targetId = Object.keys(data.members).find(id => id.toLowerCase().includes(playerSearchQuery.trim().toLowerCase()));
    
    if (targetId) {
      // Find where they are assigned
      const assignedEl = document.getElementById(`member-assigned-${targetId}`);
      if (assignedEl) {
        assignedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        assignedEl.classList.add('ring-4', 'ring-pink-500', 'animate-pulse', 'z-50', 'relative');
        setTimeout(() => assignedEl.classList.remove('ring-4', 'ring-pink-500', 'animate-pulse', 'z-50', 'relative'), 3000);
      } else {
        const unassignedEl = document.getElementById(`member-unassigned-${targetId}`);
        if (unassignedEl) {
           setIsUnassignedCollapsed(false);
           setTimeout(() => {
             const uEl = document.getElementById(`member-unassigned-${targetId}`);
             if (uEl) {
               uEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
               uEl.classList.add('ring-4', 'ring-pink-500', 'animate-pulse', 'z-50', 'relative');
               setTimeout(() => uEl.classList.remove('ring-4', 'ring-pink-500', 'animate-pulse', 'z-50', 'relative'), 3000);
             }
           }, 150);
        } else if (data.offlineIds.includes(targetId)) {
           setActiveTab("leave");
           alert(`ผู้เล่น ${targetId} อยู่ในสถานะลา/ออฟไลน์`);
        }
      }
      setPlayerSearchQuery(""); // clear after search
    } else {
      alert("ไม่พบผู้เล่นที่ค้นหา");
    }
  };

  // ── Derived values ───────────────────────────────────────────
  const mainPlayerCount = !data ? 0 : data.zones
    .filter(z => z.type === "main")
    .flatMap(z => z.teamOrder)
    .reduce((sum, colId) => {
      const col = data.columns[colId];
      return sum + (col ? col.memberIds.filter(id => id !== null).length : 0);
    }, 0);

  const mainTeamCount = !data ? 0 : data.zones
    .filter(z => z.type === "main")
    .reduce((sum, z) => sum + z.teamOrder.length, 0);

  const canAddMainTeam = mainPlayerCount < 60 && mainTeamCount < 12;

  // ── Zone management ─────────────────────────────────────────
  const addZone = (type: "main" | "sub") => {
    if (!data) return;
    const id = `zone-${genId()}`;
    const zoneCount = data.zones.filter(z => z.type === type).length;
    const name = type === "main" ? `โซน ${zoneCount + 1}` : `สนามรอง ${zoneCount + 1}`;
    setData({ ...data, zones: [...data.zones, { id, name, type, teamOrder: [] }] });
  };

  const deleteZone = (zoneId: string) => {
    if (!data) return;
    const zone = data.zones.find(z => z.id === zoneId);
    if (!zone) return;
    if (zone.teamOrder.length > 0) {
      if (!confirm(`โซนนี้มี ${zone.teamOrder.length} ทีม ต้องการลบโซนและย้ายสมาชิกทั้งหมดกลับไปยังไม่ได้จัด ใช่หรือไม่?`)) return;
    }
    const newData = { ...data };
    const newCols = { ...newData.columns };
    const unassignedIds = [...newCols["unassigned"].memberIds] as string[];
    zone.teamOrder.forEach(colId => {
      const col = newCols[colId];
      if (col) { col.memberIds.forEach(id => { if (id) unassignedIds.push(id); }); delete newCols[colId]; }
    });
    newCols["unassigned"] = { ...newCols["unassigned"], memberIds: unassignedIds };
    setData({ ...newData, columns: newCols, zones: newData.zones.filter(z => z.id !== zoneId) });
  };

  const renameZone = (zoneId: string, name: string) => {
    if (!data || !name.trim()) return;
    setData({ ...data, zones: data.zones.map(z => z.id === zoneId ? { ...z, name: name.trim() } : z) });
    setEditingZoneId(null);
  };

  const addTeamToZone = (zoneId: string) => {
    if (!data) return;
    const zone = data.zones.find(z => z.id === zoneId);
    if (!zone) return;
    if (zone.type === "main" && !canAddMainTeam) { alert("สนามหลักมีครบ 60 คน (12 ทีม) แล้ว"); return; }
    const allTeamNums = Object.keys(data.columns)
      .filter(id => id.startsWith(zone.type === "main" ? "main-" : "sub-"))
      .map(id => parseInt(id.split("-")[1])).filter(n => !isNaN(n));
    const nextNum = allTeamNums.length > 0 ? Math.max(...allTeamNums) + 1 : 1;
    const colId = `${zone.type === "main" ? "main" : "sub"}-${nextNum}-${genId().slice(0, 4)}`;
    const title = zone.type === "main" ? `ทีม ${nextNum}` : `ทีมรอง ${nextNum}`;
    setData({
      ...data,
      columns: { ...data.columns, [colId]: { id: colId, title, memberIds: [null, null, null, null, null], type: zone.type, locked: false } },
      zones: data.zones.map(z => z.id === zoneId ? { ...z, teamOrder: [...z.teamOrder, colId] } : z),
    });
  };

  const removeTeamFromZone = (zoneId: string, colId: string) => {
    if (!data) return;
    const col = data.columns[colId];
    if (!col) return;
    if (col.locked) { alert("ทีมนี้ถูกล็อกอยู่ ปลดล็อกก่อนลบ"); return; }
    const newCols = { ...data.columns };
    const unassignedIds = [...newCols["unassigned"].memberIds] as string[];
    col.memberIds.forEach(id => { if (id) unassignedIds.push(id); });
    delete newCols[colId];
    newCols["unassigned"] = { ...newCols["unassigned"], memberIds: unassignedIds };
    setData({ ...data, columns: newCols, zones: data.zones.map(z => z.id === zoneId ? { ...z, teamOrder: z.teamOrder.filter(id => id !== colId) } : z) });
  };

  // ── Auto-match ───────────────────────────────────────────────
  const handlePullTop60 = () => {
    if (!data) return;
    const all = Object.values(data.members).sort((a, b) => b.power - a.power);
    const priests = all.filter(m => m.job === "Priest").slice(0, 12);
    const nonPriests = all.filter(m => m.job !== "Priest").slice(0, 48);
    setAutoModalText([...priests, ...nonPriests].sort((a, b) => b.power - a.power).map(m => m.name).join("\n"));
  };

  const handleProcessAutoMatch = () => {
    if (!data) return;
    const names = autoModalText.split("\n").map(n => n.trim()).filter(Boolean);
    const mainZones = data.zones.filter(z => z.type === "main");
    const subZones = data.zones.filter(z => z.type === "sub");
    const result = allocateTeams({
      members: data.members as any,
      columns: data.columns as any,
      mainZone1Order: mainZones[0]?.teamOrder || [],
      mainZone2Order: mainZones[1]?.teamOrder || [],
      subOrder: subZones.flatMap(z => z.teamOrder),
      offlineIds: data.offlineIds || [],
      mainFieldNames: names,
    });
    setPreviewResult(result);
  };

  const handleApplyAllocation = () => {
    if (!previewResult || !data) return;
    const mainZones = data.zones.filter(z => z.type === "main");
    const subZones = data.zones.filter(z => z.type === "sub");
    const newZones = data.zones.map(z => {
      if (z.type === "main" && z.id === mainZones[0]?.id) return { ...z, teamOrder: previewResult.mainZone1Order };
      if (z.type === "main" && z.id === mainZones[1]?.id) return { ...z, teamOrder: previewResult.mainZone2Order };
      if (z.type === "sub" && z.id === subZones[0]?.id) return { ...z, teamOrder: previewResult.subOrder };
      return z;
    });
    setData({ ...data, columns: previewResult.columns as any, zones: newZones });
    setPreviewResult(null);
    setIsAutoModalOpen(false);
  };

  const handleClearAll = () => {
    if (!data) return;
    if (!confirm("ลบทุกคนออกจากทุกทีม (ยกเว้นทีมที่ล็อก) ใช่หรือไม่?")) return;
    const newData = { ...data, columns: { ...data.columns } };
    const unassignedIds = [...newData.columns["unassigned"].memberIds] as string[];
    Object.keys(newData.columns).forEach(colId => {
      if (colId === "unassigned" || newData.columns[colId].locked) return;
      newData.columns[colId].memberIds.forEach(id => { if (id) unassignedIds.push(id); });
      newData.columns[colId] = { ...newData.columns[colId], memberIds: [null, null, null, null, null] };
    });
    newData.columns["unassigned"] = { ...newData.columns["unassigned"], memberIds: unassignedIds };
    setData(newData);
  };

  const toggleLock = (colId: string) => {
    if (!data) return;
    setData({ ...data, columns: { ...data.columns, [colId]: { ...data.columns[colId], locked: !data.columns[colId].locked } } });
  };

  const clearTeam = (colId: string) => {
    if (!data || data.columns[colId].locked) return;
    const newData = { ...data, columns: { ...data.columns } };
    const unassignedIds = [...newData.columns["unassigned"].memberIds] as string[];
    newData.columns[colId].memberIds.forEach(id => { if (id) unassignedIds.push(id); });
    newData.columns[colId] = { ...newData.columns[colId], memberIds: [null, null, null, null, null] };
    newData.columns["unassigned"] = { ...newData.columns["unassigned"], memberIds: unassignedIds };
    setData(newData);
  };

  const removeMember = (colId: string, memberId: string) => {
    if (!data || data.columns[colId].locked) return;
    const newData = { ...data, columns: { ...data.columns } };
    const idx = newData.columns[colId].memberIds.indexOf(memberId);
    if (idx !== -1) newData.columns[colId].memberIds[idx] = null;
    newData.columns["unassigned"] = { ...newData.columns["unassigned"], memberIds: [memberId, ...newData.columns["unassigned"].memberIds as string[]] };
    setData(newData);
  };

  const markAsOffline = (memberId: string) => {
    if (!data || !memberId) return;
    const newData = { ...data, columns: { ...data.columns } };
    if (!newData.offlineIds.includes(memberId)) newData.offlineIds = [...newData.offlineIds, memberId];
    newData.columns["unassigned"] = { ...newData.columns["unassigned"], memberIds: newData.columns["unassigned"].memberIds.filter(id => id !== memberId) };
    Object.keys(newData.columns).forEach(colId => {
      if (colId === "unassigned") return;
      const idx = newData.columns[colId].memberIds.indexOf(memberId);
      if (idx !== -1) newData.columns[colId] = { ...newData.columns[colId], memberIds: newData.columns[colId].memberIds.map((id, i) => i === idx ? null : id) };
    });
    setData(newData);
  };

  const removeFromOffline = (memberId: string) => {
    if (!data || !memberId) return;
    const newData = { ...data, columns: { ...data.columns } };
    newData.offlineIds = newData.offlineIds.filter(id => id !== memberId);
    if (newData.members[memberId] && !newData.columns["unassigned"].memberIds.includes(memberId)) {
      newData.columns["unassigned"] = { ...newData.columns["unassigned"], memberIds: [memberId, ...newData.columns["unassigned"].memberIds as string[]] };
    }
    setData(newData);
  };

  const onDragEnd = (result: DropResult) => {
    if (!data) return;
    const { destination, source, draggableId, type } = result;
    if (!destination) return;

    const newData = { ...data, zones: [...data.zones], columns: { ...data.columns } };

    // Team reordering between zones
    if (type === "TEAM") {
      if (destination.droppableId === source.droppableId && destination.index === source.index) return;
      const srcZoneIdx = newData.zones.findIndex(z => z.id === source.droppableId);
      const dstZoneIdx = newData.zones.findIndex(z => z.id === destination.droppableId);
      if (srcZoneIdx === -1 || dstZoneIdx === -1) return;
      const srcZone = { ...newData.zones[srcZoneIdx], teamOrder: [...newData.zones[srcZoneIdx].teamOrder] };
      const dstZone = srcZoneIdx === dstZoneIdx ? srcZone : { ...newData.zones[dstZoneIdx], teamOrder: [...newData.zones[dstZoneIdx].teamOrder] };
      srcZone.teamOrder.splice(source.index, 1);
      dstZone.teamOrder.splice(destination.index, 0, draggableId);
      newData.zones[srcZoneIdx] = srcZone;
      if (srcZoneIdx !== dstZoneIdx) newData.zones[dstZoneIdx] = dstZone;
      setData(newData);
      return;
    }

    // Member drag
    if (source.droppableId === "unassigned" && destination.droppableId === "unassigned") {
      const ids = Array.from(newData.columns["unassigned"].memberIds);
      const realIdx = ids.indexOf(draggableId);
      if (realIdx !== -1) { ids.splice(realIdx, 1); ids.splice(destination.index, 0, draggableId); }
      newData.columns["unassigned"] = { ...newData.columns["unassigned"], memberIds: ids };
      setData(newData);
      return;
    }

    const isSourceUnassigned = source.droppableId === "unassigned";
    const [sourceColId, sourceSlotIdxStr] = source.droppableId.split("::");
    const sourceSlotIdx = parseInt(sourceSlotIdxStr);
    const isDestUnassigned = destination.droppableId === "unassigned";
    const [destColId, destSlotIdxStr] = destination.droppableId.split("::");
    const destSlotIdx = parseInt(destSlotIdxStr);

    if (!isSourceUnassigned && newData.columns[sourceColId]?.locked) return;
    if (!isDestUnassigned && newData.columns[destColId]?.locked) return;

    if (isSourceUnassigned && !isDestUnassigned) {
      const realSrcIdx = newData.columns["unassigned"].memberIds.indexOf(draggableId);
      if (realSrcIdx !== -1) newData.columns["unassigned"] = { ...newData.columns["unassigned"], memberIds: [...newData.columns["unassigned"].memberIds].filter((_, i) => i !== realSrcIdx) };
      const cur = [...newData.columns[destColId].memberIds];
      if (cur[destSlotIdx] !== null) {
        cur.splice(destSlotIdx, 0, draggableId);
        const nullIdx = cur.findIndex((v, i) => i > destSlotIdx && v === null);
        if (nullIdx !== -1) cur.splice(nullIdx, 1);
        else { const kicked = cur.pop(); if (kicked) newData.columns["unassigned"] = { ...newData.columns["unassigned"], memberIds: [kicked, ...newData.columns["unassigned"].memberIds as string[]] }; }
      } else { cur[destSlotIdx] = draggableId; }
      newData.columns[destColId] = { ...newData.columns[destColId], memberIds: cur };
    } else if (!isSourceUnassigned && isDestUnassigned) {
      const memberToMove = newData.columns[sourceColId].memberIds[sourceSlotIdx];
      newData.columns[sourceColId] = { ...newData.columns[sourceColId], memberIds: newData.columns[sourceColId].memberIds.map((v, i) => i === sourceSlotIdx ? null : v) };
      if (memberToMove) newData.columns["unassigned"] = { ...newData.columns["unassigned"], memberIds: [...newData.columns["unassigned"].memberIds.slice(0, destination.index), memberToMove, ...newData.columns["unassigned"].memberIds.slice(destination.index)] };
    } else if (!isSourceUnassigned && !isDestUnassigned) {
      const memberA = newData.columns[sourceColId].memberIds[sourceSlotIdx];
      if (sourceColId === destColId) {
        const cur = [...newData.columns[destColId].memberIds];
        cur.splice(sourceSlotIdx, 1);
        cur.splice(destSlotIdx, 0, memberA);
        while (cur.length < 5) cur.push(null);
        newData.columns[destColId] = { ...newData.columns[destColId], memberIds: cur.slice(0, 5) };
      } else {
        newData.columns[sourceColId] = { ...newData.columns[sourceColId], memberIds: newData.columns[sourceColId].memberIds.map((v, i) => i === sourceSlotIdx ? null : v) };
        const dst = [...newData.columns[destColId].memberIds];
        dst.splice(destSlotIdx, 0, memberA);
        const nullIdx = dst.findIndex((v, i) => i > destSlotIdx && v === null);
        if (nullIdx !== -1) dst.splice(nullIdx, 1);
        else { const kicked = dst.pop(); if (kicked) newData.columns["unassigned"] = { ...newData.columns["unassigned"], memberIds: [kicked, ...newData.columns["unassigned"].memberIds as string[]] }; }
        newData.columns[destColId] = { ...newData.columns[destColId], memberIds: dst };
      }
    }
    setData(newData);
  };

  if (!isMounted || isLoading) return <div className="flex h-screen items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2" /> โหลดข้อมูล...</div>;
  if (!data) return null;

  const filteredUnassignedIds = (data.columns["unassigned"]?.memberIds as string[] || []).filter(id => {
    if (!id || !data.members[id]) return false;
    if (unassignedFilterJobs.length > 0 && !unassignedFilterJobs.includes(data.members[id]?.job)) return false;
    if (unassignedSearch && !data.members[id]?.name?.toLowerCase().includes(unassignedSearch.toLowerCase())) return false;
    return true;
  });

  const AutoMatchModal = () => {
    // Modal implementation omitted for brevity
    if (!isAutoModalOpen) return null;
    const names = autoModalText.split("\n").map(n => n.trim()).filter(n => n);
    return (
      <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-theme-panel rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-theme-border animate-in zoom-in-95 duration-200">
          <div className="p-4 border-b border-theme-border flex items-center justify-between">
            <h3 className="font-bold text-lg text-theme-text">{previewResult ? "ตัวอย่างผลการจัดทีมอัตโนมัติ (Preview)" : "กำหนดรายชื่อสนามหลัก (60 คน)"}</h3>
            <button onClick={() => { setIsAutoModalOpen(false); setPreviewResult(null); }} className="text-theme-textSecondary hover:text-theme-text"><X size={20} /></button>
          </div>
          {previewResult ? (
            <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4">
                <h4 className="font-bold text-emerald-800 dark:text-emerald-300 text-sm mb-3">ผลการคำนวณการจัดทีม</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-[#232733] p-3 rounded-lg border border-emerald-200/50 dark:border-[#2D3342]">
                    <span className="text-slate-500 dark:text-slate-400 block text-xs">สนามหลัก</span>
                    <span className="font-bold text-xl text-slate-800 dark:text-white">{previewResult.stats.mainTotal} / 60 คน</span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 block mt-1">มี Priest {previewResult.stats.priestFullTeams} ทีม</span>
                  </div>
                  <div className="bg-white dark:bg-[#232733] p-3 rounded-lg border border-emerald-200/50 dark:border-[#2D3342]">
                    <span className="text-slate-500 dark:text-slate-400 block text-xs">สนามรอง</span>
                    <span className="font-bold text-xl text-slate-800 dark:text-white">{previewResult.stats.subTotal} คน</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block mt-1">จัดได้ {previewResult.stats.subTeams} ทีม</span>
                  </div>
                </div>
              </div>
              {previewResult.warnings.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="font-bold mb-1">คำเตือน:</div>
                  {previewResult.warnings.map((w, i) => <div key={i}>• {w.message}</div>)}
                </div>
              )}
              <p className="text-xs text-slate-500">กด &quot;ยืนยันนำไปใช้งาน&quot; เพื่อแทนที่การจัดทีม (ยังสามารถปรับก่อนบันทึกจริง)</p>
            </div>
          ) : (
            <div className="p-4 flex-1 flex flex-col gap-4">
              <p className="text-sm text-theme-textSecondary">ระบุรายชื่อ 60 คน สำหรับสนามหลัก (บรรทัดละ 1 ชื่อ)</p>
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg p-3 text-sm text-[#0b3d63] dark:text-white flex items-start gap-2">
                <span className="font-bold">คำแนะนำ:</span> จะคัดเลือก Priest 12 คนสำหรับสนามหลักให้อัตโนมัติ
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-theme-text">ตรวจพบ: {names.length} / 60 คน</span>
                <button onClick={handlePullTop60} className="text-[#0b3d63] dark:text-white font-bold text-sm bg-[#0b3d63]/10 dark:bg-[#3B66D1]/20 px-4 py-1.5 rounded-lg hover:bg-[#0b3d63]/20 transition-colors border border-[#0b3d63]/20">ดึง 60 พลังสูงสุด</button>
              </div>
              <textarea className="w-full h-[250px] bg-theme-bg border border-theme-border rounded-lg p-3 text-sm text-theme-text font-mono resize-none focus:ring-2 focus:ring-[#4D73CD] outline-none" value={autoModalText} onChange={e => setAutoModalText(e.target.value)} placeholder="วางรายชื่อที่นี่ (1 บรรทัดต่อ 1 ชื่อ)" />
            </div>
          )}
          <div className="p-4 border-t border-theme-border flex items-center justify-end gap-3 bg-theme-bg/50">
            {previewResult ? (
              <>
                <button onClick={() => setPreviewResult(null)} className="px-5 py-2 rounded-lg font-bold text-theme-textSecondary hover:bg-theme-border/50 transition-colors border border-theme-border bg-theme-panel text-sm">กลับไปแก้ไข</button>
                <button onClick={handleApplyAllocation} className="px-5 py-2 rounded-lg font-bold text-white bg-[#10b981] hover:bg-[#059669] transition-colors shadow-sm text-sm">ยืนยันนำไปใช้งาน</button>
              </>
            ) : (
              <>
                <button onClick={() => setIsAutoModalOpen(false)} className="px-5 py-2 rounded-lg font-bold text-theme-textSecondary hover:bg-theme-border/50 transition-colors border border-theme-border bg-theme-panel text-sm">ยกเลิก</button>
                <button onClick={handleProcessAutoMatch} className="px-5 py-2 rounded-lg font-bold text-white bg-[#3B66D1] hover:bg-[#4D73CD] transition-colors shadow-sm text-sm">ประมวลผล (Preview)</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const ZoneHeader = ({ zone }: { zone: Zone }) => {
    const isEditing = editingZoneId === zone.id;
    const mainCap = zone.type === "main" && !canAddMainTeam;
    return (
      <div className="flex items-center gap-3 mb-4">
        <LayoutGrid size={18} className="text-[#0b3d63] dark:text-white shrink-0" />
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <input autoFocus value={editingZoneName} onChange={e => setEditingZoneName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") renameZone(zone.id, editingZoneName); if (e.key === "Escape") setEditingZoneId(null); }} className="font-bold text-lg bg-white dark:bg-[#272C38] border border-[#4D73CD] rounded-lg px-2 py-0.5 text-slate-800 dark:text-white outline-none" />
            <button onClick={() => renameZone(zone.id, editingZoneName)} className="text-emerald-500 hover:text-emerald-600"><Check size={18} /></button>
            <button onClick={() => setEditingZoneId(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
        ) : (
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex-1">{zone.name}</h2>
        )}
        <span className="text-xs bg-slate-100 dark:bg-[#272C38] text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">{zone.teamOrder.length} ทีม</span>
        {isAdmin && !isEditing && (
          <button onClick={() => { setEditingZoneId(zone.id); setEditingZoneName(zone.name); }} className="text-slate-400 hover:text-[#3B66D1] transition-colors" title="แก้ชื่อโซน"><Edit2 size={15} /></button>
        )}
        {isAdmin && (
          <button onClick={() => addTeamToZone(zone.id)} disabled={mainCap} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${mainCap ? "opacity-40 cursor-not-allowed bg-slate-100 dark:bg-[#272C38] text-slate-400" : "bg-[#0b3d63] dark:bg-[#3B66D1] text-white hover:bg-[#0d4b7a] dark:hover:bg-[#4D73CD]"}`} title={mainCap ? "สนามหลักเต็ม 60 คน (12 ทีม)" : "เพิ่มทีมในโซนนี้"}>
            <Plus size={13} /> เพิ่มทีม
          </button>
        )}
        {isAdmin && (
          <button onClick={() => deleteZone(zone.id)} className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors" title="ลบโซนนี้"><Trash2 size={15} /></button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 bg-[#f0f6fc] dark:bg-[#1C1F27] min-h-screen p-3 sm:p-4 lg:py-6 lg:px-6 2xl:px-8 relative">
      <AutoMatchModal />

      {/* Header */}
      <div className="bg-white dark:bg-[#232733] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] p-4 sm:p-5 mb-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center justify-between w-full lg:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#0b3d63] dark:bg-[#3B66D1] shadow-sm"><Shield className="w-5 h-5 sm:w-6 sm:h-6 text-white" /></div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white">จัดทีม GVG</h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-[#8B93A7]">{isAdmin ? "ลากและวางเพื่อจัดทีม (ระบบบันทึกอัตโนมัติ)" : "รายชื่อและสมาชิกทีมสำหรับกิลด์วอร์"}</p>
            </div>
          </div>
        </div>
        
        {/* New Player Search Bar for everyone */}
        <form onSubmit={handleSearchPlayer} className="flex-1 max-w-sm w-full relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              value={playerSearchQuery}
              onChange={e => setPlayerSearchQuery(e.target.value)}
              placeholder="ค้นหาตำแหน่งผู้เล่น..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#272C38] border border-slate-200 dark:border-[#2D3342] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#3B66D1] text-slate-800 dark:text-white"
            />
          </div>
        </form>

        {isAdmin && (
          <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto justify-end flex-wrap">
            <div className="flex flex-col sm:flex-row items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-50 dark:bg-[#272C38] border border-slate-200 dark:border-[#2D3342] mr-2 transition-all" title={saveErrorMsg}>
              {saveStatus === 'idle' && <span className="text-slate-500 font-bold">พร้อมใช้งาน</span>}
              {saveStatus === 'saving' && <span className="text-[#3B66D1] flex items-center gap-1 font-bold"><Loader2 className="w-4 h-4 animate-spin"/> กำลังบันทึก...</span>}
              {saveStatus === 'saved' && <span className="text-emerald-500 flex items-center gap-1 font-bold"><CheckCircle2 className="w-4 h-4"/> บันทึกอัตโนมัติแล้ว</span>}
              {saveStatus === 'error' && <span className="text-red-500 flex items-center gap-1 font-bold cursor-pointer"><X className="w-4 h-4"/> บันทึกไม่สำเร็จ</span>}
              {saveStatus === 'error' && saveErrorMsg && <span className="text-xs text-red-400 truncate max-w-[150px]">({saveErrorMsg})</span>}
            </div>
            <button onClick={handleClearAll} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white dark:bg-[#272C38] text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-xl font-bold hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-xs sm:text-sm shadow-sm">ล้างทั้งหมด</button>
            <button onClick={handleExportPDF} disabled={isExporting} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white dark:bg-[#272C38] text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 rounded-xl font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors text-xs sm:text-sm shadow-sm disabled:opacity-50">
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} 
              {isExporting ? "กำลังออกเอกสาร..." : "Export PDF"}
            </button>
            <button onClick={() => setIsAutoModalOpen(true)} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white dark:bg-[#272C38] text-[#0b3d63] dark:text-white border border-[#0b3d63] dark:border-[#4D73CD] rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-sky-950/30 transition-colors text-xs sm:text-sm shadow-sm"><Wand2 size={16} /> ออโต้จัดทีม</button>
          </div>
        )}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          {/* Unassigned Panel */}
          {isAdmin && !isUnassignedCollapsed && (
            <div className="w-full lg:w-[260px] 2xl:w-[280px] flex-shrink-0 bg-white dark:bg-[#232733] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] h-[400px] lg:h-[calc(100vh-2rem)] flex flex-col lg:sticky top-4 z-20">
              <div className="p-3 border-b border-slate-100 dark:border-[#2D3342] bg-slate-50/70 dark:bg-[#272C38]/50 rounded-t-2xl">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm"><Users size={16} /> ยังไม่ได้จัด ({data.columns["unassigned"].memberIds.length})</h2>
                  <button onClick={() => setIsUnassignedCollapsed(true)} className="text-slate-400 dark:text-[#8B93A7] hover:text-slate-700 bg-white dark:bg-[#272C38] border border-slate-200 dark:border-[#2D3342] rounded-lg p-1"><ChevronLeft size={14} /></button>
                </div>
                <div className="space-y-2">
                  <input type="text" placeholder="ค้นหาชื่อ..." value={unassignedSearch} onChange={e => setUnassignedSearch(e.target.value)} className="w-full bg-white dark:bg-[#272C38] border border-slate-200 dark:border-[#2D3342] rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#4D73CD]" />
                  <div className="relative" ref={jobFilterDropdownRef}>
                    <button type="button" onClick={() => setIsJobFilterOpen(prev => !prev)} className={`w-full flex items-center justify-between bg-white dark:bg-[#272C38] border ${unassignedFilterJobs.length > 0 ? "border-[#3B66D1] dark:border-[#4D73CD]" : "border-slate-200 dark:border-[#2D3342]"} rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-white outline-none cursor-pointer hover:bg-slate-50 dark:hover:bg-[#2A2F3E]`}>
                      <div className="flex items-center gap-1.5 truncate">{unassignedFilterJobs.length === 0 ? <span className="text-slate-600 dark:text-[#8B93A7]">ทุกอาชีพ ({data.columns["unassigned"].memberIds.length})</span> : <span className="truncate text-[#0b3d63] dark:text-[#82A0F5]">{unassignedFilterJobs.length === 1 ? unassignedFilterJobs[0] : `${unassignedFilterJobs.length} อาชีพ`}</span>}</div>
                      <div className="flex items-center gap-1 shrink-0">
                        {unassignedFilterJobs.length > 0 && <span onClick={e => { e.stopPropagation(); setUnassignedFilterJobs([]); }} className="hover:text-red-500 text-slate-400 p-0.5 rounded cursor-pointer"><X size={12} /></span>}
                        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isJobFilterOpen ? "rotate-180" : ""}`} />
                      </div>
                    </button>
                    {isJobFilterOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-[#232733] border border-slate-200 dark:border-[#2D3342] rounded-xl shadow-xl z-50 p-2 max-h-60 overflow-y-auto space-y-1">
                        <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100 dark:border-[#2D3342] text-[11px]">
                          <button type="button" onClick={() => setUnassignedFilterJobs([])} className="font-bold hover:underline text-slate-500">เลือกทั้งหมด</button>
                          {unassignedFilterJobs.length > 0 && <button type="button" onClick={() => setUnassignedFilterJobs([])} className="text-red-500 hover:underline text-[10px] font-bold">ล้าง</button>}
                        </div>
                        {JOB_LIST.map(job => {
                          const isChecked = unassignedFilterJobs.includes(job);
                          const count = (data.columns["unassigned"].memberIds as string[]).filter(id => data.members[id]?.job === job).length;
                          return (
                            <label key={job} className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-[#272C38] cursor-pointer text-xs select-none">
                              <div className="flex items-center gap-2"><input type="checkbox" checked={isChecked} onChange={() => setUnassignedFilterJobs(prev => prev.includes(job) ? prev.filter(j => j !== job) : [...prev, job])} className="rounded border-slate-300 text-[#3B66D1]" /><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: JOB_COLORS[job] || "#475569" }} /><span className={`truncate font-medium ${isChecked ? "font-bold text-[#0b3d63] dark:text-[#82A0F5]" : "text-slate-700 dark:text-slate-300"}`}>{job}</span></div>
                              <span className="text-[10px] font-mono text-slate-400">{count}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <Droppable droppableId="unassigned" type="MEMBER">
                {(provided, snapshot) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className={`flex-1 overflow-y-auto p-2 space-y-1.5 transition-colors ${snapshot.isDraggingOver ? "bg-blue-50/50 dark:bg-[#3B66D1]/25" : ""}`}>
                    {filteredUnassignedIds.map((id, index) => <MemberCard key={id} member={data.members[id]} index={index} />)}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )}

          {isAdmin && isUnassignedCollapsed && (
            <div className="w-full lg:w-12 flex-shrink-0 bg-white dark:bg-[#232733] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2D3342] h-12 lg:h-[calc(100vh-2rem)] flex flex-row lg:flex-col items-center justify-between lg:justify-start px-4 lg:px-0 py-2 lg:py-4 sticky top-4 z-10 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#2A2F3E]" onClick={() => setIsUnassignedCollapsed(false)}>
              <div className="flex items-center gap-2"><Users size={18} className="text-slate-400" /><span className="lg:hidden font-bold text-xs text-slate-700 dark:text-slate-300">แสดงรายชื่อที่ยังไม่ได้จัด</span></div>
              <div className="flex items-center gap-2"><span className="bg-[#0b3d63] dark:bg-[#3B66D1] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{data.columns["unassigned"].memberIds.length}</span><ChevronRight size={18} className="text-slate-400 lg:mt-4" /></div>
            </div>
          )}

          <div className="flex-1 min-w-0 flex flex-col w-full">
            {/* Tabs */}
            <div className="flex gap-2 mb-4 bg-white dark:bg-[#232733] p-1.5 rounded-xl border border-slate-200 dark:border-[#2D3342] shadow-sm self-start overflow-x-auto max-w-full">
              <button onClick={() => setActiveTab("main")} className={`px-4 sm:px-6 py-2 rounded-lg font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${activeTab === "main" ? "bg-[#0b3d63] dark:bg-[#3B66D1] text-white shadow-sm" : "text-slate-600 dark:text-white hover:bg-slate-50 dark:hover:bg-[#2A2F3E]"}`}>
                สนามหลัก ({mainPlayerCount}/60 คน)
              </button>
              <button onClick={() => setActiveTab("sub")} className={`px-4 sm:px-6 py-2 rounded-lg font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${activeTab === "sub" ? "bg-[#0b3d63] dark:bg-[#3B66D1] text-white shadow-sm" : "text-slate-600 dark:text-white hover:bg-slate-50 dark:hover:bg-[#2A2F3E]"}`}>
                สนามรอง ({data.zones.filter(z => z.type === "sub").flatMap(z => z.teamOrder).reduce((s, colId) => s + (data.columns[colId]?.memberIds?.filter(id => id !== null)?.length || 0), 0)} คน)
              </button>
              {isAdmin && <button onClick={() => setActiveTab("leave")} className={`px-4 sm:px-6 py-2 rounded-lg font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${activeTab === "leave" ? "bg-red-600 text-white shadow-sm" : "text-slate-600 dark:text-white hover:bg-slate-50 dark:hover:bg-[#2A2F3E]"}`}>ลา/ออฟไลน์</button>}
            </div>

            <div className="flex-1" ref={exportContainerRef}>
              {activeTab === "main" && (
                <div className="space-y-10 pb-12 bg-[#f0f6fc] dark:bg-[#1C1F27] print-export-padding">
                  {/* 60-player progress bar */}
                  <div className="bg-white dark:bg-[#232733] rounded-xl border border-slate-200 dark:border-[#2D3342] p-3 flex items-center gap-3 shadow-sm">
                    <span className="text-sm font-bold text-slate-700 dark:text-white whitespace-nowrap">สนามหลัก {mainPlayerCount}/60 คน</span>
                    <div className="flex-1 bg-slate-100 dark:bg-[#272C38] rounded-full h-2.5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${mainPlayerCount >= 60 ? "bg-emerald-500" : mainPlayerCount >= 45 ? "bg-amber-400" : "bg-[#3B66D1]"}`} style={{ width: `${Math.min(100, (mainPlayerCount / 60) * 100)}%` }} />
                    </div>
                    <span className={`text-xs font-bold ${mainPlayerCount >= 60 ? "text-emerald-500" : "text-slate-500"}`}>{mainPlayerCount >= 60 ? "เต็ม ✓" : `เหลือ ${60 - mainPlayerCount} ที่`}</span>
                  </div>

                  {data.zones.filter(z => z.type === "main").map(zone => (
                    <div key={zone.id}>
                      <ZoneHeader zone={zone} />
                      <Droppable droppableId={zone.id} direction="horizontal" type="TEAM" isDropDisabled={!isAdmin}>
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 xl:gap-6 min-h-[100px]">
                            {zone.teamOrder.map((colId, index) => data.columns[colId] ? (
                              <TeamCard key={colId} column={data.columns[colId]} members={data.members} index={index} toggleLock={toggleLock} clearTeam={clearTeam} removeMember={removeMember} isAdmin={isAdmin} onRemoveFromZone={isAdmin ? () => removeTeamFromZone(zone.id, colId) : undefined} />
                            ) : null)}
                            {provided.placeholder}
                            {zone.teamOrder.length === 0 && <div className="col-span-full flex items-center justify-center h-24 rounded-xl border-2 border-dashed border-slate-200 dark:border-[#2D3342] text-slate-400 text-sm">ยังไม่มีทีมในโซนนี้ — กด &quot;เพิ่มทีม&quot;</div>}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  ))}

                  {isAdmin && (
                    <button onClick={() => addZone("main")} disabled={!canAddMainTeam} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-colors border ${canAddMainTeam ? "border-[#3B66D1] text-[#3B66D1] dark:text-[#82A0F5] hover:bg-[#3B66D1]/10" : "border-slate-200 text-slate-400 cursor-not-allowed"}`}>
                      <Plus size={16} /> สร้างโซนใหม่ (สนามหลัก)
                    </button>
                  )}
                </div>
              )}

              {activeTab === "sub" && (
                <div className="space-y-10 pb-12 bg-[#f0f6fc] dark:bg-[#1C1F27] print-export-padding">
                  {data.zones.filter(z => z.type === "sub").map(zone => (
                    <div key={zone.id}>
                      <ZoneHeader zone={zone} />
                      <Droppable droppableId={zone.id} direction="horizontal" type="TEAM" isDropDisabled={!isAdmin}>
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 xl:gap-6 min-h-[100px]">
                            {zone.teamOrder.map((colId, index) => data.columns[colId] ? (
                              <TeamCard key={colId} column={data.columns[colId]} members={data.members} index={index} toggleLock={toggleLock} clearTeam={clearTeam} removeMember={removeMember} isAdmin={isAdmin} onRemoveFromZone={isAdmin ? () => removeTeamFromZone(zone.id, colId) : undefined} />
                            ) : null)}
                            {provided.placeholder}
                            {zone.teamOrder.length === 0 && <div className="col-span-full flex items-center justify-center h-24 rounded-xl border-2 border-dashed border-slate-200 dark:border-[#2D3342] text-slate-400 text-sm">ยังไม่มีทีม — กด &quot;เพิ่มทีม&quot;</div>}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  ))}
                  {isAdmin && (
                    <button onClick={() => addZone("sub")} className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-colors border border-[#3B66D1] text-[#3B66D1] dark:text-[#82A0F5] hover:bg-[#3B66D1]/10">
                      <Plus size={16} /> สร้างโซนใหม่ (สนามรอง)
                    </button>
                  )}
                </div>
              )}

              {activeTab === "leave" && (
                <div className="pb-12 space-y-12">
                  <div>
                    <h2 className="text-lg font-bold text-theme-danger flex items-center gap-2 mb-4"><X size={18} /> รายชื่อผู้เล่นออฟไลน์</h2>
                    <div className="bg-theme-panel rounded-xl border border-theme-border p-6 shadow-sm">
                      <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-1" ref={offlineDropdownRef}>
                          <div className="bg-theme-bg border border-theme-border rounded-lg px-4 py-2 flex items-center justify-between cursor-pointer" onClick={() => setIsOfflineDropdownOpen(true)}>
                            <input type="text" placeholder="+ ค้นหาผู้เล่นเพื่อทำให้ออฟไลน์..." className="bg-transparent border-none outline-none text-sm font-bold text-theme-text w-full" value={offlineSearch} onChange={e => { setOfflineSearch(e.target.value); setIsOfflineDropdownOpen(true); }} onFocus={() => setIsOfflineDropdownOpen(true)} />
                          </div>
                          {isOfflineDropdownOpen && (
                            <div className="absolute z-50 w-full mt-2 bg-theme-panel border border-theme-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                              {Object.values(data.members).filter(m => !data.offlineIds.includes(m.id)).filter(m => m.name.toLowerCase().includes(offlineSearch.toLowerCase()) || m.job.toLowerCase().includes(offlineSearch.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                                <div key={m.id} className="px-4 py-2.5 hover:bg-theme-bg cursor-pointer text-sm font-bold text-theme-text flex justify-between items-center border-b border-theme-divider last:border-0" onClick={() => { markAsOffline(m.id); setOfflineSearch(""); setIsOfflineDropdownOpen(false); }}>
                                  <span>{m.name}</span><span className="text-[10px] text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: JOB_COLORS[m.job] || "#475569" }}>{m.job}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {data.offlineIds.length === 0 ? <div className="text-center py-8 text-theme-textMuted font-bold border-2 border-dashed border-theme-divider rounded-lg">ไม่มีผู้เล่นออฟไลน์</div> : (
                        <div className="flex flex-wrap gap-3">
                          {data.offlineIds.map(id => {
                            const m = data.members[id];
                            if (!m) return null;
                            return (
                              <div key={id} className="flex items-center gap-2 bg-theme-bg/80 border border-theme-border rounded-full py-1.5 pl-3 pr-1.5 shadow-sm">
                                <span className="text-sm font-bold text-theme-text">{m.name}</span>
                                <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: JOB_COLORS[m.job] || "#475569" }}>{m.job}</span>
                                <button onClick={() => removeFromOffline(id)} className="p-1 hover:bg-theme-danger hover:text-white rounded-full text-theme-textSecondary transition-colors"><X size={14} /></button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-theme-text flex items-center gap-2 mb-4"><LayoutGrid size={18} className="text-[#0b3d63]" /> บันทึกการลา</h2>
                    {leaveRecords.length === 0 ? <div className="text-center p-12 bg-theme-panel rounded-xl text-theme-textMuted border border-theme-border font-bold">ไม่มีข้อมูลการลา</div> : (
                      <div className="bg-theme-panel rounded-xl border border-theme-border overflow-hidden">
                        <table className="w-full text-left">
                          <thead className="bg-theme-bg/50 border-b border-theme-divider text-xs uppercase tracking-wider text-theme-textMuted">
                            <tr><th className="p-4 font-bold">ชื่อในเกม</th><th className="p-4 font-bold">วันที่ลา</th><th className="p-4 font-bold">เหตุผล</th><th className="p-4 font-bold w-20 text-center">จัดการ</th></tr>
                          </thead>
                          <tbody className="divide-y divide-theme-divider">
                            {leaveRecords.map((r: any, i) => (
                              <tr key={r.id || i} className="hover:bg-theme-bg/30">
                                <td className="p-4 font-bold text-theme-text">{r.name}</td>
                                <td className="p-4 font-bold text-theme-textSecondary">{r.date || r.day}</td>
                                <td className="p-4 text-sm text-theme-textMuted">{r.reason || "-"}</td>
                                <td className="p-4 text-center">
                                  <button onClick={async () => { if (confirm(`ลบรายการลาของ ${r.name}?`)) { try { await axios.delete("/api/leave", { data: { id: r.id } }); setLeaveRecords(prev => prev.filter(rec => rec.id !== r.id)); } catch { alert("ลบไม่สำเร็จ"); } } }} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-lg"><X size={16} /></button>
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
  column, members, index, toggleLock, clearTeam, removeMember, isAdmin = false, onRemoveFromZone,
}: {
  column: Column; members: Record<string, Member>; index: number;
  toggleLock: (id: string) => void; clearTeam: (id: string) => void;
  removeMember: (colId: string, memId: string) => void;
  isAdmin?: boolean; onRemoveFromZone?: () => void;
}) {
  const isFull = (column?.memberIds || []).filter(id => id).length === 5;
  const totalPower = (column?.memberIds || []).reduce((sum, id) => sum + (id ? (members[id]?.power || 0) : 0), 0);
  const isSub = column?.type === "sub";

  return (
    <Draggable draggableId={column.id} index={index} isDragDisabled={!isAdmin}>
      {(providedTeam, snapshotTeam) => (
        <div ref={providedTeam.innerRef} {...providedTeam.draggableProps} className={`bg-white dark:bg-[#232733] rounded-2xl shadow-sm border overflow-hidden ${snapshotTeam.isDragging ? "shadow-xl ring-2 ring-[#0b3d63] dark:ring-[#4D73CD] border-[#0b3d63] dark:border-[#4D73CD] z-50" : "border-slate-200 dark:border-[#2D3342]"} ${column.locked ? "opacity-95 border-amber-400 dark:border-amber-500" : ""}`}>
          <div className={`${isSub ? "bg-[#154a72] dark:bg-[#1E2536]" : "bg-[#0b3d63] dark:bg-[#252E42]"} p-3.5 text-white flex items-center justify-between border-b border-transparent dark:border-[#2D3342]`} {...(isAdmin ? providedTeam.dragHandleProps : {})}>
            <div className="flex items-center gap-2">
              {isAdmin && <GripVertical size={16} className="opacity-50 cursor-grab active:cursor-grabbing" />}
              <h3 className="font-bold text-sm tracking-wide">{column.title}</h3>
              <span className="text-xs bg-black/20 px-2 py-0.5 rounded-md font-mono">{totalPower.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isFull ? "bg-emerald-500 text-white" : "bg-white/20 text-white"}`}>{isFull ? "ครบ 5/5" : `${(column?.memberIds || []).filter(id => id).length}/5`}</span>
              {isAdmin && (
                <>
                  <button onClick={() => toggleLock(column.id)} className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${column.locked ? "bg-amber-400 text-slate-900" : "bg-white/15 hover:bg-white/25 text-white"}`}>{column.locked ? <Lock size={12} /> : <Unlock size={12} />} {column.locked ? "ล็อก" : "ปลดล็อก"}</button>
                  <button onClick={() => clearTeam(column.id)} className="bg-red-500/80 hover:bg-red-600 text-white p-1 rounded-md transition-colors disabled:opacity-40" disabled={column.locked} title="ล้างทีม"><X size={12} strokeWidth={3} /></button>
                  {onRemoveFromZone && <button onClick={onRemoveFromZone} className="bg-white/10 hover:bg-red-500/80 text-white p-1 rounded-md transition-colors" title="ลบทีมออกจากโซน"><Trash2 size={12} /></button>}
                </>
              )}
            </div>
          </div>

          <div className={`grid ${isAdmin ? "grid-cols-[30px_minmax(0,1fr)_85px_50px_22px] sm:grid-cols-[36px_minmax(0,1fr)_115px_60px_24px]" : "grid-cols-[30px_minmax(0,1fr)_85px_50px] sm:grid-cols-[36px_minmax(0,1fr)_115px_60px]"} gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 bg-slate-50 dark:bg-[#272C38]/60 border-b border-slate-100 dark:border-[#2D3342] text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-[#8B93A7]`}>
            <div></div><div>ชื่อ</div><div className="text-center">อาชีพ</div><div className="text-right">ค่าพลัง</div>{isAdmin && <div></div>}
          </div>

          <div className="p-2 min-h-[220px] flex flex-col gap-1.5 relative bg-white dark:bg-[#232733]">
            {Array.from({ length: 5 }).map((_, slotIdx) => {
              const memberId = column?.memberIds?.[slotIdx];
              const droppableId = `${column.id}::${slotIdx}`;
              return (
                <Droppable key={droppableId} droppableId={droppableId} type="MEMBER" isDropDisabled={!isAdmin || column.locked}>
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className={`h-[38px] rounded-xl border ${snapshot.isDraggingOver ? "bg-blue-50 dark:bg-[#3B66D1]/25 border-[#0b3d63] dark:border-[#4D73CD]" : "border-transparent bg-slate-50/70 dark:bg-[#272C38]/40"} flex items-center relative transition-colors`}>
                      {!memberId && !snapshot.isDraggingOver && <div className="absolute inset-0 border border-dashed border-slate-200 dark:border-[#2D3342] rounded-xl flex items-center justify-center pointer-events-none"><span className="text-[10px] text-slate-400 font-bold tracking-wider">ว่าง {slotIdx + 1}</span></div>}
                      {memberId && (
                        <Draggable draggableId={memberId} index={0} isDragDisabled={!isAdmin || column.locked}>
                          {(prov, snap) => {
                            const m = members[memberId];
                            const color = (m?.job && JOB_COLORS[m.job]) || "#475569";
                            const rowContent = (
                              <div id={`member-assigned-${memberId}`} ref={prov.innerRef} {...prov.draggableProps} className={`w-full h-[38px] grid ${isAdmin ? "grid-cols-[30px_minmax(0,1fr)_85px_50px_22px] sm:grid-cols-[36px_minmax(0,1fr)_115px_60px_24px]" : "grid-cols-[30px_minmax(0,1fr)_85px_50px] sm:grid-cols-[36px_minmax(0,1fr)_115px_60px]"} gap-1.5 sm:gap-2 items-center px-2 py-1 rounded-xl bg-white dark:bg-[#272C38] hover:bg-slate-50 dark:hover:bg-[#2A2F3E] group border border-slate-100 dark:border-[#2D3342] transition-all ${snap.isDragging ? "shadow-2xl border-blue-400 dark:border-[#4D73CD] ring-2 ring-[#0b3d63]/20 z-[99999]" : "shadow-xs"}`} style={prov.draggableProps.style}>
                                <div className="flex items-center gap-0.5 sm:gap-1 text-slate-400 cursor-grab touch-none p-1 -m-1" {...(isAdmin ? prov.dragHandleProps : {})}>{isAdmin ? <GripVertical size={14} className="text-sky-300 dark:text-sky-400 shrink-0" /> : null}<span className="text-xs font-bold text-sky-500 font-mono w-3 text-center">{slotIdx + 1}</span></div>
                                <div className="min-w-0 pr-1"><span className="text-xs font-bold text-slate-800 dark:text-white truncate block" title={m?.name}>{m ? m.name : (memberId || "Unknown")}</span></div>
                                {m && <div className="h-[24px] sm:h-[26px] px-1.5 sm:px-3 rounded-full text-[10px] sm:text-xs font-bold text-white flex items-center justify-center gap-1 shadow-sm shrink-0 w-[85px] sm:w-[115px]" style={{ backgroundColor: color }}><span className="truncate">{m.job}</span><ChevronDown size={10} className="opacity-80 shrink-0 stroke-[2.5] hidden sm:inline-block" /></div>}
                                {m && <div className="text-[10px] sm:text-xs font-bold text-[#0b3d63] dark:text-white text-right tabular-nums shrink-0">{(m.power || 0).toLocaleString()}</div>}
                                {isAdmin && <button onClick={e => { e.stopPropagation(); removeMember(column.id, memberId); }} disabled={column.locked} className="text-sky-300 hover:text-red-500 dark:text-sky-400 dark:hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity flex justify-center disabled:hidden p-0.5" title="นำออกจากทีม"><X size={14} strokeWidth={2.5} /></button>}
                              </div>
                            );
                            if (snap.isDragging && typeof document !== "undefined") return createPortal(rowContent, document.body);
                            return rowContent;
                          }}
                        </Draggable>
                      )}
                      <div className="absolute inset-0 opacity-0 pointer-events-none overflow-hidden">{provided.placeholder}</div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </div>
      )}
    </Draggable>
  );
}

function MemberCard({ member, index }: { member?: Member; index: number }) {
  if (!member || !member.id) return null;
  const color = (member.job && JOB_COLORS[member.job]) || "#475569";
  const hexToRgba = (hex: string, alpha: number) => {
    if (!hex || !hex.startsWith("#") || hex.length < 7) return `rgba(71, 85, 105, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  return (
    <Draggable draggableId={member.id} index={index}>
      {(provided, snapshot) => {
        const content = (
          <div id={`member-unassigned-${member.id}`} ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
            className={`flex items-center justify-between p-2 rounded-xl border shadow-sm select-none transition-all touch-none ${snapshot.isDragging ? "shadow-2xl border-[#0b3d63] dark:border-[#4D73CD] z-[99999] ring-2 ring-[#0b3d63]/20 bg-white dark:bg-[#272C38]" : "border-slate-200 dark:border-[#2D3342] hover:border-slate-300"}`}
            style={{ ...provided.draggableProps.style, backgroundColor: snapshot.isDragging ? undefined : hexToRgba(color, 0.05), borderLeftWidth: "4px", borderLeftColor: color }}>
            <div className="flex flex-col truncate pr-2 min-w-0">
              <span className="text-[12px] font-bold text-slate-800 dark:text-white truncate">{member.name}</span>
              <span className="text-[9px] font-bold truncate opacity-90" style={{ color }}>{member.job}</span>
            </div>
            <div className="text-[11px] font-bold tabular-nums tracking-tight flex-shrink-0" style={{ color }}>{(member.power || 0).toLocaleString()}</div>
          </div>
        );
        if (snapshot.isDragging && typeof document !== "undefined") return createPortal(content, document.body);
        return content;
      }}
    </Draggable>
  );
}
