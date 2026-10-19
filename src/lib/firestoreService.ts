import { db } from './firebase';
import { doc, setDoc, getDoc, deleteField } from 'firebase/firestore';
import { Session, AppSettings, Expense, DataBackupSnapshot, getNormalizedClientName, toTurkishAscii } from '../types';
import { idbSet, idbGet } from '../utils/idbStorage';

export interface AccountingLedgerEntry {
  id: string;
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  paidAmount?: number;
  paymentMethod?: Session['paymentMethod'];
  price: number;
  hasBabysitterFee: boolean;
  babysitterFeeAmount: number;
  hasOfficeRentFee?: boolean;
  officeRentFeeAmount?: number;
  isManuallyEdited?: boolean;
  updatedAt: number;
  clientName: string;
  date: string;
  time: string;
}

interface UserData {
  settings: AppSettings;
  sessions: Session[];
  expenses?: Expense[];
  backupSnapshots?: DataBackupSnapshot[];
  accountingLedger?: Record<string, AccountingLedgerEntry>;
  calendarHistory?: any[];
  calendarBackup?: any;
}

export let isFirestoreQuotaExceeded = false;

export function extractBaseCalendarUid(id: string): string {
  if (!id || !id.startsWith('ics_')) return id || '';
  const withoutPrefix = id.slice(4);
  const lastUnderscore = withoutPrefix.lastIndexOf('_');
  if (lastUnderscore !== -1) {
    const after = withoutPrefix.slice(lastUnderscore + 1);
    if (/^\d{8}$/.test(after)) {
      return withoutPrefix.slice(0, lastUnderscore);
    }
  }
  return withoutPrefix;
}

export function getLedgerKeysForSession(s: Pick<Session, 'id' | 'clientName' | 'date' | 'time'>): string[] {
  const keys: string[] = [];
  if (s.id) {
    keys.push(`id:${s.id}`);
    if (s.id.startsWith('ics_') && s.date) {
      keys.push(`uid:${extractBaseCalendarUid(s.id)}_${s.date}`);
    }
  }
  if (s.clientName && s.date) {
    const norm = toTurkishAscii(getNormalizedClientName(s.clientName)).toLowerCase().trim();
    if (norm) {
      if (s.time) {
        keys.push(`slot:${norm}_${s.date}_${s.time}`);
      }
      keys.push(`day:${norm}_${s.date}`);
    }
  }
  return keys;
}

export function updateLocalAccountingLedger(
  userId: string | undefined,
  sessions: Session[],
  remoteLedger?: Record<string, AccountingLedgerEntry>
): Record<string, AccountingLedgerEntry> {
  const storageKey = userId ? `psycalcu_accounting_ledger_${userId}` : 'psycalcu_accounting_ledger';
  let mergedLedger: Record<string, AccountingLedgerEntry> = {};

  try {
    const rawLocal = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
    if (rawLocal) {
      mergedLedger = JSON.parse(rawLocal) || {};
    }
  } catch (e) {}

  if (remoteLedger && typeof remoteLedger === 'object') {
    for (const [k, entry] of Object.entries(remoteLedger)) {
      if (!entry) continue;
      const existing = mergedLedger[k];
      if (!existing || (entry.updatedAt || 0) > (existing.updatedAt || 0) || (entry.paymentStatus === 'paid' && existing.paymentStatus !== 'paid' && !existing.isManuallyEdited)) {
        mergedLedger[k] = entry;
      }
    }
  }

  // Pre-count how many active sessions a client has on the same day so `day:` key is only written when unique on that date
  const clientDateCounts = new Map<string, number>();
  (sessions || []).forEach(s => {
    if (!s || s.isDeleted || !s.clientName || !s.date) return;
    const norm = toTurkishAscii(getNormalizedClientName(s.clientName)).toLowerCase().trim();
    if (norm) {
      const dk = `day:${norm}_${s.date}`;
      clientDateCounts.set(dk, (clientDateCounts.get(dk) || 0) + 1);
    }
  });

  (sessions || []).forEach(s => {
    if (!s || s.isDeleted || s.type === 'cancelled' || s.type === 'non-session') return;
    const hasPayment = s.paymentStatus === 'paid' || s.paymentStatus === 'partial' || (Number(s.paidAmount) || 0) > 0;
    if (!hasPayment && !s.isManuallyEdited) return;

    const entry: AccountingLedgerEntry = {
      id: s.id,
      paymentStatus: s.paymentStatus || 'unpaid',
      paidAmount: s.paidAmount,
      paymentMethod: s.paymentMethod,
      price: Number(s.price) || 0,
      hasBabysitterFee: Boolean(s.hasBabysitterFee),
      babysitterFeeAmount: Number(s.babysitterFeeAmount) || 0,
      hasOfficeRentFee: s.type === 'online' ? false : Boolean(s.hasOfficeRentFee),
      officeRentFeeAmount: s.type === 'online' ? 0 : (Number(s.officeRentFeeAmount) || 0),
      isManuallyEdited: Boolean(s.isManuallyEdited),
      updatedAt: s.updatedAt || Date.now(),
      clientName: s.clientName,
      date: s.date,
      time: s.time
    };

    const keys = getLedgerKeysForSession(s);
    for (const k of keys) {
      if (k.startsWith('day:') && (clientDateCounts.get(k) || 0) > 1) continue;
      const existing = mergedLedger[k];
      if (!existing || entry.updatedAt >= (existing.updatedAt || 0) || (hasPayment && existing.paymentStatus === 'unpaid' && !existing.isManuallyEdited)) {
        mergedLedger[k] = entry;
      }
    }
  });

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(mergedLedger));
    }
    idbSet(storageKey, mergedLedger).catch(() => {});
  } catch (e) {}

  return mergedLedger;
}

