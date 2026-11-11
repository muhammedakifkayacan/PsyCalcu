import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  FileText,
  Share2,
  Download,
  Printer,
  Sparkles,
  RefreshCw,
  Calendar,
  Clock,
  CheckCircle2,
  Laptop,
  MapPin,
  Ban,
  Edit3,
  Check,
  Eye,
  EyeOff,
  Compass,
  Award,
  Layers,
  ChevronRight
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toJpeg } from 'html-to-image';
import { Session, AppSettings, getNormalizedClientName, toTurkishAscii, areClientNamesEquivalent } from '../types';
import { extractBaseCalendarUid } from '../lib/firestoreService';
import { parseICS } from '../utils/icsParser';
import { idbGet } from '../utils/idbStorage';

interface TimelineAiItem {
  sessionId: string;
  phaseTitle: string;
  progressBadge: string;
  formattedReportNote: string;
  keyTakeaway: string;
}

interface AiProgressReport {
  reportTitle: string;
  executiveSummary: string;
  keyThemes: string[];
  timelineItems: TimelineAiItem[];
  recommendations: string;
}

interface EnrichedTimelineSession {
  session: Session;
  sessionNumber: number;
  formattedDate: string;
  dayName: string;
  rawNote: string;
  noteSource: 'calendar-id' | 'manual' | 'none';
  aiItem: TimelineAiItem;
}

interface ClientPdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  displayTitle: string;
  clientSessions: Session[];
  settings: AppSettings;
  tempNotesCache?: Record<string, string>;
  onFetchLiveCalendarNotes?: (silent?: boolean) => Promise<Record<string, string> | void>;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const TURKISH_MONTHS_FULL = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];
const TURKISH_DAYS_FULL = [
  'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'
];

function formatSessionTurkishDate(dateStr: string): { formattedDate: string; dayName: string } {
  if (!dateStr) return { formattedDate: '-', dayName: '' };
  const parts = dateStr.split('-');
  if (parts.length !== 3) return { formattedDate: dateStr, dayName: '' };
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const dateObj = new Date(y, m, d);
  const monthName = TURKISH_MONTHS_FULL[m] || parts[1];
  const dayName = TURKISH_DAYS_FULL[dateObj.getDay()] || '';
  return {
    formattedDate: `${d} ${monthName} ${y}`,
    dayName
  };
}

export function resolveLiveSessionNote(
  session: Session,
  notesMap: Record<string, string>,
  tempNotesCache: Record<string, string> = {}
): { rawNote: string; source: 'calendar-id' | 'manual' | 'none' } {
  if (!session) return { rawNote: '', source: 'none' };

  const baseUid = session.id && session.id.startsWith('ics_') ? extractBaseCalendarUid(session.id) : '';
  const compactDate = (session.date || '').replace(/-/g, '');

  // 1. Exact Base UID + Date lookup (most specific for recurring or rescheduled calendar events)
  if (baseUid && compactDate && notesMap[`ics_${baseUid}_${compactDate}`]?.trim()) {
    return { rawNote: notesMap[`ics_${baseUid}_${compactDate}`].trim(), source: 'calendar-id' };
  }
  if (baseUid && session.date && notesMap[`uid:${baseUid}_${session.date}`]?.trim()) {
    return { rawNote: notesMap[`uid:${baseUid}_${session.date}`].trim(), source: 'calendar-id' };
  }

  // 2. Direct event ID lookup if session.id is date-specific or non-recurring
  if (session.id && notesMap[session.id]?.trim()) {
    return { rawNote: notesMap[session.id].trim(), source: 'calendar-id' };
  }

  // 3. Client-scoped date+time or date lookup
  // (Handles closed months, paid sessions decoupled from calendar, or split recurring calendar events)
  if (session.date && session.time && notesMap[`date_time:${session.date}_${session.time}`]?.trim()) {
    return { rawNote: notesMap[`date_time:${session.date}_${session.time}`].trim(), source: 'calendar-id' };
  }
  if (session.date && notesMap[`date:${session.date}`]?.trim()) {
    return { rawNote: notesMap[`date:${session.date}`].trim(), source: 'calendar-id' };
  }

  // 4. Bare Base Calendar UID lookup (single non-recurring event or master recurring event note)
  if (baseUid && notesMap[`ics_${baseUid}`]?.trim()) {
    return { rawNote: notesMap[`ics_${baseUid}`].trim(), source: 'calendar-id' };
  }
  if (baseUid && notesMap[`uid:${baseUid}`]?.trim()) {
    return { rawNote: notesMap[`uid:${baseUid}`].trim(), source: 'calendar-id' };
  }

  // 5. In-memory tempNotesCache for this session ID or Base UID
  if (session.id && tempNotesCache[session.id]?.trim()) {
    return { rawNote: tempNotesCache[session.id].trim(), source: 'calendar-id' };
  }
  if (baseUid && compactDate && tempNotesCache[`ics_${baseUid}_${compactDate}`]?.trim()) {
    return { rawNote: tempNotesCache[`ics_${baseUid}_${compactDate}`].trim(), source: 'calendar-id' };
  }
  if (baseUid && tempNotesCache[`ics_${baseUid}`]?.trim()) {
    return { rawNote: tempNotesCache[`ics_${baseUid}`].trim(), source: 'calendar-id' };
  }

  // 6. Stored session.notes (if manually entered or preserved)
  if (session.notes && session.notes.trim()) {
    return {
      rawNote: session.notes.trim(),
      source: session.isSyncedFromCalendar || session.id?.startsWith('ics_') ? 'calendar-id' : 'manual'
    };
  }

  return { rawNote: '', source: 'none' };
}

function cleanPhaseTitle(rawTitle: string): string {
  if (!rawTitle || !rawTitle.trim()) return '';
  // Remove leading "1. Seans • ", "Seans 2 - ", "1. Oturum: " etc.
  const cleaned = rawTitle
    .replace(/^\s*(?:seans|oturum)?\s*\d+\s*\.?\s*(?:seans|oturum)?\s*[•·\-–—:]\s*/i, '')
    .trim();
  if (/^(süreç değerlendirmesi|genel değerlendirme|seans değerlendirmesi|seans notu|görüşme notu)$/i.test(cleaned)) {
    return '';
  }
  return cleaned;
}

function cleanReportNote(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/^Takvim etkinlik kaydı\s*\([^)]*\)\s*verilerine göre bu oturumda;\s*/i, '')
    .replace(/^Takvim\/Etkinlik Notu:\s*/i, '')
    .trim();
}

