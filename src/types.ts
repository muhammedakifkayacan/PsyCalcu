export type SessionType = 'online' | 'face-to-face' | 'cancelled';

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
  syncedCalendarType?: 'online' | 'face-to-face'; // which calendar it came from
  paymentStatus?: 'paid' | 'unpaid';
  updatedAt?: number; // timestamp in ms for conflict-free sync
  isManuallyEdited?: boolean; // track if user manually adjusted price/duration/costs
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
    added: { id: string; clientName: string; date: string; time: string; type: 'online' | 'face-to-face' | 'cancelled' }[];
    updated: { id: string; clientName: string; date: string; time: string; type: 'online' | 'face-to-face' | 'cancelled' }[];
    deleted?: { id: string; clientName: string; date: string; time: string; type: 'online' | 'face-to-face' | 'cancelled' }[];
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

