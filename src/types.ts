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

export interface ClientPricingRule {
  price: number; // general / fallback price
  onlinePrice?: number; // specific price for online sessions
  faceToFacePrice?: number; // specific price for face-to-face sessions
  hasBabysitterFee?: boolean;
  babysitterFeeAmount?: number;
  hasOfficeRentFee?: boolean;
  officeRentFeeAmount?: number;
  notes?: string;
  updatedAt?: number;
}

export interface DataBackupSnapshot {
  id: string;
  timestamp: string; // ISO string
  label: string; // e.g. "20 Eylül 2026 19:30 - Otomatik Yedek"
  sessionCount: number;
  expenseCount: number;
  totalGrossIncome: number;
  totalNetIncome: number;
  paidSessionsCount: number;
  unpaidSessionsCount: number;
  sessions: Session[];
  settings: AppSettings;
  expenses: Expense[];
}

export interface AppSettings {
  defaultSessionPrice: number;
  defaultOnlinePrice?: number; // per online session default price
  defaultFaceToFacePrice?: number; // per face-to-face session default price
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
  defaultLandingPage?: 'agenda' | 'stats' | 'sync' | 'backup' | 'debts' | 'search' | 'audit';
  userRole?: 'tenant' | 'owner';
  ownerCalendars?: OwnerCalendar[];
  rooms?: Room[];
  blockedSlots?: BlockedSlot[];
  accountingStartDate?: string; // YYYY-MM-DD cutoff for accounting & debt tracking
  clientCustomPrices?: { [normalizedClientName: string]: ClientPricingRule };
  hasSeenTour?: boolean; // whether user has completed or dismissed the onboarding tour
  closedMonths?: Record<string, ClosedMonthRecord>; // e.g. { "2026-08": ClosedMonthRecord }
  hasCompletedInitialCalendarSync?: boolean; // whether initial full calendar sync has been completed once
}

export interface ClosedMonthRecord {
  monthKey: string; // e.g. "2026-08" (YYYY-MM)
  closedAt: string; // ISO date-time string
  closedBy?: string; // therapistName or email
  sessionCount: number;
  onlineCount?: number;
  faceToFaceCount?: number;
  cancelledCount?: number;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  unpaidDebtCount?: number;
  unpaidDebtAmount?: number;
  notes?: string;
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
  // Normalize all whitespace characters (including non-breaking spaces, tabs, multiple spaces)
  let clean = name.replace(/[\s\u00A0]+/g, ' ').trim();

  // 1. Remove leading calendar / clinical event labels
  // e.g. "Seans: Zeynep", "Danışan - Zeynep", "Randevu: Zeynep", "Terapi: Zeynep", "Görüşme: Zeynep", "Oturum - Zeynep"
  clean = clean.replace(/^(?:seans|danışan|danisan|randevu|terapi|oturum|görüşme|gorusme)\s*[:\-–]\s*/i, '');

