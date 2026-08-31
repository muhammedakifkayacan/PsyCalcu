import { Session, SessionType } from '../types';

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
  const rawValue = colonIdx !== -1 ? rawLine.substring(colonIdx + 1).trim() : rawLine.trim();
  const cleanValue = rawValue.replace(/[-:]/g, ''); // e.g. 20260815T110000Z or 20260815T140000 or 20260815

  if (cleanValue.length < 8) return null;

  const isUtc = cleanValue.endsWith('Z') || rawLine.includes('Z');
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
    const dateObj = new Date(utcMs);

    try {
      // Format to target local timezone (Europe/Istanbul UTC+3)
      const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: targetTimezone || 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      // Output format in 'sv-SE': "YYYY-MM-DD HH:mm"
      const formatted = formatter.format(dateObj);
      const parts = formatted.split(' ');
      if (parts.length === 2) {
        return {
          dateStr: parts[0],
          timeStr: parts[1],
          utcMs
        };
      }
    } catch (e) {
      // Fallback if timezone conversion fails
    }

    const utcDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const utcTimeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return { dateStr: utcDateStr, timeStr: utcTimeStr, utcMs };
  } else {
    // Local time string
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
  const maxSafety = 350; // Safety guard for infinite loop prevention

  while (countProcessed < maxSafety) {
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
      currDate.setDate(currDate.getDate() + rrule.interval);
    } else if (rrule.freq === 'WEEKLY') {
      if (rrule.byDay && rrule.byDay.length > 1) {
        currDate.setDate(currDate.getDate() + 1);
      } else {
        currDate.setDate(currDate.getDate() + (7 * rrule.interval));
      }
    } else if (rrule.freq === 'MONTHLY') {
      currDate.setMonth(currDate.getMonth() + rrule.interval);
    } else if (rrule.freq === 'YEARLY') {
      currDate.setFullYear(currDate.getFullYear() + rrule.interval);
    } else {
      break;
    }
  }

  return occurrences;
}

/**
 * Checks whether an event title/summary or description corresponds to a non-session (personal activity, errand, sport, etc.)
 */
