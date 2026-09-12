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

// Leader = member with highest power in the team
function getTeamLeader(col: Column | undefined, members: Record<string, Member>): string {
  if (!col) return "ว่าง";
  const assigned = col.memberIds
    .map((id) => (id ? members[id] : null))
    .filter((m): m is Member => m != null && Boolean(m.name));

  if (assigned.length === 0) return "ว่าง";
  const leader = assigned.reduce((top, m) => ((m.power ?? 0) > (top.power ?? 0) ? m : top), assigned[0]);
  return leader.name;
}

export const GVGExportLayout = forwardRef<HTMLDivElement, GVGExportLayoutProps>(
  ({ zones, columns, members, title = "GVG TEAM SETUP" }, ref) => {
    const activeZones = zones
      .map((zone) => ({
        ...zone,
        teamOrder: zone.teamOrder.filter((colId) => {
          const col = columns[colId];
          return col && col.memberIds.some((id) => id && members[id]);
        }),
      }))
      .filter((zone) => zone.teamOrder.length > 0);

    const totalMembers = activeZones.reduce((sum, z) =>
      sum + z.teamOrder.reduce((tSum, colId) => {
        const col = columns[colId];
        return tSum + (col ? col.memberIds.filter((id) => id && members[id]).length : 0);
      }, 0), 0);

    const totalTeams = activeZones.reduce((sum, z) => sum + z.teamOrder.length, 0);

    const totalPower = activeZones.reduce((sum, z) =>
      sum + z.teamOrder.reduce((tSum, colId) => {
        const col = columns[colId];
        if (!col) return tSum;
        return tSum + col.memberIds.reduce((mSum, memId) =>
          mSum + (memId && members[memId] ? members[memId].power || 0 : 0), 0);
      }, 0), 0);

    const hasMultipleZones = activeZones.length >= 2;

    return (
      <div
        ref={ref}
        id="gvg-export-canvas"
        style={{
          width: "2400px",
          boxSizing: "border-box",
          backgroundColor: "#f1f5f9",
          padding: "36px",
          fontFamily: "'Segoe UI', 'Noto Sans Thai', sans-serif",
          color: "#1e293b",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
          borderRadius: "16px",
          padding: "24px 32px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 4px 20px rgba(37,99,235,0.3)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{
              width: "56px", height: "56px",
              background: "rgba(255,255,255,0.2)",
              borderRadius: "12px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "28px",
            }}>🛡️</div>
            <div>
              <div style={{ fontSize: "26px", fontWeight: 900, color: "#fff", letterSpacing: "0.04em", lineHeight: 1.2 }}>
                {title === "GVG TEAM SETUP" ? "รายชื่อผู้เล่นสนามหลัก (GVG TEAM SETUP)" : title}
              </div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", fontWeight: 700, letterSpacing: "0.08em", marginTop: "4px" }}>
                GUILD VS GUILD BATTLE SQUAD ROSTER • {activeZones.length} ZONE{activeZones.length > 1 ? "S" : ""}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "4px" }}>EXPORTED DATE</div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#fff", fontFamily: "monospace" }}>
              {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>

        {/* ── Summary Bar ── */}
        <div style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "16px 28px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          border: "2px solid #bfdbfe",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}>
          <div style={{ display: "flex", gap: "28px", flexWrap: "wrap" }}>
            {activeZones.map((zone) => {
              const count = zone.teamOrder.reduce((sum, colId) => {
                const col = columns[colId];
                return sum + (col ? col.memberIds.filter((id) => id && members[id]).length : 0);
              }, 0);
              const cap = zone.teamOrder.length * 5;
              return (
                <div key={zone.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: 900, color: "#1e3a8a", fontSize: "15px" }}>{zone.name}:</span>
                  <span style={{
                    fontFamily: "monospace", fontWeight: 800, color: "#1d4ed8",
                    background: "#eff6ff", border: "1.5px solid #bfdbfe",
                    borderRadius: "8px", padding: "3px 12px", fontSize: "14px",
                  }}>{count}/{cap} คน</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            {[
              { label: "สมาชิกทั้งหมด", value: `${totalMembers} คน`, bg: "#f0fdf4", border: "#86efac", color: "#166534" },
              { label: "จำนวนทีม", value: `${totalTeams} ทีม`, bg: "#faf5ff", border: "#d8b4fe", color: "#6b21a8" },
              { label: "พลังรบรวม", value: totalPower.toLocaleString(), bg: "#fffbeb", border: "#fcd34d", color: "#78350f" },
            ].map(({ label, value, bg, border, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontWeight: 800, color, fontSize: "14px" }}>{label}:</span>
                <span style={{
                  fontFamily: "monospace", fontWeight: 800, color,
                  background: bg, border: `1.5px solid ${border}`,
                  borderRadius: "8px", padding: "3px 14px", fontSize: "14px",
                }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {activeZones.length === 0 && (
          <div style={{ padding: "64px", textAlign: "center", color: "#94a3b8", border: "2px dashed #cbd5e1", borderRadius: "16px", background: "#fff", fontSize: "18px", fontWeight: 700 }}>
            ไม่มีทีมที่มีสมาชิกสำหรับการ Export
          </div>
        )}

        {/* ── Zones Grid ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: hasMultipleZones ? "1fr 1fr" : "1fr",
          gap: "24px",
          alignItems: "start",
        }}>
          {activeZones.map((zone, zIdx) => {
            const zoneMembersCount = zone.teamOrder.reduce((sum, colId) => {
              const col = columns[colId];
              return sum + (col ? col.memberIds.filter((id) => id && members[id]).length : 0);
            }, 0);
            const zonePower = zone.teamOrder.reduce((sum, colId) => {
              const col = columns[colId];
              if (!col) return sum;
              return sum + col.memberIds.reduce((mSum, memId) =>
                mSum + (memId && members[memId] ? members[memId].power || 0 : 0), 0);
            }, 0);

            const zoneLeader = zone.teamOrder.length > 0 ? getTeamLeader(columns[zone.teamOrder[0]], members) : "ว่าง";
            const sideLabel = zIdx === 0 ? " (ซ้าย)" : zIdx === 1 ? " (ขวา)" : "";
            const zoneHeading = `${zone.name}${sideLabel} — หัวตี้: ${zoneLeader} (${zoneMembersCount} คน)`;

            // Teams per row inside zone: if multiple zones show 2 cols, else 3 cols
            const teamsCount = zone.teamOrder.length;
            const teamCols = hasMultipleZones
              ? (teamsCount > 3 ? 2 : 1)
              : (teamsCount > 6 ? 4 : teamsCount > 3 ? 3 : 2);

            return (
              <div key={zone.id} style={{
                border: "2px solid #2563eb",
                borderRadius: "14px",
                background: "#f8fafc",
                overflow: "hidden",
                boxShadow: "0 2px 12px rgba(37,99,235,0.12)",
              }}>
                {/* Zone Header */}
                <div style={{
                  background: "linear-gradient(90deg, #1e40af 0%, #2563eb 100%)",
                  color: "#fff",
                  padding: "14px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: "17px", fontWeight: 900, letterSpacing: "0.02em" }}>{zoneHeading}</span>
                  <span style={{
                    fontFamily: "monospace", fontSize: "14px", fontWeight: 800,
                    background: "rgba(255,255,255,0.2)", borderRadius: "8px",
                    padding: "4px 14px", whiteSpace: "nowrap",
                  }}>Power: {zonePower.toLocaleString()}</span>
                </div>

                {/* Teams Grid */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${teamCols}, 1fr)`,
                  gap: "12px",
                  padding: "14px",
                }}>
                  {zone.teamOrder.map((colId) => {
                    const col = columns[colId];
                    if (!col) return null;

                    const teamLeader = getTeamLeader(col, members);
                    const assignedMembers = col.memberIds
                      .map((id, idx) => ({ id, slotIdx: idx, member: id ? members[id] : null }))
                      .filter((item): item is { id: string; slotIdx: number; member: Member } => item.member != null);

                    const assignedCount = assignedMembers.length;
                    const teamPower = assignedMembers.reduce((sum, item) => sum + (item.member.power || 0), 0);

                    return (
                      <div key={colId} style={{
                        background: "#fff",
                        border: "1.5px solid #cbd5e1",
                        borderRadius: "10px",
                        overflow: "hidden",
                        boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
                      }}>
                        {/* Team Header */}
                        <div style={{
                          background: "#dbeafe",
                          borderBottom: "1.5px solid #bfdbfe",
                          padding: "10px 14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                        }}>
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                            <span style={{ fontSize: "15px", fontWeight: 900, color: "#1e3a8a", lineHeight: 1.2 }}>
                              {col.title}
                            </span>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#1d4ed8", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              หัวตี้: {teamLeader}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                            <span style={{
                              fontFamily: "monospace", fontSize: "13px", fontWeight: 800,
                              color: "#1e3a8a", background: "rgba(255,255,255,0.8)",
                              border: "1px solid #bfdbfe", borderRadius: "6px", padding: "2px 10px",
                            }}>{teamPower.toLocaleString()}</span>
                            <span style={{
                              fontSize: "12px", fontWeight: 900, color: "#fff",
                              background: assignedCount === 5 ? "#16a34a" : "#2563eb",
                              borderRadius: "20px", padding: "2px 10px",
                            }}>{assignedCount}/5</span>
                          </div>
                        </div>

                        {/* Column Headers */}
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "36px 1fr 130px 88px",
                          background: "#f1f5f9",
                          borderBottom: "1.5px solid #e2e8f0",
                          padding: "0",
                        }}>
                          {["#", "ชื่อตัวละคร", "อาชีพ", "ค่าพลัง"].map((h, i) => (
                            <div key={h} style={{
                              fontSize: "12px", fontWeight: 800, color: "#475569",
                              padding: "7px 8px",
                              textAlign: i === 0 ? "center" : i === 3 ? "right" : i === 2 ? "center" : "left",
                              borderRight: i < 3 ? "1px solid #e2e8f0" : undefined,
                            }}>{h}</div>
                          ))}
                        </div>

                        {/* Rows */}
                        {Array.from({ length: 5 }).map((_, slotIdx) => {
                          const memberId = col.memberIds[slotIdx];
                          const m = memberId ? members[memberId] : null;
                          const jobColor = (m?.job && JOB_COLORS[m.job]) || "#475569";
                          const isOdd = slotIdx % 2 === 1;

                          if (!m) {
                            return (
                              <div key={slotIdx} style={{
                                display: "grid",
                                gridTemplateColumns: "36px 1fr 130px 88px",
                                background: isOdd ? "#f8fafc" : "#fff",
                                borderBottom: slotIdx < 4 ? "1px solid #f1f5f9" : undefined,
                              }}>
                                <div style={{ fontSize: "13px", fontFamily: "monospace", color: "#94a3b8", fontWeight: 700, padding: "9px 8px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>{slotIdx + 1}</div>
                                <div style={{ fontSize: "13px", color: "#94a3b8", fontStyle: "italic", padding: "9px 10px", borderRight: "1px solid #f1f5f9" }}>— ว่าง —</div>
                                <div style={{ fontSize: "13px", color: "#94a3b8", padding: "9px 8px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>-</div>
                                <div style={{ fontSize: "13px", color: "#94a3b8", padding: "9px 10px", textAlign: "right", fontFamily: "monospace" }}>-</div>
                              </div>
                            );
                          }

                          return (
                            <div key={slotIdx} style={{
                              display: "grid",
                              gridTemplateColumns: "36px 1fr 130px 88px",
                              background: isOdd ? "#f8fafc" : "#fff",
                              borderBottom: slotIdx < 4 ? "1px solid #f1f5f9" : undefined,
                              alignItems: "center",
                            }}>
                              {/* # */}
                              <div style={{
                                fontSize: "13px", fontFamily: "monospace", fontWeight: 900,
                                color: "#2563eb", padding: "9px 8px", textAlign: "center",
                                borderRight: "1px solid #f1f5f9",
                              }}>{slotIdx + 1}</div>

                              {/* ชื่อ */}
                              <div style={{
                                fontSize: "13px", fontWeight: 700, color: "#0f172a",
                                padding: "9px 10px", overflow: "hidden",
                                textOverflow: "ellipsis", whiteSpace: "nowrap",
                                borderRight: "1px solid #f1f5f9",
                              }} title={m.name}>{m.name}</div>

                              {/* อาชีพ */}
                              <div style={{
                                padding: "6px 8px", textAlign: "center",
                                borderRight: "1px solid #f1f5f9",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                                <span style={{
                                  fontSize: "11px", fontWeight: 800, color: "#fff",
                                  background: jobColor,
                                  borderRadius: "6px",
                                  padding: "3px 10px",
                                  display: "inline-block",
                                  maxWidth: "118px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  letterSpacing: "0.02em",
                                }}>{m.job}</span>
                              </div>

                              {/* ค่าพลัง */}
                              <div style={{
                                fontSize: "13px", fontFamily: "monospace", fontWeight: 800,
                                color: "#1e40af", padding: "9px 10px", textAlign: "right",
                              }}>{(m.power || 0).toLocaleString()}</div>
                            </div>
                          );
                        })}
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
