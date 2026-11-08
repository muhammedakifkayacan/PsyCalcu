import { Session, AppSettings, Expense, ClosedMonthRecord } from '../types';
import { formatLocalDate } from './dateUtils';
import { idbSet } from './idbStorage';

export type { ClosedMonthRecord };

let activeClosedMonthsCache: Record<string, ClosedMonthRecord> | null = null;
let activeReopenedMonthsCache: Record<string, number> | null = null;
let cachedMonthsUserId: string | undefined = undefined;
let lastSavedClosedStr = '';
let lastSavedReopenedStr = '';

const closedAtMsCache = new Map<string, number>();
function parseClosedAtMs(closedAt?: string): number {
  if (!closedAt) return 0;
  const cached = closedAtMsCache.get(closedAt);
  if (cached !== undefined) return cached;
  const t = new Date(closedAt).getTime();
  const res = isNaN(t) ? 0 : t;
  closedAtMsCache.set(closedAt, res);
  return res;
}

/**
 * Reads explicitly reopened (unlocked) month timestamps from localStorage (with in-memory cache)
 */
export function getStoredReopenedMonths(userId?: string): Record<string, number> {
  if (typeof window === 'undefined') return activeReopenedMonthsCache || {};
  if (activeReopenedMonthsCache && (!userId || cachedMonthsUserId === userId)) {
    return activeReopenedMonthsCache;
  }

  const merged: Record<string, number> = { ...(activeReopenedMonthsCache || {}) };
  const keysToCheck = [
    userId ? `psycalcu_reopened_months_${userId}` : '',
    'psycalcu_reopened_months',
  ].filter(Boolean);

  try {
    for (const k of keysToCheck) {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (const [mKey, ts] of Object.entries(parsed)) {
            const numTs = Number(ts) || 0;
            if (numTs > (merged[mKey] || 0)) {
              merged[mKey] = numTs;
            }
          }
        }
      }
    }
    const settingsKeys = [
      userId ? `psycalcu_settings_${userId}` : '',
      'psycalcu_settings'
    ].filter(Boolean);
    for (const sk of settingsKeys) {
      const raw = localStorage.getItem(sk);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.reopenedMonths && typeof parsed.reopenedMonths === 'object') {
          for (const [mKey, ts] of Object.entries(parsed.reopenedMonths)) {
            const numTs = Number(ts) || 0;
            if (numTs > (merged[mKey] || 0)) {
              merged[mKey] = numTs;
            }
          }
        }
      }
    }
  } catch (e) {}

  activeReopenedMonthsCache = merged;
  return merged;
}

/**
 * Reads and merges closed months from all local persistence keys, respecting reopened months (with in-memory cache)
 */
export function getStoredClosedMonths(userId?: string): Record<string, ClosedMonthRecord> {
  if (typeof window === 'undefined') return activeClosedMonthsCache || {};
  if (activeClosedMonthsCache && (!userId || cachedMonthsUserId === userId)) {
    return activeClosedMonthsCache;
  }

  const reopened = getStoredReopenedMonths(userId);
  const merged: Record<string, ClosedMonthRecord> = { ...(activeClosedMonthsCache || {}) };

  const mergeSource = (src?: Record<string, ClosedMonthRecord>) => {
    if (!src || typeof src !== 'object') return;
    for (const [mKey, rec] of Object.entries(src)) {
      if (!rec || !/^\d{4}-\d{2}$/.test(mKey)) continue;
      const existing = merged[mKey];
      const recTime = parseClosedAtMs(rec.closedAt);
      const exTime = existing ? parseClosedAtMs(existing.closedAt) : -1;
      if (!existing || recTime >= exTime) {
        merged[mKey] = rec;
      }
    }
  };

  try {
    const directKeys = [
      userId ? `psycalcu_closed_months_${userId}` : '',
      'psycalcu_closed_months'
    ].filter(Boolean);

    for (const dk of directKeys) {
      const raw = localStorage.getItem(dk);
      if (raw) {
        mergeSource(JSON.parse(raw));
      }
    }

    const settingsKeys = [
      userId ? `psycalcu_settings_${userId}` : '',
      'psycalcu_settings'
    ].filter(Boolean);

    for (const sk of settingsKeys) {
      const raw = localStorage.getItem(sk);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.closedMonths) {
          mergeSource(parsed.closedMonths);
        }
      }
    }
  } catch (e) {}

  // Filter out any month that was explicitly reopened after it was closed
  const finalClosed: Record<string, ClosedMonthRecord> = {};
  for (const [mKey, rec] of Object.entries(merged)) {
    const closedMs = parseClosedAtMs(rec.closedAt);
    const reopenedMs = reopened[mKey] || 0;
    if (reopenedMs > 0 && reopenedMs > closedMs) {
      continue;
    }
    finalClosed[mKey] = rec;
  }

  activeClosedMonthsCache = finalClosed;
  if (userId) cachedMonthsUserId = userId;
  return finalClosed;
}