export function isNonSessionSummary(summary?: string, description?: string): boolean {
  if (!summary && !description) return false;
  const rawText = `${summary || ''} ${description || ''}`.trim();
  if (!rawText) return false;

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

  const normalized = normalize(rawText);
  const words = normalized.split(' ');

  // Multi-word exact phrases
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

  // Keywords representing non-session personal activities / errands
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
    'yemek', 'kahvalti', 'brunch', 'dinner', 'lunch', 'breakfast', 'cafe', 'kahve', 'cay',
    // Tatil, Seyahat & Dinlenme
    'tatil', 'izin', 'bayram', 'seyahat', 'ucus', 'yolculuk', 'gezi', 'holiday', 'vacation', 'trip', 'otel', 'ucak',
    // Eğlence & Kültür
    'sinema', 'tiyatro', 'konser', 'parti', 'kutlama', 'dugun', 'nikah', 'kina', 'nisan', 'festival', 'sergi', 'muze',
    // Ev, İdari & Günlük İşler
    'temizlik', 'tamir', 'tamirat', 'usta', 'kargo', 'kurye', 'fatura', 'banka', 'noter', 'belediye', 'vergi', 'lastik', 'benzin',
    // Kişisel Notlar & Görevler
    'dinlenme', 'mola', 'kisisel', 'ozel', 'sahsi', 'hatirlatici', 'gorev', 'todo',
    // Eğitim, Toplantı & Dersler
    'toplanti', 'meeting', 'webinar', 'seminer', 'kongre', 'konferans', 'egitim', 'kurs', 'ders', 'sinav', 'okul'
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
  autoMarkShortEvents: boolean = true
): Session[] {
  const sessions: Session[] = [];

  // Remove Byte Order Mark (BOM)
  const cleanText = icsText.replace(/^\uFEFF/, '').replace(/^\uFFFE/, '');
  const normalizedText = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const unfoldedText = normalizedText.replace(/\n[ \t]/g, '');
  const lines = unfoldedText.split('\n');

  // Detect calendar-wide timezone if available
  let calTimezone = 'Europe/Istanbul';
  for (const l of lines) {
    if (l.toUpperCase().startsWith('X-WR-TIMEZONE:')) {
      const tzVal = l.substring(14).trim();
      if (tzVal) calTimezone = tzVal;
      break;
    }
  }

  // Define date window: 60 days in past up to 180 days in future
  const todayObj = new Date();
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(todayObj.getDate() - 60);

  let windowStart = sixtyDaysAgo.toISOString().split('T')[0];
  if (membershipDate) {
    windowStart = membershipDate.split('T')[0];
  }

  const future180Days = new Date();
  future180Days.setDate(todayObj.getDate() + 180);
  const windowEnd = future180Days.toISOString().split('T')[0];

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
        } else if (key === 'EXDATE') {
          const exParsed = parseIcsDateTimeToLocal(line, calTimezone);
          if (exParsed) {
            currentRaw.exdates.add(exParsed.dateStr);
          }
        } else if (key === 'STATUS') {
          currentRaw.statusRaw = cleanVal.toUpperCase();
        }
      }
    }
  }

  // Process raw events into sessions
  for (const raw of rawEvents) {
    if (raw.statusRaw === 'CANCELLED') continue;

    if (!raw.dtStartRaw) continue;
    const startParsed = parseIcsDateTimeToLocal(raw.dtStartRaw, calTimezone);
    if (!startParsed) continue;

    const duration = calculateEventDuration(raw.dtStartRaw, raw.dtEndRaw, raw.durationRaw, calTimezone);

    // Determine type (online, face-to-face, cancelled, or non-session)
    let finalType: SessionType = 'online';

    const searchSource = (
      (raw.summary || '') + ' ' +
      (raw.descriptionRaw || '') + ' ' +
      (raw.locationRaw || '') + ' ' +
      (raw.noteRaw || '')
    ).toLowerCase();

    const isCancelled = searchSource.includes('iptal') || searchSource.includes('cancel');
    const isNonSession = isNonSessionSummary(raw.summary, `${raw.descriptionRaw || ''} ${raw.noteRaw || ''}`);

    if (isCancelled) {
      finalType = 'cancelled';
    } else if (isNonSession) {
      finalType = 'non-session';
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

    // Check if RRULE exists
    let occurrences: { dateStr: string; timeStr: string }[] = [];
    if (raw.rruleRaw) {
      const rruleParsed = parseRruleString(raw.rruleRaw, calTimezone);
      if (rruleParsed) {
        occurrences = generateOccurrences(startParsed, rruleParsed, raw.exdates, windowStart, windowEnd);
      }
    }

    // If no RRULE or RRULE generated 0 occurrences, fallback to single event occurrence
    if (occurrences.length === 0) {
      if (startParsed.dateStr >= windowStart && startParsed.dateStr <= windowEnd && !raw.exdates.has(startParsed.dateStr)) {
        occurrences.push({ dateStr: startParsed.dateStr, timeStr: startParsed.timeStr });
      }
    }

    // Create session for each occurrence
    const membershipCutoff = membershipDate ? membershipDate.split('T')[0] : '';

    for (const occ of occurrences) {
      const isBeforeRegistration = Boolean(membershipCutoff && occ.dateStr < membershipCutoff);

      // Determine financial parameters based on session type
      let price = defaultPrice;
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

      // Generate deterministic ID per occurrence to prevent duplicate session accumulation
      const sessionId = occurrences.length > 1
        ? `ics_${raw.uid}_${occ.dateStr.replace(/-/g, '')}`
        : `ics_${raw.uid}`;

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

  return sessions;
}

/**
 * Generates initial mock sessions if the user has no saved data in localStorage.
 */
export function getInitialMockSessions(defaultPrice: number, defaultBabysitterFee: number, defaultOfficeRentFee: number = 200): Session[] {
  const today = new Date().toISOString().split('T')[0];

  const getOffsetDateString = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
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
