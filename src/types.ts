export type SessionType = 'online' | 'face-to-face' | 'cancelled' | 'non-session' | 'rent-income';

export type PaymentMethod = 'card' | 'cash' | 'transfer';

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
  hasKDV?: boolean; // whether KDV (VAT) deduction applies for this session
  isKdvInclusive?: boolean; // true = KDV Dahil (VAT Included), false = KDV Hariç (VAT Excluded)
  kdvRate?: number; // KDV percentage rate (e.g. 20 = %20)
  kdvAmount?: number; // calculated KDV amount (₺)
  notes?: string;
  isSyncedFromCalendar?: boolean;
  isFromMultiCalendar?: boolean;
  syncedCalendarType?: 'online' | 'face-to-face' | 'rent-income'; // which calendar it came from
  paymentStatus?: 'paid' | 'unpaid' | 'partial';
  paidAmount?: number; // ₺ amount actually received if partial or paid
  paymentMethod?: PaymentMethod; // 'card' (Kredi/Banka Kartı) | 'cash' (Nakit) | 'transfer' (Havale/EFT)
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
  roomId?: string;
}

export function normalizeOwnerCalendars(ownerCalendars: any): OwnerCalendar[] {
  if (!Array.isArray(ownerCalendars)) return [];
  return ownerCalendars.map((item, i) => {
    if (typeof item === 'string') {
      return { url: item, tenantName: `Terapist ${i + 1}` };
    }
    return {
      url: item?.url || '',
      tenantName: item?.tenantName || `Terapist ${i + 1}`,
      roomId: item?.roomId
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

export type ExpenseCategory = 'salary' | 'utilities' | 'rent' | 'maintenance' | 'supplies' | 'marketing' | 'tax' | 'other';

export interface Expense {
  id: string;
  title: string; // e.g. "Temizlik Elemanı Maaşı", "Elektrik Faturası", "Mutfak Alışverişi"
  category: ExpenseCategory;
  amount: number; // ₺
  date: string; // YYYY-MM-DD
  paymentMethod?: 'cash' | 'bank' | 'card'; // Kasa / Nakit, Banka / Havale, Kredi Kartı
  notes?: string;
  createdAt?: number;
}

export interface AppSettings {
  defaultSessionPrice: number;
  defaultBabysitterFee: number;
  defaultOfficeRentFee: number; // per face-to-face session office rent
  enableKDV?: boolean; // whether KDV (VAT) tax feature is enabled (default false)
  defaultKdvRate?: number; // default KDV percentage rate (default 20 = %20)
  defaultIsKdvInclusive?: boolean; // default KDV type (true = Dahil, false = Hariç)
  therapistName: string;
  therapistPhone?: string;
  calendarSyncEnabled: boolean;
  onlineCalendarWebcalUrl: string; // URL for online sessions calendar
  faceToFaceCalendarWebcalUrl: string; // URL for face-to-face sessions calendar
  googleSheetId: string;
  googleSheetsLinked: boolean;
  enableSmartClientPriceMatching?: boolean;
  autoMarkShortEventsAsNonSession?: boolean;
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

  // 1. Remove leading numbering/session prefixes e.g. "1. Ahmet", "1- Ahmet", "1. seans Ahmet", "#1 Ahmet", "Seans 1: Ahmet"
  clean = clean.replace(/^(?:(?:seans|seansı|oturum|görüşme|gorusme|no|no:)\s*)?\d+[\.\-\s\)\:\/]+(?:(?:seans|seansı|oturum|görüşme|gorusme)\s*(?:[\-\:\/]\s*)?)?/i, '');
  clean = clean.replace(/^#\s*\d+\s*(?:[\-\:\/]\s*)?/i, '');

  // 2. Remove trailing session words with numbers e.g. " 1. seans", " (1. seans)", " - 1. oturum", " seans 1", " seansı 2", " no: 3"
  clean = clean.replace(/[\s\-\(\[\{,#/]+(?:seans|seansı|oturum|görüşme|gorusme|no|no:)?\s*\d+[\.\s]*(?:seans|seansı|oturum|görüşme|gorusme)?[\)\}\]]*$/i, '');
  
  // 3. Remove trailing sequence numbers like " 1 2 3", " 1,2,3", " 1-2-3", " 123", " 1", " - 2", " (1)"
  clean = clean.replace(/[\s\-\(\[\{,#/]+(?:\d+[\s,\.\-\/]*)+[\)\}\]]*$/i, '');

  // 4. Remove attached trailing numbers e.g. "Ahmet1", "Ahmet123" (when preceded by letters)
  clean = clean.replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ])\d+$/i, '$1');

  // 5. Clean up any remaining trailing or leading punctuation/whitespace
  clean = clean.replace(/^[\s\-_:.,;()/[\]{}#]+|[\s\-_:.,;()/[\]{}#]+$/g, '');

  return clean.trim() || name.trim();
}

/**
 * Finds the latest valid (non-zero) session price for a given client (matching exact or variations like name 1, name-2).
 * Prioritizes sessions of the same normalized client name that are before or on the given date with price > 0.
 * If none found before the date, looks across all sessions for that client with price > 0.
 * If no previous price is found, returns the default price.
 */
export function getSmartClientPrice(
  clientName: string,
  sessionDate: string,
  sessions: Session[],
  defaultPrice: number
): number {
  if (!clientName || !Array.isArray(sessions)) return defaultPrice;
  const targetNormalized = getNormalizedClientName(clientName);
  
  // Filter active sessions that have the same normalized client name and valid price > 0
  const validSessions = sessions.filter(s => {
    if (!s || s.type === 'cancelled' || s.type === 'non-session') return false;
    if (typeof s.price !== 'number' || s.price <= 0) return false;
    const sNormalized = getNormalizedClientName(s.clientName);
    return sNormalized === targetNormalized;
  });
  
  if (validSessions.length === 0) {
    return defaultPrice;
  }
  
  // 1. First priority: Sessions before or on the given sessionDate
  const priorSessions = validSessions.filter(s => s.date <= sessionDate);
  if (priorSessions.length > 0) {
    priorSessions.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.time.localeCompare(a.time);
    });
    return priorSessions[0].price;
  }
  
  // 2. Second priority: Any known non-zero price for this client (closest to sessionDate)
  validSessions.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.time.localeCompare(a.time);
  });
  return validSessions[0].price;
}

/**
 * Finds the latest session price, babysitter fee, and office rent fee for a given client.
 * Looks for valid non-cancelled, non-session sessions.
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
  if (!clientName || !Array.isArray(sessions)) return result;
  const targetNormalized = getNormalizedClientName(clientName);

  // Find all matched sessions for this client (non-cancelled, non-session)
  const matchedSessions = sessions.filter(s => {
    if (!s || s.type === 'cancelled' || s.type === 'non-session') return false;
    const sNormalized = getNormalizedClientName(s.clientName);
    return sNormalized === targetNormalized;
  });

  if (matchedSessions.length === 0) {
    return result;
  }

  // Calculate smart price using dedicated robust logic
  result.price = getSmartClientPrice(clientName, sessionDate, sessions, defaultPrice);

  // Sort descending by date, then time for cost lookups
  const sortedSessions = [...matchedSessions].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.time.localeCompare(a.time);
  });

  // Find the most recent session before or on date (or any session) where babysitter fee was paid
  const sessionWithBabysitter = sortedSessions.find(s => s.date <= sessionDate && s.hasBabysitterFee && (Number(s.babysitterFeeAmount) || 0) > 0)
    || sortedSessions.find(s => s.hasBabysitterFee && (Number(s.babysitterFeeAmount) || 0) > 0);
  if (sessionWithBabysitter && sessionWithBabysitter.babysitterFeeAmount) {
    result.babysitterFeeAmount = sessionWithBabysitter.babysitterFeeAmount;
  }

  // Find the most recent session before or on date (or any session) where office rent fee was paid
  const sessionWithOfficeRent = sortedSessions.find(s => s.date <= sessionDate && s.hasOfficeRentFee && (Number(s.officeRentFeeAmount) || 0) > 0)
    || sortedSessions.find(s => s.hasOfficeRentFee && (Number(s.officeRentFeeAmount) || 0) > 0);
  if (sessionWithOfficeRent && sessionWithOfficeRent.officeRentFeeAmount) {
    result.officeRentFeeAmount = sessionWithOfficeRent.officeRentFeeAmount;
  }

  return result;
}

/**
 * Reconciles sessions so that any active session in the user's active accounting period (on or after registration / cutoff date)
 * with a 0 TL price automatically inherits the client's established non-zero smart price!
 */
export function autoHealSmartClientPrices(
  sessionList: Session[],
  defaultPrice: number,
  defaultBabysitterFee: number,
  defaultOfficeRentFee: number,
  accountingStartDate?: string | null
): Session[] {
  if (!Array.isArray(sessionList)) return [];

  // Cutoff date is the user's registration date (YYYY-MM-DD), if available
  const effectiveCutoff = accountingStartDate ? accountingStartDate.split('T')[0] : '';

  // Group latest known valid prices per normalized client name
  const clientEstablishedPrices = new Map<string, number>();

  // Pass 1: Find all clients with a known non-zero price in active sessions
  sessionList.forEach(s => {
    if (!s || s.type === 'cancelled' || s.type === 'non-session') return;
    const isWithinAccounting = !effectiveCutoff || (s.date && s.date >= effectiveCutoff);
    if (typeof s.price === 'number' && s.price > 0 && isWithinAccounting) {
      const normName = getNormalizedClientName(s.clientName);
      if (normName) {
        // Keep the latest price (or established price)
        const currentBest = clientEstablishedPrices.get(normName);
        if (!currentBest) {
          clientEstablishedPrices.set(normName, s.price);
        }
      }
    }
  });

  // Pass 2: If a session in active accounting period has price === 0, but the client has an established price, heal it!
  return sessionList.map(s => {
    if (!s) return s;
    const isWithinAccounting = !effectiveCutoff || (s.date && s.date >= effectiveCutoff);
    if (isWithinAccounting && s.type !== 'cancelled' && s.type !== 'non-session') {
      if (s.price === 0 || !s.price) {
        const normName = getNormalizedClientName(s.clientName);
        const establishedPrice = clientEstablishedPrices.get(normName) || getSmartClientPrice(s.clientName, s.date, sessionList, defaultPrice);
        if (establishedPrice && establishedPrice > 0) {
          const smartCosts = getSmartClientCosts(s.clientName, s.date, sessionList, establishedPrice, defaultBabysitterFee, defaultOfficeRentFee);
          return {
            ...s,
            price: establishedPrice,
            babysitterFeeAmount: s.hasBabysitterFee ? (s.babysitterFeeAmount || smartCosts.babysitterFeeAmount) : 0,
            officeRentFeeAmount: s.hasOfficeRentFee ? (s.officeRentFeeAmount || smartCosts.officeRentFeeAmount) : 0,
            updatedAt: Date.now()
          };
        }
      }
    }
    return s;
  });
}

