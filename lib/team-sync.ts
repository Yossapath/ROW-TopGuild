/**
 * lib/team-sync.ts
 *
 * Synchronization utilities and atomic transactions for GVG Teams.
 * Prevents Lost Updates when members take leave while admins are editing or saving team rosters.
 */

export interface TeamColumnLike {
  id?: string;
  title?: string;
  memberIds: (string | null)[];
  type?: string;
  locked?: boolean;
}

export interface TeamsDataLike {
  columns?: Record<string, TeamColumnLike>;
  zones?: any[];
  members?: Record<string, any>;
  offlineIds?: string[];
  [key: string]: any;
}

/**
 * Pure function: Remove a member from GVG team slots (setting matching slots to null).
 * - Ignores "unassigned" column
 * - Preserves other members' positions in each team
 * - Preserves all other properties in teams data
 * - Returns { changed: false, updatedData: tData } if member is not found
 */
export function removeMemberFromTeamsData(
  tData: TeamsDataLike | null | undefined,
  name: string
): { changed: boolean; updatedData: TeamsDataLike | null | undefined } {
  if (!tData || !tData.columns || typeof tData.columns !== "object" || !name) {
    return { changed: false, updatedData: tData };
  }

  let changed = false;
  const updatedColumns: Record<string, TeamColumnLike> = {};

  for (const [colId, col] of Object.entries(tData.columns)) {
    if (colId === "unassigned" || !col || !Array.isArray(col.memberIds)) {
      updatedColumns[colId] = col;
      continue;
    }

    let colChanged = false;
    const newMemberIds = [...col.memberIds];
    for (let i = 0; i < newMemberIds.length; i++) {
      if (newMemberIds[i] === name) {
        newMemberIds[i] = null;
        colChanged = true;
        changed = true;
      }
    }

    if (colChanged) {
      updatedColumns[colId] = {
        ...col,
        memberIds: newMemberIds,
      };
    } else {
      updatedColumns[colId] = col;
    }
  }

  // Clean up legacy array format if present to maintain backward compatibility
  let updatedLegacyData = tData.data;
  if (Array.isArray(tData.data)) {
    updatedLegacyData = tData.data.map((group: any) => {
      if (!group || typeof group !== "object" || !group.teams || typeof group.teams !== "object") {
        return group;
      }
      let groupChanged = false;
      const newTeams: Record<string, any> = {};
      for (const [teamKey, teamMembers] of Object.entries(group.teams)) {
        if (Array.isArray(teamMembers)) {
          newTeams[teamKey] = teamMembers.map((m: any) => {
            if (m && typeof m === "object" && m.name === name) {
              groupChanged = true;
              changed = true;
              return { name: "", job: "", power: 0 };
            }
            return m;
          });
        } else {
          newTeams[teamKey] = teamMembers;
        }
      }
      return groupChanged ? { ...group, teams: newTeams } : group;
    });
  }

  if (!changed) {
    return { changed: false, updatedData: tData };
  }

  return {
    changed: true,
    updatedData: {
      ...tData,
      columns: updatedColumns,
      ...(Array.isArray(tData.data) ? { data: updatedLegacyData } : {}),
    },
  };
}

/**
 * Transaction: Atomically remove a member from GVG Teams document.
 * Protects against Lost Updates when admins or other players modify teams concurrently.
 */
export async function removeMemberFromTeamsTransaction(
  db: { runTransaction: <T>(fn: (transaction: any) => Promise<T>) => Promise<T> },
  tRef: any,
  name: string
): Promise<{ changed: boolean; updatedData?: TeamsDataLike | null }> {
  return await db.runTransaction(async (transaction: any) => {
    const tDoc = await transaction.get(tRef);
    if (!tDoc.exists) {
      return { changed: false };
    }

    const tData = tDoc.data();
    const { changed, updatedData } = removeMemberFromTeamsData(tData, name);

    if (changed) {
      const nextVersion = typeof tData.version === "number" ? tData.version + 1 : 1;
      const finalData = {
        ...updatedData,
        version: nextVersion,
        updatedAt: Date.now(),
      };
      transaction.set(tRef, finalData);
      return { changed, updatedData: finalData };
    }

    return { changed, updatedData };
  });
}
