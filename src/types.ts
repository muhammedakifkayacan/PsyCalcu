export type SessionType = 'online' | 'face-to-face' | 'cancelled' | 'non-session' | 'rent-income';

export interface Session {
  id: string;
  clientName: string;
  type: SessionType;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  duration: number; // minutes
  price: number; // ₺
  hasBabysitterFee: boolean; // whether baby-sitter fee is paid for this session
  babysitterFeeAmount: number; // ₺
  hasOfficeRentFee: boolean; // whether per-session office rent is paid for this session (usually true for face-to-face)
  officeRentFeeAmount: number; // ₺
  notes?: string;
  isSyncedFromCalendar?: boolean;
  isFromMultiCalendar?: boolean;
  syncedCalendarType?: 'online' | 'face-to-face' | 'rent-income'; // which calendar it came from
  paymentStatus?: 'paid' | 'unpaid';
  updatedAt?: number; // timestamp in ms for conflict-free sync
  isManuallyEdited?: boolean; // track if user manually adjusted price/duration/costs
  roomId?: string; // Room association for property owners
}

export interface Room {
  id: string;
  name: string; // e.g. "Yetişkin Terapi Odası A"
  type: 'standard' | 'play-therapy' | 'family-therapy' | 'group-therapy' | 'other';
  color?: string; // e.g. "#6b705c" or a CSS color/class
}

export interface OwnerCalendar {
  url: string;
  tenantName: string;
}

export function normalizeOwnerCalendars(ownerCalendars: any): OwnerCalendar[] {
  if (!Array.isArray(ownerCalendars)) return [];
  return ownerCalendars.map((item, i) => {
    if (typeof item === 'string') {
      return { url: item, tenantName: `Terapist ${i + 1}` };
    }
    return {
      url: item?.url || '',
      tenantName: item?.tenantName || `Terapist ${i + 1}`
    };
  });
}

export interface BlockedSlot {
  id: string;
  roomId: string; // "all" or specific roomId
  date?: string; // "YYYY-MM-DD"
  dayOfWeek?: number; // 0-6 for recurring days (Monday is 1, Sunday is 0)
  time?: string; // "HH:MM" (e.g. "09:00"). If undefined, means the whole day is blocked
  reason?: string; // reason for blockage
}

export interface AppSettings {
  defaultSessionPrice: number;
  defaultBabysitterFee: number;
  defaultOfficeRentFee: number; // per face-to-face session office rent
  therapistName: string;
  calendarSyncEnabled: boolean;
  onlineCalendarWebcalUrl: string; // URL for online sessions calendar
  faceToFaceCalendarWebcalUrl: string; // URL for face-to-face sessions calendar
  googleSheetId: string;
  googleSheetsLinked: boolean;
  enableSmartClientPriceMatching?: boolean;
  defaultLandingPage?: 'agenda' | 'stats' | 'sync' | 'backup' | 'debts' | 'search';
  userRole?: 'tenant' | 'owner';
  ownerCalendars?: OwnerCalendar[];
  rooms?: Room[];
  blockedSlots?: BlockedSlot[];
}

export interface DaySummary {
  date: string;
  sessionCount: number;
  grossIncome: number;
  totalExpenses: number;
  netIncome: number;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'system' | 'announcement';
  timestamp: number; // ms timestamp
  read: boolean;
  author?: string;
  syncDetails?: {
    added: { id: string; clientName: string; date: string; time: string; type: SessionType }[];
    updated: { id: string; clientName: string; date: string; time: string; type: SessionType }[];
    deleted?: { id: string; clientName: string; date: string; time: string; type: SessionType }[];
  };
}

export function toTurkishUpper(str: string): string {
  if (!str) return '';
  return str.toLocaleUpperCase('tr-TR');
}

export function getNormalizedClientName(name: string): string {
  if (!name) return "";
  let clean = name.trim();
  // Regex to remove trailing numbers or patterns like " 1", " - 1", " 12", " (2)", " no 3", " seans 4", " seansı 4"
  clean = clean.replace(/[\s\-\(\[\{]+(?:seans|no|no:|seansı)?\s*\d+[\)\}\]]*$/i, '');
  // Strip any trailing spaces or dash noise
  clean = clean.replace(/[\s\-:\(\)]+$/, '');
  return clean.trim();
}

/**
 * Finds the latest session price for a given client (matching exact or variations like name 1, name-2).
 * It will find sessions of the same normalized client name that are before or on the given date,
 * and return the price of the most recent one.
 * If no previous session is found, returns the default price.
 */
export function getSmartClientPrice(
  clientName: string,
  sessionDate: string,
  sessions: Session[],
  defaultPrice: number
): number {
  if (!clientName) return defaultPrice;
  const targetNormalized = getNormalizedClientName(clientName);
  
  // Filter sessions that have the same normalized client name
  // and are before or on the given sessionDate.
  // Skip cancelled sessions as their price is usually 0.
  const matchedSessions = sessions.filter(s => {
    if (s.type === 'cancelled') return false;
    const sNormalized = getNormalizedClientName(s.clientName);
    return sNormalized === targetNormalized && s.date <= sessionDate;
  });
  
  if (matchedSessions.length === 0) {
    return defaultPrice;
  }
  
  // Sort matched sessions by date descending, then time descending
  matchedSessions.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.time.localeCompare(a.time);
  });
  
  return matchedSessions[0].price;
}

/**
 * Finds the latest session price, babysitter fee, and office rent fee for a given client.
 * Looks for non-cancelled sessions before or on the given session date.
 */
export function getSmartClientCosts(
  clientName: string,
  sessionDate: string,
  sessions: Session[],
  defaultPrice: number,
  defaultBabysitterFee: number,
  defaultOfficeRentFee: number
): { price: number; babysitterFeeAmount: number; officeRentFeeAmount: number } {
  const result = {
    price: defaultPrice,
    babysitterFeeAmount: defaultBabysitterFee,
    officeRentFeeAmount: defaultOfficeRentFee
  };
  if (!clientName) return result;
  const targetNormalized = getNormalizedClientName(clientName);

  // Find matched sessions for this client (non-cancelled, before or on sessionDate)
  const matchedSessions = sessions.filter(s => {
    if (s.type === 'cancelled') return false;
    const sNormalized = getNormalizedClientName(s.clientName);
    return sNormalized === targetNormalized && s.date <= sessionDate;
  });

  if (matchedSessions.length === 0) {
    return result;
  }

  // Sort descending by date, then time
  matchedSessions.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.time.localeCompare(a.time);
  });

  // Price is the most recent session's price
  result.price = matchedSessions[0].price;

  // Find the most recent session where they paid a babysitter fee
  const sessionWithBabysitter = matchedSessions.find(s => s.hasBabysitterFee && s.babysitterFeeAmount > 0);
  if (sessionWithBabysitter) {
    result.babysitterFeeAmount = sessionWithBabysitter.babysitterFeeAmount;
  }

  // Find the most recent session where they paid an office rent fee
  const sessionWithOfficeRent = matchedSessions.find(s => s.hasOfficeRentFee && s.officeRentFeeAmount > 0);
  if (sessionWithOfficeRent) {
    result.officeRentFeeAmount = sessionWithOfficeRent.officeRentFeeAmount;
  }

  return result;
}

