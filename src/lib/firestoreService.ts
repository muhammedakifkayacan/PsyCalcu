import { db } from './firebase';
import { doc, setDoc, getDoc, disableNetwork, arrayUnion } from 'firebase/firestore';
import { Session, AppSettings, Expense } from '../types';

interface UserData {
  settings: AppSettings;
  sessions: Session[];
  expenses?: Expense[];
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
      const settings = (data.settings || {}) as AppSettings;
      const calendarBackup = data.calendarBackup || {};

      // Auto-recover calendar URLs and therapist details from backup if missing in settings
      if (!settings.onlineCalendarWebcalUrl && calendarBackup.onlineCalendarWebcalUrl) {
        settings.onlineCalendarWebcalUrl = calendarBackup.onlineCalendarWebcalUrl;
      }
      if (!settings.faceToFaceCalendarWebcalUrl && calendarBackup.faceToFaceCalendarWebcalUrl) {
        settings.faceToFaceCalendarWebcalUrl = calendarBackup.faceToFaceCalendarWebcalUrl;
      }
      if ((!settings.ownerCalendars || settings.ownerCalendars.length === 0) && calendarBackup.ownerCalendars && calendarBackup.ownerCalendars.length > 0) {
        settings.ownerCalendars = calendarBackup.ownerCalendars;
      }
      if ((!settings.therapistName || settings.therapistName === 'Dr. Melis Kaya') && calendarBackup.therapistName) {
        settings.therapistName = calendarBackup.therapistName;
      }

      return {
        settings,
        sessions: (data.sessions as Session[]) || [],
        expenses: (data.expenses as Expense[]) || []
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
export async function saveUserData(userId: string, settings: AppSettings, sessions: Session[], expenses?: Expense[]): Promise<void> {
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
    const cleanedExpenses = expenses ? JSON.parse(JSON.stringify(expenses)) : [];
    
    const payload: any = { 
      settings: cleanedSettings, 
      sessions: cleanedSessions, 
      expenses: cleanedExpenses 
    };

    // Keep a persistent calendarBackup and history log inside the user document whenever URLs exist
    if (settings?.onlineCalendarWebcalUrl || settings?.faceToFaceCalendarWebcalUrl || (settings?.ownerCalendars && settings.ownerCalendars.length > 0)) {
      const historyRecord = {
        id: 'link_' + Date.now(),
        timestamp: new Date().toISOString(),
        onlineCalendarWebcalUrl: settings.onlineCalendarWebcalUrl || '',
        faceToFaceCalendarWebcalUrl: settings.faceToFaceCalendarWebcalUrl || '',
        ownerCalendars: settings.ownerCalendars || [],
        therapistName: settings.therapistName || ''
      };
      payload.calendarBackup = historyRecord;
      payload.calendarHistory = arrayUnion(historyRecord);
    }

    await setDoc(docRef, payload, { merge: true });

    // Also save public-safe availability data to a separate collection for secure public access
    try {
      const publicDocRef = doc(db, 'public_availability', userId);
      const publicSessions = (sessions || []).map((s: Session) => {
        const item: any = {
          id: s.id || "",
          date: s.date || "",
          time: s.time || "",
          duration: s.duration || 60,
          type: s.type === 'cancelled' ? 'cancelled' : 'busy'
        };
        if (s.roomId) {
          item.roomId = s.roomId;
        }
        return item;
      });
      const publicAvailabilityData = JSON.parse(JSON.stringify({
        therapistName: settings?.therapistName || "Terapist",
        therapistPhone: settings?.therapistPhone || "",
        rooms: settings?.rooms || [],
        blockedSlots: settings?.blockedSlots || [],
        sessions: publicSessions,
        updatedAt: new Date().toISOString()
      }));
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
