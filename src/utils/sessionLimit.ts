/**
 * Session limit control utility to prevent database spam and ensure performance/quota limits.
 */

const WEEKLY_MANUAL_LIMIT = 150;

interface WeeklyActionState {
  weekStart: string;
  count: number;
}

/**
 * Helper to get the starting Monday date string of the current week.
 */
export function getStartOfWeek(d: Date = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  // Get date of the current week's Monday
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toDateString();
}

/**
 * Gets the current weekly manual action count from localStorage
 */
export function getWeeklyManualActionCount(): number {
  if (typeof window === 'undefined') return 0;
  
  const weekStartStr = getStartOfWeek();
  const stored = localStorage.getItem('psycalcu_weekly_manual_actions');
  
  if (stored) {
    try {
      const parsed: WeeklyActionState = JSON.parse(stored);
      if (parsed.weekStart === weekStartStr) {
        return parsed.count;
      }
    } catch (e) {
      console.error("Error parsing weekly manual actions:", e);
    }
  }
  
  // If no record or week changed, return 0
  return 0;
}

/**
 * Increments the weekly manual action count in localStorage
 */
export function incrementWeeklyManualActionCount(amount: number = 1): void {
  if (typeof window === 'undefined' || amount <= 0) return;
  
  const weekStartStr = getStartOfWeek();
  const currentCount = getWeeklyManualActionCount();
  const nextCount = currentCount + amount;
  
  localStorage.setItem('psycalcu_weekly_manual_actions', JSON.stringify({
    weekStart: weekStartStr,
    count: nextCount
  }));
}

/**
 * Validates if the action is allowed under the security limits.
 * 
 * @param currentTotal - The current number of sessions in the app state
 * @param addedAmount - The number of new sessions being added
 * @param isUpdateOnly - True if we are only modifying an existing session (doesn't increase total count)
 * @param isManual - True if the addition is manual, false if synced from calendar
 */
export function validateSessionAction(
  currentTotal: number,
  addedAmount: number,
  isUpdateOnly: boolean = false,
  isManual: boolean = true
): { allowed: boolean; reason: 'weekly' | null; message: string } {
  // Weekly Manual Limit Check
  if (isManual && !isUpdateOnly && addedAmount > 0) {
    const weeklyCount = getWeeklyManualActionCount();
    if ((weeklyCount + addedAmount) > WEEKLY_MANUAL_LIMIT) {
      return {
        allowed: false,
        reason: 'weekly',
        message: `Haftalık manuel seans ekleme sınırına ulaştınız. Sistem güvenliği ve olası spam/suistimalleri önlemek amacıyla manuel olarak haftada en fazla ${WEEKLY_MANUAL_LIMIT} seans ekleyebilirsiniz. Takvim entegrasyonu eşitlemeleriniz bu sınırdan etkilenmez.`
      };
    }
  }

  return {
    allowed: true,
    reason: null,
    message: ''
  };
}
