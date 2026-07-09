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
      const data = doc.data();
      if (!data.sessions || data.sessions.length === 0) return;
      
      console.log(`\nAnalyzing user ${doc.id} (${data.settings?.therapistName || "Unknown"}) with ${data.sessions.length} sessions...`);
      
      // Let's print the keys of the first session to see what fields exist
      const firstSession = data.sessions[0];
      console.log("Keys on session object:", Object.keys(firstSession));
      console.log("Sample session:", JSON.stringify(firstSession, null, 2));

      // Let's search ALL fields of ALL sessions for any URL
      const foundUrls = new Set();
      data.sessions.forEach(s => {
        for (const [key, val] of Object.entries(s)) {
          if (typeof val === 'string') {
            if (val.includes("webcal://") || val.includes(".ics") || val.includes("icloud.com") || val.includes("google.com/calendar")) {
              foundUrls.add(`${key}: ${val}`);
            }
          }
        }
      });

      if (foundUrls.size > 0) {
        console.log("Found matching fields/URLs in sessions:");
        foundUrls.forEach(url => console.log("  -", url));
      } else {
        console.log("No matching calendar URLs found inside the sessions array.");
      }
    });
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

main();
