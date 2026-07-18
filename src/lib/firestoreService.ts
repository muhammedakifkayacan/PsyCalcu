import { db } from './firebase';
import { doc, setDoc, getDoc, disableNetwork } from 'firebase/firestore';
import { Session, AppSettings } from '../types';

interface UserData {
  settings: AppSettings;
  sessions: Session[];
}

export let isFirestoreQuotaExceeded = false;

export function checkIsQuotaError(error: any): boolean {
  if (!error) return false;
  const errMsg = error.message || String(error);
  const errCode = error.code || '';
  return (
    errCode === 'resource-exhausted' ||
    errCode === 'quota-exceeded' ||
    errMsg.toLowerCase().includes('quota') ||
    errMsg.toLowerCase().includes('resource-exhausted') ||
    errMsg.toLowerCase().includes('quota exceeded')
  );
}

// Utility to cleanly disable network on quota limit
async function handleQuotaExceeded() {
  isFirestoreQuotaExceeded = true;
  try {
    await disableNetwork(db);
    console.warn("Firestore network communication has been disabled due to quota limits.");
  } catch (err) {
    console.error("Failed to disable Firestore network:", err);
  }
}

/**
 * Fetch all user data (sessions and settings) from Firestore
 */
export async function fetchUserData(userId: string): Promise<UserData | null> {
  if (isFirestoreQuotaExceeded) {
    throw new Error('quota-exceeded');
  }
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
  } catch (error: any) {
    if (checkIsQuotaError(error)) {
      await handleQuotaExceeded();
      throw new Error('quota-exceeded');
    }
    console.error("Error fetching user data from Firestore: ", error);
    throw error;
  }
}

/**
 * Save all user data (sessions and settings) to Firestore
 */
export async function saveUserData(userId: string, settings: AppSettings, sessions: Session[]): Promise<void> {
  if (isFirestoreQuotaExceeded) {
    throw new Error('quota-exceeded');
  }
  try {
    const docRef = doc(db, 'users', userId);
    // Remove undefined properties before saving to Firestore to avoid setDoc invalid data error
    const cleanedSettings = JSON.parse(JSON.stringify(settings));
    const cleanedSessions = JSON.parse(JSON.stringify(sessions)).map((s: any) => {
      if (s.isSyncedFromCalendar && !s.isManuallyEdited) {
        delete s.notes;
      }
      return s;
    });
    await setDoc(docRef, { settings: cleanedSettings, sessions: cleanedSessions }, { merge: true });

    // Also save public-safe availability data to a separate collection for secure public access
    try {
      const publicDocRef = doc(db, 'public_availability', userId);
      const publicSessions = (sessions || []).map((s: Session) => ({
        id: s.id,
        date: s.date,
        time: s.time,
        duration: s.duration || 60,
        roomId: s.roomId,
        type: s.type === 'cancelled' ? 'cancelled' : 'busy'
      }));
      const publicAvailabilityData = {
        therapistName: settings.therapistName || "Terapist",
        rooms: settings.rooms || [],
        blockedSlots: settings.blockedSlots || [],
        sessions: publicSessions,
        updatedAt: new Date().toISOString()
      };
      await setDoc(publicDocRef, publicAvailabilityData);
    } catch (pubErr) {
      console.error("Error saving public-safe availability data: ", pubErr);
    }
  } catch (error: any) {
    if (checkIsQuotaError(error)) {
      await handleQuotaExceeded();
      throw new Error('quota-exceeded');
    }
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
