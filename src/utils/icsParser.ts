import { Session, SessionType, ClosedMonthRecord, getNormalizedClientName } from '../types';
import { formatLocalDate, getTodayLocalDate } from './dateUtils';
import { isDateInClosedMonth } from './monthCloseUtils';
import { idbGet, idbSet } from './idbStorage';

interface ParsedRrule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  until?: string; // YYYY-MM-DD
  count?: number;
  byDay?: string[]; // ['MO', 'TU', ...]
}

function parseISO8601Duration(durationStr: string): number | null {
  const regex = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i;
  const match = durationStr.trim().match(regex);
  if (!match) return null;
  const days = parseInt(match[1] || '0', 10);
  const hours = parseInt(match[2] || '0', 10);
  const minutes = parseInt(match[3] || '0', 10);
  const total = days * 1440 + hours * 60 + minutes;
  return total > 0 ? total : null;
}

// Cached formatter map to eliminate expensive Intl.DateTimeFormat constructions in hot loops
const formatterCache = new Map<string, Intl.DateTimeFormat>();
function getCachedFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    formatterCache.set(tz, fmt);
  }
  return fmt;
}

/**
 * Converts any ICS date/time string into a local YYYY-MM-DD and HH:mm object,
 * properly converting UTC (Z) or TZID times into local Turkey / target timezone time!
 */
