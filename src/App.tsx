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
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Session, AppSettings } from './types';
import { getInitialMockSessions } from './utils/icsParser';
import CalendarSyncGuide from './components/CalendarSyncGuide';
import SettingsModal from './components/SettingsModal';
import SessionModal from './components/SessionModal';
import StatsDashboard from './components/StatsDashboard';
import AuthCard from './components/AuthCard';
import { auth, onAuthStateChanged, User } from './lib/firebase';
import { fetchUserData, saveUserData, migrateLocalDataToFirestore } from './lib/firestoreService';

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

  // Load sessions from localStorage or use initial mock sessions
  const [sessions, setSessions] = useState<Session[]>(() => {
    const saved = localStorage.getItem('psycalcu_sessions');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return getInitialMockSessions(1200, 250, 200);
  });

  // Authentication & Cloud Sync states
  const [user, setUser] = useState<User | null>(null);
  const [isInitialAuthCheckDone, setIsInitialAuthCheckDone] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthSyncing, setIsAuthSyncing] = useState(false);
  const hasSyncedRef = useRef<string | null>(null);

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
            setSessions(cloudData.sessions || []);
            setSettings(cloudData.settings);
            showToast('Bulut verileriniz başarıyla senkronize edildi.', 'success');
          } else {
            // First time registered user, sync existing local data to their new cloud database if it's real
            const savedSessionsStr = localStorage.getItem('psycalcu_sessions');
            let hasRealLocalSessions = false;
            if (savedSessionsStr) {
              try {
                const parsed = JSON.parse(savedSessionsStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  hasRealLocalSessions = !parsed.every((s: any) => s.id && s.id.startsWith('mock_'));
                }
              } catch (e) {}
            }
            if (hasRealLocalSessions) {
              await saveUserData(currentUser.uid, settings, sessions);
              showToast('Mevcut seanslarınız ve ayarlarınız yeni bulut hesabınıza başarıyla aktarıldı!', 'success');
            } else {
              await saveUserData(currentUser.uid, settings, []);
              setSessions([]);
              showToast('Yeni bulut profiliniz oluşturuldu.', 'info');
            }
          }
        } catch (error) {
          console.error("Bulut verisi çekilirken hata:", error);
          showToast('Bulut verileri eşitlenirken bir hata oluştu.', 'error');
        } finally {
          setIsAuthSyncing(false);
        }
      } else {
        setUser(null);
        hasSyncedRef.current = null;
        // Load local storage if they log out
        const savedSessions = localStorage.getItem('psycalcu_sessions');
        const savedSettings = localStorage.getItem('psycalcu_settings');
        if (savedSessions) {
          try { setSessions(JSON.parse(savedSessions)); } catch (e) {}
        } else {
          setSessions(getInitialMockSessions(1200, 250, 200));
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

  // Save settings & sessions to local & cloud on changes
  useEffect(() => {
    localStorage.setItem('psycalcu_settings', JSON.stringify(settings));
    if (user && !isAuthSyncing) {
      saveUserData(user.uid, settings, sessions).catch(console.error);
    }
  }, [settings, user, isAuthSyncing]);

  useEffect(() => {
    localStorage.setItem('psycalcu_sessions', JSON.stringify(sessions));
    if (user && !isAuthSyncing) {
      saveUserData(user.uid, settings, sessions).catch(console.error);
    }
  }, [sessions, user, isAuthSyncing]);

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
  const [activeTab, setActiveTab] = useState<'agenda' | 'stats' | 'sync' | 'backup' | 'settings'>('agenda');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  
  // Google Sheets state
  const [sheetLinkInput, setSheetLinkInput] = useState('');
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);

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
    setSessions(prev => {
      const exists = prev.some(s => s.id === savedSession.id);
      if (exists) {
        return prev.map(s => s.id === savedSession.id ? savedSession : s);
      } else {
        return [...prev, savedSession];
      }
    });
  };

  const handleDeleteSession = (id: string) => {
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
    const nextTypeMap: Record<string, 'online' | 'face-to-face' | 'cancelled'> = {
      'online': 'face-to-face',
      'face-to-face': 'cancelled',
      'cancelled': 'online'
    };
    const nextType = nextTypeMap[currentType];
    setSessions(prev => prev.map(s => {
      if (s.id === id) {
        const updated = { ...s, type: nextType };
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
    setSessions(prev => prev.map(s => {
      if (s.id === id) {
        const hasFee = !s.hasBabysitterFee;
        return {
          ...s,
          hasBabysitterFee: hasFee,
          babysitterFeeAmount: hasFee ? settings.defaultBabysitterFee : 0
        };
      }
      return s;
    }));
  };

  const handleImportSessions = (newSessions: Session[]) => {
    setSessions(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      const filteredNew = newSessions.filter(s => !existingIds.has(s.id));
      return [...prev, ...filteredNew];
    });
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
      <div className="flex items-center justify-center min-h-screen bg-[#fdfbf7] p-6" id="auth-portal-screen">
        <AuthCard
          user={null}
          onLogout={handleLogout}
          onAuthSuccess={handleAuthSuccess}
          existingSessionsCount={sessions.length}
        />
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
        <div className="flex items-center bg-[#f5f5f0] p-1 rounded-full border border-[#e5e1d8] text-xs">
          <button
            onClick={() => setActiveTab('agenda')}
            className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
              activeTab === 'agenda' ? 'bg-[#6b705c] text-white shadow-sm' : 'text-[#6b705c] hover:bg-[#e5e5df]'
            }`}
          >
            Günlük Ajanda
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
              activeTab === 'stats' ? 'bg-[#6b705c] text-white shadow-sm' : 'text-[#6b705c] hover:bg-[#e5e5df]'
            }`}
          >
            Muhasebe Raporu
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
              activeTab === 'sync' ? 'bg-[#6b705c] text-white shadow-sm' : 'text-[#6b705c] hover:bg-[#e5e5df]'
            }`}
          >
            Takvim Entegrasyonu
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
              activeTab === 'backup' ? 'bg-[#6b705c] text-white shadow-sm' : 'text-[#6b705c] hover:bg-[#e5e5df]'
            }`}
          >
            Yedek & E-Tablo
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Takvim Entegrasyon Aktif
          </div>

          {/* Bulut Senkronizasyon Durumu Pill */}
          {user && (
            <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
              isAuthSyncing 
                ? 'text-amber-700 bg-amber-50 border-amber-100' 
                : 'text-emerald-700 bg-emerald-50 border-emerald-100'
            }`} id="cloud-sync-status-pill">
              {isAuthSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span className="font-semibold">Bulut Senkronizasyonu Sürüyor...</span>
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
            <p className="text-[10px] text-slate-400">{headerDateStr}</p>
          </div>
          
          <button
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
              <div className="lg:col-span-4 flex flex-col gap-6">
                
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
                          <span className="text-[9px] text-slate-400">Seans başı biriken</span>
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
                          <span className="text-[9px] text-slate-400">Seans başı ödenen</span>
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
                        <p className="text-[9px] text-slate-400 leading-tight mt-2 italic">
                          * Bakıcı seans başı <span className="font-bold text-[#6b705c]">₺{settings.defaultBabysitterFee}</span>, ofis seans başı <span className="font-bold text-[#6b705c]">₺{settings.defaultOfficeRentFee}</span> üzerinden hesaplanır.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Quick actions in Left column */}
                  <div className="pt-4 mt-4 border-t border-[#f5f5f0] flex flex-col gap-2">
                    <button
                      onClick={handleResetData}
                      className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 text-xs font-semibold rounded-xl border border-slate-200/60 transition-colors cursor-pointer"
                    >
                      Örnek Verileri Yeniden Yükle
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT Column: Agenda & Calendar Sync */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                
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
                          <span className={`text-[9px] uppercase tracking-widest font-semibold ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
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
                        <span className="text-xs bg-[#f5f5f0] text-slate-500 font-sans font-normal px-2.5 py-0.5 rounded-full border border-slate-200">
                          {new Date(selectedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">Apple Takvim entegrasyonu ve manuel yönetilen seanslar</p>
                    </div>
                    
                    <button 
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
                              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
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
                              
                              <p className="text-xs text-slate-500 mt-1 font-medium italic">
                                {session.notes || 'Açıklama girilmemiş.'}
                              </p>
                            </div>

                            {/* Financial item state */}
                            <div className="text-left sm:text-right w-full sm:w-auto flex sm:flex-col justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
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
                            </div>

                            {/* Quick Actions (Hover visible on desktop, always visible on mobile) */}
                            <div className="flex items-center gap-2 border-l border-[#e5e1d8]/40 pl-3 shrink-0">
                              {/* Toggle Type */}
                              <button
                                onClick={() => handleToggleType(session.id, session.type)}
                                className="p-1.5 text-slate-400 hover:text-[#6b705c] hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                                title="Seans Tipini Değiştir"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>

                              {/* Toggle Babysitter */}
                              <button
                                onClick={() => handleToggleBabysitter(session.id)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  session.hasBabysitterFee 
                                    ? 'text-blue-500 bg-blue-50/50 hover:bg-blue-50' 
                                    : 'text-slate-300 hover:text-blue-400'
                                }`}
                                title="Bakıcı Ücretini Aç/Kapat"
                              >
                                <span className="text-xs font-bold font-serif">👶</span>
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() => {
                                  setEditingSession(session);
                                  setIsSessionModalOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                                title="Seansı Düzenle"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteSession(session.id)}
                                className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                                title="Seansı Sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
              <StatsDashboard sessions={sessions} settings={settings} />
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

                  <div className="space-y-2 bg-[#fdfbf7] p-4 rounded-2xl border border-[#e5e1d8]">
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      💡 <span className="text-[#6b705c] font-bold">Pratik Yapıştırma Yöntemi:</span> Aşağıdaki butona tıklayıp Google Sheets veya Excel'i açarak dilediğiniz hücreye tıklayın ve <kbd className="bg-white px-1 py-0.5 border border-slate-200 rounded text-[9px] font-mono shadow-xs">Ctrl+V</kbd> (Mac'te <kbd className="bg-white px-1 py-0.5 border border-slate-200 rounded text-[9px] font-mono shadow-xs">Cmd+V</kbd>) tuşlarına basın. Tüm verileriniz anında sütunlara ayrışır!
                    </p>
                  </div>

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

                  <div className="space-y-2 bg-[#fdfbf7] p-4 rounded-2xl border border-[#e5e1d8]">
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      * Verileriniz internete gönderilmez, tamamen cihazınızda yerel yedeklenir. Bilgisayar değiştirdiğinizde veya geçmişi temizlediğinizde bu yedek dosyasını yükleyebilirsiniz.
                    </p>
                  </div>
                </div>
              </div>
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

      {/* Aesthetic Footer */}
      <footer className="border-t border-[#e5e1d8] bg-white mt-12 py-6 text-center text-xs text-slate-400">
        <p>© 2026 PsyCalcu • Apple Takvim & Seans Muhasebe Entegrasyonu</p>
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
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full p-4 bg-white border border-slate-100 shadow-xl rounded-2xl flex gap-3 items-start animate-slide-in-right" id="toast-overlay">
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
    </div>
  );
}
