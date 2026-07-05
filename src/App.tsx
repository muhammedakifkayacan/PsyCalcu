import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  Settings as SettingsIcon, 
  Plus, 
  Trash2, 
  Edit3, 
  Laptop, 
  MapPin, 
  Ban, 
  TrendingUp, 
  Clock, 
  Sliders, 
  RefreshCw,
  HelpCircle,
  FileSpreadsheet,
  AlertCircle,
  Database,
  Download,
  Upload,
  ShieldCheck,
  Sparkles,
  Check,
  Search,
  Wallet,
  Users,
  ChevronDown,
  ChevronUp,
  Lightbulb
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { Session, AppSettings } from './types';
import { getInitialMockSessions, parseICS } from './utils/icsParser';
import CalendarSyncGuide from './components/CalendarSyncGuide';
import EmailReportGenerator from './components/EmailReportGenerator';
import SettingsModal from './components/SettingsModal';
import SessionModal from './components/SessionModal';
import StatsDashboard from './components/StatsDashboard';
import AuthCard from './components/AuthCard';
import FAQModal from './components/FAQModal';
import InteractiveTour from './components/InteractiveTour';
import { auth, onAuthStateChanged, User } from './lib/firebase';
import { fetchUserData, saveUserData, migrateLocalDataToFirestore, isFirestoreQuotaExceeded } from './lib/firestoreService';

