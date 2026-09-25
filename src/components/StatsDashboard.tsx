import React, { useMemo, useState } from 'react';
import { Session, AppSettings, Expense, ExpenseCategory } from '../types';
import { 
  ChevronLeft, 
  ChevronRight, 
  Lock, 
  Search, 
  X, 
  Plus, 
  Trash2, 
  Edit2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { usePrivacy } from '../context/PrivacyContext';
import { formatMonthKey, isMonthClosed } from '../utils/monthCloseUtils';
import { getTodayLocalDate } from '../utils/dateUtils';

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, { label: string; color: string }> = {
  salary: { label: 'Maaş & Personel', color: 'text-indigo-700' },
  utilities: { label: 'Fatura & Abonelik', color: 'text-blue-700' },
  rent: { label: 'Ofis Kirası & Aidat', color: 'text-amber-800' },
  maintenance: { label: 'Bakım & Temizlik', color: 'text-cyan-700' },
  supplies: { label: 'Mutfak & Sarf', color: 'text-emerald-700' },
  marketing: { label: 'Pazarlama & Reklam', color: 'text-purple-700' },
  tax: { label: 'Vergi & Resmi', color: 'text-rose-700' },
  other: { label: 'Diğer Kasadan Ödeme', color: 'text-slate-700' }
};

export const PAYMENT_METHODS = {
  cash: { label: 'Nakit / Kasa' },
  bank: { label: 'Banka / Havale' },
  card: { label: 'Kredi Kartı' }
};

export interface StatsDashboardProps {
  sessions: Session[];
  settings: AppSettings;
  expenses?: Expense[];
  onAddExpense?: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  onUpdateExpense?: (expense: Expense) => void;
  onDeleteExpense?: (id: string) => void;
  showExplanations?: boolean;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateToAudit?: () => void;
  setActiveTab?: (tab: any) => void;
  onOpenMonthClosingModal?: (monthKey?: string) => void;
  onTogglePayment?: (sessionId: string) => void;
  onEditSession?: (session: Session) => void;
}

export default function StatsDashboard({
  sessions,
  settings,
  expenses = [],
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  showToast,
  onOpenMonthClosingModal,
  onTogglePayment,
  onEditSession
}: StatsDashboardProps) {
  const { formatMoney, formatClientName } = usePrivacy();

  // Selected Month (Default: current month in "YYYY-MM" format)
  const currentMonthKey = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(currentMonthKey);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Secondary Collapsible for General Clinic Expenses (Preserves logic without cluttering main view)
  const [isExpensesSectionOpen, setIsExpensesSectionOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('utilities');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => getTodayLocalDate());

  // Check if selected month is closed
  const isCurrentMonthClosed = useMemo(() => {
    return isMonthClosed(selectedMonthKey, settings.closedMonths);
  }, [selectedMonthKey, settings.closedMonths]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonthKey.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonthKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonthKey.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonthKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Sessions belonging to selected month (excluding non-sessions)
  const monthSessions = useMemo(() => {
    return sessions
      .filter(s => s.type !== 'non-session' && s.date && s.date.startsWith(selectedMonthKey))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || '').localeCompare(b.time || '');
      });
  }, [sessions, selectedMonthKey]);

  // General clinic expenses belonging to selected month
  const monthCustomExpenses = useMemo(() => {
    return expenses.filter(e => e.date && e.date.startsWith(selectedMonthKey));
  }, [expenses, selectedMonthKey]);

  // Financial Summary calculation
  const summary = useMemo(() => {
    let totalGross = 0;
    let paidAmount = 0;
    let pendingAmount = 0;
    let activeSessionCount = 0;

    monthSessions.forEach(s => {
      if (s.type === 'cancelled') return;
      activeSessionCount++;

      const price = Number(s.price) || 0;
      totalGross += price;

      if (s.paymentStatus === 'paid') {
        paidAmount += price;
      } else if (s.paymentStatus === 'partial') {
        const paid = Number(s.paidAmount) || 0;
        paidAmount += paid;
        pendingAmount += Math.max(0, price - paid);
      } else {
        pendingAmount += price;
      }
    });

    const customExpensesTotal = monthCustomExpenses.reduce(
      (acc, e) => acc + (Number(e.amount) || 0), 
      0
    );

    const netIncome = Math.max(0, paidAmount - customExpensesTotal);

    return {
      totalGross,
      paidAmount,
      pendingAmount,
      sessionCount: activeSessionCount,
      customExpensesTotal,
      netIncome
    };
  }, [monthSessions, monthCustomExpenses]);

  // Filtered sessions for the main table
  const filteredSessions = useMemo(() => {
    let list = monthSessions.filter(s => s.type !== 'cancelled');

    if (filter === 'paid') {
      list = list.filter(s => s.paymentStatus === 'paid');
    } else if (filter === 'pending') {
      list = list.filter(s => s.paymentStatus !== 'paid');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => 
        (s.clientName || '').toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [monthSessions, filter, searchQuery]);

  // Quick stats counts for filters
  const paidCount = useMemo(() => {
    return monthSessions.filter(s => s.type !== 'cancelled' && s.paymentStatus === 'paid').length;
  }, [monthSessions]);

  const pendingCount = useMemo(() => {
    return monthSessions.filter(s => s.type !== 'cancelled' && s.paymentStatus !== 'paid').length;
  }, [monthSessions]);

  // Format helpers
  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}.${parts[1]}`;
  };

  const formatLongDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  };

  // Toggle single session payment
  const handlePaymentToggle = (sessionId: string) => {
    if (isCurrentMonthClosed) {
      showToast?.('Bu ay kapatıldığı için seans durumu değiştirilemez.', 'info');
      return;
    }
    if (onTogglePayment) {
      onTogglePayment(sessionId);
    }
  };

  // Expense modal handlers
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expenseAmount.replace(',', '.'));
    if (!expenseTitle.trim()) {
      showToast?.('Lütfen gider başlığı giriniz.', 'error');
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast?.('Lütfen geçerli bir tutar giriniz.', 'error');
      return;
    }

    if (editingExpense) {
      onUpdateExpense?.({
        ...editingExpense,
        title: expenseTitle.trim(),
        category: expenseCategory,
        amount: amountNum,
        date: expenseDate
      });
      showToast?.('Gider başarıyla güncellendi.', 'success');
    } else {
      onAddExpense?.({
        title: expenseTitle.trim(),
        category: expenseCategory,
        amount: amountNum,
        date: expenseDate,
        paymentMethod: 'cash'
      });
      showToast?.('Gider başarıyla eklendi.', 'success');
    }

    setIsExpenseModalOpen(false);
  };

  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    setExpenseTitle('');
    setExpenseCategory('utilities');
    setExpenseAmount('');
    setExpenseDate(`${selectedMonthKey}-01`);
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (item: Expense) => {
    setEditingExpense(item);
    setExpenseTitle(item.title);
    setExpenseCategory(item.category);
    setExpenseAmount(String(item.amount));
    setExpenseDate(item.date);
    setIsExpenseModalOpen(true);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* 1. TOP HEADER: MONTH TITLE, STATUS & NAVIGATION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#e5e1d8]">
        
        {/* Month Title & Status Badge */}
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 uppercase">
              {formatMonthKey(selectedMonthKey)}
            </h2>

            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              isCurrentMonthClosed 
                ? 'bg-slate-100 text-slate-700 border-slate-300' 
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isCurrentMonthClosed ? 'bg-slate-500' : 'bg-emerald-600'}`} />
              {isCurrentMonthClosed ? 'Kapatıldı' : 'Açık'}
            </span>
          </div>

          {/* Month Status Hint */}
          {isCurrentMonthClosed ? (
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 font-medium">
              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Bu ay kapatıldı. Takvimde yapılan sonraki değişiklikler bu aya uygulanmaz.</span>
            </p>
          ) : (
            onOpenMonthClosingModal && (
              <button
                type="button"
                onClick={() => onOpenMonthClosingModal(selectedMonthKey)}
                className="text-xs text-slate-500 hover:text-slate-900 mt-1.5 inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Ayı Kapat</span>
              </button>
            )
          )}
        </div>

        {/* Month Selector Buttons: [ Önceki Ay ] [ Bu Ay ] [ Sonraki Ay ] */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="px-3 py-1.5 rounded-xl border border-[#e5e1d8] bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1 transition-all cursor-pointer shadow-3xs"
            title="Önceki Ay"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Önceki Ay</span>
          </button>

          {selectedMonthKey !== currentMonthKey && (
            <button
              type="button"
              onClick={() => setSelectedMonthKey(currentMonthKey)}
              className="px-2.5 py-1.5 rounded-xl border border-[#e5e1d8] bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 transition-all cursor-pointer shadow-3xs"
              title="Mevcut Aya Dön"
            >
              Bu Ay
            </button>
          )}

          <button
            type="button"
            onClick={handleNextMonth}
            className="px-3 py-1.5 rounded-xl border border-[#e5e1d8] bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1 transition-all cursor-pointer shadow-3xs"
            title="Sonraki Ay"
          >
            <span>Sonraki Ay</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. FINANCIAL SUMMARY: 4 CLEAN MINIMAL METRICS (TOPLAM, ÖDENEN, BEKLEYEN, SEANS) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-2">
        <div className="p-4 bg-white rounded-2xl border border-[#e5e1d8] shadow-3xs space-y-1">
          <p className="text-xs font-medium text-slate-500">Toplam</p>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {formatMoney(summary.totalGross)}
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e5e1d8] shadow-3xs space-y-1">
          <p className="text-xs font-medium text-emerald-700">Ödenen</p>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600">
            {formatMoney(summary.paidAmount)}
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e5e1d8] shadow-3xs space-y-1">
          <p className="text-xs font-medium text-amber-700">Bekleyen</p>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-600">
            {formatMoney(summary.pendingAmount)}
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#e5e1d8] shadow-3xs space-y-1">
          <p className="text-xs font-medium text-slate-500">Seans</p>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-700">
            {summary.sessionCount} seans
          </p>
        </div>
      </div>

      {/* 3. FILTERS BAR: TÜMÜ | ÖDENDİ | BEKLEYEN + QUIET SEARCH */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="inline-flex items-center p-1 bg-[#f5f5f0] border border-[#e5e1d8] rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tümü ({summary.sessionCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('paid')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              filter === 'paid'
                ? 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ödendi ({paidCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              filter === 'pending'
                ? 'bg-white text-amber-800 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bekliyor ({pendingCount})
          </button>
        </div>

        {/* Client Search Input (clean and secondary) */}
        {monthSessions.length > 3 && (
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Danışan ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] placeholder:text-slate-400 shadow-3xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. MAIN ACCOUNTING TABLE (RESPONSIVE: CLASSIC TABLE ON DESKTOP, CLEAN CARDS ON MOBILE) */}
      <div className="bg-white rounded-2xl border border-[#e5e1d8] shadow-3xs overflow-hidden">
        {filteredSessions.length === 0 ? (
          <div className="py-14 px-4 text-center">
            <p className="text-sm font-semibold text-slate-700">Bu ay için seans bulunamadı</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery 
                ? 'Arama kriterlerinize uygun seans kaydı bulunmuyor.' 
                : 'Telefon takviminizdeki seanslar otomatik olarak senkronize edilir.'}
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE: Tarih | Seans | Süre | Ücret | Durum */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e5e1d8] bg-[#fdfbf7]/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4 w-28">Tarih</th>
                    <th className="py-3 px-4">Seans</th>
                    <th className="py-3 px-4 w-28">Süre</th>
                    <th className="py-3 px-4 w-36 text-right">Ücret</th>
                    <th className="py-3 px-4 w-32 text-center">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f5f5f0]">
                  {filteredSessions.map(session => {
                    const isPaid = session.paymentStatus === 'paid';
                    return (
                      <tr 
                        key={session.id}
                        onClick={() => onEditSession?.(session)}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                      >
                        {/* Tarih */}
                        <td className="py-3.5 px-4 text-xs font-semibold text-slate-600">
                          {formatShortDate(session.date)}
                        </td>

                        {/* Seans (Danışan) */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 text-sm">
                            {formatClientName(session.clientName)}
                          </div>
                          {session.notes && (
                            <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                              {session.notes}
                            </div>
                          )}
                        </td>

                        {/* Süre */}
                        <td className="py-3.5 px-4 text-xs text-slate-500 font-medium">
                          {session.duration || 50} dk
                        </td>

                        {/* Ücret */}
                        <td className="py-3.5 px-4 text-sm font-bold text-slate-900 text-right">
                          {formatMoney(session.price)}
                        </td>

                        {/* Durum (Tek Tıkla Ödendi / Bekliyor Değiştir) */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePaymentToggle(session.id);
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer select-none ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 shadow-3xs'
                                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 shadow-3xs'
                            }`}
                            title="Ödeme durumunu değiştirmek için tıklayın"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                            {isPaid ? 'Ödendi' : 'Bekliyor'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE VIEW: Satır / Kart Yapısı */}
            {/*
              Ahmet Yılmaz
              02 Eylül · 60 dk
              1.500 TL                    Ödendi
            */}
            <div className="divide-y divide-[#f5f5f0] md:hidden">
              {filteredSessions.map(session => {
                const isPaid = session.paymentStatus === 'paid';
                return (
                  <div 
                    key={session.id}
                    onClick={() => onEditSession?.(session)}
                    className="p-4 flex flex-col gap-2 hover:bg-slate-50/70 transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {formatClientName(session.clientName)}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 font-medium">
                        {formatLongDate(session.date)} · {session.duration || 50} dk
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-base font-bold text-slate-900">
                        {formatMoney(session.price)}
                      </span>

                      {/* Durum Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePaymentToggle(session.id);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer select-none ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                        }`}
                        title="Ödeme durumunu değiştirmek için tıklayın"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                        {isPaid ? 'Ödendi' : 'Bekliyor'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 5. SECONDARY SECTION: KLİNİK GİDERLERİ & NET KÂR (COLLAPSIBLE / NON-INTRUSIVE) */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setIsExpensesSectionOpen(!isExpensesSectionOpen)}
          className="flex items-center justify-between w-full py-2.5 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-[#f5f5f0]/60 hover:bg-[#f5f5f0] rounded-xl border border-[#e5e1d8] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span>Klinik Giderleri & Net Kâr</span>
            {summary.customExpensesTotal > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                {formatMoney(summary.customExpensesTotal)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <span>{isExpensesSectionOpen ? 'Gizle' : 'Detay'}</span>
            {isExpensesSectionOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </div>
        </button>

        {isExpensesSectionOpen && (
          <div className="mt-3 p-4 bg-white rounded-2xl border border-[#e5e1d8] shadow-3xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#f5f5f0]">
              <div>
                <p className="text-xs font-bold text-slate-800">Ay Sonu Net Kâr</p>
                <p className="text-xl font-bold text-[#6b705c] mt-0.5">
                  {formatMoney(summary.netIncome)}
                </p>
              </div>

              {onAddExpense && (
                <button
                  type="button"
                  onClick={handleOpenAddExpense}
                  className="px-3 py-1.5 bg-[#6b705c] hover:bg-[#585c4c] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Gider Ekle</span>
                </button>
              )}
            </div>

            {/* Expenses List */}
            {monthCustomExpenses.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">Bu ay için kaydedilmiş genel klinik gideri yok.</p>
            ) : (
              <div className="divide-y divide-[#f5f5f0]">
                {monthCustomExpenses.map(item => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-800">{item.title}</p>
                      <p className="text-[10px] text-slate-400">{item.date} · {EXPENSE_CATEGORIES[item.category]?.label || 'Genel'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-rose-600">-{formatMoney(item.amount)}</span>
                      {onUpdateExpense && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditExpense(item)}
                          className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteExpense && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Bu gideri silmek istediğinize emin misiniz?')) {
                              onDeleteExpense(item.id);
                              showToast?.('Gider silindi.', 'info');
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* EXPENSE ADD / EDIT MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-[#e5e1d8] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#f5f5f0]">
              <h3 className="text-sm font-bold text-slate-800">
                {editingExpense ? 'Gideri Düzenle' : 'Yeni Klinik Gideri'}
              </h3>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Gider Başlığı</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Ofis internet faturası"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tutar (₺)</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] bg-white"
                >
                  {Object.entries(EXPENSE_CATEGORIES).map(([key, meta]) => (
                    <option key={key} value={key}>{meta.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tarih</label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-[#e5e1d8] text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-[#6b705c] hover:bg-[#585c4c] text-white font-semibold"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
