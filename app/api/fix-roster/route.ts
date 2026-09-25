export const dynamic = 'force-dynamic';
import { getDb, rosterRef } from '@/lib/firebase-admin';
import { ok, err } from '@/lib/server-utils';

export async function GET(req: Request) {
  try {
    const snap = await rosterRef().get();
    const data = snap.data();
    let rosterData = data?.data || data;
    let changed = false;

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

    let allNames = new Set();
    let duplicates = [];
    for (const job of Object.keys(rosterData)) {
      if (Array.isArray(rosterData[job])) {
        const uniqueMembers = [];
        for (const m of rosterData[job]) {
          if (!allNames.has(m.name)) {
            allNames.add(m.name);
            uniqueMembers.push(m);
          } else {
            duplicates.push(m.name);
          }
        }
        if (uniqueMembers.length !== rosterData[job].length) {
          rosterData[job] = uniqueMembers;
          changed = true;
        }
      }
    }

    if (changed) {
      await rosterRef().set(data?.data ? { data: rosterData } : rosterData);
    }

    return ok({ changed, duplicates });
  } catch (error: any) {
    return err(error.message, 500);
  }
}
