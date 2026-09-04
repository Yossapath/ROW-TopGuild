import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBXPfxhSLBt9dQqf5glFrXvx6KLxqPmEE8",
  authDomain: "topguild-eeb40.firebaseapp.com",
  projectId: "topguild-eeb40",
  storageBucket: "topguild-eeb40.firebasestorage.app",
  messagingSenderId: "879954426796",
  appId: "1:879954426796:web:48e305dc9f78bda6a51809"
};

// Initialize Firebase (prevent double initialization in Next.js)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
