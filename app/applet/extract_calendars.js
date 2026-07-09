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

async function dumpDatabase(dbId) {
  const db = dbId ? getFirestore(app, dbId) : getFirestore(app);
  const dbName = dbId || "(default)";
  console.log(`\n=================== DATABASE: ${dbName} ===================`);

  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    console.log(`Users count: ${usersSnapshot.size}`);
    usersSnapshot.forEach(doc => {
      console.log(`\nUser ID: ${doc.id}`);
      const data = doc.data();
      if (data.settings) {
        console.log("Settings:");
        console.log(`  therapistName: ${data.settings.therapistName}`);
        console.log(`  calendarSyncEnabled: ${data.settings.calendarSyncEnabled}`);
        console.log(`  onlineCalendarWebcalUrl: ${data.settings.onlineCalendarWebcalUrl}`);
        console.log(`  faceToFaceCalendarWebcalUrl: ${data.settings.faceToFaceCalendarWebcalUrl}`);
        console.log(`  googleSheetId: ${data.settings.googleSheetId}`);
        console.log(`  googleSheetsLinked: ${data.settings.googleSheetsLinked}`);
      } else {
        console.log("  No settings found on user document.");
      }
      if (data.sessions) {
        console.log(`  Sessions count: ${data.sessions.length}`);
      }
    });
  } catch (err) {
    console.error(`Error querying users on ${dbName}:`, err.message);
  }

  try {
    const regSnapshot = await getDocs(collection(db, "registrations"));
    console.log(`Registrations count: ${regSnapshot.size}`);
    regSnapshot.forEach(doc => {
      console.log(`\nRegistration ID: ${doc.id}`);
      console.log("Data:", JSON.stringify(doc.data(), null, 2));
    });
  } catch (err) {
    console.error(`Error querying registrations on ${dbName}:`, err.message);
  }

  // Are there other collections mentioned in the rules?
  // match /announcements/{announcementId}
  try {
    const annSnapshot = await getDocs(collection(db, "announcements"));
    console.log(`Announcements count: ${annSnapshot.size}`);
    annSnapshot.forEach(doc => {
      console.log(`\nAnnouncement ID: ${doc.id}`);
      console.log("Data:", JSON.stringify(doc.data(), null, 2));
    });
  } catch (err) {
    console.error(`Error querying announcements on ${dbName}:`, err.message);
  }
}

async function main() {
  await dumpDatabase("ai-studio-psycalcu-c6b31660-ddde-4081-add9-6a1d609c8222");
  await dumpDatabase(null);
  console.log("\nDump complete.");
  process.exit(0);
}

main();
