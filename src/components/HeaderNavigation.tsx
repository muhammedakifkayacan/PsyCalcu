import React, { useState } from 'react';
import { 
  Search, 
  X, 
  ChevronLeft, 
  Check, 
  RefreshCw, 
  Lightbulb, 
  HelpCircle, 
  Settings as SettingsIcon, 
  LogOut,
  Eye,
  EyeOff,
  Menu,
  Calendar as CalendarIcon,
  TrendingUp,
  CreditCard,
  Database,
  Building,
  ShieldCheck,
  UserCheck,
  UserX,
  Bell,
  Sparkles,
  ChevronRight,
  User,
  SlidersHorizontal,
  FileSpreadsheet,
  Clock,
  History,
  Lock,
  Trash2,
  Cloud,
  CloudOff,
  FileText,
  Users,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NotificationCenter } from './NotificationCenter';
import { AppNotification, AppSettings, Session } from '../types';
import { usePrivacy } from '../context/PrivacyContext';

interface HeaderNavigationProps {
  isMobile: boolean;
  isHeaderCollapsed: boolean;
  isMobileSearchOpen: boolean;
  setIsMobileSearchOpen: (val: boolean) => void;
  headerSearchQuery: string;
  setHeaderSearchQuery: (val: string) => void;
  setSearchTabQuery: (val: string) => void;
  setActiveTab: (val: any) => void;
  searchedSessions: Session[];
  activeTab: string;
  setSelectedDate: (val: string) => void;
  setEditingSession: (val: Session | null) => void;
  setIsSessionModalOpen: (val: boolean) => void;
  featuresAccountingAllowed: boolean;
  featuresDebtTrackerAllowed: boolean;
  featuresCalendarAllowed: boolean;
  settings: AppSettings;
  user: any;
  isQuotaExceeded: boolean;
  isAuthSyncing: boolean;
  isCloudSaving: boolean;
  headerDateStr: string;
  allNotifications: AppNotification[];
  handleMarkAllAsRead: () => void;
  handleClearAllNotifications: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  setSyncDetailsToShow: (details: any) => void;
  setIsSyncDetailsModalOpen: (val: boolean) => void;
  toggleShowExplanations: () => void;
  showExplanations: boolean;
  toggleShowNotes?: () => void;
  showNotes?: boolean;
  setIsFaqOpen: (val: boolean) => void;
  setIsSettingsOpen: (val: boolean) => void;
  handleLogout: () => void;
  onOpenClientPricingModal?: (initialTab?: 'clients' | 'reconcile' | 'snapshots') => void;
  onOpenMonthClosingModal?: (monthKey?: string) => void;
  unclosedMonthsCount?: number;
  isOnline?: boolean;
  pendingMutationsCount?: number;
  deletedSessionsCount?: number;
  onOpenTrashBin?: () => void;
  onSyncNow?: () => void;
}

