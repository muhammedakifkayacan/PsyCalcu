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
const db = getFirestore(app, "ai-studio-psycalcu-c6b31660-ddde-4081-add9-6a1d609c8222");

async function main() {
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    usersSnapshot.forEach(doc => {
      console.log(`\n=================== USER: ${doc.id} ===================`);
      const data = doc.data();
      
      // Print everything except the massive 'sessions' array
      const { sessions, ...otherData } = data;
      console.log(JSON.stringify(otherData, null, 2));

      if (sessions && sessions.length > 0) {
        console.log(`Sessions count: ${sessions.length}`);
        // Let's check if any session has notes or fields that might contain a calendar URL
        // or check if there are distinct "syncedCalendarType" values or other metadata in sessions
        const syncedSessions = sessions.filter(s => s.isSyncedFromCalendar);
        console.log(`Synced sessions count: ${syncedSessions.length}`);
        
        // Let's look for any webcal links in notes or custom fields of sessions
        const sessionsWithUrls = sessions.filter(s => 
          (s.notes && s.notes.includes("http")) || 
          (s.descriptionRaw && s.descriptionRaw.includes("http"))
        );
        if (sessionsWithUrls.length > 0) {
          console.log(`Found ${sessionsWithUrls.length} sessions containing URLs in notes/descriptions!`);
          sessionsWithUrls.slice(0, 10).forEach(s => {
            console.log(`- Session ID: ${s.id}, Client: ${s.clientName}, Date: ${s.date}`);
            console.log(`  Notes: ${s.notes || ''}`);
            console.log(`  DescriptionRaw: ${s.descriptionRaw || ''}`);
          });
        }
      }
    });
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

main();
