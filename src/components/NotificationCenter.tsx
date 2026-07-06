import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Trash2, 
  Megaphone, 
  AlertTriangle, 
  Info, 
  Calendar, 
  ArrowRight
} from 'lucide-react';
import { AppNotification } from '../types';

interface NotificationCenterProps {
  notifications: AppNotification[];
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkAllAsRead,
  onClearAll,
  showToast
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Helper to format timestamps elegantly in Turkish
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    
    const isToday = date.toDateString() === now.toDateString();
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (isToday) {
      return `Bugün ${timeStr}`;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year} ${timeStr}`;
  };

  return (
    <div className="relative" ref={dropdownRef} id="notification-center-container">
      {/* Trigger Button */}
      <button
        id="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-10 h-10 rounded-full border border-[#e5e1d8] flex items-center justify-center transition-all cursor-pointer ${
          isOpen || unreadCount > 0
            ? 'bg-[#cb997e]/10 text-[#cb997e] border-[#cb997e]/30'
            : 'bg-[#fdfbf7] text-slate-500 hover:bg-[#f5f5f0]'
        }`}
        title="Bildirimler"
      >
        <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'animate-bounce text-[#cb997e]' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-[#cb997e] text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Box */}
      {isOpen && (
        <div 
          className="absolute right-0 mt-3 w-80 sm:w-96 max-h-[500px] overflow-y-auto bg-white border border-[#e5e1d8] rounded-[2rem] shadow-xl z-50 flex flex-col animate-scale-up"
          id="notification-dropdown-menu"
        >
          {/* Header */}
          <div className="p-5 border-b border-[#e5e1d8] flex items-center justify-between bg-[#fdfbf7] rounded-t-[2rem]">
            <div>
              <h3 className="font-serif italic text-base text-[#6b705c] font-bold flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-[#cb997e]" />
                Bildirimler
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Senkronizasyon hareketleri ve duyurular</p>
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="p-1.5 text-xs text-[#6b705c] hover:bg-[#e5e1d8] rounded-lg transition-colors cursor-pointer"
                  title="Tümünü Okundu İşaretle"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={onClearAll}
                  className="p-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Bildirim Geçmişini Temizle"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Body Content */}
          <div className="p-4 flex-1 overflow-y-auto max-h-[350px]">
            <div className="space-y-2.5">
              {notifications.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="text-3xl">☕</div>
                  <p className="text-xs text-slate-500 font-serif italic">Henüz bildirim bulunmuyor.</p>
                  <p className="text-[10px] text-slate-400">Takvim eşleşmeleri ve tüm sistem olayları burada listelenir.</p>
                </div>
              ) : (
                notifications.map((notif) => {
                  let iconBg = 'bg-slate-50 text-slate-500';
                  let iconEl = <Info className="w-3.5 h-3.5" />;
                  let typeLabel = 'Sistem';

                  if (notif.type === 'success') {
                    iconBg = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
                    iconEl = <Check className="w-3.5 h-3.5" />;
                    typeLabel = 'Eşleşti';
                  } else if (notif.type === 'error') {
                    iconBg = 'bg-rose-50 text-rose-600 border border-rose-100';
                    iconEl = <AlertTriangle className="w-3.5 h-3.5" />;
                    typeLabel = 'Hata';
                  } else if (notif.type === 'info') {
                    iconBg = 'bg-blue-50 text-blue-600 border border-blue-100';
                    iconEl = <Info className="w-3.5 h-3.5" />;
                    typeLabel = 'Bilgi';
                  } else if (notif.type === 'announcement') {
                    iconBg = 'bg-purple-50 text-purple-600 border border-purple-100';
                    iconEl = <Megaphone className="w-3.5 h-3.5" />;
                    typeLabel = 'Duyuru';
                  } else if (notif.type === 'system') {
                    iconBg = 'bg-amber-50 text-amber-600 border border-amber-100';
                    iconEl = <Calendar className="w-3.5 h-3.5" />;
                    typeLabel = 'Senkronize';
                  }

                  return (
                    <div 
                      key={notif.id}
                      className={`p-3 rounded-2xl border text-xs transition-all relative flex gap-2.5 items-start ${
                        notif.read 
                          ? 'bg-white border-[#e5e1d8] text-slate-600' 
                          : 'bg-[#cb997e]/5 border-[#cb997e]/20 text-slate-800 shadow-2xs font-medium'
                      }`}
                      id={`notification-item-${notif.id}`}
                    >
                      {!notif.read && (
                        <span className="absolute top-3.5 right-3 h-1.5 w-1.5 rounded-full bg-[#cb997e]"></span>
                      )}

                      {/* Icon */}
                      <div className={`p-2 rounded-xl shrink-0 ${iconBg}`}>
                        {iconEl}
                      </div>

                      {/* Text content */}
                      <div className="space-y-1 flex-1 pr-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                            {typeLabel}
                          </span>
                          {notif.author && (
                            <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md">
                              {notif.author}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            {formatTime(notif.timestamp)}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs">{notif.title}</h4>
                        <p className="text-[11px] leading-relaxed text-slate-500 whitespace-pre-line">{notif.message}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer of the dropdown */}
          <div className="p-3.5 border-t border-[#e5e1d8] text-center bg-[#fdfbf7] rounded-b-[2rem] text-[10px] text-slate-400">
            <span className="flex items-center justify-center gap-1">
              Bütün seans hareketleri ve uyarılar saklanır <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
