import React, { useState } from 'react';
import { ChevronRight, X, Lock } from 'lucide-react';
import { Session, AppSettings } from '../types';
import { getUnclosedPastMonths, formatMonthKey } from '../utils/monthCloseUtils';

interface MonthClosingBannerProps {
  sessions: Session[];
  settings: AppSettings;
  onOpenMonthClosingModal: (monthKey: string) => void;
}

export const MonthClosingBanner: React.FC<MonthClosingBannerProps> = ({
  sessions,
  settings,
  onOpenMonthClosingModal,
}) => {
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('psycalcu_dismiss_month_close_banner') === 'true';
    } catch (e) {
      return false;
    }
  });

  const unclosedMonths = getUnclosedPastMonths(sessions, settings.closedMonths);

  if (isDismissed || unclosedMonths.length === 0) {
    return null;
  }

  const targetMonthKey = unclosedMonths[0];
  const targetMonthLabel = formatMonthKey(targetMonthKey);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('psycalcu_dismiss_month_close_banner', 'true');
    } catch (e) {}
  };

  return (
    <div className="w-full bg-[#fbfaf8] border-b border-[#e5e1d8] text-slate-800 px-4 py-2 relative z-30 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span className="font-medium text-slate-800">
            {targetMonthLabel} dönemi onay bekliyor
          </span>
          <span className="text-slate-400 hidden sm:inline">·</span>
          <span className="text-slate-500 hidden sm:inline">
            Seansları kontrol edip ayı kapatabilirsiniz
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onOpenMonthClosingModal(targetMonthKey)}
            className="px-3 py-1 rounded-full bg-slate-900 text-white font-medium text-xs hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>Dönemi İncele</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
          </button>

          <button
            onClick={handleDismiss}
            className="p-1 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors"
            title="Kapat"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonthClosingBanner;
