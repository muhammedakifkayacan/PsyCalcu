import { db } from './firebase';
import { doc, setDoc, getDoc, deleteField } from 'firebase/firestore';
import { Session, AppSettings, Expense, DataBackupSnapshot, getNormalizedClientName, toTurkishAscii } from '../types';
import { idbSet, idbGet } from '../utils/idbStorage';
import { mergeClosedMonths } from '../utils/monthCloseUtils';

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
  isPaymentLocked?: boolean;
  calendarSyncNotice?: string;
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
export const CLIENT_INSTANCE_ID = 'client_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
export let lastLocalFirestoreWriteAt = 0;

let cachedMemoryLedger: Record<string, AccountingLedgerEntry> | null = null;
let lastSerializedLedgerStr = '';
let lastAutoSnapshotTime = 0;

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

export function isMeaningfulLedgerEntry(entry?: Partial<AccountingLedgerEntry> | Session | null): boolean {
  if (!entry) return false;
  const hasRealPayment =
    ((entry.paymentStatus === 'paid' || entry.paymentStatus === 'partial') && (Number(entry.price) || 0) > 0) ||
    (Number(entry.paidAmount) || 0) > 0;
  return Boolean(hasRealPayment || entry.isManuallyEdited);
}

export function updateLocalAccountingLedger(
  userId: string | undefined,
  sessions: Session[],
  remoteLedger?: Record<string, AccountingLedgerEntry>,
  allowUnpaidOverwrite: boolean = false
): Record<string, AccountingLedgerEntry> {
  const storageKey = userId ? `psycalcu_accounting_ledger_${userId}` : 'psycalcu_accounting_ledger';
  const rawLoadedLedger = getStoredAccountingLedger(userId);

  // Filter out 0-TL auto-zeroed historical entries so the ledger stays tiny and fast
  const mergedLedger: Record<string, AccountingLedgerEntry> = {};
  for (const [k, entry] of Object.entries(rawLoadedLedger)) {
    if (isMeaningfulLedgerEntry(entry)) {
      mergedLedger[k] = entry;
    }
  }

  if (remoteLedger && typeof remoteLedger === 'object') {
    for (const [k, entry] of Object.entries(remoteLedger)) {
      if (!isMeaningfulLedgerEntry(entry)) continue;
      const existing = mergedLedger[k];
      if (!existing) {
        mergedLedger[k] = entry;
        continue;
      }
      const existingIsPaid =
        existing.paymentStatus === 'paid' ||
        existing.paymentStatus === 'partial' ||
        (Number(existing.paidAmount) || 0) > 0;
      const incomingIsPaid =
        entry.paymentStatus === 'paid' ||
        entry.paymentStatus === 'partial' ||
        (Number(entry.paidAmount) || 0) > 0;

      // Never let a remote 'unpaid' entry overwrite a local 'paid' entry unless remote is strictly newer AND explicitly allowed
      if (existingIsPaid && !incomingIsPaid && !allowUnpaidOverwrite) {
        continue;
      }

      if (
        (incomingIsPaid && !existingIsPaid) ||
        (entry.updatedAt || 0) > (existing.updatedAt || 0)
      ) {
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
    if (!isMeaningfulLedgerEntry(s)) return;

    const hasPayment =
      s.paymentStatus === 'paid' ||
      s.paymentStatus === 'partial' ||
      (Number(s.paidAmount) || 0) > 0;

    // IMPORTANT: Never fallback to Date.now() for sessions without updatedAt, otherwise old sessions with updatedAt=0
    // get a brand-new timestamp during sync/refresh and overwrite recent payments!
    const sUpdatedAt = typeof s.updatedAt === 'number' && s.updatedAt > 0 ? s.updatedAt : 0;

    const entry: AccountingLedgerEntry = {
      id: s.id,
      paymentStatus: s.paymentStatus || 'unpaid',
      ...(s.paidAmount !== undefined ? { paidAmount: Number(s.paidAmount) || 0 } : {}),
      ...(s.paymentMethod ? { paymentMethod: s.paymentMethod } : {}),
      price: Number(s.price) || 0,
      hasBabysitterFee: Boolean(s.hasBabysitterFee),
      babysitterFeeAmount: Number(s.babysitterFeeAmount) || 0,
      hasOfficeRentFee: s.type === 'online' ? false : Boolean(s.hasOfficeRentFee),
      officeRentFeeAmount: s.type === 'online' ? 0 : (Number(s.officeRentFeeAmount) || 0),
      isManuallyEdited: Boolean(s.isManuallyEdited || hasPayment),
      isPaymentLocked: hasPayment ? true : false,
      ...(s.calendarSyncNotice ? { calendarSyncNotice: s.calendarSyncNotice } : {}),
      updatedAt: sUpdatedAt,
      clientName: s.clientName,
      date: s.date,
      time: s.time
    };

    const keys = getLedgerKeysForSession(s);
    for (const k of keys) {
      if (k.startsWith('day:') && (clientDateCounts.get(k) || 0) > 1) continue;
      const existing = mergedLedger[k];
      if (!existing) {
        mergedLedger[k] = entry;
        continue;
      }

      const existingIsPaid =
        existing.paymentStatus === 'paid' ||
        existing.paymentStatus === 'partial' ||
        (Number(existing.paidAmount) || 0) > 0;

      // CRITICAL PROTECTION:
      // If ledger already records this session as PAID, never overwrite it with UNPAID unless allowUnpaidOverwrite is true
      // (which is only set when the user explicitly clicks to cancel/unpay a session)
      if (existingIsPaid && !hasPayment) {
        if (allowUnpaidOverwrite && s.isManuallyEdited && sUpdatedAt >= (existing.updatedAt || 0)) {
          mergedLedger[k] = entry;
        }
        continue;
      }

      if (
        (hasPayment && !existingIsPaid) ||
        (sUpdatedAt > 0 && sUpdatedAt >= (existing.updatedAt || 0))
      ) {
        const nextEntry: AccountingLedgerEntry = {
          ...entry
        };
        const notice = entry.calendarSyncNotice || existing.calendarSyncNotice;
        if (notice) {
          nextEntry.calendarSyncNotice = notice;
        }
        mergedLedger[k] = nextEntry;
      }
    }
  });

  cachedMemoryLedger = mergedLedger;

  try {
    if (typeof window !== 'undefined') {
      const serialized = JSON.stringify(mergedLedger);
      if (serialized !== lastSerializedLedgerStr) {
        lastSerializedLedgerStr = serialized;
        try {
          localStorage.setItem(storageKey, serialized);
          localStorage.setItem('psycalcu_accounting_ledger', serialized);
        } catch (quotaErr) {
          try {
            localStorage.removeItem('psycalcu_snapshots_active');
            localStorage.removeItem('psycalcu_sessions');
            if (userId) {
              localStorage.removeItem(`psycalcu_snapshots_${userId}`);
              localStorage.removeItem(`psycalcu_safety_backup_${userId}`);
              localStorage.removeItem(`psycalcu_sessions_${userId}`);
            }
            localStorage.setItem(storageKey, serialized);
            localStorage.setItem('psycalcu_accounting_ledger', serialized);
          } catch (e2) {}
        }
        idbSet(storageKey, mergedLedger).catch(() => {});
        idbSet('psycalcu_accounting_ledger', mergedLedger).catch(() => {});
      }
    }
  } catch (e) {}

  return mergedLedger;
}

export function getStoredAccountingLedger(userId?: string): Record<string, AccountingLedgerEntry> {
  if (cachedMemoryLedger && Object.keys(cachedMemoryLedger).length > 0) {
    return cachedMemoryLedger;
  }
  if (typeof window === 'undefined') return {};
  const storageKey = userId ? `psycalcu_accounting_ledger_${userId}` : 'psycalcu_accounting_ledger';
  const combined: Record<string, AccountingLedgerEntry> = {};
  try {
    const rawGlobal = localStorage.getItem('psycalcu_accounting_ledger');
    if (rawGlobal) {
      Object.assign(combined, JSON.parse(rawGlobal) || {});
    }
    if (userId) {
      const rawUser = localStorage.getItem(storageKey);
      if (rawUser) {
        Object.assign(combined, JSON.parse(rawUser) || {});
      }
    } else {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('psycalcu_accounting_ledger_')) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try {
              Object.assign(combined, JSON.parse(raw) || {});
            } catch (e) {}
          }
        }
      }
    }
  } catch (e) {}
  cachedMemoryLedger = combined;
  return combined;
}

