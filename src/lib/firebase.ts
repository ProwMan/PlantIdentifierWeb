import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || "AIzaSyBHCmBwKuXQIwZzN1EcVDwIo90K45KUnL4",
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || "efg-acs-plant.firebaseapp.com",
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || "efg-acs-plant",
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || "efg-acs-plant.firebasestorage.app",
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || "213654518539",
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || "1:213654518539:web:12074805053b945340c00e",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