export const HeaderNavigation: React.FC<HeaderNavigationProps> = ({
  isMobile,
  isHeaderCollapsed,
  isMobileSearchOpen,
  setIsMobileSearchOpen,
  headerSearchQuery,
  setHeaderSearchQuery,
  setSearchTabQuery,
  setActiveTab,
  searchedSessions,
  activeTab,
  setSelectedDate,
  setEditingSession,
  setIsSessionModalOpen,
  featuresAccountingAllowed,
  featuresDebtTrackerAllowed,
  featuresCalendarAllowed,
  settings,
  user,
  isQuotaExceeded,
  isAuthSyncing,
  isCloudSaving,
  headerDateStr,
  allNotifications,
  handleMarkAllAsRead,
  handleClearAllNotifications,
  showToast,
  setSyncDetailsToShow,
  setIsSyncDetailsModalOpen,
  toggleShowExplanations,
  showExplanations,
  toggleShowNotes,
  showNotes = true,
  setIsFaqOpen,
  setIsSettingsOpen,
  handleLogout,
  onOpenClientPricingModal,
  onOpenMonthClosingModal,
  unclosedMonthsCount,
  isOnline = true,
  pendingMutationsCount = 0,
  deletedSessionsCount = 0,
  onOpenTrashBin,
  onSyncNow
}) => {
  const { isPrivacyMode, togglePrivacyMode, isHideClientNames, toggleHideClientNames, formatMoney, formatClientName } = usePrivacy();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'clients' | 'finance' | 'data' | 'management' | 'settings' | null>(null);

  const handleCloseMenu = () => {
    setIsMenuOpen(false);
    setActiveCategory(null);
  };

  const handlePrivacyToggle = (closeMenu = false) => {
    togglePrivacyMode();
    if (!isPrivacyMode) {
      showToast('Gizlilik modu açıldı 👁️‍🗨️ (Tüm tutarlar gizlendi)', 'info');
    } else {
      showToast('Gizlilik modu kapatıldı 👁️ (Tutarlar gösteriliyor)', 'info');
    }
    if (closeMenu) {
      handleCloseMenu();
    }
  };

  const handleHideClientNamesToggle = (closeMenu = false) => {
    toggleHideClientNames();
    if (!isHideClientNames) {
      showToast('Danışan isimleri gizlendi 👤 (Örn: E*** Y***)', 'info');
    } else {
      showToast('Danışan isimleri gösteriliyor 👤', 'info');
    }
    if (closeMenu) {
      handleCloseMenu();
    }
  };

  const handleTabClick = (tabName: string) => {
    setActiveTab(tabName);
    handleCloseMenu();
  };

  return (
    <>
      <nav 
        className={`sticky top-0 z-40 bg-white border-b border-[#e5e1d8] transition-all duration-300 transform ${
          isHeaderCollapsed ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100 shadow-3xs'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-2.5 flex flex-col gap-2.5">
          
          {/* TOP ROW: BRAND LOGO + HEADER ACTIONS (SEARCH, NOTIFICATIONS, BURGER MENU) */}
          <div className="flex items-center justify-between w-full gap-3">
            
            {/* Brand Logo & Name */}
            <div 
              onClick={() => handleTabClick('agenda')}
              className="flex items-center gap-2.5 shrink-0 cursor-pointer hover:opacity-85 select-none transition-all"
              title="Ana Sayfaya Git (Günlük Ajanda)"
            >
              <div className="w-9 h-9 md:w-10 md:h-10 bg-[#6b705c] rounded-xl flex items-center justify-center text-white font-serif text-xl md:text-2xl italic shadow-md">
                P
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-serif italic text-[#6b705c] tracking-tight leading-none">PsyCalcu</h1>
                <p className="text-[9px] md:text-[10px] text-slate-400 font-semibold tracking-wider mt-0.5 hidden sm:block">PSİKOLOG SEANS & BÜTÇE AJANDASI</p>
              </div>

              {/* Cloud Sync Status Indicator Badge */}
              {user && (
                <button
                  type="button"
                  onClick={onSyncNow}
                  className={`ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer border shadow-3xs ${
                    !isOnline 
                      ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                      : isQuotaExceeded
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : (isAuthSyncing || isCloudSaving)
                      ? 'bg-sky-50 text-sky-800 border-sky-200'
                      : 'bg-emerald-50/70 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100/70'
                  }`}
                  title={
                    !isOnline 
                      ? `Çevrimdışı (${pendingMutationsCount || 0} bekleyen işlem). Bağlantı gelince eşitlenir, tıklayarak deneyin.`
                      : isQuotaExceeded
                      ? 'Kota Doldu (Yerel Depolama Devrede)'
                      : (isAuthSyncing || isCloudSaving)
                      ? 'Buluta kaydediliyor...'
                      : 'Tüm verileriniz bulutta güvende. Tıklayarak şimdi eşitleyin.'
                  }
                >
                  <span className="relative flex h-2 w-2">
                    {!isOnline ? (
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    ) : isQuotaExceeded ? (
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    ) : (isAuthSyncing || isCloudSaving) ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                      </>
                    ) : (
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    )}
                  </span>
                  <span className="text-[10px] hidden xl:inline font-medium">
                    {!isOnline 
                      ? `Çevrimdışı (${pendingMutationsCount || 0})`
                      : (isAuthSyncing || isCloudSaving)
                      ? 'Eşitleniyor...'
                      : 'Bulutta Güvende'}
                  </span>
                  {(isAuthSyncing || isCloudSaving) && (
                    <RefreshCw className="w-2.5 h-2.5 animate-spin text-sky-600 hidden sm:inline" />
                  )}
                </button>
              )}
            </div>

            {/* Desktop Inline Search Bar */}
            <div className="hidden md:block relative w-56 xl:w-64">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#6b705c]">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                placeholder="Seans veya danışan ara..."
                value={headerSearchQuery}
                onChange={(e) => setHeaderSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && headerSearchQuery.trim()) {
                    setSearchTabQuery(headerSearchQuery);
                    setActiveTab('search');
                    setHeaderSearchQuery('');
                  }
                }}
                className="w-full pl-9 pr-7 py-1.5 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-full focus:outline-none focus:border-[#6b705c] font-medium placeholder:text-slate-400 shadow-3xs"
              />
              {headerSearchQuery && (
                <button
                  onClick={() => setHeaderSearchQuery('')}
                  className="absolute inset-y-0 right-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Search Overlay Dropdown */}
              {headerSearchQuery.trim() && (
                <div className="absolute top-full mt-2 right-0 w-80 max-h-[300px] overflow-y-auto bg-white border border-[#e5e1d8] rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-fade-in">
                  <div className="px-2 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Arama Sonuçları ({searchedSessions.length})
                  </div>
                  {searchedSessions.length === 0 ? (
                    <div className="px-3 py-3 text-center text-xs text-slate-400">Sonuç bulunamadı</div>
                  ) : (
                    searchedSessions.slice(0, 5).map(session => (
                      <div 
                        key={session.id}
                        onClick={() => {
                          setSelectedDate(session.date);
                          setActiveTab('agenda');
                          setHeaderSearchQuery('');
                        }}
                        className="p-2 hover:bg-[#fdfbf7] rounded-xl cursor-pointer transition-colors flex justify-between items-center text-xs"
                      >
                        <div className="truncate pr-2">
                          <p className="font-bold text-slate-700 truncate">{formatClientName(session.clientName)}</p>
                          <p className="text-[10px] text-slate-400">{session.date} • {session.time}</p>
                        </div>
                        <span className="font-bold text-[#cb997e] shrink-0">{formatMoney(session.price)}</span>
                      </div>
                    ))
                  )}
                  <button
                    onClick={() => {
                      setSearchTabQuery(headerSearchQuery);
                      setActiveTab('search');
                      setHeaderSearchQuery('');
                    }}
                    className="w-full py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-[10px] font-bold text-center mt-1 block"
                  >
                    Tüm Sonuçları Gör
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT HEADER ACTIONS: SEARCH ICON, NOTIFICATIONS, BURGER MENU */}
            <div className="flex items-center gap-2">
              
              {/* Dedicated Search Icon Button */}
              <motion.button
                id="header-search-toggle-btn"
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  if (isMobileSearchOpen) {
                    setIsMobileSearchOpen(false);
                  } else {
                    setIsMobileSearchOpen(true);
                  }
                }}
                className={`p-2.5 rounded-full border transition-all cursor-pointer flex items-center justify-center select-none touch-manipulation ${
                  isMobileSearchOpen 
                    ? 'bg-[#6b705c] text-white border-[#6b705c] shadow-3xs' 
                    : 'bg-[#fdfbf7] hover:bg-[#f5f5f0] text-[#6b705c] border-[#e5e1d8]'
                }`}
                title="Arama Yap"
              >
                <Search className="w-4 h-4" />
              </motion.button>

              {/* Notifications Center */}
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

              {/* BURGER MENU BUTTON (🍔 / Menu) */}
              <motion.button
                id="burger-menu-toggle-btn"
                whileTap={{ scale: 0.92 }}
                onClick={() => setIsMenuOpen(true)}
                className="p-2 md:px-3.5 md:py-2 rounded-2xl bg-[#6b705c] hover:bg-[#585c4c] text-white transition-all cursor-pointer flex items-center gap-2 font-bold text-xs shadow-sm select-none touch-manipulation"
                title="Tüm Menüler ve Ayarlar"
              >
                <Menu className="w-4.5 h-4.5" />
                <span className="hidden sm:inline">Menü</span>
              </motion.button>
            </div>
          </div>

          {/* EXPANDABLE SEARCH INPUT BAR (WHEN SEARCH ICON IS CLICKED ON MOBILE/DESKTOP) */}
          <AnimatePresence>
            {isMobileSearchOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full relative overflow-visible"
              >
                <div className="flex items-center gap-2 bg-[#fdfbf7] border border-[#e5e1d8] rounded-2xl p-2 shadow-inner">
                  <Search className="w-4 h-4 text-[#6b705c] ml-2 shrink-0" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Danışan adı, tarih veya seans notu yazıp Enter'a basın..."
                    value={headerSearchQuery}
                    onChange={(e) => setHeaderSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && headerSearchQuery.trim()) {
                        setSearchTabQuery(headerSearchQuery);
                        setActiveTab('search');
                        setHeaderSearchQuery('');
                        setIsMobileSearchOpen(false);
                      }
                    }}
                    className="w-full bg-transparent text-xs font-medium focus:outline-none text-slate-800 placeholder:text-slate-400"
                  />
                  {headerSearchQuery && (
                    <button
                      onClick={() => setHeaderSearchQuery('')}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (headerSearchQuery.trim()) {
                        setSearchTabQuery(headerSearchQuery);
                        setActiveTab('search');
                        setHeaderSearchQuery('');
                      }
                      setIsMobileSearchOpen(false);
                    }}
                    className="px-3 py-1 bg-[#6b705c] text-white rounded-xl text-xs font-bold hover:bg-[#585c4c] select-none touch-manipulation"
                  >
                    Ara
                  </motion.button>
                </div>

                {/* Mobile Search Overlay Results */}
                {headerSearchQuery.trim() && (
                  <div className="absolute top-full mt-2 left-0 right-0 max-h-[280px] overflow-y-auto bg-white border border-[#e5e1d8] rounded-2xl shadow-xl z-50 p-2 space-y-1">
                    <div className="px-2 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      Arama Sonuçları ({searchedSessions.length})
                    </div>
                    {searchedSessions.length === 0 ? (
                      <div className="px-3 py-3 text-center text-xs text-slate-400">Sonuç bulunamadı</div>
                    ) : (
                      searchedSessions.slice(0, 5).map(session => (
                        <motion.div 
                          key={session.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedDate(session.date);
                            setActiveTab('agenda');
                            setHeaderSearchQuery('');
                            setIsMobileSearchOpen(false);
                          }}
                          className="p-2.5 hover:bg-[#fdfbf7] rounded-xl cursor-pointer transition-colors flex justify-between items-center text-xs touch-manipulation"
                        >
                          <div className="truncate pr-2">
                            <p className="font-bold text-slate-800 truncate">{formatClientName(session.clientName)}</p>
                            <p className="text-[10px] text-slate-400">{session.date} • {session.time}</p>
                          </div>
                          <span className="font-bold text-[#cb997e] shrink-0">{formatMoney(session.price)}</span>
                        </motion.div>
                      ))
                    )}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setSearchTabQuery(headerSearchQuery);
                        setActiveTab('search');
                        setHeaderSearchQuery('');
                        setIsMobileSearchOpen(false);
                      }}
                      className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold text-center mt-1 block touch-manipulation"
                    >
                      Tüm Sonuçları Gelişmiş Arama Ekranında Gör →
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* SECOND ROW: THREE-WAY PRIMARY SWITCH (MUHASEBE | GÜNLÜK AJANDA | BORÇ TAKİP) */}
          <div className="flex items-center justify-center pt-1 border-t border-[#f5f5f0]">
            <div className="inline-flex items-center bg-[#f5f5f0] p-1 rounded-full border border-[#e5e1d8] text-xs shadow-2xs w-full max-w-sm md:max-w-md justify-center">
              
              {/* Muhasebe Tab Switch Button */}
              <motion.button
                id="tab-stats-main"
                whileTap={{ scale: 0.95 }}
                onClick={() => handleTabClick('stats')}
                className={`relative flex-1 py-1.5 md:py-2 px-3 rounded-full font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none touch-manipulation ${
                  activeTab === 'stats' ? 'text-white z-10' : 'text-[#6b705c] hover:text-[#585c4c]'
                }`}
              >
                {activeTab === 'stats' && (
                  <motion.div
                    layoutId="mainHeaderSwitchIndicator"
                    className="absolute inset-0 bg-[#6b705c] rounded-full -z-10 shadow-sm"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Muhasebe</span>
              </motion.button>

              {/* Agenda Tab Switch Button */}
              <motion.button
                id="tab-agenda-main"
                whileTap={{ scale: 0.95 }}
                onClick={() => handleTabClick('agenda')}
                className={`relative flex-1 py-1.5 md:py-2 px-3 rounded-full font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none touch-manipulation ${
                  activeTab === 'agenda' ? 'text-white z-10' : 'text-[#6b705c] hover:text-[#585c4c]'
                }`}
              >
                {activeTab === 'agenda' && (
                  <motion.div
                    layoutId="mainHeaderSwitchIndicator"
                    className="absolute inset-0 bg-[#6b705c] rounded-full -z-10 shadow-sm"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Ajanda</span>
              </motion.button>

              {/* Debt Tracker Tab Switch Button */}
              <motion.button
                id="tab-debts"
                whileTap={{ scale: 0.95 }}
                onClick={() => handleTabClick('debts')}
                className={`relative flex-1 py-1.5 md:py-2 px-3 rounded-full font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none touch-manipulation ${
                  activeTab === 'debts' ? 'text-white z-10' : 'text-[#6b705c] hover:text-[#585c4c]'
                }`}
              >
                {activeTab === 'debts' && (
                  <motion.div
                    layoutId="mainHeaderSwitchIndicator"
                    className="absolute inset-0 bg-[#6b705c] rounded-full -z-10 shadow-sm"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
                <CreditCard className={`w-3.5 h-3.5 ${activeTab === 'debts' ? 'text-amber-300' : 'text-amber-600'}`} />
                <span>Borç Takip</span>
                {featuresDebtTrackerAllowed === false && <span className="text-[10px]" title="Sınırlandırıldı">🔒</span>}
              </motion.button>

            </div>
          </div>

        </div>
      </nav>

      {/* FULL-SCREEN / SPACIOUS BURGER MENU OVERLAY DRAWER WITH SWIPE TO CLOSE */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop Blur Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />

            {/* Drawer Content Card with Swipe-to-Close Touch Gesture */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0, right: 0.8 }}
              onDragEnd={(_, info) => {
                if (info.offset.x > 80 || info.velocity.x > 250) {
                  setIsMenuOpen(false);
                }
              }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-full max-w-md bg-[#fdfbf7] min-h-full h-full shadow-2xl flex flex-col justify-between overflow-y-auto z-10 p-6 md:p-8 space-y-8 touch-pan-y"
            >
              {/* TOP LEVEL CATEGORIES VIEW */}
              {!activeCategory ? (
                <div className="space-y-6">
                  {/* DRAWER TOP HEADER */}
                  <div className="flex items-center justify-between pb-4 border-b border-[#e5e1d8]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#6b705c] rounded-2xl flex items-center justify-center text-white font-serif text-2xl italic shadow-md">
                        P
                      </div>
                      <div>
                        <h2 className="text-xl font-serif italic text-[#6b705c]">PsyCalcu</h2>
                        <p className="text-[10px] text-slate-400 font-bold tracking-wider">ANA MENÜ & KATEGORİLER</p>
                      </div>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={handleCloseMenu}
                      className="w-9 h-9 rounded-full bg-white border border-[#e5e1d8] flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shadow-3xs touch-manipulation"
                      title="Menüyü Kapat"
                    >
                      <X className="w-5 h-5" />
                    </motion.button>
                  </div>

                  {/* USER PROFILE & CLOUD CARD */}
                  {user && (
                    <div className="p-3.5 bg-white rounded-2xl border border-[#e5e1d8] shadow-3xs space-y-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#6b705c]/10 text-[#6b705c] flex items-center justify-center font-bold text-sm border border-[#6b705c]/20 shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">{settings.therapistName || user.email}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{user.email}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase border shrink-0 ${
                          settings.userRole === 'owner' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}>
                          {settings.userRole === 'owner' ? 'Ofis Sahibi' : 'Kiralayan'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ÜST BAŞLIKLAR (MAIN CATEGORIES) */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-[10px] font-bold text-[#a5a58d] uppercase tracking-widest">
                        Üst Başlıklar (Kategoriler)
                      </h3>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Alt başlıklar için dokunun
                      </span>
                    </div>

                    <div className="space-y-2">
                      {/* 1. Danışanlar & Randevular */}
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveCategory('clients')}
                        className="w-full p-4 rounded-2xl bg-white border border-[#e5e1d8] hover:border-[#6b705c] transition-all flex items-center justify-between text-left group shadow-3xs cursor-pointer touch-manipulation"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-[#6b705c]/10 text-[#6b705c] group-hover:bg-[#6b705c] group-hover:text-white transition-colors flex items-center justify-center shrink-0 border border-[#6b705c]/20">
                            <Users className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-xs text-slate-800 group-hover:text-[#6b705c] transition-colors">
                                Danışanlar & Randevular
                              </p>
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#6b705c]/15 text-[#6b705c]">
                                4 Başlık
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                              Danışan listesi, ajanda, arama ve özel fiyatlar
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#6b705c] group-hover:translate-x-0.5 transition-all shrink-0" />
                      </motion.button>

                      {/* 2. Finans & Muhasebe */}
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveCategory('finance')}
                        className="w-full p-4 rounded-2xl bg-white border border-[#e5e1d8] hover:border-[#6b705c] transition-all flex items-center justify-between text-left group shadow-3xs cursor-pointer touch-manipulation"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0 border border-amber-200">
                            <TrendingUp className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-xs text-slate-800 group-hover:text-amber-800 transition-colors">
                                Finans & Muhasebe
                              </p>
                              {(unclosedMonthsCount || 0) > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                                  {unclosedMonthsCount} Bekleyen
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                              Borç & tahsilat, ciro, seans denetimi ve ay kilidi
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </motion.button>

                      {/* 3. Veri, Takvim & Yedekleme */}
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveCategory('data')}
                        className="w-full p-4 rounded-2xl bg-white border border-[#e5e1d8] hover:border-[#6b705c] transition-all flex items-center justify-between text-left group shadow-3xs cursor-pointer touch-manipulation"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0 border border-blue-200">
                            <Database className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-xs text-slate-800 group-hover:text-blue-800 transition-colors">
                                Veri, Takvim & Yedekleme
                              </p>
                              {(deletedSessionsCount || 0) > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  {deletedSessionsCount} Silinen
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                              iCloud/Google eşitleme, Excel dökümü, yedek noktaları
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </motion.button>

                      {/* 4. Ofis & Yönetim (Eğer Yetkili İse) */}
                      {(settings.userRole === 'owner' || user?.email === 'muhammedakifkayacan@gmail.com') && (
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setActiveCategory('management')}
                          className="w-full p-4 rounded-2xl bg-white border border-[#e5e1d8] hover:border-[#6b705c] transition-all flex items-center justify-between text-left group shadow-3xs cursor-pointer touch-manipulation"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0 border border-indigo-200">
                              <Building className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-800 group-hover:text-indigo-800 transition-colors">
                                Ofis & Yönetim
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                Oda randevuları ve yetkilendirme paneli
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </motion.button>
                      )}

                      {/* 5. Ayarlar & Tercihler */}
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveCategory('settings')}
                        className="w-full p-4 rounded-2xl bg-white border border-[#e5e1d8] hover:border-[#6b705c] transition-all flex items-center justify-between text-left group shadow-3xs cursor-pointer touch-manipulation"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 group-hover:bg-slate-700 group-hover:text-white transition-colors flex items-center justify-center shrink-0 border border-slate-200">
                            <SettingsIcon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-slate-800 group-hover:text-slate-900 transition-colors">
                              Ayarlar & Tercihler
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                              Sistem ayarları, gizlilik modları ve bilgi/SSS
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </motion.button>
                    </div>
                  </div>
                </div>
              ) : (
                /* SUB-CATEGORY DRILL-DOWN VIEW */
                <div className="space-y-6 animate-fade-in">
                  {/* Sub-menu Top Bar: Back to Main Menu & Close */}
                  <div className="flex items-center justify-between pb-4 border-b border-[#e5e1d8]">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveCategory(null)}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white border border-[#e5e1d8] hover:border-[#6b705c] text-xs font-bold text-slate-700 hover:text-[#6b705c] shadow-3xs cursor-pointer transition-all select-none"
                    >
                      <ArrowLeft className="w-4 h-4 text-[#6b705c]" />
                      <span>Üst Menüye Dön</span>
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={handleCloseMenu}
                      className="w-9 h-9 rounded-full bg-white border border-[#e5e1d8] flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shadow-3xs touch-manipulation"
                      title="Menüyü Kapat"
                    >
                      <X className="w-5 h-5" />
                    </motion.button>
                  </div>

                  {/* SUB-CATEGORY HEADER BANNER */}
                  {activeCategory === 'clients' && (
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#6b705c]/10 border border-[#6b705c]/20">
                      <div className="w-10 h-10 rounded-xl bg-[#6b705c] text-white flex items-center justify-center shadow-3xs shrink-0">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Danışanlar & Randevular</h3>
                        <p className="text-[11px] text-[#6b705c] font-medium">Seans kayıtları ve danışan yönetimi</p>
                      </div>
                    </div>
                  )}

                  {activeCategory === 'finance' && (
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                      <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-3xs shrink-0">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Finans & Muhasebe</h3>
                        <p className="text-[11px] text-amber-800 font-medium">Ciro, borçlar, seans mutabakatı ve ay kilidi</p>
                      </div>
                    </div>
                  )}

                  {activeCategory === 'data' && (
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-blue-50 border border-blue-200">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-3xs shrink-0">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Veri, Takvim & Yedekleme</h3>
                        <p className="text-[11px] text-blue-800 font-medium">Takvim senkronizasyonu ve veri güvenliği</p>
                      </div>
                    </div>
                  )}

                  {activeCategory === 'management' && (
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-3xs shrink-0">
                        <Building className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Ofis & Yönetim</h3>
                        <p className="text-[11px] text-indigo-800 font-medium">Oda planlama ve yönetici onayları</p>
                      </div>
                    </div>
                  )}

                  {activeCategory === 'settings' && (
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-100 border border-slate-200">
                      <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center shadow-3xs shrink-0">
                        <SettingsIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Ayarlar & Tercihler</h3>
                        <p className="text-[11px] text-slate-500 font-medium">Sistem parametreleri ve görünüm modları</p>
                      </div>
                    </div>
                  )}

                  {/* ONLY THE RELEVANT SUB-ITEMS */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-[#a5a58d] uppercase tracking-widest px-1">
                      Alt Başlıklar
                    </h4>

                    {/* SUB-ITEMS FOR DANIŞANLAR & RANDEVULAR */}
                    {activeCategory === 'clients' && (
                      <div className="bg-white rounded-2xl border border-[#e5e1d8] divide-y divide-[#f5f5f0] overflow-hidden shadow-3xs">
                        {/* 1. Danışan Listesi (NEW) */}
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleTabClick('clients')}
                          className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer touch-manipulation ${
                            activeTab === 'clients' ? 'bg-[#6b705c]/10 text-[#6b705c] font-bold' : 'hover:bg-[#fdfbf7]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#6b705c] flex items-center justify-center text-white">
                              <Users className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-slate-800">Danışan Listesi</p>
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#6b705c]/15 text-[#6b705c]">
                                  Yeni
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400">Tüm danışanlar ve son seans tarihleri</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </motion.button>

                        {/* 2. Günlük Ajanda */}
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleTabClick('agenda')}
                          className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer touch-manipulation ${
                            activeTab === 'agenda' ? 'bg-[#6b705c]/10 text-[#6b705c] font-bold' : 'hover:bg-[#fdfbf7]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#6b705c]/15 flex items-center justify-center text-[#6b705c]">
                              <CalendarIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">Günlük Ajanda</p>
                              <p className="text-[10px] text-slate-400">Seans takvimi ve randevu kartları</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </motion.button>

                        {/* 3. Gelişmiş Seans Arama */}
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleTabClick('search')}
                          className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer touch-manipulation ${
                            activeTab === 'search' ? 'bg-purple-50/70 text-purple-900 font-bold' : 'hover:bg-[#fdfbf7]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700">
                              <Search className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">Gelişmiş Seans Arama</p>
                              <p className="text-[10px] text-slate-400">Detaylı danışan ve tarih araması</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </motion.button>

                        {/* 4. Danışan Özel Fiyatları */}
                        {onOpenClientPricingModal && (
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              onOpenClientPricingModal('clients');
                              handleCloseMenu();
                            }}
                            className="w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer touch-manipulation hover:bg-[#fdfbf7]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                                <Sparkles className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800">Danışan Özel Fiyatları</p>
                                <p className="text-[10px] text-slate-500">Özel seans, bakıcı ve ofis ücretlerini yönet</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-emerald-600" />
                          </motion.button>
                        )}
                      </div>
                    )}

                    {/* SUB-ITEMS FOR FINANS & MUHASEBE */}
                    {activeCategory === 'finance' && (
                      <div className="bg-white rounded-2xl border border-[#e5e1d8] divide-y divide-[#f5f5f0] overflow-hidden shadow-3xs">
                        {/* 1. Borç & Tahsilat */}
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleTabClick('debts')}
                          className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer touch-manipulation ${
                            activeTab === 'debts' ? 'bg-[#6b705c]/10 text-[#6b705c] font-bold' : 'hover:bg-[#fdfbf7]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
                              <CreditCard className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-slate-800">Borç & Tahsilat Takibi</p>
                                {featuresDebtTrackerAllowed === false && <span className="text-[10px]" title="Sınırlandırıldı">🔒</span>}
                              </div>
                              <p className="text-[10px] text-slate-400">Ödenmemiş seanslar ve bakiye tahsilatı</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </motion.button>

                        {/* 2. Muhasebe & Finansal Rapor */}
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleTabClick('stats')}
                          className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer touch-manipulation ${
                            activeTab === 'stats' ? 'bg-[#6b705c]/10 text-[#6b705c] font-bold' : 'hover:bg-[#fdfbf7]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
                              <TrendingUp className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-slate-800">Muhasebe & Finansal Rapor</p>
                                {featuresAccountingAllowed === false && <span className="text-[10px]" title="Sınırlandırıldı">🔒</span>}
                              </div>
                              <p className="text-[10px] text-slate-400">Aylık/yıllık ciro, net kâr ve gider analizi</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </motion.button>

                        {/* 3. Seans Sağlama & Tablo */}
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleTabClick('audit')}
                          className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer touch-manipulation ${
                            activeTab === 'audit' ? 'bg-[#6b705c]/10 text-[#6b705c] font-bold' : 'hover:bg-[#fdfbf7]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#6b705c]/15 flex items-center justify-center text-[#6b705c]">
                              <FileSpreadsheet className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">Seans Sağlama & Tablo</p>
                              <p className="text-[10px] text-slate-400">Takvim karşılaştırma, 0 ₺ ve seans dışı denetimi</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </motion.button>

                        {/* 4. Ay Kapatma & Muhasebe Kilidi */}
                        {onOpenMonthClosingModal && (
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              handleCloseMenu();
                              onOpenMonthClosingModal();
                            }}
                            className="w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer touch-manipulation hover:bg-[#fdfbf7]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
                                <Lock className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-bold text-slate-800">Ay Kapatma & Muhasebe Kilidi</p>
                                  {(unclosedMonthsCount || 0) > 0 && (
                                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                                      {unclosedMonthsCount} Bekleyen
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400">Ay başı seans kontrolü ve takvim kilitleme</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                          </motion.button>
                        )}
                      </div>
                    )}

                    {/* SUB-ITEMS FOR VERI, TAKVIM & YEDEKLEME */}
                    {activeCategory === 'data' && (
                      <div className="bg-white rounded-2xl border border-[#e5e1d8] divide-y divide-[#f5f5f0] overflow-hidden shadow-3xs">
                        {/* 1. Takvim Entegrasyonu */}
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleTabClick('sync')}
                          className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer touch-manipulation ${
                            activeTab === 'sync' ? 'bg-emerald-50/70 text-emerald-900 font-bold' : 'hover:bg-[#fdfbf7]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
                              <RefreshCw className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">Takvim Entegrasyonu</p>
                              <p className="text-[10px] text-slate-400">iCloud & Google Takvim eşitleme</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </motion.button>

                        {/* 2. Yedek & E-Tablo Dökümü */}
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleTabClick('backup')}
                          className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer touch-manipulation ${
                            activeTab === 'backup' ? 'bg-blue-50/70 text-blue-900 font-bold' : 'hover:bg-[#fdfbf7]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
                              <Database className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">Yedek & E-Tablo Dökümü</p>
                              <p className="text-[10px] text-slate-400">Excel / JSON aktarma ve alma</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </motion.button>

                        {/* 3. Zaman Yolculuğu */}
                        {onOpenClientPricingModal && (
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              onOpenClientPricingModal('snapshots');
                              handleCloseMenu();
                            }}
                            className="w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer touch-manipulation hover:bg-[#fdfbf7]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                                <Clock className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800">Zaman Yolculuğu (Yedekler)</p>
                                <p className="text-[10px] text-slate-500">Kayıtlı yedek noktalarından seansları geri yükle</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-indigo-600" />
                          </motion.button>
                        )}

                        {/* 4. Geri Dönüşüm Kutusu */}
                        {onOpenTrashBin && (
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              onOpenTrashBin();
                              handleCloseMenu();
                            }}
                            className="w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer touch-manipulation hover:bg-[#fdfbf7]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-rose-600 flex items-center justify-center text-white">
                                <Trash2 className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-bold text-slate-800">Geri Dönüşüm Kutusu</p>
                                  {(deletedSessionsCount || 0) > 0 && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-200 text-rose-800">
                                      {deletedSessionsCount}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500">Silinen seansları 30 gün içinde geri yükle</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-rose-600" />
                          </motion.button>
                        )}
                      </div>
                    )}

                    {/* SUB-ITEMS FOR OFIS & YONETIM */}
                    {activeCategory === 'management' && (
                      <div className="bg-white rounded-2xl border border-[#e5e1d8] divide-y divide-[#f5f5f0] overflow-hidden shadow-3xs">
                        {settings.userRole === 'owner' && (
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleTabClick('rooms')}
                            className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer touch-manipulation ${
                              activeTab === 'rooms' ? 'bg-indigo-50/70 text-indigo-900 font-bold' : 'hover:bg-[#fdfbf7]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-700">
                                <Building className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800">Odalar & Doluluk Yönetimi 🛋️</p>
                                <p className="text-[10px] text-slate-400">Ofis odaları ve saatlik randevular</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                          </motion.button>
                        )}

                        {user?.email === 'muhammedakifkayacan@gmail.com' && (
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleTabClick('admin')}
                            className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer touch-manipulation ${
                              activeTab === 'admin' ? 'bg-rose-50/70 text-rose-900 font-bold' : 'hover:bg-[#fdfbf7]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-700">
                                <ShieldCheck className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800">Yönetici Onay Paneli</p>
                                <p className="text-[10px] text-slate-400">Kullanıcı üyelik yetkilendirme</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                          </motion.button>
                        )}
                      </div>
                    )}

                    {/* SUB-ITEMS FOR AYARLAR & TERCIHLER */}
                    {activeCategory === 'settings' && (
                      <div className="space-y-3">
                        <div className="bg-white rounded-2xl border border-[#e5e1d8] divide-y divide-[#f5f5f0] overflow-hidden shadow-3xs">
                          {/* Sistem Ayarları */}
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setIsSettingsOpen(true);
                              handleCloseMenu();
                            }}
                            className="w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer touch-manipulation hover:bg-[#fdfbf7]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-[#6b705c]/10 text-[#6b705c] flex items-center justify-center">
                                <SettingsIcon className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800">Sistem Ayarları</p>
                                <p className="text-[10px] text-slate-400">Kira, katsayı ve fiyatlar</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                          </motion.button>

                          {/* Bilgi & SSS */}
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setIsFaqOpen(true);
                              handleCloseMenu();
                            }}
                            className="w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer touch-manipulation hover:bg-[#fdfbf7]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-[#cb997e]/10 text-[#cb997e] flex items-center justify-center">
                                <HelpCircle className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800">Bilgi & SSS (?)</p>
                                <p className="text-[10px] text-slate-400">Kullanım rehberi ve sorular</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                          </motion.button>
                        </div>

                        {/* Quick Toggles */}
                        <div className="grid grid-cols-2 gap-2">
                          {/* Privacy Mode Toggle (Money) */}
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handlePrivacyToggle(true)}
                            className={`p-3 rounded-2xl border transition-all text-left space-y-1 cursor-pointer shadow-3xs touch-manipulation ${
                              isPrivacyMode ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-white border-[#e5e1d8]'
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              isPrivacyMode ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </div>
                            <p className="font-bold text-xs text-slate-800">Para Gizliliği</p>
                            <p className="text-[9px] text-slate-500 font-medium">
                              {isPrivacyMode ? '👁️‍🗨️ Gizli' : '👁️ Açık'}
                            </p>
                          </motion.button>

                          {/* Hide Client Names Toggle */}
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleHideClientNamesToggle(true)}
                            className={`p-3 rounded-2xl border transition-all text-left space-y-1 cursor-pointer shadow-3xs touch-manipulation ${
                              isHideClientNames ? 'bg-indigo-50 border-indigo-300 text-indigo-900' : 'bg-white border-[#e5e1d8]'
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              isHideClientNames ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {isHideClientNames ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </div>
                            <p className="font-bold text-xs text-slate-800">İsim Gizliliği</p>
                            <p className="text-[9px] text-slate-500 font-medium">
                              {isHideClientNames ? '👤 Gizli (E***)' : '👤 Açık'}
                            </p>
                          </motion.button>

                          {/* Toggle Explanations */}
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              toggleShowExplanations();
                              handleCloseMenu();
                            }}
                            className={`p-3 rounded-2xl border transition-all text-left space-y-1 cursor-pointer shadow-3xs touch-manipulation ${
                              showExplanations ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-white border-[#e5e1d8]'
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              showExplanations ? 'bg-[#6b705c] text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              <Lightbulb className="w-4 h-4" />
                            </div>
                            <p className="font-bold text-xs text-slate-800">Rehber İpuçları</p>
                            <p className="text-[9px] text-slate-500 font-medium">
                              {showExplanations ? '💡 Açık' : '💡 Kapalı'}
                            </p>
                          </motion.button>

                          {/* Toggle Calendar Notes */}
                          {toggleShowNotes && (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                toggleShowNotes();
                                handleCloseMenu();
                              }}
                              className={`p-3 rounded-2xl border transition-all text-left space-y-1 cursor-pointer shadow-3xs touch-manipulation ${
                                showNotes ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-white border-[#e5e1d8]'
                              }`}
                            >
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                showNotes ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                              }`}>
                                <FileText className="w-4 h-4" />
                              </div>
                              <p className="font-bold text-xs text-slate-800">Seans Notları</p>
                              <p className="text-[9px] text-slate-500 font-medium">
                                {showNotes ? '📝 Gösteriliyor' : '📝 Gizli'}
                              </p>
                            </motion.button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* DRAWER FOOTER: LOGOUT BUTTON */}
              {user && (
                <div className="pt-4 border-t border-[#e5e1d8] space-y-3">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      handleCloseMenu();
                      handleLogout();
                    }}
                    className="w-full py-3.5 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-2xl text-rose-700 hover:text-rose-900 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-3xs touch-manipulation"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Güvenli Çıkış Yap</span>
                  </motion.button>
                  
                  <p className="text-center text-[10px] text-slate-400 font-medium">
                    PsyCalcu • Terapistler için Sadeleştirilmiş Sistem
                  </p>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