export function applyAccountingLedgerToSessions(
  sessions: Session[],
  ledger?: Record<string, AccountingLedgerEntry>,
  _accountingStartDate?: string | null
): Session[] {
  if (!Array.isArray(sessions) || !ledger || Object.keys(ledger).length === 0) return sessions;

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

    const keys = getLedgerKeysForSession(s);
    let matchedEntry: AccountingLedgerEntry | undefined = undefined;
    for (const k of keys) {
      if (k.startsWith('day:') && (clientDateCounts.get(k) || 0) > 1) continue;
      const candidate = ledger[k];
      if (candidate) {
        if (
          !matchedEntry ||
          ((candidate.paymentStatus === 'paid' || candidate.paymentStatus === 'partial') &&
            matchedEntry.paymentStatus === 'unpaid') ||
          (candidate.updatedAt || 0) > (matchedEntry.updatedAt || 0)
        ) {
          matchedEntry = candidate;
        }
      }
    }

    if (!matchedEntry) return s;

    const currentHasPayment = s.paymentStatus === 'paid' || s.paymentStatus === 'partial' || (Number(s.paidAmount) || 0) > 0;
    const ledgerHasPayment = matchedEntry.paymentStatus === 'paid' || matchedEntry.paymentStatus === 'partial' || (Number(matchedEntry.paidAmount) || 0) > 0;
    const sTime = s.updatedAt || 0;
    const lTime = matchedEntry.updatedAt || 0;

    // CRITICAL GUARANTEE:
    // If ledger says the session is PAID (or PARTIAL) and the session is currently UNPAID,
    // ALWAYS restore the payment status from the ledger!
    if ((ledgerHasPayment && !currentHasPayment) ||
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
        isPaymentLocked: ledgerHasPayment ? true : Boolean(s.isPaymentLocked),
        calendarSyncNotice: s.calendarSyncNotice || matchedEntry.calendarSyncNotice,
        updatedAt: Math.max(sTime, lTime)
      };
    }

    if (ledgerHasPayment && !s.isPaymentLocked) {
      return {
        ...s,
        isPaymentLocked: true,
        isManuallyEdited: true
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

      // Reconcile closedMonths & reopenedMonths with local storage so closed months never revert to open
      const mergedMonthState = mergeClosedMonths(
        undefined,
        settings.closedMonths || data.closedMonths,
        userId,
        settings.reopenedMonths || data.reopenedMonths
      );
      settings.closedMonths = mergedMonthState.closedMonths;
      settings.reopenedMonths = mergedMonthState.reopenedMonths;

      const rawSessions = (data.sessions as Session[]) || [];
      const remoteLedger = (data.accountingLedger as Record<string, AccountingLedgerEntry>) || {};

      // Also merge any IndexedDB stored accounting ledger and local sessions so offline/recent payments are never lost
      let idbLedger: Record<string, AccountingLedgerEntry> = {};
      let idbSessions: Session[] = [];
      try {
        const storedIdbLedger = await idbGet<Record<string, AccountingLedgerEntry>>(`psycalcu_accounting_ledger_${userId}`);
        if (storedIdbLedger && typeof storedIdbLedger === 'object') {
          idbLedger = storedIdbLedger;
        }
        const storedIdbSessions = await idbGet<Session[]>(`psycalcu_sessions_${userId}`);
        if (Array.isArray(storedIdbSessions)) {
          idbSessions = storedIdbSessions;
        } else if (typeof storedIdbSessions === 'string') {
          idbSessions = JSON.parse(storedIdbSessions) || [];
        }
      } catch (e) {}

      let localCachedSessions: Session[] = [];
      try {
        if (typeof window !== 'undefined') {
          const rawLocalStr = localStorage.getItem(`psycalcu_sessions_${userId}`) || localStorage.getItem('psycalcu_sessions');
          if (rawLocalStr) {
            localCachedSessions = JSON.parse(rawLocalStr) || [];
          }
        }
      } catch (e) {}

      const combinedLedgerSource: Record<string, AccountingLedgerEntry> = { ...remoteLedger };
      for (const [k, v] of Object.entries(idbLedger)) {
        if (!isMeaningfulLedgerEntry(v)) continue;
        const ex = combinedLedgerSource[k];
        const vPaid = v.paymentStatus === 'paid' || v.paymentStatus === 'partial' || (Number(v.paidAmount) || 0) > 0;
        const exPaid = ex && (ex.paymentStatus === 'paid' || ex.paymentStatus === 'partial' || (Number(ex.paidAmount) || 0) > 0);
        if (!ex || (vPaid && !exPaid) || (v.updatedAt || 0) >= (ex.updatedAt || 0)) {
          combinedLedgerSource[k] = v;
        }
      }

      const mergedLedger = updateLocalAccountingLedger(
        userId,
        [...rawSessions, ...idbSessions, ...localCachedSessions],
        combinedLedgerSource,
        false
      );
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
  snapshotReason?: string,
  allowUnpaidOverwrite: boolean = false
): Promise<void> {
  lastLocalFirestoreWriteAt = Date.now();
  const mergedMonthState = mergeClosedMonths(
    settings.closedMonths,
    undefined,
    userId,
    undefined,
    settings.reopenedMonths
  );
  const cleanedSettings: AppSettings = {
    ...settings,
    closedMonths: mergedMonthState.closedMonths,
    reopenedMonths: mergedMonthState.reopenedMonths
  };

  // 1. Auto-prune soft-deleted sessions older than 30 days without expensive JSON.parse(JSON.stringify)
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const cleanedSessions = (sessions || []).filter(s => {
    if (!s) return false;
    if (s.isDeleted && s.deletedAt && s.deletedAt < thirtyDaysAgo) {
      return false;
    }
    return true;
  });

  const cleanedExpenses = expenses || [];

  // Update persistent accounting ledger (protects paid/manual status across calendar syncs and reloads)
  const accountingLedger = updateLocalAccountingLedger(userId, cleanedSessions, undefined, allowUnpaidOverwrite);

  // Write to IndexedDB asynchronously without blocking main thread
  try {
    idbSet(`psycalcu_sessions_${userId}`, cleanedSessions).catch(() => {});
    idbSet(`psycalcu_settings_${userId}`, cleanedSettings).catch(() => {});
  } catch (e) {}

  // Only create heavy full snapshots when explicitly requested or at most once every 3 minutes
  const now = Date.now();
  const shouldCreateSnapshot = Boolean(snapshotReason) || (now - lastAutoSnapshotTime > 180000 && cleanedSessions.some(s => s.paymentStatus === 'paid'));
  if (cleanedSessions.length > 0 && shouldCreateSnapshot) {
    lastAutoSnapshotTime = now;
    const snapReason = snapshotReason || 'Otomatik Muhasebe Güvenlik Yedeği';
    setTimeout(() => {
      try {
        const currentSnap = createSnapshotObject(snapReason, cleanedSettings, cleanedSessions, cleanedExpenses);
        const localKey = `psycalcu_snapshots_${userId}`;
        idbGet<DataBackupSnapshot[]>(localKey)
          .then(idbExisting => {
            let localSnaps: DataBackupSnapshot[] = Array.isArray(idbExisting) ? idbExisting : [];
            localSnaps = localSnaps.filter(s => s && (Date.now() - new Date(s.timestamp).getTime() > 60000 || s.label !== currentSnap.label));
            localSnaps.unshift(currentSnap);
            if (localSnaps.length > 5) localSnaps = localSnaps.slice(0, 5);
            idbSet(localKey, localSnaps).catch(() => {});
            idbSet('psycalcu_snapshots_active', localSnaps).catch(() => {});
          })
          .catch(() => {});
      } catch (e) {}
    }, 50);
  }

  if (isFirestoreQuotaExceeded) {
    return;
  }
  try {
    const docRef = doc(db, 'users', userId);
    const cutoffDate = (cleanedSettings.accountingStartDate || '2026-07-01').split('T')[0];

    // Strip bulky calendar descriptions from cloud-stored sessions (calendar notes are stored locally in IndexedDB)
    let cloudSessions = cleanedSessions.map(s => {
      if (s.isSyncedFromCalendar && s.notes) {
        return { ...s, notes: '' };
      }
      return s;
    });

    // If there are many historical calendar sessions (> 700), keep all active-period & paid/edited sessions so Firestore doc stays small and fast
    if (cloudSessions.length > 700) {
      cloudSessions = cloudSessions.filter(
        s => !s.isDeleted && ((s.date && s.date >= cutoffDate) || isMeaningfulLedgerEntry(s))
      );
    }

    const payload: any = { 
      settings: cleanedSettings,
      closedMonths: cleanedSettings.closedMonths || {},
      reopenedMonths: cleanedSettings.reopenedMonths || {},
      sessions: cloudSessions, 
      expenses: cleanedExpenses,
      accountingLedger,
      lastModifiedByClientId: CLIENT_INSTANCE_ID,
      lastUpdatedAt: new Date().toISOString()
    };

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

    try {
      lastLocalFirestoreWriteAt = Date.now();
      await setDoc(docRef, payload, { merge: true });
      lastLocalFirestoreWriteAt = Date.now();
    } catch (writeErr: any) {
      const msg = (writeErr?.message || String(writeErr)).toLowerCase();
      if (msg.includes('size') || msg.includes('1048576') || msg.includes('longer than') || writeErr?.code === 'invalid-argument') {
        // Document exceeded 1MB due to legacy fields in Firestore — purge heavy fields and compact sessions, then retry immediately!
        payload.backupSnapshots = deleteField();
        payload.calendarHistory = deleteField();
        payload.sessions = cloudSessions.filter(
          s => !s.isDeleted && ((s.date && s.date >= cutoffDate) || isMeaningfulLedgerEntry(s))
        );
        try {
          await setDoc(docRef, payload, { merge: true });
        } catch (retryErr) {
          // Even in worst-case size overflow, ALWAYS persist accountingLedger + paid/edited sessions + settings!
          const essentialSessions = cloudSessions.filter(s => !s.isDeleted && isMeaningfulLedgerEntry(s));
          await setDoc(docRef, {
            settings: cleanedSettings,
            closedMonths: cleanedSettings.closedMonths || {},
            reopenedMonths: cleanedSettings.reopenedMonths || {},
            sessions: essentialSessions,
            accountingLedger,
            backupSnapshots: deleteField(),
            calendarHistory: deleteField(),
            lastUpdatedAt: new Date().toISOString()
          }, { merge: true });
        }
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


