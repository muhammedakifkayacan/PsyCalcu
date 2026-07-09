import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  projectId: "gen-lang-client-0612096853"
});

// Pass the database ID directly to getFirestore
const db = getFirestore('ai-studio-psycalcu-c6b31660-ddde-4081-add9-6a1d609c8222');

async function main() {
  console.log("Searching user 'uzmpsikologbusra@gmail.com' in registrations...");
  const regSnap = await db.collection('registrations')
    .where('email', '==', 'uzmpsikologbusra@gmail.com')
    .get();
    
  if (regSnap.empty) {
    console.log("No registration document found with that email!");
    // Let's list all registrations to check
    const allReg = await db.collection('registrations').get();
    console.log("All registrations:");
    allReg.forEach(doc => {
      console.log(doc.id, "=>", doc.data());
    });
    return;
  }
  
  for (const doc of regSnap.docs) {
    const regData = doc.data();
    console.log("Found registration doc ID:", doc.id, regData);
    
    // Check users collection with document ID (which is userId usually)
    const userDocRef = db.collection('users').doc(doc.id);
    const userSnap = await userDocRef.get();
    if (userSnap.exists) {
      console.log("Found User document in 'users' collection:");
      console.log(JSON.stringify(userSnap.data(), null, 2));
    } else {
      console.log("User document NOT found for id:", doc.id);
    }
    
    // Also check if regData.userId && regData.userId !== doc.id
    if (regData.userId && regData.userId !== doc.id) {
      const userDocRef2 = db.collection('users').doc(regData.userId);
      const userSnap2 = await userDocRef2.get();
      if (userSnap2.exists) {
        console.log("Found User document with regData.userId:");
        console.log(JSON.stringify(userSnap2.data(), null, 2));
      }
    }
  }
}

main().catch(console.error);
