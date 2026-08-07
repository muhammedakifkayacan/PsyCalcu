import { Session, SessionType } from '../types';

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

function parseIcsDateTimeToUtcMs(rawLine: string): number | null {
  const firstColon = rawLine.indexOf(':');
  if (firstColon === -1) return null;
  const rawValue = rawLine.substring(firstColon + 1).trim();
  const cleanValue = rawValue.replace(/[-:]/g, '');

  if (cleanValue.length < 8) return null;

  const year = parseInt(cleanValue.substring(0, 4), 10);
  const month = parseInt(cleanValue.substring(4, 6), 10) - 1;
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

  return Date.UTC(year, month, day, hour, minute, second);
}

function calculateEventDuration(
  dtStartRaw?: string,
  dtEndRaw?: string,
  durationRaw?: string
): number {
  if (durationRaw) {
    const parsed = parseISO8601Duration(durationRaw);
    if (parsed && parsed > 0) return parsed;
  }

  if (dtStartRaw && dtEndRaw) {
    const startMs = parseIcsDateTimeToUtcMs(dtStartRaw);
    const endMs = parseIcsDateTimeToUtcMs(dtEndRaw);
    if (startMs !== null && endMs !== null && endMs > startMs) {
      const diffMins = Math.round((endMs - startMs) / (1000 * 60));
      if (diffMins > 0) return diffMins;
    }
  }

  return 50; // Default fallback duration in minutes
}

