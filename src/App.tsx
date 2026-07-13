import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  CalendarPlus,
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
  FileText,
  AlertCircle,
  XCircle,
  X,
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
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  LogOut,
  Lock,
  Filter,
  Calculator,
  CalendarRange
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { Session, SessionType, AppSettings, toTurkishUpper, AppNotification, getNormalizedClientName, getSmartClientPrice, getSmartClientCosts } from './types';
import { getInitialMockSessions, parseICS } from './utils/icsParser';
import { downloadSessionAsICS } from './utils/icsGenerator';
import CalendarSyncGuide from './components/CalendarSyncGuide';
import EmailReportGenerator from './components/EmailReportGenerator';
import SettingsModal from './components/SettingsModal';
import SessionModal from './components/SessionModal';
import StatsDashboard from './components/StatsDashboard';
import AuthCard from './components/AuthCard';
import FAQModal from './components/FAQModal';
import SyncDetailsModal from './components/SyncDetailsModal';
import DebtPaymentConfirmationModal from './components/DebtPaymentConfirmationModal';
import InteractiveTour from './components/InteractiveTour';
import AdminPanel from './components/AdminPanel';
import { auth, onAuthStateChanged, User, db, getRedirectResult, signOut } from './lib/firebase';
import { fetchUserData, saveUserData, migrateLocalDataToFirestore, isFirestoreQuotaExceeded } from './lib/firestoreService';
import { collection, onSnapshot, query, limit, orderBy, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { NotificationCenter } from './components/NotificationCenter';
import { validateSessionAction, incrementWeeklyManualActionCount } from './utils/sessionLimit';

// Reusable custom view for locked features controlled by the Admin
const FeatureLockedView = ({ title, icon, description }: { title: string; icon: React.ReactNode; description: string }) => (
  <div className="bg-white rounded-[2.5rem] border border-[#e5e1d8] p-8 md:p-12 text-center max-w-xl mx-auto shadow-xs my-12 animate-fade-in flex flex-col items-center justify-center space-y-5">
    <div className="w-16 h-16 rounded-3xl bg-rose-50 flex items-center justify-center text-rose-500 relative">
      {icon}
      <div className="absolute -bottom-1 -right-1 bg-white border border-rose-100 rounded-full p-1 shadow-xs">
        <span className="text-xs">🔒</span>
      </div>
    </div>
    <div className="space-y-2">
      <h3 className="text-xl font-serif font-bold text-slate-800">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">
        {description}
      </p>
    </div>
    <div className="pt-3 border-t border-slate-100 w-full text-center">
      <p className="text-xs text-slate-400 font-medium">
        Bu özellik yöneticiniz tarafından geçici olarak sınırlandırılmıştır. Bilgi almak veya aktifleştirmek için lütfen <span className="font-semibold text-[#6b705c]">muhammedakifkayacan@gmail.com</span> ile iletişime geçin.
      </p>
    </div>
  </div>
);

// Auto-correct any session before July 1, 2026 to be 0 TL and marked as 'paid'
const autoCorrectPastSessions = (sessionList: Session[]): Session[] => {
  if (!sessionList) return [];
  return sessionList.map(s => {
    if (s.date && s.date < '2026-07-01') {
      if (s.price !== 0 || s.paymentStatus !== 'paid' || s.hasOfficeRentFee || s.hasBabysitterFee) {
        return {
          ...s,
          price: 0,
          paymentStatus: 'paid',
          hasBabysitterFee: false,
          babysitterFeeAmount: 0,
          hasOfficeRentFee: false,
          officeRentFeeAmount: 0,
          updatedAt: Date.now() // Mark as updated to trigger cloud sync saving
        };
      }
    }
    return s;
  });
};

const DEFAULT_SETTINGS: AppSettings = {
  defaultSessionPrice: 1200,
  defaultBabysitterFee: 250,
  defaultOfficeRentFee: 200,
  therapistName: 'Dr. Melis Kaya',
  calendarSyncEnabled: true,
  onlineCalendarWebcalUrl: '',
  faceToFaceCalendarWebcalUrl: '',
  googleSheetId: '',
  googleSheetsLinked: false,
  enableSmartClientPriceMatching: false,
};

export default function App() {
  // Load settings from localStorage or set defaults
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('psycalcu_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          defaultSessionPrice: parsed.defaultSessionPrice ?? DEFAULT_SETTINGS.defaultSessionPrice,
          defaultBabysitterFee: parsed.defaultBabysitterFee ?? DEFAULT_SETTINGS.defaultBabysitterFee,
          defaultOfficeRentFee: parsed.defaultOfficeRentFee ?? parsed.monthlyOfficeRent ?? DEFAULT_SETTINGS.defaultOfficeRentFee,
          therapistName: parsed.therapistName ?? DEFAULT_SETTINGS.therapistName,
          calendarSyncEnabled: parsed.calendarSyncEnabled ?? DEFAULT_SETTINGS.calendarSyncEnabled,
          onlineCalendarWebcalUrl: parsed.onlineCalendarWebcalUrl ?? parsed.calendarWebcalUrl ?? DEFAULT_SETTINGS.onlineCalendarWebcalUrl,
          faceToFaceCalendarWebcalUrl: parsed.faceToFaceCalendarWebcalUrl ?? DEFAULT_SETTINGS.faceToFaceCalendarWebcalUrl,
          googleSheetId: parsed.googleSheetId ?? DEFAULT_SETTINGS.googleSheetId,
          googleSheetsLinked: parsed.googleSheetsLinked ?? DEFAULT_SETTINGS.googleSheetsLinked,
          enableSmartClientPriceMatching: parsed.enableSmartClientPriceMatching ?? DEFAULT_SETTINGS.enableSmartClientPriceMatching,
        };
      } catch (e) {}
    }
    return DEFAULT_SETTINGS;
  });

  // Load sessions from localStorage or use empty array
  const [sessions, setSessions] = useState<Session[]>(() => {
    const saved = localStorage.getItem('psycalcu_sessions');
    if (saved) {
      try {
        return autoCorrectPastSessions(JSON.parse(saved));
      } catch (e) {}
    }
    return [];
  });

  // Authentication & Cloud Sync states
  const [user, setUser] = useState<User | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<'approved' | 'pending' | 'rejected' | 'checking'>('checking');
  const [registrationCreatedAt, setRegistrationCreatedAt] = useState<string | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [maxSessionsLimit, setMaxSessionsLimit] = useState<string | number>('unlimited');
  const [featuresAIAllowed, setFeaturesAIAllowed] = useState<boolean>(true);
  const [featuresExportAllowed, setFeaturesExportAllowed] = useState<boolean>(true);
  const [featuresCalendarAllowed, setFeaturesCalendarAllowed] = useState<boolean>(true);
  const [featuresAccountingAllowed, setFeaturesAccountingAllowed] = useState<boolean>(true);
  const [featuresDebtTrackerAllowed, setFeaturesDebtTrackerAllowed] = useState<boolean>(true);
  const [featuresSmartPriceMatchingAllowed, setFeaturesSmartPriceMatchingAllowed] = useState<boolean>(true);
  const [isInitialAuthCheckDone, setIsInitialAuthCheckDone] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthSyncing, setIsAuthSyncing] = useState(false);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(isFirestoreQuotaExceeded);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [isInitialSyncDone, setIsInitialSyncDone] = useState(false);
  const hasSyncedRef = useRef<string | null>(null);
  const lastSavedRef = useRef<{ settings: string; sessions: string }>((() => {
    const savedSessions = localStorage.getItem('psycalcu_sessions');
    let initialSessionsStr = '[]';
    if (savedSessions) {
      try {
        initialSessionsStr = JSON.stringify(autoCorrectPastSessions(JSON.parse(savedSessions)));
      } catch (e) {}
    }
    const savedSettingsStr = localStorage.getItem('psycalcu_settings') || '';
    return { settings: savedSettingsStr, sessions: initialSessionsStr };
  })());

  // Notification States
  const [localNotifications, setLocalNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('psycalcu_local_notifications');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [announcements, setAnnouncements] = useState<AppNotification[]>([]);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('psycalcu_read_announcement_ids');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Real-time listener for admin announcements in Firestore
  useEffect(() => {
    if (!user) {
      setAnnouncements([]);
      return;
    }
    try {
      const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(50));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedAnnouncements: AppNotification[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const timestamp = data.createdAt ? new Date(data.createdAt).getTime() : Date.now();
          loadedAnnouncements.push({
            id: doc.id,
            title: data.title || 'Duyuru',
            message: data.message || '',
            type: 'announcement',
            timestamp,
            read: false, // determined dynamically in memoized value below
            author: data.author || 'Yönetici'
          });
        });
        setAnnouncements(loadedAnnouncements);
      }, (error) => {
        console.warn("Firestore announcements sub error (gracefully handled):", error);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn("Firestore query creation error:", err);
    }
  }, [user]);

  // Synchronize and load user-specific or anonymous preferences, AI summaries, and notifications
  useEffect(() => {
    const notificationsKey = user ? `psycalcu_local_notifications_${user.uid}` : 'psycalcu_local_notifications';
    const announcementsKey = user ? `psycalcu_read_announcement_ids_${user.uid}` : 'psycalcu_read_announcement_ids';
    const summariesKey = user ? `psycalcu_ai_summaries_${user.uid}` : 'psycalcu_ai_summaries';
    const notesKey = user ? `psycalcu_show_notes_${user.uid}` : 'psycalcu_show_notes';
    const explanationsKey = user ? `psycalcu_show_explanations_${user.uid}` : 'psycalcu_show_explanations';

    try {
      const savedNotifications = localStorage.getItem(notificationsKey);
      setLocalNotifications(savedNotifications ? JSON.parse(savedNotifications) : []);
    } catch (e) {
      setLocalNotifications([]);
    }

    try {
      const savedAnnouncements = localStorage.getItem(announcementsKey);
      setReadAnnouncementIds(savedAnnouncements ? JSON.parse(savedAnnouncements) : []);
    } catch (e) {
      setReadAnnouncementIds([]);
    }

    try {
      const savedSummaries = localStorage.getItem(summariesKey);
      setAiSummaries(savedSummaries ? JSON.parse(savedSummaries) : {});
    } catch (e) {
      setAiSummaries({});
    }

    try {
      const savedNotes = localStorage.getItem(notesKey);
      setShowNotes(savedNotes !== 'false');
    } catch (e) {
      setShowNotes(true);
    }

    try {
      const savedExplanations = localStorage.getItem(explanationsKey);
      setShowExplanations(savedExplanations !== 'false');
    } catch (e) {
      setShowExplanations(true);
    }
  }, [user]);

  // Set initial sync done to true for guest mode, and false for logged-in users initially
  useEffect(() => {
    if (!user) {
      setIsInitialSyncDone(true);
    } else {
      setIsInitialSyncDone(false);
    }
  }, [user]);

  const allNotifications = useMemo<AppNotification[]>(() => {
    const annotsWithReadState = announcements.map(ann => ({
      ...ann,
      read: readAnnouncementIds.includes(ann.id)
    }));
    const merged = [...localNotifications, ...annotsWithReadState];
    return merged.sort((a, b) => b.timestamp - a.timestamp);
  }, [localNotifications, announcements, readAnnouncementIds]);

  const handleMarkAllAsRead = () => {
    setLocalNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      const notificationsKey = user ? `psycalcu_local_notifications_${user.uid}` : 'psycalcu_local_notifications';
      localStorage.setItem(notificationsKey, JSON.stringify(updated));
      return updated;
    });
    
    const allAnnotIds = announcements.map(ann => ann.id);
    setReadAnnouncementIds(prev => {
      const updated = Array.from(new Set([...prev, ...allAnnotIds]));
      const announcementsKey = user ? `psycalcu_read_announcement_ids_${user.uid}` : 'psycalcu_read_announcement_ids';
      localStorage.setItem(announcementsKey, JSON.stringify(updated));
      return updated;
    });
    
    // Explicitly update only toast without adding another notification loop
    setToast({ message: 'Bütün bildirimler okundu olarak işaretlendi.', type: 'info' });
  };

  const handleClearAllNotifications = () => {
    setLocalNotifications([]);
    const notificationsKey = user ? `psycalcu_local_notifications_${user.uid}` : 'psycalcu_local_notifications';
    localStorage.removeItem(notificationsKey);
    
    const allAnnotIds = announcements.map(ann => ann.id);
    setReadAnnouncementIds(prev => {
      const updated = Array.from(new Set([...prev, ...allAnnotIds]));
      const announcementsKey = user ? `psycalcu_read_announcement_ids_${user.uid}` : 'psycalcu_read_announcement_ids';
      localStorage.setItem(announcementsKey, JSON.stringify(updated));
      return updated;
    });
    
    setToast({ message: 'Bildirim geçmişi temizlendi.', type: 'info' });
  };

  const handleAddAnnouncement = async (title: string, message: string, type: 'info' | 'success' | 'error' | 'system') => {
    try {
      await addDoc(collection(db, 'announcements'), {
        title,
        message,
        type,
        createdAt: new Date().toISOString(),
        author: 'Yönetici'
      });
    } catch (err) {
      console.error("Error creating announcement in Firestore:", err);
      throw err;
    }
  };

  // Toast Notification State
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success', extraNotifData?: Partial<AppNotification>) => {
    setToast({ message, type });

    // Auto-log a notification
    const newNotif: AppNotification = {
      id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      title: extraNotifData?.title || (type === 'success' ? 'Başarılı İşlem' : type === 'error' ? 'Sistem Hatası' : 'Bilgilendirme'),
      message,
      type: extraNotifData?.type || (type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'),
      timestamp: Date.now(),
      read: false,
      ...extraNotifData
    };

    setLocalNotifications(prev => {
      const updated = [newNotif, ...prev].slice(0, 100);
      const notificationsKey = user ? `psycalcu_local_notifications_${user.uid}` : 'psycalcu_local_notifications';
      localStorage.setItem(notificationsKey, JSON.stringify(updated));
      return updated;
    });
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
    hasCountdown?: boolean;
  } | null>(null);
  const [confirmCountdown, setConfirmCountdown] = useState(5);

  const triggerConfirm = (title: string, message: string, onConfirm: () => void, hasCountdown = false) => {
    setConfirmState({ isOpen: true, title, message, onConfirm, hasCountdown });
  };

  useEffect(() => {
    if (confirmState && confirmState.isOpen && confirmState.hasCountdown) {
      setConfirmCountdown(5);
      const interval = setInterval(() => {
        setConfirmCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setConfirmCountdown(0);
    }
  }, [confirmState]);

  // Handle redirect result for Google sign-in on mobile
  useEffect(() => {
    const isPendingRedirect = localStorage.getItem('psycalcu_pending_redirect') === 'true';
    if (isPendingRedirect) {
      setIsInitialAuthCheckDone(false);
    }
    getRedirectResult(auth)
      .then((result) => {
        localStorage.removeItem('psycalcu_pending_redirect');
        if (result?.user) {
          setUser(result.user);
          showToast('Google Hesabınız ile başarıyla giriş yapıldı.', 'success');
        }
        setIsInitialAuthCheckDone(true);
      })
      .catch((err) => {
        localStorage.removeItem('psycalcu_pending_redirect');
        console.error("Redirect Auth Error:", err);
        // Do not block with error toast if it was a user cancellation
        if (err.code !== 'auth/redirect-cancelled') {
          showToast('Giriş işlemi tamamlanamadı. Lütfen tekrar deneyiniz.', 'error');
        }
        setIsInitialAuthCheckDone(true);
      });
  }, []);

  const activeSavesCountRef = useRef(0);

  // Monitor Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      const isPendingRedirect = localStorage.getItem('psycalcu_pending_redirect') === 'true';
      if (!isPendingRedirect) {
        setIsInitialAuthCheckDone(true);
      }
      setIsAuthLoading(false);
      if (!currentUser) {
        hasSyncedRef.current = null;
        lastSavedRef.current = { settings: '', sessions: '' };
        setRegistrationCreatedAt(null);
        setIsCloudSaving(false);
        setIsAuthSyncing(false);
        activeSavesCountRef.current = 0;
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
      } else {
        // Immediately load user-specific cached data for a seamless instant UI transition on different devices
        const userSessionsKey = `psycalcu_sessions_${currentUser.uid}`;
        const userSettingsKey = `psycalcu_settings_${currentUser.uid}`;
        const savedSessions = localStorage.getItem(userSessionsKey);
        const savedSettings = localStorage.getItem(userSettingsKey);
        
        if (savedSessions) {
          try { 
            const parsed = JSON.parse(savedSessions);
            setSessions(autoCorrectPastSessions(parsed)); 
          } catch (e) {}
        } else {
          setSessions([]);
        }
        
        if (savedSettings) {
          try {
            const parsed = JSON.parse(savedSettings);
            setSettings({
              defaultSessionPrice: parsed.defaultSessionPrice ?? DEFAULT_SETTINGS.defaultSessionPrice,
              defaultBabysitterFee: parsed.defaultBabysitterFee ?? DEFAULT_SETTINGS.defaultBabysitterFee,
              defaultOfficeRentFee: parsed.defaultOfficeRentFee ?? parsed.monthlyOfficeRent ?? DEFAULT_SETTINGS.defaultOfficeRentFee,
              therapistName: parsed.therapistName ?? DEFAULT_SETTINGS.therapistName,
              calendarSyncEnabled: parsed.calendarSyncEnabled ?? DEFAULT_SETTINGS.calendarSyncEnabled,
              onlineCalendarWebcalUrl: parsed.onlineCalendarWebcalUrl ?? parsed.calendarWebcalUrl ?? DEFAULT_SETTINGS.onlineCalendarWebcalUrl,
              faceToFaceCalendarWebcalUrl: parsed.faceToFaceCalendarWebcalUrl ?? DEFAULT_SETTINGS.faceToFaceCalendarWebcalUrl,
              googleSheetId: parsed.googleSheetId ?? DEFAULT_SETTINGS.googleSheetId,
              googleSheetsLinked: parsed.googleSheetsLinked ?? DEFAULT_SETTINGS.googleSheetsLinked,
              enableSmartClientPriceMatching: parsed.enableSmartClientPriceMatching ?? DEFAULT_SETTINGS.enableSmartClientPriceMatching,
            });
          } catch (e) {}
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
        
        // Also initialize lastSavedRef to prevent immediate auto-saving before sync
        lastSavedRef.current = {
          settings: savedSettings || '',
          sessions: savedSessions ? JSON.stringify(autoCorrectPastSessions(JSON.parse(savedSessions))) : '[]'
        };
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen to Registration/Approval Status
  useEffect(() => {
    if (!user) {
      setRegistrationStatus('checking');
      setRegistrationError(null);
      return;
    }

    const cleanEmail = (user.email || '').trim().toLowerCase();

    if (cleanEmail === 'muhammedakifkayacan@gmail.com') {
      setRegistrationStatus('approved');
      setRegistrationError(null);
      return;
    }

    if (cleanEmail === 'uzmpsikologbusra@gmail.com') {
      setRegistrationCreatedAt('2026-07-01T00:00:00.000Z');
    }

    setRegistrationStatus('checking');
    setRegistrationError(null);
    
    // Subscribe to registration document
    const regRef = doc(db, 'registrations', user.uid);
    const unsubscribe = onSnapshot(regRef, async (docSnap) => {
      try {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setRegistrationStatus(data.status || 'pending');
          setMaxSessionsLimit(data.maxSessionsLimit ?? 'unlimited');
          setFeaturesAIAllowed(data.featuresAIAllowed !== false);
          setFeaturesExportAllowed(data.featuresExportAllowed !== false);
          setFeaturesCalendarAllowed(data.featuresCalendarAllowed !== false);
          setFeaturesAccountingAllowed(data.featuresAccountingAllowed !== false);
          setFeaturesDebtTrackerAllowed(data.featuresDebtTrackerAllowed !== false);
          setFeaturesSmartPriceMatchingAllowed(data.featuresSmartPriceMatchingAllowed !== false);
          
          let regCreated = data.createdAt;
          // Protect and correct uzmpsikologbusra@gmail.com's registration date
          if (cleanEmail === 'uzmpsikologbusra@gmail.com' && data.createdAt !== '2026-07-01T00:00:00.000Z') {
            regCreated = '2026-07-01T00:00:00.000Z';
            setDoc(regRef, { createdAt: '2026-07-01T00:00:00.000Z' }, { merge: true }).catch(err => {
              console.error("Error correcting registration date for Büşra:", err);
            });
          }
          if (regCreated) {
            setRegistrationCreatedAt(regCreated);
          }
          
          setRegistrationError(null);
        } else {
          // Document doesn't exist, create it as pending
          try {
            const newReg = {
              userId: user.uid,
              email: user.email || 'bilinmiyor',
              displayName: user.displayName || 'Psikolog',
              status: 'pending',
              createdAt: cleanEmail === 'uzmpsikologbusra@gmail.com' ? '2026-07-01T00:00:00.000Z' : new Date().toISOString()
            };
            await setDoc(regRef, newReg);
            setRegistrationStatus('pending');
            setRegistrationCreatedAt(newReg.createdAt);
            setRegistrationError(null);

            // Notify Admin via backend API
            fetch('/api/notify-admin-registration', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userEmail: user.email, userId: user.uid })
            }).catch(err => console.error("Email notification alert failed:", err));

          } catch (err: any) {
            console.error("Error creating registration document:", err);
            setRegistrationError(err?.message || String(err));
            setRegistrationStatus('pending');
          }
        }
      } catch (err: any) {
        console.error("Error inside onSnapshot callback:", err);
        setRegistrationError(err?.message || String(err));
      }
    }, (error) => {
      console.error("Error listening to registration document:", error);
      setRegistrationError(error?.message || String(error));
      setRegistrationStatus('pending');
    });

    return () => unsubscribe();
  }, [user]);

  // Handle Cloud Sync for Approved Users
  useEffect(() => {
    if (!user || registrationStatus !== 'approved') {
      return;
    }

    if (hasSyncedRef.current === user.uid) {
      return;
    }
    hasSyncedRef.current = user.uid;

    const performSync = async () => {
      try {
        setIsAuthSyncing(true);
        const cloudData = await fetchUserData(user.uid);
        
        // Check if there was an explicit request to migrate anonymous local data
        const shouldMigrate = localStorage.getItem('psycalcu_should_migrate') === 'true';
        
        if (cloudData) {
          // EXISTING USER WHO ALREADY HAS CLOUD DATA
          let localSessions: Session[] = [];
          
          if (shouldMigrate) {
            // User explicitly requested to migrate anonymous data into their existing cloud account
            const savedSessionsStr = localStorage.getItem('psycalcu_sessions');
            if (savedSessionsStr) {
              try { localSessions = JSON.parse(savedSessionsStr); } catch (e) {}
            }
          } else {
            // Standard flow: Use user-specific cached local sessions (for offline work support)
            const userSessionsKey = `psycalcu_sessions_${user.uid}`;
            const savedSessionsStr = localStorage.getItem(userSessionsKey);
            if (savedSessionsStr) {
              try { localSessions = JSON.parse(savedSessionsStr); } catch (e) {}
            }
          }
          
          const cloudSessions = autoCorrectPastSessions(cloudData.sessions || []);
          
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
          
          const finalSessions = autoCorrectPastSessions([...mergedSessions, ...localOnly]);
          
          // If the merged sessions list differs from cloud sessions, trigger a save back to the cloud
          if (JSON.stringify(cloudSessions) !== JSON.stringify(finalSessions)) {
            setSessions(finalSessions);
            setSettings(cloudData.settings);
            // Save the merged data to the cloud
            await saveUserData(user.uid, cloudData.settings, finalSessions);
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
          
          // Wipe anonymous local storage if migrated to prevent re-migration or leak
          if (shouldMigrate) {
            localStorage.removeItem('psycalcu_sessions');
            localStorage.removeItem('psycalcu_settings');
            localStorage.removeItem('psycalcu_should_migrate');
            showToast('Yerel seanslarınız mevcut bulut hesabınızla başarıyla birleştirildi!', 'success');
          } else {
            showToast('Bulut verileriniz başarıyla senkronize edildi.', 'success');
          }
        } else {
          // BRAND NEW USER (First time registered user, no cloud data yet)
          let sessionsToSave: Session[] = [];
          let settingsToSave = settings;
          
          if (shouldMigrate) {
            // Sync existing local data to their new cloud database if they checked migrate
            const savedSessionsStr = localStorage.getItem('psycalcu_sessions');
            const savedSettingsStr = localStorage.getItem('psycalcu_settings');
            
            if (savedSessionsStr) {
              try { sessionsToSave = JSON.parse(savedSessionsStr); } catch (e) {}
            }
            if (savedSettingsStr) {
              try { settingsToSave = JSON.parse(savedSettingsStr); } catch (e) {}
            }
          }
          
          const correctedSessions = autoCorrectPastSessions(sessionsToSave);
          
          let hasRealLocalSessions = false;
          if (correctedSessions && correctedSessions.length > 0) {
            hasRealLocalSessions = !correctedSessions.every(s => s.id && s.id.startsWith('mock_'));
          }
          
          if (hasRealLocalSessions && shouldMigrate) {
            await saveUserData(user.uid, settingsToSave, correctedSessions);
            setSessions(correctedSessions);
            setSettings(settingsToSave);
            lastSavedRef.current = {
              settings: JSON.stringify(settingsToSave),
              sessions: JSON.stringify(correctedSessions)
            };
            showToast('Mevcut seanslarınız ve ayarlarınız yeni bulut hesabınıza başarıyla aktarıldı!', 'success');
          } else {
            await saveUserData(user.uid, settingsToSave, []);
            setSessions([]);
            setSettings(settingsToSave);
            lastSavedRef.current = {
              settings: JSON.stringify(settingsToSave),
              sessions: '[]'
            };
            showToast('Yeni bulut profiliniz oluşturuldu.', 'info');
          }
          
          // Wipe anonymous local storage
          localStorage.removeItem('psycalcu_sessions');
          localStorage.removeItem('psycalcu_settings');
          localStorage.removeItem('psycalcu_should_migrate');
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
 
        // Use user-specific or generic local storage keys dynamically based on auth status
        const localSessionsKey = user ? `psycalcu_sessions_${user.uid}` : 'psycalcu_sessions';
        const localSettingsKey = user ? `psycalcu_settings_${user.uid}` : 'psycalcu_settings';

        // Initialize lastSavedRef on failure to prevent infinite failing save retries
        const finalSavedSessions = localStorage.getItem(localSessionsKey) || '[]';
        let correctedSavedStr = '[]';
        try {
          correctedSavedStr = JSON.stringify(autoCorrectPastSessions(JSON.parse(finalSavedSessions)));
        } catch (e) {}
        const finalSavedSettings = localStorage.getItem(localSettingsKey) || '';
        lastSavedRef.current = {
          settings: finalSavedSettings,
          sessions: correctedSavedStr
        };
 
        // Graceful fallback to local storage on offline/network errors
        const savedSessions = localStorage.getItem(localSessionsKey);
        const savedSettings = localStorage.getItem(localSettingsKey);
        if (savedSessions) {
          try { setSessions(autoCorrectPastSessions(JSON.parse(savedSessions))); } catch (e) {}
        } else if (user) {
          setSessions([]);
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
        setIsInitialSyncDone(true);
      }
    };

    performSync();
  }, [user, registrationStatus]);

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
    const localSessionsKey = user ? `psycalcu_sessions_${user.uid}` : 'psycalcu_sessions';
    const localSettingsKey = user ? `psycalcu_settings_${user.uid}` : 'psycalcu_settings';

    localStorage.setItem(localSettingsKey, JSON.stringify(settings));
    localStorage.setItem(localSessionsKey, JSON.stringify(sessions));

    if (!user || !isInitialSyncDone || isAuthSyncing || isQuotaExceeded) {
      return;
    }

    const currentSettingsStr = JSON.stringify(settings);
    const currentSessionsStr = JSON.stringify(sessions);

    // Skip saving to cloud if data hasn't changed since last cloud synchronization or save
    if (currentSettingsStr === lastSavedRef.current.settings &&
        currentSessionsStr === lastSavedRef.current.sessions) {
      return;
    }

    // Increment active saves count
    activeSavesCountRef.current++;
    setIsCloudSaving(true);

    // Debounce cloud save by 500ms for high responsiveness
    const timer = setTimeout(() => {
      saveUserData(user.uid, settings, sessions).then(() => {
        activeSavesCountRef.current = Math.max(0, activeSavesCountRef.current - 1);
        if (activeSavesCountRef.current === 0) {
          setIsCloudSaving(false);
        }
        lastSavedRef.current = {
          settings: currentSettingsStr,
          sessions: currentSessionsStr
        };
      }).catch((err: any) => {
        activeSavesCountRef.current = Math.max(0, activeSavesCountRef.current - 1);
        if (activeSavesCountRef.current === 0) {
          setIsCloudSaving(false);
        }
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

    return () => {
      clearTimeout(timer);
      activeSavesCountRef.current = Math.max(0, activeSavesCountRef.current - 1);
      if (activeSavesCountRef.current === 0) {
        setIsCloudSaving(false);
      }
    };
  }, [settings, sessions, user, isInitialSyncDone, isAuthSyncing, isQuotaExceeded]);

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

  const handleLogout = async () => {
    hasSyncedRef.current = null;
    lastSavedRef.current = { settings: '', sessions: '' };
    hasAutoSyncedRef.current = false;

    try {
      await signOut(auth);
    } catch (e) {
      console.error("Firebase Signout Error:", e);
    }

    // Clear local storage sensitive data to prevent cross-user contamination on shared computers
    localStorage.removeItem('psycalcu_sessions');
    localStorage.removeItem('psycalcu_settings');
    localStorage.removeItem('psycalcu_ai_summaries');
    localStorage.removeItem('psycalcu_local_notifications');
    localStorage.removeItem('psycalcu_should_migrate');

    // Reset app states
    setSessions([]);
    setSettings(DEFAULT_SETTINGS);
    setUser(null);
    setMaxSessionsLimit('unlimited');
    setFeaturesAIAllowed(true);
    setFeaturesExportAllowed(true);
    setFeaturesCalendarAllowed(true);
    setFeaturesAccountingAllowed(true);
    setFeaturesDebtTrackerAllowed(true);
  };

  // UI state
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(() => new Date());

  // Keep calendar view month in sync with selectedDate
  useEffect(() => {
    if (selectedDate) {
      setCalendarViewDate(new Date(selectedDate));
    }
  }, [selectedDate]);

  // Click outside handler for calendar popover
  const calendarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const calendarGrid = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();

    // First day of the month
    const firstDayOfMonth = new Date(year, month, 1);
    
    // Day of the week of first day (Monday = 0, ..., Sunday = 6)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    // Total days in current month
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    // Total days in previous month
    const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];

    // Previous month's trailing days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = totalDaysInPrevMonth - i;
      const prevMonthDate = new Date(year, month - 1, dayNum);
      const dateStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(prevMonthDate.getDate()).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
      });
    }

    // Current month's days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNum: i,
        isCurrentMonth: true,
      });
    }

    // Next month's leading days to make a perfect 42-cell grid
    const remainingCells = 42 - cells.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonthDate = new Date(year, month + 1, i);
      const dateStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(nextMonthDate.getDate()).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNum: i,
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [calendarViewDate]);

  const [activeTab, setActiveTab] = useState<'agenda' | 'stats' | 'sync' | 'backup' | 'debts' | 'settings' | 'admin' | 'search'>('agenda');
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const [debtSearchQuery, setDebtSearchQuery] = useState('');
  
  // Advanced Search Tab States
  const [searchTabQuery, setSearchTabQuery] = useState('');
  const [searchStartDate, setSearchStartDate] = useState('');
  const [searchEndDate, setSearchEndDate] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'online' | 'face-to-face' | 'cancelled' | 'non-session'>('all');
  const [searchPaymentStatus, setSearchPaymentStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
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
        const key = user ? `psycalcu_show_notes_${user.uid}` : 'psycalcu_show_notes';
        localStorage.setItem(key, String(next));
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
        const key = user ? `psycalcu_show_explanations_${user.uid}` : 'psycalcu_show_explanations';
        localStorage.setItem(key, String(next));
      } catch (e) {}
      return next;
    });
  };

  const [showAiDetails, setShowAiDetails] = useState<boolean>(false);
  const [isFaqOpen, setIsFaqOpen] = useState<boolean>(false);
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);
  const [syncDetailsToShow, setSyncDetailsToShow] = useState<{
    added: { id: string; clientName: string; date: string; time: string; type: 'online' | 'face-to-face' | 'cancelled' }[];
    updated: { id: string; clientName: string; date: string; time: string; type: 'online' | 'face-to-face' | 'cancelled' }[];
  } | null>(null);
  const [isSyncDetailsModalOpen, setIsSyncDetailsModalOpen] = useState<boolean>(false);
  const [debtConfirmState, setDebtConfirmState] = useState<{
    isOpen: boolean;
    clientName: string;
    totalAmount: number;
  }>({
    isOpen: false,
    clientName: '',
    totalAmount: 0,
  });

  // Gelişmiş Arama Filtreleme ve Hesaplama Memos
  const searchedAndFilteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // 1. Text filter
      if (searchTabQuery.trim()) {
        const query = toTurkishUpper(searchTabQuery.trim());
        const matchName = toTurkishUpper(session.clientName).includes(query);
        const matchNotes = session.notes ? toTurkishUpper(session.notes).includes(query) : false;
        const matchTime = session.time.includes(query);
        const matchPrice = String(session.price).includes(query);
        if (!matchName && !matchNotes && !matchTime && !matchPrice) {
          return false;
        }
      }

      // 2. Start date filter
      if (searchStartDate) {
        if (session.date < searchStartDate) return false;
      }

      // 3. End date filter
      if (searchEndDate) {
        if (session.date > searchEndDate) return false;
      }

      // 4. Session type filter
      if (searchType !== 'all') {
        if (searchType === 'online' && session.type !== 'online') return false;
        if (searchType === 'face-to-face' && session.type !== 'face-to-face') return false;
        if (searchType === 'cancelled' && session.type !== 'cancelled') return false;
        if (searchType === 'non-session' && session.type !== 'non-session') return false;
      }

      // 5. Payment status filter
      if (searchPaymentStatus !== 'all') {
        const isPaid = session.paymentStatus === 'paid';
        if (searchPaymentStatus === 'paid' && !isPaid) return false;
        if (searchPaymentStatus === 'unpaid' && isPaid) return false;
      }

      return true;
    });
  }, [sessions, searchTabQuery, searchStartDate, searchEndDate, searchType, searchPaymentStatus]);

  const searchTabCalculations = useMemo(() => {
    let totalSessions = searchedAndFilteredSessions.length;
    let onlineCount = searchedAndFilteredSessions.filter(s => s.type === 'online').length;
    let faceToFaceCount = searchedAndFilteredSessions.filter(s => s.type === 'face-to-face').length;
    let cancelledCount = searchedAndFilteredSessions.filter(s => s.type === 'cancelled').length;
    let nonSessionCount = searchedAndFilteredSessions.filter(s => s.type === 'non-session').length;

    let brütGelir = 0;
    let bakiciGideri = 0;
    let ofisGideri = 0;
    let odenenMiktar = 0;
    let odenmeyenMiktar = 0;

    searchedAndFilteredSessions.forEach(s => {
      if (s.type !== 'cancelled' && s.type !== 'non-session') {
        brütGelir += s.price;
        bakiciGideri += s.babysitterFeeAmount || 0;
        ofisGideri += s.officeRentFeeAmount || 0;
        if (s.paymentStatus === 'paid') {
          odenenMiktar += s.price;
        } else {
          odenmeyenMiktar += s.price;
        }
      }
    });

    let toplamGider = bakiciGideri + ofisGideri;
    let netGelir = brütGelir - toplamGider;

    return {
      totalSessions,
      onlineCount,
      faceToFaceCount,
      cancelledCount,
      brütGelir,
      bakiciGideri,
      ofisGideri,
      toplamGider,
      netGelir,
      odenenMiktar,
      odenmeyenMiktar
    };
  }, [searchedAndFilteredSessions]);

  // Auto trigger tour for first-time logged-in users
  useEffect(() => {
    if (user) {
      const isCompleted = localStorage.getItem(`psycalcu_tour_completed_${user.uid}`);
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

  // Search results for header search box
  const searchedSessions = useMemo(() => {
    if (!headerSearchQuery.trim()) return [];
    const q = headerSearchQuery.trim().toLowerCase();
    return sessions.filter(s => {
      const clientMatch = s.clientName.toLowerCase().includes(q);
      const notesMatch = s.notes ? s.notes.toLowerCase().includes(q) : false;
      const typeMatch = s.type.toLowerCase().includes(q);
      
      const [year, month, day] = s.date.split('-');
      const formattedDateStr = `${day}.${month}.${year}`;
      const dateMatch = s.date.includes(q) || formattedDateStr.includes(q);
      return clientMatch || notesMatch || typeMatch || dateMatch;
    }).sort((a, b) => {
      return b.date.localeCompare(a.date) || b.time.localeCompare(a.time);
    });
  }, [sessions, headerSearchQuery]);

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

    // Filter non-cancelled, non-session, unpaid, and realized (past or present) sessions
    const unpaidSessions = sessions.filter(s => {
      if (s.type === 'cancelled' || s.type === 'non-session' || s.paymentStatus === 'paid') return false;
      const sessionDateTime = `${s.date}T${padTime(s.time)}`;
      return sessionDateTime <= nowStr;
    });
    
    // Total unpaid amount
    const totalUnpaidAmount = unpaidSessions.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    
    // Group by client using normalized name
    const clientGroups: Record<string, Session[]> = {};
    unpaidSessions.forEach(s => {
      const normName = getNormalizedClientName(s.clientName);
      if (!clientGroups[normName]) {
        clientGroups[normName] = [];
      }
      clientGroups[normName].push(s);
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
        } else if (s.type === 'non-session') {
          // Skip non-session from accounting metrics
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
      if (s.type !== 'cancelled' && s.type !== 'non-session') {
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
    
    // Check validation limits
    const validation = validateSessionAction(
      sessions.length,
      existing ? 0 : 1,
      !!existing,
      true, // manual addition/edit
      user?.uid
    );

    if (!validation.allowed) {
      showToast(validation.message, 'error', { title: 'Ekleme Sınırı Aşıldı' });
      return;
    }

    if (!existing && maxSessionsLimit !== 'unlimited') {
      const limitNum = typeof maxSessionsLimit === 'string' ? parseInt(maxSessionsLimit, 10) : maxSessionsLimit;
      if (!isNaN(limitNum) && sessions.length >= limitNum) {
        showToast(`Yöneticiniz tarafından belirlenen maksimum seans limitine (${limitNum}) ulaştınız. Daha fazla seans eklemek için lütfen muhammedakifkayacan@gmail.com ile iletişime geçin.`, 'error');
        return;
      }
    }

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
        // Increment weekly manual limit count only when adding a new session
        incrementWeeklyManualActionCount(1, user?.uid);
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
      },
      true
    );
  };

  const handleClearAllSessions = () => {
    setSessions([]);
    localStorage.setItem('psycalcu_sessions', JSON.stringify([]));
  };

  const handleToggleType = (id: string, currentType: SessionType) => {
    const session = sessions.find(s => s.id === id);
    if (session && isOlderThan7Days(session.date)) {
      showToast('7 günden eski seansların tipi değiştirilemez! Muhasebesi kilitlenmiştir.', 'error');
      return;
    }
    if (currentType === 'non-session') {
      showToast('Seans dışı notlar hızlı değiştirilemez. Düzenleme panelinden güncelleyin.', 'error');
      return;
    }
    const nextTypeMap: Record<string, SessionType> = {
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
    const found = sessions.find(s => s.id === id);
    if (!found) return;

    const nextStatus = found.paymentStatus === 'paid' ? 'unpaid' : 'paid';

    setSessions(prev => prev.map(s => {
      if (s.id === id) {
        return {
          ...s,
          paymentStatus: nextStatus,
          updatedAt: Date.now(),
          isManuallyEdited: true
        };
      }
      return s;
    }));

    const priceVal = Number(found.price) || 0;
    if (nextStatus === 'paid') {
      showToast(
        `${found.clientName} adlı danışandan ₺${priceVal.toLocaleString('tr-TR')} tahsil edildi!`, 
        'success',
        {
          title: 'Ödeme Alındı',
          message: `${found.clientName} danışanının ${found.date} tarihli seans ödemesi (₺${priceVal.toLocaleString('tr-TR')}) başarıyla tahsil edildi.`
        }
      );
    } else {
      showToast(
        `${found.clientName} ödemesi iptal edildi.`, 
        'info',
        {
          title: 'Ödeme İptal Edildi',
          message: `${found.clientName} danışanının ${found.date} tarihli seans ödemesi (₺${priceVal.toLocaleString('tr-TR')}) ödenmedi olarak işaretlendi.`,
          type: 'info'
        }
      );
    }
  };

  const handleMarkSessionAsPaid = (id: string) => {
    const found = sessions.find(s => s.id === id);
    if (!found) return;

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

    const priceVal = Number(found.price) || 0;
    showToast(
      `${found.clientName} ödemesi başarıyla tahsil edildi!`, 
      'success',
      {
        title: 'Ödeme Alındı',
        message: `${found.clientName} danışanının ${found.date} tarihli seans ücreti (₺${priceVal.toLocaleString('tr-TR')}) başarıyla tahsil edildi.`
      }
    );
  };

  const handleMarkAllClientSessionsAsPaid = (clientName: string) => {
    let totalAmount = 0;
    let sessionCount = 0;

    setSessions(prev => {
      prev.forEach(s => {
        if (s.clientName === clientName && s.type !== 'cancelled' && s.paymentStatus !== 'paid') {
          totalAmount += Number(s.price) || 0;
          sessionCount++;
        }
      });
      return prev.map(s => {
        if (s.clientName === clientName && s.type !== 'cancelled' && s.paymentStatus !== 'paid') {
          return {
            ...s,
            paymentStatus: 'paid',
            updatedAt: Date.now(),
            isManuallyEdited: true
          };
        }
        return s;
      });
    });

    showToast(
      `${clientName} adlı danışanın tüm borçları ödendi!`, 
      'success',
      {
        title: 'Toplu Tahsilat',
        message: `${clientName} adlı danışanın ${sessionCount} seanslık borcu (Toplam: ₺${totalAmount.toLocaleString('tr-TR')}) başarıyla ödendi olarak işaretlendi.`
      }
    );
  };

  const handleGenerateSummary = async () => {
    if (featuresAIAllowed === false) {
      showToast('Yapay zeka asistanı erişim yetkiniz bulunmamaktadır. Lütfen muhammedakifkayacan@gmail.com ile iletişime geçin.', 'error');
      return;
    }
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

      const responseText = await response.text();
      let responseData: any = {};
      
      if (responseText) {
        try {
          responseData = JSON.parse(responseText);
        } catch (parseErr) {
          console.error("JSON parse error:", responseText, parseErr);
          throw new Error("Sunucudan geçersiz bir yanıt alındı. Lütfen daha sonra tekrar deneyin.");
        }
      } else {
        throw new Error("Sunucudan boş bir yanıt alındı. Lütfen internet bağlantınızı veya API anahtarınızı kontrol edin.");
      }

      if (!response.ok) {
        throw new Error(responseData.error || "Yapay zeka özeti alınamadı.");
      }

      const summaryText = responseData.text;
      if (!summaryText) {
        throw new Error("Yapay zeka boş bir analiz yanıtı döndürdü.");
      }

      setAiSummaries(prev => {
        const updated = { ...prev, [selectedDate]: summaryText };
        const key = user ? `psycalcu_ai_summaries_${user.uid}` : 'psycalcu_ai_summaries';
        localStorage.setItem(key, JSON.stringify(updated));
        return updated;
      });

      showToast('Günün değerlendirmesi başarıyla oluşturuldu!', 'success');
    } catch (err: any) {
      console.warn("Server call failed, generating local smart assessment:", err);
      
      const activeSessions = filteredSessions ? filteredSessions.filter((s: any) => s.type !== 'cancelled' && s.type !== 'non-session') : [];
      const cancelledSessions = filteredSessions ? filteredSessions.filter((s: any) => s.type === 'cancelled') : [];
      const onlineCount = activeSessions.filter((s: any) => s.type === 'online').length;
      const f2fCount = activeSessions.filter((s: any) => s.type === 'face-to-face').length;
      const unpaidCount = activeSessions.filter((s: any) => s.paymentStatus !== 'paid').length;
      const totalUnpaid = activeSessions.filter((s: any) => s.paymentStatus !== 'paid').reduce((sum: number, s: any) => sum + (Number(s.price) || 0), 0);

      let localSummary = `- **Günün Değerlendirmesi:** `;
      if (activeSessions.length === 0) {
        localSummary += `${selectedDate} tarihinde aktif seansınız bulunmamaktadır. Dinlenmek ve klinik hazırlık yapmak için harika bir gün.`;
      } else {
        localSummary += `Bugün toplam ${activeSessions.length} aktif seans gerçekleştirdiniz (${onlineCount} Online, ${f2fCount} Yüzyüze). `;
        if (cancelledSessions.length > 0) {
          localSummary += `${cancelledSessions.length} adet seans iptali gerçekleşti; iptal politikalarınızı gözden geçirmek seans sadakatini artırabilir. `;
        } else {
          localSummary += `Seans katılım oranı %100; planlamalarınız son derece verimli geçti. `;
        }
        if (activeSessions.length >= 5) {
          localSummary += `Klinik yoğunluğunuz yüksek seviyededir; seans aralarında zihinsel dinlenmeye özen göstermelisiniz.`;
        } else if (activeSessions.length >= 3) {
          localSummary += `Dengeli ve sürdürülebilir bir klinik iş yükü dağılımı sağlandı.`;
        } else {
          localSummary += `Sakin bir gün; danışan takipleri ve idari hazırlıklar için yeterli vakit kaldı.`;
        }
      }
      localSummary += `\n\n`;

      localSummary += `- **Finansal Durum & Tahsilat:** `;
      localSummary += `Günü ₺${(dailySummary.net || 0).toLocaleString('tr-TR')} net kâr ile tamamladınız. `;
      if (unpaidCount > 0) {
        localSummary += `Tamamlanan seanslardan ${unpaidCount} adedinin (₺${totalUnpaid.toLocaleString('tr-TR')}) ödemesi henüz alınmamış. Bu danışanlara gün sonunda nazik bir hatırlatma göndermeniz nakit akışını olumlu etkileyecektir.`;
      } else if (activeSessions.length > 0) {
        localSummary += `Harika! Bugün tamamlanan tüm seansların ödemeleri tahsil edilmiş durumdadır, finansal akışınız kusursuz.`;
      } else {
        localSummary += `Bugün finansal bir hareketlilik bulunmamaktadır.`;
      }
      localSummary += `\n\n`;

      localSummary += `- **Günün Sözü / Öneri:** `;
      const quotes = [
        "\"Bir insanı dinlemek, ona var olma hakkı tanımaktır.\" - Seans sonrası kendinize de şefkat göstermeyi unutmayın.",
        "Zihinsel emeğiniz çok değerli. Bugün dokunduğunuz hayatlar için kendinize teşekkür edin.",
        "Klinik verimlilik sadece seans sayısıyla değil, seansların kalitesi ve kendi enerjinizle ölçülür.",
        "Başarılı bir terapist, kendi sınırlarını çizmeyi ve dinlenmeyi de çok iyi bilendir.",
        "Günün yoğunluğu geride kaldı; şimdi zihninizi boşaltma ve kendinize zaman ayırma vakti.",
        "Her seans yeni bir keşif yolculuğudur; kendinize ve mesleki sezgilerinize güvenin."
      ];
      const dayOffset = selectedDate ? parseInt(selectedDate.split('-').pop() || '0', 10) : 0;
      const index = (activeSessions.length + dayOffset) % quotes.length;
      localSummary += quotes[index];

      localSummary += `\n\n*Not: Bu analiz, çevrimdışı/lokal değerlendirme modülü tarafından anında hazırlanmıştır.*`;

      setAiSummaries(prev => {
        const updated = { ...prev, [selectedDate]: localSummary };
        const key = user ? `psycalcu_ai_summaries_${user.uid}` : 'psycalcu_ai_summaries';
        localStorage.setItem(key, JSON.stringify(updated));
        return updated;
      });

      showToast('Günün değerlendirmesi lokal modül ile başarıyla oluşturuldu!', 'success');
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const handleImportSessions = (
    newSessions: Session[],
    syncedTypesFetched?: 'online' | 'face-to-face' | ('online' | 'face-to-face')[]
  ) => {
    // 60 days cutoff logic (aligns with icsParser.ts)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const cutOffDateStr = sixtyDaysAgo.toISOString().split('T')[0];

    const activeSyncedTypes = Array.isArray(syncedTypesFetched)
      ? syncedTypesFetched
      : syncedTypesFetched
        ? [syncedTypesFetched]
        : undefined;

    const deletedList: any[] = [];
    let deletedCount = 0;

    // Track incoming IDs for easy lookup
    const incomingIds = new Set(newSessions.map(ns => ns.id));

    // Filter out synced sessions that are deleted/missing in the fetched feeds within our window
    const sessionsToKeep: Session[] = [];
    sessions.forEach(s => {
      if (s.isSyncedFromCalendar && 
          activeSyncedTypes && 
          s.syncedCalendarType && 
          activeSyncedTypes.includes(s.syncedCalendarType as any) &&
          s.date >= cutOffDateStr) {
        
        // This session is from a synced calendar that we just updated, and it's within the sync window
        if (!incomingIds.has(s.id)) {
          // It is not in the incoming list, meaning it was deleted or moved from the calendar feed!
          deletedList.push({
            id: s.id,
            clientName: s.clientName,
            date: s.date,
            time: s.time,
            type: s.type
          });
          deletedCount++;
          return; // Filter it out (delete it)
        }
      }
      sessionsToKeep.push(s);
    });

    const sessionsMap = new Map(sessionsToKeep.map(s => [s.id, s]));
    let addedCount = 0;
    let updatedCount = 0;
    const toUpdate: Session[] = [];
    const addedList: any[] = [];
    const updatedList: any[] = [];

    newSessions.forEach(ns => {
      if (sessionsMap.has(ns.id)) {
        const existing = sessionsMap.get(ns.id)!;
        
        // CRITICAL FIX: If the user manually edited this session, do NOT let calendar sync overwrite its details!
        if (existing.isManuallyEdited) {
          return;
        }

        // Determine if the incoming session is cancelled or before membership
        const isCancelledOrBeforeMembership = ns.price === 0 || ns.paymentStatus === 'paid';

        // Merge changed calendar fields, preserving custom user edits on price/payment status
        const updated = {
          ...existing,
          clientName: ns.clientName,
          date: ns.date,
          time: ns.time,
          duration: ns.duration,
          notes: ns.notes || existing.notes,
          price: isCancelledOrBeforeMembership ? 0 : (existing.price !== settings.defaultSessionPrice ? existing.price : ns.price),
          paymentStatus: isCancelledOrBeforeMembership ? 'paid' : (existing.paymentStatus === 'paid' ? 'paid' : ns.paymentStatus),
          hasBabysitterFee: isCancelledOrBeforeMembership ? false : ns.hasBabysitterFee,
          babysitterFeeAmount: isCancelledOrBeforeMembership ? 0 : ns.babysitterFeeAmount,
          hasOfficeRentFee: isCancelledOrBeforeMembership ? false : ns.hasOfficeRentFee,
          officeRentFeeAmount: isCancelledOrBeforeMembership ? 0 : ns.officeRentFeeAmount,
        };
        
        // Only update if there is a real difference to avoid state mutations & unnecessary cloud writes
        if (JSON.stringify(existing) !== JSON.stringify(updated)) {
          updated.updatedAt = Date.now(); // Mark as updated since the calendar event changed
          toUpdate.push(updated);
          updatedList.push({
            id: updated.id,
            clientName: updated.clientName,
            date: updated.date,
            time: updated.time,
            type: updated.type
          });
          updatedCount++;
        }
      } else {
        let finalPrice = ns.price;
        let finalBabysitterFee = ns.babysitterFeeAmount;
        let finalOfficeRentFee = ns.officeRentFeeAmount;
        if (featuresSmartPriceMatchingAllowed && settings.enableSmartClientPriceMatching && ns.type !== 'cancelled') {
          const matchedCosts = getSmartClientCosts(
            ns.clientName,
            ns.date,
            sessions,
            settings.defaultSessionPrice,
            settings.defaultBabysitterFee,
            settings.defaultOfficeRentFee
          );
          finalPrice = matchedCosts.price;
          if (ns.hasBabysitterFee) {
            finalBabysitterFee = matchedCosts.babysitterFeeAmount;
          }
          if (ns.hasOfficeRentFee) {
            finalOfficeRentFee = matchedCosts.officeRentFeeAmount;
          }
        }
        const nsWithTimestamp = { 
          ...ns, 
          price: finalPrice, 
          babysitterFeeAmount: finalBabysitterFee,
          officeRentFeeAmount: finalOfficeRentFee,
          updatedAt: Date.now() 
        };
        toUpdate.push(nsWithTimestamp);
        addedList.push({
          id: nsWithTimestamp.id,
          clientName: nsWithTimestamp.clientName,
          date: nsWithTimestamp.date,
          time: nsWithTimestamp.time,
          type: nsWithTimestamp.type
        });
        addedCount++;
      }
    });

    if (toUpdate.length > 0 || deletedCount > 0) {
      setSessions(prev => {
        // Filter out deleted sessions from state
        const keepIds = new Set(sessionsToKeep.map(s => s.id));
        const filteredPrev = prev.filter(s => keepIds.has(s.id));

        const prevMap = new Map(filteredPrev.map(s => [s.id, s]));
        toUpdate.forEach(u => prevMap.set(u.id, u));
        return Array.from(prevMap.values());
      });
    }

    return { 
      addedCount, 
      updatedCount, 
      deletedCount,
      totalParsed: newSessions.length, 
      addedList, 
      updatedList, 
      deletedList 
    };
  };

  const handleManualCalendarSync = async (showNotificationOnNoChanges = true) => {
    if (featuresCalendarAllowed === false) {
      if (showNotificationOnNoChanges) {
        showToast('Takvim entegrasyonu yönetici tarafından devre dışı bırakılmış!', 'error');
      }
      return;
    }
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
          const parsed = parseICS(icsText, settings.defaultSessionPrice, settings.defaultBabysitterFee, settings.defaultOfficeRentFee, 'online', registrationCreatedAt);
          const isValidIcs = icsText.toUpperCase().includes('BEGIN:VCALENDAR') || icsText.toUpperCase().includes('BEGIN:VEVENT');
          if (isValidIcs) {
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
          const parsed = parseICS(icsText, settings.defaultSessionPrice, settings.defaultBabysitterFee, settings.defaultOfficeRentFee, 'face-to-face', registrationCreatedAt);
          const isValidIcs = icsText.toUpperCase().includes('BEGIN:VCALENDAR') || icsText.toUpperCase().includes('BEGIN:VEVENT');
          if (isValidIcs) {
            totalNewSessions = [...totalNewSessions, ...parsed];
            hasFetchedFaceToFace = true;
          }
        }
      } catch (err) {
        console.error("Face-to-face calendar sync failed:", err);
      }
    }

    setIsManualSyncing(false);

    const syncedTypesFetched: ('online' | 'face-to-face')[] = [];
    if (hasFetchedOnline) syncedTypesFetched.push('online');
    if (hasFetchedFaceToFace) syncedTypesFetched.push('face-to-face');

    if (syncedTypesFetched.length > 0) {
      const stats = handleImportSessions(totalNewSessions, syncedTypesFetched);
      if (stats.addedCount > 0 || stats.updatedCount > 0 || stats.deletedCount > 0) {
        let msg = 'Takvim senkronizasyonu tamamlandı: ';
        const parts: string[] = [];
        if (stats.addedCount > 0) parts.push(`${stats.addedCount} yeni seans eklendi`);
        if (stats.updatedCount > 0) parts.push(`${stats.updatedCount} seans güncellendi`);
        if (stats.deletedCount > 0) parts.push(`${stats.deletedCount} silinen/taşınan seans temizlendi`);
        msg += parts.join(', ') + '.';

        showToast(
          msg, 
          'success',
          {
            title: 'Takvim Senkronizasyonu',
            type: 'system',
            syncDetails: {
              added: stats.addedList,
              updated: stats.updatedList,
              deleted: stats.deletedList
            }
          }
        );
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
    if (featuresExportAllowed === false) {
      showToast('Excel / E-Tablo dışa aktarım yetkiniz bulunmamaktadır. Lütfen muhammedakifkayacan@gmail.com ile iletişime geçin.', 'error');
      return;
    }
    let csvContent = "\uFEFF"; // BOM for Excel/Sheets compatibility
    csvContent += "Tarih,Saat,Danışan Adı,Seans Tipi,Süre (Dakika),Seans Ücreti (₺),Bakıcı Gideri (₺),Ofis Kira Gideri (₺),Net Kazanç (₺),Notlar,Entegrasyon Durumu\n";
    
    sessions.forEach(s => {
      const gross = (s.type === 'cancelled' || s.type === 'non-session') ? 0 : Number(s.price);
      const baby = s.type === 'non-session' ? 0 : (s.hasBabysitterFee ? Number(s.babysitterFeeAmount) : 0);
      const office = s.type === 'non-session' ? 0 : (s.hasOfficeRentFee ? Number(s.officeRentFeeAmount) : 0);
      const net = Math.max(0, gross - (baby + office));
      const typeLabel = s.type === 'online' ? 'Online' : s.type === 'face-to-face' ? 'Yüz yüze' : s.type === 'cancelled' ? 'İptal' : 'Seans Dışı';
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
    if (featuresExportAllowed === false) {
      showToast('Excel / E-Tablo dışa aktarım yetkiniz bulunmamaktadır. Lütfen muhammedakifkayacan@gmail.com ile iletişime geçin.', 'error');
      return;
    }
    let tsvContent = "Tarih\tSaat\tDanışan Adı\tSeans Tipi\tSüre (Dakika)\tSeans Ücreti (₺)\tBakıcı Gideri (₺)\tOfis Kira Gideri (₺)\tNet Kazanç (₺)\tNotlar\tEntegrasyon Durumu\n";
    
    sessions.forEach(s => {
      const gross = (s.type === 'cancelled' || s.type === 'non-session') ? 0 : Number(s.price);
      const baby = s.type === 'non-session' ? 0 : (s.hasBabysitterFee ? Number(s.babysitterFeeAmount) : 0);
      const office = s.type === 'non-session' ? 0 : (s.hasOfficeRentFee ? Number(s.officeRentFeeAmount) : 0);
      const net = Math.max(0, gross - (baby + office));
      const typeLabel = s.type === 'online' ? 'Online' : s.type === 'face-to-face' ? 'Yüz yüze' : s.type === 'cancelled' ? 'İptal' : 'Seans Dışı';
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
          },
          true
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
      <div className="min-h-screen bg-[#fdfbf7] flex flex-col lg:flex-row relative" id="auth-portal-screen">
        {/* Floating Help / FAQ Button */}
        <button
          onClick={() => setIsFaqOpen(true)}
          className="absolute top-6 right-6 lg:right-8 flex items-center gap-2 px-4 py-2 bg-white/95 backdrop-blur-xs hover:bg-[#f5f5f0] text-xs font-semibold text-[#6b705c] rounded-full border border-[#e5e1d8] transition-all cursor-pointer shadow-xs z-30"
          title="Yardım Merkezi & Sıkça Sorulan Sorular"
        >
          <HelpCircle className="w-4 h-4 text-[#cb997e]" />
          <span>Yardım & SSS</span>
        </button>

        {/* Left Side: Hero Promotion (Olive Editorial Layout) */}
        <div className="hidden lg:flex lg:w-[55%] bg-[#6b705c] text-white p-16 flex-col justify-between relative overflow-hidden">
          {/* Subtle background graphics */}
          <div className="absolute -right-24 -bottom-24 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none"></div>
          <div className="absolute -left-12 top-1/3 w-72 h-72 rounded-full bg-[#cb997e]/10 blur-3xl pointer-events-none"></div>

          {/* Top Branding Header */}
          <div className="flex items-center gap-3 z-10">
            <div className="w-11 h-11 bg-white text-[#6b705c] rounded-2xl flex items-center justify-center font-serif text-2xl italic font-bold shadow-md">
              P
            </div>
            <div>
              <h2 className="text-xl font-serif italic text-white tracking-tight leading-none">PsyCalcu</h2>
              <p className="text-[9px] text-[#ffe8d6] font-bold tracking-widest mt-1">PSİKOLOG SEANS & BÜTÇE AJANDASI</p>
            </div>
          </div>

          {/* Main Hero Promotion Copy */}
          <div className="space-y-12 my-auto max-w-xl z-10">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-[#ffe8d6] border border-white/10">
                <Sparkles className="w-3.5 h-3.5 text-[#cb997e]" />
                Klinik Süreçlerinizde Yeni Nesil Asistan
              </span>
              <h3 className="text-4xl md:text-5xl font-serif italic font-normal leading-[1.15] text-white tracking-tight">
                Zamanınızı planlayın, <br />
                <span className="text-[#ffe8d6] font-medium">bütçenizi kolayca yönetin.</span>
              </h3>
              <p className="text-sm text-white/80 font-normal leading-relaxed">
                PsyCalcu, psikologlar ve terapistler için özel olarak tasarlanmış modern bir asistan uygulamasıdır. Danışan seanslarınızı, gelir-gider dengenizi ve takvim entegrasyonlarınızı tek bir şık panelden yönetin.
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-2 gap-6 pt-4">
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-[#ffe8d6]">
                  <CalendarIcon className="w-4.5 h-4.5" />
                </div>
                <h4 className="text-sm font-semibold text-white font-serif italic">Çift Yönlü Takvim Entegrasyonu</h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  Google Calendar ve popüler takvimleri otomatik eşitleyin, seans kaçırma derdine son verin.
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-[#ffe8d6]">
                  <TrendingUp className="w-4.5 h-4.5" />
                </div>
                <h4 className="text-sm font-semibold text-white font-serif italic">Otomatik Muhasebe & Döküm</h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  Kira, kolaylaştırıcı katsayısı ve seans gelirlerini hesaplayıp net kârınızı anında izleyin.
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-[#ffe8d6]">
                  <ShieldCheck className="w-4.5 h-4.5" />
                </div>
                <h4 className="text-sm font-semibold text-white font-serif italic">Güvenli Bulut Altyapısı</h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  Tarayıcı geçmişini temizleseniz dahi seanslarınız güvenli şifrelemeyle bulutta korunur.
                </p>
              </div>

              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-[#ffe8d6]">
                  <Wallet className="w-4.5 h-4.5" />
                </div>
                <h4 className="text-sm font-semibold text-white font-serif italic">Borç & Tahsilat Yönetimi</h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  Geciken ödemeleri, danışan bakiyelerini ve klinik borçlarınızı kolayca faturalandırın.
                </p>
              </div>
            </div>
          </div>

          {/* Micro Testimonial or Tagline Footer */}
          <div className="border-t border-white/10 pt-6 flex items-center justify-between text-xs text-white/60 z-10">
            <span>© 2026 PsyCalcu</span>
            <span className="flex items-center gap-1">
              Terapistler için sevgiyle tasarlandı 🌸
            </span>
          </div>
        </div>

        {/* Right Side: Auth Form Centering */}
        <div className="w-full lg:w-[45%] flex items-center justify-center p-8 bg-[#fdfbf7] relative">
          {/* Background decoration for mobile */}
          <div className="absolute -left-20 -top-20 w-48 h-48 rounded-full bg-[#cb997e]/5 blur-2xl lg:hidden"></div>
          <div className="absolute -right-20 -bottom-20 w-48 h-48 rounded-full bg-[#6b705c]/5 blur-2xl lg:hidden"></div>

          <div className="w-full max-w-md space-y-8 z-10 py-12 lg:py-0">
            {/* Show Brand Header on Mobile only */}
            <div className="lg:hidden text-center space-y-3">
              <div className="w-12 h-12 bg-[#6b705c] rounded-2xl flex items-center justify-center text-white font-serif text-2xl italic mx-auto shadow-md">
                P
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-serif italic text-[#6b705c]">PsyCalcu</h2>
                <p className="text-[10px] text-slate-400 font-bold tracking-widest">PSİKOLOG SEANS & BÜTÇE AJANDASI</p>
              </div>
            </div>

            <AuthCard
              user={null}
              onLogout={handleLogout}
              onAuthSuccess={handleAuthSuccess}
              existingSessionsCount={sessions.length}
              showToast={showToast}
              onOpenFaq={() => setIsFaqOpen(true)}
            />

            {/* Compact feature representation for mobile */}
            <div className="lg:hidden bg-white p-5 rounded-3xl border border-[#e5e1d8] space-y-4">
              <h4 className="text-[10px] font-bold tracking-widest text-[#a5a58d] uppercase">PsyCalcu Ne Sunar?</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center text-[#6b705c] shrink-0 border border-[#e5e1d8]/40">
                    <CalendarIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate">Takvim Entegrasyonu</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center text-[#6b705c] shrink-0 border border-[#e5e1d8]/40">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate">Gelir-Gider Takibi</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center text-[#6b705c] shrink-0 border border-[#e5e1d8]/40">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate">Yedekli Bulut Verisi</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center text-[#6b705c] shrink-0 border border-[#e5e1d8]/40">
                    <Wallet className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate">Borç Takibi</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Modal */}
        <FAQModal isOpen={isFaqOpen} onClose={() => setIsFaqOpen(false)} />
      </div>
    );
  }

  if (user && registrationStatus === 'checking') {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center p-6" id="registration-checking-screen">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] border border-[#e5e1d8] shadow-sm p-8 text-center space-y-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-[#6b705c]/5 rounded-full pointer-events-none" />
          
          <div className="w-16 h-16 bg-[#6b705c]/10 rounded-2xl flex items-center justify-center text-[#6b705c] mx-auto border border-[#6b705c]/20">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-serif text-[#6b705c]">Üyelik Doğrulaması</h2>
            <p className="text-xs text-slate-400 font-mono tracking-wider">{user.email}</p>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              PsyCalcu bulut hesabınızın durumu doğrulanıyor. Bu işlem genellikle birkaç saniye sürer.
            </p>

            {registrationError && (
              <div className="p-3.5 bg-red-50 rounded-2xl border border-red-100 text-left space-y-1">
                <span className="text-[11px] font-bold text-red-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Bağlantı Hatası
                </span>
                <p className="text-[10px] text-red-600 leading-relaxed">
                  {registrationError.includes('permission') || registrationError.toLowerCase().includes('permission-denied')
                    ? 'Yönetici onay kayıtlarınızı çekerken bir yetkilendirme hatası oluştu. Lütfen çıkış yapıp tekrar deneyin veya yöneticiyle iletişime geçin.'
                    : `Hata detayı: ${registrationError}`}
                </p>
              </div>
            )}
            
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Herhangi bir sorun yaşarsanız kurucu yöneticiye (<strong className="text-[#6b705c]">muhammedakifkayacan@gmail.com</strong>) e-posta gönderebilirsiniz.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => {
                setRegistrationError(null);
                setRegistrationStatus('checking');
                const regRef = doc(db, 'registrations', user.uid);
                getDoc(regRef).then((docSnap) => {
                  if (docSnap.exists()) {
                    setRegistrationStatus(docSnap.data().status || 'pending');
                  } else {
                    setRegistrationStatus('pending');
                  }
                }).catch(err => {
                  setRegistrationError(err?.message || String(err));
                });
              }}
              className="w-full py-3 bg-[#6b705c] hover:bg-[#585c4c] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tekrar Dene / Yenile
            </button>
            <button
              onClick={handleLogout}
              className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl border border-[#e5e1d8] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🚪</span>
              Çıkış Yap / Farklı Hesapla Giriş Yap
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (user && registrationStatus === 'pending') {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center p-6" id="registration-pending-screen">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] border border-[#e5e1d8] shadow-sm p-8 text-center space-y-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-[#cb997e]/5 rounded-full pointer-events-none" />
          <div className="w-16 h-16 bg-[#cb997e]/10 rounded-2xl flex items-center justify-center text-[#cb997e] mx-auto border border-[#cb997e]/20">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-serif text-[#6b705c]">Yönetici Onayı Bekleniyor</h2>
            <p className="text-xs text-slate-400 font-mono tracking-wider">{user.email}</p>
          </div>
          <div className="space-y-3 text-slate-500 leading-relaxed text-xs">
            <p>
              Hesabınız başarıyla oluşturulmuş ve bulut veritabanımıza işlenmiştir. Ancak PsyCalcu seans ve bütçe ajandasına erişebilmek için kurucu yöneticinin (<strong className="text-[#6b705c]">muhammedakifkayacan@gmail.com</strong>) onayı gerekmektedir.
            </p>
            <p className="bg-[#fdfbf7] p-4 rounded-2xl border border-[#e5e1d8] text-left text-[11px] leading-relaxed">
              🙋‍♂️ <strong className="text-[#6b705c]">Ne Yapabilirsiniz?</strong><br />
              Yöneticiyi şahsen tanıyorsanız onay vermesi için kendisine söyleyebilir, bilgi almak veya onay talebinizi hızlandırmak için <strong className="text-[#6b705c]">muhammedakifkayacan@gmail.com</strong> adresine e-posta gönderebilir veya iletişime geçebilirsiniz.
            </p>
            <p className="text-[11px] text-slate-400 font-medium">
              💡 Yönetici onay verdiğinde bu sayfa <strong className="text-emerald-700 font-bold">otomatik olarak güncellenecek</strong> ve uygulamaya girişiniz sağlanacaktır.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => {
                const regRef = doc(db, 'registrations', user.uid);
                getDoc(regRef).then((docSnap) => {
                  if (docSnap.exists()) {
                    setRegistrationStatus(docSnap.data().status || 'pending');
                    showToast('Üyelik durumunuz güncellendi.', 'success');
                  } else {
                    showToast('Kayıt durumu güncel. Onay bekleniyor...', 'info');
                  }
                }).catch(err => {
                  setRegistrationError(err?.message || String(err));
                });
              }}
              className="w-full py-3 bg-[#6b705c] hover:bg-[#585c4c] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Şimdi Tekrar Kontrol Et
            </button>
            <button
              onClick={handleLogout}
              className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl border border-[#e5e1d8] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🚪</span>
              Çıkış Yap / Farklı Hesapla Giriş Yap
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (user && registrationStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center p-6" id="registration-rejected-screen">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] border border-rose-200 shadow-sm p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 mx-auto border border-rose-100">
            <XCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-serif text-rose-700">Giriş Talebiniz Onaylanmadı</h2>
            <p className="text-xs text-slate-400 font-mono tracking-wider">{user.email}</p>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Bu hesabın PsyCalcu uygulamasını kullanma yetkisi yönetici tarafından sınırlandırılmıştır. Sorularınız için <strong className="text-[#6b705c]">muhammedakifkayacan@gmail.com</strong> ile iletişime geçebilirsiniz.
          </p>
          <div className="pt-2">
            <button
              onClick={handleLogout}
              className="w-full py-3 bg-[#6b705c] hover:bg-[#585c4c] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              Farklı Hesapla Giriş Yap / Çıkış Yap
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#fdfbf7] font-sans text-slate-800 antialiased selection:bg-[#cb997e]/20" id="psycalcu-root">
      
      {/* Header Navigation */}
      <nav className="sticky top-0 z-40 flex flex-col lg:flex-row items-center justify-between px-6 md:px-8 py-4 border-b border-[#e5e1d8] bg-white gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#6b705c] rounded-xl flex items-center justify-center text-white font-serif text-2xl italic shadow-md">P</div>
          <div>
            <h1 className="text-xl font-serif italic text-[#6b705c] tracking-tight leading-none">PsyCalcu</h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider mt-1">PSİKOLOG SEANS & BÜTÇE AJANDASI</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:max-w-xs md:max-w-md lg:max-w-xs z-50">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4 text-[#6b705c]" />
          </div>
          <input
            type="text"
            placeholder="Danışan, seans veya not ara..."
            value={headerSearchQuery}
            onChange={(e) => setHeaderSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && headerSearchQuery.trim()) {
                setSearchTabQuery(headerSearchQuery);
                setActiveTab('search');
                setHeaderSearchQuery('');
              }
            }}
            className="w-full pl-9 pr-8 py-2 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-full focus:outline-none focus:border-[#6b705c] focus:ring-1 focus:ring-[#6b705c]/20 transition-all font-medium placeholder:text-slate-400 shadow-xs"
          />
          {headerSearchQuery && (
            <button
              onClick={() => setHeaderSearchQuery('')}
              className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {headerSearchQuery.trim() && (
            <div className="absolute top-full mt-2 left-0 right-0 max-h-[340px] overflow-y-auto bg-white border border-[#e5e1d8] rounded-2xl shadow-xl z-50 p-2 space-y-1.5 animate-fade-in divide-y divide-slate-100">
              <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Seans Arama Sonuçları ({searchedSessions.length})
              </div>
              {searchedSessions.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-slate-400 font-medium space-y-2">
                  <div>Eşleşen seans bulunamadı.</div>
                  <button
                    onClick={() => {
                      setSearchTabQuery(headerSearchQuery);
                      setActiveTab('search');
                      setHeaderSearchQuery('');
                    }}
                    className="px-3 py-1.5 bg-[#f5f5f0] hover:bg-[#e5e5df] border border-[#e5e1d8] rounded-full text-slate-600 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Search className="w-3 h-3" />
                    Gelişmiş Arama Sayfasına Git
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
                    {searchedSessions.slice(0, 5).map(session => {
                      const [year, month, day] = session.date.split('-');
                      const formattedDate = `${day}.${month}.${year}`;
                      return (
                        <div 
                          key={session.id} 
                          className="p-2 hover:bg-[#fdfbf7] rounded-xl transition-all flex items-center justify-between gap-2 group pt-2"
                        >
                          <div className="space-y-0.5 text-left min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs text-[#555a4a] truncate block max-w-[150px]">
                                {session.clientName}
                              </span>
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide ${
                                session.type === 'online' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100/50' :
                                session.type === 'face-to-face' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' :
                                'bg-rose-50 text-rose-600 border border-rose-100/50'
                              }`}>
                                {session.type === 'online' ? 'Çevrimiçi' : session.type === 'face-to-face' ? 'Yüz Yüze' : 'İptal'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold font-mono">
                              <span>{formattedDate}</span>
                              <span>•</span>
                              <span>{session.time}</span>
                              <span>•</span>
                              <span className="text-[#cb997e]">{session.price} ₺</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setSelectedDate(session.date);
                                setActiveTab('agenda');
                                setHeaderSearchQuery('');
                              }}
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg border border-slate-200 cursor-pointer transition-all"
                              title="Seans gününe git"
                            >
                              Git
                            </button>
                            <button
                              onClick={() => {
                                setSelectedDate(session.date);
                                setEditingSession(session);
                                setIsSessionModalOpen(true);
                                setHeaderSearchQuery('');
                              }}
                              className="px-2 py-1 bg-[#6b705c] hover:bg-[#585c4c] text-white text-[10px] font-bold rounded-lg cursor-pointer transition-all"
                              title="Seansı düzenle"
                            >
                              Düzenle
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pt-2 px-1">
                    <button
                      onClick={() => {
                        setSearchTabQuery(headerSearchQuery);
                        setActiveTab('search');
                        setHeaderSearchQuery('');
                      }}
                      className="w-full py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-xl text-amber-800 text-[10px] font-bold text-center flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Search className="w-3.5 h-3.5 text-amber-600" />
                      <span>Tüm {searchedSessions.length} Sonucu Gelişmiş Arama Sayfasında Gör ✨</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
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
            className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
              activeTab === 'stats' ? 'bg-[#6b705c] text-white shadow-sm' : 'text-[#6b705c] hover:bg-[#e5e5df]'
            }`}
          >
            Muhasebe Raporu {featuresAccountingAllowed === false && <span className="text-[10px]" title="Sınırlandırıldı">🔒</span>}
          </button>
          <button
            id="tab-debts"
            onClick={() => setActiveTab('debts')}
            className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
              activeTab === 'debts' ? 'bg-[#6b705c] text-white shadow-sm' : 'text-[#6b705c] hover:bg-[#e5e5df]'
            }`}
          >
            Borç Takip {featuresDebtTrackerAllowed === false && <span className="text-[10px]" title="Sınırlandırıldı">🔒</span>}
          </button>
          <button
            id="tab-sync"
            onClick={() => setActiveTab('sync')}
            className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
              activeTab === 'sync' ? 'bg-[#6b705c] text-white shadow-sm' : 'text-[#6b705c] hover:bg-[#e5e5df]'
            }`}
          >
            Takvim Entegrasyonu {featuresCalendarAllowed === false && <span className="text-[10px]" title="Sınırlandırıldı">🔒</span>}
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
          {user?.email === 'muhammedakifkayacan@gmail.com' && (
            <button
              id="tab-admin"
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer shrink-0 ${
                activeTab === 'admin' ? 'bg-[#cb997e] text-white shadow-sm' : 'text-slate-600 hover:bg-[#e5e5df]'
              }`}
            >
              Yönetici Paneli
            </button>
          )}
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
          
          <NotificationCenter
            notifications={allNotifications}
            onMarkAllAsRead={handleMarkAllAsRead}
            onClearAll={handleClearAllNotifications}
            showToast={showToast}
            onViewSyncDetails={(details) => {
              setSyncDetailsToShow(details);
              setIsSyncDetailsModalOpen(true);
            }}
          />

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

          {user && (
            <button
              id="header-logout-btn"
              onClick={handleLogout}
              className="w-10 h-10 rounded-full border border-red-200 bg-red-50/50 flex items-center justify-center text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-all cursor-pointer shadow-xs"
              title="Güvenli Çıkış Yap"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
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
                    <p className="text-xs tracking-wider opacity-80 font-semibold">{toTurkishUpper(monthlyMetrics.monthName)} TAHMİNİ NET KÂR</p>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">Aylık Rapor</span>
                  </div>
                  
                  <h2 className="text-4xl font-serif">₺{monthlyMetrics.netIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h2>
                  
                  <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/20 pt-4 text-xs">
                    <div>
                      <p className="text-[10px] tracking-widest opacity-70">AYLIK BRÜT GELİR</p>
                      <p className="text-lg font-semibold mt-0.5">₺{monthlyMetrics.grossIncome.toLocaleString('tr-TR')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] tracking-widest opacity-70">AYLIK TOPLAM GİDER</p>
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
                    <h3 className="text-xs font-bold tracking-widest text-[#a5a58d] mb-4">AYLIK GİDER DETAYLARI</h3>
                    
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
                    <span className="text-xs font-bold text-[#a5a58d] tracking-wider">TARİH SEÇİMİ</span>
                    
                    {/* Custom Calendar Popover */}
                    <div className="relative" ref={calendarRef}>
                      <button 
                        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                        className="flex items-center gap-1.5 px-3 py-1 bg-[#f5f5f0] hover:bg-[#e5e5df] text-xs font-semibold text-[#6b705c] rounded-full border border-[#e5e1d8] transition-all cursor-pointer shadow-sm"
                      >
                        <CalendarIcon className="w-3.5 h-3.5 text-[#6b705c]" />
                        <span>{new Date(selectedDate).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                        <ChevronDown className="w-3 h-3 text-[#6b705c] opacity-70" />
                      </button>

                      <AnimatePresence>
                        {isCalendarOpen && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 top-full mt-2 w-72 bg-white rounded-3xl border border-[#e5e1d8] p-4 shadow-xl z-50 animate-fade-in"
                          >
                            {/* Calendar Header */}
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="text-xs font-bold text-slate-800 font-sans tracking-wide">
                                {calendarViewDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                              </h4>
                              <div className="flex gap-1">
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const prev = new Date(calendarViewDate);
                                    prev.setMonth(prev.getMonth() - 1);
                                    setCalendarViewDate(prev);
                                  }}
                                  className="p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                                >
                                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const next = new Date(calendarViewDate);
                                    next.setMonth(next.getMonth() + 1);
                                    setCalendarViewDate(next);
                                  }}
                                  className="p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                                >
                                  <ChevronRight className="w-4 h-4 text-slate-600" />
                                </button>
                              </div>
                            </div>

                            {/* Weekday Labels */}
                            <div className="grid grid-cols-7 gap-1 text-center mb-1">
                              {['P', 'S', 'Ç', 'P', 'C', 'C', 'P'].map((day, idx) => (
                                <span key={idx} className="text-[10px] font-bold text-[#a5a58d] py-1">
                                  {day}
                                </span>
                              ))}
                            </div>

                            {/* Grid of Days */}
                            <div className="grid grid-cols-7 gap-1">
                              {calendarGrid.map((cell, idx) => {
                                const isSelected = cell.dateStr === selectedDate;
                                const isToday = cell.dateStr === new Date().toISOString().split('T')[0];
                                
                                // Check if there are sessions on this day
                                const daySessions = sessions.filter(s => s.date === cell.dateStr);
                                const hasSessions = daySessions.length > 0;
                                const hasPriceIncrease = daySessions.some(s => 
                                  s.type !== 'cancelled' && (
                                    s.price > settings.defaultSessionPrice || 
                                    (s.hasBabysitterFee && s.babysitterFeeAmount > settings.defaultBabysitterFee) || 
                                    (s.hasOfficeRentFee && s.officeRentFeeAmount > settings.defaultOfficeRentFee)
                                  )
                                );
                                
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      setSelectedDate(cell.dateStr);
                                      setIsCalendarOpen(false);
                                    }}
                                    className={`relative flex flex-col items-center justify-center h-8 w-8 rounded-full transition-all cursor-pointer ${
                                      !cell.isCurrentMonth 
                                        ? 'text-slate-300 hover:bg-slate-50' 
                                        : isSelected
                                          ? 'bg-[#6b705c] text-white font-bold shadow-sm'
                                          : isToday
                                            ? 'border border-[#6b705c] text-[#6b705c] font-semibold hover:bg-slate-50'
                                            : hasPriceIncrease
                                              ? 'text-amber-800 bg-amber-50/50 hover:bg-amber-100/50 border border-amber-300/60 font-semibold'
                                              : 'text-slate-700 hover:bg-slate-100 font-medium'
                                    }`}
                                  >
                                    <span className="text-xs">{cell.dayNum}</span>
                                    
                                    {/* Beautiful Dot Indicator */}
                                    {hasSessions && (
                                      <span 
                                        className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                                          hasPriceIncrease
                                            ? isSelected ? 'bg-amber-300' : 'bg-amber-500 animate-pulse'
                                            : isSelected ? 'bg-white' : 'bg-[#cb997e]'
                                        }`} 
                                      />
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Calendar Footer Actions */}
                            <div className="flex justify-between items-center border-t border-slate-100 mt-3 pt-2.5">
                              <button 
                                type="button"
                                onClick={() => {
                                  const todayStr = new Date().toISOString().split('T')[0];
                                  setSelectedDate(todayStr);
                                  setIsCalendarOpen(false);
                                }}
                                className="text-[10px] font-bold text-[#cb997e] hover:text-[#b8856c] transition-colors cursor-pointer"
                              >
                                Bugün
                              </button>
                              <span className="text-[9px] text-slate-400 font-medium">
                                Seanslar noktalı, zamlı seanslar ışıldar ✨
                              </span>
                              <button 
                                type="button"
                                onClick={() => setIsCalendarOpen(false)}
                                className="text-[10px] font-bold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                              >
                                Kapat
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  
                  {/* Date band selection */}
                  <div className="grid grid-cols-7 gap-2">
                    {dateRibbon.map((day) => {
                      const isSelected = day.dateStr === selectedDate;
                      const isToday = day.dateStr === new Date().toISOString().split('T')[0];
                      const daySessions = sessions.filter(s => s.date === day.dateStr);
                      const hasSessions = daySessions.length > 0;
                      const hasPriceIncrease = daySessions.some(s => 
                        s.type !== 'cancelled' && (
                          s.price > settings.defaultSessionPrice || 
                          (s.hasBabysitterFee && s.babysitterFeeAmount > settings.defaultBabysitterFee) || 
                          (s.hasOfficeRentFee && s.officeRentFeeAmount > settings.defaultOfficeRentFee)
                        )
                      );
                      return (
                        <button
                          key={day.dateStr}
                          onClick={() => setSelectedDate(day.dateStr)}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-2xl transition-all relative cursor-pointer ${
                            isSelected 
                              ? 'bg-[#6b705c] text-white shadow-md' 
                              : hasPriceIncrease
                                ? 'bg-amber-50/30 hover:bg-amber-50/60 border-2 border-amber-300/80 text-slate-700 shadow-xs'
                                : 'bg-[#fdfbf7] hover:bg-[#f5f5f0] border border-[#e5e1d8]/60 text-slate-600'
                          }`}
                        >
                          {hasPriceIncrease && (
                            <div 
                              className="absolute top-1.5 right-1.5" 
                              title="Bu günde zamlı seans veya giderler var"
                            >
                              <Sparkles className={`w-3 h-3 ${isSelected ? 'text-amber-300' : 'text-amber-500 animate-pulse'}`} />
                            </div>
                          )}
                          <span className={`text-[9px] tracking-widest font-bold ${isSelected ? 'text-white/90' : 'text-slate-600'}`}>
                            {toTurkishUpper(day.dayName)}
                          </span>
                          <span className="text-lg font-serif font-bold mt-0.5">
                            {day.dayNum}
                          </span>
                          <div className="flex gap-1 mt-1 justify-center items-center h-1">
                            {isToday && (
                              <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-[#cb997e]'}`}></span>
                            )}
                            {hasSessions && (
                              <span className={`w-1 h-1 rounded-full ${
                                hasPriceIncrease
                                  ? isSelected ? 'bg-amber-300' : 'bg-amber-500 animate-pulse'
                                  : isSelected ? 'bg-white/80' : 'bg-[#6b705c]'
                              }`}></span>
                            )}
                          </div>
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
                                : session.type === 'non-session'
                                ? 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/60'
                                : session.isSyncedFromCalendar
                                ? isFaceToFace 
                                  ? 'bg-amber-50/10 border-dashed border-[#cb997e]/60 hover:border-[#cb997e] hover:shadow-xs' 
                                  : 'bg-indigo-50/10 border-dashed border-indigo-200/60 hover:border-indigo-400 hover:shadow-xs'
                                : isFaceToFace 
                                ? 'bg-amber-50/20 border-solid border-[#ddbea9]/40 hover:border-[#ddbea9]' 
                                : 'bg-white border-solid border-slate-100 hover:border-[#ddbea9]'
                            }`}
                          >
                            {/* Time */}
                            <div className="flex sm:flex-col items-center sm:items-center w-full sm:w-16 shrink-0 justify-between sm:justify-center border-b sm:border-b-0 pb-2 sm:pb-0 border-slate-100">
                              <p className="text-sm font-bold text-slate-700 flex items-center gap-1 sm:block">
                                <Clock className="w-3.5 h-3.5 text-slate-400 inline sm:hidden" />
                                {session.time}
                              </p>
                              <p className="text-[10px] text-slate-600 tracking-wider font-bold mt-0.5">
                                {isCancelled ? 'İPTAL' : session.type === 'non-session' ? 'NOT / GÖREV' : `${session.duration} DK`}
                              </p>
                            </div>

                            {/* Divider strip */}
                            <div className={`hidden sm:block w-[3px] h-10 rounded-full shrink-0 ${
                              isCancelled 
                                ? 'bg-red-300' 
                                : session.type === 'non-session'
                                ? 'bg-slate-400'
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
                                  <span className="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold tracking-wider flex items-center gap-0.5">
                                    <Ban className="w-2.5 h-2.5" /> İPTAL
                                  </span>
                                ) : session.type === 'non-session' ? (
                                  <span className="text-[9px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold tracking-wider flex items-center gap-0.5">
                                    <FileText className="w-2.5 h-2.5" /> SEANS DIŞI NOT
                                  </span>
                                ) : isFaceToFace ? (
                                  <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold tracking-wider flex items-center gap-0.5">
                                    <MapPin className="w-2.5 h-2.5" /> YÜZYÜZE
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold tracking-wider flex items-center gap-0.5">
                                    <Laptop className="w-2.5 h-2.5" /> ONLİNE
                                  </span>
                                )}

                                {/* Apple calendar vs Panel flag */}
                                {session.isSyncedFromCalendar ? (
                                  <span className="text-[9px] bg-indigo-50/80 text-indigo-700 border border-indigo-100/60 px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5 shadow-3xs">
                                    📅 Takvimden
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-slate-50 text-slate-500 border border-slate-200/50 px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5 shadow-3xs">
                                    ✍️ Panelden
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
                            {session.type !== 'non-session' ? (
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
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all border shrink-0 text-center cursor-pointer ${
                                      session.paymentStatus === 'paid'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                        : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                    }`}
                                    title={session.paymentStatus === 'paid' ? 'Ödenmedi olarak işaretle' : 'Ödendi olarak işaretle'}
                                  >
                                    {session.paymentStatus === 'paid' ? '● ÖDENDİ' : '○ ÖDENMEDİ'}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="text-left sm:text-right w-full sm:w-auto flex sm:flex-col justify-center items-center py-1.5 px-3 bg-slate-100 border border-slate-200/50 rounded-xl min-w-[100px]">
                                <span className="text-[10px] font-bold text-slate-500 tracking-wider">SEANS DIŞI</span>
                                <span className="text-[9px] text-slate-400 mt-0.5">Mali Etki Yok</span>
                              </div>
                            )}

                            {/* Quick Actions (Hover visible on desktop, always visible on mobile) */}
                            <div className="flex items-center gap-2 border-l border-[#e5e1d8]/40 pl-3 shrink-0 flex-wrap">
                              {/* Toggle Type */}
                              <button
                                onClick={() => {
                                  if (session.type === 'non-session') {
                                    showToast('Seans dışı notlar hızlı değiştirilemez.', 'error');
                                    return;
                                  }
                                  if (isOlderThan7Days(session.date)) {
                                    showToast('7 günden eski seansların tipi değiştirilemez! (Muhasebe kilitlenmiştir)', 'error');
                                    return;
                                  }
                                  handleToggleType(session.id, session.type);
                                }}
                                className={`p-2.5 md:p-1.5 rounded-xl md:rounded-lg transition-colors cursor-pointer border md:border-transparent ${
                                  isOlderThan7Days(session.date) || session.type === 'non-session'
                                    ? 'text-slate-300 bg-slate-50 border-slate-100 cursor-not-allowed opacity-40 md:bg-transparent md:border-transparent'
                                    : 'text-slate-700 bg-slate-100/95 border-slate-200/50 hover:text-[#6b705c] hover:bg-slate-200/60 md:bg-transparent md:text-slate-500 md:hover:bg-slate-50'
                                }`}
                                title={session.type === 'non-session' ? 'Seans dışı notlar hızlı değiştirilemez' : isOlderThan7Days(session.date) ? '7 günden eski seansların tipi değiştirilemez' : 'Seans Tipini Değiştir'}
                                disabled={isOlderThan7Days(session.date) || session.type === 'non-session'}
                              >
                                <RefreshCw className="w-4 h-4 md:w-3.5 md:h-3.5" />
                              </button>

                              {/* Toggle Babysitter */}
                              <button
                                onClick={() => {
                                  if (session.type === 'non-session') {
                                    showToast('Seans dışı notların bakıcı ücreti bulunmaz.', 'error');
                                    return;
                                  }
                                  if (isOlderThan7Days(session.date)) {
                                    showToast('7 günden eski seansların bakıcı ücreti değiştirilemez! (Muhasebe kilitlenmiştir)', 'error');
                                    return;
                                  }
                                  handleToggleBabysitter(session.id);
                                }}
                                className={`p-2.5 md:p-1.5 rounded-xl md:rounded-lg transition-all cursor-pointer border md:border-transparent ${
                                  isOlderThan7Days(session.date) || session.type === 'non-session'
                                    ? 'text-slate-300 bg-slate-50 border-slate-100 cursor-not-allowed opacity-40 md:bg-transparent md:border-transparent'
                                    : session.hasBabysitterFee 
                                    ? 'text-blue-700 bg-blue-100/80 border-blue-200 hover:bg-blue-100 md:bg-blue-50/50 md:text-blue-500 md:hover:bg-blue-50' 
                                    : 'text-slate-700 bg-slate-100/95 border-slate-200/50 hover:text-blue-600 hover:bg-blue-50 md:bg-transparent md:text-slate-400'
                                }`}
                                title={session.type === 'non-session' ? 'Seans dışı notların bakıcı ücreti bulunmaz' : isOlderThan7Days(session.date) ? '7 günden eski seansların bakıcı ücreti değiştirilemez' : 'Bakıcı Ücretini Aç/Kapat'}
                                disabled={isOlderThan7Days(session.date) || session.type === 'non-session'}
                              >
                                <span className="text-xs font-bold font-serif leading-none">👶</span>
                              </button>

                              {/* Add to Device Calendar (Only for panel-created sessions) */}
                              {!session.isSyncedFromCalendar && (
                                <button
                                  onClick={() => {
                                    downloadSessionAsICS(session);
                                    showToast(`${session.clientName} seansı takvim dosyası indirildi.`, 'success');
                                  }}
                                  className="p-2.5 md:p-1.5 rounded-xl md:rounded-lg bg-indigo-50/80 md:bg-transparent border border-indigo-100 md:border-transparent text-indigo-700 md:text-indigo-500 hover:text-indigo-900 hover:bg-indigo-100 md:hover:bg-indigo-50 transition-all cursor-pointer font-bold"
                                  title="Cihaz Takvimine Ekle"
                                >
                                  <CalendarPlus className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                </button>
                              )}

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
                        <span className="text-[10px] text-slate-400 font-bold tracking-widest">GÜNÜN SEANSLARI</span>
                        <span className="text-lg font-serif italic font-bold text-[#6b705c]">{dailySummary.count} Seans</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-bold tracking-widest">GÜNLÜK NET KÂR</span>
                        <span className="text-lg font-serif italic font-bold text-emerald-700">₺{dailySummary.net.toLocaleString('tr-TR')}</span>
                      </div>
                    </div>
                    <div className="text-center sm:text-right">
                      <span className="text-[10px] text-slate-400 block tracking-widest">CANLI TAKVİM DURUMU</span>
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
                    {featuresAIAllowed === false ? (
                      <span className="text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-100 px-4 py-2 rounded-full flex items-center gap-1.5 shrink-0 select-none">
                        <span>🔒</span> Devre Dışı
                      </span>
                    ) : (
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
                    )}
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

                        {featuresAIAllowed === false ? (
                          <span className="text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-100 px-4 py-2.5 rounded-full flex items-center gap-1.5 shrink-0 select-none">
                            <span>🔒</span> Devre Dışı
                          </span>
                        ) : (
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
                        )}
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
              {featuresAccountingAllowed === false ? (
                <FeatureLockedView 
                  title="Muhasebe Raporu Sınırlandırıldı" 
                  icon={<TrendingUp className="w-8 h-8" />} 
                  description="Finansal muhasebe raporlarınız, seans istatistikleriniz ve aylık gelir-gider grafikleriniz geçici olarak devre dışıdır." 
                />
              ) : (
                <StatsDashboard sessions={sessions} settings={settings} showExplanations={showExplanations} />
              )}
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
              {featuresDebtTrackerAllowed === false ? (
                <FeatureLockedView 
                  title="Borç Takibi Sınırlandırıldı" 
                  icon={<Wallet className="w-8 h-8" />} 
                  description="Danışan seans ücretleri borç, alacak ve tahsilat takibi modülü geçici olarak devre dışıdır." 
                />
              ) : (
                <>
                  {/* Header Card */}
              <div className="bg-[#cb997e] p-8 rounded-[2.5rem] text-white shadow-md relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
                <div className="max-w-2xl">
                  <span className="text-[10px] bg-white/20 px-3 py-1 rounded-full font-semibold tracking-wider">TAHSİLAT TAKİP</span>
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
                    <span className="text-[10px] text-slate-400 font-bold tracking-wider block">TOPLAM ALACAK</span>
                    <span className="text-xl font-bold text-slate-800">₺{debtsData.totalUnpaidAmount.toLocaleString('tr-TR')}</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#e5e1d8] shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 text-lg">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold tracking-wider block">ÖDENMEMİŞ SEANS</span>
                    <span className="text-xl font-bold text-slate-800">{debtsData.unpaidSessions.length} Seans</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#e5e1d8] shadow-xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#6b705c]/10 flex items-center justify-center text-[#6b705c] text-lg">
                    <Users className="w-5 h-5 text-[#6b705c]" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold tracking-wider block">BORÇLU DANIŞAN</span>
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
                              <span className="text-[9px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full tracking-wider">ÖDENMEDİ</span>
                            </div>
                          </div>

                          {/* Sessions mini list */}
                          <div className="border-t border-[#e5e1d8]/40 pt-3 space-y-2">
                            {debtor.sessions.map(s => {
                              const isFaceToFace = s.type === 'face-to-face';
                              return (
                                <div key={s.id} className="flex justify-between items-center text-xs bg-white p-2.5 rounded-xl border border-slate-100">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 font-medium text-slate-700 flex-wrap">
                                      <span className="text-[11px]">{new Date(s.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
                                      <span className="text-[10px] text-slate-400">{s.time}</span>
                                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold tracking-wider ${
                                        isFaceToFace ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                      }`}>
                                        {isFaceToFace ? 'YÜZYÜZE' : 'ONLİNE'}
                                      </span>
                                      {s.clientName !== debtor.clientName && (
                                        <span className="text-[10px] font-bold text-[#cb997e] bg-[#fdfbf7] border border-[#e5e1d8]/80 px-1.5 py-0.5 rounded" title="Takvimdeki Etkinlik İsmi">
                                          {s.clientName}
                                        </span>
                                      )}
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
                            onClick={() => setDebtConfirmState({
                              isOpen: true,
                              clientName: debtor.clientName,
                              totalAmount: debtor.totalAmount
                            })}
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
            </>
          )}
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
              {featuresCalendarAllowed === false ? (
                <FeatureLockedView 
                  title="Takvim Entegrasyonu Sınırlandırıldı" 
                  icon={<CalendarIcon className="w-8 h-8" />} 
                  description="Dış takvim dosyaları ve Google Calendar çift yönlü eşitleme modülü geçici olarak devre dışıdır." 
                />
              ) : (
                <CalendarSyncGuide
                  onImportSessions={handleImportSessions}
                  defaultPrice={settings.defaultSessionPrice}
                  defaultBabysitterFee={settings.defaultBabysitterFee}
                  defaultOfficeRentFee={settings.defaultOfficeRentFee}
                  settings={settings}
                  onSaveSettings={(updated) => setSettings(updated)}
                  showToast={showToast}
                  sessions={sessions}
                  onDeleteSessions={(ids) => {
                    setSessions(prev => prev.filter(s => !ids.includes(s.id)));
                  }}
                  onGoToDate={(date) => setSelectedDate(date)}
                  setActiveTab={setActiveTab}
                  showExplanations={showExplanations}
                />
              )}
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
                  <span className="text-[10px] bg-white/20 px-3 py-1 rounded-full font-semibold tracking-wider">VERİ YÖNETİMİ</span>
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
                    <h3 className="text-sm font-bold tracking-widest text-[#6b705c] flex items-center gap-2">
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

                  {featuresExportAllowed === false ? (
                    <div className="space-y-2 pt-2 bg-rose-50/50 p-4 rounded-2xl border border-rose-100 flex flex-col items-center text-center">
                      <span className="text-xs text-rose-700 font-semibold flex items-center gap-1.5 select-none">
                        <span>🔒</span> Bu Özellik Devre Dışı Bırakıldı
                      </span>
                      <p className="text-[10px] text-rose-500 leading-relaxed font-medium">
                        Seans verilerini Excel/CSV formatında dışa aktarma yetkiniz bulunmamaktadır. Bilgi almak için lütfen yöneticinizle iletişime geçin.
                      </p>
                    </div>
                  ) : (
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
                  )}
                </div>

                {/* Offline Secure Backup Card */}
                <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[#e5e1d8] shadow-xs flex flex-col justify-between space-y-4" id="offline-backup-card">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold tracking-widest text-[#6b705c] flex items-center gap-2">
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

          {activeTab === 'search' && (
            <motion.div
              key="search-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Header Info */}
              <div className="bg-[#6b705c] p-8 rounded-[2.5rem] text-white shadow-md relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
                <div className="max-w-2xl">
                  <span className="text-[10px] bg-white/20 px-3 py-1 rounded-full font-semibold tracking-wider">GELİŞMİŞ ANALİZ</span>
                  <h2 className="text-3xl font-serif mt-3">Sorgulama, Filtreleme & Muhasebe Hesaplama</h2>
                  <p className="text-sm opacity-90 mt-2 leading-relaxed">
                    Tüm seans geçmişinizde danışan ismi, seans notları veya tarih aralığına göre arama yapabilir; filtrelenmiş seansların toplam brüt gelirini, giderlerini ve net kârını anında hesaplayabilirsiniz.
                  </p>
                </div>
              </div>

              {/* Filters Block */}
              <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[#e5e1d8] shadow-xs space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Filter className="w-5 h-5 text-[#6b705c]" />
                  <h3 className="text-sm font-bold tracking-widest text-[#6b705c] uppercase">Dinamik Filtreleme Seçenekleri</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Search text query */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Danışan Adı veya Not İçeriği</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 w-4 h-4 text-[#a5a58d]" />
                      <input
                        type="text"
                        placeholder="Kelime girip aratın (Örn: Ahmet, zamlı seans...)"
                        value={searchTabQuery}
                        onChange={(e) => setSearchTabQuery(e.target.value)}
                        className="w-full pl-9 pr-8 py-2.5 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] font-medium"
                      />
                      {searchTabQuery && (
                        <button
                          onClick={() => setSearchTabQuery('')}
                          className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Start Date */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Başlangıç Tarihi</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={searchStartDate}
                        onChange={(e) => setSearchStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] font-medium h-[38px]"
                      />
                    </div>
                  </div>

                  {/* End Date */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bitiş Tarihi</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={searchEndDate}
                        onChange={(e) => setSearchEndDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] font-medium h-[38px]"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {/* Session Type Filter */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Seans Türü</label>
                    <select
                      value={searchType}
                      onChange={(e: any) => setSearchType(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] font-medium text-slate-700 h-[38px]"
                    >
                      <option value="all">Tüm Türler (Hepsi)</option>
                      <option value="online">Çevrimiçi Seanslar</option>
                      <option value="face-to-face">Yüz Yüze Seanslar</option>
                      <option value="cancelled">İptal Edilenler</option>
                      <option value="non-session">Seans Dışı Notlar / Bloklar</option>
                    </select>
                  </div>

                  {/* Payment Status Filter */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ödeme Durumu</label>
                    <select
                      value={searchPaymentStatus}
                      onChange={(e: any) => setSearchPaymentStatus(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] font-medium text-slate-700 h-[38px]"
                    >
                      <option value="all">Tüm Durumlar (Hepsi)</option>
                      <option value="paid">Ödenenler</option>
                      <option value="unpaid">Ödenmeyenler</option>
                    </select>
                  </div>

                  {/* Reset Filters */}
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setSearchTabQuery('');
                        setSearchStartDate('');
                        setSearchEndDate('');
                        setSearchType('all');
                        setSearchPaymentStatus('all');
                      }}
                      className="w-full h-[38px] border border-dashed border-[#cb997e] text-[#cb997e] hover:bg-[#cb997e]/5 text-xs font-bold rounded-xl transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Filtreleri Sıfırla
                    </button>
                  </div>
                </div>
              </div>

              {/* Calculations Bento Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                {/* Net Profit Card */}
                <div className="bg-[#6b705c] p-6 rounded-[2rem] text-white shadow-md flex flex-col justify-between relative overflow-hidden md:col-span-2">
                  <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-28 h-28 bg-white/5 rounded-full pointer-events-none" />
                  
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-[10px] bg-white/20 px-2.5 py-0.5 rounded-full font-bold tracking-wider">FİLTRELENMİŞ NET KÂR</span>
                      <h4 className="text-[10px] text-white/70 font-semibold font-sans mt-1">Bulunan Seansların Toplam Net Kâr Tutarı</h4>
                    </div>
                    <div className="p-2 bg-white/10 rounded-xl">
                      <Calculator className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <h2 className="text-4xl font-serif">₺{searchTabCalculations.netGelir.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h2>
                    <p className="text-[10px] opacity-80 mt-1 font-mono">Formül: Brüt Gelir (₺{searchTabCalculations.brütGelir.toLocaleString('tr-TR')}) - Toplam Gider (₺{searchTabCalculations.toplamGider.toLocaleString('tr-TR')})</p>
                  </div>
                </div>

                {/* Financial Details */}
                <div className="bg-white p-6 rounded-[2rem] border border-[#e5e1d8] flex flex-col justify-between space-y-4 shadow-xs">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold tracking-wider uppercase">BRÜT GELİR</span>
                      <span className="font-bold text-slate-700">₺{searchTabCalculations.brütGelir.toLocaleString('tr-TR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold tracking-wider uppercase">TOPLAM GİDER</span>
                      <span className="font-bold text-slate-700">₺{searchTabCalculations.toplamGider.toLocaleString('tr-TR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pl-2 border-l-2 border-slate-200">
                      <span className="text-slate-400 text-[11px]">Bakıcı Payı</span>
                      <span className="text-slate-600 font-medium text-[11px]">₺{searchTabCalculations.bakiciGideri.toLocaleString('tr-TR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs pl-2 border-l-2 border-slate-200">
                      <span className="text-slate-400 text-[11px]">Ofis Kirası</span>
                      <span className="text-slate-600 font-medium text-[11px]">₺{searchTabCalculations.ofisGideri.toLocaleString('tr-TR')}</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-3 text-[10px] text-slate-400 leading-normal font-semibold">
                    * Hesaplamalara iptal edilen seanslar dahil değildir.
                  </div>
                </div>

                {/* Payment Metrics & Counts */}
                <div className="bg-white p-6 rounded-[2rem] border border-[#e5e1d8] flex flex-col justify-between space-y-4 shadow-xs">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold tracking-wider uppercase">TAHSİL EDİLEN</span>
                      <span className="font-bold text-emerald-600">₺{searchTabCalculations.odenenMiktar.toLocaleString('tr-TR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-bold tracking-wider uppercase">ALACAK (BEKLEYEN)</span>
                      <span className="font-bold text-rose-500">₺{searchTabCalculations.odenmeyenMiktar.toLocaleString('tr-TR')}</span>
                    </div>
                    <div className="border-t border-slate-100 pt-2 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                      <span>Bulunan Seans</span>
                      <span>{searchTabCalculations.totalSessions} Adet</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100/50 px-1.5 py-0.5 rounded-full">
                      {searchTabCalculations.onlineCount} Online
                    </span>
                    <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100/50 px-1.5 py-0.5 rounded-full">
                      {searchTabCalculations.faceToFaceCount} Yüz Yüze
                    </span>
                    <span className="text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-100/50 px-1.5 py-0.5 rounded-full">
                      {searchTabCalculations.cancelledCount} İptal
                    </span>
                  </div>
                </div>

              </div>

              {/* Filtered Sessions List */}
              <div className="bg-white rounded-[2rem] border border-[#e5e1d8] overflow-hidden shadow-xs flex flex-col">
                <div className="p-6 md:p-8 border-b border-[#f5f5f0] flex flex-col sm:flex-row justify-between items-center gap-4 bg-[#fdfbf7]">
                  <div>
                    <h3 className="text-lg font-serif text-[#6b705c] italic">Sorgulama ve Arama Sonuçları</h3>
                    {showExplanations && (
                      <p className="text-xs text-slate-400 animate-fade-in">Filtrelerinize uyan toplam {searchedAndFilteredSessions.length} seans kaydı listeleniyor.</p>
                    )}
                  </div>
                  
                  <div className="text-xs font-semibold text-slate-500">
                    Sıralama: <span className="text-[#cb997e]">En Yeni Seans En Üstte</span>
                  </div>
                </div>

                <div className="p-6 divide-y divide-slate-100">
                  {searchedAndFilteredSessions.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 text-xs flex flex-col items-center justify-center space-y-3">
                      <Search className="w-10 h-10 text-slate-300 animate-pulse" />
                      <div>
                        <h4 className="font-bold text-slate-700">Hiçbir Sonuç Bulunamadı</h4>
                        <p className="text-slate-400 mt-1 max-w-sm">
                          Seçmiş olduğunuz arama kriterleri veya filtre seçenekleri ile eşleşen bir seans kaydı bulunmuyor. Lütfen filtrelerinizi sıfırlayın veya değiştirin.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {[...searchedAndFilteredSessions]
                        .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
                        .map(session => {
                          const [year, month, day] = session.date.split('-');
                          const formattedDate = `${day}.${month}.${year}`;
                          const isFaceToFace = session.type === 'face-to-face';
                          const isCancelled = session.type === 'cancelled';
                          const isPaid = session.paymentStatus === 'paid';

                          return (
                            <div key={session.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 hover:bg-[#fdfbf7]/40 rounded-2xl border border-slate-100 gap-4 transition-all">
                              <div className="space-y-1.5 text-left min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm text-slate-800">
                                    {session.clientName}
                                  </span>
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                                    session.type === 'online' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100/50' :
                                    isFaceToFace ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' :
                                    'bg-rose-50 text-rose-600 border border-rose-100/50'
                                  }`}>
                                    {session.type === 'online' ? 'Çevrimiçi' : isFaceToFace ? 'Yüz Yüze' : 'İptal'}
                                  </span>
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                                    isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                                  }`}>
                                    {isPaid ? 'ÖDENDİ' : 'ÖDENMEDİ'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold font-mono">
                                  <span className="text-slate-600">{formattedDate}</span>
                                  <span>•</span>
                                  <span>{session.time}</span>
                                  <span>•</span>
                                  <span className="text-[#cb997e] font-bold">₺{session.price}</span>
                                </div>

                                {session.notes && (
                                  <p className="text-xs text-slate-500 italic font-medium bg-[#fdfbf7] p-2.5 rounded-xl border border-slate-100/60 max-w-full">
                                    <strong>Not:</strong> {session.notes}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto w-full sm:w-auto justify-end">
                                {/* Toggle payment status shortcut button */}
                                {!isCancelled && (
                                  <button
                                    onClick={() => handleTogglePaymentStatus(session.id)}
                                    className={`px-3 py-1.5 text-[10px] font-bold rounded-xl cursor-pointer transition-colors border ${
                                      isPaid 
                                        ? 'bg-rose-50/50 hover:bg-rose-50 text-rose-600 border-rose-200' 
                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                    }`}
                                  >
                                    {isPaid ? '✗ Ödenmedi Yap' : '✓ Ödendi Yap'}
                                  </button>
                                )}
                                
                                <button
                                  onClick={() => {
                                    setSelectedDate(session.date);
                                    setActiveTab('agenda');
                                  }}
                                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10px] font-bold rounded-xl border border-slate-200 cursor-pointer transition-colors"
                                >
                                  Ajandada Git
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedDate(session.date);
                                    setEditingSession(session);
                                    setIsSessionModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 bg-[#6b705c] hover:bg-[#585c4c] text-white text-[10px] font-bold rounded-xl cursor-pointer transition-colors"
                                >
                                  Düzenle
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'admin' && user?.email === 'muhammedakifkayacan@gmail.com' && (
            <motion.div
              key="admin-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <AdminPanel showToast={showToast} />
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
        showExplanations={showExplanations}
        onToggleExplanations={toggleShowExplanations}
        featuresSmartPriceMatchingAllowed={featuresSmartPriceMatchingAllowed}
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
        sessions={sessions}
        enableSmartClientPriceMatching={featuresSmartPriceMatchingAllowed && settings.enableSmartClientPriceMatching}
      />

      {/* FAQ Modal Component */}
      <FAQModal
        isOpen={isFaqOpen}
        onClose={() => setIsFaqOpen(false)}
        onStartTour={() => setIsTourOpen(true)}
      />

      {/* Sync Details Modal Component */}
      <SyncDetailsModal
        isOpen={isSyncDetailsModalOpen}
        onClose={() => setIsSyncDetailsModalOpen(false)}
        syncDetails={syncDetailsToShow}
      />

      {/* Debt Payment Confirmation Modal */}
      <DebtPaymentConfirmationModal
        isOpen={debtConfirmState.isOpen}
        onClose={() => setDebtConfirmState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => handleMarkAllClientSessionsAsPaid(debtConfirmState.clientName)}
        clientName={debtConfirmState.clientName}
        totalAmount={debtConfirmState.totalAmount}
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
        userId={user?.uid}
      />

      {/* Aesthetic Footer */}
      <footer className="border-t border-[#e5e1d8] bg-white mt-12 pt-6 pb-24 sm:pb-28 text-center text-xs text-slate-400">
        <p>© 2026 PsyCalcu • <span className="font-bold text-[#6b705c]">v1.6.0</span> • Apple Takvim & Seans Muhasebe Entegrasyonu</p>
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
                disabled={confirmState.hasCountdown && confirmCountdown > 0}
                onClick={() => {
                  confirmState.onConfirm();
                  setConfirmState(null);
                }}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-sm transition-all ${
                  confirmState.hasCountdown && confirmCountdown > 0
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-rose-600 hover:bg-rose-700 cursor-pointer'
                }`}
              >
                {confirmState.hasCountdown && confirmCountdown > 0 ? `Onayla (${confirmCountdown}s)` : 'Onayla'}
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
