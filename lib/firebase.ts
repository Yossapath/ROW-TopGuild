import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBEpQzYxHHqiOVTigbioV-XLwmF94C7fSw",
  authDomain: "row-topguild.firebaseapp.com",
  projectId: "row-topguild",
  storageBucket: "row-topguild.firebasestorage.app",
  messagingSenderId: "798557058434",
  appId: "1:798557058434:web:99dc6732e2c9da936d4b9b",
  measurementId: "G-KMCXGR454E"
};

// Initialize Firebase (prevent double initialization in Next.js)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
