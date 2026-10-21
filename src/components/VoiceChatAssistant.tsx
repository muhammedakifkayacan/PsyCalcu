import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Send,
  X,
  Sparkles,
  Volume2,
  VolumeX,
  CheckCircle2,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import {
  Session,
  AppSettings,
  Expense,
  PaymentMethod,
  SessionType,
  areClientNamesEquivalent
} from '../types';

export interface AssistantAction {
  actionType:
    | 'UPDATE_SESSIONS'
    | 'CREATE_SESSION'
    | 'DELETE_SESSION'
    | 'MARK_CLIENT_ALL_PAID'
    | 'ADD_EXPENSE'
    | 'NAVIGATE_TAB'
    | 'OPEN_CLIENT_PROFILE';
  sessionIds?: string[];
  clientName?: string;
  targetDate?: string;
  targetMonth?: string;
  applyToScope?: 'single' | 'date' | 'visible_period' | 'all_unpaid' | 'all';
  updates?: {
    price?: number;
    paymentStatus?: 'paid' | 'unpaid' | 'partial';
    paidAmount?: number;
    paymentMethod?: PaymentMethod;
    type?: SessionType;
    hasBabysitterFee?: boolean;
    babysitterFeeAmount?: number;
    hasOfficeRentFee?: boolean;
    officeRentFeeAmount?: number;
    notes?: string;
    date?: string;
    time?: string;
  };
  newSession?: {
    clientName: string;
    date: string;
    time: string;
    type: SessionType;
    price?: number;
    paymentStatus?: 'paid' | 'unpaid';
    paymentMethod?: PaymentMethod;
    hasBabysitterFee?: boolean;
    babysitterFeeAmount?: number;
    hasOfficeRentFee?: boolean;
    officeRentFeeAmount?: number;
    notes?: string;
  };
  newExpense?: {
    title: string;
    amount: number;
    category?: string;
    date?: string;
  };
  tab?: string;
  viewMode?: 'day' | 'week' | 'month';
  date?: string;
}

interface AppliedChangeRecord {
  id: string;
  description: string;
  details: string[];
  previousSessionsSnapshot: Session[];
  undone?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  appliedChanges?: AppliedChangeRecord;
}

interface VoiceChatAssistantProps {
  activeTab: string;
  agendaViewMode: 'day' | 'week' | 'month';
  selectedDate: string;
  calendarViewDate: Date;
  selectedClientName: string | null;
  sessions: Session[];
  settings: AppSettings;
  onUpdateSessionsBulk: (updater: (prev: Session[]) => Session[], summaryToast?: string) => void;
  onSaveSession: (session: Session) => void;
  onMarkClientAllPaid: (clientName: string, method?: PaymentMethod) => void;
  onAddExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  onNavigateTab: (tab: any, viewMode?: 'day' | 'week' | 'month', date?: string) => void;
  onOpenClientProfile: (clientName: string) => void;
  featuresAIAllowed?: boolean;
}

const TAB_LABELS: Record<string, string> = {
  agenda: 'Ajanda',
  stats: 'İstatistik & Muhasebe',
  debts: 'Borç Takibi',
  clients: 'Danışan Rehberi',
  client: 'Danışan Profili',
  audit: 'Ay Kapatma & Denetim',
  search: 'Gelişmiş Arama',
  sync: 'Takvim Eşitleme',
  backup: 'Yedekleme',
  rooms: 'Oda Yönetimi',
  admin: 'Yönetici Paneli'
};

const TURKISH_MONTHS: Record<string, string> = {
  ocak: '01',
  subat: '02',
  mart: '03',
  nisan: '04',
  mayis: '05',
  haziran: '06',
  temmuz: '07',
  agustos: '08',
  eylul: '09',
  ekim: '10',
  kasim: '11',
  aralik: '12'
};

const TURKISH_MONTH_DISPLAY: Record<string, string> = {
  '01': 'Ocak',
  '02': 'Şubat',
  '03': 'Mart',
  '04': 'Nisan',
  '05': 'Mayıs',
  '06': 'Haziran',
  '07': 'Temmuz',
  '08': 'Ağustos',
  '09': 'Eylül',
  '10': 'Ekim',
  '11': 'Kasım',
  '12': 'Aralık'
};

function formatLocalDateIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function foldTurkishAscii(str: string): string {
  if (!str) return '';
  return str
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/['’`.,;!?()-]/g, ' ')
    .replace(/[\s\u00A0]+/g, ' ')
    .trim();
}

/**
 * Converts spoken Turkish numbers (both prices 200-5000 and day numbers 1-31 before month names) into digits.
 */
function normalizeSpokenTurkishNumbers(asciiText: string): string {
  let s = asciiText;

  // 1. Convert spoken day numbers (1..31) when followed by a Turkish month name
  const monthNamesPattern =
    '(?:ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)';
  const dayWordPairs: Array<[string, string]> = [
    ['otuz bir', '31'],
    ['otuz', '30'],
    ['yirmi dokuz', '29'],
    ['yirmi sekiz', '28'],
    ['yirmi yedi', '27'],
    ['yirmi alti', '26'],
    ['yirmi bes', '25'],
    ['yirmi dort', '24'],
    ['yirmi uc', '23'],
    ['yirmi iki', '22'],
    ['yirmi bir', '21'],
    ['yirmi', '20'],
    ['on dokuz', '19'],
    ['on sekiz', '18'],
    ['on yedi', '17'],
    ['on alti', '16'],
    ['on bes', '15'],
    ['on dort', '14'],
    ['on uc', '13'],
    ['on iki', '12'],
    ['on bir', '11'],
    ['on', '10'],
    ['dokuz', '9'],
    ['sekiz', '8'],
    ['yedi', '7'],
    ['alti', '6'],
    ['bes', '5'],
    ['dort', '4'],
    ['uc', '3'],
    ['iki', '2'],
    ['bir', '1']
  ];

  for (const [word, digit] of dayWordPairs) {
    const reg = new RegExp(`\\b${word}\\s+(?=${monthNamesPattern}\\b)`, 'gi');
    s = s.replace(reg, `${digit} `);
  }

  // 2. Convert spoken hundreds/thousands for prices
  const priceReplacements: Array<[RegExp, string]> = [
    [/\biki bin bes yuz\b/g, '2500'],
    [/\biki bin iki yuz elli\b/g, '2250'],
    [/\biki bin iki yuz\b/g, '2200'],
    [/\biki bin\b/g, '2000'],
    [/\buc bin bes yuz\b/g, '3500'],
    [/\buc bin\b/g, '3000'],
    [/\bdort bin\b/g, '4000'],
    [/\bbes bin\b/g, '5000'],
    [/\bbin dokuz yuz\b/g, '1900'],
    [/\bbin sekiz yuz\b/g, '1800'],
    [/\bbin yedi yuz elli\b/g, '1750'],
    [/\bbin yedi yuz\b/g, '1700'],
    [/\bbin alti yuz\b/g, '1600'],
    [/\bbin bes yuz\b/g, '1500'],
    [/\bbin dort yuz\b/g, '1400'],
    [/\bbin uc yuz\b/g, '1300'],
    [/\bbin iki yuz elli\b/g, '1250'],
    [/\bbin iki yuz\b/g, '1200'],
    [/\bbin yuz\b/g, '1100'],
    [/\bbin\b/g, '1000'],
    [/\bdokuz yuz\b/g, '900'],
    [/\bsekiz yuz\b/g, '800'],
    [/\byedi yuz elli\b/g, '750'],
    [/\byedi yuz\b/g, '700'],
    [/\balti yuz\b/g, '600'],
    [/\bbes yuz\b/g, '500'],
    [/\bdort yuz\b/g, '400'],
    [/\buc yuz elli\b/g, '350'],
    [/\buc yuz\b/g, '300'],
    [/\biki yuz elli\b/g, '250'],
    [/\biki yuz\b/g, '200']
  ];
  for (const [regex, val] of priceReplacements) {
    s = s.replace(regex, val);
  }
  return s;
}

/**
 * Extracts explicit targetDate (YYYY-MM-DD), targetMonth (YYYY-MM), and resolvedYear from a Turkish command.
 * Rule:
 * - If no year is mentioned by the user (e.g., just "7 Ekim" or "Ekim'de"), ALWAYS use the current year (new Date().getFullYear()).
 * - If an older or specific year is mentioned (e.g., "7 Ekim 2024", "2025 Mayıs", "geçen yıl"), use that year.
 */
function parseTurkishDateFromCommand(asciiMsg: string): {
  targetDate?: string;
  targetMonth?: string;
  explicitYear?: number;
  cleanedMsgWithoutDate: string;
} {
  const currentYear = new Date().getFullYear();
  let explicitYear: number | undefined = undefined;
  let cleaned = asciiMsg;

  // Check for "gecen yil" / "gecen sene"
  if (/\bgecen\s+(?:yil|sene)\b/i.test(cleaned)) {
    explicitYear = currentYear - 1;
    cleaned = cleaned.replace(/\bgecen\s+(?:yil|sene)\b/gi, ' ');
  } else if (/\bbu\s+(?:yil|sene)\b/i.test(cleaned)) {
    explicitYear = currentYear;
    cleaned = cleaned.replace(/\bbu\s+(?:yil|sene)\b/gi, ' ');
  }

  // Check for 4-digit year (e.g. 2020..2030) attached to a month, or followed by yil/sene, or non-price year
  const monthKeys = Object.keys(TURKISH_MONTHS).join('|');
  const yearNearMonthRegex = new RegExp(
    `\\b(201\\d|202\\d|203\\d)\\s*(?:yili|yilinda|senesi|senesinde)?\\s*(?=\\b(?:${monthKeys}|\\d{1,2}\\s+(?:${monthKeys})))|\\b(?:${monthKeys})(?:ta|te|da|de|daki|deki)?\\s+(?:ayi\\s+|ayinda\\s+)?(201\\d|202\\d|203\\d)\\b|\\b(201\\d|202\\d|203\\d)\\s+(?:yili|yilinda|senesi|senesinde)\\b`,
    'i'
  );
  const ymMatch = cleaned.match(yearNearMonthRegex);
  if (ymMatch) {
    const yrStr = ymMatch[1] || ymMatch[2] || ymMatch[3];
    if (yrStr) {
      explicitYear = parseInt(yrStr, 10);
    }
  } else {
    // Also check if a year like 2021, 2022, 2023, 2024, 2025, 2026 appears and is NOT preceded by fiyat/ücret or followed by tl/lira
    const genericYearRegex = /\b(201[5-9]|202[0-9])\b/g;
    let m: RegExpExecArray | null;
    while ((m = genericYearRegex.exec(cleaned)) !== null) {
      const val = parseInt(m[1], 10);
      // 2020 and 2025 are divisible by 5, but 2000/2500 are prices; 2015..2029 are years unless preceded by fiyat/ucret
      const before = cleaned.slice(Math.max(0, m.index - 20), m.index);
      const after = cleaned.slice(m.index + m[0].length, m.index + m[0].length + 15);
      const looksLikePrice =
        /(?:fiyat|fiyati|ucret|ucreti|tutar|tutari)\s*$/i.test(before.trim()) ||
        /^\s*(?:tl|lira|₺|turk lirasi)/i.test(after);
      if (!looksLikePrice && val !== 2000) {
        explicitYear = val;
        break;
      }
    }
  }

  const resolvedYear = explicitYear || currentYear;

  // Relative dates: bugün, dün, yarın
  if (/\bbugun(?:ku|de|deki)?\b/i.test(cleaned)) {
    const iso = formatLocalDateIso(new Date());
    cleaned = cleaned.replace(/\bbugun(?:ku|de|deki)?\b/gi, ' ');
    return {
      targetDate: iso,
      targetMonth: iso.slice(0, 7),
      explicitYear,
      cleanedMsgWithoutDate: cleaned
    };
  }
  if (/\bdun(?:ku|de|deki)?\b/i.test(cleaned)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const iso = formatLocalDateIso(d);
    cleaned = cleaned.replace(/\bdun(?:ku|de|deki)?\b/gi, ' ');
    return {
      targetDate: iso,
      targetMonth: iso.slice(0, 7),
      explicitYear,
      cleanedMsgWithoutDate: cleaned
    };
  }
  if (/\byarin(?:ki|da|daki)?\b/i.test(cleaned)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const iso = formatLocalDateIso(d);
    cleaned = cleaned.replace(/\byarin(?:ki|da|daki)?\b/gi, ' ');
    return {
      targetDate: iso,
      targetMonth: iso.slice(0, 7),
      explicitYear,
      cleanedMsgWithoutDate: cleaned
    };
  }

  // Day + Month name: e.g. "7 ekim", "7 ekimde", "7 ekim 2025", "ekimin 7 si", "ekim 7"
  for (const [mName, mNum] of Object.entries(TURKISH_MONTHS)) {
    // Pattern A: <day> <month> [year]
    const dayFirstRegex = new RegExp(
      `\\b(\\d{1,2})\\s*${mName}(?:ta|te|da|de|daki|deki|tan|ten|dan|den)?(?:\\s+gunu|\\s+tarihli|\\s+tarihinde)?(?:\\s+(201\\d|202\\d|203\\d))?\\b`,
      'i'
    );
    const mA = cleaned.match(dayFirstRegex);
    if (mA) {
      const dayNum = parseInt(mA[1], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        const yr = mA[2] ? parseInt(mA[2], 10) : resolvedYear;
        const dayStr = String(dayNum).padStart(2, '0');
        const targetDate = `${yr}-${mNum}-${dayStr}`;
        cleaned = cleaned.replace(dayFirstRegex, ' ');
        return {
          targetDate,
          targetMonth: `${yr}-${mNum}`,
          explicitYear: mA[2] ? yr : explicitYear,
          cleanedMsgWithoutDate: cleaned
        };
      }
    }

    // Pattern B: <month>[in/un] <day>[si/i] (e.g. "ekimin 7 si", "ekim 7")
    const monthFirstDayRegex = new RegExp(
      `\\b${mName}(?:in|un|nin|nun)?\\s+(\\d{1,2})(?:\\s*(?:si|i|u|su|sinde|inde|unda|sinda))?\\b`,
      'i'
    );
    const mB = cleaned.match(monthFirstDayRegex);
    if (mB) {
      const dayNum = parseInt(mB[1], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        const dayStr = String(dayNum).padStart(2, '0');
        const targetDate = `${resolvedYear}-${mNum}-${dayStr}`;
        cleaned = cleaned.replace(monthFirstDayRegex, ' ');
        return {
          targetDate,
          targetMonth: `${resolvedYear}-${mNum}`,
          explicitYear,
          cleanedMsgWithoutDate: cleaned
        };
      }
    }
  }

  // Month-only reference: e.g. "ekimde", "ekim'de", "ekim ayinda", "ekimdeki", "ekim 2025", or "ekim"
  for (const [mName, mNum] of Object.entries(TURKISH_MONTHS)) {
    const monthOnlyRegex = new RegExp(
      `\\b${mName}(?:ta|te|da|de|daki|deki|tan|ten|dan|den)?(?:\\s+ayi|\\s+ayinda|\\s+ayindaki|\\s+icinde)?(?:\\s+(201\\d|202\\d|203\\d))?\\b`,
      'i'
    );
    const mM = cleaned.match(monthOnlyRegex);
    if (mM) {
      const yr = mM[1] ? parseInt(mM[1], 10) : resolvedYear;
      cleaned = cleaned.replace(monthOnlyRegex, ' ');
      return {
        targetDate: undefined,
        targetMonth: `${yr}-${mNum}`,
        explicitYear: mM[1] ? yr : explicitYear,
        cleanedMsgWithoutDate: cleaned
      };
    }
  }

  return {
    targetDate: undefined,
    targetMonth: undefined,
    explicitYear,
    cleanedMsgWithoutDate: cleaned
  };
}

const COMMAND_STOP_WORDS = new Set([
  'seans',
  'seansi',
  'tamamlandi',
  'yapildi',
  'odendi',
  'oden',
  'odemesi',
  'parasi',
  'alindi',
  'fiyati',
  'fiyat',
  'ucreti',
  'ucret',
  'bakici',
  'ofis',
  'kirasi',
  'kira',
  'var',
  'yok',
  'bugun',
  'dun',
  'yarin',
  'online',
  'onlayn',
  'yuzyuze',
  'yuz',
  'yuze',
  'iptal',
  'nakit',
  'kart',
  'havale',
  'eft',
  'bu',
  'ay',
  'ayi',
  'ayinda',
  'gun',
  'gunu',
  'icin',
  'ekle',
  'tl',
  'lira',
  'ocak',
  'subat',
  'mart',
  'nisan',
  'mayis',
  'haziran',
  'temmuz',
  'agustos',
  'eylul',
  'ekim',
  'kasim',
  'aralik'
]);

/**
 * Finds the best matching client name ONLY within the provided session pool.
 */
function findBestClientMatchInPool(asciiMsgWithoutDate: string, pool: Session[]): string {
  const uniqueClients = new Map<string, string>(); // asciiName -> original display name
  for (const s of pool) {
    if (s && s.clientName && !s.isDeleted) {
      const cleanName = String(s.clientName).trim();
      const asciiName = foldTurkishAscii(cleanName);
      if (asciiName && !uniqueClients.has(asciiName)) {
        uniqueClients.set(asciiName, cleanName);
      }
    }
  }

  let matchedClientName = '';
  let bestMatchScore = 0;

  for (const [asciiClient, originalClient] of uniqueClients.entries()) {
    if (asciiClient.length >= 3 && asciiMsgWithoutDate.includes(asciiClient)) {
      const score = asciiClient.length + 100;
      if (score > bestMatchScore) {
        bestMatchScore = score;
        matchedClientName = originalClient;
      }
    } else {
      const tokens = asciiClient
        .split(' ')
        .filter(t => t.length >= 2 && !COMMAND_STOP_WORDS.has(t));
      if (tokens.length >= 2 && tokens.every(t => asciiMsgWithoutDate.includes(t))) {
        const score = asciiClient.length + 50;
        if (score > bestMatchScore) {
          bestMatchScore = score;
          matchedClientName = originalClient;
        }
      } else if (tokens.length >= 1) {
        for (const token of tokens) {
          if (token.length < 3) continue;
          // Match token with optional Turkish possessive/dative/locative suffix
          const wordRegex = new RegExp(`\\b${token}[a-z]{0,4}\\b`, 'i');
          if (wordRegex.test(asciiMsgWithoutDate)) {
            const score = token.length + 15;
            if (score > bestMatchScore) {
              bestMatchScore = score;
              matchedClientName = originalClient;
            }
          }
        }
      }
    }
  }

  return matchedClientName;
}

/**
 * Smart Client-Side Turkish Command & Q&A Processor.
 * Strictly respects spoken dates (e.g. "7 Ekim") and spoken months (e.g. "Ekim'de"),
 * defaulting to the current year when no year is mentioned.
 */
function processClientCommandLocally(
  message: string,
  pageContext: any,
  pageSessions: Session[],
  allSessions: Session[]
): { reply: string; actions: AssistantAction[] } {
  const rawMsg = (message || '').trim();
  const asciiRaw = foldTurkishAscii(rawMsg);
  const asciiMsg = normalizeSpokenTurkishNumbers(asciiRaw);

  const defaultPrice = Number(pageContext?.defaultSessionPrice) || 1200;
  const defaultBabysitterFee = Number(pageContext?.defaultBabysitterFee) || 250;
  const defaultOfficeRentFee = Number(pageContext?.defaultOfficeRentFee) || 200;
  const selectedDate: string = pageContext?.selectedDate || formatLocalDateIso();
  const visibleMonth: string = pageContext?.visibleMonth || selectedDate.slice(0, 7);

  // 1. Check for page navigation commands
  if (
    (asciiMsg.includes('sayfasina git') ||
      asciiMsg.includes('ekranini ac') ||
      asciiMsg.includes('ekranina gec') ||
      asciiMsg.includes('gorunumune gec')) &&
    !asciiMsg.includes('odendi') &&
    !asciiMsg.includes('fiyat')
  ) {
    if (asciiMsg.includes('borc')) {
      return {
        reply: 'Borç Takibi sayfasına yönlendiriliyorsunuz.',
        actions: [{ actionType: 'NAVIGATE_TAB', tab: 'debts' }]
      };
    }
    if (asciiMsg.includes('istatistik') || asciiMsg.includes('muhasebe')) {
      return {
        reply: 'İstatistik ve Muhasebe sayfasına yönlendiriliyorsunuz.',
        actions: [{ actionType: 'NAVIGATE_TAB', tab: 'stats' }]
      };
    }
    if (asciiMsg.includes('aylik')) {
      return {
        reply: 'Aylık ajanda görünümüne geçiliyor.',
        actions: [{ actionType: 'NAVIGATE_TAB', tab: 'agenda', viewMode: 'month' }]
      };
    }
    if (asciiMsg.includes('haftalik')) {
      return {
        reply: 'Haftalık ajanda görünümüne geçiliyor.',
        actions: [{ actionType: 'NAVIGATE_TAB', tab: 'agenda', viewMode: 'week' }]
      };
    }
    if (asciiMsg.includes('gunluk') || asciiMsg.includes('ajanda')) {
      return {
        reply: 'Günlük ajanda görünümüne geçiliyor.',
        actions: [{ actionType: 'NAVIGATE_TAB', tab: 'agenda', viewMode: 'day' }]
      };
    }
  }

  // 2. Check if user is asking for a summary / question about current page
  const hasActionKeywords =
    asciiMsg.includes('odendi') ||
    asciiMsg.includes('odemesi') ||
    asciiMsg.includes('parasi') ||
    asciiMsg.includes('oden parasi') ||
    asciiMsg.includes('fiyat') ||
    asciiMsg.includes('ucret') ||
    asciiMsg.includes('tamamlandi') ||
    asciiMsg.includes('iptal') ||
    asciiMsg.includes('bakici') ||
    asciiMsg.includes('ofis kirasi') ||
    asciiMsg.includes('kira ') ||
    asciiMsg.includes('ekle');

  if (
    !hasActionKeywords &&
    (asciiMsg.includes('kac seans') ||
      asciiMsg.includes('toplam gelir') ||
      asciiMsg.includes('ozet') ||
      asciiMsg.includes('durum ne') ||
      asciiMsg.includes('ne kadar') ||
      asciiMsg.includes('borc'))
  ) {
    const activeList = (pageSessions || []).filter(
      s => !s.isDeleted && s.type !== 'cancelled' && s.type !== 'non-session'
    );
    const paidList = activeList.filter(s => s.paymentStatus === 'paid');
    const unpaidList = activeList.filter(s => s.paymentStatus !== 'paid');
    const gross = activeList.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
    const unpaidTotal = unpaidList.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
    const babysitterTotal = activeList.reduce(
      (acc, s) =>
        acc + (s.hasBabysitterFee ? Number(s.babysitterFeeAmount) || defaultBabysitterFee : 0),
      0
    );
    const officeRentTotal = activeList.reduce(
      (acc, s) =>
        acc + (s.hasOfficeRentFee ? Number(s.officeRentFeeAmount) || defaultOfficeRentFee : 0),
      0
    );
    const net = gross - babysitterTotal - officeRentTotal;

    return {
      reply: `Bu görünümde (**${pageContext?.activeTabLabel || 'Mevcut Sayfa'}**) toplam **${activeList.length} aktif seans** bulunuyor (${paidList.length} ödendi, ${unpaidList.length} bekliyor).\n\n• **Brüt Gelir:** ₺${gross.toLocaleString('tr-TR')}\n• **Bekleyen Tahsilat:** ₺${unpaidTotal.toLocaleString('tr-TR')}\n• **Bakıcı & Ofis Kesintisi:** ₺${(babysitterTotal + officeRentTotal).toLocaleString('tr-TR')}\n• **Net Kâr:** ₺${net.toLocaleString('tr-TR')}`,
      actions: []
    };
  }

  // 3. Parse explicit date (e.g. "7 Ekim") or explicit month (e.g. "Ekim'de") FIRST!
  const { targetDate, targetMonth, cleanedMsgWithoutDate } = parseTurkishDateFromCommand(asciiMsg);

  const allActiveSessions = (allSessions || []).filter(s => !s.isDeleted);

  // 4. Parse updates from Turkish command
  const updates: NonNullable<AssistantAction['updates']> = {};

  if (asciiMsg.includes('iptal') || asciiMsg.includes('gelmedi') || asciiMsg.includes('katilmadi')) {
    updates.type = 'cancelled';
    updates.price = 0;
    updates.hasBabysitterFee = false;
    updates.babysitterFeeAmount = 0;
    updates.hasOfficeRentFee = false;
    updates.officeRentFeeAmount = 0;
  } else if (
    asciiMsg.includes('yuz yuze') ||
    asciiMsg.includes('yuzyuze') ||
    asciiMsg.includes('ofiste')
  ) {
    updates.type = 'face-to-face';
  } else if (
    asciiMsg.includes('online') ||
    asciiMsg.includes('onlayn') ||
    asciiMsg.includes('goruntulu')
  ) {
    updates.type = 'online';
    updates.hasOfficeRentFee = false;
    updates.officeRentFeeAmount = 0;
  }

  if (
    asciiMsg.includes('odenmedi') ||
    asciiMsg.includes('odemedi') ||
    asciiMsg.includes('alinmadi') ||
    asciiMsg.includes('borc olarak') ||
    asciiMsg.includes('odeme yok')
  ) {
    updates.paymentStatus = 'unpaid';
    updates.paidAmount = 0;
  } else if (
    asciiMsg.includes('odendi') ||
    asciiMsg.includes('odemesi alindi') ||
    asciiMsg.includes('oden parasi alindi') ||
    asciiMsg.includes('odeme parasi alindi') ||
    asciiMsg.includes('parasi alindi') ||
    asciiMsg.includes('parasini verdi') ||
    asciiMsg.includes('parasini aldim') ||
    asciiMsg.includes('ucreti alindi') ||
    asciiMsg.includes('ucret alindi') ||
    asciiMsg.includes('odeme alindi') ||
    asciiMsg.includes('tahsil edildi') ||
    asciiMsg.includes('odedi')
  ) {
    updates.paymentStatus = 'paid';
  }

  if (asciiMsg.includes('nakit') || asciiMsg.includes('elden')) {
    updates.paymentMethod = 'cash';
    if (!updates.paymentStatus) updates.paymentStatus = 'paid';
  } else if (
    asciiMsg.includes('kredi kart') ||
    asciiMsg.includes('kartla') ||
    asciiMsg.includes('pos')
  ) {
    updates.paymentMethod = 'card';
    if (!updates.paymentStatus) updates.paymentStatus = 'paid';
  } else if (
    asciiMsg.includes('havale') ||
    asciiMsg.includes('eft') ||
    asciiMsg.includes('iban') ||
    asciiMsg.includes('banka')
  ) {
    updates.paymentMethod = 'transfer';
    if (!updates.paymentStatus) updates.paymentStatus = 'paid';
  }

  if (
    asciiMsg.includes('bakici parasi yok') ||
    asciiMsg.includes('bakici yok') ||
    asciiMsg.includes('bakici ucreti yok') ||
    asciiMsg.includes('bakicisiz') ||
    asciiMsg.includes('bakici olmasin') ||
    asciiMsg.includes('bakici sil')
  ) {
    updates.hasBabysitterFee = false;
    updates.babysitterFeeAmount = 0;
  } else if (
    asciiMsg.includes('bakici parasi var') ||
    asciiMsg.includes('bakici var') ||
    asciiMsg.includes('bakici ucreti var') ||
    asciiMsg.includes('bakici eklensin') ||
    asciiMsg.includes('bakici parasi olsun') ||
    /bakici(?:\s+parasi|\s+ucreti)?\s+\d{2,5}/.test(asciiMsg)
  ) {
    updates.hasBabysitterFee = true;
    const babyNumMatch = asciiMsg.match(/bakici(?:\s+parasi|\s+ucreti)?\s*(?:var\s*)?(\d{2,5})/);
    updates.babysitterFeeAmount = babyNumMatch
      ? parseInt(babyNumMatch[1], 10)
      : defaultBabysitterFee;
  }

  if (
    asciiMsg.includes('ofis kirasi yok') ||
    asciiMsg.includes('oda kirasi yok') ||
    asciiMsg.includes('kira yok') ||
    asciiMsg.includes('ofis ucreti yok') ||
    asciiMsg.includes('ofis yok') ||
    asciiMsg.includes('kirasiz') ||
    asciiMsg.includes('kira olmasin')
  ) {
    updates.hasOfficeRentFee = false;
    updates.officeRentFeeAmount = 0;
  } else if (
    asciiMsg.includes('ofis kirasi var') ||
    asciiMsg.includes('oda kirasi var') ||
    asciiMsg.includes('kira var') ||
    asciiMsg.includes('ofis ucreti var') ||
    asciiMsg.includes('ofis var') ||
    /(?:ofis|oda)\s*(?:kirasi|ucreti)\s+\d{2,5}/.test(asciiMsg)
  ) {
    updates.hasOfficeRentFee = true;
    const rentNumMatch = asciiMsg.match(
      /(?:ofis|oda)\s*(?:kirasi|ucreti)?\s*(?:var\s*)?(\d{2,5})/
    );
    updates.officeRentFeeAmount = rentNumMatch
      ? parseInt(rentNumMatch[1], 10)
      : defaultOfficeRentFee;
    if (!updates.type) {
      updates.type = 'face-to-face';
    }
  }

  // Price parsing on cleanedMsgWithoutDate so that day/year numbers are never mistaken for prices
  const msgWithoutFeeNumbers = cleanedMsgWithoutDate
    .replace(/(\d)\.(\d{3})\b/g, '$1$2')
    .replace(/bakici(?:\s+parasi|\s+ucreti)?\s*(?:var\s*)?\d{2,5}/g, '')
    .replace(/(?:ofis|oda)\s*(?:kirasi|ucreti)?\s*(?:var\s*)?\d{2,5}/g, '');

  const pricePatterns = [
    /(?:fiyati|fiyat|ucreti|ucret|seans ucreti|tutar|tutari)\s*(?:su kadar\s*)?(\d{3,5})/i,
    /(\d{3,5})\s*(?:tl|lira|₺|turk lirasi)/i,
    /(?:fiyati|fiyat|ucreti|ucret|odendi|alindi)\s+(\d{3,5})\b/i,
    /\b(\d{3,5})\b/
  ];

  for (const pat of pricePatterns) {
    const pm = msgWithoutFeeNumbers.match(pat);
    if (pm && pm[1]) {
      const val = parseInt(pm[1], 10);
      const isYearLike =
        val >= 2015 && val <= 2030 && val !== 2000 && pat.source === '\\b(\\d{3,5})\\b';
      if (!isYearLike && val >= 200 && val <= 50000) {
        updates.price = val;
        break;
      }
    }
  }

  const mentionsCompleted =
    asciiMsg.includes('tamamlandi') ||
    asciiMsg.includes('yapildi') ||
    asciiMsg.includes('gerceklesti') ||
    asciiMsg.includes('bitti');

  // 5. Strictly Scope Sessions by Date / Month BEFORE matching Client Name!
  // This guarantees that "7 Ekim Özlem" ONLY looks at 7 October (of the resolved year),
  // and "Ekim'de Özlem" ONLY looks at October (of the resolved year), NEVER touching 5 May!
  let scopedPool: Session[] = [];
  let scopeDescription = '';

  if (targetDate) {
    scopedPool = allActiveSessions.filter(s => s.date === targetDate);
    const [yr, mn, dy] = targetDate.split('-');
    scopeDescription = `${parseInt(dy, 10)} ${TURKISH_MONTH_DISPLAY[mn] || mn} ${yr}`;
  } else if (targetMonth) {
    scopedPool = allActiveSessions.filter(s => s.date.startsWith(targetMonth));
    const [yr, mn] = targetMonth.split('-');
    scopeDescription = `${TURKISH_MONTH_DISPLAY[mn] || mn} ${yr}`;
  } else if (pageContext?.activeTab === 'agenda') {
    if (pageContext?.agendaViewMode === 'day' && selectedDate) {
      const dayPool = allActiveSessions.filter(s => s.date === selectedDate);
      const matchedOnDay = findBestClientMatchInPool(cleanedMsgWithoutDate, dayPool);
      if (matchedOnDay) {
        scopedPool = dayPool;
      } else {
        scopedPool = allActiveSessions.filter(s => s.date.startsWith(visibleMonth));
      }
    } else {
      // Monthly or Weekly Agenda view: strictly scope to visibleMonth first!
      scopedPool = allActiveSessions.filter(s => s.date.startsWith(visibleMonth));
    }
  } else {
    scopedPool = pageSessions && pageSessions.length > 0 ? pageSessions : allActiveSessions;
  }

  let matchedClientName = findBestClientMatchInPool(cleanedMsgWithoutDate, scopedPool);

  // If the user explicitly gave a targetDate or targetMonth (e.g. "7 Ekim Özlem" or "Ekim'de Özlem")
  // and no session for that client exists in that date/month:
  // DO NOT fall back to modifying a session from another month (like 5 May)!
  if (!matchedClientName && (targetDate || targetMonth)) {
    const globalClientMatch = findBestClientMatchInPool(cleanedMsgWithoutDate, allActiveSessions);
    const wantsExplicitCreate =
      asciiMsg.includes('yeni seans') ||
      asciiMsg.includes('seans ekle') ||
      asciiMsg.includes('randevu ekle') ||
      asciiMsg.includes('kayit ekle');

    if (!wantsExplicitCreate) {
      const whoLabel = globalClientMatch ? `**${globalClientMatch}**` : 'belirtilen danışan';
      return {
        reply: `**${scopeDescription}** tarihinde ${whoLabel} adına kayıtlı bir seans bulunamadı. Başka aylardaki veya tarihlerdeki seanslara hata olmaması için dokunulmadı.\n\n*(Eğer bu tarihe yeni seans eklemek isterseniz "7 Ekim ${globalClientMatch || 'Özlem'} yeni seans ekle" diyebilirsiniz.)*`,
        actions: []
      };
    }
    matchedClientName = globalClientMatch;
  }

  // If no explicit date/month was given and not found in visibleMonth, check pageContext.selectedClientName
  if (!matchedClientName && !targetDate && !targetMonth && pageContext?.selectedClientName) {
    matchedClientName = pageContext.selectedClientName;
  }

  // Bulk pay all debts for client (only when user explicitly says "tüm borçları")
  if (
    !targetDate &&
    !targetMonth &&
    (asciiMsg.includes('tum borc') ||
      asciiMsg.includes('butun borc') ||
      asciiMsg.includes('hepsini odedi'))
  ) {
    const debtClient =
      matchedClientName || findBestClientMatchInPool(cleanedMsgWithoutDate, allActiveSessions);
    if (debtClient) {
      return {
        reply: `**${debtClient}** danışanının bekleyen tüm seans ödemeleri tahsil edildi olarak işaretlendi.`,
        actions: [
          {
            actionType: 'MARK_CLIENT_ALL_PAID',
            clientName: debtClient,
            updates: { paymentMethod: updates.paymentMethod }
          }
        ]
      };
    }
  }

  // Single-session day view shortcut when client name is omitted
  if (
    !matchedClientName &&
    !targetDate &&
    !targetMonth &&
    pageContext?.activeTab === 'agenda' &&
    pageContext?.agendaViewMode === 'day'
  ) {
    const daySessions = scopedPool.filter(s => s.date === selectedDate && !s.isDeleted);
    if (daySessions.length === 1 && (Object.keys(updates).length > 0 || mentionsCompleted)) {
      matchedClientName = daySessions[0].clientName;
    }
  }

  // 6. Execute update on the strictly scoped sessions for matchedClientName
  if (matchedClientName && (Object.keys(updates).length > 0 || mentionsCompleted)) {
    const clientSessionsInScope = scopedPool.filter(
      s => s && s.clientName && areClientNamesEquivalent(s.clientName, matchedClientName)
    );

    const uniqueClientSessions = Array.from(
      new Map(clientSessionsInScope.map(s => [s.id, s])).values()
    );

    if (uniqueClientSessions.length === 0) {
      return {
        reply: `**${scopeDescription || visibleMonth}** döneminde **${matchedClientName}** adına kayıtlı seans bulunamadı. Diğer dönemlerdeki kayıtlara müdahale edilmedi.`,
        actions: []
      };
    }

    let targetSessions = uniqueClientSessions;
    const wantsAll =
      asciiMsg.includes('tum ') || asciiMsg.includes('hepsi') || asciiMsg.includes('butun ');

    if (!wantsAll && targetSessions.length > 1) {
      // If user is marking as paid and there's exactly 1 unpaid session in this scope, prefer it
      const unpaidInScope = targetSessions.filter(s => s.paymentStatus !== 'paid');
      if (updates.paymentStatus === 'paid' && unpaidInScope.length === 1) {
        targetSessions = unpaidInScope;
      } else {
        // Pick reference date inside the same month (avoid stale selectedDate from another month!)
        const activeMonthPrefix = targetMonth || visibleMonth;
        const refDate =
          targetDate ||
          (selectedDate && selectedDate.startsWith(activeMonthPrefix)
            ? selectedDate
            : formatLocalDateIso());
        const sorted = [...targetSessions].sort((a, b) => {
          const diffA = Math.abs(new Date(a.date).getTime() - new Date(refDate).getTime());
          const diffB = Math.abs(new Date(b.date).getTime() - new Date(refDate).getTime());
          return diffA - diffB;
        });
        targetSessions = [sorted[0]];
      }
    }

    const sessionIds = targetSessions.map(s => s.id).filter(Boolean);
    const firstSession = targetSessions[0];

    if (mentionsCompleted && !updates.type && firstSession?.type === 'cancelled') {
      updates.type = updates.hasOfficeRentFee ? 'face-to-face' : 'online';
    }

    const summaryParts: string[] = [];
    if (mentionsCompleted || updates.type) {
      summaryParts.push(
        updates.type === 'cancelled'
          ? 'İptal Edildi'
          : updates.type === 'face-to-face'
          ? 'Yüz Yüze Seans (Tamamlandı)'
          : updates.type === 'online'
          ? 'Online Seans (Tamamlandı)'
          : 'Seans Tamamlandı'
      );
    }
    if (typeof updates.price === 'number') {
      summaryParts.push(`Ücret: ₺${updates.price.toLocaleString('tr-TR')}`);
    }
    if (updates.paymentStatus === 'paid') {
      summaryParts.push('Ödeme: Ödendi ✓');
    } else if (updates.paymentStatus === 'unpaid') {
      summaryParts.push('Ödeme: Ödenmedi');
    }
    if (typeof updates.hasBabysitterFee === 'boolean') {
      summaryParts.push(
        updates.hasBabysitterFee
          ? `Bakıcı Ücreti: Var (₺${(updates.babysitterFeeAmount || defaultBabysitterFee).toLocaleString('tr-TR')})`
          : 'Bakıcı Ücreti: Yok (₺0)'
      );
    }
    if (typeof updates.hasOfficeRentFee === 'boolean') {
      summaryParts.push(
        updates.hasOfficeRentFee
          ? `Ofis Kirası: Var (₺${(updates.officeRentFeeAmount || defaultOfficeRentFee).toLocaleString('tr-TR')})`
          : 'Ofis Kirası: Yok (₺0)'
      );
    }

    const dateLabel = firstSession?.date || targetDate || selectedDate;
    return {
      reply: `**${matchedClientName}** (${dateLabel}) seansı komutunuza göre güncellendi:\n• ${summaryParts.join('\n• ')}`,
      actions: [
        {
          actionType: 'UPDATE_SESSIONS',
          sessionIds,
          clientName: matchedClientName,
          targetDate: dateLabel,
          targetMonth: targetMonth || dateLabel.slice(0, 7),
          applyToScope: wantsAll ? 'visible_period' : 'single',
          updates
        }
      ]
    };
  }

  return {
    reply:
      'Komutunuzu aldım ancak bu tarih/görünümde eşleşen bir danışan seansı bulamadım. Lütfen tarih ve danışan adını kontrol ederek tekrar söyleyin. Örn: *"7 Ekim Özlem seans tamamlandı, ödemesi alındı, fiyatı 1500, bakıcı parası var, ofis kirası yok"*',
    actions: []
  };
}

export const VoiceChatAssistant: React.FC<VoiceChatAssistantProps> = ({
  activeTab,
  agendaViewMode,
  selectedDate,
  calendarViewDate,
  selectedClientName,
  sessions,
  settings,
  onUpdateSessionsBulk,
  onSaveSession,
  onMarkClientAllPaid,
  onAddExpense,
  onNavigateTab,
  onOpenClientProfile,
  featuresAIAllowed = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('psycalcu_assistant_voice_reply') === 'true';
    } catch {
      return false;
    }
  });

  const visibleMonthKey = useMemo(() => {
    const y = calendarViewDate.getFullYear();
    const m = String(calendarViewDate.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [calendarViewDate]);

  const visibleMonthLabel = useMemo(() => {
    return calendarViewDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  }, [calendarViewDate]);

  const pageRelevantSessions = useMemo(() => {
    const active = sessions.filter(s => !s.isDeleted);
    if (activeTab === 'client' && selectedClientName) {
      return active
        .filter(s => areClientNamesEquivalent(s.clientName, selectedClientName))
        .sort((a, b) => b.date.localeCompare(a.date));
    }
    if (activeTab === 'debts') {
      const unpaid = active.filter(
        s => s.type !== 'cancelled' && s.type !== 'non-session' && s.paymentStatus !== 'paid'
      );
      return unpaid.length > 0 ? unpaid : active.filter(s => s.date.startsWith(visibleMonthKey));
    }
    if (activeTab === 'agenda') {
      if (agendaViewMode === 'day') {
        const dayList = active.filter(s => s.date === selectedDate);
        const monthList = active.filter(s => s.date.startsWith(visibleMonthKey));
        const dayIds = new Set(dayList.map(s => s.id));
        return [...dayList, ...monthList.filter(s => !dayIds.has(s.id))];
      }
      return active
        .filter(s => s.date.startsWith(visibleMonthKey))
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    }
    const monthSessions = active.filter(s => s.date.startsWith(visibleMonthKey));
    if (monthSessions.length > 0) return monthSessions;
    return active.slice(-150);
  }, [sessions, activeTab, agendaViewMode, selectedDate, visibleMonthKey, selectedClientName]);

  const pageContextBadge = useMemo(() => {
    if (activeTab === 'agenda') {
      if (agendaViewMode === 'month') {
        return `Aylık Ajanda (${visibleMonthLabel})`;
      }
      if (agendaViewMode === 'week') {
        return `Haftalık Ajanda (${selectedDate})`;
      }
      return `Günlük Ajanda (${selectedDate})`;
    }
    if (activeTab === 'client' && selectedClientName) {
      return `Danışan: ${selectedClientName}`;
    }
    return TAB_LABELS[activeTab] || 'Klinik Paneli';
  }, [activeTab, agendaViewMode, selectedDate, visibleMonthLabel, selectedClientName]);

  const exampleClientName = useMemo(() => {
    if (selectedClientName) return selectedClientName;
    const monthMatch = pageRelevantSessions.find(s => s.clientName && s.type !== 'cancelled');
    if (monthMatch) return monthMatch.clientName;
    const dayMatch = sessions.find(s => !s.isDeleted && s.date === selectedDate && s.clientName);
    if (dayMatch) return dayMatch.clientName;
    return 'Özlem';
  }, [selectedClientName, sessions, selectedDate, pageRelevantSessions]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome_msg',
      role: 'assistant',
      content: `Merhaba! Bulunduğunuz sayfadaki seansları ve muhasebe verilerini görebiliyorum. Bana tarih veya ay belirterek sesli/yazılı komut verebilirsiniz.\n\n**Örnek Komut:**\n*"7 Ekim ${exampleClientName} seans tamamlandı, ödemesi alındı, fiyatı ${settings.defaultSessionPrice || 1200} TL, bakıcı parası var, ofis kirası yok"*`,
      timestamp: Date.now()
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    }
  }, [messages, isOpen, interimTranscript]);

  const speakText = (text: string) => {
    if (!voiceReplyEnabled || typeof window === 'undefined' || !('speechSynthesis' in window))
      return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#/g, '')
        .replace(/•/g, ', ');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'tr-TR';
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  const toggleVoiceReply = () => {
    setVoiceReplyEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('psycalcu_assistant_voice_reply', String(next));
      } catch {}
      if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  const executeAssistantActions = (
    actions: AssistantAction[],
    enforcedDateScope?: { targetDate?: string; targetMonth?: string }
  ): AppliedChangeRecord | undefined => {
    if (!Array.isArray(actions) || actions.length === 0) return undefined;

    const previousSnapshot = [...sessions];
    const detailLines: string[] = [];
    let modifiedCount = 0;

    for (const action of actions) {
      if (action.actionType === 'UPDATE_SESSIONS' && action.updates) {
        const u = action.updates;
        const effectiveTargetDate = enforcedDateScope?.targetDate || action.targetDate;
        const effectiveTargetMonth = enforcedDateScope?.targetMonth || action.targetMonth;

        // Filter action.sessionIds so that no session outside effectiveTargetDate / effectiveTargetMonth can EVER be modified
        const rawIds = Array.isArray(action.sessionIds) ? action.sessionIds : [];
        const matchedIds = new Set<string>();

        for (const id of rawIds) {
          const found = sessions.find(s => s.id === id && !s.isDeleted);
          if (!found) continue;
          if (effectiveTargetDate && found.date !== effectiveTargetDate) continue;
          if (effectiveTargetMonth && !found.date.startsWith(effectiveTargetMonth)) continue;
          matchedIds.add(id);
        }

        if (matchedIds.size === 0 && action.clientName) {
          let candidates = sessions.filter(
            s => !s.isDeleted && areClientNamesEquivalent(s.clientName, action.clientName!)
          );

          if (effectiveTargetDate) {
            // Strictly filter to effectiveTargetDate — NEVER fall back to another date!
            candidates = candidates.filter(s => s.date === effectiveTargetDate);
          } else if (effectiveTargetMonth) {
            // Strictly filter to effectiveTargetMonth — NEVER fall back to another month!
            candidates = candidates.filter(s => s.date.startsWith(effectiveTargetMonth));
          } else if (activeTab === 'agenda' && agendaViewMode === 'day') {
            const onSelected = candidates.filter(s => s.date === selectedDate);
            candidates =
              onSelected.length > 0
                ? onSelected
                : candidates.filter(s => s.date.startsWith(visibleMonthKey));
          } else {
            candidates = candidates.filter(s => s.date.startsWith(visibleMonthKey));
          }

          if (
            action.applyToScope !== 'visible_period' &&
            action.applyToScope !== 'all' &&
            candidates.length > 1
          ) {
            const monthPrefix = effectiveTargetMonth || visibleMonthKey;
            const refDate =
              effectiveTargetDate ||
              (selectedDate && selectedDate.startsWith(monthPrefix)
                ? selectedDate
                : formatLocalDateIso());
            candidates = [...candidates]
              .sort((a, b) => {
                const da = Math.abs(new Date(a.date).getTime() - new Date(refDate).getTime());
                const db = Math.abs(new Date(b.date).getTime() - new Date(refDate).getTime());
                return da - db;
              })
              .slice(0, 1);
          }
          candidates.forEach(c => matchedIds.add(c.id));
        }

        const updatedById = new Map<string, Session>();
        for (const s of sessions) {
          if (!matchedIds.has(s.id)) continue;

          const updated: Session = {
            ...s,
            isManuallyEdited: true,
            updatedAt: Date.now()
          };

          if (u.type) {
            updated.type = u.type;
            if (u.type === 'cancelled') {
              updated.price = 0;
              updated.hasBabysitterFee = false;
              updated.babysitterFeeAmount = 0;
              updated.hasOfficeRentFee = false;
              updated.officeRentFeeAmount = 0;
            } else if (u.type === 'online' && u.hasOfficeRentFee === undefined) {
              updated.hasOfficeRentFee = false;
              updated.officeRentFeeAmount = 0;
            }
          }

          if (typeof u.price === 'number' && u.price >= 0) {
            updated.price = u.price;
          }

          if (typeof u.hasBabysitterFee === 'boolean') {
            updated.hasBabysitterFee = u.hasBabysitterFee;
            updated.babysitterFeeAmount = u.hasBabysitterFee
              ? typeof u.babysitterFeeAmount === 'number' && u.babysitterFeeAmount > 0
                ? u.babysitterFeeAmount
                : s.babysitterFeeAmount || settings.defaultBabysitterFee || 250
              : 0;
          } else if (typeof u.babysitterFeeAmount === 'number') {
            updated.hasBabysitterFee = u.babysitterFeeAmount > 0;
            updated.babysitterFeeAmount = u.babysitterFeeAmount;
          }

          if (typeof u.hasOfficeRentFee === 'boolean') {
            updated.hasOfficeRentFee = u.hasOfficeRentFee;
            updated.officeRentFeeAmount = u.hasOfficeRentFee
              ? typeof u.officeRentFeeAmount === 'number' && u.officeRentFeeAmount > 0
                ? u.officeRentFeeAmount
                : s.officeRentFeeAmount || settings.defaultOfficeRentFee || 200
              : 0;
          } else if (typeof u.officeRentFeeAmount === 'number') {
            updated.hasOfficeRentFee = u.officeRentFeeAmount > 0;
            updated.officeRentFeeAmount = u.officeRentFeeAmount;
          }

          if (u.paymentStatus) {
            updated.paymentStatus = u.paymentStatus;
            if (u.paymentStatus === 'paid') {
              updated.paidAmount =
                typeof u.paidAmount === 'number' && u.paidAmount > 0 ? u.paidAmount : updated.price;
            } else if (u.paymentStatus === 'unpaid') {
              updated.paidAmount = 0;
            } else if (typeof u.paidAmount === 'number') {
              updated.paidAmount = u.paidAmount;
            }
          }

          if (u.paymentMethod) {
            updated.paymentMethod = u.paymentMethod;
          }
          if (u.notes !== undefined) {
            updated.notes = u.notes;
          }
          if (u.date) {
            updated.date = u.date;
          }
          if (u.time) {
            updated.time = u.time;
          }

          updatedById.set(s.id, updated);
          modifiedCount++;

          const changeBadges: string[] = [];
          changeBadges.push(`Ücret: ₺${updated.price.toLocaleString('tr-TR')}`);
          changeBadges.push(updated.paymentStatus === 'paid' ? 'Ödendi ✓' : 'Ödenmedi');
          changeBadges.push(
            updated.hasBabysitterFee
              ? `Bakıcı: Var (₺${updated.babysitterFeeAmount})`
              : 'Bakıcı: Yok'
          );
          changeBadges.push(
            updated.hasOfficeRentFee
              ? `Ofis Kirası: Var (₺${updated.officeRentFeeAmount})`
              : 'Ofis Kirası: Yok'
          );

          detailLines.push(
            `${updated.clientName} (${updated.date} ${updated.time}) → ${changeBadges.join(' • ')}`
          );
        }

        if (updatedById.size > 0) {
          onUpdateSessionsBulk(
            prevSessions => prevSessions.map(s => updatedById.get(s.id) || s),
            `${updatedById.size} seans sesli asistan ile güncellendi.`
          );
        }
      } else if (action.actionType === 'CREATE_SESSION' && action.newSession) {
        const ns = action.newSession;
        const type: SessionType = ns.type || 'online';
        const price =
          typeof ns.price === 'number'
            ? ns.price
            : type === 'online'
            ? settings.defaultOnlinePrice || settings.defaultSessionPrice
            : settings.defaultFaceToFacePrice || settings.defaultSessionPrice;
        const hasBabysitter = ns.hasBabysitterFee ?? settings.defaultBabysitterFee > 0;
        const hasOffice =
          ns.hasOfficeRentFee ?? (type === 'face-to-face' && settings.defaultOfficeRentFee > 0);

        const created: Session = {
          id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          clientName: ns.clientName || 'Danışan',
          date: enforcedDateScope?.targetDate || ns.date || selectedDate,
          time: ns.time || '14:00',
          duration: 50,
          type,
          price,
          paymentStatus: ns.paymentStatus || 'unpaid',
          paidAmount: ns.paymentStatus === 'paid' ? price : 0,
          paymentMethod: ns.paymentMethod,
          hasBabysitterFee: hasBabysitter,
          babysitterFeeAmount: hasBabysitter
            ? ns.babysitterFeeAmount || settings.defaultBabysitterFee
            : 0,
          hasOfficeRentFee: hasOffice,
          officeRentFeeAmount: hasOffice
            ? ns.officeRentFeeAmount || settings.defaultOfficeRentFee
            : 0,
          notes: ns.notes || '',
          isManuallyEdited: true,
          updatedAt: Date.now()
        };
        onSaveSession(created);
        modifiedCount++;
        const changeBadges: string[] = [
          `Ücret: ₺${created.price.toLocaleString('tr-TR')}`,
          created.paymentStatus === 'paid' ? 'Ödendi ✓' : 'Ödenmedi',
          created.hasBabysitterFee
            ? `Bakıcı: Var (₺${created.babysitterFeeAmount})`
            : 'Bakıcı: Yok',
          created.hasOfficeRentFee
            ? `Ofis Kirası: Var (₺${created.officeRentFeeAmount})`
            : 'Ofis Kirası: Yok'
        ];
        detailLines.push(
          `Yeni Seans: ${created.clientName} (${created.date} ${created.time}) → ${changeBadges.join(' • ')}`
        );
      } else if (action.actionType === 'MARK_CLIENT_ALL_PAID' && action.clientName) {
        onMarkClientAllPaid(action.clientName, action.updates?.paymentMethod);
        modifiedCount++;
        detailLines.push(
          `${action.clientName} danışanının tüm bekleyen seans ödemeleri tahsil edildi.`
        );
      } else if (action.actionType === 'ADD_EXPENSE' && action.newExpense) {
        onAddExpense({
          title: action.newExpense.title || 'Klinik Gideri',
          amount: Number(action.newExpense.amount) || 0,
          category: (action.newExpense.category as any) || 'other',
          date: enforcedDateScope?.targetDate || action.newExpense.date || selectedDate
        });
        modifiedCount++;
        detailLines.push(
          `Yeni Gider Eklendi: ${action.newExpense.title} (₺${action.newExpense.amount})`
        );
      } else if (action.actionType === 'NAVIGATE_TAB' && action.tab) {
        onNavigateTab(action.tab, action.viewMode, action.date);
        detailLines.push(`Sayfa yönlendirildi: ${TAB_LABELS[action.tab] || action.tab}`);
      } else if (action.actionType === 'OPEN_CLIENT_PROFILE' && action.clientName) {
        onOpenClientProfile(action.clientName);
        detailLines.push(`${action.clientName} danışan profili açıldı.`);
      }
    }

    if (detailLines.length === 0 && modifiedCount === 0) return undefined;

    return {
      id: `change_${Date.now()}`,
      description: `${modifiedCount > 0 ? `${modifiedCount} kayıt güncellendi` : 'İşlem uygulandı'}`,
      details: detailLines,
      previousSessionsSnapshot: previousSnapshot
    };
  };

  const handleUndoChanges = (messageId: string, record: AppliedChangeRecord) => {
    if (!record || record.undone) return;
    onUpdateSessionsBulk(() => record.previousSessionsSnapshot, 'Asistan işlemi geri alındı.');
    setMessages(prev =>
      prev.map(m =>
        m.id === messageId && m.appliedChanges
          ? { ...m, appliedChanges: { ...m.appliedChanges, undone: true } }
          : m
      )
    );
  };

  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = (textOverride !== undefined ? textOverride : input).trim();
    if (!textToSend || isLoading) return;

    if (!featuresAIAllowed) {
      setMessages(prev => [
        ...prev,
        {
          id: `user_${Date.now()}`,
          role: 'user',
          content: textToSend,
          timestamp: Date.now()
        },
        {
          id: `ast_${Date.now() + 1}`,
          role: 'assistant',
          content: 'Yapay zeka sesli asistan özelliği yöneticiniz tarafından kısıtlanmıştır.',
          timestamp: Date.now()
        }
      ]);
      setInput('');
      return;
    }

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    if (textOverride === undefined) setInput('');
    setInterimTranscript('');
    setIsLoading(true);

    const pageContext = {
      activeTab,
      activeTabLabel: pageContextBadge,
      agendaViewMode,
      selectedDate,
      visibleMonth: visibleMonthKey,
      currentYear: new Date().getFullYear(),
      selectedClientName,
      defaultSessionPrice: settings.defaultSessionPrice,
      defaultOnlinePrice: settings.defaultOnlinePrice || settings.defaultSessionPrice,
      defaultFaceToFacePrice: settings.defaultFaceToFacePrice || settings.defaultSessionPrice,
      defaultBabysitterFee: settings.defaultBabysitterFee,
      defaultOfficeRentFee: settings.defaultOfficeRentFee
    };

    // Parse date/month scope from the command first
    const asciiNormalized = normalizeSpokenTurkishNumbers(foldTurkishAscii(textToSend));
    const parsedDateScope = parseTurkishDateFromCommand(asciiNormalized);

    // Run deterministic local command processor
    const localResult = processClientCommandLocally(
      textToSend,
      pageContext,
      pageRelevantSessions,
      sessions
    );

    let replyText = localResult.reply;
    let actions: AssistantAction[] = localResult.actions;

    // If localResult already matched concrete session actions OR explicitly blocked a wrong-date match,
    // execute immediately with zero risk of AI picking a wrong date (like 5 May instead of 7 October)!
    const isExplicitDateNotFoundWarning =
      (parsedDateScope.targetDate || parsedDateScope.targetMonth) &&
      localResult.actions.length === 0 &&
      localResult.reply.includes('kayıtlı bir seans bulunamadı');

    if (localResult.actions.length === 0 && !isExplicitDateNotFoundWarning) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6500);

        // Scope sessions sent to backend to parsedDateScope if present so AI can never see other months' sessions
        let candidateSessionsForApi = pageRelevantSessions;
        if (parsedDateScope.targetDate) {
          candidateSessionsForApi = sessions.filter(
            s => !s.isDeleted && s.date === parsedDateScope.targetDate
          );
        } else if (parsedDateScope.targetMonth) {
          candidateSessionsForApi = sessions.filter(
            s => !s.isDeleted && s.date.startsWith(parsedDateScope.targetMonth!)
          );
        }

        const compactPayloadSessions = candidateSessionsForApi.slice(0, 75).map(s => ({
          id: s.id,
          clientName: s.clientName,
          date: s.date,
          time: s.time,
          type: s.type,
          price: s.price,
          paymentStatus: s.paymentStatus || 'unpaid',
          paidAmount: s.paidAmount || 0,
          paymentMethod: s.paymentMethod || null,
          hasBabysitterFee: Boolean(s.hasBabysitterFee),
          babysitterFeeAmount: s.babysitterFeeAmount || 0,
          hasOfficeRentFee: Boolean(s.hasOfficeRentFee),
          officeRentFeeAmount: s.officeRentFeeAmount || 0
        }));

        const response = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            message: textToSend,
            pageContext,
            sessions: compactPayloadSessions,
            history: messages.slice(-4).map(m => ({ role: m.role, content: m.content }))
          })
        });

        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          const data = await response.json();
          const serverActions: AssistantAction[] = Array.isArray(data.actions) ? data.actions : [];
          if (serverActions.length > 0) {
            actions = serverActions;
            replyText = data.reply || localResult.reply;
          } else if (data.reply) {
            replyText = data.reply;
          }
        }
      } catch (err) {
        console.warn('Backend assistant unreachable or timed out, using local command engine:', err);
      }
    }

    try {
      const appliedRecord = executeAssistantActions(actions, {
        targetDate: parsedDateScope.targetDate,
        targetMonth: parsedDateScope.targetMonth
      });

      const assistantMsg: ChatMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: Date.now(),
        appliedChanges: appliedRecord
      };

      setMessages(prev => [...prev, assistantMsg]);
      speakText(replyText);
    } finally {
      setIsLoading(false);
    }
  };

  // Start / Stop Voice Recognition (Turkish)
  const toggleListening = async (openModalIfClosed = true) => {
    if (openModalIfClosed && !isOpen) {
      setIsOpen(true);
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'tr-TR';
        recognition.continuous = false;
        recognition.interimResults = true;

        let finalCaptured = '';

        recognition.onstart = () => {
          setIsListening(true);
          setInterimTranscript('');
        };

        recognition.onresult = (event: any) => {
          let interim = '';
          let finalText = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcriptPiece = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalText += transcriptPiece;
            } else {
              interim += transcriptPiece;
            }
          }
          if (finalText) {
            finalCaptured += (finalCaptured ? ' ' : '') + finalText.trim();
            setInput(finalCaptured);
          }
          setInterimTranscript(interim);
        };

        recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition warning:', event.error);
          setIsListening(false);
          setInterimTranscript('');
        };

        recognition.onend = () => {
          setIsListening(false);
          setInterimTranscript('');
          if (finalCaptured.trim()) {
            handleSendMessage(finalCaptured.trim());
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch (err) {
        console.warn('Web Speech API start error, falling back to MediaRecorder:', err);
      }
    }

    // Fallback: MediaRecorder -> /api/assistant/transcribe
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm'
        });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64String = (reader.result as string)?.split(',')[1];
          if (!base64String) return;
          setIsLoading(true);
          try {
            const res = await fetch('/api/assistant/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64: base64String,
                mimeType: mediaRecorder.mimeType || 'audio/webm'
              })
            });
            const data = await res.json();
            if (data.text) {
              setInput(data.text);
              handleSendMessage(data.text);
            }
          } catch (e) {
            console.error('Transcription error:', e);
          } finally {
            setIsLoading(false);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsListening(true);
    } catch (micErr) {
      console.error('Microphone permission error:', micErr);
      setIsListening(false);
    }
  };

  const quickPrompts = useMemo(() => {
    const baseClient = exampleClientName;
    const defPrice = settings.defaultSessionPrice || 1200;
    return [
      `7 Ekim ${baseClient} seans tamamlandı, ödemesi alındı, fiyatı ${defPrice}, bakıcı parası var, ofis kirası yok`,
      `${baseClient} ödemesi nakit alındı`,
      `Bu ekrandaki seans ve gelir özetini söyle`
    ];
  }, [exampleClientName, settings.defaultSessionPrice]);

  return (
    <>
      {/* Floating Action Buttons (Accessible on EVERY page) */}
      <div className="fixed bottom-5 right-4 sm:right-6 z-40 flex items-center gap-2">
        {!isOpen && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => toggleListening(true)}
            title="Tek Dokunuşla Sesli Komut Ver"
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg border transition-all cursor-pointer ${
              isListening
                ? 'bg-rose-600 text-white border-rose-400 animate-pulse'
                : 'bg-white text-[#6b705c] border-[#e5e1d8] hover:bg-[#fdfbf7]'
            }`}
          >
            <Mic className="w-5 h-5" />
          </motion.button>
        )}

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(prev => !prev)}
          className="bg-[#6b705c] hover:bg-[#585c4c] text-white px-4 py-3 rounded-full shadow-xl border border-white/15 flex items-center gap-2.5 cursor-pointer transition-all"
        >
          <div className="relative flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#ffe8d6]" />
            {isListening && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
          <span className="text-xs sm:text-sm font-bold tracking-tight">Sesli Asistan</span>
        </motion.button>
      </div>

      {/* Assistant Drawer / Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            className="fixed bottom-20 right-3 sm:right-6 left-3 sm:left-auto sm:w-[430px] max-h-[82dvh] bg-white rounded-3xl shadow-2xl border border-[#e5e1d8] z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#6b705c] text-white px-4 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-[#ffe8d6]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold truncate">PsyCalcu Sesli & Yazılı Asistan</h3>
                  </div>
                  <p className="text-[11px] text-[#ffe8d6]/90 truncate flex items-center gap-1">
                    <span>📍 {pageContextBadge}</span>
                    <span>•</span>
                    <span>{pageRelevantSessions.length} seans</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={toggleVoiceReply}
                  title={voiceReplyEnabled ? 'Sesli Yanıt Açık' : 'Sesli Yanıt Kapalı'}
                  className={`p-2 rounded-xl transition-colors cursor-pointer ${
                    voiceReplyEnabled
                      ? 'bg-white/20 text-white'
                      : 'text-white/60 hover:bg-white/10'
                  }`}
                >
                  {voiceReplyEnabled ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Voice Command Guide Banner */}
            <div className="bg-[#fdfbf7] border-b border-[#e5e1d8] px-3.5 py-2 flex items-center justify-between gap-2 shrink-0">
              <div className="text-[11px] text-slate-600 leading-tight">
                Tarih belirterek (<span className="font-semibold text-[#6b705c]">örn. 7 Ekim Özlem...</span>) söylediğinizde yalnızca o gün/ay içindeki danışana işlem uygulanır.
              </div>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#faf8f5] min-h-[260px] max-h-[48dvh]">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-2xs ${
                      msg.role === 'user'
                        ? 'bg-[#6b705c] text-white rounded-br-xs'
                        : 'bg-white text-slate-800 border border-[#e5e1d8] rounded-bl-xs'
                    }`}
                  >
                    <div className="prose prose-xs max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>

                    {msg.appliedChanges && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 bg-emerald-50/70 rounded-xl p-2.5 border border-emerald-200/70">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            {msg.appliedChanges.undone
                              ? 'İşlem Geri Alındı'
                              : msg.appliedChanges.description}
                          </span>
                          {!msg.appliedChanges.undone && (
                            <button
                              type="button"
                              onClick={() => handleUndoChanges(msg.id, msg.appliedChanges!)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Geri Al
                            </button>
                          )}
                        </div>
                        <ul className="space-y-1">
                          {msg.appliedChanges.details.map((line, i) => (
                            <li
                              key={i}
                              className={`text-[11px] font-medium ${
                                msg.appliedChanges?.undone
                                  ? 'line-through text-slate-400'
                                  : 'text-emerald-900'
                              }`}
                            >
                              • {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isListening && (
                <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-2.5 rounded-2xl text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping shrink-0" />
                  <div className="flex-1">
                    <span className="font-bold block text-[11px] text-rose-700">
                      Dinleniyor (Türkçe)...
                    </span>
                    <span className="italic text-rose-900">
                      {interimTranscript || 'Lütfen komutunuzu söyleyin...'}
                    </span>
                  </div>
                </div>
              )}

              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-[#e5e1d8] px-3.5 py-2.5 rounded-2xl w-fit">
                  <Loader2 className="w-4 h-4 animate-spin text-[#6b705c]" />
                  <span>Komutunuz uygulanıyor...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Example Quick Chips */}
            <div className="px-3 py-2 bg-[#fdfbf7] border-t border-[#e5e1d8] overflow-x-auto flex items-center gap-1.5 no-scrollbar shrink-0">
              {quickPrompts.map((promptText, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(promptText)}
                  className="shrink-0 text-[11px] font-medium bg-white hover:bg-[#6b705c]/10 text-slate-700 border border-[#e5e1d8] rounded-xl px-2.5 py-1 transition-colors cursor-pointer max-w-[260px] truncate"
                  title={promptText}
                >
                  💬 {promptText}
                </button>
              ))}
            </div>

            {/* Input & Voice Controls Footer */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-white border-t border-[#e5e1d8] flex items-center gap-2 shrink-0"
            >
              <button
                type="button"
                onClick={() => toggleListening(false)}
                title={isListening ? 'Dinlemeyi Durdur' : 'Sesli Komut Ver'}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                  isListening
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-500/30 animate-pulse'
                    : 'bg-[#fdfbf7] hover:bg-[#6b705c]/15 text-[#6b705c] border border-[#e5e1d8]'
                }`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <div className="relative flex-1 bg-[#fdfbf7] border border-[#e5e1d8] rounded-2xl px-3 pt-1 pb-1.5 focus-within:border-[#6b705c] focus-within:bg-white transition-all">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  SESLİ VEYA YAZILI KOMUT
                </span>
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={`7 Ekim ${exampleClientName} seans tamamlandı, ödendi...`}
                  className="w-full text-xs sm:text-sm font-medium text-slate-800 bg-transparent focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-11 h-11 rounded-2xl bg-[#6b705c] hover:bg-[#585c4c] disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
export default VoiceChatAssistant;
