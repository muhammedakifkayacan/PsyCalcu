import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, CalendarPlus, Clock, Wallet, FileText, User, Laptop, MapPin, Ban, Building, Sparkles, AlertTriangle, Percent, Receipt, CreditCard, Banknote, Landmark, History, Info, ChevronDown, ChevronUp, SlidersHorizontal, Lock } from 'lucide-react';
import { Session, SessionType, PaymentMethod, Room, getSmartClientPrice, getNormalizedClientName, getSmartClientCosts, ClosedMonthRecord } from '../types';
import { downloadSessionAsICS } from '../utils/icsGenerator';
import { usePrivacy } from '../context/PrivacyContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { getTodayLocalDate } from '../utils/dateUtils';
import { isDateInClosedMonth, formatMonthKey } from '../utils/monthCloseUtils';

// Helper time converters
const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
};

const minutesToTime = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

interface SessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToEdit?: Session | null;
  onSave: (session: Session) => void;
  defaultPrice: number;
  defaultOnlinePrice?: number;
  defaultFaceToFacePrice?: number;
  defaultBabysitterFee: number;
  defaultOfficeRentFee: number;
  selectedDate: string; // prefill date
  sessions: Session[];
  enableSmartClientPriceMatching?: boolean;
  clientCustomPrices?: { [normalizedClientName: string]: any };
  userRole?: 'tenant' | 'owner';
  rooms?: Room[];
  prefilledRoomId?: string;
  prefilledTime?: string;
  enableKDV?: boolean;
  defaultKdvRate?: number;
  defaultIsKdvInclusive?: boolean;
  onOpenClientHistory?: (clientName: string) => void;
  closedMonths?: Record<string, ClosedMonthRecord>;
}