export default function App() {
  // Load settings from localStorage or set defaults
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('psycalcu_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          defaultSessionPrice: parsed.defaultSessionPrice ?? 1200,
          defaultBabysitterFee: parsed.defaultBabysitterFee ?? 250,
          defaultOfficeRentFee: parsed.defaultOfficeRentFee ?? parsed.monthlyOfficeRent ?? 200,
          therapistName: parsed.therapistName ?? 'Dr. Melis Kaya',
          calendarSyncEnabled: parsed.calendarSyncEnabled ?? true,
          onlineCalendarWebcalUrl: parsed.onlineCalendarWebcalUrl ?? parsed.calendarWebcalUrl ?? '',
          faceToFaceCalendarWebcalUrl: parsed.faceToFaceCalendarWebcalUrl ?? '',
          googleSheetId: parsed.googleSheetId ?? '',
          googleSheetsLinked: parsed.googleSheetsLinked ?? false,
        };
      } catch (e) {}
    }
    return {
      defaultSessionPrice: 1200,
      defaultBabysitterFee: 250,
      defaultOfficeRentFee: 200,
      therapistName: 'Dr. Melis Kaya',
      calendarSyncEnabled: true,
      onlineCalendarWebcalUrl: '',
      faceToFaceCalendarWebcalUrl: '',
      googleSheetId: '',
      googleSheetsLinked: false,
    };
  });

  // Load sessions from localStorage or use empty array
  const [sessions, setSessions] = useState<Session[]>(() => {
    const saved = localStorage.getItem('psycalcu_sessions');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  // Authentication & Cloud Sync states
  const [user, setUser] = useState<User | null>(null);
  const [isInitialAuthCheckDone, setIsInitialAuthCheckDone] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthSyncing, setIsAuthSyncing] = useState(false);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(isFirestoreQuotaExceeded);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const hasSyncedRef = useRef<string | null>(null);
  const lastSavedRef = useRef<{ settings: string; sessions: string }>({ settings: '', sessions: '' });

  // Toast Notification State
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Custom Confirmation Dialog State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmState({ isOpen: true, title, message, onConfirm });
  };

  // Monitor Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Page can open immediately, we don't need to block with full screen loading
        setIsInitialAuthCheckDone(true);
        setIsAuthLoading(false);

        if (hasSyncedRef.current === currentUser.uid) {
          return;
        }
        hasSyncedRef.current = currentUser.uid;
        try {
          setIsAuthSyncing(true);
          const cloudData = await fetchUserData(currentUser.uid);
          if (cloudData) {
            // Get local sessions to perform conflict-free merging
            const savedSessionsStr = localStorage.getItem('psycalcu_sessions');
            let localSessions: Session[] = [];
            if (savedSessionsStr) {
              try { localSessions = JSON.parse(savedSessionsStr); } catch (e) {}
            }
            
            const cloudSessions = cloudData.sessions || [];
            
            // Merge local and cloud sessions using updatedAt field
            const localMap = new Map(localSessions.map(s => [s.id, s]));
            const cloudIds = new Set(cloudSessions.map(s => s.id));
            
            // Keep local-only sessions (e.g. offline edits) if they are not mock sessions
            const localOnly = localSessions.filter(s => !cloudIds.has(s.id) && s.id && !s.id.startsWith('mock_'));
            
            const mergedSessions = cloudSessions.map(cs => {
              const ls = localMap.get(cs.id);
              if (ls) {
                const localTime = ls.updatedAt || 0;
                const cloudTime = cs.updatedAt || 0;
                // If local has a newer update, merge/use the local session
                if (localTime > cloudTime) {
                  return ls;
                }
              }
              return cs;
            });
            
            const finalSessions = [...mergedSessions, ...localOnly];
            
            // If the merged sessions list differs from cloud sessions, trigger a save back to the cloud
            if (JSON.stringify(cloudSessions) !== JSON.stringify(finalSessions)) {
              setSessions(finalSessions);
              setSettings(cloudData.settings);
              // Save the merged data to the cloud
              await saveUserData(currentUser.uid, cloudData.settings, finalSessions);
              lastSavedRef.current = {
                settings: JSON.stringify(cloudData.settings),
                sessions: JSON.stringify(finalSessions)
              };
            } else {
              setSessions(cloudSessions);
              setSettings(cloudData.settings);
              lastSavedRef.current = {
                settings: JSON.stringify(cloudData.settings),
                sessions: JSON.stringify(cloudSessions)
              };
            }
            showToast('Bulut verileriniz başarıyla senkronize edildi.', 'success');
          } else {
            // First time registered user, sync existing local data to their new cloud database if it's real
            const savedSessionsStr = localStorage.getItem('psycalcu_sessions');
            const savedSettingsStr = localStorage.getItem('psycalcu_settings');
            let sessionsToSave = sessions;
            let settingsToSave = settings;
            
            if (savedSessionsStr) {
              try { sessionsToSave = JSON.parse(savedSessionsStr); } catch (e) {}
            }
            if (savedSettingsStr) {
              try { settingsToSave = JSON.parse(savedSettingsStr); } catch (e) {}
            }
            
            let hasRealLocalSessions = false;
            if (sessionsToSave && sessionsToSave.length > 0) {
              hasRealLocalSessions = !sessionsToSave.every(s => s.id && s.id.startsWith('mock_'));
            }
            
            if (hasRealLocalSessions) {
              await saveUserData(currentUser.uid, settingsToSave, sessionsToSave);
              setSessions(sessionsToSave);
              setSettings(settingsToSave);
              lastSavedRef.current = {
                settings: JSON.stringify(settingsToSave),
                sessions: JSON.stringify(sessionsToSave)
              };
              showToast('Mevcut seanslarınız ve ayarlarınız yeni bulut hesabınıza başarıyla aktarıldı!', 'success');
            } else {
              await saveUserData(currentUser.uid, settingsToSave, []);
              setSessions([]);
              setSettings(settingsToSave);
              lastSavedRef.current = {
                settings: JSON.stringify(settingsToSave),
                sessions: '[]'
              };
              showToast('Yeni bulut profiliniz oluşturuldu.', 'info');
            }
          }
        } catch (error: any) {
          console.error("Bulut verisi çekilirken hata:", error);
          
          const isQuota = error?.message === 'quota-exceeded' || 
                          error?.message?.toLowerCase().includes('quota') || 
                          error?.code?.toLowerCase().includes('quota') ||
                          error?.message?.toLowerCase().includes('resource-exhausted') ||
                          error?.code?.toLowerCase().includes('resource-exhausted');
          
          if (isQuota) {
            setIsQuotaExceeded(true);
          }

          // Graceful fallback to local storage on offline/network errors
          const savedSessions = localStorage.getItem('psycalcu_sessions');
          const savedSettings = localStorage.getItem('psycalcu_settings');
          if (savedSessions) {
            try { setSessions(JSON.parse(savedSessions)); } catch (e) {}
          }
          if (savedSettings) {
            try { setSettings(JSON.parse(savedSettings)); } catch (e) {}
          }
          
          const isOfflineErr = error?.message?.toLowerCase().includes('offline') || 
                              error?.code?.toLowerCase().includes('offline') || 
                              !navigator.onLine;
                              
          if (isQuota) {
            showToast('Bulut günlük kotaları doldu. Yerel verileriniz kullanılıyor; seanslarınız güvendedir.', 'info');
          } else if (isOfflineErr) {
            showToast('Şu anda çevrimdışısınız. Yerel verileriniz yüklendi; bağlantı geldiğinde bulut ile eşitlenecektir.', 'info');
          } else {
            showToast('Bulut verileri eşitlenirken bir sorun oluştu, yerel verileriniz kullanılıyor.', 'error');
          }
        } finally {
          setIsAuthSyncing(false);
        }
      } else {
        setUser(null);
        hasSyncedRef.current = null;
        lastSavedRef.current = { settings: '', sessions: '' };
        // Load local storage if they log out
        const savedSessions = localStorage.getItem('psycalcu_sessions');
        const savedSettings = localStorage.getItem('psycalcu_settings');
        if (savedSessions) {
          try { setSessions(JSON.parse(savedSessions)); } catch (e) {}
        } else {
          setSessions([]);
        }
        if (savedSettings) {
          try { setSettings(JSON.parse(savedSettings)); } catch (e) {}
        }
        setIsInitialAuthCheckDone(true);
        setIsAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Refs to track latest values for safe unmount/unload saving
  const sessionsRef = useRef(sessions);
  const settingsRef = useRef(settings);
  
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);
  
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Flush any pending save on browser close/reload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user && !isQuotaExceeded) {
        const currentSettingsStr = JSON.stringify(settingsRef.current);
        const currentSessionsStr = JSON.stringify(sessionsRef.current);
        if (currentSettingsStr !== lastSavedRef.current.settings ||
            currentSessionsStr !== lastSavedRef.current.sessions) {
          saveUserData(user.uid, settingsRef.current, sessionsRef.current).catch(err => {
            console.error("beforeunload save error:", err);
          });
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user, isQuotaExceeded]);

  // Save settings & sessions to local & cloud on changes with debouncing and change-detection
  useEffect(() => {
    localStorage.setItem('psycalcu_settings', JSON.stringify(settings));
    localStorage.setItem('psycalcu_sessions', JSON.stringify(sessions));

    if (!user || isAuthSyncing || isQuotaExceeded) {
      return;
    }

    const currentSettingsStr = JSON.stringify(settings);
    const currentSessionsStr = JSON.stringify(sessions);

    // Skip saving to cloud if data hasn't changed since last cloud synchronization or save
    if (currentSettingsStr === lastSavedRef.current.settings &&
        currentSessionsStr === lastSavedRef.current.sessions) {
      return;
    }

    // Set saving indicator to true
    setIsCloudSaving(true);

    // Debounce cloud save by 500ms for high responsiveness
    const timer = setTimeout(() => {
      saveUserData(user.uid, settings, sessions).then(() => {
        lastSavedRef.current = {
          settings: currentSettingsStr,
          sessions: currentSessionsStr
        };
        setIsCloudSaving(false);
      }).catch((err: any) => {
        setIsCloudSaving(false);
        const isQuota = err?.message === 'quota-exceeded' || 
                        err?.message?.toLowerCase().includes('quota') || 
                        err?.code?.toLowerCase().includes('quota') ||
                        err?.message?.toLowerCase().includes('resource-exhausted') ||
                        err?.code?.toLowerCase().includes('resource-exhausted');
        if (isQuota) {
          setIsQuotaExceeded(true);
        } else {
          console.error("Bulut kayıt hatası:", err);
        }
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [settings, sessions, user, isAuthSyncing, isQuotaExceeded]);

  // Automatic Background Calendar Sync on App Load
  const hasAutoSyncedRef = useRef(false);
  useEffect(() => {
    if (isInitialAuthCheckDone && !isAuthLoading && !isAuthSyncing) {
      if (hasAutoSyncedRef.current) return;
      hasAutoSyncedRef.current = true;

      // Run with a slight delay so startup animation & layout render first
      const timer = setTimeout(() => {
        handleManualCalendarSync(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isInitialAuthCheckDone, isAuthLoading, isAuthSyncing, settings]);

  const handleAuthSuccess = async (currentUser: User) => {
    // onAuthStateChanged is the master of data loading; just reset ref to force fetch
    hasSyncedRef.current = null;
    setUser(currentUser);
  };

  const handleLogout = () => {
    setUser(null);
    hasSyncedRef.current = null;
  };

  // UI state
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [activeTab, setActiveTab] = useState<'agenda' | 'stats' | 'sync' | 'backup' | 'debts' | 'settings'>('agenda');
  const [debtSearchQuery, setDebtSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [showNotes, setShowNotes] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('psycalcu_show_notes');
      return saved !== 'false';
    } catch (e) {
      return true;
    }
  });

  const toggleShowNotes = () => {
    setShowNotes(prev => {
      const next = !prev;
      try {
        localStorage.setItem('psycalcu_show_notes', String(next));
      } catch (e) {}
      return next;
    });
  };

  const [showExplanations, setShowExplanations] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('psycalcu_show_explanations');
      return saved !== 'false';
    } catch (e) {
      return true;
    }
  });

  const toggleShowExplanations = () => {
    setShowExplanations(prev => {
      const next = !prev;
      try {
        localStorage.setItem('psycalcu_show_explanations', String(next));
      } catch (e) {}
      return next;
    });
  };

  const [showAiDetails, setShowAiDetails] = useState<boolean>(false);
  const [isFaqOpen, setIsFaqOpen] = useState<boolean>(false);
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);

  // Auto trigger tour for first-time logged-in users
  useEffect(() => {
    if (user) {
      const isCompleted = localStorage.getItem('psycalcu_tour_completed');
      if (!isCompleted) {
        const timer = setTimeout(() => {
          setIsTourOpen(true);
        }, 1500); // 1.5s delay for smooth transitions after auth
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  useEffect(() => {
    setShowAiDetails(false);
  }, [selectedDate]);
  
  // Google Sheets state
  const [sheetLinkInput, setSheetLinkInput] = useState('');
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);

  // AI Daily Summary state
  const [aiSummaries, setAiSummaries] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('psycalcu_ai_summaries');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  const isPastDate = (dateStr: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    return dateStr < todayStr;
  };

  const isOlderThan7Days = (dateStr: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const sDate = new Date(dateStr);
    sDate.setHours(0,0,0,0);
    
    const diffTime = today.getTime() - sDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 7;
  };

  // Generate date ribbon (7 days centered around selected date or today)
  const dateRibbon = useMemo(() => {
    const ribbon = [];
    const baseDate = new Date(selectedDate);
    for (let i = -3; i <= 3; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const yyyymmdd = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('tr-TR', { weekday: 'short' });
      const dayNum = d.getDate();
      ribbon.push({ dateStr: yyyymmdd, dayName, dayNum });
    }
    return ribbon;
  }, [selectedDate]);

  // Current Turkish date format for header
  const headerDateStr = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
  }, []);

  // Filtered sessions for the selected day
  const filteredSessions = useMemo(() => {
    return sessions
      .filter(s => s.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [sessions, selectedDate]);

  // Debt Calculations
  const debtsData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const nowStr = `${year}-${month}-${day}T${hours}:${minutes}`;

    const padTime = (timeStr: string) => {
      if (!timeStr) return "00:00";
      const parts = timeStr.split(':');
      const h = parts[0].padStart(2, '0');
      const m = (parts[1] || '00').padStart(2, '0');
      return `${h}:${m}`;
    };

    // Filter non-cancelled, unpaid, and realized (past or present) sessions
    const unpaidSessions = sessions.filter(s => {
      if (s.type === 'cancelled' || s.paymentStatus === 'paid') return false;
      const sessionDateTime = `${s.date}T${padTime(s.time)}`;
      return sessionDateTime <= nowStr;
    });
    
    // Total unpaid amount
    const totalUnpaidAmount = unpaidSessions.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    
    // Group by client
    const clientGroups: Record<string, Session[]> = {};
    unpaidSessions.forEach(s => {
      if (!clientGroups[s.clientName]) {
        clientGroups[s.clientName] = [];
      }
      clientGroups[s.clientName].push(s);
    });
    
    // Map to array of client debt info
    const clientsWithDebts = Object.entries(clientGroups).map(([clientName, clientSessions]) => {
      // Sort sessions by date and time (oldest first so they can pay oldest first)
      const sortedSessions = [...clientSessions].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });
      
      const totalAmount = sortedSessions.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
      
      return {
        clientName,
        sessions: sortedSessions,
        totalAmount,
        sessionCount: sortedSessions.length
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount); // Sort by total debt descending
    
    return {
      unpaidSessions,
      totalUnpaidAmount,
      clientsWithDebts,
      debtorCount: clientsWithDebts.length
    };
  }, [sessions]);

  const filteredDebtors = useMemo(() => {
    if (!debtSearchQuery.trim()) return debtsData.clientsWithDebts;
    const q = debtSearchQuery.toLowerCase();
    return debtsData.clientsWithDebts.filter(c => c.clientName.toLowerCase().includes(q));
  }, [debtsData.clientsWithDebts, debtSearchQuery]);

  // Financial calculations for the CURRENT MONTH
  const monthlyMetrics = useMemo(() => {
    const currentYearMonth = selectedDate.substring(0, 7); // e.g. "2026-06"
    
    let grossIncome = 0;
    let babysitterFees = 0;
    let officeRentExpenses = 0;
    let faceToFaceCount = 0;
    let onlineCount = 0;
    let cancelledCount = 0;

    sessions.forEach(s => {
      if (s.date.startsWith(currentYearMonth)) {
        if (s.type === 'cancelled') {
          cancelledCount++;
        } else {
          grossIncome += Number(s.price) || 0;
          babysitterFees += s.hasBabysitterFee ? (Number(s.babysitterFeeAmount) || 0) : 0;
          officeRentExpenses += s.hasOfficeRentFee ? (Number(s.officeRentFeeAmount) || 0) : 0;
          if (s.type === 'online') {
            onlineCount++;
          } else {
            faceToFaceCount++;
          }
        }
      }
    });

    const totalExpenses = babysitterFees + officeRentExpenses;
    const netIncome = Math.max(0, grossIncome - totalExpenses);

    return {
      grossIncome,
      babysitterFees,
      officeRentExpenses,
      totalExpenses,
      netIncome,
      onlineCount,
      faceToFaceCount,
      cancelledCount,
      monthName: new Date(selectedDate).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
    };
  }, [sessions, selectedDate, settings]);

  // Selected Day summary
  const dailySummary = useMemo(() => {
    let dayGross = 0;
    let dayBabysitter = 0;
    let dayOfficeRent = 0;
    let activeCount = 0;

    filteredSessions.forEach(s => {
      if (s.type !== 'cancelled') {
        dayGross += Number(s.price) || 0;
        dayBabysitter += s.hasBabysitterFee ? (Number(s.babysitterFeeAmount) || 0) : 0;
        dayOfficeRent += s.hasOfficeRentFee ? (Number(s.officeRentFeeAmount) || 0) : 0;
        activeCount++;
      }
    });

    const dayNet = dayGross - (dayBabysitter + dayOfficeRent);

    return {
      gross: dayGross,
      babysitter: dayBabysitter,
      officeRent: dayOfficeRent,
      net: dayNet,
      count: activeCount
    };
  }, [filteredSessions]);

  // CRUD actions
  const handleSaveSession = (savedSession: Session) => {
    const existing = sessions.find(s => s.id === savedSession.id);
    if (existing && isOlderThan7Days(existing.date)) {
      if (existing.date !== savedSession.date || existing.time !== savedSession.time) {
        showToast('7 günden eski seansların tarihi veya saati değiştirilemez!', 'error');
        return;
      }
    }
    const withTimestamp = { ...savedSession, updatedAt: Date.now(), isManuallyEdited: true };
    setSessions(prev => {
      const exists = prev.some(s => s.id === savedSession.id);
      if (exists) {
        return prev.map(s => s.id === savedSession.id ? withTimestamp : s);
      } else {
        return [...prev, withTimestamp];
      }
    });
  };

  const handleDeleteSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session && isOlderThan7Days(session.date)) {
      showToast('7 günden eski seanslar silinemez! Muhasebesi kilitlenmiştir.', 'error');
      return;
    }
    triggerConfirm(
      'Seansı Sil',
      'Bu seansı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      () => {
        setSessions(prev => prev.filter(s => s.id !== id));
      }
    );
  };

  const handleClearAllSessions = () => {
    setSessions([]);
    localStorage.setItem('psycalcu_sessions', JSON.stringify([]));
  };

  const handleToggleType = (id: string, currentType: 'online' | 'face-to-face' | 'cancelled') => {
    const session = sessions.find(s => s.id === id);
    if (session && isOlderThan7Days(session.date)) {
      showToast('7 günden eski seansların tipi değiştirilemez! Muhasebesi kilitlenmiştir.', 'error');
      return;
    }
    const nextTypeMap: Record<string, 'online' | 'face-to-face' | 'cancelled'> = {
      'online': 'face-to-face',
      'face-to-face': 'cancelled',
      'cancelled': 'online'
    };
    const nextType = nextTypeMap[currentType];
    setSessions(prev => prev.map(s => {
      if (s.id === id) {
        const updated = { ...s, type: nextType, updatedAt: Date.now(), isManuallyEdited: true };
        if (nextType === 'online') {
          updated.price = settings.defaultSessionPrice;
          updated.hasOfficeRentFee = false;
          updated.officeRentFeeAmount = 0;
          updated.hasBabysitterFee = true;
          updated.babysitterFeeAmount = settings.defaultBabysitterFee;
        } else if (nextType === 'face-to-face') {
          updated.price = settings.defaultSessionPrice;
          updated.hasOfficeRentFee = true;
          updated.officeRentFeeAmount = settings.defaultOfficeRentFee;
          updated.hasBabysitterFee = true;
          updated.babysitterFeeAmount = settings.defaultBabysitterFee;
        } else if (nextType === 'cancelled') {
          updated.price = 0;
          updated.hasBabysitterFee = false;
          updated.hasOfficeRentFee = false;
        }
        return updated;
      }
      return s;
    }));
  };

  const handleToggleBabysitter = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session && isOlderThan7Days(session.date)) {
      showToast('7 günden eski seansların bakıcı ücreti değiştirilemez! Muhasebesi kilitlenmiştir.', 'error');
      return;
    }
    setSessions(prev => prev.map(s => {
      if (s.id === id) {
        const hasFee = !s.hasBabysitterFee;
        return {
          ...s,
          hasBabysitterFee: hasFee,
          babysitterFeeAmount: hasFee ? settings.defaultBabysitterFee : 0,
          updatedAt: Date.now(),
          isManuallyEdited: true
        };
      }
      return s;
    }));
  };

  const handleTogglePaymentStatus = (id: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === id) {
        const nextStatus = s.paymentStatus === 'paid' ? 'unpaid' : 'paid';
        return {
          ...s,
          paymentStatus: nextStatus,
          updatedAt: Date.now(),
          isManuallyEdited: true
        };
      }
      return s;
    }));
    showToast('Ödeme durumu güncellendi.', 'success');
  };

  const handleMarkSessionAsPaid = (id: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === id) {
        return {
          ...s,
          paymentStatus: 'paid',
          updatedAt: Date.now(),
          isManuallyEdited: true
        };
      }
      return s;
    }));
    showToast('Seans ödemesi başarıyla tahsil edildi!', 'success');
  };

  const handleMarkAllClientSessionsAsPaid = (clientName: string) => {
    setSessions(prev => prev.map(s => {
      if (s.clientName === clientName && s.type !== 'cancelled' && s.paymentStatus !== 'paid') {
        return {
          ...s,
          paymentStatus: 'paid',
          updatedAt: Date.now(),
          isManuallyEdited: true
        };
      }
      return s;
    }));
    showToast(`${clientName} adlı danışanın tüm borçları ödendi olarak işaretlendi!`, 'success');
  };

  const handleGenerateSummary = async () => {
    setIsSummaryLoading(true);
    setShowAiDetails(true);
    try {
      const response = await fetch("/api/gemini/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          sessions: filteredSessions,
          dailyMetrics: dailySummary
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Yapay zeka özeti alınamadı.");
      }

      const data = await response.json();
      const summaryText = data.text;

      setAiSummaries(prev => {
        const updated = { ...prev, [selectedDate]: summaryText };
        localStorage.setItem('psycalcu_ai_summaries', JSON.stringify(updated));
        return updated;
      });

      showToast('Günün değerlendirmesi başarıyla oluşturuldu!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Özet oluşturulurken bir hata meydana geldi.', 'error');
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const handleImportSessions = (newSessions: Session[]) => {
    const sessionsMap = new Map(sessions.map(s => [s.id, s]));
    let addedCount = 0;
    let updatedCount = 0;
    const toUpdate: Session[] = [];

    newSessions.forEach(ns => {
      if (sessionsMap.has(ns.id)) {
        const existing = sessionsMap.get(ns.id)!;
        
        // CRITICAL FIX: If the user manually edited this session, do NOT let calendar sync overwrite its details!
        if (existing.isManuallyEdited) {
          return;
        }

        // Merge changed calendar fields, preserving custom user edits on price/payment status
        const updated = {
          ...existing,
          clientName: ns.clientName,
          date: ns.date,
          time: ns.time,
          duration: ns.duration,
          notes: ns.notes || existing.notes,
          price: existing.price !== settings.defaultSessionPrice ? existing.price : ns.price,
          paymentStatus: existing.paymentStatus || ns.paymentStatus,
        };
        
        // Only update if there is a real difference to avoid state mutations & unnecessary cloud writes
        if (JSON.stringify(existing) !== JSON.stringify(updated)) {
          updated.updatedAt = Date.now(); // Mark as updated since the calendar event changed
          toUpdate.push(updated);
          updatedCount++;
        }
      } else {
        const nsWithTimestamp = { ...ns, updatedAt: Date.now() };
        toUpdate.push(nsWithTimestamp);
        addedCount++;
      }
    });

    if (toUpdate.length > 0) {
      setSessions(prev => {
        const prevMap = new Map(prev.map(s => [s.id, s]));
        toUpdate.forEach(u => prevMap.set(u.id, u));
        return Array.from(prevMap.values());
      });
    }

    return { addedCount, updatedCount, totalParsed: newSessions.length };
  };

  const handleManualCalendarSync = async (showNotificationOnNoChanges = true) => {
    const { onlineCalendarWebcalUrl, faceToFaceCalendarWebcalUrl, calendarSyncEnabled } = settings;
    if (!calendarSyncEnabled) {
      if (showNotificationOnNoChanges) {
        showToast('Takvim senkronizasyonu ayarlardan devre dışı bırakılmış!', 'error');
      }
      return;
    }
    if (!onlineCalendarWebcalUrl && !faceToFaceCalendarWebcalUrl) {
      if (showNotificationOnNoChanges) {
        showToast('Henüz bir takvim linki bağlamamışsınız. Lütfen "Takvim Entegrasyonu" sayfasından link ekleyin.', 'info');
      }
      return;
    }

    setIsManualSyncing(true);
    let totalNewSessions: Session[] = [];
    let hasFetchedOnline = false;
    let hasFetchedFaceToFace = false;

    // Sync Online Calendar
    if (onlineCalendarWebcalUrl) {
      try {
        const response = await fetch(`/api/proxy-ical?url=${encodeURIComponent(onlineCalendarWebcalUrl)}`);
        if (response.ok) {
          const icsText = await response.text();
          const parsed = parseICS(icsText, settings.defaultSessionPrice, settings.defaultBabysitterFee, settings.defaultOfficeRentFee, 'online');
          if (parsed.length > 0) {
            totalNewSessions = [...totalNewSessions, ...parsed];
            hasFetchedOnline = true;
          }
        }
      } catch (err) {
        console.error("Online calendar sync failed:", err);
      }
    }

    // Sync Face-to-Face Calendar
    if (faceToFaceCalendarWebcalUrl) {
      try {
        const response = await fetch(`/api/proxy-ical?url=${encodeURIComponent(faceToFaceCalendarWebcalUrl)}`);
        if (response.ok) {
          const icsText = await response.text();
          const parsed = parseICS(icsText, settings.defaultSessionPrice, settings.defaultBabysitterFee, settings.defaultOfficeRentFee, 'face-to-face');
          if (parsed.length > 0) {
            totalNewSessions = [...totalNewSessions, ...parsed];
            hasFetchedFaceToFace = true;
          }
        }
      } catch (err) {
        console.error("Face-to-face calendar sync failed:", err);
      }
    }

    setIsManualSyncing(false);

    if (totalNewSessions.length > 0) {
      const stats = handleImportSessions(totalNewSessions);
      if (stats.addedCount > 0 || stats.updatedCount > 0) {
        showToast(`Takvim senkronizasyonu tamamlandı: ${stats.addedCount} yeni seans eklendi, ${stats.updatedCount} seans güncellendi.`, 'success');
      } else if (showNotificationOnNoChanges) {
        showToast('Takvimleriniz zaten güncel, yeni bir değişiklik bulunamadı.', 'info');
      }
    } else if (showNotificationOnNoChanges) {
      showToast('Takvimlerden seans bilgisi alınamadı veya takvim linkleri boş.', 'error');
    }
  };

  // Reset demo data
  const handleResetData = () => {
    const sessionCount = sessions.length;
    const warningMsg = `DİKKAT! Bu işlem mevcut tüm seans verilerinizi (${sessionCount} kayıt) KALICI OLARAK SİLECEK ve yerine ilk kurulumdaki örnek verileri yükleyecektir.\n\nEğer devam etmek istiyorsanız, kutuya büyük harflerle "SIFIRLA" yazın:`;
    
    const userInput = prompt(warningMsg);
    if (userInput === 'SIFIRLA') {
      setSessions(getInitialMockSessions(settings.defaultSessionPrice, settings.defaultBabysitterFee, settings.defaultOfficeRentFee));
      showToast('Tüm veriler başarıyla sıfırlandı ve örnek veriler yüklendi.', 'success');
    } else if (userInput !== null) {
      showToast('Sıfırlama işlemi iptal edildi. Doğrulama kelimesi (SIFIRLA) eşleşmedi.', 'error');
    }
  };

  // Google Sheets Export Logic (Valid CSV format with UTF-8 BOM)
  const handleExportCSV = () => {
    let csvContent = "\uFEFF"; // BOM for Excel/Sheets compatibility
    csvContent += "Tarih,Saat,Danışan Adı,Seans Tipi,Süre (Dakika),Seans Ücreti (₺),Bakıcı Gideri (₺),Ofis Kira Gideri (₺),Net Kazanç (₺),Notlar,Entegrasyon Durumu\n";
    
    sessions.forEach(s => {
      const gross = s.type === 'cancelled' ? 0 : Number(s.price);
      const baby = s.hasBabysitterFee ? Number(s.babysitterFeeAmount) : 0;
      const office = s.hasOfficeRentFee ? Number(s.officeRentFeeAmount) : 0;
      const net = Math.max(0, gross - (baby + office));
      const typeLabel = s.type === 'online' ? 'Online' : s.type === 'face-to-face' ? 'Yüz yüze' : 'İptal';
      const syncStatus = s.isSyncedFromCalendar ? 'Takvim Entegrasyonu' : 'Manuel Giriş';
      
      const row = [
        s.date,
        s.time,
        `"${s.clientName.replace(/"/g, '""')}"`,
        typeLabel,
        s.duration,
        gross,
        baby,
        office,
        net,
        `"${(s.notes || '').replace(/"/g, '""')}"`,
        syncStatus
      ].join(",");
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `psycalcu_seans_muhasebesi_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopySessionsToClipboard = () => {
    let tsvContent = "Tarih\tSaat\tDanışan Adı\tSeans Tipi\tSüre (Dakika)\tSeans Ücreti (₺)\tBakıcı Gideri (₺)\tOfis Kira Gideri (₺)\tNet Kazanç (₺)\tNotlar\tEntegrasyon Durumu\n";
    
    sessions.forEach(s => {
      const gross = s.type === 'cancelled' ? 0 : Number(s.price);
      const baby = s.hasBabysitterFee ? Number(s.babysitterFeeAmount) : 0;
      const office = s.hasOfficeRentFee ? Number(s.officeRentFeeAmount) : 0;
      const net = Math.max(0, gross - (baby + office));
      const typeLabel = s.type === 'online' ? 'Online' : s.type === 'face-to-face' ? 'Yüz yüze' : 'İptal';
      const syncStatus = s.isSyncedFromCalendar ? 'Takvim Entegrasyonu' : 'Manuel Giriş';
      
      const row = [
        s.date,
        s.time,
        s.clientName,
        typeLabel,
        s.duration,
        gross,
        baby,
        office,
        net,
        s.notes || '',
        syncStatus
      ].join("\t");
      tsvContent += row + "\n";
    });

    navigator.clipboard.writeText(tsvContent)
      .then(() => {
        showToast("Tüm seans verileriniz kopyalandı! Google E-Tablolar veya Excel'e yapıştırabilirsiniz.", "success");
      })
      .catch(() => {
        showToast("Kopyalama başarısız oldu. Tarayıcınız pano erişimine izin vermiyor olabilir.", "error");
      });
  };

  const handleBackupData = () => {
    const backupObj = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      sessions,
      settings
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `psycalcu_guvenli_yedek_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  const handleRestoreData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const files = e.target.files;
    if (!files || files.length === 0) return;

    fileReader.readAsText(files[0], "UTF-8");
    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        if (!parsed || (!parsed.sessions && !Array.isArray(parsed))) {
          showToast('Geçersiz yedek dosyası formatı. Lütfen psycalcu_guvenli_yedek_... dosyası yükleyin.', 'error');
          return;
        }

        const restoredSessions = parsed.sessions || parsed;
        const restoredSettings = parsed.settings || null;

        if (!Array.isArray(restoredSessions)) {
          showToast('Yedek dosyasında seans verisi bulunamadı.', 'error');
          return;
        }

        const confirmMsg = `${restoredSessions.length} seans kaydı ve özelleştirilmiş ayarlarınız yüklenecek. Mevcut verilerinizin üzerine yazılacaktır. Bu işlemi onaylıyor musunuz?`;
        triggerConfirm(
          'Yedek Geri Yükle',
          confirmMsg,
          () => {
            setSessions(restoredSessions);
            if (restoredSettings) {
              setSettings(restoredSettings);
            }
            showToast('Yedek başarıyla yüklendi! Seanslarınız ve ayarlarınız geri getirildi.', 'success');
            e.target.value = '';
          }
        );
      } catch (err) {
        showToast('Yedek dosyası okunurken bir hata oluştu. Dosyanın bozulmadığından emin olun.', 'error');
      }
    };
  };

  if (!isInitialAuthCheckDone) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#fdfbf7]" id="auth-loading-screen">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin text-[#6b705c] mx-auto" />
          <p className="text-sm font-serif italic text-slate-500">Güvenli bulut veritabanınız senkronize ediliyor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fdfbf7] p-6 relative overflow-hidden" id="auth-portal-screen">
        {/* Floating Help / FAQ Button */}
        <button
          onClick={() => setIsFaqOpen(true)}
          className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#f5f5f0] text-xs font-semibold text-[#6b705c] rounded-full border border-[#e5e1d8] transition-all cursor-pointer shadow-xs z-30"
          title="Yardım Merkezi & Sıkça Sorulan Sorular"
        >
          <HelpCircle className="w-4 h-4 text-[#cb997e]" />
          <span>Yardım & SSS</span>
        </button>

        <AuthCard
          user={null}
          onLogout={handleLogout}
          onAuthSuccess={handleAuthSuccess}
          existingSessionsCount={sessions.length}
          showToast={showToast}
          onOpenFaq={() => setIsFaqOpen(true)}
        />

        {/* FAQ Modal */}
        <FAQModal isOpen={isFaqOpen} onClose={() => setIsFaqOpen(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#fdfbf7] font-sans text-slate-800 antialiased selection:bg-[#cb997e]/20" id="psycalcu-root">
      
      {/* Header Navigation */}
      <nav className="sticky top-0 z-40 flex flex-col md:flex-row items-center justify-between px-6 md:px-8 py-4 border-b border-[#e5e1d8] bg-white gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#6b705c] rounded-xl flex items-center justify-center text-white font-serif text-2xl italic shadow-md">P</div>
          <div>
            <h1 className="text-xl font-serif italic text-[#6b705c] tracking-tight leading-none">PsyCalcu</h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-1">Psikolog Seans & Bütçe Ajandası</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-[#f5f5f0] p-1 rounded-full border border-[#e5e1d8] text-xs max-w-full overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            id="tab-agenda"
            onClick={() => setActiveTab('agenda')}
            className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer shrink-0 ${
              activeTab === 'agenda' ? 'bg-[#6b705c] text-white shadow-sm' : 'text-[#6b705c] hover:bg-[#e5e5df]'
            }`}
          >
            Günlük Ajanda
          </button>
          <button
            id="tab-stats"
            onClick={() => setActiveTab('stats')}
            className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer shrink-0 ${
              activeTab === 'stats' ? 'bg-[#6b705c] text-white shadow-sm' : 'text-[#6b705c] hover:bg-[#e5e5df]'
            }`}
          >
            Muhasebe Raporu
          </button>
          <button
            id="tab-debts"
            onClick={() => setActiveTab('debts')}
            className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer shrink-0 ${
              activeTab === 'debts' ? 'bg-[#6b705c] text-white shadow-sm' : 'text-[#6b705c] hover:bg-[#e5e5df]'
            }`}
          >
            Borç Takip
          </button>
          <button
            id="tab-sync"
            onClick={() => setActiveTab('sync')}
            className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer shrink-0 ${
              activeTab === 'sync' ? 'bg-[#6b705c] text-white shadow-sm' : 'text-[#6b705c] hover:bg-[#e5e5df]'
            }`}
          >
            Takvim Entegrasyonu
          </button>
          <button
            id="tab-backup"
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer shrink-0 ${
              activeTab === 'backup' ? 'bg-[#6b705c] text-white shadow-sm' : 'text-[#6b705c] hover:bg-[#e5e5df]'
            }`}
          >
            Yedek & E-Tablo
          </button>
        </div>

        <div className="flex items-center gap-4">
          {settings.onlineCalendarWebcalUrl || settings.faceToFaceCalendarWebcalUrl ? (
            <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100" id="calendar-sync-active-pill">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Takvim Entegrasyonu Aktif
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100" id="calendar-sync-inactive-pill">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 animate-pulse"></span>
              </span>
              Takvim Linki Eklenmedi
            </div>
          )}

          {/* Bulut Senkronizasyon Durumu Pill */}
          {user && (
            <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
              isQuotaExceeded
                ? 'text-amber-700 bg-amber-50 border-amber-100'
                : (isAuthSyncing || isCloudSaving)
                  ? 'text-amber-700 bg-amber-50 border-amber-100' 
                  : 'text-emerald-700 bg-emerald-50 border-emerald-100'
            }`} id="cloud-sync-status-pill">
              {isQuotaExceeded ? (
                <>
                  <div className="p-0.5 bg-amber-100 text-amber-700 rounded-full">
                    <span className="text-xs">⚠️</span>
                  </div>
                  <span className="font-semibold text-amber-800">Kota Doldu (Yerel Aktif)</span>
                </>
              ) : isAuthSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span className="font-semibold">Bulut Senkronizasyonu Sürüyor...</span>
                </>
              ) : isCloudSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span className="font-semibold">Buluta Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <div className="p-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                    <Check className="w-3 h-3 font-bold" />
                  </div>
                  <span className="font-semibold text-emerald-800">Bulut Eşleşti (Tamamlandı)</span>
                </>
              )}
            </div>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-slate-700">{settings.therapistName}</p>
            <p className="text-[10px] text-slate-600 font-semibold">{headerDateStr}</p>
          </div>
          
          <button
            id="toggle-explanations-btn"
            onClick={toggleShowExplanations}
            className={`w-10 h-10 rounded-full border border-[#e5e1d8] flex items-center justify-center transition-all cursor-pointer ${
              showExplanations 
                ? 'bg-[#6b705c] text-white hover:bg-[#585c4c]' 
                : 'bg-[#fdfbf7] text-slate-500 hover:bg-[#f5f5f0]'
            }`}
            title={showExplanations ? "Yardımcı Açıklamaları Gizle" : "Yardımcı Açıklamaları Göster"}
          >
            <Lightbulb className="w-4 h-4" />
          </button>

          <button
            id="faq-btn"
            onClick={() => setIsFaqOpen(true)}
            className="w-10 h-10 rounded-full border border-[#e5e1d8] bg-[#fdfbf7] flex items-center justify-center text-[#cb997e] hover:bg-[#f5f5f0] transition-all cursor-pointer"
            title="Yardım Merkezi & Sıkça Sorulan Sorular"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            id="settings-btn"
            onClick={() => setIsSettingsOpen(true)}
            className="w-10 h-10 rounded-full border border-[#e5e1d8] bg-[#fdfbf7] flex items-center justify-center text-[#6b705c] hover:bg-[#f5f5f0] transition-all cursor-pointer"
            title="Ayarlar"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6" id="psycalcu-main">
        {isQuotaExceeded && (
          <div className="mb-6 p-5 bg-rose-50 border border-rose-200 rounded-[2rem] text-slate-800 flex flex-col md:flex-row items-start justify-between gap-5 shadow-sm" id="quota-warning-banner">
            <div className="flex gap-3">
              <span className="text-2xl mt-0.5">⚠️</span>
              <div>
                <h4 className="font-bold text-sm text-rose-950">Bulut Kotası Doldu! Lütfen sistem yöneticinizle iletişime geçin.</h4>
                <p className="text-xs text-rose-900 mt-1">
                  Bulut veritabanı kotası dolduğu için yeni değişiklikleriniz şu an için buluta kaydedilemiyor ancak tarayıcınızın yerel depolama hafızasında (Local Storage) tam ve güvenli bir şekilde saklanıyor. 
                </p>
                {showExplanations && (
                  <div className="mt-2 text-xs bg-white/60 p-3 rounded-xl border border-rose-100 space-y-1.5 animate-fade-in">
                    <p className="font-semibold text-rose-950">🔒 Veri Güvenliği Bilgilendirmesi:</p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-700 leading-normal">
                      <li><strong className="text-emerald-800">Tarayıcıyı veya bilgisayarı kapatmak:</strong> Verilerinizi <strong>silmez</strong>. Tarayıcıyı kapatıp açtığınızda verileriniz aynen yüklenir.</li>
                      <li><strong className="text-rose-700">Tarayıcı geçmişini silmek / Çerezleri temizlemek:</strong> "Site verilerini" temizlerseniz veya tarayıcıyı sıfırlarsanız Local Storage verileri <strong>tamamen silinir!</strong></li>
                      <li><strong className="text-rose-700">Gizli Sekme (Incognito):</strong> Eğer uygulamayı gizli sekmede açtıysanız, sekmeyi kapattığınızda tüm verileriniz <strong>silinir!</strong></li>
                    </ul>
                    <p className="text-[11px] text-slate-600 mt-1 italic">
                      Öneri: Kota yenilenene kadar tarayıcı verilerini temizlemeyin ve tedbir amacıyla <strong className="text-slate-800">"Yedek & E-Tablo"</strong> sayfasından verilerinizi manuel yedek (.json) olarak bilgisayarınıza indirin.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0 self-end md:self-start">
              <span className="px-4 py-2 bg-rose-600 text-white rounded-full text-xs font-bold shadow-xs">
                Sistem Yöneticisi Uyarısı
              </span>
            </div>
          </div>
        )}
        <AnimatePresence mode="wait">
          {activeTab === 'agenda' && (
            <motion.div
              key="agenda-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              
              {/* LEFT Column: Financial Overview */}
              <div className="lg:col-span-4 flex flex-col gap-6 order-2 lg:order-1">
                
                {/* Balance Card */}
                <div className="bg-[#6b705c] p-6 rounded-[2rem] text-white shadow-lg relative overflow-hidden" id="balance-card">
                  <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-28 h-28 bg-white/5 rounded-full pointer-events-none" />
                  
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs uppercase tracking-wider opacity-80 font-semibold">{monthlyMetrics.monthName} Tahmini Net Kâr</p>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">Aylık Rapor</span>
                  </div>
                  
                  <h2 className="text-4xl font-serif">₺{monthlyMetrics.netIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h2>
                  
                  <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/20 pt-4 text-xs">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-70">Aylık Brüt Gelir</p>
                      <p className="text-lg font-semibold mt-0.5">₺{monthlyMetrics.grossIncome.toLocaleString('tr-TR')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-70">Aylık Toplam Gider</p>
                      <p className="text-lg font-semibold mt-0.5">₺{monthlyMetrics.totalExpenses.toLocaleString('tr-TR')}</p>
                    </div>
                  </div>
                </div>

                {/* Bulut Senkronizasyon Paneli (Firebase Auth & Firestore) */}
                <AuthCard
                  user={user}
                  onLogout={handleLogout}
                  onAuthSuccess={handleAuthSuccess}
                  existingSessionsCount={sessions.length}
                  showToast={showToast}
                  showExplanations={showExplanations}
                />

                {/* Expense Breakdown Card */}
                <div className="bg-white p-6 rounded-[2rem] border border-[#e5e1d8] flex-1 flex flex-col justify-between" id="expense-breakdown-card">
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#a5a58d] mb-4">Aylık Gider Detayları</h3>
                    
                    {/* Office Rent Item */}
                    <div className="flex justify-between items-center bg-[#fdfbf7] p-3 rounded-2xl border border-[#e5e1d8]/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 text-sm">🏠</div>
                        <div>
                          <span className="text-xs font-semibold block">Ofis Kira Gideri</span>
                          <span className="text-[9px] text-slate-600 font-medium">Seans başı biriken</span>
                        </div>
                      </div>
                      <span className="font-bold text-sm text-slate-700">₺{monthlyMetrics.officeRentExpenses.toLocaleString('tr-TR')}</span>
                    </div>

                    {/* Babysitter Fee Item */}
                    <div className="flex justify-between items-center bg-[#fdfbf7] p-3 rounded-2xl border border-[#e5e1d8]/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 text-sm">👶</div>
                        <div>
                          <span className="text-xs font-semibold block">Bakıcı Ücretleri</span>
                          <span className="text-[9px] text-slate-600 font-medium">Seans başı ödenen</span>
                        </div>
                      </div>
                      <span className="font-bold text-sm text-blue-600">₺{monthlyMetrics.babysitterFees.toLocaleString('tr-TR')}</span>
                    </div>

                    {/* Rent percentage hint */}
                    <div className="pt-2">
                      <div className="bg-[#f5f5f0] p-4 rounded-2xl">
                        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                          <span>Gider Oranı (Brüte Göre)</span>
                          <span className="font-bold">
                            {monthlyMetrics.grossIncome > 0 
                              ? `%${Math.round((monthlyMetrics.totalExpenses / monthlyMetrics.grossIncome) * 100)}` 
                              : '%0'}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#cb997e] rounded-full transition-all duration-500" 
                            style={{ 
                              width: `${monthlyMetrics.grossIncome > 0 
                                ? Math.min(100, (monthlyMetrics.totalExpenses / monthlyMetrics.grossIncome) * 100) 
                                : 0}%` 
                            }}
                          ></div>
                        </div>
                        {showExplanations && (
                          <p className="text-[9px] text-slate-600 leading-tight mt-2 italic font-medium animate-fade-in">
                            * Bakıcı seans başı <span className="font-bold text-[#6b705c]">₺{settings.defaultBabysitterFee}</span>, ofis seans başı <span className="font-bold text-[#6b705c]">₺{settings.defaultOfficeRentFee}</span> üzerinden hesaplanır.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  </div>
                </div>

              {/* RIGHT Column: Agenda & Calendar Sync */}
              <div className="lg:col-span-8 flex flex-col gap-6 order-1 lg:order-2" id="daily-agenda-section">
                
                {/* Horizontal Date Ribbon Picker */}
                <div className="bg-white rounded-[2rem] border border-[#e5e1d8] p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-3 px-2">
                    <span className="text-xs font-bold text-[#a5a58d] uppercase tracking-wider">Tarih Seçimi</span>
                    <input 
                      type="date" 
                      value={selectedDate}
                      onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                      className="px-3 py-1 bg-[#f5f5f0] hover:bg-[#e5e5df] text-xs font-semibold text-[#6b705c] rounded-full border border-[#e5e1d8] focus:outline-none"
                    />
                  </div>
                  
                  {/* Date band selection */}
                  <div className="grid grid-cols-7 gap-2">
                    {dateRibbon.map((day) => {
                      const isSelected = day.dateStr === selectedDate;
                      const isToday = day.dateStr === new Date().toISOString().split('T')[0];
                      return (
                        <button
                          key={day.dateStr}
                          onClick={() => setSelectedDate(day.dateStr)}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-2xl transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-[#6b705c] text-white shadow-md' 
                              : 'bg-[#fdfbf7] hover:bg-[#f5f5f0] border border-[#e5e1d8]/60 text-slate-600'
                          }`}
                        >
                          <span className={`text-[9px] uppercase tracking-widest font-bold ${isSelected ? 'text-white/90' : 'text-slate-600'}`}>
                            {day.dayName}
                          </span>
                          <span className="text-lg font-serif font-bold mt-0.5">
                            {day.dayNum}
                          </span>
                          {isToday && (
                            <span className={`w-1 h-1 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-[#cb997e]'}`}></span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Daily Agenda List */}
                <div className="bg-white rounded-[2rem] border border-[#e5e1d8] flex flex-col min-h-[400px] overflow-hidden shadow-sm">
                  
                  {/* Card Header */}
                  <div className="px-6 md:px-8 py-5 border-b border-[#f5f5f0] flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                    <div>
                      <h3 className="text-xl font-serif text-[#6b705c] flex items-center gap-2">
                        Günlük Ajanda
                        <span className="text-xs bg-[#f5f5f0] text-slate-700 font-sans font-semibold px-2.5 py-0.5 rounded-full border border-slate-300">
                          {new Date(selectedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                        </span>
                      </h3>
                      {showExplanations && (
                        <p className="text-xs text-slate-600 mt-1 font-medium animate-fade-in">Apple Takvim entegrasyonu ve manuel yönetilen seanslar</p>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      {/* Show/Hide Notes Switch */}
                      <button
                        onClick={toggleShowNotes}
                        className="flex items-center gap-2 group cursor-pointer focus:outline-none select-none"
                        title={showNotes ? "Notları Gizle" : "Notları Göster"}
                      >
                        <span className="text-xs font-medium text-slate-500 group-hover:text-[#6b705c] transition-colors">Notları Göster</span>
                        <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${showNotes ? 'bg-[#6b705c]' : 'bg-slate-200'}`}>
                          <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${showNotes ? 'translate-x-3.5' : 'translate-x-0'}`} />
                        </div>
                      </button>

                      {/* Show/Hide Explanations Switch */}
                      <button
                        onClick={toggleShowExplanations}
                        className="flex items-center gap-2 group cursor-pointer focus:outline-none select-none"
                        title={showExplanations ? "Açıklamaları Gizle" : "Açıklamaları Göster"}
                      >
                        <span className="text-xs font-medium text-slate-500 group-hover:text-[#6b705c] transition-colors">Açıklamaları Göster</span>
                        <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${showExplanations ? 'bg-[#6b705c]' : 'bg-slate-200'}`}>
                          <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${showExplanations ? 'translate-x-3.5' : 'translate-x-0'}`} />
                        </div>
                      </button>

                      {/* Sync Button */}
                      <button
                        onClick={() => handleManualCalendarSync(true)}
                        disabled={isManualSyncing}
                        className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer border ${
                          isManualSyncing
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-white hover:bg-slate-50 text-[#6b705c] border-[#e5e1d8] hover:border-[#6b705c]/40'
                        }`}
                        title="Tüm iCloud/Google takvim seanslarını şimdi eşitle"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin' : ''}`} />
                        {isManualSyncing ? 'Eşitleniyor...' : 'Takvimi Eşitle'}
                      </button>

                      <button 
                        id="add-session-btn"
                        onClick={() => {
                          setEditingSession(null);
                          setIsSessionModalOpen(true);
                        }}
                        className="px-5 py-2 bg-[#6b705c] hover:bg-[#585c4c] text-white rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Yeni Seans Ekle
                      </button>
                    </div>
                  </div>

                  {/* Session List */}
                  <div className="flex-1 p-4 md:p-6 space-y-3 overflow-y-auto">
                    {filteredSessions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <CalendarIcon className="w-12 h-12 text-[#a5a58d]/60 stroke-[1.5] mb-2" />
                        <h4 className="text-sm font-semibold text-slate-600">Bu Tarihte Seansınız Yok</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs">
                          Yeni seans ekleyebilir veya Apple Takvim Entegrasyonu sekmesinden iCloud takviminizi senkronize edebilirsiniz.
                        </p>
                      </div>
                    ) : (
                      filteredSessions.map((session) => {
                        const isCancelled = session.type === 'cancelled';
                        const isFaceToFace = session.type === 'face-to-face';
                        
                        return (
                          <div
                            key={session.id}
                            className={`group flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl border transition-all ${
                              isCancelled 
                                ? 'bg-red-50/20 border-red-100 opacity-60' 
                                : isFaceToFace 
                                ? 'bg-amber-50/20 border-[#ddbea9]/40 hover:border-[#ddbea9]' 
                                : 'bg-white border-slate-100 hover:border-[#ddbea9]'
                            }`}
                          >
                            {/* Time */}
                            <div className="flex sm:flex-col items-center sm:items-center w-full sm:w-16 shrink-0 justify-between sm:justify-center border-b sm:border-b-0 pb-2 sm:pb-0 border-slate-100">
                              <p className="text-sm font-bold text-slate-700 flex items-center gap-1 sm:block">
                                <Clock className="w-3.5 h-3.5 text-slate-400 inline sm:hidden" />
                                {session.time}
                              </p>
                              <p className="text-[10px] text-slate-600 uppercase tracking-wider font-bold mt-0.5">
                                {isCancelled ? 'İptal' : `${session.duration} dk`}
                              </p>
                            </div>

                            {/* Divider strip */}
                            <div className={`hidden sm:block w-[3px] h-10 rounded-full shrink-0 ${
                              isCancelled 
                                ? 'bg-red-300' 
                                : isFaceToFace 
                                ? 'bg-amber-400' 
                                : 'bg-emerald-400'
                            }`} />

                            {/* Client & Description */}
                            <div className="flex-1 w-full">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-slate-800">{session.clientName}</h4>
                                
                                {/* Status badge */}
                                {isCancelled ? (
                                  <span className="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-0.5">
                                    <Ban className="w-2.5 h-2.5" /> İPTAL
                                  </span>
                                ) : isFaceToFace ? (
                                  <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-0.5">
                                    <MapPin className="w-2.5 h-2.5" /> YÜZYÜZE
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-0.5">
                                    <Laptop className="w-2.5 h-2.5" /> ONLINE
                                  </span>
                                )}

                                {/* Apple calendar flag */}
                                {session.isSyncedFromCalendar && (
                                  <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">
                                    Takvimden
                                  </span>
                                )}
                              </div>
                              
                              {showNotes && (
                                <p className="text-xs text-slate-700 mt-1 font-semibold italic animate-fade-in">
                                  {session.notes || 'Açıklama girilmemiş.'}
                                </p>
                              )}
                            </div>

                            {/* Financial item state */}
                            <div className="text-left sm:text-right w-full sm:w-auto flex sm:flex-col justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 gap-2">
                              <div>
                                <p className={`text-sm font-bold ${isCancelled ? 'text-slate-400 line-through' : 'text-[#6b705c]'}`}>
                                  +₺{session.price}
                                </p>
                                {session.hasBabysitterFee && (
                                  <p className="text-[10px] text-rose-500 font-semibold mt-0.5">
                                    -₺{session.babysitterFeeAmount} (Bakıcı)
                                  </p>
                                )}
                              </div>

                              {/* Payment Status Toggle Badge */}
                              {!isCancelled && (
                                <button
                                  onClick={() => handleTogglePaymentStatus(session.id)}
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all border shrink-0 text-center cursor-pointer ${
                                    session.paymentStatus === 'paid'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                  }`}
                                  title={session.paymentStatus === 'paid' ? 'Ödenmedi olarak işaretle' : 'Ödendi olarak işaretle'}
                                >
                                  {session.paymentStatus === 'paid' ? '● Ödendi' : '○ Ödenmedi'}
                                </button>
                              )}
                            </div>

                            {/* Quick Actions (Hover visible on desktop, always visible on mobile) */}
                            <div className="flex items-center gap-2 border-l border-[#e5e1d8]/40 pl-3 shrink-0 flex-wrap">
                              {/* Toggle Type */}
                              <button
                                onClick={() => {
                                  if (isOlderThan7Days(session.date)) {
                                    showToast('7 günden eski seansların tipi değiştirilemez! (Muhasebe kilitlenmiştir)', 'error');
                                    return;
                                  }
                                  handleToggleType(session.id, session.type);
                                }}
                                className={`p-2.5 md:p-1.5 rounded-xl md:rounded-lg transition-colors cursor-pointer border md:border-transparent ${
                                  isOlderThan7Days(session.date)
                                    ? 'text-slate-300 bg-slate-50 border-slate-100 cursor-not-allowed opacity-40 md:bg-transparent md:border-transparent'
                                    : 'text-slate-700 bg-slate-100/95 border-slate-200/50 hover:text-[#6b705c] hover:bg-slate-200/60 md:bg-transparent md:text-slate-500 md:hover:bg-slate-50'
                                }`}
                                title={isOlderThan7Days(session.date) ? '7 günden eski seansların tipi değiştirilemez' : 'Seans Tipini Değiştir'}
                              >
                                <RefreshCw className="w-4 h-4 md:w-3.5 md:h-3.5" />
                              </button>

                              {/* Toggle Babysitter */}
                              <button
                                onClick={() => {
                                  if (isOlderThan7Days(session.date)) {
                                    showToast('7 günden eski seansların bakıcı ücreti değiştirilemez! (Muhasebe kilitlenmiştir)', 'error');
                                    return;
                                  }
                                  handleToggleBabysitter(session.id);
                                }}
                                className={`p-2.5 md:p-1.5 rounded-xl md:rounded-lg transition-all cursor-pointer border md:border-transparent ${
                                  isOlderThan7Days(session.date)
                                    ? 'text-slate-300 bg-slate-50 border-slate-100 cursor-not-allowed opacity-40 md:bg-transparent md:border-transparent'
                                    : session.hasBabysitterFee 
                                    ? 'text-blue-700 bg-blue-100/80 border-blue-200 hover:bg-blue-100 md:bg-blue-50/50 md:text-blue-500 md:hover:bg-blue-50' 
                                    : 'text-slate-700 bg-slate-100/95 border-slate-200/50 hover:text-blue-600 hover:bg-blue-50 md:bg-transparent md:text-slate-400'
                                }`}
                                title={isOlderThan7Days(session.date) ? '7 günden eski seansların bakıcı ücreti değiştirilemez' : 'Bakıcı Ücretini Aç/Kapat'}
                              >
                                <span className="text-xs font-bold font-serif leading-none">👶</span>
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() => {
                                  setEditingSession(session);
                                  setIsSessionModalOpen(true);
                                }}
                                className="p-2.5 md:p-1.5 rounded-xl md:rounded-lg bg-amber-100/80 md:bg-transparent border border-amber-200/50 md:border-transparent text-amber-900 md:text-slate-500 hover:text-amber-700 hover:bg-amber-100 md:hover:bg-slate-50 transition-all cursor-pointer font-bold"
                                title="Seansı Düzenle"
                              >
                                <Edit3 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => {
                                  if (isOlderThan7Days(session.date)) {
                                    showToast('7 günden eski seanslar silinemez! (Muhasebe kilitlenmiştir)', 'error');
                                    return;
                                  }
                                  handleDeleteSession(session.id);
                                }}
                                className={`p-2.5 md:p-1.5 rounded-xl md:rounded-lg transition-colors cursor-pointer border md:border-transparent ${
                                  isOlderThan7Days(session.date)
                                    ? 'text-slate-300 bg-slate-50 border-slate-100 cursor-not-allowed opacity-40 md:bg-transparent md:border-transparent'
                                    : 'text-slate-700 bg-slate-100/95 border-slate-200/50 hover:text-rose-600 hover:bg-rose-50 md:bg-transparent md:text-slate-400 md:hover:bg-slate-50'
                                }`}
                                title={isOlderThan7Days(session.date) ? '7 günden eski seanslar silinemez' : 'Seansı Sil'}
                              >
                                <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Summary Footer in Card */}
                  <div className="p-6 bg-[#f5f5f0] border-t border-[#e5e1d8]/40 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex gap-8 w-full sm:w-auto justify-around sm:justify-start">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Günün Seansları</span>
                        <span className="text-lg font-serif italic font-bold text-[#6b705c]">{dailySummary.count} Seans</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Günlük Net Kâr</span>
                        <span className="text-lg font-serif italic font-bold text-emerald-700">₺{dailySummary.net.toLocaleString('tr-TR')}</span>
                      </div>
                    </div>
                    <div className="text-center sm:text-right">
                      <span className="text-[10px] text-slate-400 block uppercase tracking-widest">Canlı Takvim Durumu</span>
                      <span className="text-xs text-slate-600 italic">Son senkronizasyon: Şimdi</span>
                    </div>
                  </div>
                </div>

                {/* AI Summary Card */}
                {!showAiDetails ? (
                  <div id="ai-summary-card" className="bg-white rounded-[2rem] border border-[#e5e1d8] shadow-sm p-4 mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#fdfbf7] rounded-xl flex items-center justify-center text-[#cb997e] shrink-0 border border-[#e5e1d8]/50">
                        <Sparkles className="w-5 h-5 text-[#cb997e]" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700">Yapay Zeka Günlük Değerlendirmesi</h4>
                        {showExplanations && (
                          <p className="text-xs text-slate-400 font-medium animate-fade-in">Günün seanslarını, finansal dengesini ve klinik yoğunluğunu analiz edin.</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowAiDetails(true);
                        if (!aiSummaries[selectedDate]) {
                          handleGenerateSummary();
                        }
                      }}
                      className="px-5 py-2.5 bg-[#cb997e] hover:bg-[#b58368] text-white rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {aiSummaries[selectedDate] ? 'Analizi Detaylıca Göster' : 'Yapay Zeka ile Analiz Et'}
                    </button>
                  </div>
                ) : (
                  <div id="ai-summary-card" className="bg-white rounded-[2rem] border border-[#e5e1d8] overflow-hidden shadow-sm p-6 md:p-8 mt-6 animate-fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#f5f5f0] pb-5">
                      <div>
                        <h3 className="text-lg font-serif text-[#6b705c] flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-[#cb997e]" />
                          Yapay Zeka Günlük Değerlendirmesi
                        </h3>
                        {showExplanations && (
                          <p className="text-xs text-slate-400 mt-1 animate-fade-in">
                            Günün seanslarını, finansal dengesini ve klinik yoğunluğunu analiz edin.
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
                        <button
                          onClick={() => setShowAiDetails(false)}
                          className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-[#e5e1d8]"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                          Detayları Gizle
                        </button>

                        <button
                          onClick={handleGenerateSummary}
                          disabled={isSummaryLoading}
                          className={`px-5 py-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ${
                            isSummaryLoading 
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                              : 'bg-[#cb997e] hover:bg-[#b58368] text-white'
                          }`}
                        >
                          {isSummaryLoading ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                              Özetleniyor...
                            </>
                          ) : aiSummaries[selectedDate] ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5" />
                              Analizi Yenile
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              Yapay Zeka ile Analiz Et
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="mt-6">
                      {isSummaryLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                          <div className="relative w-10 h-10">
                            <div className="absolute inset-0 rounded-full border-2 border-[#cb997e]/20 animate-ping" />
                            <div className="absolute inset-0 rounded-full border-2 border-t-[#cb997e] animate-spin" />
                          </div>
                          <p className="text-xs text-slate-500 animate-pulse font-medium">
                            Gün seansları analiz ediliyor ve klinik rapor oluşturuluyor...
                          </p>
                        </div>
                      ) : aiSummaries[selectedDate] ? (
                        <div className="prose prose-sm max-w-none text-slate-600 leading-relaxed text-sm markdown-body">
                          <ReactMarkdown>{aiSummaries[selectedDate]}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 space-y-3">
                          <Sparkles className="w-10 h-10 text-[#a5a58d]/40 stroke-[1.5]" />
                          <div>
                            <h4 className="text-sm font-semibold text-slate-600">Henüz Değerlendirme Yapılmadı</h4>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                              Günün seans dengesini, gelir-gider oranlarını ve yapay zeka klinik asistanınızın önerilerini görmek için yukarıdaki butona tıklayın.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div
              key="stats-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <StatsDashboard sessions={sessions} settings={settings} showExplanations={showExplanations} />
            </motion.div>
          )}

          {activeTab === 'debts' && (
            <motion.div
              key="debts-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Header Card */}
              <div className="bg-[#cb997e] p-8 rounded-[2.5rem] text-white shadow-md relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
                <div className="max-w-2xl">
                  <span className="text-[10px] bg-white/20 px-3 py-1 rounded-full font-semibold uppercase tracking-wider">Tahsilat Takip</span>
                  <h2 className="text-3xl font-serif mt-3">Borç & Ödeme Takip Sayfası</h2>
                  {showExplanations && (
                    <p className="text-sm opacity-90 mt-2 leading-relaxed animate-fade-in">
                      Danışanlarınızın henüz ödenmemiş seans ücretlerini buradan takip edebilirsiniz. Ödeme durumunu güncellediğinizde aylık kazanç raporunuz otomatik olarak güncellenir.
                    </p>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-[#e5e1d8] shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 text-xl font-bold">
                    ₺
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Toplam Alacak</span>
                    <span className="text-xl font-bold text-slate-800">₺{debtsData.totalUnpaidAmount.toLocaleString('tr-TR')}</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#e5e1d8] shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 text-lg">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Ödenmemiş Seans</span>
                    <span className="text-xl font-bold text-slate-800">{debtsData.unpaidSessions.length} Seans</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#e5e1d8] shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#6b705c]/10 flex items-center justify-center text-[#6b705c] text-lg">
                    <Users className="w-5 h-5 text-[#6b705c]" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Borçlu Danışan</span>
                    <span className="text-xl font-bold text-slate-800">{debtsData.debtorCount} Kişi</span>
                  </div>
                </div>
              </div>

              {/* Debtors List and Search */}
              <div className="bg-white rounded-[2rem] border border-[#e5e1d8] overflow-hidden shadow-xs flex flex-col min-h-[400px]">
                {/* Header and Search */}
                <div className="p-6 md:p-8 border-b border-[#f5f5f0] flex flex-col sm:flex-row justify-between items-center gap-4 bg-[#fdfbf7]">
                  <div>
                    <h3 className="text-lg font-serif text-[#6b705c] italic">Borç Listesi</h3>
                    {showExplanations && (
                      <p className="text-xs text-slate-400 animate-fade-in">Danışan bazında gruplanmış bekleyen bakiyeler</p>
                    )}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#a5a58d]" />
                    <input
                      type="text"
                      placeholder="Danışan adı ara..."
                      value={debtSearchQuery}
                      onChange={(e) => setDebtSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-[#e5e1d8] rounded-full focus:outline-none focus:border-[#6b705c]"
                    />
                  </div>
                </div>

                {/* List Container */}
                <div className="p-6 space-y-6 flex-1">
                  {debtsData.unpaidSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 text-3xl">
                        ✓
                      </div>
                      <div>
                        <h4 className="text-base font-serif italic text-slate-700">Tebrikler, Tüm Seanslar Ödendi!</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm">
                          Şu an sistemde bekleyen borcu olan danışan bulunmuyor. Her şey yolunda ve dengede.
                        </p>
                      </div>
                    </div>
                  ) : filteredDebtors.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 text-xs">
                      Aradığınız isimle eşleşen borçlu danışan bulunamadı.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {filteredDebtors.map(debtor => (
                        <div key={debtor.clientName} className="border border-[#e5e1d8]/80 rounded-2xl p-5 bg-[#fdfbf7]/40 hover:shadow-xs transition-shadow flex flex-col justify-between space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-slate-800 text-base">{debtor.clientName}</h4>
                              <p className="text-xs text-slate-400 mt-0.5">{debtor.sessionCount} adet seans borcu</p>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-bold text-red-600 block">₺{debtor.totalAmount.toLocaleString('tr-TR')}</span>
                              <span className="text-[9px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-wider">ÖDENMEDİ</span>
                            </div>
                          </div>

                          {/* Sessions mini list */}
                          <div className="border-t border-[#e5e1d8]/40 pt-3 space-y-2">
                            {debtor.sessions.map(s => {
                              const isFaceToFace = s.type === 'face-to-face';
                              return (
                                <div key={s.id} className="flex justify-between items-center text-xs bg-white p-2.5 rounded-xl border border-slate-100">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 font-medium text-slate-700">
                                      <span className="text-[11px]">{new Date(s.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
                                      <span className="text-[10px] text-slate-400">{s.time}</span>
                                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold uppercase tracking-wider ${
                                        isFaceToFace ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                      }`}>
                                        {isFaceToFace ? 'Yüzyüze' : 'Online'}
                                      </span>
                                    </div>
                                    {showNotes && s.notes && (
                                      <p className="text-[10px] text-slate-400 italic max-w-[200px] truncate" title={s.notes}>
                                        {s.notes}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800 text-xs">₺{s.price}</span>
                                    <button
                                      onClick={() => handleMarkSessionAsPaid(s.id)}
                                      className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200 cursor-pointer transition-all"
                                      title="Ödendi Olarak İşaretle"
                                    >
                                      ✓ Ödendi Yap
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Bulk action */}
                          <button
                            onClick={() => handleMarkAllClientSessionsAsPaid(debtor.clientName)}
                            className="w-full py-2 bg-[#6b705c] hover:bg-[#585c4c] text-white text-[11px] font-bold rounded-xl shadow-xs cursor-pointer transition-colors text-center"
                          >
                            Tüm Seansları Ödendi İşaretle (₺{debtor.totalAmount.toLocaleString('tr-TR')})
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'sync' && (
            <motion.div
              key="sync-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <CalendarSyncGuide
                onImportSessions={handleImportSessions}
                defaultPrice={settings.defaultSessionPrice}
                defaultBabysitterFee={settings.defaultBabysitterFee}
                defaultOfficeRentFee={settings.defaultOfficeRentFee}
                settings={settings}
                onSaveSettings={(updated) => setSettings(updated)}
                showToast={showToast}
                sessions={sessions}
                onGoToDate={(date) => setSelectedDate(date)}
                setActiveTab={setActiveTab}
                showExplanations={showExplanations}
              />
            </motion.div>
          )}

          {activeTab === 'backup' && (
            <motion.div
              key="backup-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="bg-[#6b705c] p-8 rounded-[2.5rem] text-white shadow-md relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
                <div className="max-w-2xl">
                  <span className="text-[10px] bg-white/20 px-3 py-1 rounded-full font-semibold uppercase tracking-wider">Veri Yönetimi</span>
                  <h2 className="text-3xl font-serif mt-3">Yedekleme & E-Tablo Entegrasyonu</h2>
                  <p className="text-sm opacity-90 mt-2 leading-relaxed">
                    Uygulamadaki seanslarınızı dilediğiniz zaman bilgisayarınıza yedekleyebilir, silebilir veya Google E-Tablo / Excel formatında dışa aktararak profesyonel muhasebe raporlarınızı oluşturabilirsiniz.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Google Sheets & Excel Integration Card */}
                <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[#e5e1d8] shadow-xs flex flex-col justify-between space-y-4" id="google-sheets-integration-card">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[#6b705c] flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5" />
                      E-Tablo & Excel Entegrasyonu
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Seanslarınızı tek tıkla Google E-Tablo'ya yapıştırın veya cihazınıza Excel uyumlu formatta (.csv) indirin.
                    </p>
                  </div>

                  {showExplanations && (
                    <div className="space-y-2 bg-[#fdfbf7] p-4 rounded-2xl border border-[#e5e1d8] animate-fade-in">
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                        💡 <span className="text-[#6b705c] font-bold">Pratik Yapıştırma Yöntemi:</span> Aşağıdaki butona tıklayıp Google Sheets veya Excel'i açarak dilediğiniz hücreye tıklayın ve <kbd className="bg-white px-1 py-0.5 border border-slate-200 rounded text-[9px] font-mono shadow-xs">Ctrl+V</kbd> (Mac'te <kbd className="bg-white px-1 py-0.5 border border-slate-200 rounded text-[9px] font-mono shadow-xs">Cmd+V</kbd>) tuşlarına basın. Tüm verileriniz anında sütunlara ayrışır!
                      </p>
                    </div>
                  )}

                  <div className="space-y-2 pt-2">
                    {/* Clipboard Copy Button */}
                    <button
                      type="button"
                      onClick={handleCopySessionsToClipboard}
                      className="w-full py-3 bg-[#6b705c] hover:bg-[#585c4c] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Google E-Tablo için Kopyala
                    </button>

                    {/* Direct Export to Excel button */}
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="w-full py-3 bg-[#cb997e]/10 hover:bg-[#cb997e]/25 text-[#a26848] text-xs font-semibold rounded-xl border border-[#cb997e]/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>📥</span>
                      Excel / CSV Olarak İndir
                    </button>
                  </div>
                </div>

                {/* Offline Secure Backup Card */}
                <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[#e5e1d8] shadow-xs flex flex-col justify-between space-y-4" id="offline-backup-card">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[#6b705c] flex items-center gap-2">
                      <Database className="w-5 h-5" />
                      Bulutsuz Güvenli Yedekleme
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Tarayıcı geçmişinizi temizleseniz bile verilerinizin kaybolmaması için bilgisayarınıza veya telefonunuza yedek dosyası indirin.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Backup Button */}
                    <button
                      type="button"
                      onClick={handleBackupData}
                      className="py-3 bg-[#fdfbf7] hover:bg-[#f5f5f0] text-[#6b705c] text-xs font-semibold rounded-xl border border-[#e5e1d8] flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center"
                      title="Tüm seansları ve ayarları yedek dosyası olarak kaydet"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Yedek İndir
                    </button>

                    {/* Restore Button */}
                    <div className="relative">
                      <label className="w-full py-3 bg-[#fdfbf7] hover:bg-[#f5f5f0] text-slate-600 text-xs font-semibold rounded-xl border border-[#e5e1d8] flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center h-full">
                        <Upload className="w-3.5 h-3.5" />
                        Yedeği Yükle
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleRestoreData}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {showExplanations && (
                    <div className="space-y-2 bg-[#fdfbf7] p-4 rounded-2xl border border-[#e5e1d8] animate-fade-in">
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        * Verileriniz internete gönderilmez, tamamen cihazınızda yerel yedeklenir. Bilgisayar değiştirdiğinizde veya geçmişi temizlediğinizde bu yedek dosyasını yükleyebilirsiniz.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Email Report Generator Component */}
              <EmailReportGenerator
                sessions={sessions}
                settings={settings}
                showToast={showToast}
                userEmail={user?.email || undefined}
                showExplanations={showExplanations}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Settings Modal Component */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={(updated) => setSettings(updated)}
        onClearAllSessions={handleClearAllSessions}
        showExplanations={showExplanations}
        onToggleExplanations={toggleShowExplanations}
      />

      {/* Session Add/Edit Modal Component */}
      <SessionModal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        sessionToEdit={editingSession}
        onSave={handleSaveSession}
        defaultPrice={settings.defaultSessionPrice}
        defaultBabysitterFee={settings.defaultBabysitterFee}
        defaultOfficeRentFee={settings.defaultOfficeRentFee}
        selectedDate={selectedDate}
      />

      {/* FAQ Modal Component */}
      <FAQModal
        isOpen={isFaqOpen}
        onClose={() => setIsFaqOpen(false)}
        onStartTour={() => setIsTourOpen(true)}
      />

      {/* Interactive Onboarding Tour */}
      <InteractiveTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        setActiveTab={(tab) => {
          if (['agenda', 'stats', 'sync', 'backup', 'debts', 'settings'].includes(tab)) {
            setActiveTab(tab as any);
          }
        }}
        showToast={showToast}
      />

      {/* Aesthetic Footer */}
      <footer className="border-t border-[#e5e1d8] bg-white mt-12 pt-6 pb-24 sm:pb-28 text-center text-xs text-slate-400">
        <p>© 2026 PsyCalcu • <span className="font-bold text-[#6b705c]">v1.5.3</span> • Apple Takvim & Seans Muhasebe Entegrasyonu</p>
        <p className="mt-1 font-serif italic text-[#a5a58d]">Ruh sağlığınız kadar finansal sağlığınız da değerlidir.</p>
      </footer>

      {/* Custom Confirmation Dialog Overlay */}
      {confirmState && confirmState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" id="confirm-dialog-overlay">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-slate-100 flex flex-col gap-4 animate-scale-up" id="confirm-dialog-container">
            <div className="flex gap-3 items-start">
              <div className="p-2 bg-amber-50 rounded-xl text-amber-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800 font-sans">{confirmState.title}</h3>
                <p className="text-xs text-slate-500 font-sans leading-relaxed">{confirmState.message}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-2">
              <button
                onClick={() => setConfirmState(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={() => {
                  confirmState.onConfirm();
                  setConfirmState(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Overlay */}
      {toast && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 left-4 sm:left-auto z-50 max-w-[calc(100vw-2rem)] sm:max-w-sm w-auto sm:w-full p-4 bg-white border border-slate-100 shadow-xl rounded-2xl flex gap-3 items-start animate-slide-in-right" id="toast-overlay">
          <div className={`p-2 rounded-xl shrink-0 ${
            toast.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
            toast.type === 'error' ? 'bg-rose-50 text-rose-600' :
            'bg-blue-50 text-blue-600'
          }`}>
            {toast.type === 'success' ? (
              <ShieldCheck className="w-4 h-4" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </div>
          <div className="space-y-0.5 flex-1 pr-4">
            <p className="text-xs font-bold text-slate-800 font-sans">
              {toast.type === 'success' ? 'Başarılı' : toast.type === 'error' ? 'Hata' : 'Bilgi'}
            </p>
            <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
              {toast.message}
            </p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-300 hover:text-slate-500 font-sans text-xs font-semibold transition-colors absolute right-4 top-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Floating Bottom Action Bar for Quick Session Creation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 px-4 w-auto pointer-events-none" id="floating-bottom-action-bar">
        <button
          onClick={() => {
            setEditingSession(null);
            setIsSessionModalOpen(true);
          }}
          className="pointer-events-auto bg-[#cb997e] hover:bg-[#b58368] hover:shadow-lg text-white font-medium text-xs sm:text-sm px-6 py-3 rounded-full flex items-center gap-2 shadow-xl transition-all transform hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Yeni Seans Ekle
        </button>
      </div>
    </div>
  );
}
