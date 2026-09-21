import { db } from './firebase';
import { doc, setDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { Session, AppSettings, Expense, DataBackupSnapshot } from '../types';

interface UserData {
  settings: AppSettings;
  sessions: Session[];
  expenses?: Expense[];
  backupSnapshots?: DataBackupSnapshot[];
  calendarHistory?: any[];
  calendarBackup?: any;
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
    errMsg.toLowerCase().includes('quota exceeded') ||
    errMsg.toLowerCase().includes('free daily write units') ||
    errMsg.toLowerCase().includes('free daily read units')
  );
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
        expenses: (data.expenses as Expense[]) || [],
        backupSnapshots: (data.backupSnapshots as DataBackupSnapshot[]) || [],
        calendarHistory: data.calendarHistory || [],
        calendarBackup: data.calendarBackup
      };
    }
    return null;
  } catch (error: any) {
    if (checkIsQuotaError(error)) {
      isFirestoreQuotaExceeded = true;
    }
    console.error("Error fetching user data from Firestore: ", error);
    throw error;
  }
}

/**
 * Helper to build a clean snapshot object
 */
export function createSnapshotObject(
  label: string,
  settings: AppSettings,
  sessions: Session[],
  expenses: Expense[] = []
): DataBackupSnapshot {
  const activeSessions = (sessions || []).filter(s => s.type !== 'cancelled' && s.type !== 'non-session');
  const paidSessions = activeSessions.filter(s => s.paymentStatus === 'paid');
  const unpaidSessions = activeSessions.filter(s => s.paymentStatus !== 'paid');
  const totalGross = activeSessions.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const totalExpenses = (expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0) +
    activeSessions.reduce((sum, s) => sum + (s.hasBabysitterFee ? (Number(s.babysitterFeeAmount) || 0) : 0) + (s.hasOfficeRentFee ? (Number(s.officeRentFeeAmount) || 0) : 0), 0);

  return {
    id: 'snap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
    label,
    sessionCount: sessions.length,
    expenseCount: expenses.length,
    totalGrossIncome: totalGross,
    totalNetIncome: totalGross - totalExpenses,
    paidSessionsCount: paidSessions.length,
    unpaidSessionsCount: unpaidSessions.length,
    sessions: JSON.parse(JSON.stringify(sessions)),
    settings: JSON.parse(JSON.stringify(settings)),
    expenses: JSON.parse(JSON.stringify(expenses))
  };
}

/**
 * Save all user data (sessions and settings) to Firestore and maintain versioned snapshots
 */
export async function saveUserData(
  userId: string, 
  settings: AppSettings, 
  sessions: Session[], 
  expenses?: Expense[],
  snapshotReason?: string
): Promise<void> {
  if (isFirestoreQuotaExceeded) {
    throw new Error('quota-exceeded');
  }
  try {
    const docRef = doc(db, 'users', userId);
    // Clean data before saving to Firestore to avoid invalid data errors
    const cleanedSettings = JSON.parse(JSON.stringify(settings));
    const cleanedSessions = JSON.parse(JSON.stringify(sessions));
    const cleanedExpenses = expenses ? JSON.parse(JSON.stringify(expenses)) : [];
    
    const payload: any = { 
      settings: cleanedSettings, 
      sessions: cleanedSessions, 
      expenses: cleanedExpenses,
      lastUpdatedAt: new Date().toISOString()
    };

    // Auto-create snapshot if sessions exist and it's a significant event or requested
    if (sessions && sessions.length > 0 && snapshotReason) {
      const snap = createSnapshotObject(snapshotReason, cleanedSettings, cleanedSessions, cleanedExpenses);
      payload.backupSnapshots = arrayUnion(snap);
      
      // Also cache snapshot in localStorage
      try {
        const localKey = `psycalcu_snapshots_${userId}`;
        const existingLocalStr = localStorage.getItem(localKey);
        let localSnaps: DataBackupSnapshot[] = [];
        if (existingLocalStr) {
          try { localSnaps = JSON.parse(existingLocalStr); } catch (e) {}
        }
        localSnaps.unshift(snap);
        if (localSnaps.length > 30) localSnaps = localSnaps.slice(0, 30);
        localStorage.setItem(localKey, JSON.stringify(localSnaps));
      } catch (localErr) {}
    }

    // Keep a persistent calendarBackup inside the user document whenever URLs exist
    if (settings?.onlineCalendarWebcalUrl || settings?.faceToFaceCalendarWebcalUrl || (settings?.ownerCalendars && settings.ownerCalendars.length > 0)) {
      payload.calendarBackup = {
        id: 'link_' + Date.now(),
        timestamp: new Date().toISOString(),
        onlineCalendarWebcalUrl: settings.onlineCalendarWebcalUrl || '',
        faceToFaceCalendarWebcalUrl: settings.faceToFaceCalendarWebcalUrl || '',
        ownerCalendars: settings.ownerCalendars || [],
        therapistName: settings.therapistName || ''
      };
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
    } catch (pubErr: any) {
      if (checkIsQuotaError(pubErr)) {
        isFirestoreQuotaExceeded = true;
      } else {
        console.error("Error saving public-safe availability data: ", pubErr);
      }
    }
  } catch (error: any) {
    if (checkIsQuotaError(error)) {
      isFirestoreQuotaExceeded = true;
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
  return saveUserData(userId, settings, sessions, [], 'İlk Bulut Eşitlemesi');
}

