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
 * Converts common spoken Turkish number words into digits (e.g. "bin beş yüz" -> "1500")
 */
function normalizeSpokenTurkishNumbers(asciiText: string): string {
  let s = asciiText;
  const replacements: Array<[RegExp, string]> = [
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
  for (const [regex, val] of replacements) {
    s = s.replace(regex, val);
  }
  return s;
}

/**
 * Smart Client-Side Turkish Command & Q&A Processor.
 * Guarantees instant, zero-error execution even if the backend API is unreachable or times out.
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
  const selectedDate: string = pageContext?.selectedDate || new Date().toISOString().split('T')[0];
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
      (acc, s) => acc + (s.hasBabysitterFee ? Number(s.babysitterFeeAmount) || defaultBabysitterFee : 0),
      0
    );
    const officeRentTotal = activeList.reduce(
      (acc, s) => acc + (s.hasOfficeRentFee ? Number(s.officeRentFeeAmount) || defaultOfficeRentFee : 0),
      0
    );
    const net = gross - babysitterTotal - officeRentTotal;

    return {
      reply: `Bu görünümde (**${pageContext?.activeTabLabel || 'Mevcut Sayfa'}**) toplam **${activeList.length} aktif seans** bulunuyor (${paidList.length} ödendi, ${unpaidList.length} bekliyor).\n\n• **Brüt Gelir:** ₺${gross.toLocaleString('tr-TR')}\n• **Bekleyen Tahsilat:** ₺${unpaidTotal.toLocaleString('tr-TR')}\n• **Bakıcı & Ofis Kesintisi:** ₺${(babysitterTotal + officeRentTotal).toLocaleString('tr-TR')}\n• **Net Kâr:** ₺${net.toLocaleString('tr-TR')}`,
      actions: []
    };
  }

  // 3. Match client name from pageSessions first, then allSessions
  const combinedPool = [...(pageSessions || []), ...(allSessions || []).filter(s => !s.isDeleted)];
  const uniqueClients = new Map<string, string>(); // asciiName -> original display name
  combinedPool.forEach(s => {
    if (s && s.clientName) {
      const cleanName = String(s.clientName).trim();
      const asciiName = foldTurkishAscii(cleanName);
      if (asciiName && !uniqueClients.has(asciiName)) {
        uniqueClients.set(asciiName, cleanName);
      }
    }
  });

  let matchedClientName = '';
  let bestMatchScore = 0;

  for (const [asciiClient, originalClient] of uniqueClients.entries()) {
    if (asciiClient.length >= 3 && asciiMsg.includes(asciiClient)) {
      const score = asciiClient.length + 100;
      if (score > bestMatchScore) {
        bestMatchScore = score;
        matchedClientName = originalClient;
      }
    } else {
      const tokens = asciiClient.split(' ').filter(t => t.length >= 2);
      if (tokens.length >= 2 && tokens.every(t => asciiMsg.includes(t))) {
        const score = asciiClient.length + 50;
        if (score > bestMatchScore) {
          bestMatchScore = score;
          matchedClientName = originalClient;
        }
      } else if (tokens.length >= 1 && tokens[0].length >= 3) {
        // Check first name match if spoken with or without Turkish suffix
        const firstToken = tokens[0];
        const wordRegex = new RegExp(`\\b${firstToken}[a-z]{0,4}\\b`, 'i');
        if (wordRegex.test(asciiMsg)) {
          const score = firstToken.length;
          if (score > bestMatchScore) {
            bestMatchScore = score;
            matchedClientName = originalClient;
          }
        }
      }
    }
  }

  if (!matchedClientName && pageContext?.selectedClientName) {
    matchedClientName = pageContext.selectedClientName;
  }

  // Extract a spoken name if user said a name that isn't in sessions yet (e.g. "Ahmet Yılmaz seans tamamlandı...")
  let extractedNewClientName = '';
  if (!matchedClientName) {
    const stopWords = new Set([
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
      'gun',
      'icin',
      'ekle'
    ]);
    const rawWords = rawMsg.split(/\s+/);
    const nameWords: string[] = [];
    for (const w of rawWords) {
      const cleanW = foldTurkishAscii(w);
      if (!cleanW || /^\d+$/.test(cleanW) || stopWords.has(cleanW)) {
        if (nameWords.length > 0) break;
        continue;
      }
      nameWords.push(w.replace(/['’`.,;!?].*$/, ''));
      if (nameWords.length >= 3) break;
    }
    if (nameWords.length >= 1) {
      extractedNewClientName = nameWords
        .map(w => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1))
        .join(' ');
    }
  }

  // 4. Parse explicit date in command if any (e.g., "15 ekim", "bugün", "dün", "yarın")
  const turkishMonths: Record<string, string> = {
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

  let targetDate: string | undefined = undefined;
  if (asciiMsg.includes('bugun')) {
    targetDate = new Date().toISOString().split('T')[0];
  } else if (asciiMsg.includes('dun')) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    targetDate = d.toISOString().split('T')[0];
  } else if (asciiMsg.includes('yarin')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    targetDate = d.toISOString().split('T')[0];
  } else {
    for (const [mName, mNum] of Object.entries(turkishMonths)) {
      const regex = new RegExp(`\\b(\\d{1,2})\\s*${mName}\\b`, 'i');
      const m = asciiMsg.match(regex);
      if (m) {
        const day = String(parseInt(m[1], 10)).padStart(2, '0');
        const year = visibleMonth ? visibleMonth.slice(0, 4) : String(new Date().getFullYear());
        targetDate = `${year}-${mNum}-${day}`;
        break;
      }
    }
  }

  // 5. Parse updates from Turkish command
  const updates: NonNullable<AssistantAction['updates']> = {};

  // Session type / status
  if (asciiMsg.includes('iptal') || asciiMsg.includes('gelmedi') || asciiMsg.includes('katilmadi')) {
    updates.type = 'cancelled';
    updates.price = 0;
    updates.hasBabysitterFee = false;
    updates.babysitterFeeAmount = 0;
    updates.hasOfficeRentFee = false;
    updates.officeRentFeeAmount = 0;
  } else if (asciiMsg.includes('yuz yuze') || asciiMsg.includes('yuzyuze') || asciiMsg.includes('ofiste')) {
    updates.type = 'face-to-face';
  } else if (asciiMsg.includes('online') || asciiMsg.includes('onlayn') || asciiMsg.includes('goruntulu')) {
    updates.type = 'online';
    updates.hasOfficeRentFee = false;
    updates.officeRentFeeAmount = 0;
  }

  // Payment status (handles "öden parası alındı", "ödemesi alındı", "ödendi", "parası alındı", etc.)
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

  // Payment method
  if (asciiMsg.includes('nakit') || asciiMsg.includes('elden')) {
    updates.paymentMethod = 'cash';
    if (!updates.paymentStatus) updates.paymentStatus = 'paid';
  } else if (asciiMsg.includes('kredi kart') || asciiMsg.includes('kartla') || asciiMsg.includes('pos')) {
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

  // Babysitter fee
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
    updates.babysitterFeeAmount = babyNumMatch ? parseInt(babyNumMatch[1], 10) : defaultBabysitterFee;
  }

  // Office rent fee
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
    const rentNumMatch = asciiMsg.match(/(?:ofis|oda)\s*(?:kirasi|ucreti)?\s*(?:var\s*)?(\d{2,5})/);
    updates.officeRentFeeAmount = rentNumMatch ? parseInt(rentNumMatch[1], 10) : defaultOfficeRentFee;
    if (!updates.type) {
      updates.type = 'face-to-face';
    }
  }

  // Price parsing (strip thousand separator dots like 1.500 -> 1500, and strip babysitter/office phrases first so their numbers don't collide)
  const msgWithoutFeeNumbers = asciiMsg
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
      // Avoid matching years like 2025/2026 unless explicitly preceded by fiyat/ücret/TL
      const isYearLike = (val === 2024 || val === 2025 || val === 2026) && pat.source === '\\b(\\d{3,5})\\b';
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

  // Bulk pay all debts for client
  if (
    matchedClientName &&
    (asciiMsg.includes('tum borc') || asciiMsg.includes('butun borc') || asciiMsg.includes('hepsini odedi'))
  ) {
    return {
      reply: `**${matchedClientName}** danışanının bekleyen tüm seans ödemeleri tahsil edildi olarak işaretlendi.`,
      actions: [
        {
          actionType: 'MARK_CLIENT_ALL_PAID',
          clientName: matchedClientName,
          updates: { paymentMethod: updates.paymentMethod }
        }
      ]
    };
  }

  // Update existing session(s) if client matched (or if only 1 session is on the current day view)
  if (!matchedClientName && pageContext?.activeTab === 'agenda' && pageContext?.agendaViewMode === 'day') {
    const daySessions = (pageSessions || []).filter(s => s.date === selectedDate && !s.isDeleted);
    if (daySessions.length === 1 && (Object.keys(updates).length > 0 || mentionsCompleted)) {
      matchedClientName = daySessions[0].clientName;
    }
  }

  if (matchedClientName && (Object.keys(updates).length > 0 || mentionsCompleted)) {
    const clientSessions = combinedPool.filter(
      s => s && s.clientName && areClientNamesEquivalent(s.clientName, matchedClientName)
    );

    // Deduplicate by id
    const uniqueClientSessions = Array.from(new Map(clientSessions.map(s => [s.id, s])).values());

    let targetSessions = uniqueClientSessions;
    if (targetDate) {
      const onDate = uniqueClientSessions.filter(s => s.date === targetDate);
      if (onDate.length > 0) targetSessions = onDate;
    } else if (pageContext?.activeTab === 'agenda' && pageContext?.agendaViewMode === 'day' && selectedDate) {
      const onSelected = uniqueClientSessions.filter(s => s.date === selectedDate);
      if (onSelected.length > 0) targetSessions = onSelected;
    } else if (visibleMonth) {
      const inMonth = uniqueClientSessions.filter(s => s.date.startsWith(visibleMonth));
      if (inMonth.length > 0) targetSessions = inMonth;
    }

    const wantsAll = asciiMsg.includes('tum ') || asciiMsg.includes('hepsi') || asciiMsg.includes('butun ');
    if (!wantsAll && targetSessions.length > 1) {
      const refDate = targetDate || selectedDate;
      const sorted = [...targetSessions].sort((a, b) => {
        const diffA = Math.abs(new Date(a.date).getTime() - new Date(refDate).getTime());
        const diffB = Math.abs(new Date(b.date).getTime() - new Date(refDate).getTime());
        return diffA - diffB;
      });
      targetSessions = [sorted[0]];
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
          applyToScope: wantsAll ? 'visible_period' : 'single',
          updates
        }
      ]
    };
  }

  // If the client doesn't exist in the calendar yet, but user gave a clear session command with a name (e.g. "Ahmet Yılmaz seans tamamlandı, ödemesi alındı, fiyatı 1500...")
  if (extractedNewClientName && (Object.keys(updates).length > 0 || mentionsCompleted)) {
    const newType: SessionType = updates.type || (updates.hasOfficeRentFee ? 'face-to-face' : 'online');
    const newPrice = typeof updates.price === 'number' ? updates.price : defaultPrice;
    const newDate = targetDate || selectedDate;
    const timeMatch = asciiMsg.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
    const newTime = timeMatch ? `${String(timeMatch[1]).padStart(2, '0')}:${timeMatch[2]}` : '14:00';

    const summaryParts: string[] = [
      `Ücret: ₺${newPrice.toLocaleString('tr-TR')}`,
      updates.paymentStatus === 'paid' ? 'Ödeme: Ödendi ✓' : 'Ödeme: Ödenmedi',
      updates.hasBabysitterFee
        ? `Bakıcı: Var (₺${updates.babysitterFeeAmount || defaultBabysitterFee})`
        : 'Bakıcı: Yok',
      updates.hasOfficeRentFee
        ? `Ofis Kirası: Var (₺${updates.officeRentFeeAmount || defaultOfficeRentFee})`
        : 'Ofis Kirası: Yok'
    ];

    return {
      reply: `**${extractedNewClientName}** için ${newDate} tarihinde kayıtlı seans bulunamadığından yeni seans oluşturuldu ve bilgiler işlendi:\n• ${summaryParts.join('\n• ')}`,
      actions: [
        {
          actionType: 'CREATE_SESSION',
          newSession: {
            clientName: extractedNewClientName,
            date: newDate,
            time: newTime,
            type: newType,
            price: newPrice,
            paymentStatus: updates.paymentStatus === 'paid' ? 'paid' : 'unpaid',
            paymentMethod: updates.paymentMethod,
            hasBabysitterFee: updates.hasBabysitterFee ?? false,
            babysitterFeeAmount: updates.hasBabysitterFee
              ? updates.babysitterFeeAmount || defaultBabysitterFee
              : 0,
            hasOfficeRentFee: updates.hasOfficeRentFee ?? false,
            officeRentFeeAmount: updates.hasOfficeRentFee
              ? updates.officeRentFeeAmount || defaultOfficeRentFee
              : 0
          }
        }
      ]
    };
  }

  return {
    reply:
      'Komutunuzu aldım ancak hangi danışan için işlem yapılacağını belirleyemedim. Lütfen danışan adını belirterek tekrar söyleyin. Örn: *"Ahmet Yılmaz seans tamamlandı, ödemesi alındı, fiyatı 1500, bakıcı parası var, ofis kirası yok"*',
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

  // Filter sessions relevant to the current screen so the assistant sees what the user sees
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

  // Dynamic context label shown in header
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

  // Sample client name from current view for helpful quick command examples
  const exampleClientName = useMemo(() => {
    if (selectedClientName) return selectedClientName;
    const dayMatch = sessions.find(s => !s.isDeleted && s.date === selectedDate && s.clientName);
    if (dayMatch) return dayMatch.clientName;
    const monthMatch = pageRelevantSessions.find(s => s.clientName && s.type !== 'cancelled');
    if (monthMatch) return monthMatch.clientName;
    return 'Ahmet Yılmaz';
  }, [selectedClientName, sessions, selectedDate, pageRelevantSessions]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome_msg',
      role: 'assistant',
      content: `Merhaba! Bulunduğunuz sayfadaki seansları ve muhasebe verilerini görebiliyorum. Bana sesli veya yazılı olarak komut verebilirsiniz.\n\n**Örnek Komut:**\n*"${exampleClientName} seans tamamlandı, ödemesi alındı, fiyatı ${settings.defaultSessionPrice || 1200} TL, bakıcı parası var, ofis kirası yok"*`,
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
    if (!voiceReplyEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
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

  // Execute structured actions synchronously and deterministically
  const executeAssistantActions = (actions: AssistantAction[]): AppliedChangeRecord | undefined => {
    if (!Array.isArray(actions) || actions.length === 0) return undefined;

    const previousSnapshot = [...sessions];
    const detailLines: string[] = [];
    let modifiedCount = 0;

    for (const action of actions) {
      if (action.actionType === 'UPDATE_SESSIONS' && action.updates) {
        const u = action.updates;
        const matchedIds = new Set<string>(Array.isArray(action.sessionIds) ? action.sessionIds : []);

        const hasValidId = sessions.some(s => matchedIds.has(s.id));
        if (!hasValidId && action.clientName) {
          const clientMatches = sessions.filter(
            s => !s.isDeleted && areClientNamesEquivalent(s.clientName, action.clientName!)
          );
          let candidates = clientMatches;
          if (action.targetDate) {
            const onDate = clientMatches.filter(s => s.date === action.targetDate);
            if (onDate.length > 0) candidates = onDate;
          } else if (activeTab === 'agenda' && agendaViewMode === 'day') {
            const onSelected = clientMatches.filter(s => s.date === selectedDate);
            if (onSelected.length > 0) candidates = onSelected;
          } else {
            const inMonth = clientMatches.filter(s => s.date.startsWith(visibleMonthKey));
            if (inMonth.length > 0) candidates = inMonth;
          }

          if (
            action.applyToScope !== 'visible_period' &&
            action.applyToScope !== 'all' &&
            candidates.length > 1
          ) {
            const refDate = action.targetDate || selectedDate;
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

        // Precompute updated sessions synchronously so detailLines and modifiedCount are immediately ready
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
          date: ns.date || selectedDate,
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
          officeRentFeeAmount: hasOffice ? ns.officeRentFeeAmount || settings.defaultOfficeRentFee : 0,
          notes: ns.notes || '',
          isManuallyEdited: true,
          updatedAt: Date.now()
        };
        onSaveSession(created);
        modifiedCount++;
        const changeBadges: string[] = [
          `Ücret: ₺${created.price.toLocaleString('tr-TR')}`,
          created.paymentStatus === 'paid' ? 'Ödendi ✓' : 'Ödenmedi',
          created.hasBabysitterFee ? `Bakıcı: Var (₺${created.babysitterFeeAmount})` : 'Bakıcı: Yok',
          created.hasOfficeRentFee ? `Ofis Kirası: Var (₺${created.officeRentFeeAmount})` : 'Ofis Kirası: Yok'
        ];
        detailLines.push(
          `Yeni Seans: ${created.clientName} (${created.date} ${created.time}) → ${changeBadges.join(' • ')}`
        );
      } else if (action.actionType === 'MARK_CLIENT_ALL_PAID' && action.clientName) {
        onMarkClientAllPaid(action.clientName, action.updates?.paymentMethod);
        modifiedCount++;
        detailLines.push(`${action.clientName} danışanının tüm bekleyen seans ödemeleri tahsil edildi.`);
      } else if (action.actionType === 'ADD_EXPENSE' && action.newExpense) {
        onAddExpense({
          title: action.newExpense.title || 'Klinik Gideri',
          amount: Number(action.newExpense.amount) || 0,
          category: (action.newExpense.category as any) || 'other',
          date: action.newExpense.date || selectedDate
        });
        modifiedCount++;
        detailLines.push(`Yeni Gider Eklendi: ${action.newExpense.title} (₺${action.newExpense.amount})`);
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
      selectedClientName,
      defaultSessionPrice: settings.defaultSessionPrice,
      defaultOnlinePrice: settings.defaultOnlinePrice || settings.defaultSessionPrice,
      defaultFaceToFacePrice: settings.defaultFaceToFacePrice || settings.defaultSessionPrice,
      defaultBabysitterFee: settings.defaultBabysitterFee,
      defaultOfficeRentFee: settings.defaultOfficeRentFee
    };

    // Always compute deterministic local result first so we have an instant, zero-failure fallback
    const localResult = processClientCommandLocally(
      textToSend,
      pageContext,
      pageRelevantSessions,
      sessions
    );

    let replyText = localResult.reply;
    let actions: AssistantAction[] = localResult.actions;

    // If local parser didn't find a concrete session update action, or to enrich Q&A, query backend with a fast timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      const compactPayloadSessions = pageRelevantSessions.slice(0, 75).map(s => ({
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
        } else if (localResult.actions.length === 0 && data.reply) {
          replyText = data.reply;
        }
      }
    } catch (err) {
      // Silently fall back to localResult — never show a connection error to the user
      console.warn('Backend assistant unreachable or timed out, using local command engine:', err);
    }

    try {
      const appliedRecord = executeAssistantActions(actions);

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
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
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
      `${baseClient} seans tamamlandı, ödemesi alındı, fiyatı ${defPrice}, bakıcı parası var, ofis kirası yok`,
      `${baseClient} ödemesi nakit alındı`,
      `Bu ekrandaki seans ve gelir özetini söyle`
    ];
  }, [exampleClientName, settings.defaultSessionPrice]);

  return (
    <>
      {/* Floating Action Buttons (Accessible on EVERY page) */}
      <div className="fixed bottom-5 right-4 sm:right-6 z-40 flex items-center gap-2">
        {/* Direct 1-Tap Voice Command Mic Button */}
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

        {/* Main Chatbot & Voice Assistant Launcher */}
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
                    voiceReplyEnabled ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10'
                  }`}
                >
                  {voiceReplyEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
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
                Mikrofona basıp <span className="font-semibold text-[#6b705c]">danışan adı, ücret, ödendi, bakıcı ve ofis kirası</span> bilgilerini söyleyebilirsiniz.
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

                    {/* Visual Confirmation Card for Applied Session Updates */}
                    {msg.appliedChanges && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 bg-emerald-50/70 rounded-xl p-2.5 border border-emerald-200/70">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            {msg.appliedChanges.undone ? 'İşlem Geri Alındı' : msg.appliedChanges.description}
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
                                msg.appliedChanges?.undone ? 'line-through text-slate-400' : 'text-emerald-900'
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

              {/* Interim Live Speech Bubble */}
              {isListening && (
                <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-2.5 rounded-2xl text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping shrink-0" />
                  <div className="flex-1">
                    <span className="font-bold block text-[11px] text-rose-700">Dinleniyor (Türkçe)...</span>
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
                  placeholder={`${exampleClientName} seans tamamlandı, ödendi...`}
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
