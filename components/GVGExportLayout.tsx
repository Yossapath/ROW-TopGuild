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

export const GVGExportLayout = forwardRef<HTMLDivElement, GVGExportLayoutProps>(
  ({ zones, columns, members, title = "GVG TEAM SETUP" }, ref) => {
    // Calculate total summary values
    const totalMembers = zones.reduce((sum, z) => {
      return (
        sum +
        z.teamOrder.reduce((tSum, colId) => {
          const col = columns[colId];
          return tSum + (col ? col.memberIds.filter(Boolean).length : 0);
        }, 0)
      );
    }, 0);

    const totalTeams = zones.reduce((sum, z) => sum + z.teamOrder.length, 0);

    const totalPower = zones.reduce((sum, z) => {
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

    // Determine grid columns: 3 columns if max teams in a zone <= 6, else 4 columns
    const maxTeamsInZone = Math.max(...zones.map((z) => z.teamOrder.length), 1);
    const gridColsClass = maxTeamsInZone > 6 ? "grid-cols-4" : "grid-cols-3";

    return (
      <div
        ref={ref}
        id="gvg-export-canvas"
        className="w-[2040px] bg-[#0b1329] text-white p-8 space-y-7 font-sans"
        style={{ boxSizing: "border-box", minHeight: "1400px" }}
      >
        {/* Main Header & Global Summary */}
        <div className="bg-[#111c35] border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/70 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-500 flex items-center justify-center font-black text-xl shadow-lg">
                🛡️
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-wider text-white uppercase">
                  {title}
                </h1>
                <p className="text-xs text-slate-400 font-semibold tracking-wide">
                  GUILD VS GUILD BATTLE SQUAD OVERVIEW
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-400 block">EXPORTED DATE</span>
              <span className="text-sm font-mono font-bold text-sky-400">
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
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm font-bold bg-[#0a1122]/80 px-6 py-3.5 rounded-xl border border-slate-700/50">
            {/* Zones summary badges */}
            <div className="flex items-center gap-5 flex-wrap">
              {zones.map((zone) => {
                const count = zone.teamOrder.reduce((sum, colId) => {
                  const col = columns[colId];
                  return sum + (col ? col.memberIds.filter(Boolean).length : 0);
                }, 0);
                const cap = zone.teamOrder.length > 0 ? zone.teamOrder.length * 5 : 60;
                const zoneDisplayName = zone.name.replace(/โซน/i, "Zone ").trim();
                return (
                  <div key={zone.id} className="flex items-center gap-2">
                    <span className="text-sky-300 font-black">{zoneDisplayName}:</span>
                    <span className="text-white font-mono bg-slate-800/80 border border-slate-600/50 px-2.5 py-0.5 rounded-md text-xs">
                      {count}/{cap} คน
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Total stats */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-black">สมาชิกทั้งหมด:</span>
                <span className="text-white font-mono bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-3 py-0.5 rounded-md text-xs">
                  {totalMembers} คน
                </span>
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <div className="flex items-center gap-2">
                <span className="text-purple-400 font-black">จำนวนทีม:</span>
                <span className="text-white font-mono bg-purple-500/20 border border-purple-500/40 text-purple-300 px-3 py-0.5 rounded-md text-xs">
                  {totalTeams} ทีม
                </span>
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-black">พลังรบรวม:</span>
                <span className="text-amber-300 font-mono bg-amber-400/20 border border-amber-400/40 px-3 py-0.5 rounded-md text-xs">
                  {totalPower.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Zones and Team Cards */}
        {zones.map((zone) => {
          const zoneMembersCount = zone.teamOrder.reduce((sum, colId) => {
            const col = columns[colId];
            return sum + (col ? col.memberIds.filter(Boolean).length : 0);
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

          const zoneHeading = zone.name.replace(/โซน/i, "ZONE ").trim().toUpperCase();

          return (
            <div key={zone.id} className="space-y-4">
              {/* Distinct Zone Header */}
              <div className="flex items-center justify-between pb-3 border-b-2 border-slate-700/80">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-7 bg-sky-500 rounded-full" />
                  <h2 className="text-2xl font-black text-white tracking-wider uppercase">
                    {zoneHeading}
                  </h2>
                  <span className="text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 px-3 py-1 rounded-full">
                    {zone.teamOrder.length} ทีม
                  </span>
                  <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full">
                    {zoneMembersCount} คน
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-400">
                  พลังรวมโซน:{" "}
                  <span className="font-mono text-amber-400 text-base font-bold">
                    {zonePower.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Team Cards Grid */}
              <div className={`grid ${gridColsClass} gap-4`}>
                {zone.teamOrder.map((colId) => {
                  const col = columns[colId];
                  if (!col) return null;

                  const assignedCount = col.memberIds.filter(Boolean).length;
                  const isFull = assignedCount === 5;
                  const teamPower = col.memberIds.reduce((sum, memId) => {
                    return sum + (memId && members[memId] ? members[memId].power || 0 : 0);
                  }, 0);

                  return (
                    <div
                      key={colId}
                      className="bg-[#141e33] rounded-xl border border-slate-700/80 overflow-hidden shadow-md flex flex-col"
                    >
                      {/* Team Card Header */}
                      <div className="bg-[#0e172a] px-4 py-2.5 border-b border-slate-700/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white tracking-wide">
                            {col.title.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-amber-300 bg-amber-400/15 border border-amber-400/25 px-2 py-0.5 rounded">
                            Power: {teamPower.toLocaleString()}
                          </span>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              isFull
                                ? "bg-emerald-500 text-white"
                                : "bg-slate-700/80 text-slate-300"
                            }`}
                          >
                            {assignedCount}/5
                          </span>
                        </div>
                      </div>

                      {/* Team Member Rows (5 slots) */}
                      <div className="p-2 space-y-1.5 flex-1 bg-[#10182b]">
                        {Array.from({ length: 5 }).map((_, slotIdx) => {
                          const memberId = col.memberIds[slotIdx];
                          const m = memberId ? members[memberId] : null;
                          const jobColor = (m?.job && JOB_COLORS[m.job]) || "#475569";

                          if (!m) {
                            return (
                              <div
                                key={slotIdx}
                                className="h-9 px-3 rounded-lg border border-dashed border-slate-800 bg-[#0a101f]/60 flex items-center justify-between text-slate-600"
                              >
                                <span className="text-xs font-mono font-bold text-slate-600 w-4">
                                  {slotIdx + 1}
                                </span>
                                <span className="text-xs font-medium italic text-slate-600 flex-1 pl-2">
                                  - ว่าง -
                                </span>
                                <span className="text-xs text-slate-700 font-mono">-</span>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={slotIdx}
                              className="h-9 px-3 rounded-lg border border-slate-700/60 bg-[#16223b] flex items-center gap-2.5 shadow-xs"
                            >
                              <span className="text-xs font-mono font-extrabold text-sky-400 w-4 text-center shrink-0">
                                {slotIdx + 1}
                              </span>
                              <span
                                className="text-xs font-bold text-white truncate flex-1 min-w-0"
                                title={m.name}
                              >
                                {m.name}
                              </span>
                              <span
                                className="text-[10px] font-bold text-white px-2.5 py-0.5 rounded-full shrink-0 shadow-xs text-center"
                                style={{ backgroundColor: jobColor }}
                              >
                                {m.job}
                              </span>
                              <span className="text-xs font-bold text-amber-300 font-mono text-right shrink-0 tabular-nums w-16">
                                {(m.power || 0).toLocaleString()}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {zone.teamOrder.length === 0 && (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl bg-[#0a101f]/40 font-bold">
                  ไม่มีทีมในโซนนี้
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
);

GVGExportLayout.displayName = "GVGExportLayout";
export default GVGExportLayout;
