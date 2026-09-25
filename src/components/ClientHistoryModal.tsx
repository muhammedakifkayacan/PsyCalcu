import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
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
  BarChart3
} from 'lucide-react';
import { Session, AppSettings, getNormalizedClientName, areClientNamesEquivalent } from '../types';
import { usePrivacy } from '../context/PrivacyContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface ClientHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  sessions: Session[];
  onSelectSession?: (session: Session) => void;
  onJumpToDate?: (date: string) => void;
  settings: AppSettings;
}

export const ClientHistoryModal: React.FC<ClientHistoryModalProps> = ({
  isOpen,
  onClose,
  clientName,
  sessions,
  onSelectSession,
  onJumpToDate,
  settings
}) => {
  useBodyScrollLock(isOpen);
  const { formatMoney, formatClientName } = usePrivacy();

  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [typeFilter, setTypeFilter] = useState<'all' | 'online' | 'face-to-face' | 'cancelled'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid' | 'partial'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedText, setCopiedText] = useState(false);
  const [showStats, setShowStats] = useState(false);

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
          const dateStr = s.date || '';
          const noteStr = (s.notes || '').toLocaleLowerCase('tr-TR');
          const priceStr = String(s.price || '');
          if (!dateStr.includes(query) && !noteStr.includes(query) && !priceStr.includes(query)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = `${a.date} ${a.time || '00:00'}`;
        const dateB = `${b.date} ${b.time || '00:00'}`;
        return sortOrder === 'desc' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
      });
  }, [clientSessions, typeFilter, paymentFilter, searchQuery, sortOrder]);

  // Copy summary to clipboard
  const handleCopySummary = () => {
    const lines = [
      `📋 DANIŞAN SEANS GEÇMİŞİ VE ÖZETİ`,
      `👤 Danışan: ${clientName}`,
      `📅 İlk Seans: ${stats.firstDate || '-'} | Son Seans: ${stats.lastDate || '-'}`,
      `🔢 Toplam Seans: ${stats.totalSessions} (Tamamlanan: ${stats.completedCount}, İptal: ${stats.cancelledCount})`,
      `💻 Online: ${stats.onlineCount} | 🏢 Yüz Yüze: ${stats.faceToFaceCount}`,
      `💰 Toplam Ücret: ₺${stats.totalBilled.toLocaleString('tr-TR')}`,
      `✅ Tahsil Edilen: ₺${stats.totalPaid.toLocaleString('tr-TR')}`,
      `⏳ Kalan Bakiye/Borç: ₺${stats.totalUnpaid.toLocaleString('tr-TR')}`,
      ``,
      `--- DETAYLI SEANS LİSTESİ ---`,
      ...displaySessions.map(s => {
        const statusText = s.type === 'cancelled' ? '[İPTAL]' : s.paymentStatus === 'paid' ? '[ÖDENDİ]' : '[ÖDENMEDİ]';
        return `• ${s.date} ${s.time} - ${s.type === 'online' ? 'Online' : 'Yüz Yüze'} - ₺${s.price} ${statusText} ${s.notes ? `(${s.notes})` : ''}`;
      })
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-hidden animate-in fade-in duration-200"
        role="dialog"
        aria-modal="true"
        id="client-history-modal"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 10 }}
          className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden text-slate-800"
        >
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-[#fdfbf7]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-600/10 border border-emerald-600/20 text-emerald-800 flex items-center justify-center shrink-0 font-bold text-base shadow-xs">
                <User className="w-5 h-5 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                    {formatClientName(displayTitle)}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/60 shadow-3xs">
                    {stats.totalSessions} Seans
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate flex items-center gap-2 mt-0.5">
                  <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {stats.firstDate ? `${new Date(stats.firstDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Tarih yok'} 
                    {stats.lastDate && stats.firstDate !== stats.lastDate ? ` - ${new Date(stats.lastDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopySummary}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                title="Danışan Geçmişini Kopyala"
                id="copy-client-history-btn"
              >
                {copiedText ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Kopyalandı!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">Özeti Kopyala</span>
                  </>
                )}
              </button>

              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Kapat"
                id="close-client-history-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Summary & Stats Toggle Bar */}
          <div className="px-4 sm:px-6 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200/60 font-semibold shadow-3xs">
                <Laptop className="w-3.5 h-3.5 text-sky-600" />
                <span>{stats.onlineCount} Online</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-semibold shadow-3xs">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>{stats.faceToFaceCount} Yüz Yüze</span>
              </span>
              {stats.cancelledCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200/60 font-semibold shadow-3xs">
                  <Ban className="w-3.5 h-3.5 text-rose-600" />
                  <span>{stats.cancelledCount} İptal</span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowStats(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer ${
                showStats 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                  : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-100/80'
              }`}
              id="toggle-client-financial-stats-btn"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{showStats ? 'Toplamları Gizle' : 'Toplam Fiyat & Finansal Özeti Gör'}</span>
              {showStats ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
            </button>
          </div>

          {/* Collapsible Detailed Metrics Bar (Collapsed by default so user sees sessions immediately) */}
          <AnimatePresence>
            {showStats && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-b border-slate-200/70 bg-slate-50/50"
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 sm:p-5 text-xs">
                  {/* Completed Sessions */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-3xs flex flex-col justify-between">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Tamamlanan Seans
                    </span>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-lg font-extrabold text-slate-800">{stats.completedCount}</span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        ({stats.onlineCount} Online, {stats.faceToFaceCount} Yüzyüze)
                      </span>
                    </div>
                  </div>

                  {/* Total Revenue */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-3xs flex flex-col justify-between">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-blue-600" /> Toplam Ücret
                    </span>
                    <div className="mt-1">
                      <span className="text-lg font-extrabold text-blue-900">
                        {formatMoney(stats.totalBilled)}
                      </span>
                    </div>
                  </div>

                  {/* Paid Amount */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-3xs flex flex-col justify-between">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5 text-emerald-600" /> Tahsil Edilen
                    </span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-lg font-extrabold text-emerald-700">
                        {formatMoney(stats.totalPaid)}
                      </span>
                      {stats.totalBilled > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                          %{Math.round((stats.totalPaid / stats.totalBilled) * 100)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Unpaid Balance */}
                  <div className={`p-3 rounded-xl border shadow-3xs flex flex-col justify-between ${
                    stats.totalUnpaid > 0 
                      ? 'bg-rose-50/70 border-rose-200 text-rose-900' 
                      : 'bg-white border-slate-200/80'
                  }`}>
                    <span className={`font-medium flex items-center gap-1 ${stats.totalUnpaid > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                      <AlertCircle className={`w-3.5 h-3.5 ${stats.totalUnpaid > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
                      Kalan Borç / Bekleyen
                    </span>
                    <div className="mt-1">
                      <span className={`text-lg font-extrabold ${stats.totalUnpaid > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                        {formatMoney(stats.totalUnpaid)}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filter & Search Toolbar */}
          <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5 bg-white">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tarih, not veya tutara göre filtrele..."
                className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 font-medium"
                id="client-history-search-input"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as any)}
                className="py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                id="client-history-type-filter"
              >
                <option value="all">Tüm Türler (Online & Yüzyüze)</option>
                <option value="online">🌐 Sadece Online</option>
                <option value="face-to-face">🏢 Sadece Yüz Yüze</option>
                <option value="cancelled">🚫 İptal Edilenler</option>
              </select>

              {/* Payment Filter */}
              <select
                value={paymentFilter}
                onChange={e => setPaymentFilter(e.target.value as any)}
                className="py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                id="client-history-payment-filter"
              >
                <option value="all">Tüm Ödemeler</option>
                <option value="paid">✅ Ödenenler</option>
                <option value="unpaid">⏳ Ödenmeyenler</option>
                <option value="partial">⚠️ Kısmi Ödenenler</option>
              </select>

              {/* Sort Order Toggle */}
              <button
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-100 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Tarih Sıralaması"
                id="client-history-sort-toggle"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                <span>{sortOrder === 'desc' ? 'Yeniden Eskiye' : 'Eskiden Yeniye'}</span>
              </button>
            </div>
          </div>

          {/* Session List Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5 bg-slate-50/40">
            {displaySessions.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-600">Bu filtreye uygun seans kaydı bulunamadı.</p>
                <p className="text-xs text-slate-400">Arama kelimesini veya seçtiğiniz filtreleri sıfırlamayı deneyebilirsiniz.</p>
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
                    className={`bg-white rounded-2xl border transition-all p-3.5 sm:p-4 shadow-3xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-emerald-300 ${
                      isCancelled ? 'opacity-60 bg-slate-50/80 border-slate-200' : 'border-slate-200/80'
                    }`}
                  >
                    {/* Left: Date, Time & Badges */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isCancelled 
                          ? 'bg-rose-100 text-rose-700' 
                          : session.type === 'face-to-face' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isCancelled ? (
                          <Ban className="w-4 h-4" />
                        ) : session.type === 'face-to-face' ? (
                          <MapPin className="w-4 h-4" />
                        ) : (
                          <Laptop className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-slate-900">
                            {formattedDate}
                          </span>
                          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {session.time || '00:00'}
                          </span>
                          
                          {/* Type Badge */}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isCancelled 
                              ? 'bg-rose-100 text-rose-700' 
                              : session.type === 'face-to-face' 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isCancelled ? 'İptal' : session.type === 'face-to-face' ? 'Yüz Yüze' : 'Online'}
                          </span>

                          {/* Extra Expense Badges */}
                          {session.hasBabysitterFee && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1" title="Bakıcı Ücreti Dahil">
                              👶 ₺{session.babysitterFeeAmount || settings.defaultBabysitterFee}
                            </span>
                          )}
                          {session.hasOfficeRentFee && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100 flex items-center gap-1" title="Ofis Kira Payı">
                              🏢 ₺{session.officeRentFeeAmount || settings.defaultOfficeRentFee}
                            </span>
                          )}
                        </div>

                        {/* Session Notes Snippet */}
                        {session.notes && (
                          <p className="text-xs text-slate-600 line-clamp-1 italic bg-slate-50 px-2 py-0.5 rounded border border-slate-100 inline-block">
                            "{session.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Financial & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <div className={`font-extrabold text-sm sm:text-base ${isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {formatMoney(session.price)}
                        </div>
                        <div className="text-[11px] font-bold">
                          {isCancelled ? (
                            <span className="text-slate-400">İptal Edildi</span>
                          ) : isPaid ? (
                            <span className="text-emerald-700 flex items-center gap-1 sm:justify-end">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Ödendi
                            </span>
                          ) : isPartial ? (
                            <span className="text-amber-700 flex items-center gap-1 sm:justify-end">
                              Kısmi (₺{(session.paidAmount || 0).toLocaleString('tr-TR')})
                            </span>
                          ) : (
                            <span className="text-rose-600 flex items-center gap-1 sm:justify-end">
                              <AlertCircle className="w-3 h-3 text-rose-500" /> Ödenmedi
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        {onJumpToDate && (
                          <button
                            onClick={() => {
                              onJumpToDate(session.date);
                              onClose();
                            }}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 transition-colors cursor-pointer"
                            title="Takvimde Bu Güne Git"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}

                        {onSelectSession && (
                          <button
                            onClick={() => {
                              onSelectSession(session);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-3xs cursor-pointer"
                            title="Seansı Düzenle"
                          >
                            Düzenle
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar */}
          <div className="px-5 sm:px-6 py-3.5 bg-white border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">
              Listelenen: <strong>{displaySessions.length}</strong> / {clientSessions.length} Seans
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition-colors cursor-pointer"
              id="close-client-history-footer-btn"
            >
              Kapat
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ClientHistoryModal;
