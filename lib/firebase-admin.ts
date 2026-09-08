import * as admin from "firebase-admin";

let initError = "";

function formatPrivateKey(key: string) {
  if (!key) return "";
  
  // 1. Remove surrounding quotes if they exist
  let cleaned = key.replace(/^["']|["']$/g, "");
  
  // 2. Replace literal '\n' strings with actual newlines
  cleaned = cleaned.replace(/\\n/g, "\n");
  
  // 3. Remove \r
  cleaned = cleaned.replace(/\r/g, "");
  
  // 4. If the key got completely flattened (no newlines at all), reconstruct it
  if (!cleaned.includes("\n")) {
    const beginHeader = "-----BEGIN PRIVATE KEY-----";
    const endHeader = "-----END PRIVATE KEY-----";
    if (cleaned.startsWith(beginHeader) && cleaned.includes(endHeader)) {
      const base64Body = cleaned
        .substring(beginHeader.length, cleaned.indexOf(endHeader))
        .replace(/\s+/g, ""); // Remove any spaces that might have been added
        
      // Reconstruct with proper newlines (split base64 into 64-char lines)
      const formattedBody = base64Body.match(/.{1,64}/g)?.join("\n") || base64Body;
      cleaned = `${beginHeader}\n${formattedBody}\n${endHeader}\n`;
    }
  }
  
  return cleaned.trim();
}

// Lazy initialize Firebase admin
export function getDb() {
  if (!admin.apps.length) {
    try {
      if (process.env.FIREBASE_PRIVATE_KEY) {
        const formattedKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
        
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

export const COLL_USER = "topguild-user";
export const COLL_SYSTEM = "topguild-system";
export const COLL_DUN = "topguild-dun";

// System refs
export const rosterRef     = () => getDb().collection(COLL_SYSTEM).doc("roster");
export const teamsRef      = () => getDb().collection(COLL_SYSTEM).doc("teams");
export const attendanceRef = () => getDb().collection(COLL_SYSTEM).doc("attendance");
export const leaveRef      = () => getDb().collection(COLL_SYSTEM).doc("leaves");
export const logsRef       = () => getDb().collection(COLL_SYSTEM).doc("logs");

// Dungeon refs
export const dungeonsRef   = () => getDb().collection(COLL_DUN).doc("dungeons");
export const scheduleRef   = () => getDb().collection(COLL_DUN).doc("dungeon_schedule");
