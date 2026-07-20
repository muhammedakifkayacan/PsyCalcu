import React from 'react';
import { 
  Search, 
  X, 
  ChevronLeft, 
  Check, 
  RefreshCw, 
  Lightbulb, 
  HelpCircle, 
  Settings as SettingsIcon, 
  LogOut 
} from 'lucide-react';
import { motion } from 'motion/react';
import { NotificationCenter } from './NotificationCenter';
import { AppNotification, AppSettings, Session, SessionType } from '../types';

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
  return (
    <nav className={`sticky top-0 z-40 flex flex-col lg:flex-row items-center justify-between px-6 md:px-8 border-b border-[#e5e1d8] bg-white transition-all duration-300 ${
      isHeaderCollapsed ? 'gap-0 py-2 shadow-xs' : 'gap-4 py-4 shadow-none'
    }`}>
      {!isMobile && (
        /* DESKTOP HEADER VIEW */
        <div className="hidden lg:flex lg:flex-col w-full gap-4">
          {/* Top Row: Brand, Search, and Action Status/Buttons */}
          <div className="flex items-center justify-between w-full gap-4">
            {/* Brand Logo & Name */}
            <div 
              onClick={() => setActiveTab('agenda')}
              className="flex items-center gap-3 shrink-0 cursor-pointer hover:opacity-85 select-none transition-all"
              title="Ana Sayfaya Git (Ajanda)"
            >
              <div className="w-10 h-10 bg-[#6b705c] rounded-xl flex items-center justify-center text-white font-serif text-2xl italic shadow-md">P</div>
              <div>
                <h1 className="text-xl font-serif italic text-[#6b705c] tracking-tight leading-none">PsyCalcu</h1>
                <p className="text-[10px] text-slate-400 font-semibold tracking-wider mt-1">PSİKOLOG SEANS & BÜTÇE AJANDASI</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className={`relative w-full max-w-xs xl:max-w-sm z-50 transition-all duration-300 lg:h-auto lg:opacity-100 lg:visible lg:scale-100 lg:pointer-events-auto ${
              isHeaderCollapsed 
                ? 'lg:h-0 lg:opacity-0 lg:overflow-hidden lg:pointer-events-none lg:scale-95' 
                : 'lg:h-auto lg:opacity-100 lg:scale-100'
            }`}>
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

            {/* Action Buttons & Cloud Status */}
            <div className={`flex items-center gap-3 shrink-0 transition-all duration-300 lg:h-auto lg:opacity-100 lg:visible lg:scale-100 lg:pointer-events-auto ${
              isHeaderCollapsed 
                ? 'lg:h-0 lg:opacity-0 lg:overflow-hidden lg:pointer-events-none lg:scale-95' 
                : 'lg:h-auto lg:opacity-100 lg:scale-100'
            }`}>
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
                      <span className="font-semibold">Bulut Senkronizasyonu...</span>
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
              
              <div className="text-right hidden xl:block">
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
          </div>

          {/* Bottom Row: Navigation Tabs */}
          <div className="flex items-center justify-center w-full border-t border-slate-100 pt-3">
            <div className="flex items-center bg-[#f5f5f0] p-1 rounded-full border border-[#e5e1d8] text-xs max-w-full overflow-x-auto scrollbar-none gap-0.5">
              <button
                id="tab-agenda"
                onClick={() => setActiveTab('agenda')}
                className={`relative px-4 py-1.5 rounded-full font-semibold transition-all cursor-pointer shrink-0 ${
                  activeTab === 'agenda' ? 'text-white z-10' : 'text-[#6b705c] hover:text-[#585c4c]'
                }`}
              >
                {activeTab === 'agenda' && (
                  <motion.div
                    layoutId="desktopActiveTabIndicator"
                    className="absolute inset-0 bg-[#6b705c] rounded-full -z-10 shadow-3xs"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                Günlük Ajanda
              </button>
              <button
                id="tab-stats"
                onClick={() => setActiveTab('stats')}
                className={`relative px-4 py-1.5 rounded-full font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                  activeTab === 'stats' ? 'text-white z-10' : 'text-[#6b705c] hover:text-[#585c4c]'
                }`}
              >
                {activeTab === 'stats' && (
                  <motion.div
                    layoutId="desktopActiveTabIndicator"
                    className="absolute inset-0 bg-[#6b705c] rounded-full -z-10 shadow-3xs"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                Muhasebe Raporu {featuresAccountingAllowed === false && <span className="text-[10px]" title="Sınırlandırıldı">🔒</span>}
              </button>
              <button
                id="tab-debts"
                onClick={() => setActiveTab('debts')}
                className={`relative px-4 py-1.5 rounded-full font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                  activeTab === 'debts' ? 'text-white z-10' : 'text-[#6b705c] hover:text-[#585c4c]'
                }`}
              >
                {activeTab === 'debts' && (
                  <motion.div
                    layoutId="desktopActiveTabIndicator"
                    className="absolute inset-0 bg-[#6b705c] rounded-full -z-10 shadow-3xs"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                Borç Takip {featuresDebtTrackerAllowed === false && <span className="text-[10px]" title="Sınırlandırıldı">🔒</span>}
              </button>
              <button
                id="tab-sync"
                onClick={() => setActiveTab('sync')}
                className={`relative px-4 py-1.5 rounded-full font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                  activeTab === 'sync' ? 'text-white z-10' : 'text-[#6b705c] hover:text-[#585c4c]'
                }`}
              >
                {activeTab === 'sync' && (
                  <motion.div
                    layoutId="desktopActiveTabIndicator"
                    className="absolute inset-0 bg-[#6b705c] rounded-full -z-10 shadow-3xs"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                Takvim Entegrasyonu {featuresCalendarAllowed === false && <span className="text-[10px]" title="Sınırlandırıldı">🔒</span>}
              </button>
              <button
                id="tab-backup"
                onClick={() => setActiveTab('backup')}
                className={`relative px-4 py-1.5 rounded-full font-semibold transition-all cursor-pointer shrink-0 ${
                  activeTab === 'backup' ? 'text-white z-10' : 'text-[#6b705c] hover:text-[#585c4c]'
                }`}
              >
                {activeTab === 'backup' && (
                  <motion.div
                    layoutId="desktopActiveTabIndicator"
                    className="absolute inset-0 bg-[#6b705c] rounded-full -z-10 shadow-3xs"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                Yedek & E-Tablo
              </button>
              {settings.userRole === 'owner' && (
                <button
                  id="tab-rooms"
                  onClick={() => setActiveTab('rooms')}
                  className={`relative px-4 py-1.5 rounded-full font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                    activeTab === 'rooms' ? 'text-white z-10' : 'text-[#6b705c] hover:text-[#585c4c]'
                  }`}
                >
                  {activeTab === 'rooms' && (
                    <motion.div
                      layoutId="desktopActiveTabIndicator"
                      className="absolute inset-0 bg-[#6b705c] rounded-full -z-10 shadow-3xs"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  Odalar & Doluluk 🛋️
                </button>
              )}
              {user?.email === 'muhammedakifkayacan@gmail.com' && (
                <button
                  id="tab-admin"
                  onClick={() => setActiveTab('admin')}
                  className={`relative px-4 py-1.5 rounded-full font-semibold transition-all cursor-pointer shrink-0 ${
                    activeTab === 'admin' ? 'text-white z-10' : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {activeTab === 'admin' && (
                    <motion.div
                      layoutId="desktopActiveTabIndicator"
                      className="absolute inset-0 bg-[#cb997e] rounded-full -z-10 shadow-3xs"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  Yönetici Paneli
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isMobile && (
        /* MOBILE HEADER VIEW */
        <div className="flex flex-col w-full gap-2 lg:hidden">
          {isMobileSearchOpen ? (
            /* Search Mode Row */
            <div className="flex items-center gap-2 w-full h-10 px-1 animate-fade-in">
              <button
                type="button"
                onClick={() => {
                  setIsMobileSearchOpen(false);
                  setHeaderSearchQuery('');
                }}
                className="p-1.5 rounded-xl hover:bg-[#f5f5f0] text-[#6b705c] transition-colors cursor-pointer"
                title="Aramadan Çık"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#6b705c]/60">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Danışan, seans veya not ara..."
                  value={headerSearchQuery}
                  onChange={(e) => setHeaderSearchQuery(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && headerSearchQuery.trim()) {
                      setSearchTabQuery(headerSearchQuery);
                      setActiveTab('search');
                      setHeaderSearchQuery('');
                      setIsMobileSearchOpen(false);
                    }
                  }}
                  className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-full focus:outline-none focus:border-[#6b705c] focus:ring-1 focus:ring-[#6b705c]/20 transition-all font-medium placeholder:text-slate-400"
                />
                {headerSearchQuery && (
                  <button
                    onClick={() => setHeaderSearchQuery('')}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Standard Mode Row */
            <div className="flex items-center justify-between w-full h-10">
              {/* Logo & Brand */}
              <div 
                onClick={() => setActiveTab('agenda')}
                className="flex items-center gap-2 cursor-pointer hover:opacity-85 select-none transition-all"
                title="Ana Sayfaya Git (Ajanda)"
              >
                <div className="w-8 h-8 bg-[#6b705c] rounded-lg flex items-center justify-center text-white font-serif text-lg italic shadow-xs">P</div>
                <div>
                  <h1 className="text-sm font-serif italic text-[#6b705c] tracking-tight leading-none">PsyCalcu</h1>
                  <span className="text-[8px] text-slate-400 font-bold tracking-wider block mt-0.5">SEANS & BÜTÇE</span>
                </div>
                
                {/* Cloud Sync Status Circle / Dot next to title */}
                {user && (
                  <div className="ml-1 animate-fade-in" title={
                    isQuotaExceeded ? 'Kota Doldu (Yerel Aktif)' :
                    isAuthSyncing ? 'Bulut Senkronizasyonu Sürüyor...' :
                    isCloudSaving ? 'Buluta Kaydediliyor...' : 'Bulut Eşleşti'
                  }>
                    <span className="relative flex h-2 w-2">
                      {isQuotaExceeded ? (
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      ) : (isAuthSyncing || isCloudSaving) ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </>
                      ) : (
                        <>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Utility Buttons */}
              <div className="flex items-center gap-1.5">
                {/* Search Toggle button */}
                <button
                  type="button"
                  onClick={() => setIsMobileSearchOpen(true)}
                  className="w-8 h-8 rounded-full border border-[#e5e1d8] bg-[#fdfbf7] flex items-center justify-center text-[#6b705c] hover:bg-[#f5f5f0] transition-all cursor-pointer"
                  title="Arama"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>

                {/* Notifications Bell */}
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

                {/* Lightbulb (explanations) */}
                <button
                  id="toggle-explanations-btn-mobile"
                  onClick={toggleShowExplanations}
                  className={`w-8 h-8 rounded-full border border-[#e5e1d8] flex items-center justify-center transition-all cursor-pointer ${
                    showExplanations 
                      ? 'bg-[#6b705c] text-white' 
                      : 'bg-[#fdfbf7] text-slate-500 hover:bg-[#f5f5f0]'
                  }`}
                  title={showExplanations ? "Yardımcı Açıklamaları Gizle" : "Yardımcı Açıklamaları Göster"}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                </button>

                {/* Settings Gear */}
                <button
                  id="settings-btn-mobile"
                  onClick={() => setIsSettingsOpen(true)}
                  className="w-8 h-8 rounded-full border border-[#e5e1d8] bg-[#fdfbf7] flex items-center justify-center text-[#6b705c] hover:bg-[#f5f5f0] transition-all cursor-pointer"
                  title="Ayarlar"
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Search suggestions if search query exists */}
          {isMobileSearchOpen && headerSearchQuery.trim() && (
            <div className="absolute top-12 left-2 right-2 max-h-[300px] overflow-y-auto bg-white border border-[#e5e1d8] rounded-2xl shadow-xl z-50 p-2 space-y-1.5 animate-fade-in divide-y divide-slate-100">
              <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Seans Arama Sonuçları ({searchedSessions.length})
              </div>
              {searchedSessions.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-slate-400 font-medium space-y-2">
                  <div>Eşleşen seans bulunamadı.</div>
                </div>
              ) : (
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
                              setIsMobileSearchOpen(false);
                            }}
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg border border-slate-200 cursor-pointer transition-all"
                          >
                            Git
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Row 2: Navigation Tabs */}
          <div className={`flex items-center bg-[#f5f5f0] p-1 rounded-full border border-[#e5e1d8] text-xs max-w-full overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-all duration-300 ${
            isHeaderCollapsed 
              ? 'h-0 opacity-0 overflow-hidden border-0 p-0 pointer-events-none scale-95 mt-0' 
              : 'h-auto opacity-100 scale-100 mt-1'
          }`}>
            <button
              id="tab-agenda"
              onClick={() => setActiveTab('agenda')}
              className={`relative px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer shrink-0 ${
                activeTab === 'agenda' ? 'text-white z-10' : 'text-[#6b705c]'
              }`}
            >
              {activeTab === 'agenda' && (
                <motion.div
                  layoutId="mobileActiveTabIndicator"
                  className="absolute inset-0 bg-[#6b705c] rounded-full -z-10 shadow-3xs"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              Günlük Ajanda
            </button>
            <button
              id="tab-stats"
              onClick={() => setActiveTab('stats')}
              className={`relative px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                activeTab === 'stats' ? 'text-white z-10' : 'text-[#6b705c]'
              }`}
            >
              {activeTab === 'stats' && (
                <motion.div
                  layoutId="mobileActiveTabIndicator"
                  className="absolute inset-0 bg-[#6b705c] rounded-full -z-10 shadow-3xs"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              Muhasebe Raporu {featuresAccountingAllowed === false && <span className="text-[10px]" title="Sınırlandırıldı">🔒</span>}
            </button>
            <button
              id="tab-debts"
              onClick={() => setActiveTab('debts')}
              className={`relative px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                activeTab === 'debts' ? 'text-white z-10' : 'text-[#6b705c]'
              }`}
            >
              {activeTab === 'debts' && (
                <motion.div
                  layoutId="mobileActiveTabIndicator"
                  className="absolute inset-0 bg-[#6b705c] rounded-full -z-10 shadow-3xs"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              Borç Takip {featuresDebtTrackerAllowed === false && <span className="text-[10px]" title="Sınırlandırıldı">🔒</span>}
            </button>
            <button
              id="tab-sync"
              onClick={() => setActiveTab('sync')}
              className={`relative px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                activeTab === 'sync' ? 'text-white z-10' : 'text-[#6b705c]'
              }`}
            >
              {activeTab === 'sync' && (
                <motion.div
                  layoutId="mobileActiveTabIndicator"
                  className="absolute inset-0 bg-[#6b705c] rounded-full -z-10 shadow-3xs"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              Takvim Entegrasyonu {featuresCalendarAllowed === false && <span className="text-[10px]" title="Sınırlandırıldı">🔒</span>}
            </button>
            <button
              id="tab-backup"
              onClick={() => setActiveTab('backup')}
              className={`relative px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer shrink-0 ${
                activeTab === 'backup' ? 'text-white z-10' : 'text-[#6b705c]'
              }`}
            >
              {activeTab === 'backup' && (
                <motion.div
                  layoutId="mobileActiveTabIndicator"
                  className="absolute inset-0 bg-[#6b705c] rounded-full -z-10 shadow-3xs"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              Yedek & E-Tablo
            </button>
            {settings.userRole === 'owner' && (
              <button
                id="tab-rooms"
                onClick={() => setActiveTab('rooms')}
                className={`relative px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                  activeTab === 'rooms' ? 'text-white z-10' : 'text-[#6b705c]'
                }`}
              >
                {activeTab === 'rooms' && (
                  <motion.div
                    layoutId="mobileActiveTabIndicator"
                    className="absolute inset-0 bg-[#6b705c] rounded-full -z-10 shadow-3xs"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                Odalar & Doluluk 🛋️
              </button>
            )}
            {user?.email === 'muhammedakifkayacan@gmail.com' && (
              <button
                id="tab-admin"
                onClick={() => setActiveTab('admin')}
                className={`relative px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer shrink-0 ${
                  activeTab === 'admin' ? 'text-white z-10' : 'text-slate-600'
                }`}
              >
                {activeTab === 'admin' && (
                  <motion.div
                    layoutId="mobileActiveTabIndicator"
                    className="absolute inset-0 bg-[#cb997e] rounded-full -z-10 shadow-3xs"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                Yönetici Paneli
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
