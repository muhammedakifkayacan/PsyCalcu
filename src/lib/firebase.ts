import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  User
} from 'firebase/auth';
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where,
  writeBatch
} from 'firebase/firestore';

// Configuration from firebase-applet-config.json
const firebaseConfig = {
  projectId: "gen-lang-client-0612096853",
  appId: "1:497354453299:web:81b571322c1e1cbe384e46",
  apiKey: "AIzaSyAhJg0E6rhj7B-2DfcU5OkbRGPgfLMR-Yk",
  authDomain: "psy-calcu.vercel.app",
  storageBucket: "gen-lang-client-0612096853.firebasestorage.app",
  messagingSenderId: "497354453299"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with offline persistence enabled and specify the correct databaseId
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, "ai-studio-psycalcu-c6b31660-ddde-4081-add9-6a1d609c8222");
} catch (err) {
  console.warn("Failed to initialize Firestore with persistent local cache, falling back to standard initialization:", err);
  try {
    dbInstance = initializeFirestore(app, {}, "ai-studio-psycalcu-c6b31660-ddde-4081-add9-6a1d609c8222");
  } catch (err2) {
    console.error("Failed to initialize Firestore, falling back to default database:", err2);
    dbInstance = initializeFirestore(app, {});
  }
}
export const db = dbInstance;

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

export { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
};
export type { User };
