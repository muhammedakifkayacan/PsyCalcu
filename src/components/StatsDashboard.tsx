import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Session, AppSettings, Expense, ExpenseCategory } from '../types';
import { 
  Laptop, MapPin, Ban, ArrowUpRight, ArrowDownRight, TrendingUp, Calendar, Filter, Clock, Search, X, Coins,
  Plus, Edit2, Trash2, Building, Zap, UserCheck, ShoppingBag, Megaphone, Landmark, Sparkles, CreditCard, Wallet,
  Receipt, DollarSign, Tag, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePrivacy } from '../context/PrivacyContext';

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, { label: string; icon: any; color: string; bg: string; border: string }> = {
  salary: { label: 'Maaş & Personel', icon: UserCheck, color: 'text-indigo-700', bg: 'bg-indigo-50/90', border: 'border-indigo-200' },
  utilities: { label: 'Fatura & Abonelik', icon: Zap, color: 'text-blue-700', bg: 'bg-blue-50/90', border: 'border-blue-200' },
  rent: { label: 'Ofis Kirası & Aidat', icon: Building, color: 'text-amber-800', bg: 'bg-amber-50/90', border: 'border-amber-200' },
  maintenance: { label: 'Bakım & Temizlik', icon: Sparkles, color: 'text-cyan-700', bg: 'bg-cyan-50/90', border: 'border-cyan-200' },
  supplies: { label: 'Mutfak & Sarf', icon: ShoppingBag, color: 'text-emerald-700', bg: 'bg-emerald-50/90', border: 'border-emerald-200' },
  marketing: { label: 'Pazarlama & Reklam', icon: Megaphone, color: 'text-purple-700', bg: 'bg-purple-50/90', border: 'border-purple-200' },
  tax: { label: 'Vergi & Resmi', icon: Landmark, color: 'text-rose-700', bg: 'bg-rose-50/90', border: 'border-rose-200' },
  other: { label: 'Diğer Kasadan Ödeme', icon: Coins, color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' }
};

export const PAYMENT_METHODS = {
  cash: { label: 'Nakit / Kasa', icon: Wallet },
  bank: { label: 'Banka / Havale', icon: Landmark },
  card: { label: 'Kredi Kartı', icon: CreditCard }
};

interface StatsDashboardProps {
  sessions: Session[];
  settings: AppSettings;
  expenses?: Expense[];
  onAddExpense?: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  onUpdateExpense?: (expense: Expense) => void;
  onDeleteExpense?: (id: string) => void;
  showExplanations?: boolean;
  showToast?: (message: string, type?: 'success' | 'error' | 'info', extraData?: any, onUndo?: () => void, undoLabel?: string) => void;
}

export default function StatsDashboard({
  sessions,
  settings,
  expenses = [],
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  showExplanations = true,
  showToast
}: StatsDashboardProps) {
  const { formatMoney } = usePrivacy();
  const [preset, setPreset] = useState<string>('thisMonth');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedCard, setSelectedCard] = useState<'gross' | 'pending' | 'expenses' | 'net' | null>(null);
  const [detailSearchQuery, setDetailSearchQuery] = useState('');
  const [isHighlighted, setIsHighlighted] = useState(false);

  // Sub-tabs inside accounting details section
  const [expenseSubTab, setExpenseSubTab] = useState<'sessions' | 'general'>('general');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('all');

  // Modal State for Expenses
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('utilities');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formPaymentMethod, setFormPaymentMethod] = useState<'cash' | 'bank' | 'card'>('cash');
  const [formNotes, setFormNotes] = useState('');

  const handleCardClick = (cardType: 'gross' | 'pending' | 'expenses' | 'net') => {
    setSelectedCard(prev => {
      const next = prev === cardType ? null : cardType;
      if (next) {
        setIsHighlighted(true);
        setTimeout(() => setIsHighlighted(false), 2000);

        setTimeout(() => {
          const el = document.getElementById('accounting-details-section');
          if (el) {
            const header = document.querySelector('nav');
            const headerHeight = header ? header.offsetHeight : 80;
            const elementPosition = el.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - headerHeight - 16;

            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
          }
        }, 120);
      }
      return next;
    });
  };

  // Compute calculated start & end dates based on selected preset
  const dateRange = useMemo(() => {
    const today = new Date();
    const format = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'thisMonth') {
      const y = today.getFullYear();
      const m = today.getMonth();
      const firstDay = new Date(y, m, 1);
      const lastDay = new Date(y, m + 1, 0);
      return { start: format(firstDay), end: format(lastDay) };
    }

    if (preset === 'lastMonth') {
      const y = today.getFullYear();
      const m = today.getMonth();
      const firstDay = new Date(y, m - 1, 1);
      const lastDay = new Date(y, m, 0);
      return { start: format(firstDay), end: format(lastDay) };
    }

    if (preset === 'last30Days') {
      const startD = new Date();
      startD.setDate(today.getDate() - 30);
      return { start: format(startD), end: format(today) };
    }

    if (preset === 'last3Months') {
      const startD = new Date();
      startD.setMonth(today.getMonth() - 3);
      return { start: format(startD), end: format(today) };
    }

    if (preset === 'custom') {
      return { start: customStartDate, end: customEndDate };
    }

    // Default 'all'
    return { start: '', end: '' };
  }, [preset, customStartDate, customEndDate]);

  // Filter sessions by date range
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (s.type === 'non-session') return false;
      if (dateRange.start && s.date < dateRange.start) return false;
      if (dateRange.end && s.date > dateRange.end) return false;
      return true;
    });
  }, [sessions, dateRange]);

  // Filter general clinic custom expenses by date range
  const filteredCustomExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (dateRange.start && e.date < dateRange.start) return false;
      if (dateRange.end && e.date > dateRange.end) return false;
      return true;
    });
  }, [expenses, dateRange]);

  // Compute analytics including custom clinic expenses
  const analytics = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('sv-SE');
    let grossIncome = 0;
    let babysitterFees = 0;
    let officeRentExpenses = 0;
    let kdvExpenses = 0;
    let onlineCount = 0;
    let faceToFaceCount = 0;
    let cancelledCount = 0;
    let pendingReceivables = 0;
    let futureUnpaidIncome = 0;
    let sessionExpensesCount = 0;

    // Group by date for chart
    const dateGroups: Record<string, { date: string; gross: number; expenses: number; net: number }> = {};

    filteredSessions.forEach(s => {
      const sPrice = Number(s.price) || 0;
      const sBabyFee = s.hasBabysitterFee ? (Number(s.babysitterFeeAmount) || 0) : 0;
      const sOfficeFee = s.hasOfficeRentFee ? (Number(s.officeRentFeeAmount) || 0) : 0;
      const isInclusive = s.isKdvInclusive !== false;
      const kRate = s.kdvRate ?? settings.defaultKdvRate ?? 20;
      const sKdvCut = s.hasKDV 
        ? (s.kdvAmount ?? (isInclusive ? Math.round((sPrice * kRate) / (100 + kRate)) : Math.round((sPrice * kRate) / 100)))
        : 0;
      const sGross = s.hasKDV && !isInclusive ? (sPrice + sKdvCut) : sPrice;

      if (s.type === 'cancelled') {
        cancelledCount++;
      } else {
        if (s.type === 'online') {
          onlineCount++;
        } else {
          faceToFaceCount++;
        }

        const paidPart = s.paymentStatus === 'paid'
          ? sGross
          : (s.paymentStatus === 'partial' ? (Number(s.paidAmount) || 0) : 0);
        const unpaidPart = s.paymentStatus === 'paid'
          ? 0
          : (s.paymentStatus === 'partial' ? Math.max(0, sGross - (Number(s.paidAmount) || 0)) : sGross);

        if (paidPart > 0) {
          grossIncome += paidPart;
          babysitterFees += sBabyFee;
          officeRentExpenses += sOfficeFee;
          kdvExpenses += sKdvCut;
          if (sBabyFee > 0 || sOfficeFee > 0 || sKdvCut > 0) {
            sessionExpensesCount++;
          }
        }
        
        if (unpaidPart > 0) {
          if (s.date <= todayStr) {
            pendingReceivables += unpaidPart;
          } else {
            futureUnpaidIncome += unpaidPart;
          }
        }
      }

      // Grouping by date
      const dLabel = s.date;
      if (!dateGroups[dLabel]) {
        dateGroups[dLabel] = { date: dLabel, gross: 0, expenses: 0, net: 0 };
      }

      const paidPartForGroup = s.paymentStatus === 'paid'
        ? sGross
        : (s.paymentStatus === 'partial' ? (Number(s.paidAmount) || 0) : 0);

      if (s.type !== 'cancelled' && paidPartForGroup > 0) {
        dateGroups[dLabel].gross += paidPartForGroup;
        dateGroups[dLabel].expenses += (sBabyFee + sOfficeFee + sKdvCut);
      }
    });

    // Custom general expenses total
    const customExpensesTotal = filteredCustomExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Add custom expenses to date groups for bar chart accuracy
    filteredCustomExpenses.forEach(e => {
      const dLabel = e.date;
      if (!dateGroups[dLabel]) {
        dateGroups[dLabel] = { date: dLabel, gross: 0, expenses: 0, net: 0 };
      }
      dateGroups[dLabel].expenses += Number(e.amount) || 0;
    });

    const sessionExpensesTotal = babysitterFees + officeRentExpenses + kdvExpenses;
    const totalExpenses = sessionExpensesTotal + customExpensesTotal;
    const netIncome = Math.max(0, grossIncome - totalExpenses);

    // Convert date groups to sorted array for chart
    const chartData = Object.values(dateGroups)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-15)
      .map(g => {
        const parts = g.date.split('-');
        const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : g.date;
        return {
          tarih: formattedDate,
          'Brüt Gelir': g.gross,
          'Toplam Gider': g.expenses,
          'Net Gelir': Math.max(0, g.gross - g.expenses)
        };
      });

    // Session Type Data
    const typeData = [
      { name: 'Online', value: onlineCount, color: '#34d399' },
      { name: 'Yüzyüze', value: faceToFaceCount, color: '#f59e0b' },
      { name: 'İptal', value: cancelledCount, color: '#f87171' }
    ].filter(t => t.value > 0);

    return {
      grossIncome,
      babysitterFees,
      officeRentExpenses,
      kdvExpenses,
      sessionExpensesTotal,
      customExpensesTotal,
      totalExpenses,
      netIncome,
      pendingReceivables,
      futureUnpaidIncome,
      onlineCount,
      faceToFaceCount,
      cancelledCount,
      sessionExpensesCount,
      chartData,
      typeData
    };
  }, [filteredSessions, filteredCustomExpenses, settings.defaultKdvRate]);

  // Filter detailed list of sessions
  const detailedFilteredSessions = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('sv-SE');
    let list = filteredSessions;

    if (selectedCard === 'gross') {
      list = list.filter(s => s.type !== 'cancelled' && (s.paymentStatus === 'paid' || (s.paymentStatus === 'partial' && (s.paidAmount || 0) > 0)));
    } else if (selectedCard === 'pending') {
      list = list.filter(s => s.type !== 'cancelled' && s.paymentStatus !== 'paid' && s.date <= todayStr);
    } else if (selectedCard === 'expenses') {
      list = list.filter(s => s.type !== 'cancelled' && (s.paymentStatus === 'paid' || s.paymentStatus === 'partial') && (s.hasBabysitterFee || s.hasOfficeRentFee));
    } else if (selectedCard === 'net') {
      list = list.filter(s => s.type !== 'cancelled' && (s.paymentStatus === 'paid' || (s.paymentStatus === 'partial' && (s.paidAmount || 0) > 0)));
    }

    if (detailSearchQuery.trim()) {
      const q = detailSearchQuery.toLowerCase();
      list = list.filter(s => {
        const clientMatch = s.clientName?.toLowerCase().includes(q);
        const notesMatch = s.notes?.toLowerCase().includes(q);
        const dateMatch = s.date?.toLowerCase().includes(q);
        const timeMatch = s.time?.toLowerCase().includes(q);
        return clientMatch || notesMatch || dateMatch || timeMatch;
      });
    }

    return [...list].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.time.localeCompare(a.time);
    });
  }, [filteredSessions, selectedCard, detailSearchQuery]);

  // Filter general clinic expenses
  const detailedFilteredCustomExpenses = useMemo(() => {
    let list = filteredCustomExpenses;

    if (expenseCategoryFilter !== 'all') {
      list = list.filter(e => e.category === expenseCategoryFilter);
    }

    if (detailSearchQuery.trim()) {
      const q = detailSearchQuery.toLowerCase();
      list = list.filter(e => {
        const titleMatch = e.title?.toLowerCase().includes(q);
        const notesMatch = e.notes?.toLowerCase().includes(q);
        const dateMatch = e.date?.toLowerCase().includes(q);
        const categoryMatch = EXPENSE_CATEGORIES[e.category]?.label.toLowerCase().includes(q);
        return titleMatch || notesMatch || dateMatch || categoryMatch;
      });
    }

    return [...list].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [filteredCustomExpenses, expenseCategoryFilter, detailSearchQuery]);

  // Modal Handlers
  const handleOpenAddModal = () => {
    setEditingExpense(null);
    setFormTitle('');
    setFormCategory('utilities');
    setFormAmount('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormPaymentMethod('cash');
    setFormNotes('');
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setFormTitle(expense.title);
    setFormCategory(expense.category);
    setFormAmount(String(expense.amount));
    setFormDate(expense.date);
    setFormPaymentMethod(expense.paymentMethod || 'cash');
    setFormNotes(expense.notes || '');
    setIsExpenseModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(formAmount.replace(',', '.'));
    if (!formTitle.trim()) {
      showToast?.('Lütfen gider başlığı veya açıklamasını giriniz.', 'error');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast?.('Lütfen geçerli bir tutar giriniz.', 'error');
      return;
    }

    if (editingExpense) {
      onUpdateExpense?.({
        ...editingExpense,
        title: formTitle.trim(),
        category: formCategory,
        amount: parsedAmount,
        date: formDate,
        paymentMethod: formPaymentMethod,
        notes: formNotes.trim()
      });
    } else {
      onAddExpense?.({
        title: formTitle.trim(),
        category: formCategory,
        amount: parsedAmount,
        date: formDate,
        paymentMethod: formPaymentMethod,
        notes: formNotes.trim()
      });
    }

    setIsExpenseModalOpen(false);
  };

  return (
    <div className="space-y-6" id="stats-dashboard-container">
      
      {/* Date Range Selector Widget */}
      <div className="bg-white rounded-[2rem] border border-[#e5e1d8] p-6 shadow-sm space-y-4" id="accounting-date-filters">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[#6b705c]/10 rounded-xl flex items-center justify-center text-[#6b705c]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#6b705c] tracking-wider">MUHASEBE TARİH ARALIĞI</h4>
              {showExplanations && (
                <p className="text-xs text-slate-400 animate-fade-in">Raporları ve tüm gelir/gider grafiklerinizi dilediğiniz tarih aralığına göre süzün</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-xs font-semibold text-slate-500 bg-[#f5f5f0] px-3 py-1.5 rounded-full border border-[#e5e1d8]/50">
              Filtrelenen Seans: <span className="text-[#6b705c] font-bold">{filteredSessions.length} adet</span>
            </div>
            <div className="text-xs font-semibold text-slate-500 bg-[#f5f5f0] px-3 py-1.5 rounded-full border border-[#e5e1d8]/50">
              Klinik Gideri: <span className="text-rose-700 font-bold">{filteredCustomExpenses.length} adet</span>
            </div>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="flex flex-wrap gap-2 pt-1 relative z-10">
          {[
            { id: 'all', label: 'Tüm Zamanlar' },
            { id: 'thisMonth', label: 'Bu Ay' },
            { id: 'lastMonth', label: 'Geçen Ay' },
            { id: 'last30Days', label: 'Son 30 Gün' },
            { id: 'last3Months', label: 'Son 3 Ay' },
            { id: 'custom', label: 'Özel Aralık 📅' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`relative px-4 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                preset === p.id
                  ? 'text-white border-transparent'
                  : 'bg-[#fdfbf7] text-slate-600 border-[#e5e1d8] hover:bg-[#f5f5f0]'
              }`}
            >
              {preset === p.id && (
                <motion.div
                  layoutId="statsPresetTabIndicator"
                  className="absolute inset-0 bg-[#6b705c] rounded-xl -z-10 shadow-sm"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Pickers */}
        {preset === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#fdfbf7] p-4 rounded-2xl border border-[#e5e1d8]/60 max-w-xl animate-fadeIn">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#a5a58d] tracking-wider block">BAŞLANGIÇ TARİHİ</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#a5a58d] tracking-wider block">BİTİŞ TARİHİ</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Financial Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Income Card */}
        <div 
          onClick={() => handleCardClick('gross')}
          className={`p-5 rounded-[2rem] border transition-all cursor-pointer hover:scale-[1.01] hover:shadow-md flex flex-col justify-between group relative overflow-hidden ${
            selectedCard === 'gross' 
              ? 'border-emerald-500 ring-2 ring-emerald-500/15 bg-emerald-50/20 shadow-xs' 
              : 'bg-white border-[#e5e1d8] shadow-sm hover:border-[#6b705c]/30'
          }`}
          id="scorecard-gross"
        >
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] tracking-wider text-[#a5a58d] font-bold">ÖDENEN BRÜT GELİR</span>
              <span className={`p-1.5 rounded-full transition-colors ${selectedCard === 'gross' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'}`}>
                <ArrowUpRight className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-serif text-[#6b705c]">{formatMoney(analytics.grossIncome, { decimals: 2 })}</h3>
              <p className="text-[10px] text-slate-400 mt-1">Ödemesi tamamlanmış seans cirosu.</p>
            </div>
          </div>
          
          <div className="mt-3 pt-2.5 border-t border-dashed border-slate-100 flex items-center justify-between text-[10px] transition-all">
            {selectedCard === 'gross' ? (
              <>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  AKTİF FİLTRE
                </span>
                <span className="text-emerald-500/80 underline font-medium">Sıfırla</span>
              </>
            ) : (
              <>
                <span className="text-slate-400 group-hover:text-emerald-600 transition-colors">Aşağıda Listele</span>
                <span className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-y-0.5 transition-all">↴</span>
              </>
            )}
          </div>
        </div>

        {/* Pending Receivables Card */}
        <div 
          onClick={() => handleCardClick('pending')}
          className={`p-5 rounded-[2rem] border transition-all cursor-pointer hover:scale-[1.01] hover:shadow-md flex flex-col justify-between group relative overflow-hidden ${
            selectedCard === 'pending' 
              ? 'border-amber-500 ring-2 ring-amber-500/15 bg-amber-50/20 shadow-xs' 
              : 'bg-white border-[#e5e1d8] shadow-sm hover:border-[#6b705c]/30'
          }`}
          id="scorecard-pending"
        >
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] tracking-wider text-amber-600 font-bold">BEKLEYEN ALACAK</span>
              <span className={`p-1.5 rounded-full transition-colors ${selectedCard === 'pending' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600 group-hover:bg-amber-100'}`}>
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 space-y-2">
              <div>
                <h3 className="text-2xl font-serif text-amber-600">{formatMoney(analytics.pendingReceivables, { decimals: 2 })}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Tarihi bugün veya geçmişte olan, ödenmemiş seanslar.</p>
              </div>
              
              {(analytics.futureUnpaidIncome > 0 || analytics.grossIncome > 0) && (
                <div className="text-[10px] text-slate-500 border-t border-amber-500/10 pt-2 space-y-1">
                  {analytics.futureUnpaidIncome > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Gelecek Planlanan:</span>
                      <span className="font-semibold text-slate-600">{formatMoney(analytics.futureUnpaidIncome, { prefix: '+' })}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t border-slate-100/80 pt-1 font-bold text-[#6b705c]">
                    <span>Tahmini Toplam Ciro:</span>
                    <span>{formatMoney(analytics.grossIncome + analytics.pendingReceivables + analytics.futureUnpaidIncome)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-3 pt-2.5 border-t border-dashed border-slate-100 flex items-center justify-between text-[10px] transition-all">
            {selectedCard === 'pending' ? (
              <>
                <span className="font-bold text-amber-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  AKTİF FİLTRE
                </span>
                <span className="text-amber-500/80 underline font-medium">Sıfırla</span>
              </>
            ) : (
              <>
                <span className="text-slate-400 group-hover:text-amber-600 transition-colors">Aşağıda Listele</span>
                <span className="text-slate-300 group-hover:text-amber-500 group-hover:translate-y-0.5 transition-all">↴</span>
              </>
            )}
          </div>
        </div>

        {/* Total Expenses Card */}
        <div 
          onClick={() => handleCardClick('expenses')}
          className={`p-5 rounded-[2rem] border transition-all cursor-pointer hover:scale-[1.01] hover:shadow-md flex flex-col justify-between group relative overflow-hidden ${
            selectedCard === 'expenses' 
              ? 'border-orange-500 ring-2 ring-orange-500/15 bg-orange-50/20 shadow-xs' 
              : 'bg-white border-[#e5e1d8] shadow-sm hover:border-[#6b705c]/30'
          }`}
          id="scorecard-expenses"
        >
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] tracking-wider text-rose-600 font-bold">TOPLAM GİDERLER</span>
              <span className={`p-1.5 rounded-full transition-colors ${selectedCard === 'expenses' ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600 group-hover:bg-orange-100'}`}>
                <ArrowDownRight className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2 space-y-1">
              <h3 className="text-2xl font-serif text-slate-700">{formatMoney(analytics.totalExpenses, { decimals: 2 })}</h3>
              <p className="text-[10px] text-slate-400 leading-normal">
                {formatMoney(analytics.sessionExpensesTotal)} seans gideri
                {analytics.customExpensesTotal > 0 ? ` + ${formatMoney(analytics.customExpensesTotal)} genel klinik` : ''}
              </p>
            </div>
          </div>
          
          <div className="mt-3 pt-2.5 border-t border-dashed border-slate-100 flex items-center justify-between text-[10px] transition-all">
            {selectedCard === 'expenses' ? (
              <>
                <span className="font-bold text-orange-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                  AKTİF FİLTRE
                </span>
                <span className="text-orange-500/80 underline font-medium">Sıfırla</span>
              </>
            ) : (
              <>
                <span className="text-slate-400 group-hover:text-orange-600 transition-colors">Gider Yönetimi</span>
                <span className="text-slate-300 group-hover:text-orange-500 group-hover:translate-y-0.5 transition-all">↴</span>
              </>
            )}
          </div>
        </div>

        {/* Net Profit Card */}
        <div 
          onClick={() => handleCardClick('net')}
          className={`p-5 rounded-[2rem] border transition-all cursor-pointer hover:scale-[1.01] hover:shadow-md flex flex-col justify-between group relative overflow-hidden ${
            selectedCard === 'net' 
              ? 'bg-[#505445] border-[#505445] text-white shadow-md' 
              : 'bg-[#6b705c] text-white border-[#6b705c] shadow-sm hover:bg-[#5f6352]'
          }`}
          id="scorecard-net"
        >
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[10px] tracking-wider text-white/80 font-bold">DÖNEM NET KÂR</span>
              <span className="p-1.5 rounded-full bg-white/15 text-white transition-colors group-hover:bg-white/25">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-serif">{formatMoney(analytics.netIncome, { decimals: 2 })}</h3>
              <p className="text-[10px] text-white/70 mt-1">Tüm giderler düşülmüş net kazanç.</p>
            </div>
          </div>
          
          <div className="mt-3 pt-2.5 border-t border-dashed border-white/10 flex items-center justify-between text-[10px] transition-all">
            {selectedCard === 'net' ? (
              <>
                <span className="font-bold text-white flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                  AKTİF FİLTRE
                </span>
                <span className="text-white/80 underline font-medium">Sıfırla</span>
              </>
            ) : (
              <>
                <span className="text-white/60 group-hover:text-white transition-colors">Aşağıda Listele</span>
                <span className="text-white/40 group-hover:text-white group-hover:translate-y-0.5 transition-all">↴</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Details & Accounting Explorer */}
      <div 
        className={`rounded-[2rem] border p-6 space-y-5 animate-fadeIn transition-all duration-700 ${
          isHighlighted 
            ? 'bg-amber-50/20 border-amber-400 ring-4 ring-amber-500/20 shadow-md scale-[1.005]' 
            : 'bg-white border-[#e5e1d8] shadow-sm'
        }`} 
        id="accounting-details-section"
      >
        {selectedCard && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50/60 text-amber-900 text-xs rounded-2xl border border-amber-200 animate-fadeIn">
            <span className="text-sm">✨</span>
            <div className="flex-1 leading-relaxed">
              <span className="font-bold text-amber-800">Seçtiğiniz alana ait döküm listeleniyor: </span>
              <span className="text-slate-600">
                Aşağıdaki tablo, tıkladığınız <strong className="text-[#6b705c] font-bold">{selectedCard === 'gross' ? 'Ödenen Brüt Gelir' : selectedCard === 'pending' ? 'Bekleyen Alacak' : selectedCard === 'expenses' ? 'Ödenen Giderler' : 'Dönem Net Kârı'}</strong> özet kartına göre filtrelenmiştir.
              </span>
            </div>
            <button 
              onClick={() => setSelectedCard(null)} 
              className="p-1 hover:bg-amber-100 rounded-full text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
              title="Filtreyi Temizle"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Section Header & View Toggle (Sessions vs General Clinic Expenses) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#f5f5f0] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-[#6b705c] tracking-widest uppercase flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-[#cb997e]" />
                {selectedCard === 'gross' && 'Ödenen Brüt Gelir Seansları'}
                {selectedCard === 'pending' && 'Bekleyen Alacak Seansları'}
                {selectedCard === 'expenses' && 'Gider Dökümü & Genel Kasadan Ödemeler'}
                {selectedCard === 'net' && 'Dönem Net Kâr Seansları'}
                {selectedCard === null && 'Dönem Muhasebe Dökümü & Genel Giderler'}
              </h4>
            </div>
            <p className="text-xs text-slate-400">
              Maaşlar, faturalar, kasadan yapılan ödemeler veya seans başı giderlerinizi tek yerden inceleyin.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle Sub-tabs for Expenses */}
            {(selectedCard === 'expenses' || selectedCard === null) && (
              <div className="flex items-center p-1 bg-[#f5f5f0] rounded-xl border border-[#e5e1d8]/60 text-xs">
                <button
                  onClick={() => setExpenseSubTab('general')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    expenseSubTab === 'general' ? 'bg-white text-[#6b705c] shadow-3xs font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5 text-rose-600" />
                  <span>Genel Klinik Giderleri</span>
                  <span className="bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                    {filteredCustomExpenses.length}
                  </span>
                </button>
                <button
                  onClick={() => setExpenseSubTab('sessions')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    expenseSubTab === 'sessions' ? 'bg-white text-[#6b705c] shadow-3xs font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  <span>Seans Başı Giderler</span>
                  <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                    {analytics.sessionExpensesCount}
                  </span>
                </button>
              </div>
            )}

            {/* Button to Add New Clinic Expense */}
            <button
              onClick={handleOpenAddModal}
              className="px-3.5 py-2 rounded-xl bg-[#6b705c] hover:bg-[#5b604c] text-white text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Gider Ekle (Maaş/Fatura/Kasa)</span>
            </button>
          </div>
        </div>

        {/* View Content: GENERAL CLINIC EXPENSES */}
        {(selectedCard === 'expenses' && expenseSubTab === 'general') || (selectedCard === null && expenseSubTab === 'general') ? (
          <div className="space-y-4 animate-fade-in">
            {/* Filter & Search Bar for Custom Expenses */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#fdfbf7] p-3.5 rounded-2xl border border-[#e5e1d8]">
              {/* Category Chips Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 custom-scrollbar text-xs">
                <button
                  onClick={() => setExpenseCategoryFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    expenseCategoryFilter === 'all'
                      ? 'bg-[#6b705c] text-white shadow-3xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-[#e5e1d8]'
                  }`}
                >
                  Tümü ({filteredCustomExpenses.length})
                </button>
                {Object.entries(EXPENSE_CATEGORIES).map(([catKey, catMeta]) => {
                  const CatIcon = catMeta.icon;
                  const count = filteredCustomExpenses.filter(e => e.category === catKey).length;
                  if (count === 0 && expenseCategoryFilter !== catKey) return null;
                  return (
                    <button
                      key={catKey}
                      onClick={() => setExpenseCategoryFilter(catKey)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                        expenseCategoryFilter === catKey
                          ? 'bg-[#6b705c] text-white shadow-3xs font-bold'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-[#e5e1d8]'
                      }`}
                    >
                      <CatIcon className="w-3.5 h-3.5" />
                      <span>{catMeta.label}</span>
                      <span className="text-[10px] opacity-80">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#a5a58d]" />
                <input
                  type="text"
                  placeholder="Gider adı, not veya tutar ara..."
                  value={detailSearchQuery}
                  onChange={(e) => setDetailSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] placeholder:text-slate-400"
                />
                {detailSearchQuery && (
                  <button 
                    onClick={() => setDetailSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* List of General Clinic Expenses */}
            {detailedFilteredCustomExpenses.length === 0 ? (
              <div className="text-center py-12 bg-[#fdfbf7]/60 rounded-2xl border border-dashed border-[#e5e1d8] space-y-3">
                <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">
                  {detailSearchQuery || expenseCategoryFilter !== 'all'
                    ? 'Aradığınız kriterlere uygun klinik gideri bulunamadı.'
                    : 'Seçili dönemde kayıtlı genel klinik gideri (maaş, fatura, kasadan ödeme) bulunmuyor.'}
                </p>
                <button
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 text-xs font-bold bg-[#6b705c] text-white rounded-xl hover:bg-[#5b604c] transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>İlk Gideri Ekle</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                {detailedFilteredCustomExpenses.map(item => {
                  const catMeta = EXPENSE_CATEGORIES[item.category] || EXPENSE_CATEGORIES.other;
                  const CatIcon = catMeta.icon;
                  const payMeta = PAYMENT_METHODS[item.paymentMethod || 'cash'] || PAYMENT_METHODS.cash;
                  const PayIcon = payMeta.icon;

                  let displayDate = item.date;
                  try {
                    const dObj = new Date(item.date);
                    displayDate = dObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
                  } catch (e) {}

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl border border-[#e5e1d8]/70 hover:border-[#6b705c]/40 bg-white shadow-2xs hover:shadow-xs transition-all flex items-start justify-between gap-3 group"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${catMeta.bg} ${catMeta.color} ${catMeta.border}`}>
                          <CatIcon className="w-5 h-5" />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="font-bold text-slate-800 text-sm leading-snug">{item.title}</h5>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold tracking-wider border ${catMeta.bg} ${catMeta.color} ${catMeta.border}`}>
                              {catMeta.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-[#a5a58d]" />
                              {displayDate}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                              <PayIcon className="w-3 h-3 text-slate-500" />
                              {payMeta.label}
                            </span>
                          </div>

                          {item.notes && (
                            <p className="text-xs text-slate-600 bg-[#fdfbf7] p-2 rounded-xl border border-[#e5e1d8]/50 italic">
                              "{item.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end justify-between gap-3 self-stretch shrink-0">
                        <span className="text-base font-bold text-rose-700 font-serif">
                          -{formatMoney(item.amount, { decimals: 2 })}
                        </span>

                        <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Düzenle"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteExpense?.(item.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Gideri Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* View Content: SESSIONS or OTHER SCORECARD FILTERED LIST */
          <div className="space-y-3 animate-fade-in">
            {/* Search Bar */}
            <div className="flex justify-between items-center gap-3">
              <div className="text-xs text-slate-500 font-semibold">
                Filtrelenen Seans Sayısı: <span className="text-[#6b705c] font-bold">{detailedFilteredSessions.length} adet</span>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#a5a58d]" />
                <input
                  type="text"
                  placeholder="Danışan adı, tarih veya notlarda ara..."
                  value={detailSearchQuery}
                  onChange={(e) => setDetailSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] placeholder:text-slate-400"
                />
                {detailSearchQuery && (
                  <button 
                    onClick={() => setDetailSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* List of Sessions */}
            {detailedFilteredSessions.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs italic bg-[#fdfbf7]/50 rounded-2xl border border-dashed border-[#e5e1d8]">
                {detailSearchQuery ? 'Aradığınız kriterlere uygun seans bulunamadı.' : 'Bu kategoride listelenecek seans bulunmuyor.'}
              </div>
            ) : (
              <div className="max-h-[360px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                {detailedFilteredSessions.map(s => {
                  const sPrice = Number(s.price) || 0;
                  const sBabyFee = s.hasBabysitterFee ? (Number(s.babysitterFeeAmount) || 0) : 0;
                  const sOfficeFee = s.hasOfficeRentFee ? (Number(s.officeRentFeeAmount) || 0) : 0;
                  const isInclusive = s.isKdvInclusive !== false;
                  const kRate = s.kdvRate ?? settings.defaultKdvRate ?? 20;
                  const sKdvCut = s.hasKDV 
                    ? (s.kdvAmount ?? (isInclusive ? Math.round((sPrice * kRate) / (100 + kRate)) : Math.round((sPrice * kRate) / 100)))
                    : 0;
                  const sGross = s.hasKDV && !isInclusive ? (sPrice + sKdvCut) : sPrice;
                  const totalSExp = sBabyFee + sOfficeFee + sKdvCut;
                  
                  const isOnline = s.type === 'online';
                  const isCancelled = s.type === 'cancelled';
                  const isPaid = s.paymentStatus === 'paid';

                  let displayDate = s.date;
                  try {
                    const dObj = new Date(s.date);
                    displayDate = dObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
                  } catch (e) {}

                  const expParts: string[] = [];
                  if (sBabyFee > 0) expParts.push(`${formatMoney(sBabyFee)} bakıcı`);
                  if (sOfficeFee > 0) expParts.push(`${formatMoney(sOfficeFee)} ofis`);
                  if (sKdvCut > 0) expParts.push(`${formatMoney(sKdvCut)} KDV (${isInclusive ? 'Dahil' : 'Hariç'})`);

                  return (
                    <div 
                      key={s.id} 
                      className="border border-[#e5e1d8]/60 hover:border-[#6b705c]/40 rounded-2xl p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-[#fdfbf7]/20"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                          isCancelled ? 'bg-red-50 text-red-600' : isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {isCancelled ? 'İ' : isOnline ? 'O' : 'Y'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="font-bold text-slate-800 text-sm">{s.clientName}</h5>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold tracking-wider ${
                              isCancelled 
                                ? 'bg-red-50 text-red-600 border border-red-100' 
                                : isOnline 
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                  : 'bg-amber-50 text-amber-600 border border-amber-100'
                            }`}>
                              {isCancelled ? 'İPTAL' : isOnline ? 'ONLINE' : 'YÜZYÜZE'}
                            </span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold tracking-wider ${
                              s.paymentStatus === 'paid' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                : s.paymentStatus === 'partial'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-red-50 text-red-700 border border-red-100'
                            }`}>
                              {s.paymentStatus === 'paid' 
                                ? 'ÖDENDİ' 
                                : s.paymentStatus === 'partial'
                                  ? `◐ KISMİ (₺${(s.paidAmount || 0).toLocaleString('tr-TR')} ALINDI)`
                                  : 'ÖDENMEDİ'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {displayDate} • {s.time} {s.notes ? `• ${s.notes}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-medium">
                            {s.hasKDV && !isInclusive ? 'Tahsilat (KDV Dahil)' : 'Seans Ücreti'}
                          </span>
                          <span className="text-sm font-bold text-slate-800">{formatMoney(sGross, { decimals: 2 })}</span>
                          {s.hasKDV && !isInclusive && (
                            <span className="text-[9px] text-slate-400 block font-normal">
                              ({formatMoney(sPrice)} + KDV)
                            </span>
                          )}
                        </div>
                        
                        {totalSExp > 0 && (
                          <div className="text-right bg-orange-50/40 px-2.5 py-1 rounded-xl border border-orange-100/50">
                            <span className="text-[9px] text-orange-600 block font-bold tracking-wider uppercase">Seans Gideri / Kesintisi</span>
                            <span className="text-[11px] font-semibold text-slate-600">
                              {formatMoney(totalSExp)} 
                              {expParts.length > 0 && (
                                <span className="text-[9px] text-slate-400 font-normal ml-1">
                                  ({expParts.join(' + ')})
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue over time Chart */}
        <div className="lg:col-span-8 bg-white p-6 rounded-[2rem] border border-[#e5e1d8] shadow-sm">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-[#6b705c] tracking-wider">
              {preset === 'all' ? 'GENEL' : 'DÖNEMLİK'} MUHASEBE TRENDİ
            </h4>
            {showExplanations && (
              <p className="text-xs text-slate-400 animate-fade-in">Güne göre brüt gelir, toplam giderler (seans başı + genel klinik) ve net kazanç</p>
            )}
          </div>
          
          <div className="h-64 w-full" id="accounting-recharts-bar">
            {analytics.chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                Seçili tarih aralığında grafik oluşturulacak veri bulunmuyor.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1eb" />
                  <XAxis dataKey="tarih" stroke="#a5a58d" fontSize={11} tickLine={false} />
                  <YAxis stroke="#a5a58d" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '1rem', border: '1px solid #e5e1d8' }} 
                    labelStyle={{ fontWeight: 'bold', color: '#6b705c', fontSize: '11px' }}
                    itemStyle={{ fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Brüt Gelir" fill="#6b705c" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Toplam Gider" fill="#e11d48" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Net Gelir" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Session Distributions Chart */}
        <div className="lg:col-span-4 bg-white p-6 rounded-[2rem] border border-[#e5e1d8] shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-[#6b705c] tracking-wider mb-1">SEANS DAĞILIMLARI</h4>
            {showExplanations && (
              <p className="text-xs text-slate-400 font-sans animate-fade-in">Seçili dönemdeki seans türlerinin oranları</p>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center h-48 py-2">
            {analytics.typeData.length === 0 ? (
              <div className="text-xs text-slate-400 italic">Veri bulunmuyor</div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {analytics.typeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '0.5rem' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center">
                  <span className="block text-2xl font-serif text-[#6b705c] font-bold">
                    {filteredSessions.filter(s => s.type !== 'cancelled').length}
                  </span>
                  <span className="text-[9px] text-[#a5a58d] tracking-widest font-bold">DÖNEM AKTİF</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-[#f5f5f0] pt-3">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span className="text-slate-600">Online Seans</span>
              </div>
              <span className="font-semibold text-[#6b705c]">{analytics.onlineCount} adet</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span className="text-slate-600">Yüzyüze Seans</span>
              </div>
              <span className="font-semibold text-[#6b705c]">{analytics.faceToFaceCount} adet</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                <span className="text-slate-600">İptal Seans</span>
              </div>
              <span className="font-semibold text-[#6b705c]">{analytics.cancelledCount} adet</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expense Modal (Add & Edit) */}
      <AnimatePresence>
        {isExpenseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[2rem] border border-[#e5e1d8] shadow-2xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-6 bg-[#6b705c] text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <Receipt className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">
                      {editingExpense ? 'Gideri Düzenle' : 'Yeni Klinik Gideri Ekle'}
                    </h3>
                    <p className="text-xs text-white/80">Maaş, fatura veya kasadan yapılan ödemeler</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Gider Başlığı / Açıklama *</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Temmuz Ayı Sekreter Maaşı, Elektrik Faturası, Mutfak Alışverişi..."
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">Gider Kategorisi</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                      className="w-full px-3 py-2.5 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] font-medium cursor-pointer"
                    >
                      {Object.entries(EXPENSE_CATEGORIES).map(([key, meta]) => (
                        <option key={key} value={key}>
                          {meta.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">Tutar (₺) *</label>
                    <input
                      type="text"
                      required
                      placeholder="Örn: 1500"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">Ödeme Tarihi</label>
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">Ödeme Yöntemi</label>
                    <select
                      value={formPaymentMethod}
                      onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-2.5 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] font-medium cursor-pointer"
                    >
                      <option value="cash">Nakit / Kasa Ödemesi</option>
                      <option value="bank">Banka / Havale / EFT</option>
                      <option value="card">Kredi Kartı / Banka Kartı</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Ek Notlar / Detaylar</label>
                  <textarea
                    rows={2}
                    placeholder="Varsa fatura no, ödeyen/alan bilgisi veya ek açıklamalar..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsExpenseModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-[#6b705c] hover:bg-[#5b604c] rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingExpense ? 'Gideri Güncelle' : 'Kaydet'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
