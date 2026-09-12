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

function getTeamLeader(col: Column | undefined, members: Record<string, Member>): string {
  if (!col) return "-";
  const assigned = col.memberIds
    .map((id) => (id ? members[id] : null))
    .filter((m): m is Member => m != null && Boolean(m.name));

  if (assigned.length === 0) return "-";
  const leader = assigned.reduce((top, m) => ((m.power ?? 0) > (top.power ?? 0) ? m : top), assigned[0]);
  return leader.name;
}

const ZONE_PALETTES = [
  { bg: "#1e3a8a", border: "#2563eb", teamBg: "#eff6ff", teamBorder: "#bfdbfe", teamText: "#1e3a8a" }, // Blue
  { bg: "#064e3b", border: "#059669", teamBg: "#ecfdf5", teamBorder: "#a7f3d0", teamText: "#064e3b" }, // Green
  { bg: "#4c1d95", border: "#7c3aed", teamBg: "#f5f3ff", teamBorder: "#ddd6fe", teamText: "#4c1d95" }, // Purple
  { bg: "#78350f", border: "#d97706", teamBg: "#fffbeb", teamBorder: "#fde68a", teamText: "#78350f" }, // Amber
];

const txt = (size: number, weight: number | string, color: string, align: "left" | "center" | "right" = "left", extra?: React.CSSProperties): React.CSSProperties => ({
  fontSize: size + "px",
  fontWeight: weight,
  color,
  textAlign: align,
  fontFamily: "'Segoe UI', 'Noto Sans Thai', sans-serif",
  ...extra,
});

