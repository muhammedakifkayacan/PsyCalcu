import { Session, AppSettings, Expense, ClosedMonthRecord } from '../types';
import { formatLocalDate } from './dateUtils';

export type { ClosedMonthRecord };

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
  if (!dateStr || !closedMonths) return false;
  const key = getMonthKey(dateStr);
  return Boolean(closedMonths[key]);
}

/**
 * Checks if a specific month ("YYYY-MM") is closed
 */
export function isMonthClosed(
  monthKey: string,
  closedMonths?: Record<string, ClosedMonthRecord>
): boolean {
  if (!monthKey || !closedMonths) return false;
  return Boolean(closedMonths[monthKey]);
}

/**
 * Finds the latest closed month key (e.g. "2026-08")
 */
export function getLatestClosedMonthKey(
  closedMonths?: Record<string, ClosedMonthRecord>
): string | null {
  if (!closedMonths) return null;
  const keys = Object.keys(closedMonths).filter(k => /^\d{4}-\d{2}$/.test(k));
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
    if (s.date && /^\d{4}-\d{2}-\d{2}/.test(s.date)) {
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
    s => s.date && s.date.startsWith(monthKey) && s.type !== 'non-session'
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
