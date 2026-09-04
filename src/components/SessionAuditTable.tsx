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
  RotateCcw,
  Calculator,
  Copy,
  ChevronUp,
  ChevronDown
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

  // Multi-Row Selection State for Live Audit Totals
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [isDetailExpanded, setIsDetailExpanded] = useState<boolean>(false);

  // Selected sessions and aggregated statistics
  const selectedStats = useMemo(() => {
    if (selectedSessionIds.size === 0) {
      return null;
    }

    const selectedList = sessions.filter(s => selectedSessionIds.has(s.id));
    const totalCount = selectedList.length;

    let validCount = 0;
    let nonSessionCount = 0;
    let cancelledCount = 0;
    let zeroPriceCount = 0;
    let onlineCount = 0;
    let faceToFaceCount = 0;
    let totalRevenue = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    let totalRentDeductions = 0;
    let totalBabysitterDeductions = 0;
    let cashPaid = 0;
    let bankPaid = 0;
    let cardPaid = 0;

    for (const s of selectedList) {
      if (s.type === 'non-session') {
        nonSessionCount++;
        continue;
      }
      if (s.type === 'cancelled') {
        cancelledCount++;
        continue;
      }

      validCount++;
      if (s.type === 'online') onlineCount++;
      if (s.type === 'face-to-face') faceToFaceCount++;

      const price = Number(s.price || 0);
      if (price === 0) {
        zeroPriceCount++;
      }
      totalRevenue += price;

      // Expenses / deductions
      if (s.hasOfficeRentFee && s.officeRentFeeAmount) {
        totalRentDeductions += Number(s.officeRentFeeAmount);
      }
      if (s.hasBabysitterFee && s.babysitterFeeAmount) {
        totalBabysitterDeductions += Number(s.babysitterFeeAmount);
      }

      // Paid / Unpaid
      if (s.paymentStatus === 'paid') {
        const paid = s.paidAmount !== undefined ? Number(s.paidAmount) : price;
        totalPaid += paid;
        if (s.paymentMethod === 'cash') cashPaid += paid;
        else if (s.paymentMethod === 'transfer') bankPaid += paid;
        else if (s.paymentMethod === 'card') cardPaid += paid;
      } else if (s.paymentStatus === 'partial') {
        const paid = Number(s.paidAmount || 0);
        totalPaid += paid;
        totalUnpaid += Math.max(0, price - paid);
        if (s.paymentMethod === 'cash') cashPaid += paid;
        else if (s.paymentMethod === 'transfer') bankPaid += paid;
        else if (s.paymentMethod === 'card') cardPaid += paid;
      } else {
        totalUnpaid += price;
      }
    }

    const totalDeductions = totalRentDeductions + totalBabysitterDeductions;
    const netIncome = totalRevenue - totalDeductions;
    const averagePrice = validCount > 0 ? Math.round(totalRevenue / validCount) : 0;

    return {
      totalCount,
      validCount,
      nonSessionCount,
      cancelledCount,
      zeroPriceCount,
      onlineCount,
      faceToFaceCount,
      totalRevenue,
      totalPaid,
      totalUnpaid,
      totalRentDeductions,
      totalBabysitterDeductions,
      totalDeductions,
      netIncome,
      averagePrice,
      cashPaid,
      bankPaid,
      cardPaid,
    };
  }, [sessions, selectedSessionIds]);

  const isAllSelected = filteredSessions.length > 0 && filteredSessions.every(s => selectedSessionIds.has(s.id));
  const isSomeSelected = filteredSessions.some(s => selectedSessionIds.has(s.id)) && !isAllSelected;

  const handleToggleSelect = (sessionId: string) => {
    setSelectedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedSessionIds(new Set());
    } else {
      const newSet = new Set(selectedSessionIds);
      filteredSessions.forEach(s => newSet.add(s.id));
      setSelectedSessionIds(newSet);
    }
  };

  const handleClearSelection = () => {
    setSelectedSessionIds(new Set());
    setIsDetailExpanded(false);
  };

  const handleCopySummary = () => {
    if (!selectedStats) return;
    const lines = [
      `📊 PsyCalcu Seçili Seans Sağlama Özeti (${selectedStats.totalCount} Kayıt)`,
      `• Geçerli Seans: ${selectedStats.validCount} adet (${selectedStats.onlineCount} Online, ${selectedStats.faceToFaceCount} Yüz Yüze)`,
      `• Toplam Seans Tutarı (Brüt): ${Number(selectedStats.totalRevenue).toLocaleString('tr-TR')} ₺`,
      `• Tahsil Edilen (Ödenen): ${Number(selectedStats.totalPaid).toLocaleString('tr-TR')} ₺`,
      `• Kalan / Bekleyen Ödeme: ${Number(selectedStats.totalUnpaid).toLocaleString('tr-TR')} ₺`,
      selectedStats.totalDeductions > 0 ? `• Kesintiler (Ofis/Bakıcı): -${Number(selectedStats.totalDeductions).toLocaleString('tr-TR')} ₺` : null,
      `• Net Hakediş: ${Number(selectedStats.netIncome).toLocaleString('tr-TR')} ₺`,
      selectedStats.validCount > 0 ? `• Ortalama Seans: ${Number(selectedStats.averagePrice).toLocaleString('tr-TR')} ₺ / seans` : null,
    ].filter(Boolean).join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lines).then(() => {
        showToast(`${selectedStats.totalCount} seansın toplam özeti kopyalandı!`, 'success');
      }).catch(() => {
        showToast('Panoya kopyalanamadı', 'error');
      });
    }
  };

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
    <div className={`space-y-6 animate-fade-in ${selectedStats && selectedStats.totalCount > 0 ? 'pb-32 sm:pb-36' : 'pb-8'}`} id="session-audit-table-root">
      
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
        <div className="px-5 sm:px-6 py-4 bg-[#fdfbf7] border-b border-[#e5e1d8] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <FileSpreadsheet className="w-4 h-4 text-[#6b705c]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Seans Listesi ({filteredSessions.length} Kayıt Listeleniyor)
            </h3>
            {selectedStats && selectedStats.totalCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#6b705c] text-white animate-fade-in shadow-2xs">
                <Check className="w-3 h-3" />
                {selectedStats.totalCount} Satır Seçili
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {filteredSessions.length > 0 && (
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-3xs"
              >
                {isAllSelected ? (
                  <>
                    <RotateCcw className="w-3 h-3 text-slate-400" />
                    <span>Seçimi Kaldır</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3 text-[#6b705c]" />
                    <span>Tümünü Seç ({filteredSessions.length})</span>
                  </>
                )}
              </button>
            )}
            <span className="text-[11px] text-slate-400 hidden sm:inline font-medium">
              💡 Satırları işaretleyerek anlık toplam alın veya tıklayarak düzenleyin
            </span>
          </div>
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
                  
                  {/* Selection Checkbox */}
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={inputRef => {
                        if (inputRef) {
                          inputRef.indeterminate = isSomeSelected;
                        }
                      }}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded text-[#6b705c] focus:ring-[#6b705c] cursor-pointer accent-[#6b705c]"
                      title={isAllSelected ? "Tüm seçimleri kaldır" : "Görünen tüm seansları seç"}
                    />
                  </th>

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
                  const isSelected = selectedSessionIds.has(session.id);
                  const room = (settings.rooms || []).find(r => r.id === session.roomId);

                  return (
                    <tr
                      key={session.id}
                      onClick={() => onEditSession(session)}
                      className={`group hover:bg-[#fdfbf7] cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#6b705c]/10 hover:bg-[#6b705c]/15 border-l-4 border-l-[#6b705c]'
                          : isNonSession 
                          ? 'bg-slate-50/50 opacity-75' 
                          : isZeroPrice 
                          ? 'bg-amber-50/30' 
                          : ''
                      }`}
                    >
                      {/* Checkbox Column */}
                      <td 
                        className="py-3.5 px-3 text-center cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelect(session.id);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="w-4 h-4 rounded text-[#6b705c] focus:ring-[#6b705c] pointer-events-none accent-[#6b705c]"
                        />
                      </td>
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

      {/* STICKY BOTTOM AUDIT TOTALS BAR (BOTTOM SHEET / FLOATING HUD) */}
      <AnimatePresence>
        {selectedStats && selectedStats.totalCount > 0 && (
          <motion.div
            initial={{ y: 90, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 90, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-40 w-[96%] max-w-5xl shadow-2xl rounded-2xl md:rounded-[1.75rem] bg-[#272a22]/95 text-white backdrop-blur-md border border-white/15 overflow-hidden"
          >
            {/* Top Bar Header & Core Metrics */}
            <div className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              
              {/* Left: Selected count & badges */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-[#6b705c] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-white">
                      {selectedStats.totalCount} Seans Seçildi
                    </span>
                    <span className="text-[10px] text-[#ddbea9] bg-white/10 px-2 py-0.5 rounded-full font-semibold">
                      Anlık Sağlama
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-300 mt-0.5">
                    {selectedStats.onlineCount > 0 && <span>{selectedStats.onlineCount} Online</span>}
                    {selectedStats.onlineCount > 0 && selectedStats.faceToFaceCount > 0 && <span>•</span>}
                    {selectedStats.faceToFaceCount > 0 && <span>{selectedStats.faceToFaceCount} Yüz Yüze</span>}
                    {(selectedStats.nonSessionCount > 0 || selectedStats.cancelledCount > 0) && (
                      <span className="text-slate-400">
                        ({selectedStats.nonSessionCount + selectedStats.cancelledCount} Seans Dışı/İptal)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Center: Live Financial Totals */}
              <div className="flex items-center gap-3 sm:gap-5 overflow-x-auto py-1 px-1 scrollbar-none">
                {/* Total Gross Revenue */}
                <div className="shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Toplam Tutar</span>
                  <span className="text-base sm:text-lg font-bold font-serif text-[#ddbea9]">
                    {formatCurrency(selectedStats.totalRevenue)}
                  </span>
                </div>

                <div className="h-7 w-[1px] bg-white/10 shrink-0" />

                {/* Paid */}
                <div className="shrink-0">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">Tahsil Edilen</span>
                  <span className="text-sm sm:text-base font-bold font-serif text-emerald-300">
                    {formatCurrency(selectedStats.totalPaid)}
                  </span>
                </div>

                <div className="h-7 w-[1px] bg-white/10 shrink-0" />

                {/* Unpaid */}
                <div className="shrink-0">
                  <span className="text-[10px] uppercase font-bold text-rose-300 block tracking-wider">Bekleyen Ödeme</span>
                  <span className={`text-sm sm:text-base font-bold font-serif ${selectedStats.totalUnpaid > 0 ? 'text-rose-300' : 'text-slate-300'}`}>
                    {formatCurrency(selectedStats.totalUnpaid)}
                  </span>
                </div>

                {selectedStats.totalDeductions > 0 && (
                  <>
                    <div className="h-7 w-[1px] bg-white/10 shrink-0 hidden lg:block" />
                    <div className="shrink-0 hidden lg:block">
                      <span className="text-[10px] uppercase font-bold text-amber-300 block tracking-wider">Net Hakediş</span>
                      <span className="text-sm sm:text-base font-bold font-serif text-white">
                        {formatCurrency(selectedStats.netIncome)}
                      </span>
                    </div>
                  </>
                )}

                {selectedStats.validCount > 0 && (
                  <>
                    <div className="h-7 w-[1px] bg-white/10 shrink-0 hidden xl:block" />
                    <div className="shrink-0 hidden xl:block">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Ortalama</span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-200">
                        {formatCurrency(selectedStats.averagePrice)}/seans
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-1.5 shrink-0 justify-end">
                {/* Toggle details drawer */}
                <button
                  type="button"
                  onClick={() => setIsDetailExpanded(prev => !prev)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Detaylı Dağılımı Göster"
                >
                  {isDetailExpanded ? (
                    <>
                      <span>Gizle</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Detay</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                {/* Copy Summary */}
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer"
                  title="Seçili Toplam Özeti Kopyala"
                >
                  <Copy className="w-4 h-4" />
                </button>

                {/* Clear Selection */}
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 hover:text-white transition-colors cursor-pointer"
                  title="Seçimi Temizle"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expandable Detail Section (Bottomsheet Drawer) */}
            <AnimatePresence>
              {isDetailExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-white/10 bg-black/25 px-4 py-3.5 space-y-3"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    
                    {/* Kesintiler */}
                    <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Ofis Kirası Kesintisi</span>
                      <p className="font-serif font-bold text-amber-300">
                        {formatCurrency(selectedStats.totalRentDeductions)}
                      </p>
                    </div>

                    <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Bakıcı Kesintisi</span>
                      <p className="font-serif font-bold text-amber-300">
                        {formatCurrency(selectedStats.totalBabysitterDeductions)}
                      </p>
                    </div>

                    <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Net Kalan Hakediş</span>
                      <p className="font-serif font-bold text-emerald-400">
                        {formatCurrency(selectedStats.netIncome)}
                      </p>
                    </div>

                    <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">0 ₺ Seans Sayısı</span>
                      <p className={`font-serif font-bold ${selectedStats.zeroPriceCount > 0 ? 'text-amber-300' : 'text-slate-300'}`}>
                        {selectedStats.zeroPriceCount} adet
                      </p>
                    </div>
                  </div>

                  {/* Payment Methods Breakdown */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-xs">
                    <div className="flex items-center gap-3 text-slate-300 flex-wrap">
                      <span className="text-slate-400 font-semibold">Tahsilat Türleri:</span>
                      <span>Nakit: <strong className="text-white">{formatCurrency(selectedStats.cashPaid)}</strong></span>
                      <span>•</span>
                      <span>Havale/EFT: <strong className="text-white">{formatCurrency(selectedStats.bankPaid)}</strong></span>
                      <span>•</span>
                      <span>Kart: <strong className="text-white">{formatCurrency(selectedStats.cardPaid)}</strong></span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopySummary}
                      className="text-xs text-[#ddbea9] hover:underline flex items-center gap-1 cursor-pointer ml-auto"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Hesap Metnini Kopyala
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
