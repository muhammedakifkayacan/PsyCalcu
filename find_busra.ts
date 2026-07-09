import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0612096853",
  appId: "1:497354453299:web:81b571322c1e1cbe384e46",
  apiKey: "AIzaSyAhJg0E6rhj7B-2DfcU5OkbRGPgfLMR-Yk",
  authDomain: "gen-lang-client-0612096853.firebaseapp.com",
  storageBucket: "gen-lang-client-0612096853.firebasestorage.app",
  messagingSenderId: "497354453299"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {}, "ai-studio-psycalcu-c6b31660-ddde-4081-add9-6a1d609c8222");

async function main() {
  console.log("Searching registrations...");
  const regRef = collection(db, 'registrations');
  const q = query(regRef, where('email', '==', 'uzmpsikologbusra@gmail.com'));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    console.log("No registration found with that email!");
    // let's print all registrations
    const allReg = await getDocs(regRef);
    console.log("All registrations in DB:");
    allReg.forEach(d => {
      console.log(d.id, "=>", d.data());
    });
  } else {
    snap.forEach(async (d) => {
      const regData = d.data();
      console.log("Found registration:", d.id, regData);
      
      const userId = d.id; // or regData.userId
      console.log("Fetching user document for userId:", userId);
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        console.log("User data found:", JSON.stringify(userSnap.data(), null, 2));
      } else {
        console.log("No user document found for", userId);
        // let's check by document ID in registrations if different
        if (regData.userId && regData.userId !== userId) {
          const userRef2 = doc(db, 'users', regData.userId);
          const userSnap2 = await getDoc(userRef2);
          if (userSnap2.exists()) {
            console.log("User data found with regData.userId:", JSON.stringify(userSnap2.data(), null, 2));
          }
        }
      }
    });
  }
}

main().catch(console.error);