function parseIcsDateTimeToLocal(
  rawLine: string,
  targetTimezone: string = 'Europe/Istanbul'
): { dateStr: string; timeStr: string; utcMs: number } | null {
  if (!rawLine) return null;

  const colonIdx = rawLine.indexOf(':');
  const rawParamPart = colonIdx !== -1 ? rawLine.substring(0, colonIdx) : '';
  const rawValue = colonIdx !== -1 ? rawLine.substring(colonIdx + 1).trim() : rawLine.trim();
  const cleanValue = rawValue.replace(/[-:]/g, '').trim(); // e.g. 20260815T110000Z or 20260815T140000 or 20260815

  if (cleanValue.length < 8) return null;

  // In RFC 5545, UTC format is designated ONLY by 'Z' at the very END of the date-time value (e.g. 20260815T110000Z).
  // Parameter parts (such as TZID=Europe/Istanbul) contain the letter 'Z' and MUST NOT trigger UTC conversion!
  const isUtc = cleanValue.toUpperCase().endsWith('Z') || rawValue.toUpperCase().endsWith('Z');
  const year = parseInt(cleanValue.substring(0, 4), 10);
  const month = parseInt(cleanValue.substring(4, 6), 10);
  const day = parseInt(cleanValue.substring(6, 8), 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  let hour = 0;
  let minute = 0;
  let second = 0;

  const tIndex = cleanValue.indexOf('T');
  if (tIndex !== -1 && tIndex + 5 <= cleanValue.length) {
    hour = parseInt(cleanValue.substring(tIndex + 1, tIndex + 3), 10) || 0;
    minute = parseInt(cleanValue.substring(tIndex + 3, tIndex + 5), 10) || 0;
    if (tIndex + 7 <= cleanValue.length) {
      second = parseInt(cleanValue.substring(tIndex + 5, tIndex + 7), 10) || 0;
    }
  }

  if (isUtc) {
    const utcMs = Date.UTC(year, month - 1, day, hour, minute, second);

    // Instant zero-cost mathematical conversion for Turkey (Europe/Istanbul):
    // Turkey is permanently UTC+3 with no daylight saving time.
    const effectiveTz = (targetTimezone || 'Europe/Istanbul').toLowerCase();
    if (effectiveTz === 'europe/istanbul' || effectiveTz === 'asia/istanbul' || effectiveTz === 'turkey' || effectiveTz === 'utc+3' || effectiveTz === 'gmt+3') {
      const turkeyMs = utcMs + (3 * 60 * 60 * 1000);
      const tDate = new Date(turkeyMs);
      const y = tDate.getUTCFullYear();
      const m = String(tDate.getUTCMonth() + 1).padStart(2, '0');
      const d = String(tDate.getUTCDate()).padStart(2, '0');
      const h = String(tDate.getUTCHours()).padStart(2, '0');
      const min = String(tDate.getUTCMinutes()).padStart(2, '0');
      return {
        dateStr: `${y}-${m}-${d}`,
        timeStr: `${h}:${min}`,
        utcMs
      };
    }

    try {
      const formatter = getCachedFormatter(targetTimezone || 'Europe/Istanbul');
      const parts = formatter.formatToParts(new Date(utcMs));
      const partMap: Record<string, string> = {};
      for (const p of parts) {
        partMap[p.type] = p.value;
      }
      let h = partMap.hour || String(hour).padStart(2, '0');
      if (h === '24') h = '00';
      const dateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
      const timeStr = `${h}:${partMap.minute || '00'}`;
      return {
        dateStr,
        timeStr,
        utcMs
      };
    } catch (e) {
      // Fallback if timezone conversion fails
    }

    const utcDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const utcTimeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return { dateStr: utcDateStr, timeStr: utcTimeStr, utcMs };
  } else {
    // Check if TZID parameter exists in property
    let tzid: string | null = null;
    if (rawParamPart) {
      const match = rawParamPart.match(/TZID=(?:["']([^"']+)["']|([^;:]+))/i);
      if (match) {
        tzid = (match[1] || match[2] || '').trim().replace(/^["']|["']$/g, '').replace(/^\//, '');
      }
    }

    // If TZID is a foreign timezone (not Turkey/Istanbul and differs from targetTimezone)
    const isLocalTz = !tzid ||
      /^(Europe\/Istanbul|Asia\/Istanbul|Turkey|Turkey Standard Time|UTC\+3|GMT\+3)$/i.test(tzid) ||
      (targetTimezone && tzid.toLowerCase() === targetTimezone.toLowerCase());

    if (!isLocalTz && tzid) {
      try {
        const tempUtc = Date.UTC(year, month - 1, day, hour, minute, second);
        const invDate = new Date(new Date(tempUtc).toLocaleString('en-US', { timeZone: tzid }));
        const offsetDiff = tempUtc - invDate.getTime();
        const actualUtcMs = tempUtc + offsetDiff;

        const effectiveTz = (targetTimezone || 'Europe/Istanbul').toLowerCase();
        if (effectiveTz === 'europe/istanbul' || effectiveTz === 'asia/istanbul' || effectiveTz === 'turkey') {
          const turkeyMs = actualUtcMs + (3 * 60 * 60 * 1000);
          const tDate = new Date(turkeyMs);
          const y = tDate.getUTCFullYear();
          const m = String(tDate.getUTCMonth() + 1).padStart(2, '0');
          const d = String(tDate.getUTCDate()).padStart(2, '0');
          const h = String(tDate.getUTCHours()).padStart(2, '0');
          const min = String(tDate.getUTCMinutes()).padStart(2, '0');
          return {
            dateStr: `${y}-${m}-${d}`,
            timeStr: `${h}:${min}`,
            utcMs: actualUtcMs
          };
        }

        const formatter = getCachedFormatter(targetTimezone || 'Europe/Istanbul');
        const parts = formatter.formatToParts(new Date(actualUtcMs));
        const partMap: Record<string, string> = {};
        for (const p of parts) {
          partMap[p.type] = p.value;
        }
        let h = partMap.hour || String(hour).padStart(2, '0');
        if (h === '24') h = '00';
        return {
          dateStr: `${partMap.year}-${partMap.month}-${partMap.day}`,
          timeStr: `${h}:${partMap.minute || '00'}`,
          utcMs: actualUtcMs
        };
      } catch (e) {
        // Fallback to direct local extraction below
      }
    }

    // Local time string (Europe/Istanbul or matching local timezone)
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const utcMs = Date.UTC(year, month - 1, day, hour, minute, second);
    return { dateStr, timeStr, utcMs };
  }
}

function calculateEventDuration(
  dtStartRaw?: string,
  dtEndRaw?: string,
  durationRaw?: string,
  targetTimezone: string = 'Europe/Istanbul'
): number {
  if (durationRaw) {
    const parsed = parseISO8601Duration(durationRaw);
    if (parsed && parsed > 0) return parsed;
  }

  if (dtStartRaw && dtEndRaw) {
    const startObj = parseIcsDateTimeToLocal(dtStartRaw, targetTimezone);
    const endObj = parseIcsDateTimeToLocal(dtEndRaw, targetTimezone);
    if (startObj && endObj && endObj.utcMs > startObj.utcMs) {
      const diffMins = Math.round((endObj.utcMs - startObj.utcMs) / (1000 * 60));
      if (diffMins > 0) return diffMins;
    }
  }

  return 50; // Default fallback duration in minutes
}

function parseRruleString(rruleStr: string, calTimezone: string): ParsedRrule | null {
  const cleanStr = rruleStr.replace(/^RRULE:/i, '').trim();
  if (!cleanStr) return null;

  const parts = cleanStr.split(';');
  let freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | null = null;
  let interval = 1;
  let until: string | undefined;
  let count: number | undefined;
  let byDay: string[] | undefined;

  for (const part of parts) {
    const [key, val] = part.split('=');
    if (!key || !val) continue;
    const uKey = key.toUpperCase();
    const uVal = val.toUpperCase();

    if (uKey === 'FREQ') {
      if (['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(uVal)) {
        freq = uVal as any;
      }
    } else if (uKey === 'INTERVAL') {
      interval = parseInt(uVal, 10) || 1;
    } else if (uKey === 'COUNT') {
      count = parseInt(uVal, 10);
    } else if (uKey === 'UNTIL') {
      const parsedUntil = parseIcsDateTimeToLocal(uVal, calTimezone);
      if (parsedUntil) {
        until = parsedUntil.dateStr;
      }
    } else if (uKey === 'BYDAY') {
      byDay = uVal.split(',').map(d => d.trim().substring(d.length - 2)); // e.g. '2TU' -> 'TU'
    }
  }

  if (!freq) return null;
  return { freq, interval, until, count, byDay };
}

function generateOccurrences(
  startParsed: { dateStr: string; timeStr: string },
  rrule: ParsedRrule,
  exdates: Set<string>,
  windowStart: string,
  windowEnd: string
): { dateStr: string; timeStr: string }[] {
  const occurrences: { dateStr: string; timeStr: string }[] = [];
  const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  const [sY, sM, sD] = startParsed.dateStr.split('-').map(Number);
  let currDate = new Date(sY, sM - 1, sD);
  let countProcessed = 0;
  let totalIterations = 0;
  const maxIterations = 5000; // Absolute safety cap to prevent CPU lockup
  const maxSafety = 2500; // Safety guard for multi-year recurrence history
  const interval = Math.max(1, Number(rrule.interval) || 1);

  while (countProcessed < maxSafety && totalIterations < maxIterations) {
    totalIterations++;
    if (isNaN(currDate.getTime())) break;

    const currYear = currDate.getFullYear();
    const currMonth = String(currDate.getMonth() + 1).padStart(2, '0');
    const currDay = String(currDate.getDate()).padStart(2, '0');
    const currDateStr = `${currYear}-${currMonth}-${currDay}`;

    // Stop if past UNTIL or past windowEnd
    if (rrule.until && currDateStr > rrule.until) break;
    if (currDateStr > windowEnd) break;

    // Check count limit
    if (rrule.count !== undefined && countProcessed >= rrule.count) break;

    let isMatch = true;
    if (rrule.freq === 'WEEKLY' && rrule.byDay && rrule.byDay.length > 0) {
      const dayNum = currDate.getDay();
      const matchDay = rrule.byDay.some(d => dayMap[d] === dayNum);
      if (!matchDay) isMatch = false;
    }

    if (isMatch) {
      countProcessed++;
      if (currDateStr >= windowStart && !exdates.has(currDateStr)) {
        occurrences.push({ dateStr: currDateStr, timeStr: startParsed.timeStr });
      }
    }

    // Step to next candidate date
    if (rrule.freq === 'DAILY') {
      currDate.setDate(currDate.getDate() + interval);
    } else if (rrule.freq === 'WEEKLY') {
      if (rrule.byDay && rrule.byDay.length > 0) {
        currDate.setDate(currDate.getDate() + 1);
      } else {
        currDate.setDate(currDate.getDate() + (7 * interval));
      }
    } else if (rrule.freq === 'MONTHLY') {
      currDate.setMonth(currDate.getMonth() + interval);
    } else if (rrule.freq === 'YEARLY') {
      currDate.setFullYear(currDate.getFullYear() + interval);
    } else {
      break;
    }
  }

  return occurrences;
}

/**
 * Checks whether an event title/summary corresponds to a non-session (personal activity, errand, sport, etc.)
 * Note: Keywords are strictly checked against the title/summary only, so that client notes in description don't falsely trigger non-session.
 */
export function isNonSessionSummary(summary?: string, description?: string): boolean {
  const titleText = (summary || '').trim();
  const descText = (description || '').trim();
  if (!titleText && !descText) return false;

  // Direct hashtag check (supports #seansdeğil, #seansdegil, #seansdisi, #seansdışı in title or description)
  const titleLower = titleText.toLocaleLowerCase('tr-TR');
  const descLower = descText.toLocaleLowerCase('tr-TR');
  const hasExplicitHashtag =
    titleLower.includes('#seansdeğil') ||
    titleLower.includes('#seansdegil') ||
    titleLower.includes('#seans-degil') ||
    titleLower.includes('#seans_degil') ||
    titleLower.includes('#seansdisi') ||
    titleLower.includes('#seansdışı') ||
    titleLower.includes('#seans-disi') ||
    titleLower.includes('#seans_disi') ||
    titleLower.includes('#kisisel') ||
    titleLower.includes('#kişisel') ||
    titleLower.includes('#nonsession') ||
    descLower.includes('#seansdeğil') ||
    descLower.includes('#seansdegil') ||
    descLower.includes('#seansdisi') ||
    descLower.includes('#seansdışı') ||
    descLower.includes('#nonsession');

  if (hasExplicitHashtag) {
    return true;
  }

  // All other keyword and phrase matching is STRICTLY applied to title/summary only!
  if (!titleText) return false;

  const normalize = (str: string) =>
    str
      .toLocaleLowerCase('tr-TR')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normalized = normalize(titleText);
  const words = normalized.split(' ');

  // Multi-word exact phrases (checked on title only)
  const exactPhrases = [
    'seans degil',
    'seans disi',
    'kisisel etkinlik',
    'kisisel is',
    'dis randevusu',
    'saglik ocagi',
    'fizik tedavi',
    'kan tahlili',
    'cilt bakimi',
    'oto yikama',
    'ogle yemegi',
    'aksam yemegi',
    'dogum gunu',
    'veli toplantisi',
    'check up',
    'checkup'
  ];

  for (const phrase of exactPhrases) {
    if (normalized.includes(phrase)) return true;
  }

  // Keywords representing non-session personal activities / errands (checked on title only)
  const nonSessionKeywords = new Set([
    // Spor & Egzersiz
    'spor', 'fitness', 'gym', 'pilates', 'yoga', 'antrenman', 'idman', 'yuruyus', 'kosu', 'yuzme', 'crossfit', 'boks', 'tenis', 'padel', 'mac',
    // Alışveriş & İhtiyaç
    'alisveris', 'market', 'bakkal', 'pazar', 'carsi', 'shopping', 'avm', 'migros', 'a101', 'bim', 'sok', 'carrefour',
    // Kişisel Bakım & Güzellik
    'kuafor', 'berber', 'tras', 'sac', 'tirnak', 'manikur', 'pedikur', 'bakim', 'masaj', 'agda', 'solaryum', 'lazer',
    // Sağlık & Tıbbi Randevular
    'doktor', 'disci', 'hastane', 'muayene', 'tahlil', 'asi', 'eczane', 'veteriner', 'vet', 'rontgen',
    // Yemek & Sosyal Buluşmalar
    'yemek', 'kahvalti', 'brunch', 'dinner', 'lunch', 'breakfast', 'cafe', 'kahve', 'cay', 'sohbet', 'muhabbet', 'bulusma', 'arkadas',
    // Tatil, Seyahat & Dinlenme
    'tatil', 'izin', 'bayram', 'seyahat', 'ucus', 'yolculuk', 'gezi', 'holiday', 'vacation', 'trip', 'otel', 'ucak',
    // Eğlence & Kültür
    'sinema', 'tiyatro', 'konser', 'parti', 'kutlama', 'dugun', 'nikah', 'kina', 'nisan', 'festival', 'sergi', 'muze',
    // Ev, İdari & Günlük İşler
    'temizlik', 'tamir', 'tamirat', 'usta', 'kargo', 'kurye', 'fatura', 'banka', 'noter', 'belediye', 'vergi', 'lastik', 'benzin',
    // Kişisel Notlar & Görevler
    'dinlenme', 'mola', 'kisisel', 'ozel', 'sahsi', 'hatirlatici', 'gorev', 'todo',
    // Eğitim, Toplantı & Dersler
    'toplanti', 'meeting', 'webinar', 'seminer', 'kongre', 'konferans', 'egitim', 'kurs', 'ders', 'etut', 'odev', 'tez', 'sinav', 'okul', 'universite', 'fakulte'
  ]);

  for (const word of words) {
    if (nonSessionKeywords.has(word)) return true;
  }

  return false;
}

/**
 * Parses iCalendar (.ics) text format into structured Session objects.
 * Supports Google Calendar, Apple Calendar, Outlook, and all standard RFC 5545 iCal feeds!
 */
export function parseICS(
  icsText: string,
  defaultPrice: number,
  defaultBabysitterFee: number,
  defaultOfficeRentFee: number,
  forcedType?: 'online' | 'face-to-face' | 'rent-income',
  membershipDate?: string | null,
  autoMarkShortEvents: boolean = true,
  accountingStartDate?: string | null,
  closedMonths?: Record<string, ClosedMonthRecord>,
  isInitialCalendarSyncDone: boolean = false,
  defaultOnlinePrice?: number,
  defaultFaceToFacePrice?: number,
  customWindowStart?: string,
  customWindowEnd?: string
): Session[] {
  const sessions: Session[] = [];

  // Single-pass unfold and split to minimize peak memory on iOS WebKit
  const lines = icsText
    .replace(/^\uFEFF|\uFFFE/g, '')
    .replace(/\r?\n[ \t]/g, '')
    .split(/\r?\n/);

  // Detect calendar-wide timezone if available
  let calTimezone = 'Europe/Istanbul';
  for (const l of lines) {
    if (l.toUpperCase().startsWith('X-WR-TIMEZONE:')) {
      const tzVal = l.substring(14).trim();
      if (tzVal) calTimezone = tzVal;
      break;
    }
  }

  const todayObj = new Date();
  const past30DaysObj = new Date(todayObj);
  past30DaysObj.setDate(todayObj.getDate() - 30);
  const rolling30DaysStart = formatLocalDate(past30DaysObj);

  const future365Days = new Date();
  future365Days.setDate(todayObj.getDate() + 365);
  const defaultFutureEnd = formatLocalDate(future365Days);

  // DATE WINDOW:
  // 1. İlk tam takvim aktarımında veya "Tüm Takvimi Baştan Eşitle" modunda (!isInitialCalendarSyncDone):
  //    Tüm geçmiş (2010+) ve gelecek eksiksiz taranır.
  // 2. Ajanda görünüm bazlı sorguda (customWindowStart / customWindowEnd verildiğinde):
  //    Günlük görünümde o gün, haftalık görünümde o hafta, aylık görünümde o ay taranır!
  const windowStart = isInitialCalendarSyncDone
    ? (customWindowStart || rolling30DaysStart)
    : '2010-01-01';

  const windowEnd = isInitialCalendarSyncDone
    ? (customWindowEnd || defaultFutureEnd)
    : defaultFutureEnd;

  interface RawEvent {
    uid: string;
    summary: string;
    dtStartRaw?: string;
    dtEndRaw?: string;
    durationRaw?: string;
    descriptionRaw?: string;
    locationRaw?: string;
    noteRaw?: string;
    rruleRaw?: string;
    recurrenceIdRaw?: string;
    exdates: Set<string>;
    statusRaw?: string;
  }

  let currentRaw: RawEvent | null = null;
  const rawEvents: RawEvent[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const upperLine = line.toUpperCase();
    if (upperLine === 'BEGIN:VEVENT' || upperLine.startsWith('BEGIN:VEVENT')) {
      currentRaw = {
        uid: 'ics_' + Math.random().toString(36).substring(2, 11),
        summary: 'İsimsiz Seans',
        exdates: new Set<string>()
      };
    } else if ((upperLine === 'END:VEVENT' || upperLine.startsWith('END:VEVENT')) && currentRaw) {
      rawEvents.push(currentRaw);
      currentRaw = null;
    } else if (currentRaw) {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const keyPart = line.substring(0, colonIndex);
        const valPart = line.substring(colonIndex + 1).trim();
        const key = keyPart.split(';')[0].toUpperCase();

        const cleanVal = valPart
          .replace(/\\,/g, ',')
          .replace(/\\;/g, ';')
          .replace(/\\n/gi, '\n');

        if (key === 'SUMMARY') {
          currentRaw.summary = cleanVal || 'İsimsiz Seans';
        } else if (key === 'UID') {
          currentRaw.uid = cleanVal.replace(/[^a-zA-Z0-9_\-]/g, '').substring(0, 50) || currentRaw.uid;
        } else if (key === 'DTSTART') {
          currentRaw.dtStartRaw = line;
        } else if (key === 'DTEND') {
          currentRaw.dtEndRaw = line;
        } else if (key === 'DURATION') {
          currentRaw.durationRaw = cleanVal;
        } else if (key === 'DESCRIPTION') {
          currentRaw.descriptionRaw = cleanVal;
        } else if (key === 'NOTE' || key === 'COMMENT') {
          currentRaw.noteRaw = cleanVal;
        } else if (key === 'LOCATION') {
          currentRaw.locationRaw = cleanVal;
        } else if (key === 'RRULE') {
          currentRaw.rruleRaw = line;
        } else if (key === 'RECURRENCE-ID') {
          currentRaw.recurrenceIdRaw = line;
        } else if (key === 'EXDATE') {
          // EXDATE can contain multiple comma-separated dates (RFC 5545)
          const dateItems = valPart.split(',');
          for (const item of dateItems) {
            const trimmedItem = item.trim();
            if (!trimmedItem) continue;
            const syntheticProp = keyPart + ':' + trimmedItem;
            const exParsed = parseIcsDateTimeToLocal(syntheticProp, calTimezone);
            if (exParsed) {
              currentRaw.exdates.add(exParsed.dateStr);
            } else {
              const cleanDigits = trimmedItem.replace(/[-:]/g, '');
              if (cleanDigits.length >= 8) {
                const y = cleanDigits.substring(0, 4);
                const m = cleanDigits.substring(4, 6);
                const d = cleanDigits.substring(6, 8);
                currentRaw.exdates.add(`${y}-${m}-${d}`);
              }
            }
          }
        } else if (key === 'STATUS') {
          currentRaw.statusRaw = cleanVal.toUpperCase();
        }
      }
    }
  }

  // Cross-event EXDATE and RECURRENCE-ID resolution:
  // Only needed for UIDs that actually have a master RRULE event!
  const rruleUids = new Set<string>();
  for (const raw of rawEvents) {
    if (raw.rruleRaw) {
      rruleUids.add(raw.uid);
    }
  }

  if (rruleUids.size > 0) {
    const uidToExdates = new Map<string, Set<string>>();
    for (const raw of rawEvents) {
      if (!rruleUids.has(raw.uid)) continue;
      let set = uidToExdates.get(raw.uid);
      if (!set) {
        set = new Set<string>();
        uidToExdates.set(raw.uid, set);
      }
      raw.exdates.forEach(d => set!.add(d));

      if (raw.recurrenceIdRaw) {
        const recParsed = parseIcsDateTimeToLocal(raw.recurrenceIdRaw, calTimezone);
        if (recParsed) {
          set.add(recParsed.dateStr);
        } else {
          const colonIdx = raw.recurrenceIdRaw.indexOf(':');
          const val = colonIdx !== -1 ? raw.recurrenceIdRaw.substring(colonIdx + 1).trim() : raw.recurrenceIdRaw.trim();
          const clean = val.replace(/[-:]/g, '');
          if (clean.length >= 8) {
            set.add(`${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`);
          }
        }
      }
    }

    for (const raw of rawEvents) {
      if (raw.rruleRaw) {
        const allEx = uidToExdates.get(raw.uid);
        if (allEx) {
          allEx.forEach(d => raw.exdates.add(d));
        }
      }
    }
  }

  const localNotesToCache: Record<string, string> = {};
  let hasAnyLocalNoteToCache = false;

  // Process raw events into sessions
  for (const raw of rawEvents) {
    if (raw.statusRaw === 'CANCELLED') continue;
    if (!raw.dtStartRaw) continue;

    const startParsed = parseIcsDateTimeToLocal(raw.dtStartRaw, calTimezone);
    if (!startParsed) continue;

    // FAST-SKIP: Check date window and closedMonths BEFORE running any string/keyword/duration calculations!
    let occurrences: { dateStr: string; timeStr: string }[] = [];
    let hadValidRrule = false;
    if (raw.rruleRaw) {
      const rruleParsed = parseRruleString(raw.rruleRaw, calTimezone);
      if (rruleParsed) {
        hadValidRrule = true;
        if (rruleParsed.until && rruleParsed.until < windowStart) {
          continue;
        }
        const rawOccs = generateOccurrences(startParsed, rruleParsed, raw.exdates, windowStart, windowEnd);
        for (let i = 0; i < rawOccs.length; i++) {
          const occ = rawOccs[i];
          if (isInitialCalendarSyncDone && closedMonths && isDateInClosedMonth(occ.dateStr, closedMonths)) continue;
          occurrences.push(occ);
        }
      }
    }

    if (!hadValidRrule) {
      const dStr = startParsed.dateStr;
      if (dStr < windowStart || dStr > windowEnd || raw.exdates.has(dStr)) {
        continue;
      }
      if (isInitialCalendarSyncDone && closedMonths && isDateInClosedMonth(dStr, closedMonths)) {
        continue;
      }
      occurrences.push({ dateStr: dStr, timeStr: startParsed.timeStr });
    }

    if (occurrences.length === 0) continue;

    const duration = calculateEventDuration(raw.dtStartRaw, raw.dtEndRaw, raw.durationRaw, calTimezone);

    // Determine type (online, face-to-face, cancelled, or non-session)
    let finalType: SessionType = 'online';

    const searchSource = (
      (raw.summary || '') + ' ' +
      (raw.descriptionRaw || '') + ' ' +
      (raw.locationRaw || '') + ' ' +
      (raw.noteRaw || '')
    ).toLowerCase();

    const summaryLower = (raw.summary || '').toLowerCase();
    const isCancelled = raw.statusRaw === 'CANCELLED' || 
      summaryLower.includes('iptal') || 
      summaryLower.includes('cancel') ||
      summaryLower.includes('#iptal') ||
      searchSource.includes('#iptal');
    const isNonSession = isNonSessionSummary(raw.summary, `${raw.descriptionRaw || ''} ${raw.noteRaw || ''}`);

    // Explicit online keywords in session title/notes take highest precedence:
    // "online", "zoom", "skype", "meet", "görüntülü", "uzaktan" -> ALWAYS ONLINE
    const isExplicitOnline = summaryLower.includes('online') || 
      summaryLower.includes('zoom') || 
      summaryLower.includes('skype') || 
      summaryLower.includes('meet') || 
      summaryLower.includes('görüntülü') || 
      summaryLower.includes('uzaktan') ||
      (searchSource.includes('#online') || searchSource.includes('[online]'));

    const isExplicitFaceToFace = summaryLower.includes('yüzyüze') || 
      summaryLower.includes('yüz yüze') || 
      summaryLower.includes('yuz yuze') || 
      summaryLower.includes('klinik') ||
      summaryLower.includes('ofiste');

    if (isCancelled) {
      finalType = 'cancelled';
    } else if (isNonSession) {
      finalType = 'non-session';
    } else if (isExplicitOnline) {
      finalType = 'online';
    } else if (isExplicitFaceToFace) {
      finalType = 'face-to-face';
    } else if (forcedType) {
      finalType = forcedType;
    } else {
      if (searchSource.includes('yüzyüze') || searchSource.includes('yüz yüze') || searchSource.includes('ofis') || searchSource.includes('klinik') || searchSource.includes('face')) {
        finalType = 'face-to-face';
      }
    }

    if (autoMarkShortEvents && duration <= 30 && finalType !== 'cancelled') {
      finalType = 'non-session';
    }

    // Notes
    const notesParts: string[] = [];
    if (raw.descriptionRaw) notesParts.push(raw.descriptionRaw);
    if (raw.noteRaw) notesParts.push(raw.noteRaw);
    if (raw.locationRaw) notesParts.push(`Konum: ${raw.locationRaw}`);
    const notesStr = notesParts.length > 0 ? notesParts.join('\n') : undefined;

    // Optional user membership / accounting cutoff date (only active if explicitly provided)
    const effectiveAccountingCutoff = ((accountingStartDate && accountingStartDate.trim()) 
      ? accountingStartDate.split('T')[0] 
      : '') || ((membershipDate && membershipDate.trim()) 
      ? membershipDate.split('T')[0] 
      : '');

    // Pure clinical note (without generic "Konum: ..." room/platform labels) for local IndexedDB note cache
    const cleanClinicalNote = (raw.descriptionRaw || raw.noteRaw || '').trim();
    const normClientForNote = cleanClinicalNote ? getNormalizedClientName(raw.summary || '') : '';

    for (const occ of occurrences) {
      // Generate deterministic ID per occurrence
      const hasRecurrence = Boolean(raw.rruleRaw || raw.recurrenceIdRaw || occurrences.length > 1);
      const sessionId = hasRecurrence
        ? `ics_${raw.uid}_${occ.dateStr.replace(/-/g, '')}`
        : `ics_${raw.uid}`;

      // Cache clinical notes in local-only IndexedDB for valid occurrences in window
      if (cleanClinicalNote && occ.dateStr >= windowStart) {
        hasAnyLocalNoteToCache = true;
        localNotesToCache[sessionId] = cleanClinicalNote;
        if (normClientForNote && occ.dateStr) {
          localNotesToCache[`client_d:${normClientForNote}_${occ.dateStr}`] = cleanClinicalNote;
        }
      }

      const closedMonthRec = closedMonths && occ.dateStr ? closedMonths[occ.dateStr.slice(0, 7)] : undefined;
      const isClosedMonthWithIncome = Boolean(closedMonthRec && (Number(closedMonthRec.totalIncome) || 0) > 0);
      const isBeforeRegistration = Boolean(
        occ.dateStr &&
        effectiveAccountingCutoff &&
        occ.dateStr < effectiveAccountingCutoff &&
        !isClosedMonthWithIncome
      );

      // Determine financial parameters based on session type
      let price = defaultPrice;
      if (finalType === 'online' && typeof defaultOnlinePrice === 'number' && defaultOnlinePrice > 0) {
        price = defaultOnlinePrice;
      } else if (finalType === 'face-to-face' && typeof defaultFaceToFacePrice === 'number' && defaultFaceToFacePrice > 0) {
        price = defaultFaceToFacePrice;
      }
      let hasBabysitterFee = true;
      let babysitterFeeAmount = defaultBabysitterFee;
      let hasOfficeRentFee = finalType === 'face-to-face';
      let officeRentFeeAmount = finalType === 'face-to-face' ? defaultOfficeRentFee : 0;
      let paymentStatus: 'paid' | 'unpaid' = 'unpaid';

      if (isBeforeRegistration) {
        price = 0;
        paymentStatus = 'paid';
        hasBabysitterFee = false;
        babysitterFeeAmount = 0;
        hasOfficeRentFee = false;
        officeRentFeeAmount = 0;
      } else if (finalType === 'cancelled' || finalType === 'non-session') {
        price = 0;
        hasBabysitterFee = false;
        babysitterFeeAmount = 0;
        hasOfficeRentFee = false;
        officeRentFeeAmount = 0;
      } else if (finalType === 'rent-income') {
        price = defaultOfficeRentFee;
        hasBabysitterFee = false;
        babysitterFeeAmount = 0;
        hasOfficeRentFee = false;
        officeRentFeeAmount = 0;
      }

      const sessionItem: Session = {
        id: sessionId,
        clientName: raw.summary || 'İsimsiz Seans',
        type: finalType,
        date: occ.dateStr,
        time: occ.timeStr,
        duration: duration,
        price: price,
        hasBabysitterFee: hasBabysitterFee,
        babysitterFeeAmount: babysitterFeeAmount,
        hasOfficeRentFee: hasOfficeRentFee,
        officeRentFeeAmount: officeRentFeeAmount,
        paymentStatus: paymentStatus,
        notes: notesStr,
        isSyncedFromCalendar: true,
        syncedCalendarType: forcedType
      };

      sessions.push(sessionItem);
    }
  }

  if (typeof window !== 'undefined' && hasAnyLocalNoteToCache) {
    try {
      idbGet<Record<string, string>>('psycalcu_local_ics_notes')
        .then(existingMap => {
          const merged = { ...(existingMap || {}), ...localNotesToCache };
          return idbSet('psycalcu_local_ics_notes', merged);
        })
        .catch(() => {});
    } catch (e) {}
  }

  return sessions;
}

/**
 * Generates initial mock sessions if the user has no saved data in localStorage.
 */
export function getInitialMockSessions(defaultPrice: number, defaultBabysitterFee: number, defaultOfficeRentFee: number = 200): Session[] {
  const today = getTodayLocalDate();

  const getOffsetDateString = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return formatLocalDate(d);
  };

  const yesterday = getOffsetDateString(-1);
  const tomorrow = getOffsetDateString(1);

  return [
    {
      id: 'mock_1',
      clientName: 'Ahmet Yılmaz',
      type: 'online',
      date: today,
      time: '09:00',
      duration: 50,
      price: defaultPrice,
      hasBabysitterFee: true,
      babysitterFeeAmount: defaultBabysitterFee,
      hasOfficeRentFee: false,
      officeRentFeeAmount: 0,
      notes: 'Bireysel Terapi seansı.',
      isSyncedFromCalendar: true,
      syncedCalendarType: 'online'
    },
    {
      id: 'mock_2',
      clientName: 'Selin Demir',
      type: 'face-to-face',
      date: today,
      time: '11:30',
      duration: 50,
      price: 1800,
      hasBabysitterFee: true,
      babysitterFeeAmount: defaultBabysitterFee,
      hasOfficeRentFee: true,
      officeRentFeeAmount: defaultOfficeRentFee,
      notes: 'Çift Terapisi - Ofis B',
      isSyncedFromCalendar: true,
      syncedCalendarType: 'face-to-face'
    },
    {
      id: 'mock_3',
      clientName: 'Mert Aras',
      type: 'cancelled',
      date: today,
      time: '14:00',
      duration: 50,
      price: 0,
      hasBabysitterFee: false,
      babysitterFeeAmount: 0,
      hasOfficeRentFee: false,
      officeRentFeeAmount: 0,
      notes: 'Danışan tarafından iptal edildi',
      isSyncedFromCalendar: true,
      syncedCalendarType: 'online'
    },
    {
      id: 'mock_4',
      clientName: 'Canan Aksoy',
      type: 'online',
      date: today,
      time: '16:30',
      duration: 50,
      price: defaultPrice,
      hasBabysitterFee: true,
      babysitterFeeAmount: defaultBabysitterFee,
      hasOfficeRentFee: false,
      officeRentFeeAmount: 0,
      notes: 'Bireysel Terapi',
      isSyncedFromCalendar: true,
      syncedCalendarType: 'online'
    },
    {
      id: 'mock_5',
      clientName: 'Zeynep Kaya',
      type: 'online',
      date: yesterday,
      time: '10:00',
      duration: 50,
      price: defaultPrice,
      hasBabysitterFee: true,
      babysitterFeeAmount: defaultBabysitterFee,
      hasOfficeRentFee: false,
      officeRentFeeAmount: 0,
      isSyncedFromCalendar: false,
    },
    {
      id: 'mock_6',
      clientName: 'Hakan Çelik',
      type: 'face-to-face',
      date: yesterday,
      time: '13:00',
      duration: 50,
      price: 1500,
      hasBabysitterFee: true,
      babysitterFeeAmount: defaultBabysitterFee,
      hasOfficeRentFee: true,
      officeRentFeeAmount: defaultOfficeRentFee,
      isSyncedFromCalendar: false,
    },
    {
      id: 'mock_7',
      clientName: 'Ayşe Demir',
      type: 'online',
      date: yesterday,
      time: '15:30',
      duration: 50,
      price: defaultPrice,
      hasBabysitterFee: true,
      babysitterFeeAmount: defaultBabysitterFee,
      hasOfficeRentFee: false,
      officeRentFeeAmount: 0,
      isSyncedFromCalendar: false,
    },
    {
      id: 'mock_8',
      clientName: 'Büşra Şen',
      type: 'face-to-face',
      date: tomorrow,
      time: '11:00',
      duration: 50,
      price: 1500,
      hasBabysitterFee: true,
      babysitterFeeAmount: defaultBabysitterFee,
      hasOfficeRentFee: true,
      officeRentFeeAmount: defaultOfficeRentFee,
      isSyncedFromCalendar: true,
      syncedCalendarType: 'face-to-face'
    },
    {
      id: 'mock_9',
      clientName: 'Ömer Kaya',
      type: 'online',
      date: tomorrow,
      time: '14:30',
      duration: 50,
      price: defaultPrice,
      hasBabysitterFee: true,
      babysitterFeeAmount: defaultBabysitterFee,
      hasOfficeRentFee: false,
      officeRentFeeAmount: 0,
      isSyncedFromCalendar: true,
      syncedCalendarType: 'online'
    }
  ];
}
