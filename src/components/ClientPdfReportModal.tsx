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
import { Session, AppSettings, getNormalizedClientName, toTurkishAscii } from '../types';
import { extractBaseCalendarUid } from '../lib/firestoreService';

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
  notesMap: Record<string, string>
): { rawNote: string; source: 'calendar-id' | 'manual' | 'none' } {
  if (!session) return { rawNote: '', source: 'none' };

  // 1. Direct event ID lookup from live calendar cache
  if (session.id && notesMap[session.id]) {
    return { rawNote: notesMap[session.id].trim(), source: 'calendar-id' };
  }

  // 2. Base Calendar UID + Date lookup (handles recurring or rescheduled event IDs)
  if (session.id && session.id.startsWith('ics_')) {
    const baseUid = extractBaseCalendarUid(session.id);
    if (baseUid && session.date && notesMap[`uid:${baseUid}_${session.date}`]) {
      return { rawNote: notesMap[`uid:${baseUid}_${session.date}`].trim(), source: 'calendar-id' };
    }
    if (baseUid && notesMap[`uid:${baseUid}`]) {
      return { rawNote: notesMap[`uid:${baseUid}`].trim(), source: 'calendar-id' };
    }
  }

  // 3. Normalized Client Name + Date lookup from calendar
  if (session.clientName && session.date) {
    const normKey = `client_date:${toTurkishAscii(getNormalizedClientName(session.clientName)).toLowerCase()}_${session.date}`;
    if (notesMap[normKey]) {
      return { rawNote: notesMap[normKey].trim(), source: 'calendar-id' };
    }
  }

  // 4. Stored session.notes (either manual or from initial parse)
  if (session.notes && session.notes.trim()) {
    return {
      rawNote: session.notes.trim(),
      source: session.isSyncedFromCalendar || session.id?.startsWith('ics_') ? 'calendar-id' : 'manual'
    };
  }

  return { rawNote: '', source: 'none' };
}

