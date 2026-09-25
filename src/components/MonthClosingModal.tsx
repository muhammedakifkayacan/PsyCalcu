import React, { useState, useMemo } from 'react';
import { 
  X, 
  CheckCircle, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  Calendar, 
  DollarSign, 
  Check, 
  Filter, 
  ChevronRight, 
  ShieldCheck, 
  Building, 
  Clock, 
  User, 
  AlertCircle,
  FileCheck,
  RotateCcw,
  Sparkles,
  Search,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Session, AppSettings, Expense, SessionType } from '../types';
import { 
  ClosedMonthRecord, 
  formatMonthKey, 
  getAllSessionMonths, 
  calculateMonthAuditSummary, 
  isMonthClosed 
} from '../utils/monthCloseUtils';
import { usePrivacy } from '../context/PrivacyContext';

interface MonthClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  settings: AppSettings;
  expenses?: Expense[];
  onCloseMonth: (monthKey: string, summary: Partial<ClosedMonthRecord>) => void;
  onReopenMonth: (monthKey: string) => void;
  onEditSession?: (session: Session) => void;
  onUpdateSessionPrice?: (sessionId: string, newPrice: number) => void;
  onUpdateSessionPaymentStatus?: (sessionId: string, newStatus: 'paid' | 'unpaid' | 'partial') => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  initialMonthKey?: string;
}

type FilterTab = 'all' | 'zeroPrice' | 'unpaid' | 'faceToFace' | 'online' | 'cancelled';

