import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, CalendarPlus, Clock, Wallet, FileText, User, Laptop, MapPin, Ban, Building, Sparkles, AlertTriangle, Percent, Receipt, CreditCard, Banknote, Landmark, History, Info, ChevronDown, ChevronUp, SlidersHorizontal, Lock, CheckCircle } from 'lucide-react';
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

  // Check if session or target date is in a closed month
  const isOriginalDateInClosedMonth = sessionToEdit ? Boolean(isDateInClosedMonth(sessionToEdit.date, closedMonths)) : false;
  const isCurrentDateInClosedMonth = Boolean(isDateInClosedMonth(date, closedMonths));
  const isEditingClosedMonthSession = Boolean(sessionToEdit && isOriginalDateInClosedMonth);
  const isCreatingInClosedMonth = Boolean(!sessionToEdit && isCurrentDateInClosedMonth);
  const isSessionInClosedMonth = isEditingClosedMonthSession || isCreatingInClosedMonth;
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
    if (isEditingClosedMonthSession) {
      return {
        title: 'Kapatılmış Ay (Dönem Koruması)',
        text: `Bu seans kapatılmış (${formatMonthKey(closedMonthKey)}) dönemine aittir. Takvim eşitlemesinde kaybolmaması için tarih, saat ve ücret kilitlidir. Ancak geçmiş borç tahsilatı için ödeme durumu ve tahsilat alanları açıktır.`
      };
    }
    if (isCreatingInClosedMonth) {
      return {
        title: 'Kapatılmış & Kilitli Ay',
        text: `Bu tarih kapatılmış (${formatMonthKey(closedMonthKey)}) dönemine aittir. Kapatılan aylara yeni seans eklenemez.`
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
    if (isCreatingInClosedMonth) return;
    if (!clientName.trim()) return;

    // If editing a session in a closed month, keep date, time, price, and type strictly frozen,
    // while allowing payment settlement (debt clearance) and notes to update.
    if (isEditingClosedMonthSession && sessionToEdit) {
      const isCancelledOrNonSession = sessionToEdit.type === 'cancelled' || sessionToEdit.type === 'non-session';
      const calcPaidAmount = isCancelledOrNonSession
        ? 0
        : (paymentStatus === 'paid' 
            ? sessionToEdit.price 
            : (paymentStatus === 'partial' ? Math.min(sessionToEdit.price, Math.max(0, Number(paidAmount) || 0)) : 0));

      const updatedSessionData: Session = {
        ...sessionToEdit,
        paymentStatus: isCancelledOrNonSession ? 'unpaid' : paymentStatus,
        paidAmount: calcPaidAmount,
        paymentMethod: isCancelledOrNonSession ? undefined : (paymentMethod ? (paymentMethod as PaymentMethod) : undefined),
        notes: notes.trim(),
        updatedAt: Date.now(),
        isManuallyEdited: true
      };

      onSave(updatedSessionData);
      onClose();
      return;
    }

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
      updatedAt: Date.now(),
      isManuallyEdited: true
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
            className="relative w-full max-w-lg bg-white rounded-[1.75rem] sm:rounded-[2rem] border border-[#e5e1d8] overflow-hidden shadow-2xl flex flex-col max-h-[88dvh] sm:max-h-[86vh] z-10 overscroll-contain touch-pan-y"
            id="session-modal-content"
          >
        {/* Header */}
        <div className="px-5 py-3 sm:px-6 sm:py-3.5 border-b border-[#f0ede6] flex justify-between items-center bg-[#fdfbf7] shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-serif text-[#6b705c] italic leading-tight">
              {sessionToEdit ? 'Seans Bilgilerini Düzenle' : 'Yeni Seans Kaydı'}
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Danışan seans detaylarını girin</p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f0] hover:bg-[#e5e5df] text-[#6b705c] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form with scrollable body and sticky bottom action bar */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 space-y-2.5 flex-1 overflow-y-auto overscroll-contain">
          {/* Closed / Locked Month Warning Banner */}
          {isEditingClosedMonthSession && (
            <div className="bg-emerald-50/95 border-2 border-emerald-300 text-emerald-950 rounded-2xl p-3 space-y-1 shadow-2xs animate-fade-in" id="closed-month-edit-banner">
              <div className="flex items-center gap-2 font-bold text-emerald-900 text-xs">
                <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Kapatılmış Muhasebe Dönemi ({formatMonthKey(closedMonthKey)})</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                Bu seansın tarihi, saati ve seans ücreti takvim kaymalarını önlemek için kilitlidir. <strong>Danışanın geçmiş dönem borcunu kapatabilmeniz için</strong> aşağıdan Ödeme Durumu, Tahsil Edilen Tutar, Ödeme Yöntemi ve Seans Notlarını serbestçe güncelleyebilirsiniz.
              </p>
            </div>
          )}

          {isCreatingInClosedMonth && (
            <div className="bg-amber-50/95 border-2 border-amber-300 text-amber-950 rounded-2xl p-3 space-y-1 shadow-2xs animate-fade-in" id="closed-month-lock-banner">
              <div className="flex items-center gap-2 font-bold text-amber-900 text-xs">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Kapatılmış & Kilitli Ay ({formatMonthKey(closedMonthKey)})</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                Seçilen tarih kapatılmış bir muhasebe dönemine aittir. Kapatılan aylara yeni seans eklenemez. Yeni seans eklemek için lütfen önce <strong>Ay Kapatma</strong> ekranından bu ayın kilidini açın.
              </p>
            </div>
          )}

          {/* Client Name (Inset Label inside Box) */}
          <div className={`relative rounded-xl border px-3 pt-1.5 pb-1.5 transition-colors focus-within:border-[#6b705c] focus-within:bg-white ${
            isSessionInClosedMonth 
              ? 'bg-slate-100 border-slate-200 cursor-not-allowed' 
              : 'bg-[#fdfbf7] border-[#e5e1d8]'
          }`}>
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <label className="text-[9px] font-bold text-[#6b705c] uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3 text-[#a5a58d] shrink-0" />
                <span>
                  {type === 'rent-income' 
                    ? 'ÖDEMEYİ YAPAN / TERAPİST' 
                    : type === 'non-session' 
                      ? 'ETKİNLİK / TOPLANTI BAŞLIĞI' 
                      : 'DANIŞAN ADI SOYADI'}
                </span>
              </label>
              {onOpenClientHistory && clientName.trim().length > 0 && type !== 'non-session' && (
                <button
                  type="button"
                  onClick={() => onOpenClientHistory(clientName)}
                  className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 hover:underline cursor-pointer bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/60"
                  title="Bu danışanın tüm seans geçmişini ve bakiyesini gör"
                >
                  <History className="w-2.5 h-2.5 text-emerald-600" />
                  <span>Seans Geçmişi</span>
                </button>
              )}
            </div>
            <input
              type="text"
              required
              disabled={isSessionInClosedMonth}
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className={`w-full bg-transparent text-sm sm:text-xs font-semibold focus:outline-none ${
                isSessionInClosedMonth ? 'text-slate-500 cursor-not-allowed' : 'text-slate-800 placeholder:text-slate-400 placeholder:font-normal'
              }`}
              placeholder={
                type === 'rent-income' 
                  ? "Örn. Psk. Ahmet Yılmaz" 
                  : type === 'non-session' 
                    ? "Örn. Ekip Toplantısı, Süpervizyon" 
                    : "Danışan adını yazın (Örn. Ahmet Yılmaz)"
              }
            />
          </div>

          {/* Session Type & Room Selector (Inset Labels) */}
          <div className={`grid grid-cols-1 ${(type === 'face-to-face' || type === 'rent-income') && rooms && rooms.length > 0 ? 'sm:grid-cols-2' : ''} gap-2.5`}>
            <div className={`relative rounded-xl border px-3 pt-1.5 pb-1 transition-colors focus-within:border-[#6b705c] ${
              isSessionInClosedMonth 
                ? 'bg-slate-100 border-slate-200 cursor-not-allowed' 
                : 'bg-[#fdfbf7] border-[#e5e1d8]'
            }`}>
              <label className="text-[9px] font-bold text-[#6b705c] uppercase tracking-wider block">ETKİNLİK TİPİ</label>
              <select
                value={type}
                disabled={isSessionInClosedMonth}
                onChange={(e) => handleTypeChange(e.target.value as SessionType)}
                className={`w-full bg-transparent text-xs font-semibold focus:outline-none py-0.5 ${
                  isSessionInClosedMonth ? 'text-slate-500 cursor-not-allowed' : 'text-slate-800 cursor-pointer'
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

            {(type === 'face-to-face' || type === 'rent-income') && rooms && rooms.length > 0 && (
              <div
                className={`relative rounded-xl border px-3 pt-1.5 pb-1 transition-colors focus-within:border-[#6b705c] ${
                  isSessionInClosedMonth 
                    ? 'bg-slate-100 border-slate-200 cursor-not-allowed' 
                    : 'bg-[#fdfbf7] border-[#e5e1d8]'
                }`}
                id="modal-room-selector"
              >
                <label className="text-[9px] font-bold text-[#6b705c] uppercase tracking-wider flex items-center gap-1">
                  <Building className="w-2.5 h-2.5 text-[#a5a58d]" />
                  <span>KLİNİK ODA SEÇİMİ</span>
                </label>
                <select
                  value={roomId}
                  disabled={isSessionInClosedMonth}
                  onChange={(e) => setRoomId(e.target.value)}
                  className={`w-full bg-transparent text-xs font-medium focus:outline-none py-0.5 ${
                    isSessionInClosedMonth ? 'text-slate-500 cursor-not-allowed' : 'text-slate-800 cursor-pointer'
                  }`}
                >
                  <option value="">-- Oda Atanmamış --</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      🛋️ {r.name} ({r.type === 'standard' ? 'Bireysel' : r.type === 'play-therapy' ? 'Oyun' : r.type === 'family-therapy' ? 'Aile & Çift' : r.type === 'group-therapy' ? 'Grup' : 'Diğer'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Session Time Conflict Detection Warning Banner */}
          {conflictingSessions.length > 0 && type !== 'cancelled' && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              className="bg-amber-50/90 border-2 border-amber-300 text-amber-950 rounded-2xl p-3 space-y-1.5 text-xs shadow-sm overflow-hidden"
              id="session-conflict-alert"
            >
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Çakışma Tespit Edildi</span>
              </div>
              <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                Seçilen saat diliminde ({time} - {minutesToTime(currentEnd)}) mevcut {conflictingSessions.length} seans ile zaman çakışması tespit edildi:
              </p>
              <div className="space-y-1 pt-0.5">
                {conflictingSessions.map(cs => {
                  const csStart = timeToMinutes(cs.time);
                  const csEnd = csStart + (cs.duration || 50);
                  const roomObj = rooms.find(r => r.id === cs.roomId);
                  return (
                    <div key={cs.id} className="bg-white/95 border border-amber-200/80 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[11px] shadow-3xs">
                      <div className="flex items-center gap-1.5 min-w-0">
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

          {/* Core Fields Grid: 2x2 on all screen sizes with Inset Labels */}
          <div className="grid grid-cols-2 gap-2.5 min-w-0 w-full max-w-full box-border">
            {/* Row 1, Col 1: Tarih */}
            <div className={`relative rounded-xl border px-3 pt-1.5 pb-1 min-w-0 w-full max-w-full box-border transition-colors focus-within:border-[#6b705c] ${
              isDateTimeLocked 
                ? 'bg-slate-100/80 border-slate-200 cursor-not-allowed' 
                : 'bg-[#fdfbf7] border-[#e5e1d8]'
            }`}>
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-bold text-[#6b705c] uppercase tracking-wider flex items-center gap-1 truncate">
                  <Calendar className="w-2.5 h-2.5 text-[#a5a58d] shrink-0" />
                  <span>TARİH</span>
                </label>
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
                      <Info className="w-3 h-3" />
                    </button>
                    {showDateNoticeTooltip && (
                      <div className="absolute left-0 bottom-full mb-1.5 z-50 w-60 p-2 bg-slate-900 text-white text-[10px] rounded-xl shadow-xl pointer-events-none leading-relaxed animate-fade-in">
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
              <input
                type="date"
                required
                disabled={isDateTimeLocked}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full max-w-full min-w-0 block box-border appearance-none bg-transparent py-0.5 text-xs font-semibold focus:outline-none [color-scheme:light] [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit-fields-wrapper]:p-0 [&::-webkit-date-and-time-value]:text-left [&::-webkit-date-and-time-value]:m-0 [&::-webkit-calendar-picker-indicator]:p-0 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer ${
                  isDateTimeLocked ? 'text-slate-400 cursor-not-allowed' : 'text-slate-800'
                }`}
              />
            </div>

            {/* Row 1, Col 2: Saat */}
            <div className={`relative rounded-xl border px-3 pt-1.5 pb-1 min-w-0 w-full max-w-full box-border transition-colors focus-within:border-[#6b705c] ${
              isDateTimeLocked 
                ? 'bg-slate-100/80 border-slate-200 cursor-not-allowed' 
                : 'bg-[#fdfbf7] border-[#e5e1d8]'
            }`}>
              <label className="text-[9px] font-bold text-[#6b705c] uppercase tracking-wider flex items-center gap-1 truncate">
                <Clock className="w-2.5 h-2.5 text-[#a5a58d] shrink-0" />
                <span>SAAT</span>
              </label>
              <input
                type="time"
                required
                disabled={isDateTimeLocked}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={`w-full max-w-full min-w-0 block box-border appearance-none bg-transparent py-0.5 text-xs font-semibold focus:outline-none [color-scheme:light] [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit-fields-wrapper]:p-0 [&::-webkit-date-and-time-value]:text-left [&::-webkit-date-and-time-value]:m-0 [&::-webkit-calendar-picker-indicator]:p-0 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer ${
                  isDateTimeLocked ? 'text-slate-400 cursor-not-allowed' : 'text-slate-800'
                }`}
              />
            </div>

            {/* Row 2, Col 1: Süre */}
            {type !== 'rent-income' && (
              <div className={`relative rounded-xl border px-3 pt-1.5 pb-1 min-w-0 w-full max-w-full box-border transition-colors focus-within:border-[#6b705c] ${
                isSessionInClosedMonth
                  ? 'bg-slate-100 border-slate-200 cursor-not-allowed'
                  : 'bg-[#fdfbf7] border-[#e5e1d8]'
              }`}>
                <label className="text-[9px] font-bold text-[#6b705c] uppercase tracking-wider block truncate">SÜRE</label>
                <select
                  value={duration}
                  disabled={isSessionInClosedMonth}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className={`w-full max-w-full min-w-0 box-border block bg-transparent py-0.5 text-xs font-semibold focus:outline-none ${
                    isSessionInClosedMonth ? 'text-slate-500 cursor-not-allowed' : 'text-slate-800 cursor-pointer'
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
            <div className={`min-w-0 w-full max-w-full box-border ${type === 'rent-income' ? 'col-span-2' : ''}`}>
              <div className={`relative rounded-xl border px-3 pt-1.5 pb-1 min-w-0 w-full max-w-full box-border transition-colors focus-within:border-[#6b705c] ${
                (isSessionInClosedMonth || type === 'cancelled' || type === 'non-session')
                  ? 'bg-slate-100 border-slate-200 cursor-not-allowed'
                  : 'bg-[#fdfbf7] border-[#e5e1d8]'
              }`}>
                <label className="text-[9px] font-bold text-[#6b705c] uppercase tracking-wider block truncate">
                  {type === 'rent-income' ? 'KİRA TUTARI (₺)' : 'SEANS ÜCRETİ (₺)'}
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-[#a5a58d] shrink-0">₺</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    pattern="[0-9]*"
                    required
                    min="0"
                    placeholder="0"
                    disabled={isSessionInClosedMonth || type === 'cancelled' || type === 'non-session'}
                    value={(type === 'cancelled' || type === 'non-session') ? 0 : (price === 0 ? '' : price)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPrice(val === '' ? '' : Number(val));
                      setIsPriceManuallyEdited(true);
                    }}
                    onFocus={(e) => e.target.select()}
                    className={`w-full max-w-full min-w-0 block box-border bg-transparent py-0.5 text-xs font-bold focus:outline-none ${
                      (isSessionInClosedMonth || type === 'cancelled' || type === 'non-session')
                        ? 'text-slate-400 cursor-not-allowed'
                        : 'text-slate-800'
                    }`}
                  />
                </div>
              </div>
              {isOpen && !sessionToEdit && enableSmartClientPriceMatching && clientName.trim() && type !== 'cancelled' && type !== 'rent-income' && (() => {
                const matchedCosts = getSmartClientCosts(clientName, date, sessions, defaultPrice, defaultBabysitterFee, defaultOfficeRentFee);
                if (matchedCosts.price !== defaultPrice && Number(price) === matchedCosts.price) {
                  return (
                    <p className="text-[9px] text-[#cb997e] font-sans font-bold flex items-center gap-1 mt-0.5 animate-fade-in" id="smart-price-badge">
                      <Sparkles className="w-2.5 h-2.5 text-[#cb997e]" />
                      Akıllı fiyat ({formatMoney(matchedCosts.price)})
                    </p>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          {/* Payment Status Selector */}
          {type !== 'cancelled' && type !== 'non-session' && (
            <div className="space-y-2.5 bg-[#fdfbf7] p-3 rounded-2xl border border-[#e5e1d8] animate-fade-in">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#6b705c] block">
                  Ücret tahsil edildi mi?
                </span>
                <div className="flex gap-1 bg-[#f5f5f0] p-1 rounded-xl border border-[#e5e1d8]/60">
                  <button
                    type="button"
                    disabled={isCreatingInClosedMonth}
                    onClick={() => {
                      setPaymentStatus('unpaid');
                      setPaidAmount('');
                      setPaymentMethod('');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all select-none ${
                      isCreatingInClosedMonth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
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
                    disabled={isCreatingInClosedMonth}
                    onClick={() => {
                      setPaymentStatus('partial');
                      if (!paidAmount && price) {
                        setPaidAmount('');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all select-none ${
                      isCreatingInClosedMonth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
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
                    disabled={isCreatingInClosedMonth}
                    onClick={() => {
                      setPaymentStatus('paid');
                      setPaidAmount(price);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all select-none ${
                      isCreatingInClosedMonth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
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
                <div className="pt-2 border-t border-[#e5e1d8]/70 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5 shrink-0">
                      <span>Alınan Tutar (₺):</span>
                    </label>
                    <div className="relative w-36">
                      <input
                        type="number"
                        inputMode="decimal"
                        pattern="[0-9]*"
                        min="0"
                        max={Number(price) || 0}
                        step="50"
                        disabled={isCreatingInClosedMonth}
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        placeholder="Örn: 1500"
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs font-bold text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs ${
                          isCreatingInClosedMonth
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

              {/* Payment Method Selector */}
              {(paymentStatus === 'paid' || paymentStatus === 'partial') && (
                <div className="pt-2 border-t border-[#e5e1d8]/70 space-y-1.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#6b705c] flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-[#6b705c]" />
                      Ödeme Yöntemi
                    </span>
                    {paymentMethod && !isCreatingInClosedMonth && (
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
                      disabled={isCreatingInClosedMonth}
                      onClick={() => setPaymentMethod(paymentMethod === 'card' ? '' : 'card')}
                      className={`px-2 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                        isCreatingInClosedMonth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
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
                      disabled={isCreatingInClosedMonth}
                      onClick={() => setPaymentMethod(paymentMethod === 'cash' ? '' : 'cash')}
                      className={`px-2 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                        isCreatingInClosedMonth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
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
                      disabled={isCreatingInClosedMonth}
                      onClick={() => setPaymentMethod(paymentMethod === 'transfer' ? '' : 'transfer')}
                      className={`px-2 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                        isCreatingInClosedMonth ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
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

          {/* Seans Giderleri */}
          {(type === 'online' || type === 'face-to-face') && (
            <div className="space-y-2.5">
              <div className={`grid grid-cols-1 ${type === 'face-to-face' ? 'sm:grid-cols-2' : ''} gap-2.5`}>
                {/* 1. Bakıcı Gideri */}
                <div className="bg-[#f5f5f0] p-2.5 rounded-xl border border-[#e5e1d8]/60 flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-700">Bakıcı Gideri?</span>
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
                    <div className="mt-1.5 flex flex-col gap-1 w-full animate-fade-in">
                      <div className="flex items-center bg-white border border-[#e5e1d8] rounded-lg px-2 py-1 focus-within:border-[#6b705c]">
                        <span className="text-[9px] font-bold text-slate-400 uppercase mr-1.5 shrink-0">TUTAR</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          pattern="[0-9]*"
                          min="0"
                          disabled={isSessionInClosedMonth}
                          value={babysitterFeeAmount === 0 ? '' : babysitterFeeAmount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBabysitterFeeAmount(val === '' ? '' : Number(val));
                            setIsBabysitterFeeManuallyEdited(true);
                          }}
                          onFocus={(e) => e.target.select()}
                          className={`w-full text-xs font-bold focus:outline-none bg-transparent ${
                            isSessionInClosedMonth ? 'text-slate-400 cursor-not-allowed' : 'text-slate-800'
                          }`}
                        />
                        <span className="text-[10px] font-bold text-slate-500 ml-1">₺</span>
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

                {/* 2. Ofis Kira Gideri */}
                {type === 'face-to-face' && (
                  <div className="bg-[#f5f5f0] p-2.5 rounded-xl border border-[#e5e1d8]/60 flex flex-col justify-between animate-fade-in">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-700">Ofis Kira Gideri?</span>
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
                      <div className="mt-1.5 flex flex-col gap-1 w-full animate-fade-in">
                        <div className="flex items-center bg-white border border-[#e5e1d8] rounded-lg px-2 py-1 focus-within:border-[#6b705c]">
                          <span className="text-[9px] font-bold text-slate-400 uppercase mr-1.5 shrink-0">TUTAR</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            pattern="[0-9]*"
                            min="0"
                            disabled={isSessionInClosedMonth}
                            value={officeRentFeeAmount === 0 ? '' : officeRentFeeAmount}
                            onChange={(e) => {
                              const val = e.target.value;
                              setOfficeRentFeeAmount(val === '' ? '' : Number(val));
                              setIsOfficeRentFeeManuallyEdited(true);
                            }}
                            onFocus={(e) => e.target.select()}
                            className={`w-full text-xs font-bold focus:outline-none bg-transparent ${
                              isSessionInClosedMonth ? 'text-slate-400 cursor-not-allowed' : 'text-slate-800'
                            }`}
                          />
                          <span className="text-[10px] font-bold text-slate-500 ml-1">₺</span>
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
                <div className="border border-[#e5e1d8] rounded-xl overflow-hidden bg-[#faf8f5] transition-all">
                  <button
                    type="button"
                    onClick={() => setIsAdvancedOptionsOpen(prev => !prev)}
                    className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-[#f3f0ea] transition-colors cursor-pointer select-none"
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
                        <div className="p-2.5 bg-[#fdfbf7]">
                          <div className="bg-[#f5f5f0] p-2.5 rounded-xl border border-[#e5e1d8]/60 flex flex-col justify-between">
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
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

                                <div className="flex items-center bg-white border border-[#e5e1d8] rounded-lg px-2 py-1">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase mr-2 shrink-0">KDV ORANI (%)</span>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    min="0"
                                    max="100"
                                    disabled={isSessionInClosedMonth}
                                    value={kdvRate === 0 ? '' : kdvRate}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setKdvRate(val === '' ? '' : Number(val));
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    className={`w-full text-xs font-bold focus:outline-none bg-transparent ${
                                      isSessionInClosedMonth ? 'text-slate-400 cursor-not-allowed' : 'text-slate-800'
                                    }`}
                                  />
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

          {/* Dedicated Calculation Summary Card */}
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
              <div className="bg-[#f5f5f2] border border-[#e5e1d8] rounded-2xl p-3 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-[#6b705c]" />
                    <span>HESAPLAMA ÖZETİ</span>
                  </div>
                  {totalDeductions > 0 && (
                    <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60 font-semibold">
                      Kesinti: -{formatMoney(totalDeductions)}
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>{hasKDV && !isKdvInclusive && type !== 'rent-income' ? 'Yalın Seans Ücreti:' : 'Brüt Seans Ücreti:'}</span>
                    <span className="font-semibold text-slate-800">{formatMoney(p)}</span>
                  </div>

                  {hasKDV && !isKdvInclusive && type !== 'rent-income' && (
                    <div className="flex justify-between items-center text-emerald-700 text-[10px] font-medium">
                      <span>+ KDV (%{r}):</span>
                      <span>+{formatMoney(kdvCut)}</span>
                    </div>
                  )}

                  {hasKDV && type !== 'rent-income' && (
                    <div className="flex justify-between items-center text-rose-600 text-[10px]">
                      <span>KDV Kesintisi (%{r} {isKdvInclusive ? 'Dahil' : 'Hariç'}):</span>
                      <span className="font-semibold">-{formatMoney(kdvCut)}</span>
                    </div>
                  )}

                  {hasBabysitterFee && baby > 0 && type !== 'rent-income' && (
                    <div className="flex justify-between items-center text-orange-700 text-[10px]">
                      <span>Bakıcı Gideri:</span>
                      <span className="font-semibold">-{formatMoney(baby)}</span>
                    </div>
                  )}

                  {type === 'face-to-face' && hasOfficeRentFee && office > 0 && (
                    <div className="flex justify-between items-center text-amber-800 text-[10px]">
                      <span>Ofis Kira Gideri:</span>
                      <span className="font-semibold">-{formatMoney(office)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-[#e0dcce] pt-2 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Net Ele Geçen Tutar</span>
                  </div>
                  <span className="text-base sm:text-lg font-extrabold text-emerald-700 tracking-tight">
                    {formatMoney(netEarnings)}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Notes (Inset Label inside Box) */}
          <div className={`relative rounded-xl border px-3 pt-1.5 pb-1.5 transition-colors focus-within:border-[#6b705c] focus-within:bg-white ${
            isCreatingInClosedMonth
              ? 'bg-slate-100 border-slate-200 cursor-not-allowed'
              : 'bg-[#fdfbf7] border-[#e5e1d8]'
          }`}>
            <label className="text-[9px] font-bold text-[#6b705c] uppercase tracking-wider flex items-center gap-1 mb-0.5">
              <FileText className="w-2.5 h-2.5 text-[#a5a58d]" />
              <span>{type === 'rent-income' ? 'KİRA GELİRİ NOTLARI (ÖZEL)' : 'SEANS NOTLARI (ÖZEL)'}</span>
            </label>
            <textarea
              value={notes}
              disabled={isCreatingInClosedMonth}
              onChange={(e) => setNotes(e.target.value)}
              rows={1}
              className={`w-full bg-transparent text-xs focus:outline-none resize-none ${
                isCreatingInClosedMonth
                  ? 'text-slate-500 cursor-not-allowed'
                  : 'text-slate-800 placeholder:text-slate-400'
              }`}
              placeholder={isCreatingInClosedMonth ? "Kapatılmış ay - yeni kayıt yapılamaz" : "Geçmiş terapi notları, ödeme planı veya oda bilgisi..."}
            />
          </div>
          </div>

          {/* Sticky Footer Actions (Always pinned above keyboard on mobile) */}
          <div className="px-4 sm:px-6 py-3 border-t border-[#e5e1d8] bg-[#fdfbf7]/95 backdrop-blur-md flex gap-2.5 justify-between items-center shrink-0 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
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
                className="px-3.5 py-2 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none touch-manipulation"
                title="Bu seansı cihazınızın takvimine kaydetmek için .ics dosyası indirin"
              >
                <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Takvime Ekle</span>
              </motion.button>
            ) : (
              <div />
            )}
            <div className="flex gap-2.5 items-center ml-auto">
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="px-4 py-2 rounded-full border border-[#e5e1d8] bg-white hover:bg-[#f5f5f0] text-xs font-semibold text-[#6b705c] transition-colors cursor-pointer select-none touch-manipulation"
              >
                Vazgeç
              </motion.button>
              <motion.button
                type="submit"
                disabled={isCreatingInClosedMonth}
                whileTap={isCreatingInClosedMonth ? {} : { scale: 0.95 }}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 select-none touch-manipulation ${
                  isCreatingInClosedMonth
                    ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                    : 'bg-[#6b705c] hover:bg-[#585c4c] text-white cursor-pointer shadow-xs'
                }`}
              >
                {isCreatingInClosedMonth ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Kilitli Ay</span>
                  </>
                ) : isEditingClosedMonthSession ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Tahsilatı Kaydet</span>
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