/**
 * Parses iCalendar (.ics) text format into structured Session objects.
 * This supports real Apple Calendar exports!
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
  
  // Remove Byte Order Mark (BOM) if present
  const cleanText = icsText.replace(/^\uFEFF/, '').replace(/^\uFFFE/, '');

  // Normalize all newlines to standard \n to support CRLF (\r\n), LF (\n) and old Mac CR (\r) line endings.
  const normalizedText = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // RFC 5545 Unfolding: Combine lines split by a newline followed by a space or horizontal tab
  const unfoldedText = normalizedText.replace(/\n[ \t]/g, '');
  const lines = unfoldedText.split('\n');
  
  let currentEvent: Partial<Session> & { 
    dtStartRaw?: string; 
    dtEndRaw?: string; 
    durationRaw?: string; 
    descriptionRaw?: string; 
    locationRaw?: string; 
    noteRaw?: string; 
  } | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const upperLine = line.toUpperCase();
    if (upperLine === 'BEGIN:VEVENT' || upperLine.startsWith('BEGIN:VEVENT')) {
      currentEvent = {
        id: 'ics_' + Math.random().toString(36).substr(2, 9),
        clientName: 'İsimsiz Seans',
        type: forcedType || 'online',
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        duration: 50,
        price: defaultPrice,
        hasBabysitterFee: true,
        babysitterFeeAmount: defaultBabysitterFee,
        hasOfficeRentFee: forcedType === 'face-to-face',
        officeRentFeeAmount: forcedType === 'face-to-face' ? defaultOfficeRentFee : 0,
        isSyncedFromCalendar: true,
        syncedCalendarType: forcedType
      };
    } else if ((upperLine === 'END:VEVENT' || upperLine.startsWith('END:VEVENT')) && currentEvent) {
      // Process date and time from dtStartRaw
      if (currentEvent.dtStartRaw) {
        // Find everything after the first colon to get the raw date-time value
        const firstColonIndex = currentEvent.dtStartRaw.indexOf(':');
        const rawValue = firstColonIndex !== -1 ? currentEvent.dtStartRaw.substring(firstColonIndex + 1).trim() : '';
        
        // Remove standard formatting symbols like - and : to normalize
        // e.g. "2026-07-01T18:30:00" -> "20260701T183000"
        const cleanValue = rawValue.replace(/[-:]/g, ''); 
        
        if (cleanValue.length >= 8) {
          const year = cleanValue.substring(0, 4);
          const month = cleanValue.substring(4, 6);
          const day = cleanValue.substring(6, 8);
          currentEvent.date = `${year}-${month}-${day}`;
          
          if (cleanValue.includes('T') && cleanValue.indexOf('T') + 5 <= cleanValue.length) {
            const tIndex = cleanValue.indexOf('T');
            const hour = cleanValue.substring(tIndex + 1, tIndex + 3);
            const minute = cleanValue.substring(tIndex + 3, tIndex + 5);
            currentEvent.time = `${hour}:${minute}`;
          }
        }
      }

      // Calculate event duration in minutes from DTSTART, DTEND or DURATION
      currentEvent.duration = calculateEventDuration(
        currentEvent.dtStartRaw,
        currentEvent.dtEndRaw,
        currentEvent.durationRaw
      );
      
      // Determine type (online or face-to-face) from summary, description or location
      let finalType: SessionType = 'online';
      if (forcedType) {
        finalType = forcedType;
      } else {
        const searchSource = (
          (currentEvent.clientName || '') + ' ' + 
          (currentEvent.descriptionRaw || '') + ' ' + 
          (currentEvent.locationRaw || '') + ' ' + 
          (currentEvent.noteRaw || '')
        ).toLowerCase();
        if (searchSource.includes('yüzyüze') || searchSource.includes('yüz yüze') || searchSource.includes('ofis') || searchSource.includes('klinik') || searchSource.includes('face')) {
          finalType = 'face-to-face';
        } else if (searchSource.includes('iptal') || searchSource.includes('cancel')) {
          finalType = 'cancelled';
        }
      }

      // Duration rule: Events 30 minutes or less from calendar are marked as 'non-session' (seans değil)
      // so they do not impact accounting or financial calculations when autoMarkShortEvents is true.
      if (autoMarkShortEvents && currentEvent.duration && currentEvent.duration <= 30) {
        finalType = 'non-session';
      }

      currentEvent.type = finalType;
      
      // Construct notes from descriptionRaw, noteRaw, locationRaw
      const notesParts: string[] = [];
      if (currentEvent.descriptionRaw) notesParts.push(currentEvent.descriptionRaw);
      if (currentEvent.noteRaw) notesParts.push(currentEvent.noteRaw);
      if (currentEvent.locationRaw) notesParts.push(`Konum: ${currentEvent.locationRaw}`);
      if (notesParts.length > 0) {
        currentEvent.notes = notesParts.join('\n');
      }
      
      // Cutoff check: Only import events from the last 60 days to save on DB writes & performance
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const cutOffDateStr = sixtyDaysAgo.toISOString().split('T')[0];

      if (currentEvent.date && currentEvent.date < cutOffDateStr) {
        currentEvent = null;
        continue;
      }
      
      // Determine if this is a session before membership date OR in a past month (if no membership date)
      let isBeforeMembership = false;
      if (membershipDate) {
        const membershipDayStr = membershipDate.split('T')[0];
        isBeforeMembership = !!(currentEvent.date && currentEvent.date < membershipDayStr);
      } else {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-indexed
        const currentMonthStartStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        isBeforeMembership = !!(currentEvent.date && currentEvent.date < currentMonthStartStr);
      }

      if (finalType === 'cancelled' || finalType === 'non-session' || isBeforeMembership) {
        currentEvent.price = 0;
        currentEvent.hasBabysitterFee = false;
        currentEvent.babysitterFeeAmount = 0;
        currentEvent.hasOfficeRentFee = false;
        currentEvent.officeRentFeeAmount = 0;
        currentEvent.paymentStatus = 'unpaid';
      } else if (finalType === 'rent-income') {
        currentEvent.price = defaultOfficeRentFee;
        currentEvent.hasBabysitterFee = false;
        currentEvent.babysitterFeeAmount = 0;
        currentEvent.hasOfficeRentFee = false;
        currentEvent.officeRentFeeAmount = 0;
        currentEvent.paymentStatus = 'unpaid';
      } else if (finalType === 'face-to-face') {
        currentEvent.hasOfficeRentFee = true;
        currentEvent.officeRentFeeAmount = defaultOfficeRentFee;
        currentEvent.paymentStatus = 'unpaid';
      } else {
        currentEvent.hasOfficeRentFee = false;
        currentEvent.officeRentFeeAmount = 0;
        currentEvent.paymentStatus = 'unpaid';
      }
      
      sessions.push(currentEvent as Session);
      currentEvent = null;
    } else if (currentEvent) {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const keyPart = line.substring(0, colonIndex);
        const valPart = line.substring(colonIndex + 1).trim();
        
        // Extract base property name (e.g. SUMMARY;CHARSET=UTF-8 -> SUMMARY)
        const key = keyPart.split(';')[0].toUpperCase();
        
        const cleanVal = valPart
          .replace(/\\,/g, ',')
          .replace(/\\;/g, ';')
          .replace(/\\n/gi, '\n');
        
        if (key === 'SUMMARY') {
          currentEvent.clientName = cleanVal;
        } else if (key === 'UID') {
          // Use a clean, sanitized UID from the iCal feed as the stable session ID
          currentEvent.id = 'ics_' + cleanVal.replace(/[^a-zA-Z0-9_\-]/g, '').substring(0, 50);
        } else if (key === 'DTSTART') {
          currentEvent.dtStartRaw = line;
        } else if (key === 'DTEND') {
          currentEvent.dtEndRaw = line;
        } else if (key === 'DURATION') {
          currentEvent.durationRaw = cleanVal;
        } else if (key === 'DESCRIPTION') {
          currentEvent.descriptionRaw = cleanVal;
        } else if (key === 'NOTE' || key === 'COMMENT') {
          currentEvent.noteRaw = cleanVal;
        } else if (key === 'LOCATION') {
          currentEvent.locationRaw = cleanVal;
        }
      }
    }
  }
  
  return sessions;
}

/**
 * Generates initial mock sessions if the user has no saved data in localStorage.
 * This is perfect to showcase the application beautifully on first boot, pre-populated
 * with the realistic data shown in the prompt's design theme.
 */
export function getInitialMockSessions(defaultPrice: number, defaultBabysitterFee: number, defaultOfficeRentFee: number = 200): Session[] {
  const today = new Date().toISOString().split('T')[0];
  
  // Get date strings for yesterday, today, and tomorrow
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
    // Yesterday's sessions for history
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
    // Tomorrow's sessions
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
