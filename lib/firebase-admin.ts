import * as admin from "firebase-admin";

// Singleton: init once, reuse across API routes
if (!admin.apps.length) {
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
  } as admin.ServiceAccount;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

export const db = admin.firestore();

// ── Helper: guild_system document refs ───────────────────────
export const COLL = "guild_system";

export const rosterRef    = () => db.collection(COLL).doc("roster");
export const teamsRef     = () => db.collection(COLL).doc("teams");
export const dungeonsRef  = () => db.collection(COLL).doc("dungeons");
export const scheduleRef  = () => db.collection(COLL).doc("dungeon_schedule");
export const usersRef     = () => db.collection(COLL).doc("users");
export const attendanceRef = () => db.collection(COLL).doc("attendance");
export const leaveRef     = () => db.collection(COLL).doc("leaves");
export const logsRef      = () => db.collection(COLL).doc("logs");
