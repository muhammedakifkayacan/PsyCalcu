import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft,
  Calendar, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Laptop, 
  MapPin, 
  Ban, 
  FileText, 
  ArrowUpDown, 
  Search, 
  ExternalLink, 
  Copy, 
  Check, 
  User, 
  TrendingUp, 
  Wallet,
  CalendarDays,
  CreditCard,
  Building,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Plus,
  Trash2,
  Edit3,
  Sparkles,
  Baby,
  Filter,
  SlidersHorizontal,
  X,
  RotateCcw
} from 'lucide-react';
import { Session, AppSettings, SessionType, getNormalizedClientName, areClientNamesEquivalent } from '../types';
import { usePrivacy } from '../context/PrivacyContext';

interface ClientDetailPageProps {
  clientName: string;
  sessions: Session[];
  settings: AppSettings;
  onBack: () => void;
  previousTabName?: string;
  onSaveSession: (session: Session) => void;
  onDeleteSession: (id: string) => void;
  onOpenEditModal: (session: Session) => void;
  onAddNewSession: (clientName: string) => void;
  onJumpToDate?: (date: string) => void;
  onMarkAllPaid?: (clientName: string) => void;
}

export const ClientDetailPage: React.FC<ClientDetailPageProps> = ({
  clientName,
  sessions,
  settings,
  onBack,
  previousTabName = 'Ajanda',
  onSaveSession,
  onDeleteSession,
  onOpenEditModal,
  onAddNewSession,
  onJumpToDate,
  onMarkAllPaid
}) => {
  const { formatMoney, formatClientName } = usePrivacy();

  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [typeFilter, setTypeFilter] = useState<'all' | 'online' | 'face-to-face' | 'cancelled'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid' | 'partial'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedText, setCopiedText] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (typeFilter !== 'all') count++;
    if (paymentFilter !== 'all') count++;
    if (sortOrder !== 'desc') count++;
    return count;
  }, [searchQuery, typeFilter, paymentFilter, sortOrder]);

  const resetFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setPaymentFilter('all');
    setSortOrder('desc');
  };

  // Normalize target client name
  const targetNormalized = useMemo(() => getNormalizedClientName(clientName).toLocaleLowerCase('tr-TR'), [clientName]);
  const displayTitle = useMemo(() => {
    const cleanNorm = getNormalizedClientName(clientName);
    if (cleanNorm) return cleanNorm;
    return clientName.replace(/[\s\u00A0]+/g, ' ').trim();
  }, [clientName]);

  // Extract all sessions for this specific client (both Online and Face-to-Face together)
  // Handles accidental double/multiple spaces, session numbers (e.g. "özlem tirün 2" vs "özlem  tirün    2")
  const clientSessions = useMemo(() => {
    if (!clientName) return [];
    return sessions.filter(s => {
      if (!s || !s.clientName) return false;
      return areClientNamesEquivalent(s.clientName, clientName);
    });
  }, [sessions, clientName]);

  // Statistics calculation
  const stats = useMemo(() => {
    let totalSessions = clientSessions.length;
    let completedCount = 0;
    let cancelledCount = 0;
    let onlineCount = 0;
    let faceToFaceCount = 0;
    let totalBilled = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    let totalBabysitterExpense = 0;
    let totalOfficeExpense = 0;

    clientSessions.forEach(s => {
      if (s.type === 'cancelled') {
        cancelledCount++;
        return;
      }
      if (s.type === 'non-session') return;

      completedCount++;
      if (s.type === 'online') onlineCount++;
      if (s.type === 'face-to-face') faceToFaceCount++;

      const price = Number(s.price) || 0;
      totalBilled += price;

      if (s.paymentStatus === 'paid') {
        totalPaid += price;
      } else if (s.paymentStatus === 'partial') {
        const paid = Number(s.paidAmount) || 0;
        totalPaid += paid;
        totalUnpaid += Math.max(0, price - paid);
      } else {
        totalUnpaid += price;
      }

      if (s.hasBabysitterFee) {
        totalBabysitterExpense += (s.babysitterFeeAmount || settings.defaultBabysitterFee || 250);
      }
      if (s.hasOfficeRentFee) {
        totalOfficeExpense += (s.officeRentFeeAmount || settings.defaultOfficeRentFee || 200);
      }
    });

    const sortedDates = [...clientSessions]
      .filter(s => !!s.date)
      .sort((a, b) => a.date.localeCompare(b.date));

    const firstDate = sortedDates[0]?.date;
    const lastDate = sortedDates[sortedDates.length - 1]?.date;

    return {
      totalSessions,
      completedCount,
      cancelledCount,
      onlineCount,
      faceToFaceCount,
      totalBilled,
      totalPaid,
      totalUnpaid,
      totalBabysitterExpense,
      totalOfficeExpense,
      firstDate,
      lastDate
    };
  }, [clientSessions, settings]);

  // Filtered & Sorted Sessions
  const displaySessions = useMemo(() => {
    return clientSessions
      .filter(s => {
        if (typeFilter !== 'all') {
          if (typeFilter === 'cancelled' && s.type !== 'cancelled') return false;
          if (typeFilter !== 'cancelled' && s.type !== typeFilter) return false;
        }

        if (paymentFilter !== 'all') {
          if (paymentFilter === 'paid' && s.paymentStatus !== 'paid') return false;
          if (paymentFilter === 'unpaid' && (s.paymentStatus === 'paid' || s.paymentStatus === 'partial')) return false;
          if (paymentFilter === 'partial' && s.paymentStatus !== 'partial') return false;
        }

        if (searchQuery.trim()) {
          const query = searchQuery.toLocaleLowerCase('tr-TR');
          const matchNotes = (s.notes || '').toLocaleLowerCase('tr-TR').includes(query);
          const matchDate = (s.date || '').includes(query);
          return matchNotes || matchDate;
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) {
          return sortOrder === 'desc' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
        }
        const timeA = a.time || '';
        const timeB = b.time || '';
        return sortOrder === 'desc' ? timeB.localeCompare(timeA) : timeA.localeCompare(timeB);
      });
  }, [clientSessions, typeFilter, paymentFilter, searchQuery, sortOrder]);

  // Copy Summary Handler
  const handleCopySummary = () => {
    const lines = [
      `📋 DANIŞAN SEANS GEÇMİŞİ: ${clientName}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Toplam Seans: ${stats.completedCount} (${stats.onlineCount} Online, ${stats.faceToFaceCount} Yüz Yüze)`,
      `Toplam Tutar: ₺${stats.totalBilled.toLocaleString('tr-TR')}`,
      `Tahsil Edilen: ₺${stats.totalPaid.toLocaleString('tr-TR')}`,
      `Kalan Bakiye: ₺${stats.totalUnpaid.toLocaleString('tr-TR')}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `SEANSLAR:`
    ];

    displaySessions.forEach(s => {
      const typeStr = s.type === 'online' ? '🌐 Online' : s.type === 'face-to-face' ? '🏢 Yüz Yüze' : '🚫 İptal';
      const statusStr = s.paymentStatus === 'paid' ? '✅ Ödendi' : s.paymentStatus === 'partial' ? `⚠️ Kısmi (₺${s.paidAmount})` : '⏳ Bekliyor';
      lines.push(`• ${s.date} ${s.time || ''} - ${typeStr} - ₺${s.price} [${statusStr}]`);
    });

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Direct Inline Updaters (User can change directly on the page without opening popups)
  const handleInlinePriceChange = (session: Session, newPrice: number) => {
    onSaveSession({
      ...session,
      price: newPrice
    });
  };

  const handleInlinePaymentToggle = (session: Session) => {
    const nextStatus = session.paymentStatus === 'paid' ? 'unpaid' : 'paid';
    onSaveSession({
      ...session,
      paymentStatus: nextStatus,
      paidAmount: nextStatus === 'paid' ? session.price : 0
    });
  };

  const handleInlineTypeChange = (session: Session, newType: SessionType) => {
    onSaveSession({
      ...session,
      type: newType,
      hasOfficeRentFee: newType === 'face-to-face' ? true : false
    });
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 pb-24 animate-in fade-in duration-200" id="client-detail-page">
      {/* Top Navigation & Action Header */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Back Button & Client Info */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-bold transition-all shadow-3xs cursor-pointer shrink-0 flex items-center gap-1.5"
            title={`${previousTabName} sayfasına geri dön`}
            id="client-detail-back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline text-xs">{previousTabName}</span>
          </button>

          <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 border border-emerald-600/20 text-emerald-800 flex items-center justify-center shrink-0 font-bold shadow-xs">
            <User className="w-6 h-6 text-emerald-700" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 truncate">
                {formatClientName(displayTitle)}
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200/60 shadow-3xs">
                {stats.totalSessions} Seans
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate flex items-center gap-2 mt-1">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {stats.firstDate ? `${new Date(stats.firstDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Tarih yok'} 
                {stats.lastDate && stats.firstDate !== stats.lastDate ? ` - ${new Date(stats.lastDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
              </span>
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => onAddNewSession(clientName)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            id="client-detail-add-session-btn"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Seans Ekle</span>
          </button>

          {stats.totalUnpaid > 0 && onMarkAllPaid && (
            <button
              type="button"
              onClick={() => onMarkAllPaid(clientName)}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Bu danışanın bekleyen tüm seanslarını ödendi yap"
              id="client-detail-mark-all-paid-btn"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Tüm Borcu Kapat</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopySummary}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer"
            title="Danışan Geçmişini Kopyala"
            id="client-detail-copy-summary-btn"
          >
            {copiedText ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Kopyalandı</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                <span>Özeti Kopyala</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick Summary & Stats Toggle Bar */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 text-sky-800 border border-sky-200/60 font-bold shadow-3xs">
            <Laptop className="w-4 h-4 text-sky-600" />
            <span>{stats.onlineCount} Online Seans</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-bold shadow-3xs">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>{stats.faceToFaceCount} Yüz Yüze Seans</span>
          </span>
          {stats.cancelledCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200/60 font-bold shadow-3xs">
              <Ban className="w-4 h-4 text-rose-600" />
              <span>{stats.cancelledCount} İptal</span>
            </span>
          )}
        </div>

        {/* Toggle Financial Stats */}
        <button
          type="button"
          onClick={() => setShowStats(prev => !prev)}
          className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer ${
            showStats 
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
              : 'bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100'
          }`}
          id="toggle-client-page-stats-btn"
        >
          <BarChart3 className="w-4 h-4 text-emerald-600" />
          <span>{showStats ? 'Toplam Finansal Özeti Gizle' : 'Toplam Fiyat & Finansal Özeti Gör'}</span>
          {showStats ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>
      </div>

      {/* Collapsible Detailed Metrics Bar (Default closed so user sees sessions immediately) */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs text-xs">
              {/* Completed Sessions */}
              <div className="bg-slate-50/60 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Tamamlanan Seans
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-extrabold text-slate-800">{stats.completedCount}</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    ({stats.onlineCount} Online, {stats.faceToFaceCount} Yüzyüze)
                  </span>
                </div>
              </div>

              {/* Total Revenue */}
              <div className="bg-slate-50/60 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-blue-600" /> Toplam Seans Tutarı
                </span>
                <div className="mt-1">
                  <span className="text-xl font-extrabold text-blue-900">
                    {formatMoney(stats.totalBilled)}
                  </span>
                </div>
              </div>

              {/* Paid Amount */}
              <div className="bg-slate-50/60 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                <span className="text-slate-500 font-medium flex items-center gap-1">
                  <Wallet className="w-4 h-4 text-emerald-600" /> Tahsil Edilen
                </span>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-emerald-700">
                    {formatMoney(stats.totalPaid)}
                  </span>
                  {stats.totalBilled > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      %{Math.round((stats.totalPaid / stats.totalBilled) * 100)}
                    </span>
                  )}
                </div>
              </div>

              {/* Unpaid Balance */}
              <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                stats.totalUnpaid > 0 
                  ? 'bg-rose-50/80 border-rose-200 text-rose-900' 
                  : 'bg-slate-50/60 border-slate-200/80'
              }`}>
                <span className={`font-medium flex items-center gap-1 ${stats.totalUnpaid > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                  <AlertCircle className={`w-4 h-4 ${stats.totalUnpaid > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
                  Kalan Borç / Bekleyen
                </span>
                <div className="mt-1">
                  <span className={`text-xl font-extrabold ${stats.totalUnpaid > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                    {formatMoney(stats.totalUnpaid)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sleek Minimalist Toolbar with Small Filter Button */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all">
        {/* Compact Header Bar */}
        <div className="p-3 sm:p-4 flex items-center justify-between gap-3">
          {/* Left: Session count */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-extrabold text-slate-800">
              Seans Kayıtları
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
              {displaySessions.length} {displaySessions.length === clientSessions.length ? 'seans' : `/ ${clientSessions.length}`}
            </span>
          </div>

          {/* Right: Actions & Small Filter Button */}
          <div className="flex items-center gap-2 shrink-0">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                title="Filtreleri Temizle"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Temizle</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsFilterOpen(prev => !prev)}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer border ${
                isFilterOpen || activeFilterCount > 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
              id="client-detail-toggle-filter-btn"
              title="Filtrele ve Ara"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700" />
              <span>Filtrele</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold flex items-center justify-center ml-0.5">
                  {activeFilterCount}
                </span>
              )}
              {isFilterOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Active Filter Chips (shown when panel is closed so user always has context) */}
        {!isFilterOpen && activeFilterCount > 0 && (
          <div className="px-3 pb-3 pt-0 flex items-center gap-1.5 flex-wrap border-t border-slate-100/80 pt-2.5">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Aktif filtreler:</span>
            {searchQuery.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[11px] font-semibold">
                <span>Ara: "{searchQuery}"</span>
                <button onClick={() => setSearchQuery('')} className="hover:text-rose-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {typeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-200/80 text-[11px] font-semibold">
                <span>{typeFilter === 'online' ? 'Online' : typeFilter === 'face-to-face' ? 'Yüz Yüze' : 'İptal'}</span>
                <button onClick={() => setTypeFilter('all')} className="hover:text-rose-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {paymentFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/80 text-[11px] font-semibold">
                <span>{paymentFilter === 'paid' ? 'Ödenenler' : paymentFilter === 'unpaid' ? 'Ödenmeyenler' : 'Kısmi'}</span>
                <button onClick={() => setPaymentFilter('all')} className="hover:text-rose-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {sortOrder !== 'desc' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold">
                <span>Eskiden Yeniye</span>
                <button onClick={() => setSortOrder('desc')} className="hover:text-rose-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Collapsible Filter Panel */}
        <AnimatePresence>
          {isFilterOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-slate-100 bg-slate-50/50 p-3 sm:p-4 space-y-3 overflow-hidden"
            >
              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tarih veya seans notlarında ara..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  id="client-detail-search-input"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {/* Type Filter */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Seans Türü</label>
                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value as any)}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                    id="client-detail-type-filter"
                  >
                    <option value="all">Tüm Türler (Online & Yüzyüze)</option>
                    <option value="online">🌐 Sadece Online</option>
                    <option value="face-to-face">🏢 Sadece Yüz Yüze</option>
                    <option value="cancelled">🚫 İptal Edilenler</option>
                  </select>
                </div>

                {/* Payment Filter */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ödeme Durumu</label>
                  <select
                    value={paymentFilter}
                    onChange={e => setPaymentFilter(e.target.value as any)}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                    id="client-detail-payment-filter"
                  >
                    <option value="all">Tüm Ödemeler</option>
                    <option value="paid">✅ Ödenenler</option>
                    <option value="unpaid">⏳ Ödenmeyenler</option>
                    <option value="partial">⚠️ Kısmi Ödenenler</option>
                  </select>
                </div>

                {/* Sort Order Toggle */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tarih Sıralaması</label>
                  <button
                    type="button"
                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold flex items-center justify-between transition-colors cursor-pointer"
                    id="client-detail-sort-toggle"
                  >
                    <span>{sortOrder === 'desc' ? 'Yeniden Eskiye' : 'Eskiden Yeniye'}</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                </div>
              </div>

              {/* Panel Footer */}
              <div className="flex items-center justify-between pt-1 text-xs">
                {activeFilterCount > 0 ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Filtreleri Sıfırla ({activeFilterCount})</span>
                  </button>
                ) : (
                  <span className="text-slate-400 text-[11px]">Kriterlerinize göre filtreleyin</span>
                )}

                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Kapat
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Session List */}
      <div className="space-y-3">
        {displaySessions.length === 0 ? (
          <div className="py-16 bg-white rounded-3xl border border-slate-200 text-center space-y-3 shadow-xs">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-base font-bold text-slate-700">Bu filtreye uygun seans kaydı bulunamadı.</p>
            <p className="text-xs text-slate-400">Arama kelimesini veya seçtiğiniz filtreleri sıfırlayabilirsiniz.</p>
          </div>
        ) : (
          displaySessions.map((session, index) => {
            const isCancelled = session.type === 'cancelled';
            const isPaid = session.paymentStatus === 'paid';
            const isPartial = session.paymentStatus === 'partial';
            const sessionDateObj = new Date(session.date);
            const formattedDate = sessionDateObj.toLocaleDateString('tr-TR', {
              weekday: 'short',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            });

            return (
              <div
                key={session.id || index}
                className={`bg-white rounded-2xl border transition-all p-4 shadow-3xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-emerald-300 ${
                  isCancelled ? 'opacity-70 bg-slate-50/80 border-slate-200' : 'border-slate-200/80'
                }`}
              >
                {/* Left: Type Icon + Date + Time + Badges */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                  {/* Type Selector Dropdown / Icon */}
                  <div className="relative group">
                    <button
                      type="button"
                      onClick={() => {
                        const nextType: SessionType = session.type === 'online' ? 'face-to-face' : (session.type === 'face-to-face' ? 'cancelled' : 'online');
                        handleInlineTypeChange(session, nextType);
                      }}
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-3xs cursor-pointer transition-transform active:scale-95 ${
                        isCancelled 
                          ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' 
                          : session.type === 'face-to-face' 
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' 
                            : 'bg-sky-100 text-sky-800 hover:bg-sky-200'
                      }`}
                      title="Seans Türünü Değiştir (Tıkla: Online ↔ Yüzyüze ↔ İptal)"
                    >
                      {isCancelled ? (
                        <Ban className="w-5 h-5" />
                      ) : session.type === 'face-to-face' ? (
                        <MapPin className="w-5 h-5" />
                      ) : (
                        <Laptop className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  <div className="min-w-0 space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm sm:text-base text-slate-900">
                        {formattedDate}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {session.time || '00:00'}
                      </span>
                      
                      {/* Session Type Badge with Direct Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          const nextType: SessionType = session.type === 'online' ? 'face-to-face' : (session.type === 'face-to-face' ? 'cancelled' : 'online');
                          handleInlineTypeChange(session, nextType);
                        }}
                        className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                          isCancelled 
                            ? 'bg-rose-100 text-rose-800 border-rose-200' 
                            : session.type === 'face-to-face' 
                              ? 'bg-amber-100 text-amber-900 border-amber-200' 
                              : 'bg-sky-100 text-sky-900 border-sky-200'
                        }`}
                        title="Tıkla: Seans türünü değiştir"
                      >
                        {isCancelled ? '🚫 İptal' : session.type === 'face-to-face' ? '🏢 Yüz Yüze' : '🌐 Online'}
                      </button>

                      {/* Extra Expenses Inline Toggles */}
                      <button
                        type="button"
                        onClick={() => {
                          onSaveSession({
                            ...session,
                            hasBabysitterFee: !session.hasBabysitterFee,
                            babysitterFeeAmount: !session.hasBabysitterFee ? (session.babysitterFeeAmount || settings.defaultBabysitterFee || 250) : 0
                          });
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                          session.hasBabysitterFee 
                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
                        }`}
                        title="Bakıcı Ücreti Dahil/Hariç Yap"
                      >
                        <Baby className="w-3 h-3" />
                        <span>Bakıcı: ₺{session.babysitterFeeAmount || settings.defaultBabysitterFee || 250}</span>
                      </button>

                      {session.type === 'face-to-face' && (
                        <button
                          type="button"
                          onClick={() => {
                            onSaveSession({
                              ...session,
                              hasOfficeRentFee: !session.hasOfficeRentFee,
                              officeRentFeeAmount: !session.hasOfficeRentFee ? (session.officeRentFeeAmount || settings.defaultOfficeRentFee || 200) : 0
                            });
                          }}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                            session.hasOfficeRentFee 
                              ? 'bg-purple-50 text-purple-700 border-purple-200' 
                              : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
                          }`}
                          title="Ofis Kira Payı Dahil/Hariç Yap"
                        >
                          <Building className="w-3 h-3" />
                          <span>Ofis: ₺{session.officeRentFeeAmount || settings.defaultOfficeRentFee || 200}</span>
                        </button>
                      )}
                    </div>

                    {/* Session Notes snippet or quick add */}
                    {session.notes ? (
                      <p className="text-xs text-slate-600 italic bg-slate-50/80 px-2.5 py-1 rounded-lg border border-slate-100 max-w-xl">
                        "{session.notes}"
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Right: Inline Price Editor & Payment Status & Action Buttons */}
                <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 flex-wrap">
                  {/* Inline Price Box */}
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-400">₺</span>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={session.price}
                      onChange={e => handleInlinePriceChange(session, Number(e.target.value) || 0)}
                      className="w-20 bg-transparent text-sm font-extrabold text-slate-900 focus:outline-none"
                      title="Seans Ücretini Düzenle"
                    />
                  </div>

                  {/* Inline Payment Status Toggle */}
                  <button
                    type="button"
                    onClick={() => handleInlinePaymentToggle(session)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs ${
                      isPaid 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100' 
                        : isPartial 
                          ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' 
                          : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                    }`}
                    title="Ödeme Durumunu Değiştir (Tıkla: Ödendi ↔ Ödenmedi)"
                  >
                    {isPaid ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Ödendi</span>
                      </>
                    ) : isPartial ? (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Kısmi (₺{session.paidAmount})</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                        <span>Ödenmedi</span>
                      </>
                    )}
                  </button>

                  {/* Actions: Jump to Date, Detailed Edit Modal, Delete */}
                  <div className="flex items-center gap-1.5">
                    {onJumpToDate && (
                      <button
                        type="button"
                        onClick={() => onJumpToDate(session.date)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 transition-colors cursor-pointer"
                        title="Ajandada Bu Güne Git"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenEditModal(session)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 transition-all shadow-3xs cursor-pointer"
                      title="Detaylı Düzenle"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Düzenle</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteSession(session.id)}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                      title="Seansı Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ClientDetailPage;
