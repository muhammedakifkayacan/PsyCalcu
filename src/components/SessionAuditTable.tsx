import React, { useState, useMemo } from 'react';
import { 
  CheckCircle, 
  Clock, 
  DollarSign, 
  Filter, 
  Search, 
  Calendar as CalendarIcon, 
  ChevronRight, 
  Edit3, 
  Trash2, 
  AlertCircle, 
  Sparkles, 
  Building, 
  CreditCard, 
  FileSpreadsheet, 
  ArrowUpDown,
  ExternalLink,
  ShieldAlert,
  Info,
  Layers,
  X,
  User,
  Coffee,
  Check,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Session, AppSettings, SessionType } from '../types';
import { getAccountingDateRange, getTodayLocalDate, formatLocalDate } from '../utils/dateUtils';

interface SessionAuditTableProps {
  sessions: Session[];
  settings: AppSettings;
  onEditSession: (session: Session) => void;
  onDeleteSession: (sessionId: string) => void;
  onGoToDate: (dateStr: string) => void;
  setActiveTab: (tab: any) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isPrivacyMode?: boolean;
  isHideClientNames?: boolean;
}

type PeriodPreset = 'last30' | 'thisMonth' | 'lastMonth' | 'last7' | 'all' | 'custom';
type AnomalyFilter = 'all' | 'zeroPrice' | 'nonSession' | 'unpaid' | 'paid' | 'faceToFace' | 'online' | 'noRoom';

