import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
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
  authDomain: "gen-lang-client-0612096853.firebaseapp.com",
  storageBucket: "gen-lang-client-0612096853.firebasestorage.app",
  messagingSenderId: "497354453299"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

export { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInWithPopup
};
export type { User };
