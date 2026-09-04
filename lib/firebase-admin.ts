import * as admin from "firebase-admin";

// Lazy initialize Firebase admin
function getDb() {
  if (!admin.apps.length) {
    try {
      if (process.env.FIREBASE_PRIVATE_KEY) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          }),
        });
      } else {
        // Fallback for Next.js build phase (prevents crashing when env vars are missing)
        admin.initializeApp({ projectId: "topguild-build-demo" });
      }
    } catch (error) {
      console.warn("Firebase admin initialization error", error);
    }
  }
  return admin.firestore();
}

// ── Helper: guild_system document refs (Evaluated only when called) ──
export const COLL = "guild_system";

export const rosterRef    = () => getDb().collection(COLL).doc("roster");
export const teamsRef     = () => getDb().collection(COLL).doc("teams");
export const dungeonsRef  = () => getDb().collection(COLL).doc("dungeons");
export const scheduleRef  = () => getDb().collection(COLL).doc("dungeon_schedule");
export const usersRef     = () => getDb().collection(COLL).doc("users");
export const attendanceRef = () => getDb().collection(COLL).doc("attendance");
export const leaveRef     = () => getDb().collection(COLL).doc("leaves");
export const logsRef      = () => getDb().collection(COLL).doc("logs");
