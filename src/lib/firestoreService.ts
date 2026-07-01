import { db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Session, AppSettings } from '../types';

interface UserData {
  settings: AppSettings;
  sessions: Session[];
}

/**
 * Fetch all user data (sessions and settings) from Firestore
 */
export async function fetchUserData(userId: string): Promise<UserData | null> {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        settings: data.settings as AppSettings,
        sessions: data.sessions as Session[]
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching user data from Firestore: ", error);
    throw error;
  }
}

/**
 * Save all user data (sessions and settings) to Firestore
 */
export async function saveUserData(userId: string, settings: AppSettings, sessions: Session[]): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId);
    await setDoc(docRef, { settings, sessions }, { merge: true });
  } catch (error) {
    console.error("Error saving user data to Firestore: ", error);
    throw error;
  }
}

/**
 * Bulk migrate local data to Firestore
 */
export async function migrateLocalDataToFirestore(
  userId: string, 
  sessions: Session[], 
  settings: AppSettings
): Promise<void> {
  return saveUserData(userId, settings, sessions);
}
