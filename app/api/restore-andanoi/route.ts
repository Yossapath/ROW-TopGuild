export const dynamic = 'force-dynamic';
import { getDb, rosterRef } from '@/lib/firebase-admin';
import { ok, err } from '@/lib/server-utils';

export async function GET(req: Request) {
  try {
    const db = getDb();
    
    // Check teams
    const snap = await db.collection('teams').get();
    let andanoiDiscordId = null;
    let andanoiData = null;

    snap.forEach(doc => {
       const d = doc.data();
       
       if (d.data && d.data.teamOrder) {
           for (const [did, info] of Object.entries(d.data.teamOrder)) {
               if (info.name === 'Andanoi') {
                   andanoiDiscordId = did;
                   andanoiData = info;
               }
           }
       }
       if (d.teamOrder) {
           for (const [did, info] of Object.entries(d.teamOrder)) {
               if (info.name === 'Andanoi') {
                   andanoiDiscordId = did;
                   andanoiData = info;
               }
           }
       }
    });

    if (andanoiDiscordId) {
        // Recreate the user!
        await db.collection('users').doc(andanoiDiscordId).set({
            discordId: andanoiDiscordId,
            gameUsername: 'Andanoi',
            class: andanoiData.job || 'Unknown',
            power: andanoiData.power || 0,
            role: 'admin',
            createdAt: Date.now()
        }, { merge: true });

        // Add back to roster!
        const rDoc = await rosterRef().get();
        let rData = rDoc.data();
        let isLegacy = false;
        if (rData.data) {
           isLegacy = true;
           rData = rData.data;
        }

        const job = andanoiData.job || 'Unknown';
        if (!rData[job]) rData[job] = [];

        // check if already there
        const exists = rData[job].find(m => m.discordId === andanoiDiscordId);
        if (!exists) {
            rData[job].push({
                discordId: andanoiDiscordId,
                name: 'Andanoi',
                job: job,
                power: andanoiData.power || 0,
                role: 'หัวหน้าปาร์ตี้',
                activity: 0
            });
            await rosterRef().set(isLegacy ? { data: rData } : rData);
        }

        return ok({ message: "Successfully restored Andanoi!", discordId: andanoiDiscordId, data: andanoiData });
    }

    return ok({ message: "Could not find Andanoi in teams history. Please ask Andanoi to login again." });
  } catch (error: any) {
    return err(error.message, 500);
  }
}