export const ClientPdfReportModal: React.FC<ClientPdfReportModalProps> = ({
  isOpen,
  onClose,
  clientName,
  displayTitle,
  clientSessions,
  settings,
  tempNotesCache = {},
  showToast
}) => {
  const [isFetchingCalendar, setIsFetchingCalendar] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [includeFinancials, setIncludeFinancials] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [liveNotesMap, setLiveNotesMap] = useState<Record<string, string>>({});
  const [customNotesById, setCustomNotesById] = useState<Record<string, string>>({});
  const [customTitlesById, setCustomTitlesById] = useState<Record<string, string>>({});
  const [editingNoteSessionId, setEditingNoteSessionId] = useState<string | null>(null);
  const [aiReport, setAiReport] = useState<AiProgressReport | null>(null);
  const [isProofreadingAll, setIsProofreadingAll] = useState(false);
  const [proofreadingSessionId, setProofreadingSessionId] = useState<string | null>(null);
  const [proofreadProgress, setProofreadProgress] = useState<{ current: number; total: number } | null>(null);
  const [proofreadCompletedIds, setProofreadCompletedIds] = useState<Record<string, boolean>>({});

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Yalnızca mevcut güne kadar (bugün dahil, s.date <= todayDateStr) olan seansları rapora dahil et;
  // gelecekte planlanan seansları süreç raporuna ve takvim not sorgusuna dahil etme.
  const todayDateStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const reportEligibleSessions = useMemo(() => {
    return clientSessions.filter(
      s => s && !s.isDeleted && s.type !== 'non-session' && Boolean(s.date && s.date <= todayDateStr)
    );
  }, [clientSessions, todayDateStr]);

  // Extract ONLY this client's calendar Event IDs and session names up to today (never query other clients' or future events)
  const targetClientEventIdsInfo = useMemo(() => {
    const validSessions = reportEligibleSessions;
    const syncedSessions = validSessions.filter(
      s => s.id && (s.id.startsWith('ics_') || s.isSyncedFromCalendar)
    );
    const targetEventIds = Array.from(new Set(syncedSessions.map(s => s.id).filter(Boolean)));
    const targetBaseUids = Array.from(
      new Set(syncedSessions.map(s => extractBaseCalendarUid(s.id)).filter(Boolean))
    );
    const targetSessionNames = Array.from(
      new Set(validSessions.map(s => s.clientName?.trim()).filter((n): n is string => Boolean(n)))
    );
    let minDate = '';
    let maxDate = '';
    for (const s of validSessions) {
      if (s.date) {
        if (!minDate || s.date < minDate) minDate = s.date;
        if (!maxDate || s.date > maxDate) maxDate = s.date;
      }
    }
    return {
      targetEventIds,
      targetBaseUids,
      targetSessionNames,
      minDate,
      maxDate
    };
  }, [reportEligibleSessions]);

  // Clear local note state when modal closes so no notes linger in memory
  useEffect(() => {
    if (!isOpen) {
      setLiveNotesMap({});
      setCustomNotesById({});
      setCustomTitlesById({});
      setEditingNoteSessionId(null);
      setIsProofreadingAll(false);
      setProofreadingSessionId(null);
      setProofreadProgress(null);
      setProofreadCompletedIds({});
    }
  }, [isOpen]);

  // Chronological sessions up to today (oldest to newest for timeline progression)
  const chronologicalSessions = useMemo(() => {
    return [...reportEligibleSessions]
      .filter(s => {
        if (!includeCancelled && s.type === 'cancelled') return false;
        return true;
      })
      .sort((a, b) => {
        const dA = a.date || '';
        const dB = b.date || '';
        if (dA !== dB) return dA.localeCompare(dB);
        return (a.time || '').localeCompare(b.time || '');
      });
  }, [reportEligibleSessions, includeCancelled]);

  // Overall stats (strictly up to today)
  const reportStats = useMemo(() => {
    const active = reportEligibleSessions.filter(s => s.type !== 'cancelled');
    const cancelled = reportEligibleSessions.filter(s => s.type === 'cancelled');
    const onlineCount = active.filter(s => s.type === 'online').length;
    const faceToFaceCount = active.filter(s => s.type === 'face-to-face').length;
    const totalBilled = active.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    const totalPaid = active.reduce((sum, s) => {
      if (s.paymentStatus === 'paid') return sum + (Number(s.price) || 0);
      if (s.paymentStatus === 'partial') return sum + (Number(s.paidAmount) || 0);
      return sum;
    }, 0);
    const totalUnpaid = Math.max(0, totalBilled - totalPaid);

    const sortedDates = [...active].filter(s => !!s.date).sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = sortedDates[0]?.date ? formatSessionTurkishDate(sortedDates[0].date).formattedDate : '-';
    const lastDate = sortedDates[sortedDates.length - 1]?.date
      ? formatSessionTurkishDate(sortedDates[sortedDates.length - 1].date).formattedDate
      : '-';

    return {
      completedCount: active.length,
      cancelledCount: cancelled.length,
      onlineCount,
      faceToFaceCount,
      totalBilled,
      totalPaid,
      totalUnpaid,
      firstDate,
      lastDate
    };
  }, [reportEligibleSessions]);

  // Gather all configured calendar URLs (from settings + localStorage + IndexedDB backups)
  const getConfiguredCalendarUrls = async (): Promise<string[]> => {
    const urlSet = new Set<string>();
    const addUrl = (u?: string | null) => {
      if (typeof u === 'string' && u.trim().length > 0) {
        urlSet.add(u.trim());
      }
    };

    addUrl(settings.onlineCalendarWebcalUrl);
    addUrl(settings.faceToFaceCalendarWebcalUrl);
    if (Array.isArray(settings.ownerCalendars)) {
      settings.ownerCalendars.forEach(c => addUrl(c?.url));
    }

    try {
      addUrl(localStorage.getItem('psycalcu_last_online_ical_url'));
      addUrl(localStorage.getItem('psycalcu_last_facetoface_ical_url'));
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('psycalcu_settings') || key.startsWith('psycalcu_safety_settings'))) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            addUrl(parsed?.onlineCalendarWebcalUrl);
            addUrl(parsed?.faceToFaceCalendarWebcalUrl);
            if (Array.isArray(parsed?.ownerCalendars)) {
              parsed.ownerCalendars.forEach((c: any) => addUrl(c?.url));
            }
          }
        }
      }
    } catch (e) {}

    return Array.from(urlSet);
  };

  // Clean redundant "Konum: ..." line from parseICS note if a clinical description exists or if it's just a generic platform/room tag
  const cleanParsedIcsNote = (rawNoteText?: string): string => {
    if (!rawNoteText) return '';
    let text = rawNoteText.replace(
      /-::~:~::~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~::~:~::-([\s\S]*?)-::~:~::~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~:~::~:~::-/g,
      ''
    );
    const lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return '';
    if (lines.length > 1) {
      const withoutKonum = lines.filter(l => !/^Konum:\s*/i.test(l));
      if (withoutKonum.length > 0) {
        return withoutKonum.join('\n').trim();
      }
    }
    if (lines.length === 1 && /^Konum:\s*/i.test(lines[0])) {
      const locVal = lines[0].replace(/^Konum:\s*/i, '').trim();
      if (
        locVal.length <= 25 ||
        /^(online|zoom|google meet|meet|teams|skype|whatsapp|ofis|klinik|yüzyüze|yüz yüze|oda\b|salon\b|http)/i.test(locVal)
      ) {
        return '';
      }
      return locVal;
    }
    return lines.join('\n').trim();
  };

  // Generate AI Report (queries ONLY this client's events up to today and keeps them strictly isolated in local modal state)
  const handleGenerateReport = async (forceRefreshCalendar = false) => {
    let activeMap: Record<string, string> = forceRefreshCalendar ? {} : { ...liveNotesMap };

    const { targetEventIds, targetBaseUids, targetSessionNames, minDate, maxDate } = targetClientEventIdsInfo;
    const targetEventIdSet = new Set(targetEventIds);
    const targetBaseUidSet = new Set(targetBaseUids);
    const candidateNames = Array.from(new Set([clientName, displayTitle, ...targetSessionNames].filter(Boolean)));

    const isEventForTargetClient = (evId: string, evClientName: string): boolean => {
      if (evId && targetEventIdSet.has(evId)) return true;
      const baseUid = evId && evId.startsWith('ics_') ? extractBaseCalendarUid(evId) : '';
      if (baseUid && targetBaseUidSet.has(baseUid)) return true;
      if (evClientName) {
        for (const cand of candidateNames) {
          if (areClientNamesEquivalent(evClientName, cand)) return true;
        }
      }
      return false;
    };

    if (
      reportEligibleSessions.length > 0 &&
      (forceRefreshCalendar || Object.keys(activeMap).length === 0)
    ) {
      setIsFetchingCalendar(true);
      try {
        // 1. Check local IndexedDB cache (populated when .ics files are uploaded or synced locally) for this client ONLY
        try {
          const localIcsNotes = await idbGet<Record<string, string>>('psycalcu_local_ics_notes');
          if (localIcsNotes && typeof localIcsNotes === 'object') {
            for (const s of reportEligibleSessions) {
              if (!s) continue;
              const baseUid = s.id?.startsWith('ics_') ? extractBaseCalendarUid(s.id) : '';
              const compactDate = (s.date || '').replace(/-/g, '');
              const normClient = getNormalizedClientName(s.clientName || clientName);
              const candidateKeys = [
                s.id,
                baseUid && compactDate ? `ics_${baseUid}_${compactDate}` : '',
                baseUid && s.id === `ics_${baseUid}` ? `ics_${baseUid}` : '',
                normClient && s.date && s.time ? `client_dt:${normClient}_${s.date}_${s.time}` : '',
                normClient && s.date ? `client_d:${normClient}_${s.date}` : ''
              ].filter(Boolean);

              for (const k of candidateKeys) {
                if (localIcsNotes[k]?.trim()) {
                  const val = localIcsNotes[k].trim();
                  if (s.id) activeMap[s.id] = val;
                  if (s.date) activeMap[`date:${s.date}`] = val;
                  if (s.date && s.time) activeMap[`date_time:${s.date}_${s.time}`] = val;
                  break;
                }
              }
            }
          }
        } catch (idbErr) {}

        // 2. Query server-side /api/calendar-notes-by-event-ids (uses parseICS + direct VEVENT extraction + server URL fallback)
        const calendarUrls = await getConfiguredCalendarUrls();
        try {
          const res = await fetch('/api/calendar-notes-by-event-ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              urls: calendarUrls,
              targetEventIds,
              targetBaseUids,
              targetClientName: clientName,
              targetDisplayTitle: displayTitle,
              targetSessionNames
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.notesByEventId && typeof data.notesByEventId === 'object') {
              activeMap = { ...activeMap, ...data.notesByEventId };
            }
          }
        } catch (err) {
          console.warn('Could not query targeted client calendar event IDs:', err);
        }

        // 3. Client-side /api/proxy-ical + parseICS restricted strictly to this client's [minDate, maxDate <= today]
        if (calendarUrls.length > 0 && minDate && maxDate) {
          for (const calUrl of calendarUrls) {
            try {
              const proxyRes = await fetch(`/api/proxy-ical?url=${encodeURIComponent(calUrl)}&_t=${Date.now()}`, {
                cache: 'no-store'
              });
              if (proxyRes.ok) {
                const icsText = await proxyRes.text();
                const parsedEvents = parseICS(
                  icsText,
                  0,
                  0,
                  0,
                  undefined,
                  null,
                  false,
                  null,
                  undefined,
                  false,
                  undefined,
                  undefined,
                  minDate,
                  maxDate
                );
                for (const ev of parsedEvents) {
                  if (!ev || (ev.date && ev.date > todayDateStr)) continue;
                  if (!isEventForTargetClient(ev.id, ev.clientName)) continue;
                  const cleanedNote = cleanParsedIcsNote(ev.notes);
                  if (!cleanedNote) continue;
                  const evBaseUid = ev.id?.startsWith('ics_') ? extractBaseCalendarUid(ev.id) : '';
                  if (ev.id) activeMap[ev.id] = cleanedNote;
                  if (ev.date) {
                    activeMap[`date:${ev.date}`] = cleanedNote;
                    if (ev.time) activeMap[`date_time:${ev.date}_${ev.time}`] = cleanedNote;
                  }
                  if (evBaseUid) {
                    if (ev.date) {
                      activeMap[`ics_${evBaseUid}_${ev.date.replace(/-/g, '')}`] = cleanedNote;
                      activeMap[`uid:${evBaseUid}_${ev.date}`] = cleanedNote;
                    }
                    if (ev.id === `ics_${evBaseUid}`) {
                      if (!activeMap[`ics_${evBaseUid}`]) activeMap[`ics_${evBaseUid}`] = cleanedNote;
                      if (!activeMap[`uid:${evBaseUid}`]) activeMap[`uid:${evBaseUid}`] = cleanedNote;
                    }
                  }
                }
              }
            } catch (proxyErr) {
              console.warn('Client-side proxy-ical fallback warning:', proxyErr);
            }
          }
        }

        setLiveNotesMap({ ...activeMap });
      } finally {
        setIsFetchingCalendar(false);
      }
    }

    setIsGeneratingAi(true);
    try {
      let activeCounter = 0;
      const payloadSessions = chronologicalSessions.map((s, idx) => {
        if (s.type !== 'cancelled') activeCounter++;
        const { formattedDate, dayName } = formatSessionTurkishDate(s.date);
        const { rawNote } = resolveLiveSessionNote(s, activeMap, tempNotesCache);
        return {
          id: s.id,
          sessionNumber: s.type === 'cancelled' ? idx + 1 : activeCounter,
          date: s.date,
          formattedDate,
          dayName,
          time: s.time || '00:00',
          duration: s.duration || 50,
          type: s.type,
          paymentStatus: s.paymentStatus || 'unpaid',
          price: s.price || 0,
          isSyncedFromCalendar: Boolean(s.isSyncedFromCalendar || s.id?.startsWith('ics_')),
          rawNote
        };
      });

      const response = await fetch('/api/gemini/client-progress-report', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          clientName: displayTitle,
          therapistName: settings.therapistName || 'Uzm. Psk. Büşra Bakır Kayacan',
          sessions: payloadSessions,
          stats: reportStats
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAiReport(data);
        if (forceRefreshCalendar && showToast) {
          showToast('Süreç raporu güncellendi.', 'success');
        }
      }
    } catch (error) {
      console.error('Error generating AI progress report:', error);
      if (showToast) {
        showToast('Rapor oluşturulurken bir sorun oluştu, standart şablon yüklendi.', 'info');
      }
    } finally {
      setIsGeneratingAi(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleGenerateReport(false);
    }
  }, [isOpen, clientName, includeCancelled]);

  // Combine chronological sessions with AI timeline output — NEVER invent notes when rawNote & customNote are empty
  const enrichedTimeline: EnrichedTimelineSession[] = useMemo(() => {
    let activeNum = 0;
    return chronologicalSessions.map((s, idx) => {
      if (s.type !== 'cancelled') activeNum++;
      const sessionNumber = s.type === 'cancelled' ? idx + 1 : activeNum;
      const { formattedDate, dayName } = formatSessionTurkishDate(s.date);
      const { rawNote, source } = resolveLiveSessionNote(s, liveNotesMap, tempNotesCache);

      const hasManualOverride = customNotesById[s.id] !== undefined;
      const effectiveRawNote = hasManualOverride ? customNotesById[s.id].trim() : rawNote.trim();
      const matchedAi = aiReport?.timelineItems?.find(item => item.sessionId === s.id);

      // Only show a note if the calendar event actually had a note OR the user manually entered one
      const finalNote = hasManualOverride
        ? customNotesById[s.id]
        : effectiveRawNote
        ? matchedAi?.formattedReportNote?.trim() || effectiveRawNote
        : '';

      const finalTitle =
        customTitlesById[s.id] !== undefined
          ? customTitlesById[s.id]
          : finalNote.trim()
          ? matchedAi?.phaseTitle?.trim() || ''
          : '';

      return {
        session: s,
        sessionNumber,
        formattedDate,
        dayName,
        rawNote: effectiveRawNote,
        noteSource: hasManualOverride ? 'manual' : source,
        aiItem: {
          sessionId: s.id,
          phaseTitle: finalTitle,
          progressBadge: '',
          formattedReportNote: finalNote,
          keyTakeaway: ''
        }
      };
    });
  }, [chronologicalSessions, liveNotesMap, tempNotesCache, aiReport, customNotesById, customTitlesById]);

  const hasAnyRecommendations = Boolean(
    (aiReport?.recommendations && aiReport.recommendations.trim().length > 0) || isEditMode
  );

  // Pixel-accurate A4 Multi-Page Pagination — fills each A4 sheet properly without half-empty pages
  const paginatedPages = useMemo(() => {
    const pages: {
      pageIndex: number;
      isFirstPage: boolean;
      isLastPage: boolean;
      items: EnrichedTimelineSession[];
      includeRecommendations: boolean;
    }[] = [];

    if (enrichedTimeline.length === 0) {
      pages.push({
        pageIndex: 0,
        isFirstPage: true,
        isLastPage: true,
        items: [],
        includeRecommendations: hasAnyRecommendations
      });
      return pages;
    }

    // Estimate exact vertical height (in px) of a single session row on the 794x1123 A4 sheet
    const estimateRowHeight = (item: EnrichedTimelineSession): number => {
      const noteText = (item.aiItem.formattedReportNote || '').trim();
      const titleText = cleanPhaseTitle(item.aiItem.phaseTitle || '');
      if (!noteText && !isEditMode) {
        // Single-line compact row (session number + date + online/face-to-face + time)
        return includeFinancials ? 44 : 33;
      }
      const lineBreaks = (noteText.match(/\n/g) || []).length;
      const wrappedLines = Math.max(1, Math.ceil(noteText.length / 72) + lineBreaks);
      const titleHeight = titleText ? 20 : 0;
      const noteHeight = wrappedLines * 18.5;
      const contentHeight = Math.max(includeFinancials ? 58 : 44, titleHeight + noteHeight);
      return 20 + contentHeight; // 20px vertical padding + content height
    };

    // Usable content height on an A4 sheet (1123px total - 72px top/bottom padding - 44px footer = 1007px)
    const totalUsableHeight = 1005;

    // Fixed header + summary strip + executive evaluation + timeline section header on Page 1
    const execTextLen = (aiReport?.executiveSummary || '').length || 120;
    const execLines = Math.max(2, Math.ceil(execTextLen / 92));
    const hasThemes = Boolean(aiReport?.keyThemes && aiReport.keyThemes.length > 0);
    const page1FixedOverhead =
      60 + // Document Header
      72 + // Unified Summary Bar
      (22 + execLines * 19 + (hasThemes ? 28 : 0)) + // Executive Evaluation
      30 + // Timeline Section Header
      54; // Inter-section gaps

    const page1AvailableForRows = Math.max(380, totalUsableHeight - page1FixedOverhead);
    const continuationAvailableForRows = totalUsableHeight - (36 + 30 + 24); // ~915px for rows on Page 2+
    const recommendationsHeight = hasAnyRecommendations ? 84 : 0;

    let cursor = 0;
    let isFirst = true;

    while (cursor < enrichedTimeline.length) {
      const availableHeight = isFirst ? page1AvailableForRows : continuationAvailableForRows;
      const chunk: EnrichedTimelineSession[] = [];
      let usedHeight = 0;

      while (cursor < enrichedTimeline.length) {
        const candidate = enrichedTimeline[cursor];
        const rowH = estimateRowHeight(candidate);
        if (chunk.length > 0 && usedHeight + rowH > availableHeight) {
          break;
        }
        chunk.push(candidate);
        usedHeight += rowH;
        cursor++;
      }

      const isEnd = cursor >= enrichedTimeline.length;
      const canFitRecsHere =
        !hasAnyRecommendations || usedHeight + recommendationsHeight <= availableHeight + 42;

      pages.push({
        pageIndex: pages.length,
        isFirstPage: isFirst,
        isLastPage: isEnd && canFitRecsHere,
        items: chunk,
        includeRecommendations: isEnd && canFitRecsHere && hasAnyRecommendations
      });

      if (isEnd && !canFitRecsHere && hasAnyRecommendations) {
        pages.push({
          pageIndex: pages.length,
          isFirstPage: false,
          isLastPage: true,
          items: [],
          includeRecommendations: true
        });
      }

      isFirst = false;
    }

    return pages;
  }, [enrichedTimeline, aiReport, includeFinancials, isEditMode, hasAnyRecommendations]);

  // Build multi-page PDF Blob using html-to-image + jsPDF
  const generatePdfDocument = async (): Promise<{ blob: Blob; filename: string }> => {
    setEditingNoteSessionId(null);
    await new Promise(resolve => setTimeout(resolve, 50));

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const totalPages = paginatedPages.length;
    for (let i = 0; i < totalPages; i++) {
      const pageEl = pageRefs.current[i];
      if (!pageEl) continue;

      const dataUrl = await toJpeg(pageEl, {
        quality: 0.96,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        filter: (node: HTMLElement) => {
          if (node && node.dataset && node.dataset.exportIgnore === 'true') {
            return false;
          }
          return true;
        }
      });

      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }
      pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }

    const safeClientSlug = toTurkishAscii(displayTitle)
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    const todayStr = new Date().toISOString().split('T')[0];
    const filename = `${safeClientSlug || 'Danisan'}_Surec_Raporu_${todayStr}.pdf`;

    return {
      blob: pdf.output('blob'),
      filename
    };
  };

  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      const { blob, filename } = await generatePdfDocument();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      if (showToast) {
        showToast(`PDF raporu (${paginatedPages.length} sayfa) indirildi.`, 'success');
      }
    } catch (error) {
      console.error('PDF download error:', error);
      if (showToast) {
        showToast('PDF oluşturulurken bir hata oluştu.', 'error');
      }
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleSharePdf = async () => {
    try {
      setIsExportingPdf(true);
      const { blob, filename } = await generatePdfDocument();
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (
        typeof navigator !== 'undefined' &&
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: `${displayTitle} — Süreç ve İlerleme Raporu`,
          text: `${displayTitle} danışanına ait süreç ve ilerleme raporu.`,
          files: [file]
        });
        if (showToast) {
          showToast('PDF raporu paylaşıldı.', 'success');
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        if (showToast) {
          showToast('Cihazınızda doğrudan paylaşım desteklenmediği için PDF indirildi.', 'info');
        }
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('PDF share error:', error);
      await handleDownloadPdf();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleUpdateTimelineItem = (sessionId: string, field: keyof TimelineAiItem, value: string) => {
    if (field === 'formattedReportNote') {
      setCustomNotesById(prev => ({ ...prev, [sessionId]: value }));
    } else if (field === 'phaseTitle') {
      setCustomTitlesById(prev => ({ ...prev, [sessionId]: value }));
    }
  };

  // Derive a specific 2-4 word topic title from the note's content when AI title is unavailable
  const deriveContextualTitleFromNote = (noteText: string): string => {
    const clean = (noteText || '').trim();
    if (!clean) return '';
    const lower = clean.toLocaleLowerCase('tr-TR');

    const topicMatchers: Array<[RegExp, string]> = [
      [/(ilk görüşme|tanışma|anamnez|öykü alma|başlangıç)/i, 'İlk Görüşme ve Değerlendirme'],
      [/(uyku|uykusuzluk).*?(nefes|gevşeme)|(nefes|gevşeme).*?(uyku|uykusuzluk)/i, 'Uyku Düzeni ve Nefes Egzersizi'],
      [/(iş yer|iş hayat|mesai|yönetici|kariyer).*?(sınır|hayır deme)|(sınır koyma|hayır diyebilme)/i, 'Sınır Koyma ve İş Yaşamı'],
      [/(aile|anne|baba|ebeveyn).*?(suçluluk|iletişim|çatışma)/i, 'Aile İletişimi ve Duygusal Sınırlar'],
      [/(panik|kaygı|anksiyete|endişe).*?(nefes|beden|baş etme)/i, 'Kaygı Yönetimi ve Baş Etme'],
      [/(kaygı|anksiyete|endişe|korku|panik)/i, 'Kaygı ve Duygusal Farkındalık'],
      [/(uyku|uykusuzluk|kabus|rüya)/i, 'Uyku Düzeni ve Rahatlama'],
      [/(nefes egzersiz|gevşeme|mindfulness|farkındalık egzersiz)/i, 'Nefes ve Regülasyon Çalışması'],
      [/(öfke|sinir|tahammül|gerginlik|dürtü)/i, 'Öfke Kontrolü ve Duygu Düzenleme'],
      [/(eş|partner|evlilik|ilişki|ayrılık|kıskançlık)/i, 'İlişki Dinamikleri ve İletişim'],
      [/(aile|anne|baba|kardeş|ebeveyn)/i, 'Aile İlişkileri ve Etkileşim'],
      [/(çocuk|okul|sınav|ders|akran|dikkat|oyun)/i, 'Okul Uyumu ve Gelişim Takibi'],
      [/(iş|kariyer|meslek|performans|erteleme|motivasyon)/i, 'Motivasyon ve Günlük İşlevsellik'],
      [/(özgüven|öz değer|yetersizlik|değersizlik|suçluluk)/i, 'Öz Değer ve Bilişsel Çerçeveleme'],
      [/(yas|kayıp|travma|geçmiş)/i, 'Kayıp Süreci ve Duygusal İşleme'],
      [/(ödev|egzersiz|uygulama|günlük takip)/i, 'Ev Çalışması ve Davranışsal Takip'],
      [/(düşünce|bilişsel|şema|inanç)/i, 'Bilişsel Değerlendirme ve Farkındalık']
    ];

    for (const [regex, title] of topicMatchers) {
      if (regex.test(lower)) {
        return title;
      }
    }

    // Extract 2-4 meaningful words from the first clause if no preset topic matched
    const stopWords = new Set([
      'bugün', 'dün', 'yarın', 'bu', 'bir', 've', 'ile', 'için', 'çok', 'daha', 'gibi', 'kadar',
      'sonra', 'önce', 'olarak', 'olan', 'oldu', 'olduğu', 'üzerine', 'üzerinde', 'hakkında',
      'danışan', 'danışanın', 'danışanla', 'danışana', 'seansta', 'görüşmede', 'oturumda',
      'konuştuk', 'konuşuldu', 'değerlendirildi', 'çalışıldı', 'yapıldı', 'paylaştı', 'anlattı',
      'söyledi', 'belirtti', 'ifade', 'etti', 'edildi', 'gözlemlendi', 'ele', 'alındı'
    ]);

    const firstSentence = clean.split(/[.!?\n]/)[0] || clean;
    const words = firstSentence
      .replace(/[^\p{L}\s]/gu, ' ')
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length >= 3 && !stopWords.has(w.toLocaleLowerCase('tr-TR')));

    if (words.length >= 2) {
      return words
        .slice(0, 3)
        .map(w => {
          const first = w.charAt(0);
          const up = first === 'i' ? 'İ' : first === 'ı' ? 'I' : first.toLocaleUpperCase('tr-TR');
          return up + w.slice(1).toLocaleLowerCase('tr-TR');
        })
        .join(' ');
    }

    return 'Görüşme Odak Notu';
  };

  // Comprehensive Turkish orthography, sentence capitalization, punctuation & clinical spelling normalizer
  const correctTurkishNoteOrthography = (
    rawInput: string,
    rawTitleInput = ''
  ): { correctedText: string; correctedTitle: string } => {
    if (!rawInput || !rawInput.trim()) {
      return { correctedText: '', correctedTitle: cleanPhaseTitle(rawTitleInput) };
    }

    const turkishUpperChar = (ch: string): string => {
      if (ch === 'i') return 'İ';
      if (ch === 'ı') return 'I';
      return ch.toLocaleUpperCase('tr-TR');
    };

    const wordReplacements: Array<[RegExp, string]> = [
      // Common merged words & compound spacing fixes
      [/\bkelimeyanlış\b/gi, 'kelime yanlış'],
      [/\bkelimeyanlis\b/gi, 'kelime yanlış'],
      [/\bbirşey\b/gi, 'bir şey'],
      [/\bbirsey\b/gi, 'bir şey'],
      [/\bbirşeyler\b/gi, 'bir şeyler'],
      [/\bherşey\b/gi, 'her şey'],
      [/\bhersey\b/gi, 'her şey'],
      [/\bhiçbirşey\b/gi, 'hiçbir şey'],
      [/\bhicbirsey\b/gi, 'hiçbir şey'],
      [/\bpekçok\b/gi, 'pek çok'],
      [/\bpekcok\b/gi, 'pek çok'],
      [/\bbirçok\b/gi, 'birçok'],
      [/\bbircok\b/gi, 'birçok'],
      [/\bhiçbir\b/gi, 'hiçbir'],
      [/\bhicbir\b/gi, 'hiçbir'],
      [/\bherhangi\s+birşey\b/gi, 'herhangi bir şey'],
      [/\bfarkettim\b/gi, 'fark ettim'],
      [/\bfarketti\b/gi, 'fark etti'],
      [/\bfarkedildi\b/gi, 'fark edildi'],
      [/\bfarketmek\b/gi, 'fark etmek'],
      [/\bbaşetme\b/gi, 'baş etme'],
      [/\bbasetme\b/gi, 'baş etme'],
      [/\bbaşetmek\b/gi, 'baş etmek'],
      [/\bdevametti\b/gi, 'devam etti'],
      [/\bdevamediyor\b/gi, 'devam ediyor'],
      [/\byanısıra\b/gi, 'yanı sıra'],
      // Common letter transpositions & missing vowels in Turkish clinical notes
      [/\bgöürşme\b/gi, 'görüşme'],
      [/\bgöürşmede\b/gi, 'görüşmede'],
      [/\bgöürştük\b/gi, 'görüştük'],
      [/\bgöürşüldü\b/gi, 'görüşüldü'],
      [/\byerindki\b/gi, 'yerindeki'],
      [/\bsüreçtki\b/gi, 'süreçteki'],
      [/\bevdeki\b/gi, 'evdeki'],
      [/\bişyerindeki\b/gi, 'iş yerindeki'],
      [/\bişyerinde\b/gi, 'iş yerinde'],
      [/\bkonşutuk\b/gi, 'konuştuk'],
      [/\bkonşuuldu\b/gi, 'konuşuldu'],
      [/\bdanıaşn\b/gi, 'danışan'],
      [/\bdanıaşnın\b/gi, 'danışanın'],
      [/\bdanıaşnla\b/gi, 'danışanla'],
      [/\bdeğrelendirme\b/gi, 'değerlendirme'],
      [/\bdeğrelendirildi\b/gi, 'değerlendirildi'],
      [/\bdüüşnce\b/gi, 'düşünce'],
      [/\bdüüşnceler\b/gi, 'düşünceler'],
      [/\bduyug\b/gi, 'duygu'],
      [/\bduyuglar\b/gi, 'duygular'],
      [/\bileitşim\b/gi, 'iletişim'],
      [/\bçalışam\b/gi, 'çalışma'],
      [/\byanlş\b/gi, 'yanlış'],
      [/\byalnış\b/gi, 'yanlış'],
      [/\byalnis\b/gi, 'yanlış'],
      [/\byanlis\b/gi, 'yanlış'],
      [/\byalnız\b/gi, 'yalnız'],
      [/\byalniz\b/gi, 'yalnız'],
      [/\byanlız\b/gi, 'yalnız'],
      [/\bherkez\b/gi, 'herkes'],
      [/\bpsikolji\b/gi, 'psikoloji'],
      [/\bpsikoljik\b/gi, 'psikolojik'],
      [/\banksiyte\b/gi, 'anksiyete'],
      [/\begzerszi\b/gi, 'egzersizi'],
      [/\begzersz\b/gi, 'egzersiz'],
      // Missing Turkish diacritics
      [/\bbugun\b/gi, 'bugün'],
      [/\bdun\b/gi, 'dün'],
      [/\byarin\b/gi, 'yarın'],
      [/\bcok\b/gi, 'çok'],
      [/\bgecti\b/gi, 'geçti'],
      [/\bgectigimiz\b/gi, 'geçtiğimiz'],
      [/\buzerine\b/gi, 'üzerine'],
      [/\buzerinde\b/gi, 'üzerinde'],
      [/\bkonustuk\b/gi, 'konuştuk'],
      [/\bkonusuldu\b/gi, 'konuşuldu'],
      [/\bkonusulacak\b/gi, 'konuşulacak'],
      [/\bdanisan\b/gi, 'danışan'],
      [/\bdanisanla\b/gi, 'danışanla'],
      [/\bdanisanin\b/gi, 'danışanın'],
      [/\bdanisana\b/gi, 'danışana'],
      [/\bgorusme\b/gi, 'görüşme'],
      [/\bgorusmede\b/gi, 'görüşmede'],
      [/\bgorustuk\b/gi, 'görüştük'],
      [/\bgorusuldu\b/gi, 'görüşüldü'],
      [/\bkaygi\b/gi, 'kaygı'],
      [/\bkaygisi\b/gi, 'kaygısı'],
      [/\bkaygilar\b/gi, 'kaygılar'],
      [/\bdusunce\b/gi, 'düşünce'],
      [/\bdusunceler\b/gi, 'düşünceler'],
      [/\bdusunceleri\b/gi, 'düşünceleri'],
      [/\bdavranis\b/gi, 'davranış'],
      [/\bdavranislar\b/gi, 'davranışlar'],
      [/\biliski\b/gi, 'ilişki'],
      [/\biliskisi\b/gi, 'ilişkisi'],
      [/\biliskiler\b/gi, 'ilişkiler'],
      [/\biletisim\b/gi, 'iletişim'],
      [/\bofke\b/gi, 'öfke'],
      [/\buzuntu\b/gi, 'üzüntü'],
      [/\bsurec\b/gi, 'süreç'],
      [/\bsureci\b/gi, 'süreci'],
      [/\bsurecte\b/gi, 'süreçte'],
      [/\bdegerlendirme\b/gi, 'değerlendirme'],
      [/\bdegerlendirildi\b/gi, 'değerlendirildi'],
      [/\bcalisma\b/gi, 'çalışma'],
      [/\bcalisildi\b/gi, 'çalışıldı'],
      [/\bcalistik\b/gi, 'çalıştık'],
      [/\byapildi\b/gi, 'yapıldı'],
      [/\byaptik\b/gi, 'yaptık'],
      [/\bbaslandi\b/gi, 'başlandı'],
      [/\bbaslangic\b/gi, 'başlangıç'],
      [/\bplanlandi\b/gi, 'planlandı'],
      [/\bpaylasti\b/gi, 'paylaştı'],
      [/\banlatti\b/gi, 'anlattı'],
      [/\bsoyledi\b/gi, 'söyledi'],
      [/\bfarkindalik\b/gi, 'farkındalık'],
      [/\bozguven\b/gi, 'özgüven'],
      [/\bgecmis\b/gi, 'geçmiş'],
      [/\bgunluk\b/gi, 'günlük'],
      [/\bhaftalik\b/gi, 'haftalık'],
      [/\bodev\b/gi, 'ödev'],
      [/\bodevi\b/gi, 'ödevi'],
      [/\bgevseme\b/gi, 'gevşeme'],
      [/\bcocuk\b/gi, 'çocuk'],
      [/\bcocukluk\b/gi, 'çocukluk'],
      [/\byogun\b/gi, 'yoğun'],
      [/\bazaldi\b/gi, 'azaldı'],
      [/\bartti\b/gi, 'arttı'],
      [/\boldukca\b/gi, 'oldukça'],
      [/\bozellikle\b/gi, 'özellikle'],
      [/\bhakkinda\b/gi, 'hakkında'],
      [/\bsonrasinda\b/gi, 'sonrasında'],
      [/\boncesinde\b/gi, 'öncesinde'],
      [/\bsirasinda\b/gi, 'sırasında'],
      [/\bgosterdi\b/gi, 'gösterdi'],
      [/\bgozlemlendi\b/gi, 'gözlemlendi'],
      [/\bele alindi\b/gi, 'ele alındı'],
      [/\bgozden gecirildi\b/gi, 'gözden geçirildi'],
      [/\bguzel\b/gi, 'güzel'],
      [/\bolumlu\b/gi, 'olumlu'],
      [/\bdonem\b/gi, 'dönem'],
      [/\bdonemde\b/gi, 'dönemde'],
      [/\bcozum\b/gi, 'çözüm'],
      [/\bdonus\b/gi, 'dönüş']
    ];

    let text = rawInput
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      // Fix "A., anne", "A, anne", "A anne", "a anne" -> "Anne" / "anne"
      .replace(/\b[Aa][.,]?\s+(anne[a-zçğıöşü]*)\b/g, (match, word) => {
        const first = match.trim().charAt(0);
        return first === 'A' ? 'A' + word.slice(1) : word;
      })
      // Fix stuttered single-letter typos before words (e.g. "B bugün" -> "Bugün", "d danışan" -> "danışan", "A okul" -> "Okul")
      .replace(
        /(^|[\s(.,;:"'“‘\-–—])([a-zçğıöşüA-ZÇĞİÖŞÜ])[.,]?\s+([a-zçğıöşüA-ZÇĞİÖŞÜ]{3,})\b/gu,
        (full, prefix, singleCh, nextWord) => {
          const sLower = singleCh.toLocaleLowerCase('tr-TR');
          const wLower = nextWord.charAt(0).toLocaleLowerCase('tr-TR');
          if (
            sLower === wLower ||
            ((singleCh === 'A' || singleCh === 'a') &&
              nextWord.charAt(0) === nextWord.charAt(0).toLocaleLowerCase('tr-TR'))
          ) {
            const isUpper =
              singleCh === singleCh.toLocaleUpperCase('tr-TR') &&
              singleCh !== singleCh.toLocaleLowerCase('tr-TR');
            if (isUpper) {
              return `${prefix}${turkishUpperChar(nextWord.charAt(0))}${nextWord.slice(1)}`;
            }
            return `${prefix}${nextWord}`;
          }
          return full;
        }
      )
      // Fix common telegraphic/broken double-verb endings (cümle düşüklüğü kalıpları)
      .replace(/\bsöyledi\s+konuştu\b/gi, 'belirtti')
      .replace(/\bdedi\s+konuştu\b/gi, 'ifade etti')
      .replace(/\bdedi\s+söyledi\b/gi, 'belirtti')
      .replace(/\banlattı\s+konuştu\b/gi, 'anlattı')
      .replace(/\boldu\s+gibi\s+dedi\b/gi, 'olduğunu ifade etti')
      .replace(/\s+([.,!?;:])/g, '$1')
      .replace(/([.,!?;:])(?=[^\s.,!?;:\d])/g, '$1 ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    for (const [pattern, replacement] of wordReplacements) {
      text = text.replace(pattern, match => {
        const firstCh = match.charAt(0);
        const isFirstUpper =
          firstCh === firstCh.toLocaleUpperCase('tr-TR') &&
          firstCh !== firstCh.toLocaleLowerCase('tr-TR');
        if (isFirstUpper) {
          return turkishUpperChar(replacement.charAt(0)) + replacement.slice(1);
        }
        return replacement;
      });
    }

    // Capitalize the very first character of each line and every character following sentence-ending punctuation (. ! ? : ;)
    const lines = text
      .split('\n')
      .map(line => {
        let l = line.trim();
        if (!l) return '';
        // Capitalize first letter of the line (skipping leading bullets/dashes if any)
        l = l.replace(/^([\s•\-–—*]*)(["'“‘(]?)([a-zçğıöşüi])/u, (_, lead, quote, ch) => {
          return `${lead}${quote}${turkishUpperChar(ch)}`;
        });
        // Capitalize first letter after sentence punctuation (. ! ? :)
        l = l.replace(/([.!?]\s+)(["'“‘(]?)([a-zçğıöşüi])/gu, (_, punct, quote, ch) => {
          return `${punct}${quote}${turkishUpperChar(ch)}`;
        });
        // Ensure line ends with terminal punctuation if it ends with a word character
        if (/[a-zA-ZÇĞİÖŞÜçğıöşü0-9)]$/.test(l)) {
          l += '.';
        }
        return l;
      })
      .filter(Boolean);

    const correctedText = lines.join('\n');

    let correctedTitle = cleanPhaseTitle(rawTitleInput || '');
    if (!correctedTitle) {
      correctedTitle = deriveContextualTitleFromNote(correctedText);
    }
    if (correctedTitle) {
      correctedTitle = correctedTitle
        .split(/\s+/)
        .map(w => (w ? turkishUpperChar(w.charAt(0)) + w.slice(1) : ''))
        .join(' ')
        .replace(/[.!?]+$/, '')
        .trim();
    }

    return { correctedText, correctedTitle };
  };

  // Helper that calls /api/gemini/proofread-note using a CORS-safelisted GET request first (survives 302 auth redirects)
  // and falls back to a CORS-safelisted text/plain POST request for longer payloads
  const requestAiProofread = async (params: {
    text: string;
    phaseTitle?: string;
    clientName: string;
    sessionDate?: string;
    mode: 'session_note' | 'summary';
  }): Promise<{ correctedText: string; correctedTitle: string }> => {
    const queryParams = new URLSearchParams({
      text: params.text,
      phaseTitle: params.phaseTitle || '',
      clientName: params.clientName || '',
      sessionDate: params.sessionDate || '',
      mode: params.mode,
      _t: String(Date.now())
    });

    // 1. Simple GET request (no custom headers -> never blocked by CORS preflight on 302 redirects)
    if (params.text.length < 1800) {
      try {
        const getRes = await fetch(`/api/gemini/proofread-note?${queryParams.toString()}`, {
          method: 'GET',
          cache: 'no-store'
        });
        const ct = getRes.headers.get('content-type') || '';
        if (getRes.ok && ct.includes('application/json')) {
          const data = await getRes.json();
          const cText = String(data?.correctedText || '').trim();
          const cTitle = cleanPhaseTitle(String(data?.correctedTitle || '').trim());
          if (cText) {
            return { correctedText: cText, correctedTitle: cTitle };
          }
        }
      } catch (getErr) {
        console.warn('GET /api/gemini/proofread-note retry via POST:', getErr);
      }
    }

    // 2. Fallback: Simple POST request with text/plain (CORS-safelisted header)
    try {
      const postRes = await fetch(`/api/gemini/proofread-note?${queryParams.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(params),
        cache: 'no-store'
      });
      const ct = postRes.headers.get('content-type') || '';
      if (postRes.ok && ct.includes('application/json')) {
        const data = await postRes.json();
        return {
          correctedText: String(data?.correctedText || '').trim(),
          correctedTitle: cleanPhaseTitle(String(data?.correctedTitle || '').trim())
        };
      }
    } catch (postErr) {
      console.warn('POST /api/gemini/proofread-note fallback to local orthography:', postErr);
    }

    return { correctedText: '', correctedTitle: '' };
  };

  // Proofread a single session note using AI + guaranteed Turkish orthography/capitalization enforcement
  const handleProofreadSingleNote = async (
    sessionId: string,
    currentNoteText: string,
    currentTitleText = '',
    sessionDate = '',
    silentToast = false
  ): Promise<boolean> => {
    const trimmed = (currentNoteText || '').trim();
    if (!trimmed) return false;

    setProofreadingSessionId(sessionId);
    const startTime = Date.now();

    try {
      const cleanCurrentTitle = cleanPhaseTitle(currentTitleText);
      const { correctedText: aiText, correctedTitle: aiTitle } = await requestAiProofread({
        text: trimmed,
        phaseTitle: cleanCurrentTitle,
        clientName: displayTitle,
        sessionDate: sessionDate || '',
        mode: 'session_note'
      });

      // Always pass through Turkish orthography & sentence capitalization fixer so capital letters and punctuation are 100% guaranteed
      const { correctedText, correctedTitle } = correctTurkishNoteOrthography(
        aiText || trimmed,
        aiTitle || cleanCurrentTitle
      );

      // Ensure visible step progression when running one-by-one
      const elapsed = Date.now() - startTime;
      if (elapsed < 320) {
        await new Promise(resolve => setTimeout(resolve, 320 - elapsed));
      }

      const finalTextToApply = correctedText || trimmed;
      setCustomNotesById(prev => ({ ...prev, [sessionId]: finalTextToApply }));
      if (correctedTitle) {
        setCustomTitlesById(prev => ({ ...prev, [sessionId]: correctedTitle }));
      }

      // Also sync into aiReport state so timeline rendering is immediately updated everywhere
      setAiReport(prev => {
        if (!prev) return prev;
        const exists = prev.timelineItems.some(t => t.sessionId === sessionId);
        const updatedItems = exists
          ? prev.timelineItems.map(t =>
              t.sessionId === sessionId
                ? {
                    ...t,
                    formattedReportNote: finalTextToApply,
                    phaseTitle: correctedTitle || cleanPhaseTitle(t.phaseTitle)
                  }
                : t
            )
          : [
              ...prev.timelineItems,
              {
                sessionId,
                phaseTitle: correctedTitle,
                progressBadge: '',
                formattedReportNote: finalTextToApply,
                keyTakeaway: ''
              }
            ];
        return { ...prev, timelineItems: updatedItems };
      });

      setProofreadCompletedIds(prev => ({ ...prev, [sessionId]: true }));
      if (!silentToast && showToast) {
        showToast('Seans notunun imla, cümle yapısı ve başlığı düzenlendi.', 'success');
      }
      return true;
    } catch (err) {
      console.error('Error proofreading single note:', err);
      if (!silentToast && showToast) {
        showToast('İmla düzeltmesi sırasında bir hata oluştu.', 'error');
      }
      return false;
    } finally {
      setProofreadingSessionId(prev => (prev === sessionId ? null : prev));
    }
  };

  // Proofread all session notes ONE BY ONE sequentially so user sees live step-by-step correction
  const handleProofreadAllNotesOneByOne = async () => {
    if (isProofreadingAll || isFetchingCalendar || isGeneratingAi) return;

    const sessionsWithNotes = enrichedTimeline.filter(item => {
      const noteText = (item.aiItem.formattedReportNote || item.rawNote || '').trim();
      return noteText.length > 0;
    });

    if (sessionsWithNotes.length === 0) {
      if (showToast) {
        showToast('Rapor içinde imlası düzeltilecek seans notu bulunamadı.', 'info');
      }
      return;
    }

    setIsProofreadingAll(true);
    setProofreadProgress({ current: 0, total: sessionsWithNotes.length });

    let correctedCount = 0;
    try {
      for (let i = 0; i < sessionsWithNotes.length; i++) {
        const item = sessionsWithNotes[i];
        setProofreadProgress({ current: i + 1, total: sessionsWithNotes.length });
        const currentNote = (item.aiItem.formattedReportNote || item.rawNote || '').trim();
        const currentTitle = cleanPhaseTitle(item.aiItem.phaseTitle || '');
        const ok = await handleProofreadSingleNote(
          item.session.id,
          currentNote,
          currentTitle,
          item.formattedDate,
          true
        );
        if (ok) correctedCount++;
      }

      // Also proofread Executive Summary and Recommendations if present
      if (aiReport?.executiveSummary?.trim()) {
        try {
          const rawExec = aiReport.executiveSummary.trim();
          const { correctedText: aiExec } = await requestAiProofread({
            text: rawExec,
            clientName: displayTitle,
            mode: 'summary'
          });
          const { correctedText } = correctTurkishNoteOrthography(aiExec || rawExec);
          if (correctedText) {
            setAiReport(prev => (prev ? { ...prev, executiveSummary: correctedText } : prev));
          }
        } catch (e) {
          const { correctedText } = correctTurkishNoteOrthography(aiReport.executiveSummary);
          if (correctedText) {
            setAiReport(prev => (prev ? { ...prev, executiveSummary: correctedText } : prev));
          }
        }
      }

      if (aiReport?.recommendations?.trim()) {
        try {
          const rawRec = aiReport.recommendations.trim();
          const { correctedText: aiRec } = await requestAiProofread({
            text: rawRec,
            clientName: displayTitle,
            mode: 'summary'
          });
          const { correctedText } = correctTurkishNoteOrthography(aiRec || rawRec);
          if (correctedText) {
            setAiReport(prev => (prev ? { ...prev, recommendations: correctedText } : prev));
          }
        } catch (e) {
          const { correctedText } = correctTurkishNoteOrthography(aiReport.recommendations);
          if (correctedText) {
            setAiReport(prev => (prev ? { ...prev, recommendations: correctedText } : prev));
          }
        }
      }

      if (showToast) {
        showToast(
          `${correctedCount} seans notunun imla, yazım ve cümle yapısı yapay zeka ile tek tek düzenlendi.`,
          'success'
        );
      }
    } finally {
      setProofreadingSessionId(null);
      setIsProofreadingAll(false);
      setProofreadProgress(null);
    }
  };

  if (!isOpen) return null;

  const therapistDisplay = settings.therapistName?.trim() || 'Uzm. Psk. Büşra Bakır Kayacan';
  const reportDomain = (settings.therapistWebsite || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  const reportDateFormatted = formatSessionTurkishDate(new Date().toISOString().split('T')[0]).formattedDate;
  const appleFontStack =
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Plus Jakarta Sans", "Inter", sans-serif';

  // Ensure AI-generated text never duplicates the psychologist's name or title inside body paragraphs
  const sanitizeBodyText = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/Uzman Psikolog\s*(?:&|ve)?\s*Aile Danışmanı\s*/gi, '')
      .replace(/Uzm\.\s*Psk\.\s*/gi, '')
      .replace(/Büşra Bakır Kayacan\s*(?:kliniği|eşliğinde|tarafından)?\s*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  const escapeHtml = (str: string): string =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const handleDownloadWord = () => {
    try {
      const safeClientSlug = toTurkishAscii(displayTitle)
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      const todayStr = new Date().toISOString().split('T')[0];
      const filename = `${safeClientSlug || 'Danisan'}_Surec_Raporu_${todayStr}.doc`;

      const execSummaryText = sanitizeBodyText(
        aiReport?.executiveSummary ||
          `${displayTitle} ile ${reportStats.firstDate} – ${reportStats.lastDate} tarihleri arasında toplam ${reportStats.completedCount} görüşme gerçekleştirilmiştir.`
      );
      const recsText = sanitizeBodyText(aiReport?.recommendations || '');
      const themes = aiReport?.keyThemes || [];
      const firstSessionDate = enrichedTimeline[0]?.formattedDate || reportStats.firstDate;
      const lastSessionDate =
        enrichedTimeline[enrichedTimeline.length - 1]?.formattedDate || reportStats.lastDate;

      const timelineRowsHtml = enrichedTimeline
        .map((item, idx) => {
          const { session, sessionNumber, formattedDate, aiItem } = item;
          const isCancelled = session.type === 'cancelled';
          const isFaceToFace = session.type === 'face-to-face';
          const rawTitle = (aiItem.phaseTitle || '').trim();
          const displayPhaseTitle = rawTitle ? cleanPhaseTitle(rawTitle) : '';
          const displayNote = sanitizeBodyText(cleanReportNote(aiItem.formattedReportNote || ''));
          const hasNote = displayNote.length > 0;
          const isLastRow = idx === enrichedTimeline.length - 1;
          const borderBottom = isLastRow ? 'none' : '1px solid #E5E5EA';

          const financialHtml =
            includeFinancials && !isCancelled
              ? `<span style="font-size:8.5pt; color:#6E6E73; margin-left:6pt;">· ₺${(
                  session.price || 0
                ).toLocaleString('tr-TR')} (<span style="color:${
                  session.paymentStatus === 'paid' ? '#3C766B' : '#B45309'
                };">${session.paymentStatus === 'paid' ? 'Ödendi' : 'Bekliyor'}</span>)</span>`
              : '';

          // If there is NO note, render a sleek single-line compact row with just the session date & info
          if (!hasNote) {
            return `
              <tr>
                <td colspan="2" valign="middle" style="padding:6pt 0; border-bottom:${borderBottom};">
                  <span style="font-size:8.5pt; font-weight:600; color:${
                    isCancelled ? '#86868B' : '#3C766B'
                  }; display:inline-block; width:68pt;">
                    ${isCancelled ? 'İptal / Erteleme' : `${sessionNumber}. Seans`}
                  </span>
                  <span style="font-size:9.5pt; font-weight:600; color:#1D1D1F; margin-right:8pt;">
                    ${escapeHtml(formattedDate)}
                  </span>
                  <span style="font-size:8.5pt; color:#86868B;">
                    ${
                      isCancelled
                        ? escapeHtml(session.time || '00:00')
                        : `${isFaceToFace ? 'Yüz Yüze' : 'Online'} · ${escapeHtml(
                            session.time || '00:00'
                          )}`
                    }
                  </span>
                  ${financialHtml}
                </td>
              </tr>
            `;
          }

          return `
            <tr>
              <td valign="top" style="width:26%; padding:9pt 12pt 9pt 0; border-bottom:${borderBottom};">
                <div style="font-size:8.5pt; font-weight:600; color:${
                  isCancelled ? '#86868B' : '#3C766B'
                }; margin-bottom:1.5pt;">
                  ${isCancelled ? 'İptal / Erteleme' : `${sessionNumber}. Seans`}
                </div>
                <div style="font-size:9.5pt; font-weight:600; color:#1D1D1F; margin-bottom:1.5pt;">
                  ${escapeHtml(formattedDate)}
                </div>
                <div style="font-size:8.5pt; color:#86868B;">
                  ${
                    isCancelled
                      ? escapeHtml(session.time || '00:00')
                      : `${isFaceToFace ? 'Yüz Yüze' : 'Online'} · ${escapeHtml(
                          session.time || '00:00'
                        )}`
                  }
                </div>
              </td>
              <td valign="top" style="width:74%; padding:9pt 0 9pt 12pt; border-bottom:${borderBottom};">
                ${
                  displayPhaseTitle
                    ? `<div style="font-size:10pt; font-weight:600; color:#1D1D1F; margin-bottom:2.5pt;">${escapeHtml(
                        displayPhaseTitle
                      )}</div>`
                    : ''
                }
                <div style="font-size:9.5pt; line-height:1.55; color:#3A3A3C;">
                  ${escapeHtml(displayNote).replace(/\n/g, '<br/>')}
                </div>
              </td>
            </tr>
          `;
        })
        .join('');

      const financialSummaryCellHtml = includeFinancials
        ? `
          <td valign="top" style="width:25%; padding:10pt 12pt; border-left:1px solid #E5E5EA;">
            <div style="font-size:7.5pt; font-weight:600; text-transform:uppercase; letter-spacing:0.8pt; color:#86868B;">FİNANSAL ÖZET</div>
            <div style="font-size:11.5pt; font-weight:600; color:#1D1D1F; margin-top:3pt;">₺${reportStats.totalPaid.toLocaleString(
              'tr-TR'
            )}</div>
            <div style="font-size:8.5pt; color:${
              reportStats.totalUnpaid > 0 ? '#B45309' : '#3C766B'
            }; margin-top:1.5pt;">
              ${
                reportStats.totalUnpaid > 0
                  ? `Bekleyen: ₺${reportStats.totalUnpaid.toLocaleString('tr-TR')}`
                  : 'Tamamlandı'
              }
            </div>
          </td>
        `
        : '';

      const themesHtml =
        themes.length > 0
          ? `
            <div style="margin-top:8pt; padding-top:6pt; border-top:1px solid #F0F0F2; font-size:8.5pt;">
              <span style="color:#86868B; font-weight:500;">Odak Alanları:&nbsp;&nbsp;</span>
              <span style="color:#3C766B; font-weight:600;">${themes
                .map(t => escapeHtml(t))
                .join(' &nbsp;·&nbsp; ')}</span>
            </div>
          `
          : '';

      const recommendationsHtml = recsText
        ? `
          <table style="width:100%; background-color:#F5F5F7; border-radius:10pt; margin-bottom:18pt;">
            <tr>
              <td style="padding:12pt 14pt;">
                <div style="font-size:7.5pt; font-weight:600; text-transform:uppercase; letter-spacing:0.9pt; color:#3C766B; margin-bottom:4pt;">
                  SÜREÇ PLANI VE ÖNERİLER
                </div>
                <div style="font-size:9.5pt; line-height:1.55; color:#1D1D1F;">
                  ${escapeHtml(recsText).replace(/\n/g, '<br/>')}
                </div>
              </td>
            </tr>
          </table>
        `
        : '';

      const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:w="urn:schemas-microsoft-com:office:word"
        xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(displayTitle)} - Süreç ve İlerleme Raporu</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page WordSection1 {
            size: 595.3pt 841.9pt;
            margin: 36pt 42pt 36pt 42pt;
          }
          div.WordSection1 {
            page: WordSection1;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
            color: #1D1D1F;
            background-color: #FFFFFF;
            margin: 0;
            padding: 0;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
        </style>
      </head>
      <body>
        <div class="WordSection1">
          <!-- GROUP 1: HEADER -->
          <table style="width:100%; border-bottom:1px solid #E5E5EA; margin-bottom:14pt;">
            <tr>
              <td valign="bottom" style="padding-bottom:11pt;">
                <div style="font-size:7.5pt; font-weight:600; text-transform:uppercase; letter-spacing:1.2pt; color:#3C766B; margin-bottom:3pt;">
                  SÜREÇ VE İLERLEME RAPORU
                </div>
                <div style="font-size:20pt; font-weight:600; color:#1D1D1F; letter-spacing:-0.4pt;">
                  ${escapeHtml(displayTitle)}
                </div>
              </td>
              <td valign="bottom" align="right" style="padding-bottom:11pt; text-align:right;">
                <div style="font-size:7pt; font-weight:600; text-transform:uppercase; letter-spacing:0.8pt; color:#86868B; margin-bottom:2pt;">
                  RAPOR TARİHİ
                </div>
                <div style="font-size:9.5pt; font-weight:500; color:#1D1D1F;">
                  ${escapeHtml(reportDateFormatted)}
                </div>
              </td>
            </tr>
          </table>

          <!-- GROUP 2: UNIFIED SUMMARY BAR -->
          <table style="width:100%; background-color:#F5F5F7; border-radius:10pt; margin-bottom:16pt;">
            <tr>
              <td valign="top" style="width:${includeFinancials ? '25%' : '34%'}; padding:10pt 12pt;">
                <div style="font-size:7pt; font-weight:600; text-transform:uppercase; letter-spacing:0.8pt; color:#86868B;">TOPLAM GÖRÜŞME</div>
                <div style="font-size:13pt; font-weight:600; color:#1D1D1F; margin-top:2.5pt;">${
                  reportStats.completedCount
                } Seans</div>
                <div style="font-size:8pt; color:#6E6E73; margin-top:1.5pt;">${
                  reportStats.onlineCount
                } Online · ${reportStats.faceToFaceCount} Yüz Yüze</div>
              </td>
              <td valign="top" style="width:${
                includeFinancials ? '25%' : '33%'
              }; padding:10pt 12pt; border-left:1px solid #E5E5EA;">
                <div style="font-size:7pt; font-weight:600; text-transform:uppercase; letter-spacing:0.8pt; color:#86868B;">BAŞLANGIÇ TARİHİ</div>
                <div style="font-size:11pt; font-weight:600; color:#1D1D1F; margin-top:3pt;">${escapeHtml(
                  reportStats.firstDate
                )}</div>
                <div style="font-size:8pt; color:#6E6E73; margin-top:1.5pt;">İlk Oturum</div>
              </td>
              <td valign="top" style="width:${
                includeFinancials ? '25%' : '33%'
              }; padding:10pt 12pt; border-left:1px solid #E5E5EA;">
                <div style="font-size:7pt; font-weight:600; text-transform:uppercase; letter-spacing:0.8pt; color:#86868B;">SON GÖRÜŞME</div>
                <div style="font-size:11pt; font-weight:600; color:#1D1D1F; margin-top:3pt;">${escapeHtml(
                  reportStats.lastDate
                )}</div>
                <div style="font-size:8pt; color:#6E6E73; margin-top:1.5pt;">Güncel Oturum</div>
              </td>
              ${financialSummaryCellHtml}
            </tr>
          </table>

          <!-- GROUP 3: EXECUTIVE CLINICAL EVALUATION -->
          <div style="margin-bottom:16pt;">
            <div style="font-size:7.5pt; font-weight:600; text-transform:uppercase; letter-spacing:0.9pt; color:#86868B; margin-bottom:4pt;">
              GENEL DEĞERLENDİRME
            </div>
            <div style="font-size:9.5pt; line-height:1.6; color:#1D1D1F;">
              ${escapeHtml(execSummaryText).replace(/\n/g, '<br/>')}
            </div>
            ${themesHtml}
          </div>

          <!-- GROUP 4: SESSION TIMELINE -->
          ${
            enrichedTimeline.length > 0
              ? `
                <table style="width:100%; border-bottom:1px solid #D2D2D7; margin-bottom:2pt;">
                  <tr>
                    <td style="padding-bottom:5pt; font-size:7.5pt; font-weight:600; text-transform:uppercase; letter-spacing:0.9pt; color:#86868B;">
                      SEANS SÜRECİ
                    </td>
                    <td align="right" style="padding-bottom:5pt; font-size:8pt; color:#86868B; text-align:right;">
                      ${escapeHtml(firstSessionDate)} – ${escapeHtml(lastSessionDate)}
                    </td>
                  </tr>
                </table>
                <table style="width:100%; margin-bottom:16pt;">
                  ${timelineRowsHtml}
                </table>
              `
              : ''
          }

          <!-- GROUP 5: RECOMMENDATIONS -->
          ${recommendationsHtml}

          <!-- FOOTER: DOMAIN BOTTOM-LEFT, PSYCHOLOGIST ONCE AT BOTTOM-RIGHT -->
          <table style="width:100%; border-top:1px solid #E5E5EA; padding-top:10pt;">
            <tr>
              <td valign="bottom" style="padding-top:10pt;">
                ${
                  reportDomain
                    ? `<span style="color:#3C766B; font-size:9.5pt;">&#9679;</span>&nbsp;<span style="font-size:9pt; font-weight:500; color:#6E6E73;">${escapeHtml(
                        reportDomain
                      )}</span>`
                    : ''
                }
              </td>
              <td valign="bottom" align="right" style="padding-top:10pt; text-align:right;">
                <div style="font-size:9.5pt; font-weight:600; color:#1D1D1F;">
                  ${escapeHtml(therapistDisplay)}
                </div>
                <div style="font-size:8pt; color:#86868B; margin-top:1pt;">
                  Uzman Psikolog &amp; Aile Danışmanı
                </div>
              </td>
            </tr>
          </table>
        </div>
      </body>
      </html>`;

      const blob = new Blob(['\ufeff', wordHtml], {
        type: 'application/msword;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      if (showToast) {
        showToast('Word raporu (.doc) indirildi.', 'success');
      }
    } catch (err) {
      console.error('Word export error:', err);
      if (showToast) {
        showToast('Word dosyası oluşturulurken bir hata oluştu.', 'error');
      }
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[180] flex items-center justify-center bg-black/50 backdrop-blur-md p-2 sm:p-4 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-[#F5F5F7] w-full max-w-5xl h-[94dvh] rounded-3xl border border-black/10 shadow-2xl flex flex-col overflow-hidden"
          style={{ fontFamily: appleFontStack }}
        >
          {/* Minimal Apple-Style Modal Header */}
          <div className="bg-white/90 backdrop-blur-xl px-5 sm:px-7 py-3.5 border-b border-[#E5E5EA] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] flex items-center justify-center text-[#1D1D1F] shrink-0">
                <FileText className="w-4 h-4 text-[#3C766B]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm sm:text-[15px] font-semibold text-[#1D1D1F] tracking-tight truncate">
                    {displayTitle}
                  </h2>
                  <span className="text-xs text-[#86868B] font-normal tabular-nums">
                    · {paginatedPages.length} Sayfa
                  </span>
                </div>
                <p className="text-[11px] text-[#86868B] truncate">
                  Danışan Süreç ve İlerleme Raporu
                </p>
              </div>
            </div>

            {/* Clean Action Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleProofreadAllNotesOneByOne}
                disabled={isFetchingCalendar || isGeneratingAi || isProofreadingAll}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                  isProofreadingAll
                    ? 'bg-[#3C766B] text-white border-[#3C766B]'
                    : 'bg-[#3C766B]/10 hover:bg-[#3C766B]/20 text-[#26423D] border-[#3C766B]/30'
                }`}
                title="Yapay zeka ile tüm seans notlarının imla ve yazım hatalarını tek tek düzelt"
              >
                <Sparkles className={`w-3.5 h-3.5 text-[#3C766B] ${isProofreadingAll ? 'text-white animate-spin' : ''}`} />
                <span>
                  {isProofreadingAll && proofreadProgress
                    ? `İmla Düzeltiliyor (${proofreadProgress.current}/${proofreadProgress.total})...`
                    : 'AI İmla Düzelt'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleGenerateReport(true)}
                disabled={isFetchingCalendar || isGeneratingAi || isProofreadingAll}
                className="px-3 py-1.5 rounded-lg border border-[#D2D2D7] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Rapor içeriğini yenile"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#3C766B] ${(isFetchingCalendar || isGeneratingAi) ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">
                  {isFetchingCalendar || isGeneratingAi ? 'Güncelleniyor...' : 'Yenile'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsEditMode(prev => !prev);
                  setEditingNoteSessionId(null);
                }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isEditMode
                    ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                    : 'bg-white border-[#D2D2D7] text-[#1D1D1F] hover:bg-[#F5F5F7]'
                }`}
              >
                {isEditMode ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                <span>{isEditMode ? 'Tamamla' : 'Metinleri Düzenle'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIncludeFinancials(prev => !prev)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  includeFinancials
                    ? 'bg-[#3C766B]/10 border-[#3C766B]/30 text-[#26423D]'
                    : 'bg-white border-[#D2D2D7] text-[#6E6E73] hover:bg-[#F5F5F7]'
                }`}
              >
                {includeFinancials ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span className="hidden md:inline">Finansal Özet</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-[#F5F5F7] hover:bg-[#E5E5EA] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                title="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Subtle Loading Strip */}
          {(isFetchingCalendar || isGeneratingAi || isProofreadingAll || Boolean(proofreadingSessionId)) && (
            <div className="px-6 py-2 bg-[#1D1D1F] text-white text-xs font-medium flex items-center justify-center gap-2 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-[#3C766B] animate-pulse" />
              <span>
                {isFetchingCalendar
                  ? 'Danışanın görüşme notları alınıyor...'
                  : isProofreadingAll && proofreadProgress
                  ? `Yapay zeka seans notlarının imla ve yazımını tek tek düzeltiyor (${proofreadProgress.current} / ${proofreadProgress.total})...`
                  : proofreadingSessionId
                  ? 'Seçili seans notunun imla ve yazımı düzeltiliyor...'
                  : 'Süreç ve ilerleme raporu düzenleniyor...'}
              </span>
            </div>
          )}

          {/* Scrollable Multi-Page A4 Preview Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 bg-[#E8E8ED]">
            {paginatedPages.map((page, pIdx) => (
              <div key={pIdx} className="mx-auto" style={{ width: '794px', maxWidth: '100%' }}>
                {/* Subtle Page Label outside A4 */}
                <div className="flex items-center justify-between mb-2 px-1 text-[11px] text-[#6E6E73] font-medium tabular-nums">
                  <span>
                    Sayfa {pIdx + 1} / {paginatedPages.length}
                  </span>
                  <span>A4</span>
                </div>

                {/* ======================================================== */}
                {/* A4 SHEET — APPLE DESIGN SYSTEM EDITORIAL HIERARCHY       */}
                {/* ======================================================== */}
                <div
                  ref={el => {
                    pageRefs.current[pIdx] = el;
                  }}
                  className="bg-white shadow-sm flex flex-col justify-between relative overflow-hidden mx-auto"
                  style={{
                    width: '794px',
                    minHeight: '1123px',
                    padding: '40px 48px 32px 48px',
                    color: '#1D1D1F',
                    fontFamily: appleFontStack,
                    WebkitFontSmoothing: 'antialiased'
                  }}
                >
                  <div className="space-y-5">
                    {/* ======================================================== */}
                    {/* GROUP 1: DOCUMENT HEADER (NO DUPLICATE PSYCHOLOGIST NAME)*/}
                    {/* ======================================================== */}
                    {page.isFirstPage ? (
                      <header
                        className="pb-4 flex items-end justify-between gap-8"
                        style={{ borderBottom: '1px solid #E5E5EA' }}
                      >
                        <div className="space-y-1">
                          <div
                            className="text-[10px] font-semibold uppercase"
                            style={{ letterSpacing: '0.14em', color: '#3C766B' }}
                          >
                            SÜREÇ VE İLERLEME RAPORU
                          </div>
                          <h1
                            className="text-[25px] font-semibold leading-tight"
                            style={{ letterSpacing: '-0.025em', color: '#1D1D1F' }}
                          >
                            {displayTitle}
                          </h1>
                        </div>

                        <div className="text-right space-y-0.5 shrink-0">
                          <div
                            className="text-[9.5px] font-semibold uppercase"
                            style={{ letterSpacing: '0.08em', color: '#86868B' }}
                          >
                            RAPOR TARİHİ
                          </div>
                          <div
                            className="text-[12px] font-medium tabular-nums"
                            style={{ color: '#1D1D1F' }}
                          >
                            {reportDateFormatted}
                          </div>
                        </div>
                      </header>
                    ) : (
                      <header
                        className="pb-3 flex items-center justify-between gap-4"
                        style={{ borderBottom: '1px solid #E5E5EA' }}
                      >
                        <div
                          className="text-[13px] font-semibold"
                          style={{ letterSpacing: '-0.01em', color: '#1D1D1F' }}
                        >
                          {displayTitle}
                        </div>
                        <div className="text-[11px] tabular-nums" style={{ color: '#86868B' }}>
                          Süreç ve İlerleme Raporu · {reportDateFormatted}
                        </div>
                      </header>
                    )}

                    {/* ======================================================== */}
                    {/* GROUP 2 & 3 (PAGE 1): UNIFIED SUMMARY & EVALUATION       */}
                    {/* ======================================================== */}
                    {page.isFirstPage && (
                      <div className="space-y-5">
                        {/* GROUP 2: Unified Apple-Style Grouped Summary Strip */}
                        <section
                          className="rounded-2xl px-5 py-3.5"
                          style={{ backgroundColor: '#F5F5F7' }}
                        >
                          <div
                            className={`grid ${
                              includeFinancials ? 'grid-cols-4' : 'grid-cols-3'
                            } gap-5`}
                          >
                            <div>
                              <div
                                className="text-[9.5px] font-semibold uppercase"
                                style={{ letterSpacing: '0.08em', color: '#86868B' }}
                              >
                                TOPLAM GÖRÜŞME
                              </div>
                              <div
                                className="mt-0.5 text-[18px] font-semibold tabular-nums"
                                style={{ letterSpacing: '-0.02em', color: '#1D1D1F' }}
                              >
                                {reportStats.completedCount} Seans
                              </div>
                              <div className="text-[10.5px] mt-0.5 tabular-nums" style={{ color: '#6E6E73' }}>
                                {reportStats.onlineCount} Online · {reportStats.faceToFaceCount} Yüz Yüze
                              </div>
                            </div>

                            <div
                              className="pl-5"
                              style={{ borderLeft: '1px solid #E5E5EA' }}
                            >
                              <div
                                className="text-[9.5px] font-semibold uppercase"
                                style={{ letterSpacing: '0.08em', color: '#86868B' }}
                              >
                                BAŞLANGIÇ TARİHİ
                              </div>
                              <div
                                className="mt-1 text-[14px] font-semibold tabular-nums"
                                style={{ letterSpacing: '-0.01em', color: '#1D1D1F' }}
                              >
                                {reportStats.firstDate}
                              </div>
                              <div className="text-[10.5px] mt-0.5" style={{ color: '#6E6E73' }}>
                                İlk Oturum
                              </div>
                            </div>

                            <div
                              className="pl-5"
                              style={{ borderLeft: '1px solid #E5E5EA' }}
                            >
                              <div
                                className="text-[9.5px] font-semibold uppercase"
                                style={{ letterSpacing: '0.08em', color: '#86868B' }}
                              >
                                SON GÖRÜŞME
                              </div>
                              <div
                                className="mt-1 text-[14px] font-semibold tabular-nums"
                                style={{ letterSpacing: '-0.01em', color: '#1D1D1F' }}
                              >
                                {reportStats.lastDate}
                              </div>
                              <div className="text-[10.5px] mt-0.5" style={{ color: '#6E6E73' }}>
                                Güncel Oturum
                              </div>
                            </div>

                            {includeFinancials && (
                              <div
                                className="pl-5"
                                style={{ borderLeft: '1px solid #E5E5EA' }}
                              >
                                <div
                                  className="text-[9.5px] font-semibold uppercase"
                                  style={{ letterSpacing: '0.08em', color: '#86868B' }}
                                >
                                  FİNANSAL ÖZET
                                </div>
                                <div
                                  className="mt-1 text-[14px] font-semibold tabular-nums"
                                  style={{ letterSpacing: '-0.01em', color: '#1D1D1F' }}
                                >
                                  ₺{reportStats.totalPaid.toLocaleString('tr-TR')}
                                </div>
                                <div
                                  className="text-[10.5px] mt-0.5 tabular-nums"
                                  style={{
                                    color: reportStats.totalUnpaid > 0 ? '#B45309' : '#3C766B'
                                  }}
                                >
                                  {reportStats.totalUnpaid > 0
                                    ? `Bekleyen: ₺${reportStats.totalUnpaid.toLocaleString('tr-TR')}`
                                    : 'Tamamlandı'}
                                </div>
                              </div>
                            )}
                          </div>
                        </section>

                        {/* GROUP 3: Executive Clinical Synthesis & Focus Themes */}
                        <section className="space-y-2">
                          <div
                            className="text-[10px] font-semibold uppercase"
                            style={{ letterSpacing: '0.1em', color: '#86868B' }}
                          >
                            GENEL DEĞERLENDİRME
                          </div>

                          {isEditMode ? (
                            <textarea
                              value={aiReport?.executiveSummary || ''}
                              onChange={e =>
                                setAiReport(prev =>
                                  prev ? { ...prev, executiveSummary: e.target.value } : prev
                                )
                              }
                              rows={3}
                              className="w-full p-2.5 text-[12.5px] bg-[#F5F5F7] border border-[#D2D2D7] rounded-xl focus:outline-none"
                            />
                          ) : (
                            <p
                              className="text-[12.5px] leading-[1.6]"
                              style={{ color: '#1D1D1F' }}
                            >
                              {sanitizeBodyText(
                                aiReport?.executiveSummary ||
                                  `${displayTitle} ile ${reportStats.firstDate} – ${reportStats.lastDate} tarihleri arasında toplam ${reportStats.completedCount} görüşme gerçekleştirilmiştir.`
                              )}
                            </p>
                          )}

                          {aiReport?.keyThemes && aiReport.keyThemes.length > 0 && (
                            <div
                              className="pt-2 flex items-baseline gap-3"
                              style={{ borderTop: '1px solid #F0F0F2' }}
                            >
                              <span
                                className="text-[10.5px] font-medium shrink-0"
                                style={{ color: '#86868B' }}
                              >
                                Odak Alanları
                              </span>
                              <div
                                className="text-[11.5px] font-medium flex items-center gap-2 flex-wrap"
                                style={{ color: '#3C766B' }}
                              >
                                {aiReport.keyThemes.map((theme, tIdx) => (
                                  <React.Fragment key={tIdx}>
                                    {tIdx > 0 && (
                                      <span style={{ color: '#D2D2D7' }}>·</span>
                                    )}
                                    <span>{theme}</span>
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>
                          )}
                        </section>
                      </div>
                    )}

                    {/* ======================================================== */}
                    {/* GROUP 4: CHRONOLOGICAL SESSION TIMELINE                  */}
                    {/* ======================================================== */}
                    {page.items.length > 0 && (
                      <section className="space-y-0.5">
                        <div
                          className="pb-2 flex items-center justify-between"
                          style={{ borderBottom: '1px solid #D2D2D7' }}
                        >
                          <span
                            className="text-[10px] font-semibold uppercase"
                            style={{ letterSpacing: '0.1em', color: '#86868B' }}
                          >
                            {page.isFirstPage ? 'SEANS SÜRECİ' : 'SEANS SÜRECİ (DEVAMI)'}
                          </span>
                          <span
                            className="text-[10.5px] tabular-nums"
                            style={{ color: '#86868B' }}
                          >
                            {page.items[0].formattedDate} –{' '}
                            {page.items[page.items.length - 1].formattedDate}
                          </span>
                        </div>

                        {/* Clean Hierarchical Rows — Compact 1-line when no note, 2-column when note exists */}
                        <div>
                          {page.items.map((item, idx) => {
                            const { session, sessionNumber, formattedDate, aiItem } = item;
                            const isCancelled = session.type === 'cancelled';
                            const isFaceToFace = session.type === 'face-to-face';
                            const rawTitle = (aiItem.phaseTitle || '').trim();
                            const displayPhaseTitle = rawTitle ? cleanPhaseTitle(rawTitle) : '';
                            const displayNote = sanitizeBodyText(
                              cleanReportNote(aiItem.formattedReportNote || '')
                            );
                            const hasNote = displayNote.length > 0;
                            const isEditingThisNote =
                              isEditMode || editingNoteSessionId === session.id;

                            // COMPACT SINGLE-LINE ROW WHEN NO NOTE EXISTS (AND NOT CURRENTLY TYPING A NOTE)
                            if (!hasNote && !isEditingThisNote) {
                              return (
                                <div
                                  key={session.id}
                                  className="py-1.5 flex items-center justify-between gap-4"
                                  style={{
                                    borderBottom:
                                      idx === page.items.length - 1
                                        ? 'none'
                                        : '1px solid #F0F0F2'
                                  }}
                                >
                                  <div className="flex items-center gap-3 min-w-0 tabular-nums">
                                    <span
                                      className="text-[11px] font-semibold w-20 shrink-0"
                                      style={{
                                        color: isCancelled ? '#86868B' : '#3C766B'
                                      }}
                                    >
                                      {isCancelled
                                        ? 'İptal / Erteleme'
                                        : `${sessionNumber}. Seans`}
                                    </span>
                                    <span
                                      className="text-[12.5px] font-semibold"
                                      style={{
                                        letterSpacing: '-0.01em',
                                        color: '#1D1D1F'
                                      }}
                                    >
                                      {formattedDate}
                                    </span>
                                    <span
                                      className="text-[11px]"
                                      style={{ color: '#86868B' }}
                                    >
                                      {isCancelled
                                        ? session.time || '00:00'
                                        : `${isFaceToFace ? 'Yüz Yüze' : 'Online'} · ${
                                            session.time || '00:00'
                                          }`}
                                    </span>
                                    {includeFinancials && !isCancelled && (
                                      <span
                                        className="text-[10.5px] font-medium"
                                        style={{ color: '#6E6E73' }}
                                      >
                                        · ₺{(session.price || 0).toLocaleString('tr-TR')} (
                                        <span
                                          style={{
                                            color:
                                              session.paymentStatus === 'paid'
                                                ? '#3C766B'
                                                : '#B45309'
                                          }}
                                        >
                                          {session.paymentStatus === 'paid'
                                            ? 'Ödendi'
                                            : 'Bekliyor'}
                                        </span>
                                        )
                                      </span>
                                    )}
                                  </div>

                                  {/* Interactive "Not yok · + Not Ekle" shown on screen, ignored during PDF/Word export so only session date is printed if user doesn't add a note */}
                                  {!isExportingPdf && (
                                    <div
                                      data-export-ignore="true"
                                      className="flex items-center gap-2 shrink-0"
                                    >
                                      <span
                                        className="text-[11px]"
                                        style={{ color: '#AEAEB2' }}
                                      >
                                        Not yok
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setEditingNoteSessionId(session.id)}
                                        className="px-2 py-0.5 rounded-md text-[10.5px] font-medium border border-[#E5E5EA] hover:border-[#3C766B] text-[#3C766B] bg-[#F5F5F7]/70 hover:bg-[#3C766B]/5 transition-colors cursor-pointer"
                                      >
                                        + Not Ekle
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            // 2-COLUMN ROW WHEN SESSION HAS A NOTE OR USER IS ADDING/EDITING A NOTE
                            return (
                              <div
                                key={session.id}
                                className="py-2.5 flex items-start gap-5"
                                style={{
                                  borderBottom:
                                    idx === page.items.length - 1
                                      ? 'none'
                                      : '1px solid #E5E5EA'
                                }}
                              >
                                {/* Left Column: Session Identity & Date Metadata */}
                                <div className="w-36 shrink-0 space-y-0.5 tabular-nums">
                                  <div
                                    className="text-[11px] font-semibold"
                                    style={{
                                      color: isCancelled ? '#86868B' : '#3C766B'
                                    }}
                                  >
                                    {isCancelled
                                      ? 'İptal / Erteleme'
                                      : `${sessionNumber}. Seans`}
                                  </div>
                                  <div
                                    className="text-[12.5px] font-semibold"
                                    style={{
                                      letterSpacing: '-0.01em',
                                      color: '#1D1D1F'
                                    }}
                                  >
                                    {formattedDate}
                                  </div>
                                  <div
                                    className="text-[11px]"
                                    style={{ color: '#86868B' }}
                                  >
                                    {isCancelled
                                      ? session.time || '00:00'
                                      : `${isFaceToFace ? 'Yüz Yüze' : 'Online'} · ${
                                          session.time || '00:00'
                                        }`}
                                  </div>
                                  {includeFinancials && !isCancelled && (
                                    <div
                                      className="text-[10.5px] pt-0.5 font-medium"
                                      style={{ color: '#6E6E73' }}
                                    >
                                      ₺{(session.price || 0).toLocaleString('tr-TR')} ·{' '}
                                      <span
                                        style={{
                                          color:
                                            session.paymentStatus === 'paid'
                                              ? '#3C766B'
                                              : '#B45309'
                                        }}
                                      >
                                        {session.paymentStatus === 'paid'
                                          ? 'Ödendi'
                                          : 'Bekliyor'}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Right Column: Focus Heading & Clinical Process Note */}
                                <div className="flex-1 min-w-0 space-y-1">
                                  {isEditingThisNote ? (
                                    <div className="space-y-1.5" data-export-ignore={!hasNote ? 'true' : undefined}>
                                      <input
                                        type="text"
                                        placeholder="Başlık (isteğe bağlı)"
                                        value={aiItem.phaseTitle}
                                        onChange={e =>
                                          handleUpdateTimelineItem(
                                            session.id,
                                            'phaseTitle',
                                            e.target.value
                                          )
                                        }
                                        className="w-full text-[12.5px] font-semibold px-2.5 py-1 bg-[#F5F5F7] border border-[#D2D2D7] rounded-lg focus:outline-none"
                                      />
                                      <textarea
                                        placeholder="Bu seans için not yazın (boş bırakılırsa sadece seans tarihi yer alır)..."
                                        value={aiItem.formattedReportNote}
                                        onChange={e =>
                                          handleUpdateTimelineItem(
                                            session.id,
                                            'formattedReportNote',
                                            e.target.value
                                          )
                                        }
                                        rows={2}
                                        autoFocus={editingNoteSessionId === session.id}
                                        className="w-full p-2 text-[12px] bg-[#F5F5F7] border border-[#D2D2D7] rounded-lg focus:outline-none"
                                      />
                                      <div className="flex items-center justify-between gap-2">
                                        <button
                                          type="button"
                                          disabled={
                                            !aiItem.formattedReportNote?.trim() ||
                                            proofreadingSessionId === session.id
                                          }
                                          onClick={() =>
                                            handleProofreadSingleNote(
                                              session.id,
                                              aiItem.formattedReportNote,
                                              aiItem.phaseTitle,
                                              formattedDate
                                            )
                                          }
                                          className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#3C766B]/10 hover:bg-[#3C766B]/20 text-[#26423D] border border-[#3C766B]/30 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                                        >
                                          <Sparkles
                                            className={`w-3 h-3 text-[#3C766B] ${
                                              proofreadingSessionId === session.id ? 'animate-spin' : ''
                                            }`}
                                          />
                                          <span>
                                            {proofreadingSessionId === session.id
                                              ? 'Düzeltiliyor...'
                                              : 'AI İmla Düzelt'}
                                          </span>
                                        </button>

                                        {editingNoteSessionId === session.id && !isEditMode && (
                                          <button
                                            type="button"
                                            onClick={() => setEditingNoteSessionId(null)}
                                            className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#1D1D1F] text-white cursor-pointer"
                                          >
                                            Tamam
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="group relative">
                                      <div className="flex items-center justify-between gap-2">
                                        {displayPhaseTitle ? (
                                          <h4
                                            className="text-[13px] font-semibold mb-0.5"
                                            style={{
                                              letterSpacing: '-0.01em',
                                              color: '#1D1D1F'
                                            }}
                                          >
                                            {displayPhaseTitle}
                                          </h4>
                                        ) : (
                                          <span />
                                        )}

                                        {!isExportingPdf && proofreadingSessionId === session.id && (
                                          <span
                                            data-export-ignore="true"
                                            className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[#3C766B] bg-[#3C766B]/10 px-2 py-0.5 rounded-md"
                                          >
                                            <Sparkles className="w-3 h-3 animate-spin" />
                                            İmla düzeltiliyor...
                                          </span>
                                        )}

                                        {!isExportingPdf &&
                                          proofreadingSessionId !== session.id &&
                                          proofreadCompletedIds[session.id] && (
                                            <span
                                              data-export-ignore="true"
                                              className="inline-flex items-center gap-1 text-[10px] font-medium text-[#3C766B]"
                                            >
                                              <Check className="w-3 h-3" />
                                              İmla düzeltildi
                                            </span>
                                          )}
                                      </div>

                                      <p
                                        className="text-[12px] leading-[1.55] whitespace-pre-line"
                                        style={{ color: '#3A3A3C' }}
                                      >
                                        {displayNote}
                                      </p>
                                      {!isExportingPdf && (
                                        <div
                                          data-export-ignore="true"
                                          className="opacity-0 group-hover:opacity-100 absolute top-0 right-0 flex items-center gap-1.5 transition-opacity"
                                        >
                                          <button
                                            type="button"
                                            disabled={Boolean(proofreadingSessionId) || isProofreadingAll}
                                            onClick={() =>
                                              handleProofreadSingleNote(
                                                session.id,
                                                displayNote,
                                                displayPhaseTitle,
                                                formattedDate
                                              )
                                            }
                                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#F5F5F7] border border-[#3C766B]/30 text-[#26423D] hover:bg-[#3C766B]/10 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                                            title="Bu seans notunun imla ve yazımını yapay zeka ile düzelt"
                                          >
                                            <Sparkles className="w-2.5 h-2.5 text-[#3C766B]" />
                                            <span>İmla Düzelt</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditingNoteSessionId(session.id)}
                                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#F5F5F7] border border-[#D2D2D7] text-[#6E6E73] hover:text-[#1D1D1F] cursor-pointer"
                                          >
                                            Düzenle
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {/* ======================================================== */}
                    {/* GROUP 5 (FINAL PAGE): RECOMMENDATIONS                    */}
                    {/* ======================================================== */}
                    {page.includeRecommendations && (
                      <section className="pt-1">
                        <div
                          className="rounded-2xl p-4 space-y-1.5"
                          style={{ backgroundColor: '#F5F5F7' }}
                        >
                          <div
                            className="text-[10px] font-semibold uppercase"
                            style={{ letterSpacing: '0.1em', color: '#3C766B' }}
                          >
                            SÜREÇ PLANI VE ÖNERİLER
                          </div>
                          {isEditMode ? (
                            <textarea
                              value={aiReport?.recommendations || ''}
                              onChange={e =>
                                setAiReport(prev =>
                                  prev ? { ...prev, recommendations: e.target.value } : prev
                                )
                              }
                              rows={2}
                              placeholder="Süreç planı veya öneri ekleyin (boş bırakılırsa raporda gösterilmez)..."
                              className="w-full p-2 text-[12px] bg-white border border-[#D2D2D7] rounded-lg focus:outline-none"
                            />
                          ) : (
                            <p
                              className="text-[12px] leading-[1.55]"
                              style={{ color: '#1D1D1F' }}
                            >
                              {sanitizeBodyText(aiReport?.recommendations || '')}
                            </p>
                          )}
                        </div>
                      </section>
                    )}
                  </div>

                  {/* ======================================================== */}
                  {/* FOOTER: DOMAIN BOTTOM-LEFT, PSYCHOLOGIST ONCE AT RIGHT   */}
                  {/* ======================================================== */}
                  <footer className="pt-4">
                    <div
                      className="pt-3 flex items-end justify-between gap-6"
                      style={{ borderTop: '1px solid #E5E5EA' }}
                    >
                      {/* Bottom-Left: User's configured domain from Settings */}
                      <div className="space-y-1">
                        {reportDomain && (
                          <div className="flex items-center gap-2 text-[11.5px]">
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: '#3C766B' }}
                            />
                            <span className="font-medium" style={{ color: '#6E6E73' }}>
                              {reportDomain}
                            </span>
                          </div>
                        )}
                        {paginatedPages.length > 1 && (
                          <div
                            className="text-[10.5px] tabular-nums"
                            style={{ color: '#86868B' }}
                          >
                            Sayfa {pIdx + 1} / {paginatedPages.length}
                          </div>
                        )}
                      </div>

                      {/* Bottom-Right: Psychologist Name & Title (Rendered ONLY ONCE on the final page) */}
                      {page.isLastPage ? (
                        <div className="text-right space-y-0.5 shrink-0">
                          <div
                            className="text-[13px] font-semibold"
                            style={{ color: '#1D1D1F' }}
                          >
                            {therapistDisplay}
                          </div>
                          <div className="text-[11px]" style={{ color: '#86868B' }}>
                            Uzman Psikolog & Aile Danışmanı
                          </div>
                        </div>
                      ) : (
                        <div
                          className="text-[10.5px] tabular-nums"
                          style={{ color: '#86868B' }}
                        >
                          Sayfa {pIdx + 1} / {paginatedPages.length}
                        </div>
                      )}
                    </div>
                  </footer>
                </div>
              </div>
            ))}
          </div>

          {/* Sticky Bottom Action Bar */}
          <div className="bg-white/95 backdrop-blur-xl px-5 sm:px-7 py-3.5 border-t border-[#E5E5EA] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 text-xs">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[#6E6E73] font-medium">
                <input
                  type="checkbox"
                  checked={includeCancelled}
                  onChange={e => setIncludeCancelled(e.target.checked)}
                  className="rounded border-[#D2D2D7] text-[#3C766B] focus:ring-[#3C766B] cursor-pointer"
                />
                <span>İptal Edilen Görüşmeleri Göster</span>
              </label>
            </div>

            <div className="flex items-center gap-2.5 ml-auto flex-wrap">
              <button
                type="button"
                onClick={handleDownloadWord}
                disabled={isGeneratingAi}
                className="px-4 py-2 rounded-xl border border-[#D2D2D7] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                title="Aynı tasarımla Word belgesi (.doc) olarak indir"
              >
                <FileText className="w-3.5 h-3.5 text-[#3C766B]" />
                <span>Word İndir</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExportingPdf || isGeneratingAi}
                className="px-4 py-2 rounded-xl border border-[#D2D2D7] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-[#1D1D1F]" />
                <span>{isExportingPdf ? 'Hazırlanıyor...' : 'PDF İndir'}</span>
              </button>

              <button
                type="button"
                onClick={handleSharePdf}
                disabled={isExportingPdf || isGeneratingAi}
                className="px-4 py-2 rounded-xl bg-[#3C766B] hover:bg-[#316258] text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{isExportingPdf ? 'Oluşturuluyor...' : 'PDF Paylaş'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};


