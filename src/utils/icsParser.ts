import { Session, SessionType } from '../types';

/**
 * Parses iCalendar (.ics) text format into structured Session objects.
 * This supports real Apple Calendar exports!
 */
export function parseICS(
  icsText: string,
  defaultPrice: number,
  defaultBabysitterFee: number,
  defaultOfficeRentFee: number,
  forcedType?: 'online' | 'face-to-face'
): Session[] {
  const sessions: Session[] = [];
  
  // Normalize all newlines to standard \n to support CRLF (\r\n), LF (\n) and old Mac CR (\r) line endings.
  const normalizedText = icsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // RFC 5545 Unfolding: Combine lines split by a newline followed by a space or horizontal tab
  const unfoldedText = normalizedText.replace(/\n[ \t]/g, '');
  const lines = unfoldedText.split('\n');
  
  let currentEvent: Partial<Session> & { dtStartRaw?: string; descriptionRaw?: string } | null = null;
  
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
      
      // Determine type (online or face-to-face) from summary or description
      let finalType: SessionType = 'online';
      if (forcedType) {
        finalType = forcedType;
      } else {
        const searchSource = ((currentEvent.clientName || '') + ' ' + (currentEvent.descriptionRaw || '')).toLowerCase();
        if (searchSource.includes('yüzyüze') || searchSource.includes('yüz yüze') || searchSource.includes('ofis') || searchSource.includes('klinik') || searchSource.includes('face')) {
          finalType = 'face-to-face';
        } else if (searchSource.includes('iptal') || searchSource.includes('cancel')) {
          finalType = 'cancelled';
        }
      }

      currentEvent.type = finalType;
      if (finalType === 'cancelled') {
        currentEvent.price = 0;
        currentEvent.hasBabysitterFee = false;
        currentEvent.babysitterFeeAmount = 0;
        currentEvent.hasOfficeRentFee = false;
        currentEvent.officeRentFeeAmount = 0;
      } else if (finalType === 'face-to-face') {
        currentEvent.hasOfficeRentFee = true;
        currentEvent.officeRentFeeAmount = defaultOfficeRentFee;
      } else {
        currentEvent.hasOfficeRentFee = false;
        currentEvent.officeRentFeeAmount = 0;
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
        } else if (key === 'DTSTART') {
          currentEvent.dtStartRaw = line;
        } else if (key === 'DESCRIPTION') {
          currentEvent.descriptionRaw = cleanVal;
        } else if (key === 'NOTE' || key === 'COMMENT') {
          currentEvent.notes = cleanVal;
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
