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

const ZONE_PALETTES = [
  { header: "linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%)", border: "#2563eb", teamHeaderBg: "#dbeafe", teamHeaderText: "#1e3a8a", teamHeaderBorder: "#93c5fd" },
  { header: "linear-gradient(135deg,#064e3b 0%,#059669 100%)", border: "#059669", teamHeaderBg: "#d1fae5", teamHeaderText: "#064e3b", teamHeaderBorder: "#6ee7b7" },
  { header: "linear-gradient(135deg,#4c1d95 0%,#7c3aed 100%)", border: "#7c3aed", teamHeaderBg: "#ede9fe", teamHeaderText: "#4c1d95", teamHeaderBorder: "#c4b5fd" },
  { header: "linear-gradient(135deg,#78350f 0%,#d97706 100%)", border: "#d97706", teamHeaderBg: "#fef3c7", teamHeaderText: "#78350f", teamHeaderBorder: "#fcd34d" },
];

// Reusable badge style — use flex + explicit height so Thai text always centers correctly in html2canvas
const badge = (bg: string, color: string, border?: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "28px",
  padding: "0 14px",
  borderRadius: "8px",
  background: bg,
  border: border ? `1.5px solid ${border}` : undefined,
  color,
  fontWeight: 800,
  fontSize: "13px",
  fontFamily: "monospace",
  lineHeight: 1,
  whiteSpace: "nowrap" as const,
  flexShrink: 0,
});

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

    const CANVAS_W = 2400;
    const PAD = 36;
    const ZONE_GAP = 20;
    const N = activeZones.length || 1;
    const ZONE_W = Math.floor((CANVAS_W - PAD * 2 - ZONE_GAP * (N - 1)) / N);

    const COL_SLOT = 46;
    // zone border(5) + zone padding(24) + team border(3) = 32px overhead
    const REMAINING = ZONE_W - COL_SLOT - 32;
    const COL_NAME = Math.floor(REMAINING * 0.35);
    const COL_JOB  = Math.floor(REMAINING * 0.35);
    const COL_PWR  = REMAINING - COL_NAME - COL_JOB;

    // Global text style — lineHeight:1.3 prevents Thai font baseline drop in html2canvas
    const txt = (size: number, weight: number, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
      fontSize: `${size}px`,
      fontWeight: weight,
      color,
      lineHeight: 1.3,
      ...extra,
    });

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
          lineHeight: 1.3,
        }}
      >
        {/* ═══ HEADER ═══ */}
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
              borderRadius: "14px",
              border: "1.5px solid rgba(255,255,255,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "32px", lineHeight: 1,
            }}>🛡️</div>
            <div>
              <div style={txt(28, 900, "#fff", { letterSpacing: "0.03em" })}>
                {title === "GVG TEAM SETUP" ? "รายชื่อผู้เล่นสนามหลัก (GVG TEAM SETUP)" : title}
              </div>
              <div style={txt(13, 700, "rgba(255,255,255,0.65)", { letterSpacing: "0.09em", marginTop: "5px" })}>
                GUILD VS GUILD BATTLE SQUAD ROSTER • {activeZones.length} ZONE{activeZones.length > 1 ? "S" : ""}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={txt(11, 700, "rgba(255,255,255,0.5)", { letterSpacing: "0.1em", marginBottom: "5px" })}>EXPORTED DATE</div>
            <div style={txt(18, 800, "#fff", { fontFamily: "monospace" })}>
              {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>

        {/* ═══ SUMMARY BAR ═══ */}
        <div style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "14px 28px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          border: "2px solid #bfdbfe",
          boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
          minHeight: "62px",
        }}>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "center" }}>
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
                  <span style={txt(15, 900, "#1e293b")}>{zone.name}:</span>
                  <span style={badge(pal.teamHeaderBg, pal.teamHeaderText, pal.teamHeaderBorder)}>
                    {count}/{cap} คน
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            {[
              { label: "สมาชิกทั้งหมด", val: `${totalMembers} คน`, bg: "#f0fdf4", bd: "#86efac", col: "#166534" },
              { label: "จำนวนทีม",       val: `${totalTeams} ทีม`,  bg: "#faf5ff", bd: "#d8b4fe", col: "#6b21a8" },
              { label: "พลังรบรวม",      val: totalPower.toLocaleString(), bg: "#fffbeb", bd: "#fcd34d", col: "#78350f" },
            ].map(({ label, val, bg, bd, col }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={txt(14, 800, col)}>{label}:</span>
                <span style={badge(bg, col, bd)}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {activeZones.length === 0 && (
          <div style={{ padding: "80px", textAlign: "center", color: "#94a3b8", border: "2px dashed #cbd5e1", borderRadius: "16px", background: "#fff", ...txt(20, 700, "#94a3b8") }}>
            ไม่มีทีมที่มีสมาชิกสำหรับการ Export
          </div>
        )}

        {/* ═══ ZONES ═══ */}
        <div style={{ display: "flex", gap: `${ZONE_GAP}px`, alignItems: "flex-start" }}>
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
              <div key={zone.id} style={{
                width: `${ZONE_W}px`,
                flexShrink: 0,
                border: `2.5px solid ${pal.border}`,
                borderRadius: "16px",
                background: "#f8fafc",
                overflow: "hidden",
                boxShadow: "0 4px 18px rgba(0,0,0,0.10)",
              }}>
                {/* Zone Header */}
                <div style={{ background: pal.header, padding: "16px 22px" }}>
                  {/* Row 1: Zone name + power */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={txt(20, 900, "#fff", { letterSpacing: "0.02em" })}>{zone.name}</span>
                    <div style={{
                      ...badge("rgba(255,255,255,0.18)", "#fff"),
                      fontFamily: "monospace", fontSize: "15px",
                      border: "1px solid rgba(255,255,255,0.25)",
                    }}>⚡ {zonePower.toLocaleString()}</div>
                  </div>
                  {/* Row 2: leader + count */}
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <span style={txt(13, 700, "rgba(255,255,255,0.9)")}>
                      👑 หัวตี้: <strong style={{ color: "#fff" }}>{zoneLeader}</strong>
                    </span>
                    <div style={{
                      ...badge("rgba(255,255,255,0.15)", "rgba(255,255,255,0.9)"),
                      border: "1px solid rgba(255,255,255,0.2)",
                      fontSize: "12px",
                      fontFamily: "'Segoe UI','Noto Sans Thai',Arial,sans-serif",
                      fontWeight: 700,
                    }}>
                      {zoneMembersCount} คน • {zone.teamOrder.length} ทีม
                    </div>
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
                      <div key={colId} style={{
                        background: "#fff",
                        border: `1.5px solid ${pal.teamHeaderBorder}`,
                        borderRadius: "10px",
                        overflow: "hidden",
                        boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
                      }}>
                        {/* Team Header */}
                        <div style={{
                          background: pal.teamHeaderBg,
                          borderBottom: `1.5px solid ${pal.teamHeaderBorder}`,
                          padding: "10px 14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          minHeight: "56px",
                        }}>
                          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, flex: 1, gap: "3px" }}>
                            <span style={txt(16, 900, pal.teamHeaderText, { letterSpacing: "0.01em" })}>{col.title}</span>
                            <span style={txt(12, 700, pal.teamHeaderText, { opacity: 0.72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })}>
                              👑 {teamLeader}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                            <div style={{
                              ...badge("rgba(255,255,255,0.7)", pal.teamHeaderText, pal.teamHeaderBorder),
                              fontFamily: "monospace", fontSize: "13px",
                            }}>⚡ {teamPower.toLocaleString()}</div>
                            <div style={{
                              ...badge(isFull ? "#16a34a" : pal.border, "#fff"),
                              fontSize: "13px",
                              fontFamily: "'Segoe UI','Noto Sans Thai',Arial,sans-serif",
                            }}>{assignedCount}/5</div>
                          </div>
                        </div>

                        {/* Column Headers */}
                        <div style={{
                          display: "flex",
                          background: "#f1f5f9",
                          borderBottom: "1.5px solid #e2e8f0",
                          height: "34px",
                        }}>
                          {[
                            { label: "#",           w: COL_SLOT, align: "center" as const },
                            { label: "ชื่อตัวละคร",  w: COL_NAME, align: "left"   as const },
                            { label: "อาชีพ",        w: COL_JOB,  align: "center" as const },
                            { label: "ค่าพลัง",      w: COL_PWR,  align: "right"  as const },
                          ].map((c, ci) => (
                            <div key={c.label} style={{
                              width: `${c.w}px`,
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: c.align === "center" ? "center" : c.align === "right" ? "flex-end" : "flex-start",
                              padding: "0 10px",
                              ...txt(12, 800, "#475569"),
                              letterSpacing: "0.04em",
                              borderRight: ci < 3 ? "1px solid #e2e8f0" : undefined,
                            }}>{c.label}</div>
                          ))}
                        </div>

                        {/* Rows — sorted by power DESC */}
                        {(() => {
                          const sorted: (Member | null)[] = assignedMembers
                            .map(i => i.member)
                            .sort((a, b) => (b.power || 0) - (a.power || 0));
                          while (sorted.length < 5) sorted.push(null);

                          return sorted.map((m, rowIdx) => {
                            const jobColor = (m?.job && JOB_COLORS[m.job]) || "#64748b";
                            const isOdd = rowIdx % 2 === 1;

                            return (
                              <div key={rowIdx} style={{
                                display: "flex",
                                background: isOdd ? "#f8fafc" : "#fff",
                                borderBottom: rowIdx < 4 ? "1px solid #f1f5f9" : undefined,
                                alignItems: "center",
                                height: "40px",
                              }}>
                                {/* # */}
                                <div style={{
                                  width: `${COL_SLOT}px`, flexShrink: 0,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  height: "100%",
                                  borderRight: "1px solid #f1f5f9",
                                  ...txt(14, 900, m ? pal.border : "#cbd5e1", { fontFamily: "monospace" }),
                                }}>{rowIdx + 1}</div>

                                {/* ชื่อ */}
                                <div style={{
                                  width: `${COL_NAME}px`, flexShrink: 0,
                                  display: "flex", alignItems: "center",
                                  height: "100%",
                                  padding: "0 12px",
                                  borderRight: "1px solid #f1f5f9",
                                  overflow: "hidden",
                                }}>
                                  <span style={{
                                    ...txt(14, m ? 700 : 400, m ? "#0f172a" : "#cbd5e1"),
                                    fontStyle: m ? "normal" : "italic",
                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                    display: "block",
                                  }} title={m?.name}>{m ? m.name : "— ว่าง —"}</span>
                                </div>

                                {/* อาชีพ */}
                                <div style={{
                                  width: `${COL_JOB}px`, flexShrink: 0,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  height: "100%",
                                  borderRight: "1px solid #f1f5f9",
                                }}>
                                  {m ? (
                                    <span style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      height: "26px",
                                      padding: "0",
                                      width: `${COL_JOB - 18}px`,
                                      background: jobColor,
                                      borderRadius: "7px",
                                      ...txt(12, 800, "#fff", { letterSpacing: "0.03em", lineHeight: 1 }),
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}>{m.job}</span>
                                  ) : (
                                    <span style={txt(13, 400, "#cbd5e1")}>-</span>
                                  )}
                                </div>

                                {/* ค่าพลัง */}
                                <div style={{
                                  width: `${COL_PWR}px`, flexShrink: 0,
                                  display: "flex", alignItems: "center", justifyContent: "flex-end",
                                  height: "100%",
                                  padding: "0 14px",
                                  ...txt(14, 800, m ? pal.teamHeaderText : "#cbd5e1", { fontFamily: "monospace" }),
                                }}>{m ? (m.power || 0).toLocaleString() : "-"}</div>
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