  // 2. Remove leading/trailing emojis and calendar symbols
  clean = clean.replace(/^[\s\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}•·*\-–|~#]+/gu, '');
  clean = clean.replace(/[\s\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}•·*\-–|~#]+$/gu, '');

  // 3. Remove leading session numbering or order prefixes
  // e.g. "1. Ahmet", "1- Ahmet", "1) Ahmet", "01. Ahmet", "1. seans Ahmet", "#1 Ahmet", "Seans 1: Ahmet"
  clean = clean.replace(/^(?:(?:seans|seansı|oturum|görüşme|gorusme|no|no:)\s*)?\d+[\.\-\s\)\:\/]+(?:(?:seans|seansı|oturum|görüşme|gorusme)\s*(?:[\-\:\/]\s*)?)?/i, '');
  clean = clean.replace(/^#\s*\d+\s*(?:[\-\:\/]\s*)?/i, '');

  // 4. Remove leading time stamps e.g. "14:00 Ahmet" or "(14:00) Ahmet"
  clean = clean.replace(/^[\(\[\{]*\b\d{1,2}[:.]\d{2}\b[\)\}\]]*[\s\-\:\.\)\(\[\{]+/i, '');

  // 5. Remove trailing time stamps e.g. "Ahmet 14:00" or "Ahmet (14:00)"
  clean = clean.replace(/[\s\-\(\[\{,#/]+\b\d{1,2}[:.]\d{2}\b[\)\}\]]*$/i, '');

  // 6. Remove session type / modality markers at start or end
  // e.g. "(Online)", "(Yüz Yüze)", " - Online", "[Yüzyüze]", "(Ofis)", "(Zoom)", "(Skype)", "(Meet)", "(Face to face)"
  const modalityPattern = '(?:online|yüzyüze|yüz yüze|yuzyuze|yuz yuze|ofis|klinik|zoom|skype|meet|google meet|facetime|face to face|whatsapp)';
  clean = clean.replace(new RegExp(`[\\s\\-\\(\\[\\{,#\\/]+${modalityPattern}[\\)\\}\\]]*$`, 'i'), '');
  clean = clean.replace(new RegExp(`^${modalityPattern}[\\s\\-\\:\\.\\)\\(\\[\\{]+`, 'i'), '');

  // 7. Remove clinical session descriptors / status in parentheses or at end
  // e.g. "(İlk Görüşme)", "(İlk Seans)", "(Değerlendirme)", "(Takip)", "(Bireysel)", "(Çift)", "(Aile)", "(Ergen)", "(Çocuk)", "(Süpervizyon)"
  const clinicalPattern = '(?:ilk görüşme|ilk gorusme|ilk seans|değerlendirme|degerlendirme|takip|bireysel|çift|cift|aile|ergen|çocuk|cocuk|süpervizyon|supervizyon|on görüşme|on gorusme|ön görüşme|yetkinlik)';
  clean = clean.replace(new RegExp(`[\\s\\-\\(\\[\\{,#\\/]+${clinicalPattern}[\\)\\}\\]]*$`, 'i'), '');
  clean = clean.replace(new RegExp(`^${clinicalPattern}[\\s\\-\\:\\.\\)\\(\\[\\{]+`, 'i'), '');

  // 8. Remove trailing session words with numbers e.g. " 1. seans", " (1. seans)", " - 1. oturum", " seans 1", " seansı 2", " no: 3"
  clean = clean.replace(/[\s\-\(\[\{,#/]+(?:seans|seansı|oturum|görüşme|gorusme|no|no:)?\s*\d+[\.\s]*(?:seans|seansı|oturum|görüşme|gorusme)?[\)\}\]]*$/i, '');
  
  // 9. Remove trailing sequence numbers like " 1 2 3", " 1,2,3", " 1-2-3", " 123", " 1", " - 2", " (1)"
  clean = clean.replace(/[\s\-\(\[\{,#/]+(?:\d+[\s,\.\-\/]*)+[\)\}\]]*$/i, '');

  // 10. Remove attached trailing numbers e.g. "Ahmet1", "Ahmet123" (when preceded by letters)
  clean = clean.replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ])\d+$/i, '$1');

  // 11. Normalize Turkish honorifics if at the very end
  // e.g. "Zeynep Hanım" -> "Zeynep", "Zeynep Öküm Hanım" -> "Zeynep Öküm"
  clean = clean.replace(/\b(?:hanım|bey|hn\.?|by\.?)\b/gi, '');

  // 12. Clean up any remaining trailing or leading punctuation/whitespace
  clean = clean.replace(/^[\s\-_:.,;()/[\]{}#~|•·]+|[\s\-_:.,;()/[\]{}#~|•·]+$/g, '');

  // 13. Ensure any leftover multiple spaces in between words are collapsed into a single space
  clean = clean.replace(/[\s\u00A0]+/g, ' ').trim();

  return clean || name.replace(/[\s\u00A0]+/g, ' ').trim();
}

/**
 * Helper to fold Turkish diacritics to ASCII for accent-insensitive comparison
 * (e.g. "Zeynep Öküm" vs "Zeynep Okum" typed without Turkish keyboard)
 */
export function toTurkishAscii(str: string): string {
  if (!str) return '';
  return str
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[\s\u00A0]+/g, ' ')
    .trim();
}

/**
 * Checks if two client names are strictly equivalent, taking into account:
 * - Accidental double/multiple spaces ("özlem tirün 2" vs "özlem  tirün    2")
 * - Session numbering prefixes/suffixes ("özlem tirün 1" vs "özlem tirün 2")
 * - Turkish case insensitivity ("İ" / "i", "I" / "ı")
 * - Turkish diacritics / ASCII tolerance ("Zeynep Öküm" vs "Zeynep Okum")
 * - Inverted name order with 2+ tokens ("Öküm Zeynep" vs "Zeynep Öküm")
 * 
 * CRITICAL RULE: A shorter or single-word name (e.g. "Zeynep") can NEVER match 
 * a multi-word or compound name (e.g. "Zeynep Öküm"). 
 * Substring, prefix, or word-subset matches are strictly prohibited!
 */
export function areClientNamesEquivalent(nameA?: string | null, nameB?: string | null): boolean {
  if (!nameA || !nameB) return false;
  
  // Collapse whitespace and trim
  const cleanA = nameA.replace(/[\s\u00A0]+/g, ' ').trim();
  const cleanB = nameB.replace(/[\s\u00A0]+/g, ' ').trim();
  
  if (!cleanA || !cleanB) return false;

  // 1. Direct match with whitespace collapsed (case insensitive in Turkish)
  if (cleanA.toLocaleLowerCase('tr-TR') === cleanB.toLocaleLowerCase('tr-TR')) {
    return true;
  }

  // 2. Normalized match (session numbers, prefixes, suffixes, extra spaces removed)
  const normA = getNormalizedClientName(cleanA);
  const normB = getNormalizedClientName(cleanB);
  
  if (!normA || !normB) return false;

  const lowerNormA = normA.toLocaleLowerCase('tr-TR');
  const lowerNormB = normB.toLocaleLowerCase('tr-TR');

  if (lowerNormA === lowerNormB) {
    return true;
  }

  // 3. Turkish ASCII diacritics match (e.g. "Zeynep Okum" vs "Zeynep Öküm")
  const asciiA = toTurkishAscii(normA);
  const asciiB = toTurkishAscii(normB);

  if (asciiA === asciiB) {
    return true;
  }

  // 4. Inverted name order token match (e.g. "Öküm, Zeynep" vs "Zeynep Öküm")
  // STRICT CONSTRAINT: Both names MUST have the EXACT SAME number of tokens (minimum 2 tokens)!
  // "Zeynep" (1 token) can NEVER match "Zeynep Öküm" (2 tokens)!
  const tokensA = asciiA.split(/[\s,]+/).filter(Boolean);
  const tokensB = asciiB.split(/[\s,]+/).filter(Boolean);

  if (tokensA.length >= 2 && tokensA.length === tokensB.length) {
    const sortedA = [...tokensA].sort();
    const sortedB = [...tokensB].sort();
    if (sortedA.every((t, idx) => t === sortedB[idx])) {
      return true;
    }
  }

  // Strict isolation: Under no circumstances do partial, prefix, or substring matching!
  return false;
}

/**
 * Finds a matching client custom pricing rule by checking:
 * 1. Exact key match
 * 2. Normalized client name match
 * 3. Case-insensitive lowercase match
 * 4. Strict token equivalence match (via areClientNamesEquivalent)
 */
export function findClientCustomRule(
  clientCustomPrices?: { [key: string]: ClientPricingRule },
  clientName?: string
): ClientPricingRule | undefined {
  if (!clientCustomPrices || !clientName) return undefined;

  // 1. Direct match with clientName
  if (clientCustomPrices[clientName]) return clientCustomPrices[clientName];

  // 2. Direct match with normalized clientName
  const norm = getNormalizedClientName(clientName);
  if (norm && clientCustomPrices[norm]) return clientCustomPrices[norm];

  const normLower = norm ? norm.toLocaleLowerCase('tr-TR') : '';
  const clientLower = clientName.toLocaleLowerCase('tr-TR');

  // 3. Case-insensitive match
  for (const [key, rule] of Object.entries(clientCustomPrices)) {
    const kLower = key.toLocaleLowerCase('tr-TR');
    if (kLower === normLower || kLower === clientLower) {
      return rule;
    }
  }

  // 4. Strict equivalence match (prevents "Zeynep" matching "Zeynep Öküm")
  for (const [key, rule] of Object.entries(clientCustomPrices)) {
    if (areClientNamesEquivalent(key, clientName)) {
      return rule;
    }
  }

  return undefined;
}

/**
 * Finds the latest valid (non-zero) session price for a given client (matching exact or variations like name 1, name-2).
 * Prioritizes sessions of the same normalized client name and SAME SESSION TYPE (online vs face-to-face)
 * that are before or on the given date with price > 0.
 * If none found before the date, looks across all sessions for that client.
 * If no previous price is found, returns the default price.
 */
export function getSmartClientPrice(
  clientName: string,
  sessionDate: string,
  sessions: Session[],
  defaultPrice: number,
  clientCustomPrices?: { [normalizedClientName: string]: ClientPricingRule },
  sessionType?: SessionType
): number {
  if (!clientName) return defaultPrice;

  // Highest priority: Explicit client custom price rule
  const customRule = findClientCustomRule(clientCustomPrices, clientName);
  if (customRule) {
    if (sessionType === 'online' && typeof customRule.onlinePrice === 'number' && customRule.onlinePrice > 0) {
      return customRule.onlinePrice;
    }
    if (sessionType === 'face-to-face' && typeof customRule.faceToFacePrice === 'number' && customRule.faceToFacePrice > 0) {
      return customRule.faceToFacePrice;
    }
    if (typeof customRule.price === 'number' && customRule.price > 0) {
      return customRule.price;
    }
  }

  if (!Array.isArray(sessions)) return defaultPrice;

  // Filter active sessions that match the client using areClientNamesEquivalent
  const validSessions = sessions.filter(s => {
    if (!s || s.type === 'cancelled' || s.type === 'non-session') return false;
    if (typeof s.price !== 'number' || s.price <= 0) return false;
    return areClientNamesEquivalent(s.clientName, clientName);
  });

  if (validSessions.length === 0) {
    return defaultPrice;
  }

  // 1. If sessionType is specified (e.g. 'online' or 'face-to-face'), first try matching sessions of the EXACT SAME type!
  if (sessionType === 'online' || sessionType === 'face-to-face') {
    const sameTypeSessions = validSessions.filter(s => s.type === sessionType);
    if (sameTypeSessions.length > 0) {
      const priorSameType = sameTypeSessions.filter(s => s.date <= sessionDate);
      if (priorSameType.length > 0) {
        priorSameType.sort((a, b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return b.time.localeCompare(a.time);
        });
        return priorSameType[0].price;
      }
      sameTypeSessions.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.time.localeCompare(a.time);
      });
      return sameTypeSessions[0].price;
    }
  }

  // 2. Fallback: Sessions before or on the given sessionDate across all types
  const priorSessions = validSessions.filter(s => s.date <= sessionDate);
  if (priorSessions.length > 0) {
    priorSessions.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.time.localeCompare(a.time);
    });
    return priorSessions[0].price;
  }

  // 3. Fallback: Any known non-zero price for this client (closest to sessionDate)
  validSessions.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.time.localeCompare(a.time);
  });
  return validSessions[0].price;
}

/**
 * Finds the latest session price, babysitter fee, and office rent fee for a given client.
 * Respects session type (online vs face-to-face).
 */
export function getSmartClientCosts(
  clientName: string,
  sessionDate: string,
  sessions: Session[],
  defaultPrice: number,
  defaultBabysitterFee: number,
  defaultOfficeRentFee: number,
  clientCustomPrices?: { [normalizedClientName: string]: ClientPricingRule },
  sessionType?: SessionType
): { price: number; babysitterFeeAmount: number; officeRentFeeAmount: number } {
  const result = {
    price: defaultPrice,
    babysitterFeeAmount: defaultBabysitterFee,
    officeRentFeeAmount: (sessionType === 'face-to-face' || !sessionType) ? defaultOfficeRentFee : 0
  };
  if (!clientName) return result;

  // Check if explicit custom pricing exists
  const customRule = findClientCustomRule(clientCustomPrices, clientName);
  if (customRule) {
    if (sessionType === 'online' && typeof customRule.onlinePrice === 'number' && customRule.onlinePrice > 0) {
      result.price = customRule.onlinePrice;
    } else if (sessionType === 'face-to-face' && typeof customRule.faceToFacePrice === 'number' && customRule.faceToFacePrice > 0) {
      result.price = customRule.faceToFacePrice;
    } else if (typeof customRule.price === 'number' && customRule.price > 0) {
      result.price = customRule.price;
    }

    if (typeof customRule.hasBabysitterFee === 'boolean') {
      result.babysitterFeeAmount = customRule.hasBabysitterFee ? (customRule.babysitterFeeAmount ?? defaultBabysitterFee) : 0;
    } else if (typeof customRule.babysitterFeeAmount === 'number' && customRule.babysitterFeeAmount > 0) {
      result.babysitterFeeAmount = customRule.babysitterFeeAmount;
    }

    if (typeof customRule.hasOfficeRentFee === 'boolean') {
      result.officeRentFeeAmount = customRule.hasOfficeRentFee ? (customRule.officeRentFeeAmount ?? defaultOfficeRentFee) : 0;
    } else if (typeof customRule.officeRentFeeAmount === 'number' && customRule.officeRentFeeAmount > 0) {
      result.officeRentFeeAmount = customRule.officeRentFeeAmount;
    }
  } else {
    // Calculate smart price using dedicated robust logic
    result.price = getSmartClientPrice(clientName, sessionDate, sessions, defaultPrice, clientCustomPrices, sessionType);
  }

  if (!Array.isArray(sessions)) return result;

  // Find all matched sessions for this client using areClientNamesEquivalent
  const matchedSessions = sessions.filter(s => {
    if (!s || s.type === 'cancelled' || s.type === 'non-session') return false;
    return areClientNamesEquivalent(s.clientName, clientName);
  });

  if (matchedSessions.length === 0) {
    return result;
  }

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
 * with a 0 TL price automatically inherits the client's established non-zero smart price according to session type!
 */
export function autoHealSmartClientPrices(
  sessionList: Session[],
  defaultPrice = 1200,
  defaultBabysitterFee = 250,
  defaultOfficeRentFee = 200,
  accountingStartDate?: string | null,
  defaultOnlinePrice?: number,
  defaultFaceToFacePrice?: number,
  clientCustomPrices?: { [normalizedClientName: string]: ClientPricingRule }
): Session[] {
  if (!Array.isArray(sessionList)) return [];

  // Cutoff date is the user's registration date or accounting start date (YYYY-MM-DD)
  const effectiveCutoff = accountingStartDate ? accountingStartDate.split('T')[0] : '';
  
  // SAFETY GUARD: If no cutoff date is known, do not auto-heal past sessions!
  // This completely prevents race conditions from inflating historical 0 TL sessions into full price.
  if (!effectiveCutoff) {
    return sessionList;
  }

  // Group latest known valid prices per normalized client name AND session type
  const clientTypeEstablishedPrices = new Map<string, number>();
  const clientGeneralEstablishedPrices = new Map<string, number>();

  // Pass 1: Find all clients with a known non-zero price in active sessions (latest date/updatedAt first)
  const sortedForPrices = [...sessionList].sort((a, b) => {
    if ((b.updatedAt || 0) !== (a.updatedAt || 0)) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    }
    return (b.date || '').localeCompare(a.date || '');
  });

  sortedForPrices.forEach(s => {
    if (!s || s.type === 'cancelled' || s.type === 'non-session') return;
    const isWithinAccounting = !effectiveCutoff || (s.date && s.date >= effectiveCutoff);
    if (typeof s.price === 'number' && s.price > 0 && isWithinAccounting) {
      const normName = getNormalizedClientName(s.clientName);
      if (normName) {
        const asciiKey = toTurkishAscii(normName).toLowerCase();
        const typeKey = `${asciiKey}_${s.type}`;
        if (!clientTypeEstablishedPrices.has(typeKey)) {
          clientTypeEstablishedPrices.set(typeKey, s.price);
        }
        if (!clientGeneralEstablishedPrices.has(asciiKey)) {
          clientGeneralEstablishedPrices.set(asciiKey, s.price);
        }
      }
    }
  });

  // Pass 2: If a session in active accounting period has price === 0, heal it taking session type into account!
  return sessionList.map(s => {
    if (!s) return s;
    const isWithinAccounting = !effectiveCutoff || (s.date && s.date >= effectiveCutoff);
    if (isWithinAccounting && s.type !== 'cancelled' && s.type !== 'non-session') {
      if (s.price === 0 || !s.price) {
        const normName = getNormalizedClientName(s.clientName);
        const asciiKey = normName ? toTurkishAscii(normName).toLowerCase() : '';
        const typeKey = `${asciiKey}_${s.type}`;
        const typeDefault = s.type === 'online' 
          ? (defaultOnlinePrice || defaultPrice) 
          : (s.type === 'face-to-face' ? (defaultFaceToFacePrice || defaultPrice) : defaultPrice);

        const customRule = findClientCustomRule(clientCustomPrices, s.clientName);
        const customRulePrice = customRule ? (
          (s.type === 'online' && typeof customRule.onlinePrice === 'number' && customRule.onlinePrice > 0 ? customRule.onlinePrice : undefined) ||
          (s.type === 'face-to-face' && typeof customRule.faceToFacePrice === 'number' && customRule.faceToFacePrice > 0 ? customRule.faceToFacePrice : undefined) ||
          (typeof customRule.price === 'number' && customRule.price > 0 ? customRule.price : undefined)
        ) : undefined;

        const establishedPrice = customRulePrice
          || clientTypeEstablishedPrices.get(typeKey) 
          || clientGeneralEstablishedPrices.get(asciiKey) 
          || getSmartClientPrice(s.clientName, s.date, sessionList, typeDefault, clientCustomPrices, s.type);

        if (establishedPrice && establishedPrice > 0) {
          const smartCosts = getSmartClientCosts(s.clientName, s.date, sessionList, establishedPrice, defaultBabysitterFee, defaultOfficeRentFee, clientCustomPrices, s.type);
          return {
            ...s,
            price: establishedPrice,
            babysitterFeeAmount: s.hasBabysitterFee ? (s.babysitterFeeAmount || smartCosts.babysitterFeeAmount) : 0,
            officeRentFeeAmount: s.hasOfficeRentFee ? (s.officeRentFeeAmount || smartCosts.officeRentFeeAmount) : 0,
            isManuallyEdited: true,
            updatedAt: Date.now()
          };
        }
      }
    }
    return s;
  });
}

/**
 * Bulk applies a client pricing and accounting rule to all historical and future sessions of a specific client!
 */
export function bulkApplyClientRule(
  sessions: Session[],
  clientName: string,
  rule: {
    price?: number;
    onlinePrice?: number;
    faceToFacePrice?: number;
    hasBabysitterFee?: boolean;
    babysitterFeeAmount?: number;
    hasOfficeRentFee?: boolean;
    officeRentFeeAmount?: number;
    paymentStatus?: 'paid' | 'unpaid' | 'partial';
  },
  onlyUnpaidOrAll: 'all' | 'unpaid-only' = 'all'
): Session[] {
  if (!Array.isArray(sessions) || !clientName) return sessions;

  return sessions.map(s => {
    if (!s || s.type === 'cancelled' || s.type === 'non-session') return s;
    if (!areClientNamesEquivalent(s.clientName, clientName)) return s;

    if (onlyUnpaidOrAll === 'unpaid-only' && s.paymentStatus === 'paid') {
      return s;
    }

    const updated: Session = { ...s };
    let changed = false;

    // Type-specific pricing priority:
    if (s.type === 'online' && typeof rule.onlinePrice === 'number' && rule.onlinePrice >= 0) {
      updated.price = rule.onlinePrice;
      changed = true;
    } else if (s.type === 'face-to-face' && typeof rule.faceToFacePrice === 'number' && rule.faceToFacePrice >= 0) {
      updated.price = rule.faceToFacePrice;
      changed = true;
    } else if (typeof rule.price === 'number' && rule.price >= 0) {
      updated.price = rule.price;
      changed = true;
    }

    if (typeof rule.hasBabysitterFee === 'boolean') {
      updated.hasBabysitterFee = rule.hasBabysitterFee;
      if (typeof rule.babysitterFeeAmount === 'number') {
        updated.babysitterFeeAmount = rule.hasBabysitterFee ? rule.babysitterFeeAmount : 0;
      }
      changed = true;
    }
    if (typeof rule.hasOfficeRentFee === 'boolean') {
      updated.hasOfficeRentFee = rule.hasOfficeRentFee;
      if (typeof rule.officeRentFeeAmount === 'number') {
        updated.officeRentFeeAmount = rule.hasOfficeRentFee ? rule.officeRentFeeAmount : 0;
      }
      changed = true;
    }
    if (rule.paymentStatus) {
      updated.paymentStatus = rule.paymentStatus;
      if (rule.paymentStatus === 'paid') {
        updated.paidAmount = updated.price;
      }
      changed = true;
    }

    if (changed) {
      updated.isManuallyEdited = true;
      updated.updatedAt = Date.now();
      return updated;
    }
    return s;
  });
}