export const ClientPdfReportModal: React.FC<ClientPdfReportModalProps> = ({
  isOpen,
  onClose,
  clientName,
  displayTitle,
  clientSessions,
  settings,
  tempNotesCache = {},
  onFetchLiveCalendarNotes,
  showToast
}) => {
  const [isFetchingCalendar, setIsFetchingCalendar] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [includeFinancials, setIncludeFinancials] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [liveNotesMap, setLiveNotesMap] = useState<Record<string, string>>(tempNotesCache);
  const [aiReport, setAiReport] = useState<AiProgressReport | null>(null);

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setLiveNotesMap(prev => ({ ...prev, ...tempNotesCache }));
  }, [tempNotesCache]);

  // Chronological sessions (oldest to newest for timeline progression)
  const chronologicalSessions = useMemo(() => {
    return [...clientSessions]
      .filter(s => {
        if (!s || s.isDeleted || s.type === 'non-session') return false;
        if (!includeCancelled && s.type === 'cancelled') return false;
        return true;
      })
      .sort((a, b) => {
        const dA = a.date || '';
        const dB = b.date || '';
        if (dA !== dB) return dA.localeCompare(dB);
        return (a.time || '').localeCompare(b.time || '');
      });
  }, [clientSessions, includeCancelled]);

  // Overall stats
  const reportStats = useMemo(() => {
    const active = clientSessions.filter(s => !s.isDeleted && s.type !== 'cancelled' && s.type !== 'non-session');
    const cancelled = clientSessions.filter(s => !s.isDeleted && s.type === 'cancelled');
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
  }, [clientSessions]);

  // Generate AI Report (first fetches live calendar notes by Event ID if synced)
  const handleGenerateReport = async (forceRefreshCalendar = false) => {
    let activeMap: Record<string, string> = { ...liveNotesMap, ...tempNotesCache };

    const hasCalendarSyncedSessions = clientSessions.some(
      s => s.isSyncedFromCalendar || (s.id && s.id.startsWith('ics_'))
    );

    if (onFetchLiveCalendarNotes && (forceRefreshCalendar || hasCalendarSyncedSessions)) {
      setIsFetchingCalendar(true);
      try {
        const fetched = await onFetchLiveCalendarNotes(true);
        if (fetched && typeof fetched === 'object') {
          activeMap = { ...activeMap, ...fetched };
          setLiveNotesMap(activeMap);
        }
      } catch (err) {
        console.warn('Could not refresh live calendar notes:', err);
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
        const { rawNote } = resolveLiveSessionNote(s, activeMap);
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
        headers: { 'Content-Type': 'application/json' },
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
          showToast('Takvim etkinlik notları anlık çekildi ve yapay zeka raporu güncellendi.', 'success');
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

  // Combine chronological sessions with AI timeline output
  const enrichedTimeline: EnrichedTimelineSession[] = useMemo(() => {
    let activeNum = 0;
    return chronologicalSessions.map((s, idx) => {
      if (s.type !== 'cancelled') activeNum++;
      const sessionNumber = s.type === 'cancelled' ? idx + 1 : activeNum;
      const { formattedDate, dayName } = formatSessionTurkishDate(s.date);
      const { rawNote, source } = resolveLiveSessionNote(s, liveNotesMap);

      const matchedAi = aiReport?.timelineItems?.find(item => item.sessionId === s.id);
      const fallbackAi: TimelineAiItem = {
        sessionId: s.id,
        phaseTitle:
          s.type === 'cancelled'
            ? `Planlama Değişikliği / İptal`
            : sessionNumber === 1
            ? `1. Seans • İlk Görüşme ve Terapötik Çerçeve`
            : `${sessionNumber}. Seans • Süreç Takibi ve Değerlendirme`,
        progressBadge:
          s.type === 'cancelled'
            ? 'İptal Edildi'
            : sessionNumber === 1
            ? 'İlk Değerlendirme'
            : 'Süreç & İçgörü',
        formattedReportNote: rawNote
          ? rawNote
          : s.type === 'cancelled'
          ? 'Planlanan bu görüşme gerçekleştirilememiş olup bir sonraki seansta süreç devam etmiştir.'
          : `${formattedDate} tarihli (${s.type === 'face-to-face' ? 'Yüz Yüze' : 'Online'}) terapi oturumu kapsamında danışanın süreç hedefleri ve duygusal farkındalık adımları üzerinde çalışılmıştır.`,
        keyTakeaway: rawNote
          ? rawNote.slice(0, 95)
          : `${sessionNumber}. seans tamamlandı.`
      };

      return {
        session: s,
        sessionNumber,
        formattedDate,
        dayName,
        rawNote,
        noteSource: source,
        aiItem: matchedAi || fallbackAi
      };
    });
  }, [chronologicalSessions, liveNotesMap, aiReport]);

  // Dynamic Multi-Page Pagination so content is NEVER cramped into 1 page
  // Page 1: Header + Client Summary + Executive Summary + Key Themes + First 2 Timeline items
  // Subsequent Pages: 3 to 4 Timeline items per page depending on note length, plus Final Recommendations on the last page
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
        includeRecommendations: true
      });
      return pages;
    }

    // Determine how many items fit comfortably on Page 1 based on note length
    const firstTwoChars = enrichedTimeline
      .slice(0, 2)
      .reduce((acc, it) => acc + (it.aiItem.formattedReportNote?.length || 0), 0);
    const page1Capacity = firstTwoChars > 480 ? 1 : 2;

    const firstPageItems = enrichedTimeline.slice(0, page1Capacity);
    const remaining = enrichedTimeline.slice(page1Capacity);

    if (remaining.length === 0) {
      pages.push({
        pageIndex: 0,
        isFirstPage: true,
        isLastPage: true,
        items: firstPageItems,
        includeRecommendations: true
      });
      return pages;
    }

    pages.push({
      pageIndex: 0,
      isFirstPage: true,
      isLastPage: false,
      items: firstPageItems,
      includeRecommendations: false
    });

    // Chunk remaining timeline items dynamically so each page has generous breathing room
    let cursor = 0;
    while (cursor < remaining.length) {
      const chunk: EnrichedTimelineSession[] = [];
      let currentWeight = 0;
      const maxWeightPerPage = 1050; // comfortable A4 height budget in character weight

      while (cursor < remaining.length && chunk.length < 4) {
        const candidate = remaining[cursor];
        const noteLen = (candidate.aiItem.formattedReportNote || '').length;
        const itemWeight = 220 + noteLen;

        if (chunk.length > 0 && currentWeight + itemWeight > maxWeightPerPage) {
          break;
        }
        chunk.push(candidate);
        currentWeight += itemWeight;
        cursor++;
      }

      const isEnd = cursor >= remaining.length;
      // If the last page has 4 items or very heavy notes, put recommendations on a fresh final page if needed
      const canFitRecsOnSamePage = isEnd && chunk.length <= 3 && currentWeight <= 820;

      pages.push({
        pageIndex: pages.length,
        isFirstPage: false,
        isLastPage: isEnd && canFitRecsOnSamePage,
        items: chunk,
        includeRecommendations: isEnd && canFitRecsOnSamePage
      });

      if (isEnd && !canFitRecsOnSamePage) {
        pages.push({
          pageIndex: pages.length,
          isFirstPage: false,
          isLastPage: true,
          items: [],
          includeRecommendations: true
        });
      }
    }

    return pages;
  }, [enrichedTimeline]);

  const syncedNoteCount = useMemo(() => {
    return enrichedTimeline.filter(it => it.noteSource === 'calendar-id' && it.rawNote.length > 0).length;
  }, [enrichedTimeline]);

  // Build multi-page PDF Blob using html-to-image + jsPDF
  const generatePdfDocument = async (): Promise<{ blob: Blob; filename: string }> => {
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
        cacheBust: true
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
    const filename = `${safeClientSlug || 'Danisan'}_Gelisim_Raporu_${todayStr}.pdf`;

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
        showToast(`PDF raporu (${paginatedPages.length} sayfa) başarıyla indirildi.`, 'success');
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
          title: `${displayTitle} - Terapi Süreci ve İlerleme Raporu`,
          text: `${displayTitle} danışanına ait ${paginatedPages.length} sayfalık süreç ve ilerleme zaman çizelgesi raporu (busrabakir.com).`,
          files: [file]
        });
        if (showToast) {
          showToast('PDF raporu başarıyla paylaşıldı.', 'success');
        }
      } else {
        // Fallback: Download directly if browser doesn't support native file sharing
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        if (showToast) {
          showToast('Cihazınızda doğrudan dosya paylaşımı desteklenmediği için PDF raporu indirildi.', 'info');
        }
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('PDF share error:', error);
      if (showToast) {
        showToast('Paylaşım sırasında hata oluştu, PDF indiriliyor...', 'info');
      }
      await handleDownloadPdf();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleUpdateTimelineItem = (sessionId: string, field: keyof TimelineAiItem, value: string) => {
    setAiReport(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        timelineItems: prev.timelineItems.map(item =>
          item.sessionId === sessionId ? { ...item, [field]: value } : item
        )
      };
    });
  };

  if (!isOpen) return null;

  const therapistDisplay = settings.therapistName?.trim() || 'Uzm. Psk. Büşra Bakır Kayacan';
  const reportDateFormatted = formatSessionTurkishDate(new Date().toISOString().split('T')[0]).formattedDate;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[180] flex items-center justify-center bg-[#112220]/75 backdrop-blur-md p-2 sm:p-4 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.22 }}
          className="bg-[#f7faf9] w-full max-w-5xl h-[94dvh] rounded-3xl border border-[#3c766b]/25 shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Top Signature Gradient Bar from busrabakir.com */}
          <div
            className="h-1.5 w-full shrink-0"
            style={{ background: 'linear-gradient(90deg, #3c766b 0%, #4e9284 55%, #b48964 100%)' }}
          />

          {/* Modal Control Header */}
          <div className="bg-white px-4 sm:px-6 py-3.5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs"
                style={{ backgroundColor: '#3c766b' }}
              >
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-extrabold text-[#112220] truncate">
                    {displayTitle} — Yapay Zeka Destekli PDF Süreç Raporu
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#3c766b]/10 text-[#26423d] border border-[#3c766b]/20">
                    {paginatedPages.length} Sayfa (A4)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                  <span>
                    Takvim Etkinlik ID Notu Eşleşen: <strong className="text-[#3c766b]">{syncedNoteCount} seans</strong>
                  </span>
                  <span>•</span>
                  <span className="text-[#b48964] font-semibold">busrabakir.com Kurumsal Şablonu</span>
                </p>
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleGenerateReport(true)}
                disabled={isFetchingCalendar || isGeneratingAi}
                className="px-3 py-2 rounded-xl border border-[#3c766b]/25 bg-[#f7faf9] hover:bg-[#3c766b]/10 text-[#26423d] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                title="Takvimden etkinlik ID notlarını anlık çek ve raporu yeniden oluştur"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${(isFetchingCalendar || isGeneratingAi) ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">
                  {isFetchingCalendar
                    ? 'Takvim Notları Çekiliyor...'
                    : isGeneratingAi
                    ? 'YZ Raporu Yazıyor...'
                    : 'Anlık Takvim Notlarını Çek & Yenile'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditMode(prev => !prev)}
                className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isEditMode
                    ? 'bg-[#b48964] text-white border-[#b48964]'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
                title="PDF metinlerini indirmeden önce düzenle"
              >
                {isEditMode ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                <span>{isEditMode ? 'Düzenlemeyi Bitir' : 'Metinleri Düzenle'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIncludeFinancials(prev => !prev)}
                className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  includeFinancials
                    ? 'bg-[#3c766b]/10 border-[#3c766b]/30 text-[#26423d]'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title="Finansal / ödeme bilgilerini raporda göster veya gizle"
              >
                {includeFinancials ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span className="hidden md:inline">{includeFinancials ? 'Finansal Bilgi: Açık' : 'Finansal Bilgi: Gizli'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 transition-colors cursor-pointer"
                title="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Loading Banner when AI or Calendar Sync is active */}
          {(isFetchingCalendar || isGeneratingAi) && (
            <div
              className="px-6 py-2.5 text-white text-xs font-semibold flex items-center justify-center gap-2.5 shrink-0"
              style={{ background: 'linear-gradient(90deg, #3c766b 0%, #4e9284 55%, #b48964 100%)' }}
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>
                {isFetchingCalendar
                  ? 'Takvim etkinlik ID kayıtlarından danışanın güncel seans notları anlık olarak çekiliyor...'
                  : 'Yapay zeka, danışanın seans notlarını analiz ederek zaman çizelgesi ilerleme raporunu hazırlıyor...'}
              </span>
            </div>
          )}

          {/* Scrollable Multi-Page A4 Preview Area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-8 bg-[#eef3f1]">
            {paginatedPages.map((page, pIdx) => (
              <div key={pIdx} className="mx-auto" style={{ width: '794px', maxWidth: '100%' }}>
                {/* Page Indicator Pill outside the A4 canvas */}
                <div className="flex items-center justify-between mb-2 px-1 text-xs text-slate-500 font-semibold">
                  <span>
                    📄 Sayfa {pIdx + 1} / {paginatedPages.length}
                    {page.isFirstPage ? ' • Kapak & Süreç Özeti' : ' • Zaman Çizelgesi Devamı'}
                  </span>
                  <span className="text-[11px] text-[#3c766b]">A4 Standart Boyut (Sıkıştırmasız Çoklu Sayfa)</span>
                </div>

                {/* Actual A4 Page Sheet Rendered to PDF */}
                <div
                  ref={el => {
                    pageRefs.current[pIdx] = el;
                  }}
                  className="bg-white rounded-none shadow-xl border border-slate-200/90 flex flex-col justify-between relative overflow-hidden mx-auto"
                  style={{
                    width: '794px',
                    minHeight: '1123px',
                    padding: '0',
                    color: '#112220',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
                  }}
                >
                  {/* Top Signature Gradient Accent Strip */}
                  <div>
                    <div
                      style={{
                        height: '8px',
                        width: '100%',
                        background: 'linear-gradient(90deg, #3c766b 0%, #4e9284 55%, #b48964 100%)'
                      }}
                    />

                    <div className="px-10 pt-8 pb-6 space-y-6">
                      {/* ======================================================== */}
                      {/* HEADER (Full on Page 1, Compact Running Header on Page 2+) */}
                      {/* ======================================================== */}
                      {page.isFirstPage ? (
                        <div
                          className="pb-5 flex items-start justify-between gap-6"
                          style={{ borderBottom: '1px solid rgba(60, 118, 107, 0.16)' }}
                        >
                          <div className="space-y-1.5">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                              style={{ backgroundColor: '#f7faf9', color: '#3c766b', border: '1px solid rgba(60, 118, 107, 0.22)' }}
                            >
                              <Compass className="w-3 h-3" style={{ color: '#b48964' }} />
                              <span>PSİKOLOJİK DANIŞMANLIK & SÜREÇ İLERLEME RAPORU</span>
                            </div>
                            <h1
                              className="text-2xl font-bold tracking-tight"
                              style={{ fontFamily: '"Playfair Display", Georgia, serif', color: '#112220' }}
                            >
                              {displayTitle}
                            </h1>
                            <p className="text-xs font-medium" style={{ color: '#6e6e73' }}>
                              Terapi Zaman Çizelgesi ve Seans İlerleme Değerlendirmesi
                            </p>
                          </div>

                          {/* Right Clinician & Subtle busrabakir.com Branding */}
                          <div className="text-right space-y-1 shrink-0">
                            <div
                              className="text-sm font-bold"
                              style={{ fontFamily: '"Playfair Display", Georgia, serif', color: '#26423d' }}
                            >
                              {therapistDisplay}
                            </div>
                            <div className="text-[11px] font-medium" style={{ color: '#6e6e73' }}>
                              Uzman Psikolog & Aile Danışmanı
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold"
                              style={{ backgroundColor: '#f7faf9', color: '#3c766b', border: '1px solid rgba(60, 118, 107, 0.15)' }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#b48964' }} />
                              <span>busrabakir.com</span>
                            </div>
                            <div className="text-[10px]" style={{ color: '#6e6e73' }}>
                              Rapor Tarihi: {reportDateFormatted}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Compact Running Header on Page 2+ */
                        <div
                          className="pb-3.5 flex items-center justify-between gap-4"
                          style={{ borderBottom: '1px solid rgba(60, 118, 107, 0.14)' }}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: '#3c766b' }}
                            />
                            <span
                              className="text-sm font-bold"
                              style={{ fontFamily: '"Playfair Display", Georgia, serif', color: '#112220' }}
                            >
                              {displayTitle} — Seans İlerleme Zaman Çizelgesi
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-semibold" style={{ color: '#6e6e73' }}>
                            <span>{therapistDisplay}</span>
                            <span>•</span>
                            <span style={{ color: '#3c766b' }}>busrabakir.com</span>
                          </div>
                        </div>
                      )}

                      {/* ======================================================== */}
                      {/* PAGE 1 EXCLUSIVE: SUMMARY METRICS + AI OVERVIEW + THEMES */}
                      {/* ======================================================== */}
                      {page.isFirstPage && (
                        <div className="space-y-5">
                          {/* Client Process Metrics Grid */}
                          <div className={`grid ${includeFinancials ? 'grid-cols-4' : 'grid-cols-3'} gap-3`}>
                            <div
                              className="p-3.5 rounded-2xl"
                              style={{ backgroundColor: '#f7faf9', border: '1px solid rgba(60, 118, 107, 0.14)' }}
                            >
                              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6e6e73' }}>
                                TOPLAM AKTİF SEANS
                              </div>
                              <div className="mt-1 flex items-baseline gap-1.5">
                                <span className="text-xl font-extrabold" style={{ color: '#112220' }}>
                                  {reportStats.completedCount}
                                </span>
                                <span className="text-[11px] font-semibold" style={{ color: '#3c766b' }}>
                                  Oturum
                                </span>
                              </div>
                              <div className="text-[10px] mt-0.5" style={{ color: '#6e6e73' }}>
                                {reportStats.onlineCount} Online • {reportStats.faceToFaceCount} Yüz Yüze
                              </div>
                            </div>

                            <div
                              className="p-3.5 rounded-2xl"
                              style={{ backgroundColor: '#f7faf9', border: '1px solid rgba(60, 118, 107, 0.14)' }}
                            >
                              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6e6e73' }}>
                                SÜREÇ TARİH ARALIĞI
                              </div>
                              <div className="mt-1 text-xs font-extrabold" style={{ color: '#112220' }}>
                                {reportStats.firstDate}
                              </div>
                              <div className="text-[11px] font-semibold mt-0.5" style={{ color: '#3c766b' }}>
                                → {reportStats.lastDate}
                              </div>
                            </div>

                            <div
                              className="p-3.5 rounded-2xl"
                              style={{ backgroundColor: '#f7faf9', border: '1px solid rgba(60, 118, 107, 0.14)' }}
                            >
                              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6e6e73' }}>
                                TAKVİM ETKİNLİK NOTU
                              </div>
                              <div className="mt-1 flex items-baseline gap-1.5">
                                <span className="text-xl font-extrabold" style={{ color: '#26423d' }}>
                                  { enrichedTimeline.filter(i => i.rawNote.length > 0).length }
                                </span>
                                <span className="text-[11px] font-semibold" style={{ color: '#b48964' }}>
                                  Kayıtlı Not
                                </span>
                              </div>
                              <div className="text-[10px] mt-0.5" style={{ color: '#6e6e73' }}>
                                Anlık Takvim ID & Seans Verisi
                              </div>
                            </div>

                            {includeFinancials && (
                              <div
                                className="p-3.5 rounded-2xl"
                                style={{ backgroundColor: '#fcfaf7', border: '1px solid rgba(180, 137, 100, 0.25)' }}
                              >
                                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#b48964' }}>
                                  FİNANSAL ÖZET
                                </div>
                                <div className="mt-1 text-sm font-extrabold" style={{ color: '#112220' }}>
                                  Tahsilat: ₺{reportStats.totalPaid.toLocaleString('tr-TR')}
                                </div>
                                <div className="text-[10px] mt-0.5 font-semibold" style={{ color: reportStats.totalUnpaid > 0 ? '#b91c1c' : '#3c766b' }}>
                                  {reportStats.totalUnpaid > 0
                                    ? `Bekleyen: ₺${reportStats.totalUnpaid.toLocaleString('tr-TR')}`
                                    : 'Tüm ödemeler tamamlandı'}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* AI Executive Summary Box */}
                          <div
                            className="p-5 rounded-2xl space-y-2.5"
                            style={{
                              backgroundColor: '#f7faf9',
                              border: '1px solid rgba(60, 118, 107, 0.18)',
                              borderLeft: '4px solid #3c766b'
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <h3
                                className="text-sm font-bold flex items-center gap-2"
                                style={{ fontFamily: '"Playfair Display", Georgia, serif', color: '#112220' }}
                              >
                                <Sparkles className="w-4 h-4" style={{ color: '#3c766b' }} />
                                <span>Genel Süreç ve İlerleme Değerlendirmesi</span>
                              </h3>
                              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#3c766b' }}>
                                Klinik Sentez
                              </span>
                            </div>

                            {isEditMode ? (
                              <textarea
                                value={aiReport?.executiveSummary || ''}
                                onChange={e =>
                                  setAiReport(prev => (prev ? { ...prev, executiveSummary: e.target.value } : prev))
                                }
                                rows={4}
                                className="w-full p-2.5 text-xs bg-white border border-[#3c766b]/30 rounded-xl focus:outline-none"
                              />
                            ) : (
                              <p className="text-xs leading-relaxed" style={{ color: '#3a3a3c' }}>
                                {aiReport?.executiveSummary ||
                                  `${displayTitle} ile yürütülen danışmanlık süreci kapsamında gerçekleştirilen seanslar ve takvim etkinlik notları kronolojik olarak analiz edilmiştir.`}
                              </p>
                            )}

                            {/* Key Themes Pills */}
                            {aiReport?.keyThemes && aiReport.keyThemes.length > 0 && (
                              <div className="pt-2 flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold uppercase tracking-wider mr-1" style={{ color: '#6e6e73' }}>
                                  Odak Alanları:
                                </span>
                                {aiReport.keyThemes.map((theme, tIdx) => (
                                  <span
                                    key={tIdx}
                                    className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                                    style={{
                                      backgroundColor: '#ffffff',
                                      color: '#26423d',
                                      border: '1px solid rgba(60, 118, 107, 0.22)'
                                    }}
                                  >
                                    • {theme}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ======================================================== */}
                      {/* CHRONOLOGICAL TIMELINE SECTION                           */}
                      {/* ======================================================== */}
                      {page.items.length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3
                              className="text-sm font-bold flex items-center gap-2"
                              style={{ fontFamily: '"Playfair Display", Georgia, serif', color: '#112220' }}
                            >
                              <Layers className="w-4 h-4" style={{ color: '#b48964' }} />
                              <span>
                                {page.isFirstPage
                                  ? 'Seans İlerleme Zaman Çizelgesi (Kronolojik)'
                                  : 'Seans İlerleme Zaman Çizelgesi (Devamı)'}
                              </span>
                            </h3>
                            <span className="text-[10px] font-semibold" style={{ color: '#6e6e73' }}>
                              {page.items[0].formattedDate} — {page.items[page.items.length - 1].formattedDate}
                            </span>
                          </div>

                          {/* Vertical Timeline Container */}
                          <div className="relative pl-6 space-y-4">
                            {/* Vertical Timeline Line */}
                            <div
                              className="absolute left-2.5 top-3 bottom-3 w-0.5"
                              style={{
                                background: 'linear-gradient(180deg, #3c766b 0%, #4e9284 55%, #b48964 100%)',
                                opacity: 0.35
                              }}
                            />

                            {page.items.map((item) => {
                              const { session, sessionNumber, formattedDate, dayName, rawNote, noteSource, aiItem } = item;
                              const isCancelled = session.type === 'cancelled';
                              const isFaceToFace = session.type === 'face-to-face';

                              return (
                                <div key={session.id} className="relative">
                                  {/* Timeline Node Circle */}
                                  <div
                                    className="absolute -left-6 top-3.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shadow-xs"
                                    style={{
                                      backgroundColor: isCancelled
                                        ? '#94a3b8'
                                        : sessionNumber % 2 === 1
                                        ? '#3c766b'
                                        : '#b48964'
                                    }}
                                  >
                                    {sessionNumber}
                                  </div>

                                  {/* Timeline Session Card */}
                                  <div
                                    className="rounded-2xl p-4 space-y-2"
                                    style={{
                                      backgroundColor: isCancelled ? '#f8fafc' : '#ffffff',
                                      border: isCancelled
                                        ? '1px solid #e2e8f0'
                                        : '1px solid rgba(17, 34, 32, 0.10)',
                                      boxShadow: '0 2px 8px rgba(17, 34, 32, 0.03)'
                                    }}
                                  >
                                    {/* Top Row: Date + Phase Title + Badges */}
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs font-extrabold" style={{ color: '#3c766b' }}>
                                            {formattedDate} ({dayName}) • {session.time || '00:00'}
                                          </span>
                                          <span
                                            className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                                            style={{
                                              backgroundColor: isCancelled
                                                ? '#f1f5f9'
                                                : isFaceToFace
                                                ? 'rgba(60, 118, 107, 0.10)'
                                                : 'rgba(180, 137, 100, 0.12)',
                                              color: isCancelled
                                                ? '#64748b'
                                                : isFaceToFace
                                                ? '#26423d'
                                                : '#8c6239'
                                            }}
                                          >
                                            {isCancelled ? 'İptal' : isFaceToFace ? 'Yüz Yüze Seans' : 'Online Seans'} ({session.duration || 50} dk)
                                          </span>
                                        </div>

                                        {isEditMode ? (
                                          <input
                                            type="text"
                                            value={aiItem.phaseTitle}
                                            onChange={e =>
                                              handleUpdateTimelineItem(session.id, 'phaseTitle', e.target.value)
                                            }
                                            className="w-full text-xs font-bold px-2 py-1 border border-[#3c766b]/30 rounded-lg mt-1"
                                          />
                                        ) : (
                                          <h4
                                            className="text-sm font-bold"
                                            style={{ color: '#112220', fontFamily: '"Playfair Display", Georgia, serif' }}
                                          >
                                            {aiItem.phaseTitle}
                                          </h4>
                                        )}
                                      </div>

                                      {/* Right Progress Milestone Badge */}
                                      <div className="text-right shrink-0 space-y-1">
                                        <span
                                          className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                                          style={{
                                            backgroundColor: '#f7faf9',
                                            color: '#3c766b',
                                            border: '1px solid rgba(60, 118, 107, 0.22)'
                                          }}
                                        >
                                          {aiItem.progressBadge}
                                        </span>
                                        {includeFinancials && !isCancelled && (
                                          <div className="text-[10px] font-bold" style={{ color: '#6e6e73' }}>
                                            ₺{(session.price || 0).toLocaleString('tr-TR')} •{' '}
                                            <span style={{ color: session.paymentStatus === 'paid' ? '#3c766b' : '#b48964' }}>
                                              {session.paymentStatus === 'paid' ? 'Ödendi' : 'Bekliyor'}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* AI Formatted Progress Note */}
                                    {isEditMode ? (
                                      <textarea
                                        value={aiItem.formattedReportNote}
                                        onChange={e =>
                                          handleUpdateTimelineItem(session.id, 'formattedReportNote', e.target.value)
                                        }
                                        rows={3}
                                        className="w-full p-2 text-xs bg-[#f7faf9] border border-[#3c766b]/30 rounded-xl focus:outline-none"
                                      />
                                    ) : (
                                      <p className="text-xs leading-relaxed" style={{ color: '#3a3a3c' }}>
                                        {aiItem.formattedReportNote}
                                      </p>
                                    )}

                                    {/* Bottom Row: Key Takeaway & Raw Calendar Note Indicator */}
                                    <div
                                      className="pt-1.5 flex items-center justify-between gap-2 text-[10px]"
                                      style={{ borderTop: '1px dashed rgba(17, 34, 32, 0.08)' }}
                                    >
                                      <div className="flex items-center gap-1.5 font-semibold" style={{ color: '#26423d' }}>
                                        <ChevronRight className="w-3 h-3 shrink-0" style={{ color: '#b48964' }} />
                                        <span>{aiItem.keyTakeaway}</span>
                                      </div>

                                      {rawNote && (
                                        <span
                                          className="shrink-0 px-2 py-0.5 rounded text-[9px] font-semibold"
                                          style={{ backgroundColor: '#f7faf9', color: '#6e6e73' }}
                                        >
                                          {noteSource === 'calendar-id' ? '📅 Takvim Etkinlik Notu' : '📝 Seans Notu'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* ======================================================== */}
                      {/* LAST PAGE: RECOMMENDATIONS & CLINICIAN SIGNATURE         */}
                      {/* ======================================================== */}
                      {page.includeRecommendations && (
                        <div className="space-y-5 pt-2">
                          <div
                            className="p-5 rounded-2xl space-y-2"
                            style={{
                              backgroundColor: '#fcfaf7',
                              border: '1px solid rgba(180, 137, 100, 0.28)',
                              borderLeft: '4px solid #b48964'
                            }}
                          >
                            <h3
                              className="text-sm font-bold flex items-center gap-2"
                              style={{ fontFamily: '"Playfair Display", Georgia, serif', color: '#112220' }}
                            >
                              <Award className="w-4 h-4" style={{ color: '#b48964' }} />
                              <span>Gelecek Seanslar İçin Klinik Öneriler & Süreç Planı</span>
                            </h3>
                            {isEditMode ? (
                              <textarea
                                value={aiReport?.recommendations || ''}
                                onChange={e =>
                                  setAiReport(prev => (prev ? { ...prev, recommendations: e.target.value } : prev))
                                }
                                rows={3}
                                className="w-full p-2 text-xs bg-white border border-[#b48964]/40 rounded-xl focus:outline-none"
                              />
                            ) : (
                              <p className="text-xs leading-relaxed" style={{ color: '#3a3a3c' }}>
                                {aiReport?.recommendations ||
                                  'Danışanın seans sürekliliğinin korunması, görüşmeler arasında önerilen farkındalık çalışmalarının sürdürülmesi ve süreç hedeflerinin periyodik olarak değerlendirilmesi önerilmektedir.'}
                              </p>
                            )}
                          </div>

                          {/* Signature & Stamp Block */}
                          <div className="pt-4 flex items-end justify-between px-2">
                            <div className="space-y-1 text-[10px]" style={{ color: '#6e6e73' }}>
                              <p className="font-semibold" style={{ color: '#26423d' }}>
                                Gizlilik & Etik Bildirimi (KVKK)
                              </p>
                              <p className="max-w-md leading-normal">
                                Bu süreç ve ilerleme raporu, danışanın seans kayıtları ve takvim etkinlik notları baz alınarak bilgilendirme ve süreç takibi amacıyla hazırlanmıştır.
                              </p>
                            </div>

                            <div className="text-right space-y-1">
                              <div
                                className="w-44 pb-2 mb-1 text-center ml-auto"
                                style={{ borderBottom: '1px solid rgba(60, 118, 107, 0.3)' }}
                              >
                                <span
                                  className="text-xs italic"
                                  style={{ fontFamily: '"Playfair Display", Georgia, serif', color: '#3c766b' }}
                                >
                                  {therapistDisplay}
                                </span>
                              </div>
                              <div className="text-xs font-bold" style={{ color: '#112220' }}>
                                {therapistDisplay}
                              </div>
                              <div className="text-[10px]" style={{ color: '#6e6e73' }}>
                                Uzman Psikolog & Aile Danışmanı
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ======================================================== */}
                  {/* STANDARD FOOTER ON EVERY PAGE WITH SUBTLE busrabakir.com */}
                  {/* ======================================================== */}
                  <div className="px-10 pb-6 pt-3">
                    <div
                      className="pt-3 flex items-center justify-between text-[10px]"
                      style={{ borderTop: '1px solid rgba(17, 34, 32, 0.08)', color: '#6e6e73' }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: 'linear-gradient(135deg, #3c766b, #b48964)' }}
                        />
                        <span className="font-bold" style={{ color: '#26423d' }}>
                          busrabakir.com
                        </span>
                        <span>•</span>
                        <span>Uzman Psikolog & Aile Danışmanlığı Süreç Raporlama Şablonu</span>
                      </div>

                      <div className="font-semibold" style={{ color: '#3c766b' }}>
                        Sayfa {pIdx + 1} / {paginatedPages.length}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sticky Bottom Action Bar */}
          <div className="bg-white px-4 sm:px-6 py-3.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 text-xs">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-slate-600 font-semibold">
                <input
                  type="checkbox"
                  checked={includeCancelled}
                  onChange={e => setIncludeCancelled(e.target.checked)}
                  className="rounded border-slate-300 text-[#3c766b] focus:ring-[#3c766b] cursor-pointer"
                />
                <span>İptal Edilen Seansları Göster</span>
              </label>
            </div>

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExportingPdf || isGeneratingAi}
                className="px-4 py-2.5 rounded-xl border border-[#3c766b]/30 bg-white hover:bg-[#f7faf9] text-[#26423d] text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <Download className="w-4 h-4 text-[#3c766b]" />
                <span>{isExportingPdf ? 'PDF Hazırlanıyor...' : 'PDF İndir'}</span>
              </button>

              <button
                type="button"
                onClick={handleSharePdf}
                disabled={isExportingPdf || isGeneratingAi}
                className="px-5 py-2.5 rounded-xl text-white text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-md"
                style={{ background: 'linear-gradient(90deg, #3c766b 0%, #4e9284 55%, #b48964 100%)' }}
              >
                <Share2 className="w-4 h-4" />
                <span>{isExportingPdf ? 'PDF Oluşturuluyor...' : 'PDF Raporu Paylaş'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