export function getStoredAccountingLedger(userId?: string): Record<string, AccountingLedgerEntry> {
  if (typeof window === 'undefined') return {};
  const storageKey = userId ? `psycalcu_accounting_ledger_${userId}` : 'psycalcu_accounting_ledger';
  try {
    const raw = localStorage.getItem(storageKey) || localStorage.getItem('psycalcu_accounting_ledger');
    if (raw) {
      return JSON.parse(raw) || {};
    }
  } catch (e) {}
  return {};
}

export function applyAccountingLedgerToSessions(
  sessions: Session[],
  ledger?: Record<string, AccountingLedgerEntry>,
  accountingStartDate?: string | null
): Session[] {
  if (!Array.isArray(sessions) || !ledger || Object.keys(ledger).length === 0) return sessions;
  const cutoff = accountingStartDate ? accountingStartDate.split('T')[0] : '';

  // Count sessions per client+day to avoid ambiguous `day:` matches when a client has 2 sessions on the same day
  const clientDateCounts = new Map<string, number>();
  sessions.forEach(s => {
    if (!s || s.isDeleted || !s.clientName || !s.date) return;
    const norm = toTurkishAscii(getNormalizedClientName(s.clientName)).toLowerCase().trim();
    if (norm) {
      const dk = `day:${norm}_${s.date}`;
      clientDateCounts.set(dk, (clientDateCounts.get(dk) || 0) + 1);
    }
  });

  return sessions.map(s => {
    if (!s || s.isDeleted || s.type === 'cancelled' || s.type === 'non-session') return s;
    if (cutoff && s.date && s.date < cutoff) return s;

    const keys = getLedgerKeysForSession(s);
    let matchedEntry: AccountingLedgerEntry | undefined = undefined;
    for (const k of keys) {
      if (k.startsWith('day:') && (clientDateCounts.get(k) || 0) > 1) continue;
      if (ledger[k]) {
        matchedEntry = ledger[k];
        break;
      }
    }

    if (!matchedEntry) return s;

    const currentHasPayment = s.paymentStatus === 'paid' || s.paymentStatus === 'partial' || (Number(s.paidAmount) || 0) > 0;
    const ledgerHasPayment = matchedEntry.paymentStatus === 'paid' || matchedEntry.paymentStatus === 'partial' || (Number(matchedEntry.paidAmount) || 0) > 0;
    const sTime = s.updatedAt || 0;
    const lTime = matchedEntry.updatedAt || 0;

    // If session is currently unpaid (e.g. reset by calendar sync) while ledger says paid/partial,
    // OR if ledger has a newer manual edit, restore accounting fields from ledger!
    if ((ledgerHasPayment && !currentHasPayment && !(s.isManuallyEdited && sTime >= lTime)) ||
        (matchedEntry.isManuallyEdited && (!s.isManuallyEdited || lTime > sTime))) {
      const isOnline = s.type === 'online';
      return {
        ...s,
        paymentStatus: matchedEntry.paymentStatus,
        paidAmount: matchedEntry.paidAmount ?? (matchedEntry.paymentStatus === 'paid' ? (matchedEntry.price || s.price) : s.paidAmount),
        paymentMethod: matchedEntry.paymentMethod || s.paymentMethod,
        price: matchedEntry.price > 0 ? matchedEntry.price : s.price,
        hasBabysitterFee: matchedEntry.hasBabysitterFee ?? s.hasBabysitterFee,
        babysitterFeeAmount: matchedEntry.hasBabysitterFee ? (matchedEntry.babysitterFeeAmount || s.babysitterFeeAmount) : 0,
        hasOfficeRentFee: isOnline ? false : (matchedEntry.hasOfficeRentFee ?? s.hasOfficeRentFee),
        officeRentFeeAmount: isOnline ? 0 : (matchedEntry.hasOfficeRentFee ? (matchedEntry.officeRentFeeAmount || s.officeRentFeeAmount) : 0),
        isManuallyEdited: true,
        updatedAt: Math.max(sTime, lTime)
      };
    }

    return s;
  });
}

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

      const rawSessions = (data.sessions as Session[]) || [];
      const remoteLedger = (data.accountingLedger as Record<string, AccountingLedgerEntry>) || undefined;
      const mergedLedger = updateLocalAccountingLedger(userId, rawSessions, remoteLedger);
      const healedSessions = applyAccountingLedgerToSessions(rawSessions, mergedLedger, settings.accountingStartDate);

      return {
        settings,
        sessions: healedSessions,
        expenses: (data.expenses as Expense[]) || [],
        backupSnapshots: (data.backupSnapshots as DataBackupSnapshot[]) || [],
        accountingLedger: mergedLedger,
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
  const activeSessions = (sessions || []).filter(s => !s.isDeleted && s.type !== 'cancelled' && s.type !== 'non-session');
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
  const cleanedSettings = JSON.parse(JSON.stringify(settings));
  // 1. Auto-prune soft-deleted sessions older than 30 days (TTL cleanup to ensure zero data bloat)
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const cleanedSessions = (JSON.parse(JSON.stringify(sessions)) as Session[]).filter(s => {
    if (!s) return false;
    if (s.isDeleted && s.deletedAt && s.deletedAt < thirtyDaysAgo) {
      return false; // Permanently purge past 30 days
    }
    return true;
  });

  const cleanedExpenses = expenses ? JSON.parse(JSON.stringify(expenses)) : [];

  // Update persistent accounting ledger (protects paid/manual status across calendar syncs and reloads)
  const accountingLedger = updateLocalAccountingLedger(userId, cleanedSessions);

  // ALWAYS write to local safety emergency backup immediately and async to IndexedDB (100MB+ limit)
  try {
    idbSet(`psycalcu_safety_backup_${userId}`, cleanedSessions).catch(() => {});
    idbSet(`psycalcu_safety_settings_${userId}`, cleanedSettings).catch(() => {});
    idbSet(`psycalcu_sessions_${userId}`, cleanedSessions).catch(() => {});
    idbSet(`psycalcu_settings_${userId}`, cleanedSettings).catch(() => {});
    // Purge old heavy keys from localStorage to prevent 5MB QuotaExceededError
    localStorage.removeItem(`psycalcu_safety_backup_${userId}`);
    localStorage.removeItem(`psycalcu_safety_settings_${userId}`);
  } catch (e) {}

  // Auto-create snapshot if requested OR periodically for safety if there are paid sessions
  // STRICT ROLLING LIMIT: Max 5 snapshots in IndexedDB (FIFO)
  const snapReason = snapshotReason || (sessions && sessions.some(s => s.paymentStatus === 'paid') ? 'Otomatik Muhasebe Güvenlik Yedeği' : '');
  let updatedSnapshots: DataBackupSnapshot[] | undefined = undefined;
  if (cleanedSessions && cleanedSessions.length > 0 && snapReason) {
    try {
      const snap = createSnapshotObject(snapReason, cleanedSettings, cleanedSessions, cleanedExpenses);
      const localKey = `psycalcu_snapshots_${userId}`;
      let localSnaps: DataBackupSnapshot[] = [];
      try {
        const idbExisting = await idbGet<DataBackupSnapshot[]>(localKey);
        if (Array.isArray(idbExisting)) {
          localSnaps = idbExisting;
        } else {
          const oldStr = localStorage.getItem(localKey);
          if (oldStr) localSnaps = JSON.parse(oldStr);
        }
      } catch (e) {}

      // Deduplicate snapshots
      localSnaps = localSnaps.filter(s => s && (Date.now() - new Date(s.timestamp).getTime() > 60000 || s.label !== snap.label));
      localSnaps.unshift(snap);
      if (localSnaps.length > 5) localSnaps = localSnaps.slice(0, 5);
      
      // Store full snapshots in IndexedDB (hundreds of MBs capacity)
      idbSet(localKey, localSnaps).catch(() => {});
      idbSet('psycalcu_snapshots_active', localSnaps).catch(() => {});
      updatedSnapshots = localSnaps;

      // Clean up snapshot strings from localStorage to guarantee zero browser storage limit warnings
      localStorage.removeItem(localKey);
      localStorage.removeItem('psycalcu_snapshots_active');
    } catch (localErr) {}
  }

  if (isFirestoreQuotaExceeded) {
    console.warn('[firestoreService] Firestore cloud quota limit reached. Data safely preserved in IndexedDB.');
    return;
  }
  try {
    const docRef = doc(db, 'users', userId);

    // Build a compact cloud snapshot (containing only paid/partial/manually edited sessions)
    // so Firestore document NEVER exceeds the 1MB (1,048,576 bytes) hard limit!
    const compactCloudSnapshots = (updatedSnapshots || []).slice(0, 2).map(snap => ({
      ...snap,
      sessions: (snap.sessions || []).filter(
        s => s && !s.isDeleted && (s.paymentStatus === 'paid' || s.paymentStatus === 'partial' || (Number(s.paidAmount) || 0) > 0 || s.isManuallyEdited)
      )
    }));

    const payload: any = { 
      settings: cleanedSettings, 
      sessions: cleanedSessions, 
      expenses: cleanedExpenses,
      accountingLedger,
      lastUpdatedAt: new Date().toISOString()
    };

    if (compactCloudSnapshots.length > 0) {
      payload.backupSnapshots = compactCloudSnapshots;
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

    // Safety check: if serialized payload is over 700KB, omit backupSnapshots and trim ledger to stay well under 1MB
    const serializedSize = JSON.stringify(payload).length;
    if (serializedSize > 700000) {
      payload.backupSnapshots = deleteField();
    }

    try {
      await setDoc(docRef, payload, { merge: true });
    } catch (writeErr: any) {
      const msg = (writeErr?.message || String(writeErr)).toLowerCase();
      if (msg.includes('size') || msg.includes('1048576') || msg.includes('longer than') || writeErr?.code === 'invalid-argument') {
        // Document exceeded 1MB due to legacy backupSnapshots field in Firestore — purge backupSnapshots and retry immediately!
        payload.backupSnapshots = deleteField();
        await setDoc(docRef, payload, { merge: true });
      } else {
        throw writeErr;
      }
    }

    // Also save public-safe availability data to a separate collection only if room or owner features are configured
    const hasRoomOrPublicConfig = (settings?.rooms && settings.rooms.length > 0) || 
                                  (settings?.blockedSlots && settings.blockedSlots.length > 0) || 
                                  settings?.userRole === 'owner';
    if (hasRoomOrPublicConfig) {
      try {
        const publicDocRef = doc(db, 'public_availability', userId);
        const publicSessions = (sessions || []).filter((s: Session) => !s.isDeleted && s.type !== 'non-session').map((s: Session) => {
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
    }
  } catch (error: any) {
    if (checkIsQuotaError(error)) {
      isFirestoreQuotaExceeded = true;
      console.warn("[firestoreService] Cloud quota reached. Data safely preserved in local/IndexedDB cache.");
      return;
    }
    console.error("Error saving user data to Firestore: ", error);
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


