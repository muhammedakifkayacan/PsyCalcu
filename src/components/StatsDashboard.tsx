import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Session, AppSettings, getNormalizedClientName } from '../types';
import { Laptop, MapPin, Ban, ArrowUpRight, ArrowDownRight, TrendingUp, Calendar, Filter, Clock, Search, X, Coins } from 'lucide-react';

interface StatsDashboardProps {
  sessions: Session[];
  settings: AppSettings;
  showExplanations?: boolean;
}

export default function StatsDashboard({ sessions, settings, showExplanations = true }: StatsDashboardProps) {
  const [preset, setPreset] = useState<string>('thisMonth');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedCard, setSelectedCard] = useState<'gross' | 'pending' | 'expenses' | 'net' | null>(null);
  const [detailSearchQuery, setDetailSearchQuery] = useState('');

  const handleCardClick = (cardType: 'gross' | 'pending' | 'expenses' | 'net') => {
    setSelectedCard(prev => {
      const next = prev === cardType ? null : cardType;
      if (next) {
        setTimeout(() => {
          const el = document.getElementById('accounting-details-section');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 120);
      }
      return next;
    });
  };

  // Compute calculated start & end dates based on selected preset
  const dateRange = useMemo(() => {
    const today = new Date();
    let start = '';
    let end = '';

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
      if (s.type === 'non-session') return false; // Exclude non-session entries from accounting metrics entirely
      if (dateRange.start && s.date < dateRange.start) return false;
      if (dateRange.end && s.date > dateRange.end) return false;
      return true;
    });
  }, [sessions, dateRange]);

  // Compute analytics
  const analytics = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('sv-SE');
    let grossIncome = 0;
    let babysitterFees = 0;
    let officeRentExpenses = 0;
    let onlineCount = 0;
    let faceToFaceCount = 0;
    let cancelledCount = 0;
    let pendingReceivables = 0;
    let futureUnpaidIncome = 0;
    
    // Group by date for line chart
    const dateGroups: Record<string, { date: string; gross: number; expenses: number; net: number }> = {};

    filteredSessions.forEach(s => {
      const sPrice = Number(s.price) || 0;
      const sBabyFee = s.hasBabysitterFee ? (Number(s.babysitterFeeAmount) || 0) : 0;
      const sOfficeFee = s.hasOfficeRentFee ? (Number(s.officeRentFeeAmount) || 0) : 0;
      
      if (s.type === 'cancelled') {
        cancelledCount++;
      } else {
        if (s.type === 'online') {
          onlineCount++;
        } else {
          faceToFaceCount++;
        }

        if (s.paymentStatus === 'paid') {
          grossIncome += sPrice;
          babysitterFees += sBabyFee;
          officeRentExpenses += sOfficeFee;
        } else if (s.date <= todayStr) {
          pendingReceivables += sPrice;
        } else {
          futureUnpaidIncome += sPrice;
        }
      }

      // Grouping by date
      const dLabel = s.date;
      if (!dateGroups[dLabel]) {
        dateGroups[dLabel] = { date: dLabel, gross: 0, expenses: 0, net: 0 };
      }
      
      if (s.type !== 'cancelled') {
        if (s.paymentStatus === 'paid') {
          dateGroups[dLabel].gross += sPrice;
          dateGroups[dLabel].expenses += (sBabyFee + sOfficeFee);
        }
      }
    });

    const totalExpenses = babysitterFees + officeRentExpenses;
    const netIncome = Math.max(0, grossIncome - totalExpenses);

    // Convert date groups to sorted array for chart
    const chartData = Object.values(dateGroups)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-15) // Show last 15 active days for dynamic timeline view
      .map(g => {
        // Format YYYY-MM-DD to DD/MM
        const parts = g.date.split('-');
        const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : g.date;
        return {
          tarih: formattedDate,
          'Brüt Gelir': g.gross,
          'Gider (Bakıcı)': g.expenses,
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
      totalExpenses,
      netIncome,
      pendingReceivables,
      futureUnpaidIncome,
      onlineCount,
      faceToFaceCount,
      cancelledCount,
      chartData,
      typeData
    };
  }, [filteredSessions]);

  // Filter and search inside the details panel
  const detailedFilteredSessions = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('sv-SE');
    
    // First, filter by the active date range
    let list = filteredSessions;

    // Second, filter by the clicked scorecard category
    if (selectedCard === 'gross') {
      list = list.filter(s => s.type !== 'cancelled' && s.paymentStatus === 'paid');
    } else if (selectedCard === 'pending') {
      list = list.filter(s => s.type !== 'cancelled' && s.paymentStatus !== 'paid' && s.date <= todayStr);
    } else if (selectedCard === 'expenses') {
      list = list.filter(s => s.type !== 'cancelled' && s.paymentStatus === 'paid' && (s.hasBabysitterFee || s.hasOfficeRentFee));
    } else if (selectedCard === 'net') {
      list = list.filter(s => s.type !== 'cancelled' && s.paymentStatus === 'paid');
    }

    // Third, filter by the search query
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

    // Sort by date (descending, newest first)
    return [...list].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.time.localeCompare(a.time);
    });
  }, [filteredSessions, selectedCard, detailSearchQuery]);

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
                <p className="text-xs text-slate-400 animate-fade-in">Raporları ve grafikleri dilediğiniz tarih aralığına göre süzün</p>
              )}
            </div>
          </div>

          <div className="text-xs font-semibold text-slate-500 bg-[#f5f5f0] px-3 py-1.5 rounded-full border border-[#e5e1d8]/50">
            Filtrelenen Seans: <span className="text-[#6b705c] font-bold">{filteredSessions.length} adet</span>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="flex flex-wrap gap-2 pt-1">
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
              className={`px-4 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                preset === p.id
                  ? 'bg-[#6b705c] text-white border-[#6b705c] shadow-sm'
                  : 'bg-[#fdfbf7] text-slate-600 border-[#e5e1d8] hover:bg-[#f5f5f0]'
              }`}
            >
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
              <h3 className="text-2xl font-serif text-[#6b705c]">₺{analytics.grossIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h3>
              <p className="text-[10px] text-slate-400 mt-1">Ödemesi tamamlanmış seans cirosu.</p>
            </div>
          </div>
          
          {/* Action indicator for UX clarity, extremely vital on mobile */}
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
                <h3 className="text-2xl font-serif text-amber-600">₺{analytics.pendingReceivables.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Tarihi bugün veya geçmişte olan, ödenmemiş seanslar.</p>
              </div>
              
              {(analytics.futureUnpaidIncome > 0 || analytics.grossIncome > 0) && (
                <div className="text-[10px] text-slate-500 border-t border-amber-500/10 pt-2 space-y-1">
                  {analytics.futureUnpaidIncome > 0 && (
                    <div className="flex justify-between items-center" title="Gelecek tarihler için planlanan seansların henüz ödenmemiş ücret toplamı">
                      <span className="text-slate-400">Gelecek Planlanan:</span>
                      <span className="font-semibold text-slate-600">+₺{analytics.futureUnpaidIncome.toLocaleString('tr-TR')}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t border-slate-100/80 pt-1 font-bold text-[#6b705c]" title="Ödenen brüt gelir + gerçekleşmiş alacak + gelecek planlanan seansların toplamı">
                    <span>Tahmini Toplam Ciro:</span>
                    <span>₺{(analytics.grossIncome + analytics.pendingReceivables + analytics.futureUnpaidIncome).toLocaleString('tr-TR')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Action indicator for UX clarity, extremely vital on mobile */}
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
              <span className="text-[10px] tracking-wider text-orange-600 font-bold">ÖDENEN GİDERLER</span>
              <span className={`p-1.5 rounded-full transition-colors ${selectedCard === 'expenses' ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600 group-hover:bg-orange-100'}`}>
                <ArrowDownRight className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-serif text-slate-700">₺{analytics.totalExpenses.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h3>
              <p className="text-[10px] text-slate-400 mt-1">
                ₺{analytics.babysitterFees.toLocaleString('tr-TR')} bakıcı + ₺{analytics.officeRentExpenses.toLocaleString('tr-TR')} ofis gideri.
              </p>
            </div>
          </div>
          
          {/* Action indicator for UX clarity, extremely vital on mobile */}
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
                <span className="text-slate-400 group-hover:text-orange-600 transition-colors">Giderleri Listele</span>
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
              <h3 className="text-2xl font-serif">₺{analytics.netIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h3>
              <p className="text-[10px] text-white/70 mt-1">Ödenen seansların net kazancı.</p>
            </div>
          </div>
          
          {/* Action indicator for UX clarity, extremely vital on mobile */}
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

      {/* Session Details List and General Search Panel */}
      <div className="bg-white rounded-[2rem] border border-[#e5e1d8] p-6 shadow-sm space-y-4 animate-fadeIn" id="accounting-details-section">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-[#6b705c] tracking-widest uppercase flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-[#cb997e]" />
                {selectedCard === 'gross' && 'Ödenen Brüt Gelir Seansları'}
                {selectedCard === 'pending' && 'Bekleyen Alacak Seansları'}
                {selectedCard === 'expenses' && 'Ödenen Giderli Seanslar'}
                {selectedCard === 'net' && 'Dönem Net Kâr Seansları'}
                {selectedCard === null && 'Dönem Seans Detayları & Arama'}
              </h4>
              <span className="text-xs font-bold text-slate-500 bg-[#f5f5f0] px-2.5 py-1 rounded-full border border-[#e5e1d8]/50">
                {detailedFilteredSessions.length} Seans
              </span>
              {selectedCard && (
                <button 
                  onClick={() => setSelectedCard(null)}
                  className="px-2.5 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors flex items-center gap-1 font-bold cursor-pointer border border-[#e5e1d8]"
                >
                  Filtreyi Kaldır <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {selectedCard === 'gross' && 'Ödemesi tamamlanmış seansların listesi.'}
              {selectedCard === 'pending' && 'Günü geçmiş veya bugün olan fakat ödemesi henüz alınmamış seanslar.'}
              {selectedCard === 'expenses' && 'Seans başı bakıcı veya ofis gideri bulunan seansların listesi.'}
              {selectedCard === 'net' && 'Ödenen seansların brüt gelir ve gider dağılımı.'}
              {selectedCard === null && 'Döneme ait tüm seansları listeleyin, arayın ve seans bazlı gelir/gider detaylarını inceleyin.'}
            </p>
          </div>

          {/* Search bar inside details panel */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#a5a58d]" />
            <input
              type="text"
              placeholder="Danışan adı, tarih veya notlarda ara..."
              value={detailSearchQuery}
              onChange={(e) => setDetailSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] placeholder:text-slate-400"
            />
            {detailSearchQuery && (
              <button 
                onClick={() => setDetailSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* List of Sessions */}
        <div className="pt-2">
          {detailedFilteredSessions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs italic bg-[#fdfbf7]/50 rounded-2xl border border-dashed border-[#e5e1d8]">
              {detailSearchQuery ? 'Aradığınız kriterlere uygun seans bulunamadı.' : 'Bu kategoride listelenecek seans bulunmuyor.'}
            </div>
          ) : (
            <div className="max-h-[350px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
              {detailedFilteredSessions.map(s => {
                const sPrice = Number(s.price) || 0;
                const sBabyFee = s.hasBabysitterFee ? (Number(s.babysitterFeeAmount) || 0) : 0;
                const sOfficeFee = s.hasOfficeRentFee ? (Number(s.officeRentFeeAmount) || 0) : 0;
                const totalSExp = sBabyFee + sOfficeFee;
                
                const isOnline = s.type === 'online';
                const isCancelled = s.type === 'cancelled';
                const isPaid = s.paymentStatus === 'paid';
                
                // Format date nicely
                let displayDate = s.date;
                try {
                  const dObj = new Date(s.date);
                  displayDate = dObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
                } catch (e) {}

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
                            isPaid 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                              : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}>
                            {isPaid ? 'ÖDENDİ' : 'ÖDENMEDİ'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {displayDate} • {s.time} {s.notes ? `• ${s.notes}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-medium">Seans Ücreti</span>
                        <span className="text-sm font-bold text-slate-800">₺{sPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      
                      {(sBabyFee > 0 || sOfficeFee > 0) && (
                        <div className="text-right sm:text-right bg-orange-50/40 px-2.5 py-1 rounded-xl border border-orange-100/50">
                          <span className="text-[9px] text-orange-600 block font-bold tracking-wider uppercase">Seans Gideri</span>
                          <span className="text-[11px] font-semibold text-slate-600">
                            ₺{totalSExp.toLocaleString('tr-TR')} 
                            <span className="text-[9px] text-slate-400 font-normal ml-1">
                              ({sBabyFee > 0 ? `₺${sBabyFee} bakıcı` : ''}{sBabyFee > 0 && sOfficeFee > 0 ? ' + ' : ''}{sOfficeFee > 0 ? `₺${sOfficeFee} ofis` : ''})
                            </span>
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
              <p className="text-xs text-slate-400 animate-fade-in">Güne göre brüt gelir ve seans başı bakıcı/ofis gideri dağılımı</p>
            )}
          </div>
          
          <div className="h-64 w-full" id="accounting-recharts-bar">
            {analytics.chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                Seçili tarih aralığında grafik oluşturulacak seans verisi bulunmuyor.
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
                  <Bar dataKey="Gider (Bakıcı)" fill="#cb997e" radius={[4, 4, 0, 0]} />
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
                {/* Center text */}
                <div className="absolute text-center">
                  <span className="block text-2xl font-serif text-[#6b705c] font-bold">
                    {filteredSessions.filter(s => s.type !== 'cancelled').length}
                  </span>
                  <span className="text-[9px] text-[#a5a58d] tracking-widest font-bold">DÖNEM AKTİF</span>
                </div>
              </div>
            )}
          </div>

          {/* Legend Table */}
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
    </div>
  );
}
