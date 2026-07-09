import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  projectId: "gen-lang-client-0612096853"
});

const db = getFirestore(app, "ai-studio-psycalcu-c6b31660-ddde-4081-add9-6a1d609c8222");

async function main() {
  try {
    console.log("Fetching users...");
    const snapshot = await db.collection('users').get();
    if (snapshot.empty) {
      console.log("No users found in Firestore!");
      return;
    }
    snapshot.forEach(doc => {
      console.log("---");
      console.log("User ID:", doc.id);
      const data = doc.data();
      if (data && data.settings) {
        console.log("Settings:", JSON.stringify(data.settings, null, 2));
      } else {
        console.log("No settings for this user.");
      }
    });
  } catch (error) {
    console.error("Error reading users:", error);
  }
}

main();
