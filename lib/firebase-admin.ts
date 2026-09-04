import * as admin from "firebase-admin";

let initError = "";

// Lazy initialize Firebase admin
function getDb() {
  if (!admin.apps.length) {
    try {
      if (process.env.FIREBASE_PRIVATE_KEY) {
        // Clean up the private key
        let formattedKey = process.env.FIREBASE_PRIVATE_KEY;
        // Remove surrounding quotes if they exist (single or double)
        formattedKey = formattedKey.replace(/^["']|["']$/g, "");
        // Replace escaped newlines with actual newlines
        formattedKey = formattedKey.replace(/\\n/g, "\n");

        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: formattedKey,
          }),
        });
      } else {
        initError = "Missing FIREBASE_PRIVATE_KEY in Environment Variables";
        admin.initializeApp({ projectId: "topguild-build-demo" });
      }
    } catch (error: any) {
      console.warn("Firebase admin initialization error:", error);
      initError = error.message || "Unknown Initialization Error";
      // Fallback so it doesn't crash the entire app
      if (!admin.apps.length) {
        admin.initializeApp({ projectId: "topguild-build-demo" });
      }
    }
  }
  
  if (initError) {
    throw new Error("FIREBASE_INIT_ERROR: " + initError);
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