export const SessionAuditTable: React.FC<SessionAuditTableProps> = ({
  sessions,
  settings,
  onEditSession,
  onDeleteSession,
  onGoToDate,
  setActiveTab,
  showToast,
  isPrivacyMode = false,
  isHideClientNames = false,
}) => {
  // Period Preset State
  const [period, setPeriod] = useState<PeriodPreset>('last30');
  
  // Custom Date Range State
  const todayStr = useMemo(() => getTodayLocalDate(), []);
  const thirtyDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatLocalDate(d);
  }, []);

  const [customStartDate, setCustomStartDate] = useState<string>(thirtyDaysAgoStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [anomalyFilter, setAnomalyFilter] = useState<AnomalyFilter>('all');
  const [sortField, setSortField] = useState<'date' | 'clientName' | 'price'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Compute Active Date Bounds
  const { startDate, endDate } = useMemo(() => {
    const range = getAccountingDateRange(period, customStartDate, customEndDate);
    return { startDate: range.start, endDate: range.end };
  }, [period, customStartDate, customEndDate]);

  // Mask client name if privacy mode is on
  const formatClientName = (name: string) => {
    if (!name) return 'İsimsiz';
    if (!isHideClientNames) return name;
    const parts = name.trim().split(/\s+/);
    return parts
      .map(p => (p.length > 1 ? p[0] + '*'.repeat(Math.max(2, p.length - 1)) : p + '***'))
      .join(' ');
  };

  const formatCurrency = (amount: number) => {
    if (isPrivacyMode) return '•••• ₺';
    return `${Number(amount || 0).toLocaleString('tr-TR')} ₺`;
  };

  // Helper date formatter
  const formatDateTR = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        weekday: 'short'
      });
    } catch {
      return dateStr;
    }
  };

  // Filter Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // Date range filtering
      if (startDate && session.date < startDate) return false;
      if (endDate && session.date > endDate) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (session.clientName || '').toLowerCase().includes(q);
        const matchesNotes = (session.notes || '').toLowerCase().includes(q);
        const matchesTime = (session.time || '').includes(q);
        if (!matchesName && !matchesNotes && !matchesTime) return false;
      }

      // Anomaly / Category filter
      if (anomalyFilter === 'zeroPrice') {
        return (session.price === 0 || !session.price) && session.type !== 'non-session' && session.type !== 'cancelled';
      }
      if (anomalyFilter === 'nonSession') {
        return session.type === 'non-session';
      }
      if (anomalyFilter === 'unpaid') {
        return session.paymentStatus === 'unpaid' || session.paymentStatus === 'partial' || (!session.paymentStatus && session.type !== 'non-session' && session.type !== 'cancelled');
      }
      if (anomalyFilter === 'paid') {
        return session.paymentStatus === 'paid';
      }
      if (anomalyFilter === 'faceToFace') {
        return session.type === 'face-to-face';
      }
      if (anomalyFilter === 'online') {
        return session.type === 'online';
      }
      if (anomalyFilter === 'noRoom') {
        return session.type === 'face-to-face' && !session.roomId;
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'date') {
        const dateComp = (a.date || '').localeCompare(b.date || '');
        if (dateComp !== 0) return sortOrder === 'asc' ? dateComp : -dateComp;
        const timeComp = (a.time || '').localeCompare(b.time || '');
        return sortOrder === 'asc' ? timeComp : -timeComp;
      }
      if (sortField === 'clientName') {
        const nameComp = (a.clientName || '').localeCompare(b.clientName || '', 'tr-TR');
        return sortOrder === 'asc' ? nameComp : -nameComp;
      }
      if (sortField === 'price') {
        return sortOrder === 'asc' ? (a.price || 0) - (b.price || 0) : (b.price || 0) - (a.price || 0);
      }
      return 0;
    });
  }, [sessions, startDate, endDate, searchQuery, anomalyFilter, sortField, sortOrder]);

  // Period Aggregated Statistics
  const stats = useMemo(() => {
    let totalCount = 0;
    let actualSessionCount = 0;
    let nonSessionCount = 0;
    let cancelledCount = 0;
    let zeroPriceCount = 0;
    let totalRevenue = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;

    // Calculate over all sessions in the selected date window (not restricted by search query)
    const inRangeSessions = sessions.filter(session => {
      if (startDate && session.date < startDate) return false;
      if (endDate && session.date > endDate) return false;
      return true;
    });

    for (const s of inRangeSessions) {
      totalCount++;
      if (s.type === 'non-session') {
        nonSessionCount++;
        continue;
      }
      if (s.type === 'cancelled') {
        cancelledCount++;
        continue;
      }

      actualSessionCount++;
      const price = Number(s.price || 0);
      if (price === 0) {
        zeroPriceCount++;
      }
      totalRevenue += price;

      if (s.paymentStatus === 'paid') {
        totalPaid += (s.paidAmount !== undefined ? s.paidAmount : price);
      } else if (s.paymentStatus === 'partial') {
        const paid = Number(s.paidAmount || 0);
        totalPaid += paid;
        totalUnpaid += Math.max(0, price - paid);
      } else {
        totalUnpaid += price;
      }
    }

    return {
      totalCount,
      actualSessionCount,
      nonSessionCount,
      cancelledCount,
      zeroPriceCount,
      totalRevenue,
      totalPaid,
      totalUnpaid
    };
  }, [sessions, startDate, endDate]);

  const handleSort = (field: 'date' | 'clientName' | 'price') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getSessionTypeBadge = (type: SessionType) => {
    switch (type) {
      case 'online':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">🌐 Online</span>;
      case 'face-to-face':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">🛋️ Yüz Yüze</span>;
      case 'non-session':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300" title="#seansdeğil veya kişisel plan">🚫 Seans Değil</span>;
      case 'cancelled':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">❌ İptal</span>;
      case 'rent-income':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">🏢 Kira Geliri</span>;
      default:
        return null;
    }
  };

  const getPaymentStatusBadge = (s: Session) => {
    if (s.type === 'non-session' || s.type === 'cancelled') {
      return <span className="text-[10px] text-slate-400 font-mono">-</span>;
    }
    if (s.paymentStatus === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle className="w-3 h-3 text-emerald-600" /> Ödendi
        </span>
      );
    }
    if (s.paymentStatus === 'partial') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" /> Kısmi ({formatCurrency(s.paidAmount || 0)})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
        <AlertCircle className="w-3 h-3 text-rose-600" /> Bekliyor
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in" id="session-audit-table-root">
      
      {/* HERO BANNER */}
      <div className="bg-[#6b705c] p-6 md:p-8 rounded-[2.5rem] text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-40 h-40 bg-white/5 rounded-full pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-white/20 px-3 py-1 rounded-full font-semibold tracking-wider uppercase">
                MUTABAKAT & DENETİM
              </span>
              <span className="text-[10px] bg-amber-400/30 text-amber-100 border border-amber-300/30 px-2.5 py-0.5 rounded-full font-bold">
                Sağlama Ekranı
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-serif">Seans Sağlama & Hızlı Denetim Tablosu</h2>
            <p className="text-xs md:text-sm opacity-90 leading-relaxed font-light">
              Kendi takviminiz ile bütçe kayıtlarınızı karşılaştırın. 0 ₺ kalmış seansları, kişisel planları (<em>#seansdeğil</em>) ve ödemesi bekleyenleri tek bir Excel tablosunda hızla denetleyin ve ilgili satıra tıklayarak anında düzenleyin.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('agenda')}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-semibold border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <CalendarIcon className="w-4 h-4" />
              Ajandaya Dön
            </button>
          </div>
        </div>
      </div>

      {/* QUICK SUMMARY METRIC CARDS FOR SELECTED PERIOD */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Card 1: Total Sessions */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-[#e5e1d8] shadow-3xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Geçerli Seans</span>
            <span className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
              {stats.actualSessionCount}
            </span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-800 font-serif">
            {stats.actualSessionCount} <span className="text-xs font-sans font-normal text-slate-500">Seans</span>
          </p>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-1 border-t border-slate-100">
            <span>{stats.nonSessionCount} Seans Dışı / Not</span>
            <span>•</span>
            <span>{stats.cancelledCount} İptal</span>
          </div>
        </div>

        {/* Card 2: Total Revenue */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-[#e5e1d8] shadow-3xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dönem Seans Cirosu</span>
            <div className="w-7 h-7 rounded-xl bg-[#6b705c]/10 text-[#6b705c] flex items-center justify-center font-bold text-xs">
              ₺
            </div>
          </div>
          <p className="text-xl md:text-2xl font-bold text-[#6b705c] font-serif">
            {formatCurrency(stats.totalRevenue)}
          </p>
          <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
            {stats.actualSessionCount > 0 ? `Ort. ${formatCurrency(Math.round(stats.totalRevenue / stats.actualSessionCount))} / seans` : 'Kayıt yok'}
          </p>
        </div>

        {/* Card 3: Unpaid */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-[#e5e1d8] shadow-3xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tahsil Edilmemiş</span>
            <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
              stats.totalUnpaid > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-400'
            }`}>
              !
            </span>
          </div>
          <p className={`text-xl md:text-2xl font-bold font-serif ${stats.totalUnpaid > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
            {formatCurrency(stats.totalUnpaid)}
          </p>
          <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
            Tahsil Edilen: <strong className="text-emerald-600 font-medium">{formatCurrency(stats.totalPaid)}</strong>
          </p>
        </div>

        {/* Card 4: Zero Price Warning */}
        <div className={`p-4 md:p-5 rounded-2xl border shadow-3xs space-y-1 ${
          stats.zeroPriceCount > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-[#e5e1d8]'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">0 ₺ / Fiyatsız Seans</span>
            <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
              stats.zeroPriceCount > 0 ? 'bg-amber-200 text-amber-900' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {stats.zeroPriceCount > 0 ? '⚠️' : '✓'}
            </span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-slate-800 font-serif">
            {stats.zeroPriceCount} <span className="text-xs font-sans font-normal text-slate-500">Kayıt</span>
          </p>
          <p className="text-[10px] text-slate-500 pt-1 border-t border-amber-200/60">
            {stats.zeroPriceCount > 0 ? 'Fiyatı eksik kalmış olabilir, kontrol edin' : 'Tüm seanslara fiyat tanımlanmış'}
          </p>
        </div>
      </div>

      {/* FILTER & PERIOD TOOLBAR */}
      <div className="bg-white p-5 md:p-6 rounded-[2rem] border border-[#e5e1d8] shadow-3xs space-y-4">
        
        {/* Row 1: Period Presets & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#fdfbf7] p-1.5 rounded-2xl border border-[#e5e1d8]">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-2 hidden sm:inline">Dönem:</span>
            
            <button
              onClick={() => setPeriod('last30')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                period === 'last30' ? 'bg-[#6b705c] text-white shadow-xs' : 'text-slate-600 hover:bg-white'
              }`}
            >
              Son 30 Gün
            </button>
            <button
              onClick={() => setPeriod('thisMonth')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                period === 'thisMonth' ? 'bg-[#6b705c] text-white shadow-xs' : 'text-slate-600 hover:bg-white'
              }`}
            >
              Bu Ay
            </button>
            <button
              onClick={() => setPeriod('lastMonth')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                period === 'lastMonth' ? 'bg-[#6b705c] text-white shadow-xs' : 'text-slate-600 hover:bg-white'
              }`}
            >
              Geçen Ay
            </button>
            <button
              onClick={() => setPeriod('last7')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                period === 'last7' ? 'bg-[#6b705c] text-white shadow-xs' : 'text-slate-600 hover:bg-white'
              }`}
            >
              Son 7 Gün
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                period === 'all' ? 'bg-[#6b705c] text-white shadow-xs' : 'text-slate-600 hover:bg-white'
              }`}
            >
              Tüm Kayıtlar
            </button>
            <button
              onClick={() => setPeriod('custom')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                period === 'custom' ? 'bg-[#6b705c] text-white shadow-xs' : 'text-slate-600 hover:bg-white'
              }`}
            >
              Özel Tarih
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#a5a58d]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Danışan adı, saat veya not içeriği ara..."
              className="w-full pl-10 pr-9 py-2 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] text-slate-800 placeholder:text-slate-400 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Custom Date Range Picker (Shown only if custom is chosen) */}
        {period === 'custom' && (
          <div className="p-3 bg-[#fdfbf7] rounded-xl border border-[#e5e1d8] flex flex-wrap items-center gap-3 animate-fade-in text-xs">
            <span className="font-semibold text-slate-700">Tarih Aralığı:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-1.5 bg-white border border-[#e5e1d8] rounded-lg text-xs font-medium"
            />
            <span className="text-slate-400">—</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-1.5 bg-white border border-[#e5e1d8] rounded-lg text-xs font-medium"
            />
          </div>
        )}

        {/* Row 2: Anomaly / Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Filtrele:</span>

          <button
            onClick={() => setAnomalyFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              anomalyFilter === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tümü ({filteredSessions.length})
          </button>

          <button
            onClick={() => setAnomalyFilter('zeroPrice')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              anomalyFilter === 'zeroPrice'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            ⚠️ 0 ₺ Olanlar
          </button>

          <button
            onClick={() => setAnomalyFilter('nonSession')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              anomalyFilter === 'nonSession'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
            }`}
          >
            🚫 Seans Değil / Kişisel
          </button>

          <button
            onClick={() => setAnomalyFilter('unpaid')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              anomalyFilter === 'unpaid'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            ⏳ Ödeme Bekleyenler
          </button>

          <button
            onClick={() => setAnomalyFilter('paid')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              anomalyFilter === 'paid'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            ✅ Ödenenler
          </button>

          <button
            onClick={() => setAnomalyFilter('faceToFace')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              anomalyFilter === 'faceToFace'
                ? 'bg-[#cb997e] text-white shadow-xs'
                : 'bg-[#cb997e]/10 text-[#a26848] border border-[#cb997e]/20 hover:bg-[#cb997e]/20'
            }`}
          >
            🛋️ Yüz Yüze
          </button>

          <button
            onClick={() => setAnomalyFilter('online')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              anomalyFilter === 'online'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100'
            }`}
          >
            🌐 Online
          </button>

          {settings.userRole === 'owner' && (
            <button
              onClick={() => setAnomalyFilter('noRoom')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                anomalyFilter === 'noRoom'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
              }`}
            >
              🚪 Odasız Yüz Yüze
            </button>
          )}

          {anomalyFilter !== 'all' && (
            <button
              onClick={() => setAnomalyFilter('all')}
              className="text-[11px] text-slate-500 hover:text-slate-800 underline ml-auto cursor-pointer"
            >
              Filtreyi Sıfırla
            </button>
          )}
        </div>
      </div>

      {/* SESSIONS TABLE */}
      <div className="bg-white rounded-[2rem] border border-[#e5e1d8] shadow-3xs overflow-hidden">
        
        {/* Table Head Bar */}
        <div className="px-6 py-4 bg-[#fdfbf7] border-b border-[#e5e1d8] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#6b705c]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Seans Listesi ({filteredSessions.length} Kayıt Listeleniyor)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline font-medium">
            💡 Satıra tıklayarak seansı anında düzenleyebilirsiniz
          </span>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">Bu Kriterlere Uygun Kayıt Bulunamadı</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Seçilen tarih aralığı veya filtre kriterlerinde seans bulunmuyor. Farklı bir tarih aralığı seçebilir veya filtreleri sıfırlayabilirsiniz.
            </p>
            <button
              onClick={() => {
                setPeriod('all');
                setAnomalyFilter('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-[#6b705c] text-white text-xs font-semibold rounded-xl hover:bg-[#585c4c] transition-colors cursor-pointer"
            >
              Tüm Filtreleri Temizle
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/70 text-slate-500 text-[11px] font-bold select-none">
                  
                  {/* Date & Time Sortable */}
                  <th 
                    onClick={() => handleSort('date')}
                    className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Tarih & Saat</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>

                  {/* Client Name Sortable */}
                  <th 
                    onClick={() => handleSort('clientName')}
                    className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Danışan / Kayıt Adı</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>

                  <th className="py-3 px-4">Tür</th>

                  {/* Price Sortable */}
                  <th 
                    onClick={() => handleSort('price')}
                    className="py-3 px-4 cursor-pointer hover:text-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Ücret</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>

                  <th className="py-3 px-4">Ödeme Durumu</th>
                  <th className="py-3 px-4">Oda</th>
                  <th className="py-3 px-4">Not</th>
                  <th className="py-3 px-4 text-right">İşlemler</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredSessions.map((session) => {
                  const isNonSession = session.type === 'non-session';
                  const isCancelled = session.type === 'cancelled';
                  const isZeroPrice = (session.price === 0 || !session.price) && !isNonSession && !isCancelled;
                  const room = (settings.rooms || []).find(r => r.id === session.roomId);

                  return (
                    <tr
                      key={session.id}
                      onClick={() => onEditSession(session)}
                      className={`group hover:bg-[#fdfbf7] cursor-pointer transition-colors ${
                        isNonSession 
                          ? 'bg-slate-50/50 opacity-75' 
                          : isZeroPrice 
                          ? 'bg-amber-50/30' 
                          : ''
                      }`}
                    >
                      {/* Date & Time */}
                      <td className="py-3.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{formatDateTR(session.date)}</span>
                          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {session.time || '00:00'}
                          </span>
                        </div>
                      </td>

                      {/* Client Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isNonSession ? 'text-slate-500 italic' : 'text-slate-900'}`}>
                            {formatClientName(session.clientName)}
                          </span>
                          {session.isSyncedFromCalendar && (
                            <span 
                              className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-mono"
                              title="Takvimden aktarıldı"
                            >
                              Takvim
                            </span>
                          )}
                          {session.isManuallyEdited && (
                            <span 
                              className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-mono"
                              title="Manuel düzenlendi"
                            >
                              Korumalı
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getSessionTypeBadge(session.type)}
                      </td>

                      {/* Price & Expenses */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isNonSession || isCancelled ? (
                          <span className="text-slate-400 font-mono text-[11px]">0 ₺</span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className={`font-bold font-mono text-xs ${isZeroPrice ? 'text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded' : 'text-slate-900'}`}>
                              {formatCurrency(session.price)}
                            </span>
                            {(session.hasOfficeRentFee || session.hasBabysitterFee) && (
                              <p className="text-[9px] text-slate-400">
                                Kesinti: {formatCurrency((session.hasOfficeRentFee ? session.officeRentFeeAmount : 0) + (session.hasBabysitterFee ? session.babysitterFeeAmount : 0))}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getPaymentStatusBadge(session)}
                      </td>

                      {/* Room */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {room ? (
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-2xs"
                            style={{ backgroundColor: room.color || '#6b705c' }}
                          >
                            <Building className="w-2.5 h-2.5" />
                            {room.name}
                          </span>
                        ) : session.type === 'face-to-face' ? (
                          <span className="text-[10px] text-slate-400 italic">Oda Atanmadı</span>
                        ) : (
                          <span className="text-slate-300 font-mono text-[10px]">-</span>
                        )}
                      </td>

                      {/* Notes Preview */}
                      <td className="py-3.5 px-4 max-w-[180px] truncate text-slate-500 text-[11px]">
                        {session.notes || <span className="text-slate-300 italic">-</span>}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          
                          {/* Jump to Date in Agenda */}
                          <button
                            type="button"
                            onClick={() => {
                              onGoToDate(session.date);
                              setActiveTab('agenda');
                              showToast(`${formatDateTR(session.date)} gününe geçildi`, 'info');
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#6b705c] hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Ajandada bu güne git"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => onEditSession(session)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Seansı Düzenle"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`"${session.clientName}" seansını silmek istediğinize emin misiniz?`)) {
                                onDeleteSession(session.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Seansı Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
