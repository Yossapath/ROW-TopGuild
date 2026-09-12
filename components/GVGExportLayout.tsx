"use client";

import React, { forwardRef } from "react";
import { JOB_COLORS } from "@/lib/utils";

type Member = { id: string; name: string; job: string; power: number };
type Column = {
  id: string;
  title: string;
  memberIds: (string | null)[];
  type: "main" | "sub" | "unassigned";
  locked: boolean;
};
type Zone = { id: string; name: string; type: "main" | "sub"; teamOrder: string[] };

interface GVGExportLayoutProps {
  zones: Zone[];
  columns: Record<string, Column>;
  members: Record<string, Member>;
  title?: string;
}

function getTeamLeader(col: Column | undefined, members: Record<string, Member>): string {
  if (!col) return "ว่าง";
  const assigned = col.memberIds
    .map((id) => (id ? members[id] : null))
    .filter((m): m is Member => m != null && Boolean(m.name));
  if (assigned.length === 0) return "ว่าง";
  return assigned.reduce((top, m) => ((m.power ?? 0) > (top.power ?? 0) ? m : top), assigned[0]).name;
}

// ─── Zone accent colors ───────────────────────────────────────────
const ZONE_PALETTES = [
  { header: "linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%)", border: "#2563eb", teamHeaderBg: "#dbeafe", teamHeaderText: "#1e3a8a", teamHeaderBorder: "#93c5fd" },
  { header: "linear-gradient(135deg,#064e3b 0%,#059669 100%)", border: "#059669", teamHeaderBg: "#d1fae5", teamHeaderText: "#064e3b", teamHeaderBorder: "#6ee7b7" },
  { header: "linear-gradient(135deg,#4c1d95 0%,#7c3aed 100%)", border: "#7c3aed", teamHeaderBg: "#ede9fe", teamHeaderText: "#4c1d95", teamHeaderBorder: "#c4b5fd" },
  { header: "linear-gradient(135deg,#78350f 0%,#d97706 100%)", border: "#d97706", teamHeaderBg: "#fef3c7", teamHeaderText: "#78350f", teamHeaderBorder: "#fcd34d" },
];

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

    const totalMembers = activeZones.reduce(
      (s, z) => s + z.teamOrder.reduce((ts, colId) => {
        const col = columns[colId];
        return ts + (col ? col.memberIds.filter((id) => id && members[id]).length : 0);
      }, 0), 0);

    const totalTeams = activeZones.reduce((s, z) => s + z.teamOrder.length, 0);

    const totalPower = activeZones.reduce(
      (s, z) => s + z.teamOrder.reduce((ts, colId) => {
        const col = columns[colId];
        if (!col) return ts;
        return ts + col.memberIds.reduce((ms, mid) => ms + (mid && members[mid] ? members[mid].power || 0 : 0), 0);
      }, 0), 0);

    // ── canvas & column sizing ────────────────────────────────────
    // Zones sit side-by-side; teams inside each zone stack vertically
    const CANVAS_W = 2400;
    const PAD = 36;
    const ZONE_GAP = 20;
    const N = activeZones.length || 1;
    const ZONE_W = Math.floor((CANVAS_W - PAD * 2 - ZONE_GAP * (N - 1)) / N);

    // Table column widths — # fixed, then ชื่อ 35% / อาชีพ 35% / ค่าพลัง 30%
    const COL_SLOT = 46;
    // Subtract: zone border (2.5×2=5) + zone inner padding (12×2=24) + team card border (1.5×2=3) = 32px
    const REMAINING = ZONE_W - COL_SLOT - 32;
    const COL_NAME = Math.floor(REMAINING * 0.35);
    const COL_JOB  = Math.floor(REMAINING * 0.35);
    const COL_PWR  = REMAINING - COL_NAME - COL_JOB; // ~30%

    return (
      <div
        ref={ref}
        id="gvg-export-canvas"
        style={{
          width: `${CANVAS_W}px`,
          boxSizing: "border-box",
          background: "#f1f5f9",
          padding: `${PAD}px`,
          fontFamily: "'Segoe UI','Noto Sans Thai',Arial,sans-serif",
          color: "#0f172a",
        }}
      >
        {/* ═══════════════ HEADER ═══════════════ */}
        <div style={{
          background: "linear-gradient(135deg,#0f172a 0%,#1e3a8a 60%,#2563eb 100%)",
          borderRadius: "18px",
          padding: "28px 36px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 6px 32px rgba(37,99,235,0.28)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div style={{
              width: "64px", height: "64px",
              background: "rgba(255,255,255,0.15)",
              borderRadius: "14px", border: "1.5px solid rgba(255,255,255,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "32px",
            }}>🛡️</div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: "#fff", letterSpacing: "0.03em", lineHeight: 1.15 }}>
                {title === "GVG TEAM SETUP" ? "รายชื่อผู้เล่นสนามหลัก (GVG TEAM SETUP)" : title}
              </div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", fontWeight: 700, letterSpacing: "0.09em", marginTop: "5px" }}>
                GUILD VS GUILD BATTLE SQUAD ROSTER • {activeZones.length} ZONE{activeZones.length > 1 ? "S" : ""}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "5px" }}>EXPORTED DATE</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#fff", fontFamily: "monospace" }}>
              {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>

        {/* ═══════════════ SUMMARY BAR ═══════════════ */}
        <div style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "15px 28px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          border: "2px solid #bfdbfe",
          boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
        }}>
          {/* Per-zone counts */}
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "center" }}>
            {activeZones.map((zone, zIdx) => {
              const pal = ZONE_PALETTES[zIdx % ZONE_PALETTES.length];
              const count = zone.teamOrder.reduce((s, colId) => {
                const col = columns[colId];
                return s + (col ? col.memberIds.filter((id) => id && members[id]).length : 0);
              }, 0);
              const cap = zone.teamOrder.length * 5;
              return (
                <div key={zone.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: pal.border, flexShrink: 0 }} />
                  <span style={{ fontWeight: 900, color: "#1e293b", fontSize: "15px" }}>{zone.name}:</span>
                  <span style={{
                    fontFamily: "monospace", fontWeight: 800, color: pal.teamHeaderText,
                    background: pal.teamHeaderBg, border: `1.5px solid ${pal.teamHeaderBorder}`,
                    borderRadius: "8px", padding: "3px 14px", fontSize: "14px",
                  }}>{count}/{cap} คน</span>
                </div>
              );
            })}
          </div>
          {/* Totals */}
          <div style={{ display: "flex", gap: "18px", alignItems: "center" }}>
            {[
              { label: "สมาชิกทั้งหมด", val: `${totalMembers} คน`, bg: "#f0fdf4", bd: "#86efac", col: "#166534" },
              { label: "จำนวนทีม",       val: `${totalTeams} ทีม`,   bg: "#faf5ff", bd: "#d8b4fe", col: "#6b21a8" },
              { label: "พลังรบรวม",      val: totalPower.toLocaleString(), bg: "#fffbeb", bd: "#fcd34d", col: "#78350f" },
            ].map(({ label, val, bg, bd, col }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontWeight: 800, color: col, fontSize: "14px" }}>{label}:</span>
                <span style={{
                  fontFamily: "monospace", fontWeight: 800, color: col,
                  background: bg, border: `1.5px solid ${bd}`,
                  borderRadius: "8px", padding: "3px 16px", fontSize: "14px",
                }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {activeZones.length === 0 && (
          <div style={{ padding: "80px", textAlign: "center", color: "#94a3b8", border: "2px dashed #cbd5e1", borderRadius: "16px", background: "#fff", fontSize: "20px", fontWeight: 700 }}>
            ไม่มีทีมที่มีสมาชิกสำหรับการ Export
          </div>
        )}

        {/* ═══════════════ ZONES — side-by-side columns ═══════════════ */}
        <div style={{
          display: "flex",
          gap: `${ZONE_GAP}px`,
          alignItems: "flex-start",
        }}>
          {activeZones.map((zone, zIdx) => {
            const pal = ZONE_PALETTES[zIdx % ZONE_PALETTES.length];

            const zoneMembersCount = zone.teamOrder.reduce((s, colId) => {
              const col = columns[colId];
              return s + (col ? col.memberIds.filter((id) => id && members[id]).length : 0);
            }, 0);
            const zonePower = zone.teamOrder.reduce((s, colId) => {
              const col = columns[colId];
              if (!col) return s;
              return s + col.memberIds.reduce((ms, mid) => ms + (mid && members[mid] ? members[mid].power || 0 : 0), 0);
            }, 0);

            const zoneLeader = zone.teamOrder.length > 0
              ? getTeamLeader(columns[zone.teamOrder[0]], members)
              : "ว่าง";

            return (
              <div
                key={zone.id}
                style={{
                  width: `${ZONE_W}px`,
                  flexShrink: 0,
                  border: `2.5px solid ${pal.border}`,
                  borderRadius: "16px",
                  background: "#f8fafc",
                  overflow: "hidden",
                  boxShadow: "0 4px 18px rgba(0,0,0,0.10)",
                }}
              >
                {/* Zone Header */}
                <div style={{
                  background: pal.header,
                  padding: "16px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "20px", fontWeight: 900, color: "#fff", letterSpacing: "0.02em" }}>
                      {zone.name}
                    </span>
                    <span style={{
                      fontFamily: "monospace", fontSize: "15px", fontWeight: 800, color: "#fff",
                      background: "rgba(255,255,255,0.18)", borderRadius: "8px", padding: "4px 16px",
                    }}>⚡ {zonePower.toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)", fontWeight: 700 }}>
                      👑 หัวตี้: <strong style={{ color: "#fff" }}>{zoneLeader}</strong>
                    </span>
                    <span style={{
                      fontSize: "13px", color: "rgba(255,255,255,0.85)", fontWeight: 700,
                      background: "rgba(255,255,255,0.15)", borderRadius: "6px", padding: "2px 12px",
                    }}>
                      {zoneMembersCount} คน • {zone.teamOrder.length} ทีม
                    </span>
                  </div>
                </div>

                {/* Teams stacked vertically */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "12px" }}>
                  {zone.teamOrder.map((colId) => {
                    const col = columns[colId];
                    if (!col) return null;

                    const teamLeader = getTeamLeader(col, members);
                    const assignedMembers = col.memberIds
                      .map((id, idx) => ({ id, slotIdx: idx, member: id ? members[id] : null }))
                      .filter((item): item is { id: string; slotIdx: number; member: Member } => item.member != null);
                    const assignedCount = assignedMembers.length;
                    const teamPower = assignedMembers.reduce((s, item) => s + (item.member.power || 0), 0);
                    const isFull = assignedCount === 5;

                    return (
                      <div
                        key={colId}
                        style={{
                          background: "#fff",
                          border: `1.5px solid ${pal.teamHeaderBorder}`,
                          borderRadius: "10px",
                          overflow: "hidden",
                          boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
                        }}
                      >
                        {/* Team Header */}
                        <div style={{
                          background: pal.teamHeaderBg,
                          borderBottom: `1.5px solid ${pal.teamHeaderBorder}`,
                          padding: "10px 16px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                        }}>
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                            <span style={{ fontSize: "16px", fontWeight: 900, color: pal.teamHeaderText, lineHeight: 1.2, letterSpacing: "0.01em" }}>
                              {col.title}
                            </span>
                            <span style={{
                              fontSize: "12px", fontWeight: 700, color: pal.teamHeaderText,
                              opacity: 0.75, marginTop: "2px",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              👑 {teamLeader}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                            <span style={{
                              fontFamily: "monospace", fontSize: "14px", fontWeight: 800,
                              color: pal.teamHeaderText,
                              background: "rgba(255,255,255,0.7)",
                              border: `1px solid ${pal.teamHeaderBorder}`,
                              borderRadius: "7px", padding: "3px 12px",
                            }}>⚡ {teamPower.toLocaleString()}</span>
                            <span style={{
                              fontSize: "13px", fontWeight: 900, color: "#fff",
                              background: isFull ? "#16a34a" : pal.border,
                              borderRadius: "20px", padding: "3px 14px",
                              minWidth: "48px", textAlign: "center",
                            }}>{assignedCount}/5</span>
                          </div>
                        </div>

                        {/* Table column header */}
                        <div style={{
                          display: "flex",
                          background: "#f1f5f9",
                          borderBottom: "1.5px solid #e2e8f0",
                        }}>
                          {[
                            { label: "#",          w: COL_SLOT, align: "center" as const },
                            { label: "ชื่อตัวละคร", w: COL_NAME, align: "left"   as const },
                            { label: "อาชีพ",       w: COL_JOB,  align: "center" as const },
                            { label: "ค่าพลัง",     w: COL_PWR,  align: "right"  as const },
                          ].map((col, ci) => (
                            <div
                              key={col.label}
                              style={{
                                width: `${col.w}px`,
                                flexShrink: 0,
                                fontSize: "12px",
                                fontWeight: 800,
                                color: "#475569",
                                padding: "8px 10px",
                                textAlign: col.align,
                                borderRight: ci < 3 ? "1px solid #e2e8f0" : undefined,
                                letterSpacing: "0.04em",
                              }}
                            >{col.label}</div>
                          ))}
                        </div>

                        {/* Rows — sorted by power descending */}
                        {(() => {
                          // Build sorted list of members (power DESC), fill empty slots at end
                          const sortedMembers: (Member | null)[] = assignedMembers
                            .map(item => item.member)
                            .sort((a, b) => (b.power || 0) - (a.power || 0));
                          // Pad to 5 slots with nulls
                          while (sortedMembers.length < 5) sortedMembers.push(null);

                          return sortedMembers.map((m, rowIdx) => {
                            const jobColor = (m?.job && JOB_COLORS[m.job]) || "#64748b";
                            const isOdd = rowIdx % 2 === 1;

                            if (!m) {
                              return (
                                <div
                                  key={`empty-${rowIdx}`}
                                  style={{
                                    display: "flex",
                                    background: isOdd ? "#f8fafc" : "#fff",
                                    borderBottom: rowIdx < 4 ? "1px solid #f1f5f9" : undefined,
                                    alignItems: "center",
                                  }}
                                >
                                  <div style={{ width: `${COL_SLOT}px`, flexShrink: 0, fontSize: "13px", fontFamily: "monospace", color: "#cbd5e1", fontWeight: 700, padding: "10px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>{rowIdx + 1}</div>
                                  <div style={{ width: `${COL_NAME}px`, flexShrink: 0, fontSize: "13px", color: "#cbd5e1", fontStyle: "italic", padding: "10px 12px", borderRight: "1px solid #f1f5f9" }}>— ว่าง —</div>
                                  <div style={{ width: `${COL_JOB}px`, flexShrink: 0, fontSize: "13px", color: "#cbd5e1", padding: "10px 10px", textAlign: "center", borderRight: "1px solid #f1f5f9" }}>-</div>
                                  <div style={{ width: `${COL_PWR}px`, flexShrink: 0, fontSize: "13px", color: "#cbd5e1", padding: "10px 12px", textAlign: "right", fontFamily: "monospace" }}>-</div>
                                </div>
                              );
                            }

                          return (
                              <div
                                key={`member-${rowIdx}`}
                                style={{
                                  display: "flex",
                                  background: isOdd ? "#f8fafc" : "#fff",
                                  borderBottom: rowIdx < 4 ? "1px solid #f1f5f9" : undefined,
                                  alignItems: "center",
                                }}
                              >
                                {/* # */}
                                <div style={{
                                  width: `${COL_SLOT}px`, flexShrink: 0,
                                  fontSize: "14px", fontFamily: "monospace", fontWeight: 900,
                                  color: pal.border, padding: "10px 10px",
                                  textAlign: "center", borderRight: "1px solid #f1f5f9",
                                }}>{rowIdx + 1}</div>

                                {/* ชื่อ */}
                                <div style={{
                                  width: `${COL_NAME}px`, flexShrink: 0,
                                  fontSize: "14px", fontWeight: 700, color: "#0f172a",
                                  padding: "10px 12px",
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                  borderRight: "1px solid #f1f5f9",
                                }} title={m.name}>{m.name}</div>

                                {/* อาชีพ */}
                                <div style={{
                                  width: `${COL_JOB}px`, flexShrink: 0,
                                  padding: "7px 10px",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  borderRight: "1px solid #f1f5f9",
                                }}>
                                  <span style={{
                                    fontSize: "12px", fontWeight: 800, color: "#fff",
                                    background: jobColor,
                                    borderRadius: "7px",
                                    padding: "4px 0",
                                    display: "block",
                                    width: `${COL_JOB - 20}px`,
                                    textAlign: "center",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    letterSpacing: "0.03em",
                                  }}>{m.job}</span>
                                </div>

                                {/* ค่าพลัง */}
                                <div style={{
                                  width: `${COL_PWR}px`, flexShrink: 0,
                                  fontSize: "14px", fontFamily: "monospace", fontWeight: 800,
                                  color: pal.teamHeaderText,
                                  padding: "10px 14px", textAlign: "right",
                                }}>{(m.power || 0).toLocaleString()}</div>
                              </div>
                            );
                          });
                        })()}
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