/**
 * Persists closed months and optional reopened month timestamp to localStorage and IndexedDB
 */
const effectiveClosedMonthsWeakCache = new WeakMap<object, Record<string, ClosedMonthRecord>>();

export function saveStoredClosedMonths(
  userId: string | undefined,
  closedMonths: Record<string, ClosedMonthRecord>,
  reopenedMonthKey?: string,
  extraReopenedMonths?: Record<string, number>
): { closedMonths: Record<string, ClosedMonthRecord>; reopenedMonths: Record<string, number> } {
  const reopened: Record<string, number> = {
    ...getStoredReopenedMonths(userId),
    ...(extraReopenedMonths || {})
  };

  if (reopenedMonthKey) {
    reopened[reopenedMonthKey] = Date.now();
  }

  const finalClosed: Record<string, ClosedMonthRecord> = {};
  for (const [mKey, rec] of Object.entries(closedMonths || {})) {
    if (!rec || !/^\d{4}-\d{2}$/.test(mKey)) continue;
    if (mKey === reopenedMonthKey) continue;
    const closedMs = parseClosedAtMs(rec.closedAt);
    const reopenedMs = reopened[mKey] || 0;
    if (reopenedMs > 0 && closedMs >= reopenedMs) {
      delete reopened[mKey];
    } else if (reopenedMs > 0 && reopenedMs > closedMs) {
      continue;
    }
    finalClosed[mKey] = rec;
  }

  activeClosedMonthsCache = finalClosed;
  activeReopenedMonthsCache = reopened;
  if (userId) cachedMonthsUserId = userId;
  effectiveClosedMonthsWeakCache.set(finalClosed, finalClosed);

  if (typeof window !== 'undefined') {
    try {
      const closedStr = JSON.stringify(finalClosed);
      const reopenedStr = JSON.stringify(reopened);
      if (closedStr !== lastSavedClosedStr || reopenedStr !== lastSavedReopenedStr) {
        lastSavedClosedStr = closedStr;
        lastSavedReopenedStr = reopenedStr;
        localStorage.setItem('psycalcu_closed_months', closedStr);
        localStorage.setItem('psycalcu_reopened_months', reopenedStr);
        if (userId) {
          localStorage.setItem(`psycalcu_closed_months_${userId}`, closedStr);
          localStorage.setItem(`psycalcu_reopened_months_${userId}`, reopenedStr);
          idbSet(`psycalcu_closed_months_${userId}`, finalClosed).catch(() => {});
          idbSet(`psycalcu_reopened_months_${userId}`, reopened).catch(() => {});
        }
        idbSet('psycalcu_closed_months', finalClosed).catch(() => {});
      }
    } catch (e) {}
  }

  return { closedMonths: finalClosed, reopenedMonths: reopened };
}

/**
 * Safely reconciles local, stored, and remote closedMonths so closed months never accidentally revert to open during sync
 */
