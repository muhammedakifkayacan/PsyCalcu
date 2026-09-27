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
  ChevronUp,
  CheckCircle,
  AlertCircle,
  Clock,
  List,
  Users,
  User,
  ExternalLink
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

export type StatsViewMode = 'flat' | 'grouped';

export interface StatsClientGroup {
  clientKey: string;
  clientName: string;
  sessions: Session[];
  totalSessions: number;
  totalRevenue: number;
  totalPaid: number;
  totalPending: number;
  isAllPaid: boolean;
  hasPending: boolean;
  hasZeroPrice: boolean;
}

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
  onOpenClientHistory?: (clientName: string) => void;
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
  onEditSession,
  onOpenClientHistory
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

  // View Mode: 'flat' (classic row list) vs 'grouped' (accordion groups by client)
  const [viewMode, setViewMode] = useState<StatsViewMode>(() => {
    try {
      const saved = localStorage.getItem('psycalcu_stats_view_mode');
      return (saved === 'grouped' || saved === 'flat') ? saved : 'flat';
    } catch {
      return 'flat';
    }
  });

  const [expandedClientKeys, setExpandedClientKeys] = useState<Set<string>>(new Set());

  const handleSetViewMode = (mode: StatsViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('psycalcu_stats_view_mode', mode);
    } catch {}
  };

  const toggleClientExpanded = (key: string) => {
    setExpandedClientKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedClientKeys(new Set(groupedClients.map(g => g.clientKey)));
  };

  const handleCollapseAll = () => {
    setExpandedClientKeys(new Set());
  };

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

  // Grouped clients for the hierarchical accordion view
  const groupedClients = useMemo<StatsClientGroup[]>(() => {
    const groupsMap = new Map<string, StatsClientGroup>();

    filteredSessions.forEach(s => {
      const key = (s.clientName || 'İsimsiz / Kişisel').trim();
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          clientKey: key,
          clientName: key,
          sessions: [],
          totalSessions: 0,
          totalRevenue: 0,
          totalPaid: 0,
          totalPending: 0,
          isAllPaid: false,
          hasPending: false,
          hasZeroPrice: false,
        });
      }

      const group = groupsMap.get(key)!;
      group.sessions.push(s);
      group.totalSessions++;

      const price = Number(s.price) || 0;
      group.totalRevenue += price;
      if (price === 0 && s.type !== 'cancelled') {
        group.hasZeroPrice = true;
      }

      if (s.paymentStatus === 'paid') {
        group.totalPaid += price;
      } else if (s.paymentStatus === 'partial') {
        const paid = Number(s.paidAmount) || 0;
        group.totalPaid += paid;
        group.totalPending += Math.max(0, price - paid);
      } else {
        group.totalPending += price;
      }
    });

    const list = Array.from(groupsMap.values()).map(g => ({
      ...g,
      isAllPaid: g.totalPending === 0 && g.totalRevenue > 0,
      hasPending: g.totalPending > 0,
      sessions: g.sessions.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || '').localeCompare(b.time || '');
      })
    }));

    return list.sort((a, b) => a.clientName.localeCompare(b.clientName, 'tr-TR'));
  }, [filteredSessions]);

  // Quick stats counts for filters
  const paidCount = useMemo(() => {
    return monthSessions.filter(s => s.type !== 'cancelled' && s.paymentStatus === 'paid').length;
  }, [monthSessions]);

  const pendingCount = useMemo(() => {
    return monthSessions.filter(s => s.type !== 'cancelled' && s.paymentStatus !== 'paid').length;
  }, [monthSessions]);

  // Format helpers (uses textual/abbreviated Turkish month names instead of numbers)
  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
      const d = new Date(year, month, day);
      return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  const formatLongDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
      const d = new Date(year, month, day);
      return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
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

      {/* 3. FILTERS & VIEW MODE BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filters */}
          <div className="inline-flex items-center p-1 bg-[#f5f5f0] border border-[#e5e1d8] rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
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
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
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
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                filter === 'pending'
                  ? 'bg-white text-amber-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bekliyor ({pendingCount})
            </button>
          </div>

          {/* View Mode Switcher: Düz Liste vs Danışan Grupları */}
          <div className="inline-flex items-center p-1 bg-[#f5f5f0] border border-[#e5e1d8] rounded-xl text-xs">
            <button
              type="button"
              onClick={() => handleSetViewMode('flat')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'flat'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Standart satır satır liste görünümü"
            >
              <List className="w-3.5 h-3.5 text-slate-500" />
              <span>Düz Liste</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('grouped')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-white text-[#6b705c] shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="İsimlere göre açılır sekmeli gruplar"
            >
              <Users className="w-3.5 h-3.5 text-[#6b705c]" />
              <span>Danışan Grupları</span>
            </button>
          </div>
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

      {/* Group Actions Bar when Grouped View is Active */}
      {viewMode === 'grouped' && filteredSessions.length > 0 && (
        <div className="flex items-center justify-between px-1 text-xs text-slate-500 pt-1">
          <span className="font-semibold text-slate-700">
            Aylık <strong>{groupedClients.length}</strong> Danışan Grubu ({filteredSessions.length} seans)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExpandAll}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-[#e5e1d8] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-3xs text-[11px]"
              title="Tüm danışan gruplarını genişlet"
            >
              <ChevronDown className="w-3 h-3 text-slate-500" />
              <span>Tümünü Aç</span>
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-[#e5e1d8] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-3xs text-[11px]"
              title="Tüm danışan gruplarını kapat"
            >
              <ChevronUp className="w-3 h-3 text-slate-500" />
              <span>Tümünü Kapat</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. MAIN ACCOUNTING DISPLAY (FLAT LIST OR GROUPED ACCORDION VIEW) */}
      {filteredSessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e5e1d8] shadow-3xs py-14 px-4 text-center">
          <p className="text-sm font-semibold text-slate-700">Bu ay için seans bulunamadı</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery 
              ? 'Arama kriterlerinize uygun seans kaydı bulunmuyor.' 
              : 'Telefon takviminizdeki seanslar otomatik olarak senkronize edilir.'}
          </p>
        </div>
      ) : viewMode === 'flat' ? (
        /* ========================================================================= */
        /* VIEW 1: FLAT STANDARD TABLE                                              */
        /* ========================================================================= */
        <div className="bg-white rounded-2xl border border-[#e5e1d8] shadow-3xs overflow-hidden">
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
                  const isPartial = session.paymentStatus === 'partial';
                  const isZero = (Number(session.price) || 0) === 0 && session.type !== 'cancelled';
                  return (
                    <tr 
                      key={session.id}
                      onClick={() => onEditSession?.(session)}
                      className={`transition-colors cursor-pointer group ${
                        isPaid
                          ? 'bg-emerald-50/80 hover:bg-emerald-100/80 border-l-4 border-l-emerald-500 text-emerald-950 font-medium'
                          : isPartial
                          ? 'bg-amber-50/80 hover:bg-amber-100/80 border-l-4 border-l-amber-500'
                          : isZero
                          ? 'bg-amber-50/40 hover:bg-amber-100/50 border-l-4 border-l-amber-400'
                          : 'bg-white hover:bg-slate-50 border-l-4 border-l-slate-200'
                      }`}
                    >
                      {/* Tarih */}
                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {formatShortDate(session.date)}
                      </td>

                      {/* Seans (Danışan) */}
                      <td className="py-3.5 px-4">
                        <div className={`font-semibold text-sm ${isPaid ? 'text-emerald-950' : 'text-slate-900'}`}>
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
                      <td className={`py-3.5 px-4 text-sm font-bold text-right ${isPaid ? 'text-emerald-900 font-mono' : 'text-slate-900'}`}>
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
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer select-none shadow-3xs ${
                            isPaid
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : isPartial
                              ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                          }`}
                          title="Ödeme durumunu değiştirmek için tıklayın"
                        >
                          {isPaid ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-white" />
                              <span>ÖDENDİ</span>
                            </>
                          ) : isPartial ? (
                            <>
                              <Clock className="w-3.5 h-3.5 text-amber-700" />
                              <span>KISMİ</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>BEKLİYOR</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE VIEW: Satır / Kart Yapısı */}
          <div className="divide-y divide-[#f5f5f0] md:hidden">
            {filteredSessions.map(session => {
              const isPaid = session.paymentStatus === 'paid';
              const isPartial = session.paymentStatus === 'partial';
              const isZero = (Number(session.price) || 0) === 0 && session.type !== 'cancelled';
              return (
                <div 
                  key={session.id}
                  onClick={() => onEditSession?.(session)}
                  className={`p-4 flex flex-col gap-2 transition-colors cursor-pointer ${
                    isPaid
                      ? 'bg-emerald-50/80 hover:bg-emerald-100/80 border-l-4 border-l-emerald-500'
                      : isPartial
                      ? 'bg-amber-50/80 hover:bg-amber-100/80 border-l-4 border-l-amber-500'
                      : isZero
                      ? 'bg-amber-50/40 hover:bg-amber-100/50 border-l-4 border-l-amber-400'
                      : 'bg-white hover:bg-slate-50 border-l-4 border-l-slate-200'
                  }`}
                >
                  <div>
                    <div className={`font-bold text-sm ${isPaid ? 'text-emerald-950' : 'text-slate-900'}`}>
                      {formatClientName(session.clientName)}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 font-medium">
                      {formatLongDate(session.date)} · {session.duration || 50} dk
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className={`text-base font-bold ${isPaid ? 'text-emerald-900 font-mono' : 'text-slate-900'}`}>
                      {formatMoney(session.price)}
                    </span>

                    {/* Durum Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePaymentToggle(session.id);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer select-none shadow-3xs ${
                        isPaid
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : isPartial
                          ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      }`}
                      title="Ödeme durumunu değiştirmek için tıklayın"
                    >
                      {isPaid ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-white" />
                          <span>ÖDENDİ</span>
                        </>
                      ) : isPartial ? (
                        <>
                          <Clock className="w-3.5 h-3.5 text-amber-700" />
                          <span>KISMİ</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>BEKLİYOR</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW 2: GROUPED BY CLIENT ACCORDION VIEW                                  */
        /* ========================================================================= */
        <div className="space-y-3">
          {groupedClients.map(group => {
            const isExpanded = expandedClientKeys.has(group.clientKey);

            return (
              <div
                key={group.clientKey}
                className={`border rounded-2xl transition-all overflow-hidden ${
                  isExpanded
                    ? 'border-[#6b705c]/40 bg-white shadow-md'
                    : group.isAllPaid
                    ? 'border-emerald-300 bg-emerald-50/15 hover:border-emerald-400 hover:shadow-xs'
                    : 'border-[#e5e1d8] bg-white hover:border-[#6b705c]/30 hover:shadow-xs'
                }`}
              >
                {/* Accordion Header */}
                <div
                  onClick={() => toggleClientExpanded(group.clientKey)}
                  className={`p-3.5 sm:p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                    isExpanded
                      ? 'bg-[#fdfbf7] border-b border-[#e5e1d8]'
                      : group.isAllPaid
                      ? 'bg-emerald-50/30 hover:bg-emerald-50/60'
                      : 'hover:bg-[#fdfbf7]/60'
                  }`}
                >
                  {/* Left: Chevron, Avatar, Name & Badges */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                      <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-[#6b705c]' : ''}`} />
                    </div>

                    <div className="w-7 h-7 rounded-xl bg-[#6b705c]/15 text-[#6b705c] flex items-center justify-center font-bold text-xs shrink-0">
                      <User className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {onOpenClientHistory && group.clientKey !== 'İsimsiz / Kişisel' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenClientHistory(group.clientName);
                            }}
                            className="font-bold text-slate-900 text-sm hover:text-emerald-700 hover:underline cursor-pointer text-left truncate transition-colors"
                            title={`${group.clientName} danışan sayfasını aç`}
                          >
                            {formatClientName(group.clientName)}
                          </button>
                        ) : (
                          <span className="font-bold text-slate-900 text-sm truncate">
                            {formatClientName(group.clientName)}
                          </span>
                        )}

                        {/* Session Count Badge */}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                          {group.totalSessions} Seans
                        </span>

                        {/* Paid Badge */}
                        {group.isAllPaid && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0 shadow-3xs">
                            <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                            Tamamı Ödendi
                          </span>
                        )}

                        {/* Pending Debt Badge */}
                        {group.hasPending && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200 shrink-0">
                            <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
                            {formatMoney(group.totalPending)} Borç
                          </span>
                        )}

                        {/* Zero Price Warning Badge */}
                        {group.hasZeroPrice && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                            ⚠️ 0 ₺ Seans
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Financial Totals */}
                  <div className="flex items-center gap-3 sm:gap-4 ml-auto md:ml-0 shrink-0 text-xs">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Toplam</span>
                      <span className="font-serif font-bold text-slate-800 text-sm sm:text-base">
                        {formatMoney(group.totalRevenue)}
                      </span>
                    </div>

                    <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />

                    <div className="text-right">
                      <span className="text-[10px] text-emerald-600 font-bold block uppercase tracking-wider">Tahsil Edilen</span>
                      <span className="font-serif font-bold text-emerald-700 text-xs sm:text-sm">
                        {formatMoney(group.totalPaid)}
                      </span>
                    </div>

                    {group.totalPending > 0 && (
                      <>
                        <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />
                        <div className="text-right">
                          <span className="text-[10px] text-rose-600 font-bold block uppercase tracking-wider">Kalan Borç</span>
                          <span className="font-serif font-bold text-rose-700 text-xs sm:text-sm">
                            {formatMoney(group.totalPending)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded Body: Group Sessions */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-white">
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold border-b border-slate-100 uppercase tracking-wider">
                            <th className="py-2.5 px-4 w-28">Tarih</th>
                            <th className="py-2.5 px-4 w-24">Saat</th>
                            <th className="py-2.5 px-4 w-24">Süre</th>
                            <th className="py-2.5 px-4">Tür / Not</th>
                            <th className="py-2.5 px-4 w-32 text-right">Ücret</th>
                            <th className="py-2.5 px-4 w-32 text-center">Durum</th>
                            <th className="py-2.5 px-4 w-20 text-right">İşlem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {group.sessions.map(session => {
                            const isPaid = session.paymentStatus === 'paid';
                            const isPartial = session.paymentStatus === 'partial';
                            const isZero = (Number(session.price) || 0) === 0 && session.type !== 'cancelled';

                            return (
                              <tr
                                key={session.id}
                                onClick={() => onEditSession?.(session)}
                                className={`group/row hover:bg-[#fdfbf7] cursor-pointer transition-colors ${
                                  isPaid
                                    ? 'bg-emerald-50/70 hover:bg-emerald-100/70 border-l-4 border-l-emerald-500 font-medium'
                                    : isPartial
                                    ? 'bg-amber-50/80 hover:bg-amber-100/80 border-l-4 border-l-amber-500'
                                    : isZero
                                    ? 'bg-amber-50/30 border-l-4 border-l-amber-400'
                                    : 'border-l-4 border-l-transparent'
                                }`}
                              >
                                <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                                  {formatShortDate(session.date)}
                                </td>
                                <td className="py-3 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                                  {session.time || '00:00'}
                                </td>
                                <td className="py-3 px-4 text-slate-500">
                                  {session.duration || 50} dk
                                </td>
                                <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                                  <span className="inline-block mr-1.5">
                                    {session.type === 'online' ? '🌐 Online' : session.type === 'face-to-face' ? '🛋️ Yüz Yüze' : '❌ İptal'}
                                  </span>
                                  {session.notes && <span className="text-slate-400">· {session.notes}</span>}
                                </td>
                                <td className={`py-3 px-4 text-right font-bold ${isPaid ? 'text-emerald-900 font-mono' : 'text-slate-900'}`}>
                                  {formatMoney(session.price)}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePaymentToggle(session.id);
                                    }}
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer select-none shadow-3xs ${
                                      isPaid
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        : isPartial
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                                        : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                                    }`}
                                    title="Ödeme durumunu değiştirmek için tıklayın"
                                  >
                                    {isPaid ? (
                                      <>
                                        <CheckCircle className="w-3 h-3 text-white" />
                                        <span>ÖDENDİ</span>
                                      </>
                                    ) : isPartial ? (
                                      <>
                                        <Clock className="w-3 h-3 text-amber-700" />
                                        <span>KISMİ</span>
                                      </>
                                    ) : (
                                      <>
                                        <AlertCircle className="w-3 h-3 text-rose-600" />
                                        <span>BEKLİYOR</span>
                                      </>
                                    )}
                                  </button>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEditSession?.(session);
                                    }}
                                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                    title="Düzenle"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards for Group */}
                    <div className="divide-y divide-slate-100 md:hidden">
                      {group.sessions.map(session => {
                        const isPaid = session.paymentStatus === 'paid';
                        const isPartial = session.paymentStatus === 'partial';
                        return (
                          <div
                            key={session.id}
                            onClick={() => onEditSession?.(session)}
                            className={`p-3.5 flex flex-col gap-2 transition-colors cursor-pointer ${
                              isPaid
                                ? 'bg-emerald-50/70 border-l-4 border-l-emerald-500'
                                : isPartial
                                ? 'bg-amber-50/70 border-l-4 border-l-amber-500'
                                : 'border-l-4 border-l-transparent hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">
                                {formatLongDate(session.date)}
                              </span>
                              <span className="text-[11px] font-mono text-slate-500">
                                {session.time || '00:00'} · {session.duration || 50} dk
                              </span>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <span className={`text-sm font-bold ${isPaid ? 'text-emerald-900 font-mono' : 'text-slate-900'}`}>
                                {formatMoney(session.price)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePaymentToggle(session.id);
                                }}
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer shadow-3xs ${
                                  isPaid
                                    ? 'bg-emerald-600 text-white'
                                    : isPartial
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {isPaid ? '✓ ÖDENDİ' : isPartial ? '◐ KISMİ' : '○ BEKLİYOR'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Group Subtotal Footer */}
                    <div className="p-3 bg-[#fdfbf7] border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                      <div className="flex items-center gap-3 flex-wrap text-[11px]">
                        <span>Toplam: <strong className="text-slate-800">{group.sessions.length} Seans</strong></span>
                        <span>•</span>
                        <span>Tahsil Edilen: <strong className="text-emerald-700 font-semibold">{formatMoney(group.totalPaid)}</strong></span>
                        {group.totalPending > 0 && (
                          <>
                            <span>•</span>
                            <span>Kalan Borç: <strong className="text-rose-700 font-semibold">{formatMoney(group.totalPending)}</strong></span>
                          </>
                        )}
                      </div>

                      {onOpenClientHistory && group.clientKey !== 'İsimsiz / Kişisel' && (
                        <button
                          type="button"
                          onClick={() => onOpenClientHistory(group.clientName)}
                          className="text-[11px] font-bold text-[#6b705c] hover:text-[#585c4c] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Danışan Dosyası</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
