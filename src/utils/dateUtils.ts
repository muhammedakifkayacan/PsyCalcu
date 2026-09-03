/**
 * Timezone-safe local calendar date utilities.
 *
 * Prevents UTC-shifting bugs (such as toISOString() converting 00:00 local time
 * into 21:00 previous day in UTC+3 / Turkey, which previously caused the last day
 * of a 31-day month to be excluded from accounting and statistics).
 */

/**
 * Formats a Date object into "YYYY-MM-DD" based on the user's LOCAL calendar date.
 */
export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date in "YYYY-MM-DD" format in local time.
 */
export function getTodayLocalDate(): string {
  return formatLocalDate(new Date());
}

/**
 * Calculates start and end "YYYY-MM-DD" dates for accounting and statistics presets.
 * All ranges are strictly timezone-safe and include all days of 28/29/30/31-day months.
 */
export function getAccountingDateRange(
  preset: 'all' | 'thisMonth' | 'lastMonth' | 'last30Days' | 'last30' | 'last7' | 'last3Months' | 'custom' | string,
  customStart?: string,
  customEnd?: string
): { start: string; end: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();

  if (preset === 'thisMonth') {
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0); // Day 0 of next month is the exact last day of current month
    return {
      start: formatLocalDate(firstDay),
      end: formatLocalDate(lastDay),
    };
  }

  if (preset === 'lastMonth') {
    const firstDay = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0); // Day 0 of this month is the exact last day of previous month (31, 30, 29, or 28)
    return {
      start: formatLocalDate(firstDay),
      end: formatLocalDate(lastDay),
    };
  }

  if (preset === 'last30Days' || preset === 'last30') {
    const startD = new Date();
    startD.setDate(today.getDate() - 30);
    return {
      start: formatLocalDate(startD),
      end: formatLocalDate(today),
    };
  }

  if (preset === 'last7') {
    const startD = new Date();
    startD.setDate(today.getDate() - 7);
    return {
      start: formatLocalDate(startD),
      end: formatLocalDate(today),
    };
  }

  if (preset === 'last3Months') {
    const startD = new Date();
    startD.setMonth(today.getMonth() - 3);
    return {
      start: formatLocalDate(startD),
      end: formatLocalDate(today),
    };
  }

  if (preset === 'custom') {
    return {
      start: customStart || '',
      end: customEnd || '',
    };
  }

  // Default 'all'
  return { start: '', end: '' };
}
