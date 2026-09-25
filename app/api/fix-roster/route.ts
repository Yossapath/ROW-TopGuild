export const dynamic = 'force-dynamic';
import { getDb, rosterRef, COLL_USER } from '@/lib/firebase-admin';
import { ok, err } from '@/lib/server-utils';

export async function GET(req: Request) {
  try {
    const db = getDb();
    const usersSnap = await db.collection(COLL_USER).get();
    const validDiscordIds = new Set();
    usersSnap.forEach(doc => {
        validDiscordIds.add(doc.id);
    });

    const snap = await rosterRef().get();
    const data = snap.data();
    let rosterData = data?.data || data;
    let changed = false;

    // 1. Map classes
    if (rosterData['Clown']) {
      if (!rosterData['Bard']) rosterData['Bard'] = [];
      rosterData['Bard'] = [...rosterData['Bard'], ...rosterData['Clown']];
      rosterData['Bard'].forEach((m: any) => m.job = 'Bard');
      delete rosterData['Clown'];
      changed = true;
    }
    if (rosterData['Gypsy']) {
      if (!rosterData['Dancer']) rosterData['Dancer'] = [];
      rosterData['Dancer'] = [...rosterData['Dancer'], ...rosterData['Gypsy']];
      rosterData['Dancer'].forEach((m: any) => m.job = 'Dancer');
      delete rosterData['Gypsy'];
      changed = true;
    }

    // 2. Remove duplicates and orphaned members
    let allNames = new Set();
    let duplicates = [];
    let removedOrphans = [];

    for (const job of Object.keys(rosterData)) {
      if (Array.isArray(rosterData[job])) {
        const validMembers = [];
        for (const m of rosterData[job]) {
          // Check if orphaned
          if (!m.discordId || !validDiscordIds.has(m.discordId)) {
             removedOrphans.push(m.name);
             continue; // Skip, don't add to valid
          }
          
          if (!allNames.has(m.name)) {
            allNames.add(m.name);
            validMembers.push(m);
          } else {
            duplicates.push(m.name);
          }
        }
        if (validMembers.length !== rosterData[job].length) {
          rosterData[job] = validMembers;
          changed = true;
        }
      }
    }

    if (changed) {
      await rosterRef().set(data?.data ? { data: rosterData } : rosterData);
    }

    return ok({ changed, duplicates, removedOrphans, message: "Roster cleaned successfully!" });
  } catch (error: any) {
    return err(error.message, 500);
  }
}
