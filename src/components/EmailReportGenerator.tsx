import React, { useState, useMemo } from 'react';
import { Mail, Copy, Check, Calendar, ArrowRight, Sparkles, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { Session, AppSettings } from '../types';

interface EmailReportGeneratorProps {
  sessions: Session[];
  settings: AppSettings;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  userEmail?: string;
}

export default function EmailReportGenerator({ sessions, settings, showToast, userEmail }: EmailReportGeneratorProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [copied, setCopied] = useState(false);

  // Available months list based on sessions or current year
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    
    // Always add current month and last month
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(currentMonthStr);
    
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(lastMonthStr);
    
    // Add months from sessions
    sessions.forEach(s => {
      if (s.date && s.date.length >= 7) {
        monthsSet.add(s.date.substring(0, 7));
      }
    });

    return Array.from(monthsSet).sort().reverse();
  }, [sessions]);

  // Translate Month Name
  const getMonthLabel = (yearMonthStr: string) => {
    const [year, month] = yearMonthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  };

  // Compute stats for selected month & its weeks
  const reportData = useMemo(() => {
    const monthSessions = sessions.filter(s => s.date.startsWith(selectedMonth));
    
    let grossIncome = 0;
    let babysitterFees = 0;
    let officeRentExpenses = 0;
    let onlineCount = 0;
    let faceToFaceCount = 0;
    let cancelledCount = 0;

    // We split into 4 standard weeks:
    // Week 1: 01-07
    // Week 2: 08-14
    // Week 3: 15-21
    // Week 4: 22-end of month
    const weeks = [
      { name: '1. Hafta (01 - 07)', start: 1, end: 7, sessions: [] as Session[], gross: 0, expenses: 0 },
      { name: '2. Hafta (08 - 14)', start: 8, end: 14, sessions: [] as Session[], gross: 0, expenses: 0 },
      { name: '3. Hafta (15 - 21)', start: 15, end: 21, sessions: [] as Session[], gross: 0, expenses: 0 },
      { name: '4. Hafta (22 - 31)', start: 22, end: 31, sessions: [] as Session[], gross: 0, expenses: 0 },
    ];

    monthSessions.forEach(s => {
      const price = Number(s.price) || 0;
      const babyFee = s.hasBabysitterFee ? (Number(s.babysitterFeeAmount) || 0) : 0;
      const officeFee = s.hasOfficeRentFee ? (Number(s.officeRentFeeAmount) || 0) : 0;
      const totalFees = babyFee + officeFee;

      const dayNum = parseInt(s.date.split('-')[2]);

      if (s.type === 'cancelled') {
        cancelledCount++;
      } else {
        grossIncome += price;
        babysitterFees += babyFee;
        officeRentExpenses += officeFee;

        if (s.type === 'online') {
          onlineCount++;
        } else if (s.type === 'face-to-face') {
          faceToFaceCount++;
        }
      }

      // Assign to weeks
      let assignedWeek = weeks[3]; // default to 4th week
      for (let i = 0; i < 3; i++) {
        if (dayNum >= weeks[i].start && dayNum <= weeks[i].end) {
          assignedWeek = weeks[i];
          break;
        }
      }

      assignedWeek.sessions.push(s);
      if (s.type !== 'cancelled') {
        assignedWeek.gross += price;
        assignedWeek.expenses += totalFees;
      }
    });

    const totalExpenses = babysitterFees + officeRentExpenses;
    const netIncome = Math.max(0, grossIncome - totalExpenses);

    return {
      totalSessions: monthSessions.length,
      activeSessions: onlineCount + faceToFaceCount,
      onlineCount,
      faceToFaceCount,
      cancelledCount,
      grossIncome,
      babysitterFees,
      officeRentExpenses,
      totalExpenses,
      netIncome,
      weeks,
    };
  }, [sessions, selectedMonth]);

  // Generate clean text report for email client
  const textReport = useMemo(() => {
    const monthLabel = getMonthLabel(selectedMonth);
    const divider = "===============================================";
    const subDivider = "-----------------------------------------------";

    let body = `📊 ${monthLabel.toUpperCase()} SEANS VE MUHASEBE RAPORU\n`;
    body += `${divider}\n`;
    body += `Danışman: ${settings.therapistName || 'Psikolog'}\n`;
    body += `Tarih: ${new Date().toLocaleDateString('tr-TR')}\n\n`;

    body += `📈 GENEL ÖZET:\n`;
    body += `${subDivider}\n`;
    body += `• Toplam Seans Sayısı: ${reportData.totalSessions} adet\n`;
    body += `  - Tamamlanan Seanslar: ${reportData.activeSessions} adet (${reportData.onlineCount} Online, ${reportData.faceToFaceCount} Yüzyüze)\n`;
    body += `  - İptal Edilen Seanslar: ${reportData.cancelledCount} adet\n`;
    body += `• Brüt Gelir: ${reportData.grossIncome.toLocaleString('tr-TR')} TL\n`;
    body += `• Toplam Gider: ${reportData.totalExpenses.toLocaleString('tr-TR')} TL\n`;
    body += `  - Bakıcı Ödemeleri: ${reportData.babysitterFees.toLocaleString('tr-TR')} TL\n`;
    body += `  - Ofis Kira Ödemeleri: ${reportData.officeRentExpenses.toLocaleString('tr-TR')} TL\n`;
    body += `• NET GELİR (KAZANÇ): ${reportData.netIncome.toLocaleString('tr-TR')} TL\n\n`;

    body += `📅 HAFTALIK BÖLÜM RAPORU:\n`;
    body += `${subDivider}\n`;
    reportData.weeks.forEach((w) => {
      const activeCount = w.sessions.filter(s => s.type !== 'cancelled').length;
      const cancelledCount = w.sessions.filter(s => s.type === 'cancelled').length;
      const net = Math.max(0, w.gross - w.expenses);
      
      body += `📍 ${w.name}\n`;
      body += `  - Seanslar: ${w.sessions.length} seans (${activeCount} tamamlandı, ${cancelledCount} iptal)\n`;
      body += `  - Gelir: ${w.gross.toLocaleString('tr-TR')} TL\n`;
      body += `  - Giderler: ${w.expenses.toLocaleString('tr-TR')} TL\n`;
      body += `  - Net Kazanç: ${net.toLocaleString('tr-TR')} TL\n\n`;
    });

    body += `Bu rapor PsyCalcu akıllı asistanı tarafından otomatik oluşturulmuştur.`;
    return body;
  }, [reportData, selectedMonth, settings.therapistName]);

  const handleCopy = () => {
    navigator.clipboard.writeText(textReport);
    setCopied(true);
    showToast('Rapor şablonu başarıyla kopyalandı! Dilediğiniz yere yapıştırabilirsiniz.', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = () => {
    const monthLabel = getMonthLabel(selectedMonth);
    const emailTo = userEmail || "";
    const subject = encodeURIComponent(`${monthLabel} Seans ve Muhasebe Raporu (${settings.therapistName || 'Psikolog'})`);
    const body = encodeURIComponent(textReport);
    window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
    showToast('E-posta istemcisi başlatılıyor...', 'info');
  };

  return (
    <div className="bg-white rounded-3xl border border-[#e5e1d8]/90 p-6 space-y-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#cb997e]" />
            E-posta Rapor Şablonları & Gönderimi
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Seçtiğiniz ayın haftalık seans, gelir-gider ve net kâr dökümünü e-posta şablonu haline getirin ve kendinize iletin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Rapor Ayı:</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs font-bold bg-[#fcfbf9] border border-[#e5e1d8] rounded-xl px-3 py-2 text-slate-700 outline-none focus:border-[#6b705c] transition-all cursor-pointer"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {getMonthLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Statistics Preview Cards */}
        <div className="lg:col-span-5 space-y-3.5">
          <div className="text-xs text-[#6b705c] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            {getMonthLabel(selectedMonth)} Özet Verileri
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#fcfbf9] p-3.5 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Brüt Gelir</span>
              <span className="text-base font-extrabold text-[#6b705c] mt-1">
                ₺{reportData.grossIncome.toLocaleString('tr-TR')}
              </span>
            </div>
            
            <div className="bg-[#fcfbf9] p-3.5 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Kazanç</span>
              <span className="text-base font-extrabold text-[#cb997e] mt-1">
                ₺{reportData.netIncome.toLocaleString('tr-TR')}
              </span>
            </div>
          </div>

          <div className="bg-[#fcfbf9] p-4 rounded-2xl border border-slate-100 space-y-2.5 text-xs text-slate-600">
            <div className="flex justify-between items-center pb-1 border-b border-dashed border-slate-200">
              <span className="font-medium text-slate-500">Toplam Seans:</span>
              <span className="font-extrabold text-slate-700">{reportData.totalSessions} Seans</span>
            </div>
            <div className="flex justify-between items-center pb-1 border-b border-dashed border-slate-200">
              <span className="font-medium text-slate-500">Online Seanslar:</span>
              <span className="font-bold text-emerald-600">{reportData.onlineCount} Seans</span>
            </div>
            <div className="flex justify-between items-center pb-1 border-b border-dashed border-slate-200">
              <span className="font-medium text-slate-500">Yüzyüze Seanslar:</span>
              <span className="font-bold text-amber-500">{reportData.faceToFaceCount} Seans</span>
            </div>
            <div className="flex justify-between items-center pb-1 border-b border-dashed border-slate-200">
              <span className="font-medium text-slate-500">Bakıcı Ödemesi:</span>
              <span className="font-semibold text-rose-500">₺{reportData.babysitterFees.toLocaleString('tr-TR')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-500">Ofis Kirası:</span>
              <span className="font-semibold text-rose-500">₺{reportData.officeRentExpenses.toLocaleString('tr-TR')}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleSendEmail}
              className="w-full bg-[#6b705c] hover:bg-[#5b604c] text-white text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              E-posta Gönder
            </button>

            <button
              onClick={handleCopy}
              className="w-full bg-[#f4f3ef] hover:bg-[#e9e8e2] text-slate-700 text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border border-[#e5e1d8]/60 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  Kopyalandı!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Metni Kopyala
                </>
              )}
            </button>
          </div>
        </div>

        {/* Text Preview of the Report */}
        <div className="lg:col-span-7 flex flex-col h-full min-h-[300px]">
          <div className="text-xs text-[#6b705c] font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
            <span>Hazırlanan E-posta Metni Önizlemesi</span>
          </div>
          
          <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-200/60 p-4 font-mono text-[11px] leading-relaxed text-slate-700 overflow-y-auto max-h-[320px] whitespace-pre-wrap select-all">
            {textReport}
          </div>
        </div>
      </div>
    </div>
  );
}
