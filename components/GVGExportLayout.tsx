"use client";

import React, { forwardRef } from "react";
import { JOB_COLORS } from "@/lib/utils";

type Member = { id: string; name: string; job: string; power: number };
type Column = { id: string; title: string; memberIds: (string | null)[]; type: "main" | "sub" | "unassigned"; locked: boolean };
type Zone = { id: string; name: string; type: "main" | "sub"; teamOrder: string[] };

interface GVGExportLayoutProps {
  zones: Zone[];
  columns: Record<string, Column>;
  members: Record<string, Member>;
  title?: string;
}

// UX 3: Leader = member with highest power in the team (flexible, no hardcoded names)
function getTeamLeader(col: Column | undefined, members: Record<string, Member>): string {
  if (!col) return "ว่าง";
  const assigned = col.memberIds
    .map((id) => (id ? members[id] : null))
    // Fix: use != null (loose) to guard against both null AND undefined (when members[id] doesn't exist)
    .filter((m): m is Member => m != null && Boolean(m.name));

  if (assigned.length === 0) return "ว่าง";

  // Return the member with the highest power as team leader
  const leader = assigned.reduce((top, m) => ((m.power ?? 0) > (top.power ?? 0) ? m : top), assigned[0]);
  return leader.name;
}

export const GVGExportLayout = forwardRef<HTMLDivElement, GVGExportLayoutProps>(
  ({ zones, columns, members, title = "GVG TEAM SETUP" }, ref) => {
    // Filter only teams that have at least one valid member (Topguild logic: Skip empty teams)
    const activeZones = zones
      .map((zone) => {
        const activeTeamOrder = zone.teamOrder.filter((colId) => {
          const col = columns[colId];
          return col && col.memberIds.some((id) => id && members[id]);
        });
        return {
          ...zone,
          teamOrder: activeTeamOrder,
        };
      })
      .filter((zone) => zone.teamOrder.length > 0);

    // Calculate total summary statistics based on active teams
    const totalMembers = activeZones.reduce((sum, z) => {
      return (
        sum +
        z.teamOrder.reduce((tSum, colId) => {
          const col = columns[colId];
          return tSum + (col ? col.memberIds.filter((id) => id && members[id]).length : 0);
        }, 0)
      );
    }, 0);

    const totalTeams = activeZones.reduce((sum, z) => sum + z.teamOrder.length, 0);

    const totalPower = activeZones.reduce((sum, z) => {
      return (
        sum +
        z.teamOrder.reduce((tSum, colId) => {
          const col = columns[colId];
          if (!col) return tSum;
          return (
            tSum +
            col.memberIds.reduce((mSum, memId) => {
              return mSum + (memId && members[memId] ? members[memId].power || 0 : 0);
            }, 0)
          );
        }, 0)
      );
    }, 0);

    // Layout configuration:
    // If 2 zones (e.g. Zone 1 & Zone 2): Side-by-side 2-column layout (Topguild layout!)
    // If 1 zone: Full width with 3 or 4 team columns
    const hasMultipleZones = activeZones.length >= 2;

    return (
      <div
        ref={ref}
        id="gvg-export-canvas"
        className="w-[2200px] bg-[#f8fafc] text-slate-800 p-8 space-y-6 font-sans select-none"
        style={{ boxSizing: "border-box", minHeight: "1450px", lineHeight: 1.2 }}
      >
        {/* Main Document Header (Topguild Style) */}
        <div className="bg-white border-2 border-[#2563eb] rounded-2xl p-5 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#1e3a8a] to-[#2563eb] flex items-center justify-center font-black text-2xl text-white shadow-md">
                🛡️
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-wide text-[#1e3a8a] uppercase">
                  {title === "GVG TEAM SETUP" ? "รายชื่อผู้เล่นสนามหลัก (GVG TEAM SETUP)" : title}
                </h1>
                <p className="text-xs text-slate-500 font-bold tracking-wider uppercase">
                  GUILD VS GUILD BATTLE SQUAD ROSTER • {activeZones.length} ZONE{activeZones.length > 1 ? "S" : ""}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-400 block tracking-wider uppercase">EXPORTED DATE</span>
              <span className="text-sm font-mono font-bold text-[#2563eb]">
                {new Date().toLocaleDateString("th-TH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          {/* Top Summary Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm font-bold bg-[#eff6ff] px-5 py-2.5 rounded-xl border border-blue-200">
            {/* Zones summary badges */}
            <div className="flex items-center gap-4 flex-wrap">
              {activeZones.map((zone) => {
                const count = zone.teamOrder.reduce((sum, colId) => {
                  const col = columns[colId];
                  return sum + (col ? col.memberIds.filter((id) => id && members[id]).length : 0);
                }, 0);
                const cap = zone.teamOrder.length * 5;
                const zoneDisplayName = zone.name.replace(/โซน/i, "Zone ").trim();
                return (
                  <div key={zone.id} className="flex items-center gap-2">
                    <span className="text-[#1e3a8a] font-black">{zoneDisplayName}:</span>
                    <span className="text-[#1e3a8a] font-mono bg-white border border-blue-300 px-2.5 py-0.5 rounded-md text-xs shadow-xs">
                      {count}/{cap} คน
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Total stats */}
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <span className="text-emerald-700 font-black">สมาชิกทั้งหมด:</span>
                <span className="text-emerald-800 font-mono bg-emerald-100 border border-emerald-300 px-3 py-0.5 rounded-md text-xs shadow-xs">
                  {totalMembers} คน
                </span>
              </div>
              <div className="h-4 w-px bg-blue-200" />
              <div className="flex items-center gap-2">
                <span className="text-purple-700 font-black">จำนวนทีม:</span>
                <span className="text-purple-800 font-mono bg-purple-100 border border-purple-300 px-3 py-0.5 rounded-md text-xs shadow-xs">
                  {totalTeams} ทีม
                </span>
              </div>
              <div className="h-4 w-px bg-blue-200" />
              <div className="flex items-center gap-2">
                <span className="text-amber-700 font-black">พลังรบรวม:</span>
                <span className="text-amber-900 font-mono bg-amber-100 border border-amber-300 px-3 py-0.5 rounded-md text-xs shadow-xs">
                  {totalPower.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* If no active teams are present */}
        {activeZones.length === 0 && (
          <div className="p-16 text-center text-slate-400 border-2 border-dashed border-slate-300 rounded-2xl bg-white font-bold text-lg">
            ไม่มีทีมที่มีสมาชิกสำหรับการ Export
          </div>
        )}

        {/* Zones Container - Two columns side-by-side if multiple zones (Topguild Layout) */}
        <div className={`grid ${hasMultipleZones ? "grid-cols-2 gap-6" : "grid-cols-1"} items-start`}>
          {activeZones.map((zone, zIdx) => {
            const zoneMembersCount = zone.teamOrder.reduce((sum, colId) => {
              const col = columns[colId];
              return sum + (col ? col.memberIds.filter((id) => id && members[id]).length : 0);
            }, 0);

            const zonePower = zone.teamOrder.reduce((sum, colId) => {
              const col = columns[colId];
              if (!col) return sum;
              return (
                sum +
                col.memberIds.reduce((mSum, memId) => {
                  return mSum + (memId && members[memId] ? members[memId].power || 0 : 0);
                }, 0)
              );
            }, 0);

            // Zone Leader detection (Topguild logic)
            const zoneLeader =
              zone.teamOrder.length > 0 ? getTeamLeader(columns[zone.teamOrder[0]], members) : "ว่าง";

            const sideLabel = zIdx === 0 ? " (ซ้าย)" : zIdx === 1 ? " (ขวา)" : "";
            const zoneHeading = `${zone.name}${sideLabel} - หัวตี้: ${zoneLeader} (${zoneMembersCount} คน)`;

            // Teams grid inside this zone column:
            // If zone has <= 3 teams: 1 column
            // If zone has > 3 teams: 2 columns side-by-side
            const teamsInZoneCount = zone.teamOrder.length;
            const zoneTeamsGridClass =
              hasMultipleZones
                ? teamsInZoneCount > 3
                  ? "grid-cols-2"
                  : "grid-cols-1"
                : teamsInZoneCount > 6
                ? "grid-cols-4"
                : teamsInZoneCount > 3
                ? "grid-cols-3"
                : "grid-cols-2";

            return (
              <div
                key={zone.id}
                className="border-2 border-[#2563eb] rounded-xl p-4 bg-[#f8fafc] shadow-sm flex flex-col space-y-4"
              >
                {/* Zone Main Title Header (Topguild Style: .main-team-title) */}
                <div className="bg-[#2563eb] text-white text-center py-2.5 px-4 rounded-lg shadow-sm flex items-center justify-between">
                  <span className="text-base font-black tracking-wide">{zoneHeading}</span>
                  <span className="text-xs font-mono font-bold bg-white/20 px-2.5 py-0.5 rounded text-white">
                    Power: {zonePower.toLocaleString()}
                  </span>
                </div>

                {/* Teams Grid inside Zone */}
                <div className={`grid ${zoneTeamsGridClass} gap-3.5`}>
                  {zone.teamOrder.map((colId) => {
                    const col = columns[colId];
                    if (!col) return null;

                    const teamLeader = getTeamLeader(col, members);
                    const assignedMembers = col.memberIds
                      .map((id, idx) => ({ id, slotIdx: idx, member: id ? members[id] : null }))
                      // Fix: use != null to guard against both null AND undefined
                      .filter((item): item is { id: string; slotIdx: number; member: Member } => item.member != null);

                    const assignedCount = assignedMembers.length;
                    const teamPower = assignedMembers.reduce((sum, item) => sum + (item.member?.power || 0), 0);

                    return (
                      <div
                        key={colId}
                        className="bg-white border border-[#cbd5e1] rounded-lg overflow-hidden shadow-xs flex flex-col"
                      >
                        {/* Team Title Header (Topguild Style: .party-title) */}
                        <div className="bg-[#bfdbfe] text-[#1e3a8a] px-3 py-1.5 border-b border-[#cbd5e1] flex items-center justify-between font-bold text-xs">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-black text-sm">{col.title}</span>
                            <span className="text-[11px] text-[#1d4ed8] truncate">(หัวตี้: {teamLeader})</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono text-[11px] text-[#1e3a8a] bg-white/70 px-1.5 py-0.5 rounded border border-blue-200">
                              {teamPower.toLocaleString()}
                            </span>
                            <span className="bg-[#2563eb] text-white px-2 py-0.5 rounded-full text-[10px] font-black">
                              {assignedCount}/5
                            </span>
                          </div>
                        </div>

                        {/* Team Member Table (Topguild Style: table) */}
                        <table className="w-full border-collapse text-xs table-fixed">
                          <thead>
                            <tr className="bg-[#e2e8f0] text-[#334155] border-b border-[#cbd5e1] text-[11px] font-bold">
                              <th className="w-10 py-1.5 px-1.5 text-center border-r border-[#cbd5e1]">ลำดับ</th>
                              <th className="w-[35%] py-1.5 px-2 text-left border-r border-[#cbd5e1]">ชื่อตัวละคร</th>
                              <th className="w-[35%] py-1.5 px-1.5 text-center border-r border-[#cbd5e1]">อาชีพ</th>
                              <th className="w-[30%] py-1.5 px-2 text-right">ค่าพลัง</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#cbd5e1]">
                            {(() => {
                              const sortedMembers: (Member | null)[] = assignedMembers
                                .map((item) => item.member)
                                .sort((a, b) => (b.power || 0) - (a.power || 0));
                              while (sortedMembers.length < 5) sortedMembers.push(null);

                              return sortedMembers.map((m, rowIdx) => {
                                const jobColor = (m?.job && JOB_COLORS[m.job]) || "#475569";

                                if (!m) {
                                  return (
                                    <tr key={`empty-${rowIdx}`} className="h-8 bg-slate-50/50 text-slate-400 text-[11px]">
                                      <td className="text-center font-mono border-r border-[#cbd5e1] text-slate-400 font-bold">
                                        {rowIdx + 1}
                                      </td>
                                      <td className="px-2 italic text-slate-400 border-r border-[#cbd5e1] truncate">- ว่าง -</td>
                                      <td className="text-center text-slate-400 border-r border-[#cbd5e1]">-</td>
                                      <td className="text-right px-2 font-mono text-slate-400">-</td>
                                    </tr>
                                  );
                                }

                                return (
                                  <tr
                                    key={`member-${rowIdx}`}
                                    className="h-8 hover:bg-blue-50/40 transition-colors text-[11px] bg-white"
                                  >
                                    <td className="text-center font-mono font-black text-[#2563eb] border-r border-[#cbd5e1]">
                                      {rowIdx + 1}
                                    </td>
                                    <td
                                      className="px-2 font-bold text-slate-900 truncate border-r border-[#cbd5e1]"
                                      title={m.name}
                                    >
                                      {m.name}
                                    </td>
                                    <td className="px-1.5 text-center border-r border-[#cbd5e1]">
                                      <div
                                        className="inline-flex items-center justify-center text-[10px] font-bold text-white px-2 py-0.5 rounded-md shadow-xs w-full max-w-[90px] truncate"
                                        style={{ backgroundColor: jobColor }}
                                      >
                                        {m.job}
                                      </div>
                                    </td>
                                    <td className="text-right px-2 font-mono font-bold text-[#1e3a8a]">
                                      {(m.power || 0).toLocaleString()}
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

GVGExportLayout.displayName = "GVGExportLayout";
export default GVGExportLayout;
