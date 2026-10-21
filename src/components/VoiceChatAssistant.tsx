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
  MessageSquare,
  ChevronRight,
  Loader2,
  Calendar,
  Wallet,
  UserCheck,
  Building,
  Baby
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import {
  Session,
  AppSettings,
  Expense,
  PaymentMethod,
  SessionType,
  areClientNamesEquivalent,
  getNormalizedClientName
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
        // Include day sessions first, plus current month sessions for flexible commands
        const dayIds = new Set(dayList.map(s => s.id));
        return [...dayList, ...monthList.filter(s => !dayIds.has(s.id))];
      }
      return active
        .filter(s => s.date.startsWith(visibleMonthKey))
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    }
    // For stats, audit, clients, search, etc., provide current visible month + recent sessions
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

  // Execute structured actions returned by the assistant
  const executeAssistantActions = (actions: AssistantAction[]): AppliedChangeRecord | undefined => {
    if (!Array.isArray(actions) || actions.length === 0) return undefined;

    const previousSnapshot = [...sessions];
    const detailLines: string[] = [];
    let modifiedCount = 0;

    for (const action of actions) {
      if (action.actionType === 'UPDATE_SESSIONS' && action.updates) {
        const u = action.updates;
        const targetIdSet = new Set(Array.isArray(action.sessionIds) ? action.sessionIds : []);

        onUpdateSessionsBulk(prevSessions => {
          // Determine which sessions to update
          let matchedIds = new Set<string>(targetIdSet);

          // If AI didn't pass exact IDs or IDs didn't match, match by clientName & date/view context
          const hasValidId = prevSessions.some(s => matchedIds.has(s.id));
          if (!hasValidId && action.clientName) {
            const clientMatches = prevSessions.filter(
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

            if (action.applyToScope !== 'visible_period' && action.applyToScope !== 'all' && candidates.length > 1) {
              // Pick closest to targetDate or selectedDate
              const refDate = action.targetDate || selectedDate;
              candidates = [...candidates].sort((a, b) => {
                const da = Math.abs(new Date(a.date).getTime() - new Date(refDate).getTime());
                const db = Math.abs(new Date(b.date).getTime() - new Date(refDate).getTime());
                return da - db;
              }).slice(0, 1);
            }
            candidates.forEach(c => matchedIds.add(c.id));
          }

          return prevSessions.map(s => {
            if (!matchedIds.has(s.id)) return s;
            modifiedCount++;

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
                ? (typeof u.babysitterFeeAmount === 'number' && u.babysitterFeeAmount > 0
                    ? u.babysitterFeeAmount
                    : (s.babysitterFeeAmount || settings.defaultBabysitterFee || 250))
                : 0;
            } else if (typeof u.babysitterFeeAmount === 'number') {
              updated.hasBabysitterFee = u.babysitterFeeAmount > 0;
              updated.babysitterFeeAmount = u.babysitterFeeAmount;
            }

            if (typeof u.hasOfficeRentFee === 'boolean') {
              updated.hasOfficeRentFee = u.hasOfficeRentFee;
              updated.officeRentFeeAmount = u.hasOfficeRentFee
                ? (typeof u.officeRentFeeAmount === 'number' && u.officeRentFeeAmount > 0
                    ? u.officeRentFeeAmount
                    : (s.officeRentFeeAmount || settings.defaultOfficeRentFee || 200))
                : 0;
            } else if (typeof u.officeRentFeeAmount === 'number') {
              updated.hasOfficeRentFee = u.officeRentFeeAmount > 0;
              updated.officeRentFeeAmount = u.officeRentFeeAmount;
            }

            if (u.paymentStatus) {
              updated.paymentStatus = u.paymentStatus;
              if (u.paymentStatus === 'paid') {
                updated.paidAmount = typeof u.paidAmount === 'number' && u.paidAmount > 0 ? u.paidAmount : updated.price;
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

            detailLines.push(`${updated.clientName} (${updated.date} ${updated.time}) → ${changeBadges.join(' • ')}`);
            return updated;
          });
        });
      } else if (action.actionType === 'CREATE_SESSION' && action.newSession) {
        const ns = action.newSession;
        const type: SessionType = ns.type || 'online';
        const price =
          typeof ns.price === 'number'
            ? ns.price
            : type === 'online'
            ? settings.defaultOnlinePrice || settings.defaultSessionPrice
            : settings.defaultFaceToFacePrice || settings.defaultSessionPrice;
        const hasBabysitter = ns.hasBabysitterFee ?? (settings.defaultBabysitterFee > 0);
        const hasOffice = ns.hasOfficeRentFee ?? (type === 'face-to-face' && settings.defaultOfficeRentFee > 0);

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
          hasBabysitterFee: hasBabysitter,
          babysitterFeeAmount: hasBabysitter ? (ns.babysitterFeeAmount || settings.defaultBabysitterFee) : 0,
          hasOfficeRentFee: hasOffice,
          officeRentFeeAmount: hasOffice ? (ns.officeRentFeeAmount || settings.defaultOfficeRentFee) : 0,
          notes: ns.notes || '',
          isManuallyEdited: true,
          updatedAt: Date.now()
        };
        onSaveSession(created);
        modifiedCount++;
        detailLines.push(`Yeni Seans: ${created.clientName} (${created.date} ${created.time}) - ₺${created.price}`);
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

    try {
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

      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          pageContext,
          sessions: pageRelevantSessions,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await response.json();
      const replyText = data.reply || 'İşleminiz tamamlandı.';
      const actions: AssistantAction[] = Array.isArray(data.actions) ? data.actions : [];

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
    } catch (err) {
      console.error('Assistant chat error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `ast_err_${Date.now()}`,
          role: 'assistant',
          content: 'Komut işlenirken bağlantı hatası oluştu. Lütfen tekrar deneyin.',
          timestamp: Date.now()
        }
      ]);
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
      // Stop listening
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