export function mergeClosedMonths(
  localClosed?: Record<string, ClosedMonthRecord>,
  remoteClosed?: Record<string, ClosedMonthRecord>,
  userId?: string,
  remoteReopened?: Record<string, number>,
  localReopened?: Record<string, number>
): { closedMonths: Record<string, ClosedMonthRecord>; reopenedMonths: Record<string, number> } {
  const storedClosed = getStoredClosedMonths(userId);
  const storedReopened = getStoredReopenedMonths(userId);

  // Fast path: when no remote or new local records are passed, return cached state directly without re-looping
  if (
    (!remoteClosed || remoteClosed === storedClosed) &&
    (!localClosed || localClosed === storedClosed) &&
    (!remoteReopened || remoteReopened === storedReopened) &&
    (!localReopened || localReopened === storedReopened)
  ) {
    return { closedMonths: storedClosed, reopenedMonths: storedReopened };
  }

  const mergedReopened: Record<string, number> = { ...storedReopened };
  for (const src of [localReopened, remoteReopened]) {
    if (!src || typeof src !== 'object') continue;
    for (const [mKey, ts] of Object.entries(src)) {
      const numTs = Number(ts) || 0;
      if (numTs > (mergedReopened[mKey] || 0)) {
        mergedReopened[mKey] = numTs;
      }
    }
  }

  const combinedClosed: Record<string, ClosedMonthRecord> = {};
  for (const src of [storedClosed, remoteClosed, localClosed]) {
    if (!src || typeof src !== 'object') continue;
    for (const [mKey, rec] of Object.entries(src)) {
      if (!rec || !/^\d{4}-\d{2}$/.test(mKey)) continue;
      const existing = combinedClosed[mKey];
      const recMs = parseClosedAtMs(rec.closedAt);
      const exMs = existing ? parseClosedAtMs(existing.closedAt) : -1;
      if (!existing || recMs >= exMs) {
        combinedClosed[mKey] = rec;
      }
    }
  }

  return saveStoredClosedMonths(userId, combinedClosed, undefined, mergedReopened);
}

/**
 * Returns the effective closed months combining passed closedMonths and the persistent cache
 */
export function getEffectiveClosedMonths(
  closedMonths?: Record<string, ClosedMonthRecord>,
  userId?: string
): Record<string, ClosedMonthRecord> {
  const stored = activeClosedMonthsCache ?? getStoredClosedMonths(userId);
  if (!closedMonths || closedMonths === stored) {
    return stored;
  }
  const cached = effectiveClosedMonthsWeakCache.get(closedMonths);
  if (cached) return cached;

  const keys = Object.keys(closedMonths);
  if (keys.length === 0) {
    effectiveClosedMonthsWeakCache.set(closedMonths, stored);
    return stored;
  }

  const reopened = activeReopenedMonthsCache ?? getStoredReopenedMonths(userId);
  const merged: Record<string, ClosedMonthRecord> = { ...stored };
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const rec = closedMonths[k];
    if (!rec) continue;
    const closedMs = parseClosedAtMs(rec.closedAt);
    const reopenedMs = reopened[k] || 0;
    if (reopenedMs > 0 && reopenedMs > closedMs) continue;
    merged[k] = rec;
  }
  effectiveClosedMonthsWeakCache.set(closedMonths, merged);
  effectiveClosedMonthsWeakCache.set(merged, merged);
  return merged;
}

/**
 * Returns "YYYY-MM" from a date string (e.g. "2026-08-15" -> "2026-08")
 */
export function getMonthKey(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return '';
  return dateStr.slice(0, 7);
}

/**
 * Converts "YYYY-MM" to localized Turkish month label (e.g. "2026-08" -> "Ağustos 2026")
 */
export function formatMonthKey(monthKey: string): string {
  if (!monthKey || !monthKey.includes('-')) return monthKey || '';
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month)) return monthKey;
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

/**
 * Checks whether a given date ("YYYY-MM-DD") falls into a closed month
 */
export function isDateInClosedMonth(
  dateStr: string,
  closedMonths?: Record<string, ClosedMonthRecord>
): boolean {
  if (!dateStr || dateStr.length < 7) return false;
  const key = dateStr.slice(0, 7);
  const effective = getEffectiveClosedMonths(closedMonths);
  return Boolean(effective[key]);
}

/**
 * Checks if a specific month ("YYYY-MM") is closed
 */
export function isMonthClosed(
  monthKey: string,
  closedMonths?: Record<string, ClosedMonthRecord>
): boolean {
  if (!monthKey) return false;
  const effective = getEffectiveClosedMonths(closedMonths);
  return Boolean(effective[monthKey]);
}

/**
 * Finds the latest closed month key (e.g. "2026-08")
 */
export function getLatestClosedMonthKey(
  closedMonths?: Record<string, ClosedMonthRecord>
): string | null {
  const effective = getEffectiveClosedMonths(closedMonths);
  const keys = Object.keys(effective).filter(k => /^\d{4}-\d{2}$/.test(k));
  if (keys.length === 0) return null;
  keys.sort();
  return keys[keys.length - 1];
}

/**
 * Returns all distinct months ("YYYY-MM") present in sessions, sorted descending
 */