export default function SessionModal({
  isOpen,
  onClose,
  sessionToEdit,
  onSave,
  defaultPrice,
  defaultOnlinePrice,
  defaultFaceToFacePrice,
  defaultBabysitterFee,
  defaultOfficeRentFee,
  selectedDate,
  sessions,
  enableSmartClientPriceMatching = false,
  clientCustomPrices,
  userRole = 'tenant',
  rooms = [],
  prefilledRoomId = '',
  prefilledTime = '',
  enableKDV = false,
  defaultKdvRate = 20,
  defaultIsKdvInclusive = true,
  onOpenClientHistory,
  closedMonths,
}: SessionModalProps) {
  useBodyScrollLock(isOpen);
  const { formatMoney } = usePrivacy();
  const [clientName, setClientName] = useState('');
  const [type, setType] = useState<SessionType>('online');
  const [date, setDate] = useState(selectedDate);
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState(50);
  const [price, setPrice] = useState<number | string>(defaultPrice);
  const [hasBabysitterFee, setHasBabysitterFee] = useState(true);
  const [babysitterFeeAmount, setBabysitterFeeAmount] = useState<number | string>(defaultBabysitterFee);
  const [hasOfficeRentFee, setHasOfficeRentFee] = useState(false);
  const [officeRentFeeAmount, setOfficeRentFeeAmount] = useState<number | string>(defaultOfficeRentFee);
  const [hasKDV, setHasKDV] = useState(enableKDV);
  const [kdvRate, setKdvRate] = useState<number | string>(defaultKdvRate);
  const [isKdvInclusive, setIsKdvInclusive] = useState(defaultIsKdvInclusive);
  const [notes, setNotes] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid' | 'partial'>('unpaid');
  const [paidAmount, setPaidAmount] = useState<number | string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [isPriceManuallyEdited, setIsPriceManuallyEdited] = useState(false);
  const [isBabysitterFeeManuallyEdited, setIsBabysitterFeeManuallyEdited] = useState(false);
  const [isOfficeRentFeeManuallyEdited, setIsOfficeRentFeeManuallyEdited] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [isAdvancedOptionsOpen, setIsAdvancedOptionsOpen] = useState(false);
  const [showDateNoticeTooltip, setShowDateNoticeTooltip] = useState(false);

  // Check if session or target date is in a closed month (locked from any edits)
  const isOriginalDateInClosedMonth = sessionToEdit ? Boolean(isDateInClosedMonth(sessionToEdit.date, closedMonths)) : false;
  const isCurrentDateInClosedMonth = Boolean(isDateInClosedMonth(date, closedMonths));
  const isSessionInClosedMonth = isOriginalDateInClosedMonth || isCurrentDateInClosedMonth;
  const targetDateStr = sessionToEdit ? sessionToEdit.date : date;
  const closedMonthKey = (isOriginalDateInClosedMonth && sessionToEdit ? sessionToEdit.date : date).slice(0, 7);

  // Determine if editing a past session (date is before today)
  const localTodayStr = getTodayLocalDate();
  const isPastSession = sessionToEdit ? (sessionToEdit.date < localTodayStr) : false;

  // Check if session is older than 7 days
  const isOlderThan7Days = (dateStr: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const sDate = new Date(dateStr);
    sDate.setHours(0,0,0,0);
    
    const diffTime = today.getTime() - sDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 7;
  };
  const isDateTimeLocked = isSessionInClosedMonth || (sessionToEdit 
    ? (sessionToEdit.isSyncedFromCalendar || isOlderThan7Days(sessionToEdit.date)) 
    : false);

  // Date notice tooltip content
  const dateNotice = (() => {
    if (isSessionInClosedMonth) {
      return {
        title: 'Kapatılmış & Kilitli Ay',
        text: `Bu seans kapatılmış (${formatMonthKey(closedMonthKey)}) dönemine aittir. Kapatılan aylar finansal güvenlik için kilitlidir; seansı düzenlemek için önce Ay Kapatma ekranından bu ayın kilidini açmalısınız.`
      };
    }
    if (sessionToEdit?.isSyncedFromCalendar) {
      return {
        title: 'Takvim Seansı',
        text: 'Tarih ve saat takviminizden otomatik eşitlenmiştir. Tarih veya saati değiştirmek için takvim uygulamanızı kullanın. Ücret, ödeme durumu ve notları buradan düzenleyebilirsiniz.'
      };
    }
    if (isDateTimeLocked) {
      return {
        title: 'Geçmiş Seans (7 Günden Eski)',
        text: 'Muhasebeleştiği için tarih ve saat değiştirilemez. Ancak fiyat, ödeme durumu ve notları her zaman düzenleyebilirsiniz.'
      };
    }
    if (isPastSession) {
      return {
        title: 'Geçmiş Seans (Son 1 Hafta)',
        text: 'Tarih ve saat dahil tüm alanları düzenleyebilirsiniz.'
      };
    }
    return null;
  })();

  // Session time conflict calculation
  const currentStart = timeToMinutes(time);
  const currentDuration = Number(duration) || 50;
  const currentEnd = currentStart + currentDuration;

  const conflictingSessions = (sessions || []).filter(s => {
    if (type === 'cancelled') return false;
    if (s.type === 'cancelled') return false;
    if (sessionToEdit && s.id === sessionToEdit.id) return false;
    if (s.date !== date) return false;

    const sStart = timeToMinutes(s.time);
    const sDuration = s.duration || 50;
    const sEnd = sStart + sDuration;

    return currentStart < sEnd && currentEnd > sStart;
  });

  // Smart client price and costs lookup effect
  useEffect(() => {
    if (isOpen && clientName.trim() && type !== 'cancelled' && type !== 'non-session') {
      const isPriceZeroOrNew = !sessionToEdit || (sessionToEdit && (sessionToEdit.price === 0 || !sessionToEdit.price));
      if (isPriceZeroOrNew && !isPriceManuallyEdited) {
        const typeDefault = type === 'online' 
          ? (defaultOnlinePrice || defaultPrice) 
          : (type === 'face-to-face' ? (defaultFaceToFacePrice || defaultPrice) : defaultPrice);

        const matchedCosts = getSmartClientCosts(
          clientName,
          date,
          sessions,
          typeDefault,
          defaultBabysitterFee,
          defaultOfficeRentFee,
          clientCustomPrices,
          type
        );
        if (matchedCosts.price > 0) {
          setPrice(matchedCosts.price);
        }
        if (!isBabysitterFeeManuallyEdited && matchedCosts.babysitterFeeAmount !== defaultBabysitterFee) {
          setBabysitterFeeAmount(matchedCosts.babysitterFeeAmount);
        }
        if (!isOfficeRentFeeManuallyEdited && matchedCosts.officeRentFeeAmount !== defaultOfficeRentFee) {
          setOfficeRentFeeAmount(matchedCosts.officeRentFeeAmount);
        }
      }
    }
  }, [
    clientName,
    date,
    sessions,
    enableSmartClientPriceMatching,
    isPriceManuallyEdited,
    isBabysitterFeeManuallyEdited,
    isOfficeRentFeeManuallyEdited,
    isOpen,
    sessionToEdit,
    defaultPrice,
    defaultOnlinePrice,
    defaultFaceToFacePrice,
    defaultBabysitterFee,
    defaultOfficeRentFee,
    clientCustomPrices,
    type
  ]);

  useEffect(() => {
    if (isOpen) {
      setIsPriceManuallyEdited(false);
      setIsBabysitterFeeManuallyEdited(false);
      setIsOfficeRentFeeManuallyEdited(false);
      setIsAdvancedOptionsOpen(false);
      setShowDateNoticeTooltip(false);
      if (sessionToEdit) {
        setClientName(sessionToEdit.clientName);
        setType(sessionToEdit.type);
        setDate(sessionToEdit.date);
        setTime(sessionToEdit.time);
        setDuration(sessionToEdit.duration);
        setPrice(sessionToEdit.price);
        setHasBabysitterFee(sessionToEdit.hasBabysitterFee);
        setBabysitterFeeAmount(sessionToEdit.babysitterFeeAmount);
        setHasOfficeRentFee(sessionToEdit.type === 'online' ? false : (sessionToEdit.hasOfficeRentFee ?? (sessionToEdit.type === 'face-to-face')));
        setOfficeRentFeeAmount(sessionToEdit.officeRentFeeAmount ?? defaultOfficeRentFee);
        setHasKDV(sessionToEdit.hasKDV ?? enableKDV);
        setIsKdvInclusive(sessionToEdit.isKdvInclusive ?? defaultIsKdvInclusive);
        setKdvRate(sessionToEdit.kdvRate ?? defaultKdvRate);
        setNotes(sessionToEdit.notes || '');
        setPaymentStatus(sessionToEdit.paymentStatus || 'unpaid');
        setPaidAmount(sessionToEdit.paidAmount !== undefined ? sessionToEdit.paidAmount : '');
        setPaymentMethod(sessionToEdit.paymentMethod || '');
        setRoomId(sessionToEdit.roomId || '');
      } else {
        // New session
        const initialType: SessionType = 'online';
        const initialPrice = defaultOnlinePrice || defaultPrice;
        setClientName('');
        setType(initialType);
        setDate(selectedDate);
        setTime(prefilledTime || '10:00');
        setDuration(50);
        setPrice(initialPrice);
        setHasBabysitterFee(true);
        setBabysitterFeeAmount(defaultBabysitterFee);
        setHasOfficeRentFee(false);
        setOfficeRentFeeAmount(defaultOfficeRentFee);
        setHasKDV(enableKDV);
        setIsKdvInclusive(defaultIsKdvInclusive);
        setKdvRate(defaultKdvRate);
        setNotes('');
        setPaymentStatus('unpaid');
        setPaidAmount('');
        setPaymentMethod('');
        setRoomId(prefilledRoomId || '');
      }
    }
  }, [isOpen, sessionToEdit, selectedDate, defaultPrice, defaultOnlinePrice, defaultFaceToFacePrice, defaultBabysitterFee, defaultOfficeRentFee, prefilledRoomId, prefilledTime, enableKDV, defaultKdvRate, defaultIsKdvInclusive]);

  const handleTypeChange = (newType: SessionType) => {
    setType(newType);
    if (newType === 'cancelled') {
      // Cancellation defaults to ₺0 unless they charge cancellation fee
      setPrice(0);
      setHasBabysitterFee(false);
      setHasOfficeRentFee(false);
      setHasKDV(false);
    } else if (newType === 'non-session') {
      // Non-session entries are not billable, so 0 price and no expenses
      setPrice(0);
      setHasBabysitterFee(false);
      setHasOfficeRentFee(false);
      setHasKDV(false);
      setPaymentStatus('unpaid');
    } else if (newType === 'rent-income') {
      // Rent income: clear therapeutic expenses, default to custom price or previous
      setHasBabysitterFee(false);
      setHasOfficeRentFee(false);
      setHasKDV(false);
    } else if (newType === 'face-to-face') {
      const typeDefault = defaultFaceToFacePrice || defaultPrice;
      if (price === 0 || !isPriceManuallyEdited) {
        const smartCosts = getSmartClientCosts(clientName, date, sessions, typeDefault, defaultBabysitterFee, defaultOfficeRentFee, clientCustomPrices, 'face-to-face');
        setPrice(smartCosts.price || typeDefault);
      }
      setHasBabysitterFee(true);
      setHasOfficeRentFee(true);
      setHasKDV(enableKDV);
    } else { // online
      const typeDefault = defaultOnlinePrice || defaultPrice;
      if (price === 0 || !isPriceManuallyEdited) {
        const smartCosts = getSmartClientCosts(clientName, date, sessions, typeDefault, defaultBabysitterFee, defaultOfficeRentFee, clientCustomPrices, 'online');
        setPrice(smartCosts.price || typeDefault);
      }
      setHasBabysitterFee(true);
      setHasOfficeRentFee(false);
      setHasKDV(enableKDV);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSessionInClosedMonth) return;
    if (!clientName.trim()) return;

    const isNonSession = type === 'non-session';
    const isRentIncome = type === 'rent-income';
    const isOnline = type === 'online';
    const sessionPrice = isNonSession ? 0 : Number(price);
    const hasBaby = (isNonSession || isRentIncome) ? false : hasBabysitterFee;
    const babyAmt = (isNonSession || isRentIncome) ? 0 : (hasBaby ? Number(babysitterFeeAmount) : 0);
    const hasOffice = (isNonSession || isRentIncome || isOnline) ? false : hasOfficeRentFee;
    const officeAmt = (isNonSession || isRentIncome || isOnline) ? 0 : (hasOffice ? Number(officeRentFeeAmount) : 0);
    const hasTax = (isNonSession || isRentIncome) ? false : hasKDV;
    const taxRate = hasTax ? (Number(kdvRate) || 0) : 0;
    const taxAmt = hasTax 
      ? (isKdvInclusive 
          ? Math.round((sessionPrice * taxRate) / (100 + taxRate))
          : Math.round((sessionPrice * taxRate) / 100))
      : 0;

    const isCancelledOrNonSession = type === 'cancelled' || type === 'non-session';
    const calcPaidAmount = isCancelledOrNonSession
      ? 0
      : (paymentStatus === 'paid' 
          ? sessionPrice 
          : (paymentStatus === 'partial' ? Math.min(sessionPrice, Math.max(0, Number(paidAmount) || 0)) : 0));

    const sessionData: Session = {
      id: sessionToEdit ? sessionToEdit.id : 'session_' + Math.random().toString(36).substr(2, 9),
      clientName: clientName.trim(),
      type,
      date,
      time,
      duration: Number(duration),
      price: sessionPrice,
      hasBabysitterFee: hasBaby,
      babysitterFeeAmount: babyAmt,
      hasOfficeRentFee: hasOffice,
      officeRentFeeAmount: officeAmt,
      hasKDV: hasTax,
      isKdvInclusive: isKdvInclusive,
      kdvRate: taxRate,
      kdvAmount: taxAmt,
      notes: notes.trim(),
      isSyncedFromCalendar: sessionToEdit ? sessionToEdit.isSyncedFromCalendar : false,
      syncedCalendarType: sessionToEdit ? sessionToEdit.syncedCalendarType : undefined,
      paymentStatus: isCancelledOrNonSession ? 'unpaid' : paymentStatus,
      paidAmount: calcPaidAmount,
      paymentMethod: isCancelledOrNonSession ? undefined : (paymentMethod ? (paymentMethod as PaymentMethod) : undefined),
      roomId: roomId || undefined,
    };

    onSave(sessionData);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overscroll-contain touch-none" id="session-modal-overlay" role="dialog" aria-modal="true">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-md touch-none"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="relative w-full max-w-lg bg-white rounded-[2rem] border border-[#e5e1d8] overflow-hidden shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] z-10 overscroll-contain touch-pan-y"
            id="session-modal-content"
          >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#f5f5f0] flex justify-between items-center bg-[#fdfbf7] shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-serif text-[#6b705c] italic">
              {sessionToEdit ? 'Seans Bilgilerini Düzenle' : 'Yeni Seans Kaydı'}
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-600 font-medium">Danışan seans detaylarını girin</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f0] hover:bg-[#e5e5df] text-[#6b705c] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-3.5 flex-1 overflow-y-auto">
          {/* Closed / Locked Month Warning Banner */}
          {isSessionInClosedMonth && (
            <div className="bg-amber-50/95 border-2 border-amber-300 text-amber-950 rounded-2xl p-3.5 space-y-1.5 shadow-2xs animate-fade-in" id="closed-month-lock-banner">
              <div className="flex items-center gap-2 font-bold text-amber-900 text-xs">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Kapatılmış & Kilitli Ay ({formatMonthKey(closedMonthKey)})</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                Bu seans kapatılmış bir muhasebe dönemine aittir. Kapatılan aylar finansal ve yasal denetim güvenliği için kilitlenmiştir; üzerinde değişiklik yapılamaz. Düzenleme yapabilmek için lütfen önce <strong>Ay Kapatma</strong> ekranından bu ayın kilidini açın.
              </p>
            </div>
          )}

          {/* Client Name */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] tracking-wider block">
                {type === 'rent-income' 
                  ? 'ÖDEMEYİ YAPAN / TERAPİST' 
                  : type === 'non-session' 
                    ? 'ETKİNLİK / TOPLANTI BAŞLIĞI' 
                    : 'DANIŞAN ADI SOYADI'}
              </label>
              {onOpenClientHistory && clientName.trim().length > 0 && type !== 'non-session' && (
                <button
                  type="button"
                  onClick={() => onOpenClientHistory(clientName)}
                  className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 hover:underline cursor-pointer bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60"
                  title="Bu danışanın tüm seans geçmişini ve bakiyesini gör"
                >
                  <History className="w-3 h-3 text-emerald-600" />
                  <span>Seans Geçmişi</span>
                </button>
              )}
            </div>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-[#a5a58d]" />
              <input
                type="text"
                required
                disabled={isSessionInClosedMonth}
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 text-base sm:text-sm border rounded-2xl focus:outline-none focus:border-[#6b705c] ${
                  isSessionInClosedMonth 
                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed font-medium' 
                    : 'bg-[#fdfbf7] border-[#e5e1d8]'
                }`}
                placeholder={
                  type === 'rent-income' 
                    ? "Örn. Psk. Ahmet Yılmaz" 
                    : type === 'non-session' 
                      ? "Örn. Ekip Toplantısı, Süpervizyon" 
                      : "Örn. Ahmet Yılmaz"
                }
              />
            </div>
          </div>

          {/* Session Type Selector (Dropdown) */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] tracking-wider block">ETKİNLİK TİPİ</label>
            <div className="relative">
              <select
                value={type}
                disabled={isSessionInClosedMonth}
                onChange={(e) => handleTypeChange(e.target.value as SessionType)}
                className={`w-full px-3.5 py-2 text-sm sm:text-xs border rounded-xl focus:outline-none focus:border-[#6b705c] h-[38px] font-semibold transition-colors ${
                  isSessionInClosedMonth 
                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed' 
                    : 'bg-[#fdfbf7] border-[#e5e1d8] text-slate-800 cursor-pointer'
                }`}
              >
                <option value="online">🌐 Online Seans</option>
                <option value="face-to-face">👥 Yüzyüze Seans</option>
                <option value="cancelled">🚫 İptal Edildi</option>
                <option value="non-session">📋 Seans Değil / Toplantı</option>
                {userRole === 'owner' && (
                  <option value="rent-income">🏢 Ofis / Kira Geliri</option>
                )}
              </select>
            </div>
          </div>

          {/* Room Selector (Sadece Yüz Yüze veya Kira Geliri seçildiğinde görünür) */}
          {(type === 'face-to-face' || type === 'rent-income') && rooms && rooms.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1 overflow-hidden"
              id="modal-room-selector"
            >
              <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] tracking-wider block">KLİNİK ODA SEÇİMİ</label>
              <div className="relative">
                <Building className="absolute left-3 top-2.5 w-4 h-4 text-[#a5a58d]" />
                <select
                  value={roomId}
                  disabled={isSessionInClosedMonth}
                  onChange={(e) => setRoomId(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 text-base sm:text-xs border rounded-2xl focus:outline-none focus:border-[#6b705c] h-[38px] font-medium ${
                    isSessionInClosedMonth 
                      ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed' 
                      : 'bg-[#fdfbf7] border-[#e5e1d8] cursor-pointer'
                  }`}
                >
                  <option value="">-- Herhangi bir odada (Atanmamış) --</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      🛋️ {r.name} ({r.type === 'standard' ? 'Bireysel' : r.type === 'play-therapy' ? 'Oyun' : r.type === 'family-therapy' ? 'Aile & Çift' : r.type === 'group-therapy' ? 'Grup' : 'Diğer'})
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}

          {/* Session Time Conflict Detection Warning Banner */}
          {conflictingSessions.length > 0 && type !== 'cancelled' && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              className="bg-amber-50/90 border-2 border-amber-300 text-amber-950 rounded-2xl p-3.5 space-y-2 text-xs shadow-sm overflow-hidden"
              id="session-conflict-alert"
            >
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Çakışma Tespit Edildi</span>
              </div>
              <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                Seçilen saat diliminde ({time} - {minutesToTime(currentEnd)}) mevcut {conflictingSessions.length} seans ile zaman çakışması tespit edildi:
              </p>
              <div className="space-y-1.5 pt-0.5">
                {conflictingSessions.map(cs => {
                  const csStart = timeToMinutes(cs.time);
                  const csEnd = csStart + (cs.duration || 50);
                  const roomObj = rooms.find(r => r.id === cs.roomId);
                  return (
                    <div key={cs.id} className="bg-white/95 border border-amber-200/80 rounded-xl px-3 py-2 flex items-center justify-between text-[11px] shadow-3xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <span className="font-bold text-slate-800 truncate">{cs.clientName || 'İsimsiz Seans'}</span>
                        {roomObj && (
                          <span className="text-[10px] text-amber-800 bg-amber-100/60 px-1.5 py-0.5 rounded font-medium shrink-0">
                            🛋️ {roomObj.name}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-md font-bold text-[10px] shrink-0 ml-2">
                        {cs.time} - {minutesToTime(csEnd)} ({cs.duration || 50} dk)
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Core Fields Grid: (Date, Time, Duration, Price) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5 min-w-0 w-full max-w-full box-border">
            {/* Row 1, Col 1: Tarih */}
            <div className="space-y-1 min-w-0 w-full max-w-full box-border">
              <div className="flex items-center justify-between">
                <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] tracking-wider block truncate">TARİH</label>
                {dateNotice && (
                  <div className="relative inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowDateNoticeTooltip(prev => !prev)}
                      onMouseEnter={() => setShowDateNoticeTooltip(true)}
                      onMouseLeave={() => setShowDateNoticeTooltip(false)}
                      className="text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100/80 p-0.5 rounded-full cursor-pointer transition-colors"
                      title={dateNotice.text}
                      aria-label="Tarih bilgi notu"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    {showDateNoticeTooltip && (
                      <div className="absolute left-0 bottom-full mb-1.5 z-50 w-64 p-2.5 bg-slate-900 text-white text-[11px] rounded-xl shadow-xl pointer-events-none leading-relaxed animate-fade-in">
                        <div className="font-bold text-amber-300 mb-0.5 flex items-center gap-1">
                          <Info className="w-3 h-3 text-amber-300 shrink-0" />
                          <span>{dateNotice.title}</span>
                        </div>
                        <p className="text-slate-200 text-[10px] leading-normal">{dateNotice.text}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="relative min-w-0 w-full max-w-full box-border overflow-hidden">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a5a58d] pointer-events-none z-10 shrink-0" />
                <input
                  type="date"
                  required
                  disabled={isDateTimeLocked}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full max-w-full min-w-0 block box-border appearance-none pl-9 pr-2 py-2 text-sm sm:text-xs border rounded-xl focus:outline-none focus:border-[#6b705c] [color-scheme:light] [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit]:max-w-full [&::-webkit-datetime-edit-fields-wrapper]:p-0 [&::-webkit-date-and-time-value]:text-left [&::-webkit-date-and-time-value]:m-0 [&::-webkit-calendar-picker-indicator]:p-0 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer ${
                    isDateTimeLocked 
                      ? 'bg-slate-100/80 text-slate-400 border-slate-200 cursor-not-allowed font-medium' 
                      : 'bg-[#fdfbf7] border-[#e5e1d8] text-slate-800'
                  }`}
                />
              </div>
            </div>

            {/* Row 1, Col 2: Saat */}
            <div className="space-y-1 min-w-0 w-full max-w-full box-border">
              <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] tracking-wider block truncate">SAAT</label>
              <div className="relative min-w-0 w-full max-w-full box-border overflow-hidden">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a5a58d] pointer-events-none z-10 shrink-0" />
                <input
                  type="time"
                  required
                  disabled={isDateTimeLocked}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={`w-full max-w-full min-w-0 block box-border appearance-none pl-9 pr-2 py-2 text-sm sm:text-xs border rounded-xl focus:outline-none focus:border-[#6b705c] [color-scheme:light] [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit]:max-w-full [&::-webkit-datetime-edit-fields-wrapper]:p-0 [&::-webkit-date-and-time-value]:text-left [&::-webkit-date-and-time-value]:m-0 [&::-webkit-calendar-picker-indicator]:p-0 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer ${
                    isDateTimeLocked 
                      ? 'bg-slate-100/80 text-slate-400 border-slate-200 cursor-not-allowed font-medium' 
                      : 'bg-[#fdfbf7] border-[#e5e1d8] text-slate-800'
                  }`}
                />
              </div>
            </div>

            {/* Row 2, Col 1: Süre */}
            {type !== 'rent-income' && (
              <div className="space-y-1 min-w-0 w-full max-w-full box-border">
                <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] tracking-wider block truncate">SÜRE</label>
                <select
                  value={duration}
                  disabled={isSessionInClosedMonth}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className={`w-full max-w-full min-w-0 box-border block px-3 py-2 text-sm sm:text-xs border rounded-xl focus:outline-none focus:border-[#6b705c] h-[38px] ${
                    isSessionInClosedMonth
                      ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                      : 'bg-[#fdfbf7] border-[#e5e1d8] text-slate-800'
                  }`}
                >
                  <option value="30">30 Dakika</option>
                  <option value="45">45 Dakika</option>
                  <option value="50">50 Dk (Standart)</option>
                  <option value="60">60 Dakika</option>
                  <option value="90">90 Dakika</option>
                </select>
              </div>
            )}

            {/* Row 2, Col 2: Seans Ücreti */}
            <div className={`space-y-1 min-w-0 w-full max-w-full box-border ${type === 'rent-income' ? 'sm:col-span-2' : ''}`}>
              <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] tracking-wider block truncate">
                {type === 'rent-income' ? 'KİRA TUTARI (₺)' : 'SEANS ÜCRETİ (₺)'}
              </label>
              <div className="relative min-w-0 w-full max-w-full box-border">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#a5a58d] pointer-events-none z-10">₺</span>
                <input
                  type="number"
                  required
                  min="0"
                  disabled={isSessionInClosedMonth || type === 'cancelled' || type === 'non-session'}
                  value={(type === 'cancelled' || type === 'non-session') ? 0 : (price === 0 ? '' : price)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPrice(val === '' ? '' : Number(val));
                    setIsPriceManuallyEdited(true);
                  }}
                  onFocus={(e) => e.target.select()}
                  className={`w-full max-w-full min-w-0 block box-border pl-7 pr-3 py-2 text-sm sm:text-xs border rounded-xl focus:outline-none focus:border-[#6b705c] ${
                    (isSessionInClosedMonth || type === 'cancelled' || type === 'non-session')
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed font-medium'
                      : 'bg-[#fdfbf7] border-[#e5e1d8] text-slate-800'
                  }`}
                />
              </div>
              {isOpen && !sessionToEdit && enableSmartClientPriceMatching && clientName.trim() && type !== 'cancelled' && type !== 'rent-income' && (() => {
                const matchedCosts = getSmartClientCosts(clientName, date, sessions, defaultPrice, defaultBabysitterFee, defaultOfficeRentFee);
                if (matchedCosts.price !== defaultPrice && Number(price) === matchedCosts.price) {
                  return (
                    <p className="text-[9px] sm:text-[10px] text-[#cb997e] font-sans font-bold flex items-center gap-1 mt-1 animate-fade-in" id="smart-price-badge">
                      <Sparkles className="w-3 h-3 text-[#cb997e]" />
                      Akıllı fiyat uygulandı ({formatMoney(matchedCosts.price)})
                    </p>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          {/* Payment Status Selector */}
          {type !== 'cancelled' && type !== 'non-session' && (
            <div className="space-y-3 bg-[#fdfbf7] p-3.5 rounded-2xl border border-[#e5e1d8] animate-fade-in">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#6b705c] block">
                  Ücret tahsil edildi mi?
                </span>
                <div className="flex gap-1.5 bg-[#f5f5f0] p-1 rounded-xl border border-[#e5e1d8]/60">
                  <button
                    type="button"
                    disabled={isSessionInClosedMonth}
                    onClick={() => {
                      setPaymentStatus('unpaid');
                      setPaidAmount('');
                      setPaymentMethod('');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all select-none ${
                      isSessionInClosedMonth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                    } ${
                      paymentStatus === 'unpaid'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    Ödenmedi
                  </button>
                  <button
                    type="button"
                    disabled={isSessionInClosedMonth}
                    onClick={() => {
                      setPaymentStatus('partial');
                      if (!paidAmount && price) {
                        setPaidAmount('');
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all select-none ${
                      isSessionInClosedMonth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                    } ${
                      paymentStatus === 'partial'
                        ? 'bg-amber-100 text-amber-900 border border-amber-200 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    ◐ Kısmi
                  </button>
                  <button
                    type="button"
                    disabled={isSessionInClosedMonth}
                    onClick={() => {
                      setPaymentStatus('paid');
                      setPaidAmount(price);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all select-none ${
                      isSessionInClosedMonth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                    } ${
                      paymentStatus === 'paid'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    Ödendi
                  </button>
                </div>
              </div>

              {paymentStatus === 'partial' && (
                <div className="pt-2.5 border-t border-[#e5e1d8]/70 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5 shrink-0">
                      <span>Alınan Tutar (₺):</span>
                    </label>
                    <div className="relative w-36">
                      <input
                        type="number"
                        min="0"
                        max={Number(price) || 0}
                        step="50"
                        disabled={isSessionInClosedMonth}
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        placeholder="Örn: 1500"
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs font-bold text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs ${
                          isSessionInClosedMonth
                            ? 'bg-slate-100 border-slate-300 cursor-not-allowed text-slate-400'
                            : 'bg-white border-amber-300'
                        }`}
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₺</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-[11px] bg-amber-50/90 px-3 py-1.5 rounded-lg border border-amber-200/80">
                    <span className="text-amber-900 font-medium">
                      Alınan: <strong className="font-bold text-emerald-700">₺{(Number(paidAmount) || 0).toLocaleString('tr-TR')}</strong>
                    </span>
                    <span className="text-amber-900 font-medium">
                      Kalan Borç: <strong className="font-bold text-red-600">₺{Math.max(0, (Number(price) || 0) - (Number(paidAmount) || 0)).toLocaleString('tr-TR')}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Payment Method Selector (Sadece Ödendi veya Kısmi Ödendi durumunda gösterilir) */}
              {(paymentStatus === 'paid' || paymentStatus === 'partial') && (
                <div className="pt-2.5 border-t border-[#e5e1d8]/70 space-y-1.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#6b705c] flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-[#6b705c]" />
                      Ödeme Yöntemi
                    </span>
                    {paymentMethod && !isSessionInClosedMonth && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('')}
                        className="text-[10px] text-slate-400 hover:text-slate-600 underline font-medium cursor-pointer"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      disabled={isSessionInClosedMonth}
                      onClick={() => setPaymentMethod(paymentMethod === 'card' ? '' : 'card')}
                      className={`px-2 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                        isSessionInClosedMonth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                      } ${
                        paymentMethod === 'card'
                          ? 'bg-[#6b705c] text-white border-[#6b705c] shadow-xs'
                          : 'bg-white text-slate-700 border-[#e5e1d8] hover:bg-[#f5f5f0]'
                      }`}
                    >
                      <CreditCard className={`w-3.5 h-3.5 ${paymentMethod === 'card' ? 'text-white' : 'text-[#6b705c]'}`} />
                      <span>Kart</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSessionInClosedMonth}
                      onClick={() => setPaymentMethod(paymentMethod === 'cash' ? '' : 'cash')}
                      className={`px-2 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                        isSessionInClosedMonth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                      } ${
                        paymentMethod === 'cash'
                          ? 'bg-[#6b705c] text-white border-[#6b705c] shadow-xs'
                          : 'bg-white text-slate-700 border-[#e5e1d8] hover:bg-[#f5f5f0]'
                      }`}
                    >
                      <Banknote className={`w-3.5 h-3.5 ${paymentMethod === 'cash' ? 'text-white' : 'text-emerald-600'}`} />
                      <span>Nakit</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSessionInClosedMonth}
                      onClick={() => setPaymentMethod(paymentMethod === 'transfer' ? '' : 'transfer')}
                      className={`px-2 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                        isSessionInClosedMonth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                      } ${
                        paymentMethod === 'transfer'
                          ? 'bg-[#6b705c] text-white border-[#6b705c] shadow-xs'
                          : 'bg-white text-slate-700 border-[#e5e1d8] hover:bg-[#f5f5f0]'
                      }`}
                    >
                      <Landmark className={`w-3.5 h-3.5 ${paymentMethod === 'transfer' ? 'text-white' : 'text-indigo-600'}`} />
                      <span>Havale / EFT</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Seans Giderleri (Doğrudan Erişilebilir & Hızlı İşaretleme) */}
          {(type === 'online' || type === 'face-to-face') && (
            <div className="space-y-3 pt-1">
              <div className={`grid grid-cols-1 ${type === 'face-to-face' ? 'sm:grid-cols-2' : ''} gap-3`}>
                {/* 1. Bakıcı Gideri (Her seansta hızlıca işaretlenebilmesi için doğrudan formda) */}
                <div className="bg-[#f5f5f0] p-3 rounded-2xl border border-[#e5e1d8]/60 flex flex-col justify-between min-h-[72px]">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-700">Bakıcı Gideri?</span>
                    <label className={`relative inline-flex items-center ${isSessionInClosedMonth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        disabled={isSessionInClosedMonth}
                        checked={hasBabysitterFee}
                        onChange={(e) => setHasBabysitterFee(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#6b705c] peer-disabled:opacity-50"></div>
                    </label>
                  </div>

                  {hasBabysitterFee && (
                    <div className="mt-1 flex flex-col gap-1 w-full animate-fade-in">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-500 shrink-0">Tutar:</span>
                        <input
                          type="number"
                          min="0"
                          disabled={isSessionInClosedMonth}
                          value={babysitterFeeAmount === 0 ? '' : babysitterFeeAmount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBabysitterFeeAmount(val === '' ? '' : Number(val));
                            setIsBabysitterFeeManuallyEdited(true);
                          }}
                          onFocus={(e) => e.target.select()}
                          className={`w-full px-2 py-1 text-base sm:text-xs border rounded-lg focus:outline-none focus:border-[#6b705c] ${
                            isSessionInClosedMonth ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white border-[#e5e1d8]'
                          }`}
                        />
                        <span className="text-[10px] font-bold text-slate-500">₺</span>
                      </div>
                      {isOpen && !sessionToEdit && enableSmartClientPriceMatching && clientName.trim() && (() => {
                        const matchedCosts = getSmartClientCosts(clientName, date, sessions, defaultPrice, defaultBabysitterFee, defaultOfficeRentFee);
                        if (matchedCosts.babysitterFeeAmount !== defaultBabysitterFee && Number(babysitterFeeAmount) === matchedCosts.babysitterFeeAmount) {
                          return (
                            <p className="text-[8px] text-[#cb997e] font-sans font-bold flex items-center gap-0.5 animate-fade-in" id="smart-babysitter-badge">
                              <Sparkles className="w-2.5 h-2.5 text-[#cb997e]" />
                              Akıllı ücret ({formatMoney(matchedCosts.babysitterFeeAmount)})
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </div>

                {/* 2. Ofis Kira Gideri (SADECE Yüzyüze Seanslarda Görünür, Online'da ASLA Yoktur) */}
                {type === 'face-to-face' && (
                  <div className="bg-[#f5f5f0] p-3 rounded-2xl border border-[#e5e1d8]/60 flex flex-col justify-between min-h-[72px] animate-fade-in">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] sm:text-xs font-bold text-slate-700">Ofis Kira Gideri?</span>
                      <label className={`relative inline-flex items-center ${isSessionInClosedMonth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          disabled={isSessionInClosedMonth}
                          checked={hasOfficeRentFee}
                          onChange={(e) => setHasOfficeRentFee(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#6b705c] peer-disabled:opacity-50"></div>
                      </label>
                    </div>

                    {hasOfficeRentFee && (
                      <div className="mt-1 flex flex-col gap-1 w-full animate-fade-in">
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-slate-500 shrink-0">Tutar:</span>
                          <input
                            type="number"
                            min="0"
                            disabled={isSessionInClosedMonth}
                            value={officeRentFeeAmount === 0 ? '' : officeRentFeeAmount}
                            onChange={(e) => {
                              const val = e.target.value;
                              setOfficeRentFeeAmount(val === '' ? '' : Number(val));
                              setIsOfficeRentFeeManuallyEdited(true);
                            }}
                            onFocus={(e) => e.target.select()}
                            className={`w-full px-2 py-1 text-base sm:text-xs border rounded-lg focus:outline-none focus:border-[#6b705c] ${
                              isSessionInClosedMonth ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white border-[#e5e1d8]'
                            }`}
                          />
                          <span className="text-[10px] font-bold text-slate-500">₺</span>
                        </div>
                        {isOpen && !sessionToEdit && enableSmartClientPriceMatching && clientName.trim() && (() => {
                          const matchedCosts = getSmartClientCosts(clientName, date, sessions, defaultPrice, defaultBabysitterFee, defaultOfficeRentFee);
                          if (matchedCosts.officeRentFeeAmount !== defaultOfficeRentFee && Number(officeRentFeeAmount) === matchedCosts.officeRentFeeAmount) {
                            return (
                              <p className="text-[8px] text-[#cb997e] font-sans font-bold flex items-center gap-0.5 animate-fade-in" id="smart-officerent-badge">
                                <Sparkles className="w-2.5 h-2.5 text-[#cb997e]" />
                                Akıllı ücret ({formatMoney(matchedCosts.officeRentFeeAmount)})
                              </p>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Gelişmiş Seçenekler: KDV / Fatura Kesintisi Akordeonu */}
              {(enableKDV || sessionToEdit?.hasKDV) && (
                <div className="border border-[#e5e1d8] rounded-2xl overflow-hidden bg-[#faf8f5] transition-all">
                  <button
                    type="button"
                    onClick={() => setIsAdvancedOptionsOpen(prev => !prev)}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[#f3f0ea] transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Receipt className="w-3.5 h-3.5 text-[#6b705c] shrink-0" />
                      <span className="text-xs font-bold text-[#555a4a] truncate">Gelişmiş Seçenekler</span>
                      <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">(KDV & Fatura)</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {hasKDV && (
                        <span className="text-[9px] bg-rose-50 text-rose-800 border border-rose-200/80 px-1.5 py-0.5 rounded-md font-semibold">
                          KDV %{kdvRate} ({isKdvInclusive ? 'Dahil' : 'Hariç'})
                        </span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isAdvancedOptionsOpen ? 'rotate-180' : 'rotate-0'}`} />
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isAdvancedOptionsOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-[#e5e1d8]/80"
                      >
                        <div className="p-3 bg-[#fdfbf7]">
                          <div className="bg-[#f5f5f0] p-3 rounded-xl border border-[#e5e1d8]/60 flex flex-col justify-between">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] sm:text-xs font-bold text-slate-700 flex items-center gap-1">
                                <Receipt className="w-3.5 h-3.5 text-[#6b705c]" />
                                KDV Kesintisi / Fatura?
                              </span>
                              <label className={`relative inline-flex items-center ${isSessionInClosedMonth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                                <input
                                  type="checkbox"
                                  disabled={isSessionInClosedMonth}
                                  checked={hasKDV}
                                  onChange={(e) => setHasKDV(e.target.checked)}
                                  className="sr-only peer"
                                />
                                <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#6b705c] peer-disabled:opacity-50"></div>
                              </label>
                            </div>

                            {hasKDV && (
                              <div className="mt-2 flex flex-col gap-2 w-full animate-fade-in">
                                <div className="grid grid-cols-2 gap-1 bg-white p-0.5 rounded-lg border border-[#e5e1d8]">
                                  <button
                                    type="button"
                                    disabled={isSessionInClosedMonth}
                                    onClick={() => setIsKdvInclusive(true)}
                                    className={`py-1 px-1 text-[10px] font-bold rounded transition-all ${
                                      isSessionInClosedMonth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                                    } ${
                                      isKdvInclusive
                                        ? 'bg-[#6b705c] text-white shadow-xs'
                                        : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                  >
                                    KDV Dahil
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSessionInClosedMonth}
                                    onClick={() => setIsKdvInclusive(false)}
                                    className={`py-1 px-1 text-[10px] font-bold rounded transition-all ${
                                      isSessionInClosedMonth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                                    } ${
                                      !isKdvInclusive
                                        ? 'bg-[#6b705c] text-white shadow-xs'
                                        : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                  >
                                    KDV Hariç
                                  </button>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-500 shrink-0 font-medium">Oran:</span>
                                  <div className="relative flex-1">
                                    <span className="absolute left-2 top-1 text-[10px] font-bold text-slate-400">%</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      disabled={isSessionInClosedMonth}
                                      value={kdvRate === 0 ? '' : kdvRate}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setKdvRate(val === '' ? '' : Number(val));
                                      }}
                                      onFocus={(e) => e.target.select()}
                                      className={`w-full pl-5 pr-2 py-1 text-base sm:text-xs border rounded-lg focus:outline-none ${
                                        isSessionInClosedMonth ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white border-[#e5e1d8]'
                                      }`}
                                    />
                                  </div>
                                </div>

                                {Number(price) > 0 && (() => {
                                  const rateVal = Number(kdvRate) || 0;
                                  const priceVal = Number(price);
                                  const kCut = isKdvInclusive 
                                    ? Math.round((priceVal * rateVal) / (100 + rateVal))
                                    : Math.round((priceVal * rateVal) / 100);
                                  return (
                                    <p className="text-[9px] text-rose-600 font-bold flex items-center gap-0.5">
                                      {isKdvInclusive ? 'Fiyata dahil KDV:' : 'Fiyata eklenecek KDV:'} {formatMoney(kCut)}
                                    </p>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {/* Dedicated Calculation Summary Card (Formdan ayrılmış, hafif gri Card & Net Tutar büyük/kalın punto) */}
          {Number(price) > 0 && (type === 'online' || type === 'face-to-face' || type === 'rent-income') && (() => {
            const p = Number(price);
            const r = Number(kdvRate) || 0;
            const kdvCut = (hasKDV && type !== 'rent-income') ? (isKdvInclusive ? Math.round((p * r) / (100 + r)) : Math.round((p * r) / 100)) : 0;
            const baby = (hasBabysitterFee && type !== 'rent-income') ? Number(babysitterFeeAmount) || 0 : 0;
            const office = (hasOfficeRentFee && type === 'face-to-face') ? Number(officeRentFeeAmount) || 0 : 0;

            const grossCollected = (hasKDV && !isKdvInclusive && type !== 'rent-income') ? (p + kdvCut) : p;
            const totalDeductions = kdvCut + baby + office;
            const netEarnings = Math.max(0, grossCollected - totalDeductions);

            return (
              <div className="bg-[#f5f5f2] border border-[#e5e1d8] rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-2.5 animate-fade-in">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-[#6b705c]" />
                    <span>HESAPLAMA ÖZETİ</span>
                  </div>
                  {totalDeductions > 0 && (
                    <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60 font-semibold">
                      Toplam Kesinti: -{formatMoney(totalDeductions)}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs pt-0.5">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>{hasKDV && !isKdvInclusive && type !== 'rent-income' ? 'Yalın Seans Ücreti (Matrah):' : 'Brüt Seans Ücreti:'}</span>
                    <span className="font-semibold text-slate-800">{formatMoney(p)}</span>
                  </div>

                  {hasKDV && !isKdvInclusive && type !== 'rent-income' && (
                    <div className="flex justify-between items-center text-emerald-700 text-[11px] font-medium">
                      <span>+ KDV (%{r}):</span>
                      <span>+{formatMoney(kdvCut)}</span>
                    </div>
                  )}

                  {hasKDV && !isKdvInclusive && type !== 'rent-income' && (
                    <div className="flex justify-between items-center text-slate-700 font-bold border-t border-dashed border-[#e5e1d8] pt-1">
                      <span>Danışandan Tahsil Edilen (Brüt Toplam):</span>
                      <span>{formatMoney(grossCollected)}</span>
                    </div>
                  )}

                  {hasKDV && type !== 'rent-income' && (
                    <div className="flex justify-between items-center text-rose-600 text-[11px]">
                      <span>KDV Kesintisi (%{r} {isKdvInclusive ? 'Dahil' : 'Hariç'}):</span>
                      <span className="font-semibold">-{formatMoney(kdvCut)}</span>
                    </div>
                  )}

                  {hasBabysitterFee && baby > 0 && type !== 'rent-income' && (
                    <div className="flex justify-between items-center text-orange-700 text-[11px]">
                      <span>Bakıcı Gideri:</span>
                      <span className="font-semibold">-{formatMoney(baby)}</span>
                    </div>
                  )}

                  {type === 'face-to-face' && hasOfficeRentFee && office > 0 && (
                    <div className="flex justify-between items-center text-amber-800 text-[11px]">
                      <span>Ofis Kira Gideri:</span>
                      <span className="font-semibold">-{formatMoney(office)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-[#e0dcce] pt-2.5 flex justify-between items-center">
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 block">Net Ele Geçen Tutar</span>
                    <span className="text-[10px] text-slate-500 font-medium">Tüm kesintiler sonrası kalan kazanç</span>
                  </div>
                  <span className="text-lg sm:text-xl font-extrabold text-emerald-700 tracking-tight">
                    {formatMoney(netEarnings)}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] tracking-wider block">
              {type === 'rent-income' ? 'KİRA GELİRİ NOTLARI (ÖZEL)' : 'SEANS NOTLARI (ÖZEL)'}
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 w-4 h-4 text-[#a5a58d]" />
              <textarea
                value={notes}
                disabled={isSessionInClosedMonth}
                onChange={(e) => setNotes(e.target.value)}
                rows={1}
                className={`w-full pl-10 pr-4 py-2 text-base sm:text-xs border rounded-2xl focus:outline-none focus:border-[#6b705c] resize-none ${
                  isSessionInClosedMonth
                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                    : 'bg-[#fdfbf7] border-[#e5e1d8]'
                }`}
                placeholder={isSessionInClosedMonth ? "Kapatılmış ay seansı - notlar kilitlidir" : "Geçmiş terapi notları, ödeme planı veya oda bilgisi..."}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#f5f5f0] flex gap-3 justify-between items-center shrink-0">
            {sessionToEdit && !sessionToEdit.isSyncedFromCalendar ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const currentSessionData: Session = {
                    id: sessionToEdit.id,
                    clientName: clientName.trim() || 'Danışan',
                    type,
                    date,
                    time,
                    duration: Number(duration),
                    price: Number(price),
                    hasBabysitterFee,
                    babysitterFeeAmount: hasBabysitterFee ? Number(babysitterFeeAmount) : 0,
                    hasOfficeRentFee,
                    officeRentFeeAmount: hasOfficeRentFee ? Number(officeRentFeeAmount) : 0,
                    notes: notes.trim(),
                    isSyncedFromCalendar: sessionToEdit.isSyncedFromCalendar,
                    syncedCalendarType: sessionToEdit.syncedCalendarType,
                    paymentStatus
                  };
                  downloadSessionAsICS(currentSessionData);
                }}
                className="px-4 py-2 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none touch-manipulation"
                title="Bu seansı cihazınızın takvimine kaydetmek için .ics dosyası indirin"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Takvime Ekle (Cihaz)
              </motion.button>
            ) : (
              <div />
            )}
            <div className="flex gap-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="px-4 py-2 rounded-full border border-[#e5e1d8] hover:bg-[#f5f5f0] text-xs font-semibold text-[#6b705c] transition-colors cursor-pointer select-none touch-manipulation"
              >
                Vazgeç
              </motion.button>
              <motion.button
                type="submit"
                disabled={isSessionInClosedMonth}
                whileTap={isSessionInClosedMonth ? {} : { scale: 0.95 }}
                className={`px-5 py-2 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 select-none touch-manipulation ${
                  isSessionInClosedMonth
                    ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                    : 'bg-[#6b705c] hover:bg-[#585c4c] text-white cursor-pointer'
                }`}
              >
                {isSessionInClosedMonth ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Kilitli (Kapatılmış Ay)</span>
                  </>
                ) : (
                  <span>Kaydet</span>
                )}
              </motion.button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
      )}
    </AnimatePresence>
  );
}