const pill = (bg: string, color: string, border?: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "6px 16px 8px 16px",
  backgroundColor: bg,
  color,
  border: border ? "2px solid " + border : "none",
  borderRadius: "10px",
  fontWeight: 900,
  fontSize: "16px",
  lineHeight: 1.1,
  textAlign: "center",
  whiteSpace: "nowrap",
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

    // Split zones into 2 columns (Left and Right)
    const leftZones: Zone[] = [];
    const rightZones: Zone[] = [];
    let leftCount = 0;
    let rightCount = 0;

    activeZones.forEach(zone => {
      const tCount = zone.teamOrder.length;
      if (leftCount <= rightCount) {
        leftZones.push(zone);
        leftCount += tCount;
      } else {
        rightZones.push(zone);
        rightCount += tCount;
      }
    });

    const renderZone = (zone: Zone, zIdx: number) => {
      const pal = ZONE_PALETTES[activeZones.findIndex(z => z.id === zone.id) % ZONE_PALETTES.length];
      const teams = zone.teamOrder;
      const teamCount = teams.length;
      
      let zoneMembers = 0;
      teams.forEach(colId => {
        const col = columns[colId];
        if (!col) return;
        col.memberIds.forEach(id => {
          if (id && members[id]) zoneMembers++;
        });
      });
      const leader = teams.length > 0 ? getTeamLeader(columns[teams[0]], members) : "-";

      return (
        <div key={zone.id} style={{
          background: "#f8fafc",
          borderRadius: "24px",
          border: "4px solid " + pal.border,
          overflow: "hidden",
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
        }}>
          {/* ZONE HEADER */}
          <div style={{
            background: pal.bg,
            padding: "24px 32px 28px 32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
              <span style={txt(32, 900, "#fff")}>{zone.name}</span>
              <span style={txt(20, 600, "rgba(255,255,255,0.9)")}>👑 หัวตี้: <strong>{leader}</strong></span>
            </div>
            <span style={pill("rgba(255,255,255,0.15)", "#fff", "rgba(255,255,255,0.3)")}>
              {zoneMembers} คน • {teamCount} ทีม
            </span>
          </div>

          {/* ZONE TEAMS LIST (VERTICAL STACK) */}
          <div style={{
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            gap: "28px",
          }}>
            {teams.map((colId) => {
              const col = columns[colId];
              if (!col) return null;

              const assigned = col.memberIds.filter(id => id && members[id]);
              const count = assigned.length;
              const tLeader = getTeamLeader(col, members);

              return (
                <div key={colId} style={{
                  background: "#fff",
                  border: "2px solid " + pal.teamBorder,
                  borderRadius: "16px",
                  overflow: "hidden",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                }}>
                  {/* TEAM HEADER */}
                  <div style={{
                    background: pal.teamBg,
                    borderBottom: "2px solid " + pal.teamBorder,
                    padding: "16px 24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <span style={txt(24, 900, pal.teamText)}>{col.title}</span>
                      <span style={txt(16, 600, pal.teamText, "left", { opacity: 0.8 })}>👑 {tLeader}</span>
                    </div>
                    <div style={pill(pal.bg, "#fff")}>{count}/5</div>
                  </div>

                  {/* MEMBERS TABLE */}
                  <div style={{ padding: "12px 16px" }}>
                    {/* Header Row */}
                    <div style={{
                      display: "flex",
                      padding: "0 12px 12px 12px",
                      borderBottom: "2px solid #e2e8f0",
                      marginBottom: "8px",
                    }}>
                      <div style={{ width: "60px", ...txt(16, 800, "#64748b", "center") }}>ลำดับ</div>
                      <div style={{ flex: 1, padding: "0 20px", ...txt(16, 800, "#64748b", "left") }}>ชื่อตัวละคร</div>
                      <div style={{ width: "200px", ...txt(16, 800, "#64748b", "center") }}>อาชีพ</div>
                    </div>

                    {/* Member Rows */}
                    {Array.from({ length: 5 }).map((_, slotIdx) => {
                      const memberId = col.memberIds[slotIdx];
                      const m = memberId ? members[memberId] : null;
                      const isOdd = slotIdx % 2 === 1;
                      const jobColor = m?.job && JOB_COLORS[m.job] ? JOB_COLORS[m.job] : "#94a3b8";

                      return (
                        <div key={slotIdx} style={{
                          display: "flex",
                          alignItems: "center",
                          height: "64px",
                          background: isOdd ? "#f8fafc" : "#fff",
                          borderRadius: "12px",
                          padding: "0 12px",
                        }}>
                          {/* # */}
                          <div style={{ width: "60px", flexShrink: 0, ...txt(20, 900, m ? pal.border : "#cbd5e1", "center") }}>
                            {slotIdx + 1}
                          </div>
                          
                          {/* NAME */}
                          <div style={{ flex: 1, padding: "0 20px", minWidth: 0 }}>
                            <div style={{
                              ...txt(24, m ? 800 : 400, m ? "#0f172a" : "#cbd5e1", "left"),
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                            }}>
                              {m ? m.name : "- ว่าง -"}
                            </div>
                          </div>
                          
                          {/* JOB */}
                          <div style={{ width: "200px", flexShrink: 0, display: "flex", justifyContent: "center" }}>
                            {m ? (
                              <div style={{
                                background: jobColor,
                                color: "#fff",
                                fontSize: "16px",
                                fontWeight: "bold",
                                padding: "6px 16px 8px 16px",
                                borderRadius: "8px",
                                width: "90%",
                                textAlign: "center",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}>
                                {m.job}
                              </div>
                            ) : (
                              <div style={txt(18, 400, "#cbd5e1", "center")}>-</div>
                            )}
                          </div>
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
    };

    const CANVAS_W = 2000;
    const PAD = 60;

    return (
      <div
        ref={ref}
        id="gvg-export-canvas"
        style={{
          width: CANVAS_W + "px",
          background: "#e2e8f0",
          padding: PAD + "px",
          boxSizing: "border-box",
          fontFamily: "'Segoe UI', 'Noto Sans Thai', sans-serif",
          lineHeight: 1.3,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: "40px",
        }}
      >
        {/* HEADER */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "linear-gradient(90deg, #0f172a 0%, #1e3a8a 100%)",
          borderRadius: "24px",
          padding: "36px 48px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <div style={{
              width: "88px", height: "88px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "20px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "44px", border: "2px solid rgba(255,255,255,0.2)"
            }}>🛡️</div>
            <div>
              <div style={txt(40, 900, "#fff", "left", { letterSpacing: "1px" })}>
                {title}
              </div>
              <div style={txt(20, 600, "rgba(255,255,255,0.7)", "left", { marginTop: "12px", letterSpacing: "2px" })}>
                GUILD VS GUILD BATTLE SQUAD ROSTER • {activeZones.length} ZONES
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={txt(16, 700, "rgba(255,255,255,0.5)", "right", { letterSpacing: "2px", marginBottom: "10px" })}>
              EXPORTED DATE
            </div>
            <div style={txt(28, 800, "#fff", "right", { fontFamily: "monospace" })}>
              {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>

        {/* 2-COLUMN LAYOUT */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "40px",
          alignItems: "start",
        }}>
          {/* LEFT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
            {leftZones.map(renderZone)}
          </div>
          {/* RIGHT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
            {rightZones.map(renderZone)}
          </div>
        </div>
      </div>
    );
  }
);

GVGExportLayout.displayName = "GVGExportLayout";
export default GVGExportLayout;