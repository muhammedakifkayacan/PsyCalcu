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