export const MonthClosingModal: React.FC<MonthClosingModalProps> = ({
  isOpen,
  onClose,
  sessions,
  settings,
  expenses = [],
  onCloseMonth,
  onReopenMonth,
  onEditSession,
  onUpdateSessionPrice,
  onUpdateSessionPaymentStatus,
  showToast,
  initialMonthKey
}) => {
  const { formatMoney, formatClientName } = usePrivacy();

  // Distinct months in sessions
  const availableMonths = useMemo(() => {
    const months = getAllSessionMonths(sessions);
    // If initialMonthKey provided and not in list, add it
    if (initialMonthKey && !months.includes(initialMonthKey)) {
      months.unshift(initialMonthKey);
    }
    return months;
  }, [sessions, initialMonthKey]);

  // Selected month
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (initialMonthKey) return initialMonthKey;
    if (availableMonths.length > 0) return availableMonths[0];
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Keep selectedMonth updated if initialMonthKey changes when modal opens
  React.useEffect(() => {
    if (initialMonthKey) {
      setSelectedMonth(initialMonthKey);
    } else if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [initialMonthKey, isOpen]);

  // Filter tab inside session review
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');

  // Inline editing state for quick price changes
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPriceInput, setTempPriceInput] = useState<string>('');

  // Calculate audit summary for selected month
  const summary = useMemo(() => {
    return calculateMonthAuditSummary(selectedMonth, sessions, expenses, settings);
  }, [selectedMonth, sessions, expenses, settings]);

  const isClosed = isMonthClosed(selectedMonth, settings.closedMonths);
  const closedRecord = settings.closedMonths?.[selectedMonth];

  // Filtered sessions for review table
  const displayedSessions = useMemo(() => {
    return summary.sessions.filter(s => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const clientMatches = (s.clientName || '').toLowerCase().includes(q);
        const notesMatches = (s.notes || '').toLowerCase().includes(q);
        if (!clientMatches && !notesMatches) return false;
      }

      // Tab filter
      if (activeFilter === 'zeroPrice') {
        return (Number(s.price) || 0) === 0 && s.type !== 'cancelled' && s.type !== 'non-session';
      }
      if (activeFilter === 'unpaid') {
        return s.paymentStatus !== 'paid' && s.type !== 'cancelled';
      }
      if (activeFilter === 'faceToFace') {
        return s.type === 'face-to-face';
      }
      if (activeFilter === 'online') {
        return s.type === 'online';
      }
      if (activeFilter === 'cancelled') {
        return s.type === 'cancelled';
      }
      return true;
    });
  }, [summary.sessions, activeFilter, searchQuery]);

  if (!isOpen) return null;

  const handleConfirmClose = () => {
    if (!confirmationChecked && !isClosed) {
      showToast('Lütfen seansları ve ücretleri kontrol ettiğinizi onaylayan kutucuğu işaretleyin.', 'error');
      return;
    }

    onCloseMonth(selectedMonth, {
      monthKey: selectedMonth,
      closedAt: new Date().toISOString(),
      closedBy: settings.therapistName || 'Terapist',
      sessionCount: summary.totalSessions,
      onlineCount: summary.onlineCount,
      faceToFaceCount: summary.faceToFaceCount,
      cancelledCount: summary.cancelledCount,
      totalIncome: summary.grossIncome,
      totalExpenses: summary.totalExpenses,
      netIncome: summary.netIncome,
      unpaidDebtCount: summary.unpaidDebtCount,
      unpaidDebtAmount: summary.unpaidDebtAmount,
      notes: closingNotes.trim() || undefined
    });

    showToast(`${summary.monthLabel} başarıyla kapatıldı ve takvim senkronizasyonunda kilitlendi!`, 'success');
    setConfirmationChecked(false);
    onClose();
  };

  const handleReopen = () => {
    onReopenMonth(selectedMonth);
    showToast(`${summary.monthLabel} kilidi açıldı. Artık düzenlenebilir ve senkronize edilebilir.`, 'info');
  };

  const handleStartEditPrice = (s: Session) => {
    setEditingPriceId(s.id);
    setTempPriceInput(String(s.price || ''));
  };

  const handleSavePrice = (sessionId: string) => {
    const val = parseFloat(tempPriceInput.replace(',', '.'));
    if (!isNaN(val) && val >= 0 && onUpdateSessionPrice) {
      onUpdateSessionPrice(sessionId, val);
      showToast('Seans ücreti güncellendi.', 'success');
    }
    setEditingPriceId(null);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl my-auto overflow-hidden flex flex-col max-h-[92vh] border border-[#6b705c]/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-200/80 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
              <ShieldCheck className="w-5 h-5 text-[#6b705c]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Ay Kapatma</h2>
                <span className="text-slate-300">·</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setConfirmationChecked(false);
                  }}
                  className="text-sm font-semibold text-slate-700 bg-transparent hover:bg-slate-100 rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-300 transition-colors"
                >
                  {availableMonths.map(m => {
                    const mClosed = isMonthClosed(m, settings.closedMonths);
                    return (
                      <option key={m} value={m}>
                        {formatMonthKey(m)} {mClosed ? '✓ Kilitli' : '· Açık'}
                      </option>
                    );
                  })}
                </select>
                {isClosed ? (
                  <span className="text-xs text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-600" /> Kilitli
                  </span>
                ) : (
                  <span className="text-xs text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                    Açık Dönem
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isClosed && (
              <button
                onClick={handleReopen}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                title="Dönemin kilidini aç"
              >
                <Unlock className="w-3.5 h-3.5" />
                Kilidi Aç
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-white">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
            <div>
              <span className="text-xs text-slate-500 font-medium">Toplam Seans</span>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                {summary.totalSessions}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {summary.onlineCount} Online · {summary.faceToFaceCount} Yüz Yüze
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-500 font-medium">Brüt Gelir</span>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                {formatMoney(summary.grossIncome)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Tahsil: {formatMoney(summary.paidGrossIncome)}
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-500 font-medium">Toplam Gider</span>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                {formatMoney(summary.totalExpenses)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Kira & Bakıcı
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-500 font-medium">Net Kâr</span>
              <div className="text-xl sm:text-2xl font-bold text-emerald-800 mt-0.5">
                {formatMoney(summary.netIncome)}
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                Gerçekleşen: {formatMoney(summary.collectedNetIncome)}
              </div>
            </div>
          </div>

          {/* Interactive Session Review Table */}
          <div className="rounded-2xl border border-slate-200/80 overflow-hidden">
            {/* Table Filters & Search */}
            <div className="p-3 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    activeFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tümü ({summary.totalSessions})
                </button>
                {summary.zeroPriceSessions.length > 0 && (
                  <button
                    onClick={() => setActiveFilter('zeroPrice')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                      activeFilter === 'zeroPrice'
                        ? 'bg-amber-100 text-amber-900 font-semibold'
                        : 'text-amber-800 hover:bg-amber-50'
                    }`}
                  >
                    <span>0 ₺ ({summary.zeroPriceSessions.length})</span>
                  </button>
                )}
                {summary.unpaidDebtCount > 0 && (
                  <button
                    onClick={() => setActiveFilter('unpaid')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      activeFilter === 'unpaid'
                        ? 'bg-blue-100 text-blue-900 font-semibold'
                        : 'text-blue-800 hover:bg-blue-50'
                    }`}
                  >
                    Ödenmemiş ({summary.unpaidDebtCount})
                  </button>
                )}
                <button
                  onClick={() => setActiveFilter('faceToFace')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    activeFilter === 'faceToFace'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Yüz Yüze ({summary.faceToFaceCount})
                </button>
                <button
                  onClick={() => setActiveFilter('online')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    activeFilter === 'online'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Online ({summary.onlineCount})
                </button>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Danışan ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 text-xs rounded-lg bg-white border border-slate-200 focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>

            {/* Table Rows */}
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[11px] font-medium sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Tarih</th>
                    <th className="py-2.5 px-3">Danışan</th>
                    <th className="py-2.5 px-3">Tür</th>
                    <th className="py-2.5 px-3">Ücret</th>
                    <th className="py-2.5 px-3">Ödeme</th>
                    <th className="py-2.5 px-3">Oda</th>
                    <th className="py-2.5 px-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedSessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Bu filtreye uygun seans bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    displayedSessions.map((s) => {
                      const isZero = (Number(s.price) || 0) === 0 && s.type !== 'cancelled';
                      const isEditingPrice = editingPriceId === s.id;

                      return (
                        <tr 
                          key={s.id} 
                          className={`hover:bg-slate-50/80 transition-colors ${isZero ? 'bg-amber-50/40' : ''}`}
                        >
                          <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                            {new Date(s.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                            <span className="text-slate-400 ml-1.5">{s.time}</span>
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-800">
                            {formatClientName(s.clientName)}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {s.type === 'online' ? 'Online' : s.type === 'face-to-face' ? 'Yüz Yüze' : 'İptal'}
                          </td>
                          <td className="py-2 px-3 font-medium">
                            {isEditingPrice ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={tempPriceInput}
                                  onChange={(e) => setTempPriceInput(e.target.value)}
                                  className="w-20 px-1.5 py-0.5 text-xs border border-slate-300 rounded bg-white font-medium"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSavePrice(s.id);
                                    if (e.key === 'Escape') setEditingPriceId(null);
                                  }}
                                />
                                <button
                                  onClick={() => handleSavePrice(s.id)}
                                  className="p-1 bg-slate-900 text-white rounded hover:bg-slate-800"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div 
                                onClick={() => handleStartEditPrice(s)}
                                className={`cursor-pointer inline-flex items-center gap-1 group ${
                                  isZero ? 'text-amber-700 font-semibold' : 'text-slate-800'
                                }`}
                                title="Fiyatı değiştirmek için tıkla"
                              >
                                {formatMoney(Number(s.price) || 0)}
                                <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-slate-400" />
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <button
                              onClick={() => {
                                if (onUpdateSessionPaymentStatus) {
                                  const next = s.paymentStatus === 'paid' ? 'unpaid' : 'paid';
                                  onUpdateSessionPaymentStatus(s.id, next);
                                }
                              }}
                              className={`text-[11px] font-medium transition-colors cursor-pointer ${
                                s.paymentStatus === 'paid'
                                  ? 'text-emerald-700 hover:text-emerald-800'
                                  : s.paymentStatus === 'partial'
                                  ? 'text-amber-700 hover:text-amber-800'
                                  : 'text-slate-500 hover:text-slate-700'
                              }`}
                              title="Değiştirmek için tıkla"
                            >
                              {s.paymentStatus === 'paid' ? '✓ Ödendi' : s.paymentStatus === 'partial' ? 'Kısmi' : 'Bekliyor'}
                            </button>
                          </td>
                          <td className="py-2 px-3 text-slate-500 text-[11px]">
                            {s.type === 'face-to-face' ? (s.roomId || '-') : '-'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {onEditSession && (
                              <button
                                onClick={() => {
                                  onEditSession(s);
                                }}
                                className="text-[11px] text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                              >
                                Düzenle
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Minimal Confirmation Note */}
          {!isClosed && (
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmationChecked}
                onChange={(e) => setConfirmationChecked(e.target.checked)}
                className="w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-slate-400"
              />
              <span className="text-xs text-slate-700 font-medium">
                Seansları kontrol ettim, {summary.monthLabel} ayını kapatmayı onaylıyorum.
              </span>
            </label>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
          >
            Vazgeç
          </button>

          <div>
            {isClosed ? (
              <button
                onClick={handleReopen}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-100 transition-colors flex items-center gap-1.5"
              >
                <Unlock className="w-3.5 h-3.5 text-slate-500" />
                Kilidi Aç
              </button>
            ) : (
              <button
                onClick={handleConfirmClose}
                disabled={!confirmationChecked}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                  confirmationChecked
                    ? 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer active:scale-95 shadow-xs'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                Ayı Kapat
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthClosingModal;
