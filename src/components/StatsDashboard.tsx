import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Session, AppSettings } from '../types';
import { Laptop, MapPin, Ban, ArrowUpRight, ArrowDownRight, TrendingUp, Calendar, Filter } from 'lucide-react';

interface StatsDashboardProps {
  sessions: Session[];
  settings: AppSettings;
  showExplanations?: boolean;
}

export default function StatsDashboard({ sessions, settings, showExplanations = true }: StatsDashboardProps) {
  const [preset, setPreset] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

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
      if (dateRange.start && s.date < dateRange.start) return false;
      if (dateRange.end && s.date > dateRange.end) return false;
      return true;
    });
  }, [sessions, dateRange]);

  // Compute analytics
  const analytics = useMemo(() => {
    let grossIncome = 0;
    let babysitterFees = 0;
    let officeRentExpenses = 0;
    let onlineCount = 0;
    let faceToFaceCount = 0;
    let cancelledCount = 0;
    
    // Group by date for line chart
    const dateGroups: Record<string, { date: string; gross: number; expenses: number; net: number }> = {};

    filteredSessions.forEach(s => {
      const sPrice = Number(s.price) || 0;
      const sBabyFee = s.hasBabysitterFee ? (Number(s.babysitterFeeAmount) || 0) : 0;
      const sOfficeFee = s.hasOfficeRentFee ? (Number(s.officeRentFeeAmount) || 0) : 0;
      
      if (s.type === 'cancelled') {
        cancelledCount++;
      } else {
        grossIncome += sPrice;
        babysitterFees += sBabyFee;
        officeRentExpenses += sOfficeFee;
        if (s.type === 'online') {
          onlineCount++;
        } else {
          faceToFaceCount++;
        }
      }

      // Grouping by date
      const dLabel = s.date;
      if (!dateGroups[dLabel]) {
        dateGroups[dLabel] = { date: dLabel, gross: 0, expenses: 0, net: 0 };
      }
      
      if (s.type !== 'cancelled') {
        dateGroups[dLabel].gross += sPrice;
        dateGroups[dLabel].expenses += (sBabyFee + sOfficeFee);
      } else {
        // Cancelled sessions might still consume baby sitter or office booking if not flagged off
        dateGroups[dLabel].expenses += (sBabyFee + sOfficeFee);
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
      onlineCount,
      faceToFaceCount,
      cancelledCount,
      chartData,
      typeData
    };
  }, [filteredSessions]);

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
              <h4 className="text-sm font-bold text-[#6b705c] uppercase tracking-wider">Muhasebe Tarih Aralığı</h4>
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
              <label className="text-[10px] font-bold text-[#a5a58d] uppercase tracking-wider block">Başlangıç Tarihi</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#a5a58d] uppercase tracking-wider block">Bitiş Tarihi</label>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Gross Income Card */}
        <div className="bg-white p-5 rounded-[2rem] border border-[#e5e1d8] shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase tracking-wider text-[#a5a58d] font-bold">Dönem Brüt Gelir</span>
            <span className="p-1 rounded-full bg-emerald-50 text-emerald-600">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-serif text-[#6b705c]">₺{analytics.grossIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h3>
            <p className="text-[10px] text-slate-400 mt-1">Seçili dönemdeki brüt seans cirosu</p>
          </div>
        </div>

        {/* Total Expenses Card */}
        <div className="bg-white p-5 rounded-[2rem] border border-[#e5e1d8] shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase tracking-wider text-[#a5a58d] font-bold">Dönem Toplam Gider</span>
            <span className="p-1 rounded-full bg-orange-50 text-orange-600">
              <ArrowDownRight className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-serif text-slate-700">₺{analytics.totalExpenses.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h3>
            <p className="text-[10px] text-slate-400 mt-1">
              ₺{analytics.babysitterFees.toLocaleString('tr-TR')} bakıcı + ₺{analytics.officeRentExpenses.toLocaleString('tr-TR')} ofis gideri
            </p>
          </div>
        </div>

        {/* Net Profit Card */}
        <div className="bg-[#6b705c] p-5 rounded-[2rem] text-white shadow-md flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase tracking-wider text-white/80 font-bold">Dönem Net Kâr (Tahmini)</span>
            <span className="p-1 rounded-full bg-white/15 text-white">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-serif">₺{analytics.netIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</h3>
            <p className="text-[10px] text-white/70 mt-1">Giderler düşüldükten sonra kalan net kazanç</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue over time Chart */}
        <div className="lg:col-span-8 bg-white p-6 rounded-[2rem] border border-[#e5e1d8] shadow-sm">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-[#6b705c] uppercase tracking-wider">
              {preset === 'all' ? 'Genel' : 'Dönemlik'} Muhasebe Trendi
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
            <h4 className="text-sm font-bold text-[#6b705c] uppercase tracking-wider mb-1">Seans Dağılımları</h4>
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
                  <span className="text-[9px] uppercase text-[#a5a58d] tracking-widest font-bold">Dönem Aktif</span>
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
