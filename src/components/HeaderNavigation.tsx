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
  Bell,
  Sparkles,
  ChevronRight,
  User,
  SlidersHorizontal
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
  setIsFaqOpen: (val: boolean) => void;
  setIsSettingsOpen: (val: boolean) => void;
  handleLogout: () => void;
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
  setIsFaqOpen,
  setIsSettingsOpen,
  handleLogout
}) => {
  const { isPrivacyMode, togglePrivacyMode, formatMoney } = usePrivacy();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handlePrivacyToggle = () => {
    togglePrivacyMode();
    if (!isPrivacyMode) {
      showToast('Gizlilik modu açıldı 👁️‍🗨️ (Tüm tutarlar gizlendi)', 'info');
    } else {
      showToast('Gizlilik modu kapatıldı 👁️ (Tutarlar gösteriliyor)', 'info');
    }
  };

  const handleTabClick = (tabName: string) => {
    setActiveTab(tabName);
    setIsMenuOpen(false);
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
                <div className="ml-1 flex items-center gap-1.5" title={
                  isQuotaExceeded ? 'Kota Doldu (Yerel Depolama Aktif)' :
                  isAuthSyncing ? 'Bulut Senkronizasyonu Sürüyor...' :
                  isCloudSaving ? 'Buluta Kaydediliyor...' : 'Bulut Verisi Eşleşti'
                }>
                  <span className="relative flex h-2.5 w-2.5">
                    {isQuotaExceeded ? (
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    ) : (isAuthSyncing || isCloudSaving) ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                      </>
                    ) : (
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    )}
                  </span>
                </div>
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
                          <p className="font-bold text-slate-700 truncate">{session.clientName}</p>
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
                            <p className="font-bold text-slate-800 truncate">{session.clientName}</p>
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

          {/* SECOND ROW: TWO-WAY PRIMARY SWITCH (GÜNLÜK AJANDA | MUHASEBE) */}
          <div className="flex items-center justify-center pt-1 border-t border-[#f5f5f0]">
            <div className="inline-flex items-center bg-[#f5f5f0] p-1 rounded-full border border-[#e5e1d8] text-xs shadow-2xs w-full max-w-xs md:max-w-sm justify-center">
              
              {/* Agenda Tab Switch Button */}
              <motion.button
                id="tab-agenda-main"
                whileTap={{ scale: 0.95 }}
                onClick={() => handleTabClick('agenda')}
                className={`relative flex-1 py-1.5 md:py-2 px-4 rounded-full font-bold transition-all cursor-pointer flex items-center justify-center gap-2 select-none touch-manipulation ${
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
                <span>Günlük Ajanda</span>
              </motion.button>

              {/* Stats / Accounting Tab Switch Button */}
              <motion.button
                id="tab-stats-main"
                whileTap={{ scale: 0.95 }}
                onClick={() => handleTabClick('stats')}
                className={`relative flex-1 py-1.5 md:py-2 px-4 rounded-full font-bold transition-all cursor-pointer flex items-center justify-center gap-2 select-none touch-manipulation ${
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
                <TrendingUp className="w-3.5 h-3.5 text-amber-300" />
                <span>Muhasebe</span>
                {featuresAccountingAllowed === false && <span className="text-[10px]" title="Sınırlandırıldı">🔒</span>}
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
              {/* DRAWER TOP HEADER */}
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-[#e5e1d8]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#6b705c] rounded-2xl flex items-center justify-center text-white font-serif text-2xl italic shadow-md">
                      P
                    </div>
                    <div>
                      <h2 className="text-xl font-serif italic text-[#6b705c]">PsyCalcu</h2>
                      <p className="text-[10px] text-slate-400 font-bold tracking-wider">TÜM MENÜLER & SİSTEM • (Kapatmak için sağa kaydırın 👉)</p>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => setIsMenuOpen(false)}
                    className="w-9 h-9 rounded-full bg-white border border-[#e5e1d8] flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shadow-3xs touch-manipulation"
                    title="Menüyü Kapat"
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>

                {/* USER PROFILE & CLOUD CARD */}
                {user && (
                  <div className="p-4 bg-white rounded-2xl border border-[#e5e1d8] shadow-3xs space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#6b705c]/10 text-[#6b705c] flex items-center justify-center font-bold text-sm border border-[#6b705c]/20">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{settings.therapistName || user.email}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{user.email}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase border ${
                        settings.userRole === 'owner' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}>
                        {settings.userRole === 'owner' ? 'Ofis Sahibi' : 'Kiralayan'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Bulut Veri Durumu:</span>
                      <span className="font-bold text-emerald-700 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Bulut Eşleşti
                      </span>
                    </div>
                  </div>
                )}

                {/* PRIMARY SWITCH (Quick Jump) */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-[#a5a58d] uppercase tracking-widest px-1">Ana Çalışma Alanı</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTabClick('agenda')}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer touch-manipulation select-none ${
                        activeTab === 'agenda'
                          ? 'bg-[#6b705c] text-white border-[#6b705c] shadow-sm'
                          : 'bg-white text-slate-700 border-[#e5e1d8] hover:border-[#6b705c]/40'
                      }`}
                    >
                      <CalendarIcon className="w-5 h-5" />
                      <div>
                        <p className="font-bold text-xs">Günlük Ajanda</p>
                        <p className={`text-[9px] mt-0.5 ${activeTab === 'agenda' ? 'text-white/80' : 'text-slate-400'}`}>Seans Takvimi</p>
                      </div>
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTabClick('stats')}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer touch-manipulation select-none ${
                        activeTab === 'stats'
                          ? 'bg-[#6b705c] text-white border-[#6b705c] shadow-sm'
                          : 'bg-white text-slate-700 border-[#e5e1d8] hover:border-[#6b705c]/40'
                      }`}
                    >
                      <TrendingUp className="w-5 h-5" />
                      <div>
                        <p className="font-bold text-xs">Muhasebe & Gider</p>
                        <p className={`text-[9px] mt-0.5 ${activeTab === 'stats' ? 'text-white/80' : 'text-slate-400'}`}>Finansal Rapor</p>
                      </div>
                    </motion.button>
                  </div>
                </div>

                {/* OTHER NAVIGATION PAGES */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-[#a5a58d] uppercase tracking-widest px-1">Diğer Menüler & Modüller</h3>
                  <div className="bg-white rounded-2xl border border-[#e5e1d8] divide-y divide-[#f5f5f0] overflow-hidden shadow-3xs">
                    
                    {/* Debt Tracker */}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleTabClick('debts')}
                      className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer touch-manipulation ${
                        activeTab === 'debts' ? 'bg-amber-50/70 text-amber-900 font-bold' : 'hover:bg-[#fdfbf7]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">Borç & Tahsilat Takibi</p>
                          <p className="text-[10px] text-slate-400">Danışan ödenmemiş seans bakiyeleri</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </motion.button>

                    {/* Calendar Sync */}
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

                    {/* Backup & Spreadsheet */}
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

                    {/* Room Management (Owner only) */}
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

                    {/* Admin Panel (Superadmin) */}
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

                    {/* Advanced Search */}
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
                  </div>
                </div>

                {/* QUICK TOOLS & SYSTEM ACTIONS */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-[#a5a58d] uppercase tracking-widest px-1">Hızlı Araçlar & Kontroller</h3>
                  <div className="grid grid-cols-2 gap-2">
                    
                    {/* Settings Modal */}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setIsSettingsOpen(true);
                        setIsMenuOpen(false);
                      }}
                      className="p-3.5 rounded-2xl bg-white border border-[#e5e1d8] hover:border-[#6b705c] transition-all text-left space-y-1.5 cursor-pointer shadow-3xs touch-manipulation"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#6b705c]/10 text-[#6b705c] flex items-center justify-center">
                        <SettingsIcon className="w-4 h-4" />
                      </div>
                      <p className="font-bold text-xs text-slate-800">Sistem Ayarları</p>
                      <p className="text-[9px] text-slate-400">Kira, katsayı ve fiyatlar</p>
                    </motion.button>

                    {/* FAQ / Info Modal */}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setIsFaqOpen(true);
                        setIsMenuOpen(false);
                      }}
                      className="p-3.5 rounded-2xl bg-white border border-[#e5e1d8] hover:border-[#cb997e] transition-all text-left space-y-1.5 cursor-pointer shadow-3xs touch-manipulation"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#cb997e]/10 text-[#cb997e] flex items-center justify-center">
                        <HelpCircle className="w-4 h-4" />
                      </div>
                      <p className="font-bold text-xs text-slate-800">Bilgi & SSS (?)</p>
                      <p className="text-[9px] text-slate-400">Kullanım rehberi ve sorular</p>
                    </motion.button>

                    {/* Privacy Mode Toggle */}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handlePrivacyToggle}
                      className={`p-3.5 rounded-2xl border transition-all text-left space-y-1.5 cursor-pointer shadow-3xs touch-manipulation ${
                        isPrivacyMode ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-white border-[#e5e1d8]'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isPrivacyMode ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </div>
                      <p className="font-bold text-xs text-slate-800">Gizlilik Modu</p>
                      <p className="text-[9px] text-slate-500 font-medium">
                        {isPrivacyMode ? '👁️‍🗨️ Paralar Gizli' : '👁️ Paralar Açık'}
                      </p>
                    </motion.button>

                    {/* Toggle Explanations */}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={toggleShowExplanations}
                      className={`p-3.5 rounded-2xl border transition-all text-left space-y-1.5 cursor-pointer shadow-3xs touch-manipulation ${
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
                        {showExplanations ? '💡 Açıklamalar Açık' : '💡 Açıklamalar Kapalı'}
                      </p>
                    </motion.button>

                  </div>
                </div>

              </div>

              {/* DRAWER FOOTER: LOGOUT BUTTON */}
              {user && (
                <div className="pt-4 border-t border-[#e5e1d8] space-y-3">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full py-3.5 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-2xl text-rose-700 hover:text-rose-900 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-3xs touch-manipulation"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Güvenli Çıkış Yap</span>
                  </motion.button>
                  
                  <p className="text-center text-[10px] text-slate-400 font-medium">
                    PsyCalcu v2.4 • Terapistler için Sevgiyle Tasarlandı
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
