import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  projectId: "gen-lang-client-0612096853",
  appId: "1:497354453299:web:81b571322c1e1cbe384e46",
  apiKey: "AIzaSyAhJg0E6rhj7B-2DfcU5OkbRGPgfLMR-Yk",
  authDomain: "gen-lang-client-0612096853.firebaseapp.com",
  storageBucket: "gen-lang-client-0612096853.firebasestorage.app",
  messagingSenderId: "497354453299"
};

const app = initializeApp(firebaseConfig);

async function tryDatabase(dbId) {
  try {
    const db = dbId ? getFirestore(app, dbId) : getFirestore(app);
    const dbName = dbId || "(default)";
    console.log(`--- Checking database: ${dbName} ---`);
    
    console.log(`[${dbName}] Fetching users...`);
    const usersSnapshot = await getDocs(collection(db, "users"));
    console.log(`[${dbName}] Users count:`, usersSnapshot.size);
    usersSnapshot.forEach(doc => {
      console.log(`[${dbName}] User:`, doc.id, "=>", JSON.stringify(doc.data(), null, 2));
    });

    console.log(`[${dbName}] Fetching registrations...`);
    const regSnapshot = await getDocs(collection(db, "registrations"));
    console.log(`[${dbName}] Registrations count:`, regSnapshot.size);
    regSnapshot.forEach(doc => {
      console.log(`[${dbName}] Reg:`, doc.id, "=>", JSON.stringify(doc.data(), null, 2));
    });
  } catch (error) {
    console.error(`[${dbId || "(default)"}] Error:`, error.message);
  }
}

async function main() {
  await tryDatabase("ai-studio-psycalcu-c6b31660-ddde-4081-add9-6a1d609c8222");
  await tryDatabase(null); // default database
  console.log("Execution complete. Exiting...");
  process.exit(0);
}

main();