export function getAllSessionMonths(sessions: Session[]): string[] {
  const set = new Set<string>();
  sessions.forEach(s => {
    if (!s.isDeleted && s.date && /^\d{4}-\d{2}-\d{2}/.test(s.date)) {
      set.add(s.date.slice(0, 7));
    }
  });
  const arr = Array.from(set);
  arr.sort().reverse();
  return arr;
}

/**
 * Identifies unclosed past months that have ended (before the current month)
 * and contain sessions requiring review and closing.
 */
export function getUnclosedPastMonths(
  sessions: Session[],
  closedMonths?: Record<string, ClosedMonthRecord>,
  currentDate: Date = new Date()
): string[] {
  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const allMonths = getAllSessionMonths(sessions);

  // Past months strictly before the current month that are not closed
  return allMonths.filter(m => m < currentMonthKey && !isMonthClosed(m, closedMonths));
}

/**
 * Calculates a complete financial and audit summary for a given month ("YYYY-MM")
 */
export function calculateMonthAuditSummary(
  monthKey: string,
  sessions: Session[],
  expenses: Expense[] = [],
  settings?: AppSettings
) {
  const monthSessions = sessions.filter(
    s => !s.isDeleted && s.date && s.date.startsWith(monthKey) && s.type !== 'non-session'
  );

  let onlineCount = 0;
  let faceToFaceCount = 0;
  let cancelledCount = 0;

  let grossIncome = 0; // Total planned/billed session value
  let paidGrossIncome = 0; // Actually collected session income
  let unpaidDebtAmount = 0;
  let unpaidDebtCount = 0;

  let totalBabysitterFees = 0;
  let totalOfficeRentFees = 0;

  const zeroPriceSessions: Session[] = [];
  const missingRoomSessions: Session[] = [];
  const unpaidSessions: Session[] = [];

  monthSessions.forEach(s => {
    if (s.type === 'online') onlineCount++;
    else if (s.type === 'face-to-face') faceToFaceCount++;
    else if (s.type === 'cancelled') cancelledCount++;

    const price = Number(s.price) || 0;
    const isCancelled = s.type === 'cancelled';

    if (!isCancelled) {
      grossIncome += price;

      if (price === 0) {
        zeroPriceSessions.push(s);
      }

      if (s.type === 'face-to-face' && !s.roomId) {
        missingRoomSessions.push(s);
      }

      // Expenses from session fees
      if (s.hasBabysitterFee) {
        totalBabysitterFees += Number(s.babysitterFeeAmount) || (settings?.defaultBabysitterFee || 0);
      }
      if (s.hasOfficeRentFee) {
        totalOfficeRentFees += Number(s.officeRentFeeAmount) || (settings?.defaultOfficeRentFee || 0);
      }

      // Payment status
      if (s.paymentStatus === 'paid') {
        paidGrossIncome += price;
      } else if (s.paymentStatus === 'partial') {
        const paid = Number(s.paidAmount) || 0;
        paidGrossIncome += paid;
        const remaining = Math.max(0, price - paid);
        if (remaining > 0) {
          unpaidDebtAmount += remaining;
          unpaidDebtCount++;
          unpaidSessions.push(s);
        }
      } else {
        // unpaid
        unpaidDebtAmount += price;
        unpaidDebtCount++;
        unpaidSessions.push(s);
      }
    }
  });

  // General expenses belonging to this month
  const monthGeneralExpenses = expenses.filter(
    e => e.date && e.date.startsWith(monthKey)
  );
  const generalExpensesTotal = monthGeneralExpenses.reduce(
    (acc, e) => acc + (Number(e.amount) || 0),
    0
  );

  const totalExpenses = totalBabysitterFees + totalOfficeRentFees + generalExpensesTotal;
  const netIncome = grossIncome - totalExpenses;
  const collectedNetIncome = paidGrossIncome - totalExpenses;

  return {
    monthKey,
    monthLabel: formatMonthKey(monthKey),
    totalSessions: monthSessions.length,
    onlineCount,
    faceToFaceCount,
    cancelledCount,
    grossIncome,
    paidGrossIncome,
    unpaidDebtAmount,
    unpaidDebtCount,
    totalBabysitterFees,
    totalOfficeRentFees,
    generalExpensesTotal,
    totalExpenses,
    netIncome,
    collectedNetIncome,
    zeroPriceSessions,
    missingRoomSessions,
    unpaidSessions,
    sessions: monthSessions,
  };
}
