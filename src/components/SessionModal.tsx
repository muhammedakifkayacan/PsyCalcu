import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, CalendarPlus, Clock, Wallet, FileText, User, Laptop, MapPin, Ban, Building, Sparkles, AlertTriangle, Percent, Receipt } from 'lucide-react';
import { Session, SessionType, Room, getSmartClientPrice, getNormalizedClientName, getSmartClientCosts } from '../types';
import { downloadSessionAsICS } from '../utils/icsGenerator';
import { usePrivacy } from '../context/PrivacyContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

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
  defaultBabysitterFee: number;
  defaultOfficeRentFee: number;
  selectedDate: string; // prefill date
  sessions: Session[];
  enableSmartClientPriceMatching?: boolean;
  userRole?: 'tenant' | 'owner';
  rooms?: Room[];
  prefilledRoomId?: string;
  prefilledTime?: string;
  enableKDV?: boolean;
  defaultKdvRate?: number;
  defaultIsKdvInclusive?: boolean;
}

export default function SessionModal({
  isOpen,
  onClose,
  sessionToEdit,
  onSave,
  defaultPrice,
  defaultBabysitterFee,
  defaultOfficeRentFee,
  selectedDate,
  sessions,
  enableSmartClientPriceMatching = false,
  userRole = 'tenant',
  rooms = [],
  prefilledRoomId = '',
  prefilledTime = '',
  enableKDV = false,
  defaultKdvRate = 20,
  defaultIsKdvInclusive = true
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
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [isPriceManuallyEdited, setIsPriceManuallyEdited] = useState(false);
  const [isBabysitterFeeManuallyEdited, setIsBabysitterFeeManuallyEdited] = useState(false);
  const [isOfficeRentFeeManuallyEdited, setIsOfficeRentFeeManuallyEdited] = useState(false);
  const [roomId, setRoomId] = useState('');

  // Determine if editing a past session (date is before today)
  const localTodayStr = (() => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  })();
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
  const isDateTimeLocked = sessionToEdit 
    ? (sessionToEdit.isSyncedFromCalendar || isOlderThan7Days(sessionToEdit.date)) 
    : false;

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
    if (isOpen && !sessionToEdit && enableSmartClientPriceMatching && clientName.trim() && type !== 'cancelled') {
      const matchedCosts = getSmartClientCosts(
        clientName,
        date,
        sessions,
        defaultPrice,
        defaultBabysitterFee,
        defaultOfficeRentFee
      );
      if (!isPriceManuallyEdited && matchedCosts.price !== defaultPrice) {
        setPrice(matchedCosts.price);
      }
      if (!isBabysitterFeeManuallyEdited && matchedCosts.babysitterFeeAmount !== defaultBabysitterFee) {
        setBabysitterFeeAmount(matchedCosts.babysitterFeeAmount);
      }
      if (!isOfficeRentFeeManuallyEdited && matchedCosts.officeRentFeeAmount !== defaultOfficeRentFee) {
        setOfficeRentFeeAmount(matchedCosts.officeRentFeeAmount);
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
    defaultBabysitterFee,
    defaultOfficeRentFee,
    type
  ]);

  useEffect(() => {
    if (isOpen) {
      setIsPriceManuallyEdited(false);
      setIsBabysitterFeeManuallyEdited(false);
      setIsOfficeRentFeeManuallyEdited(false);
      if (sessionToEdit) {
        setClientName(sessionToEdit.clientName);
        setType(sessionToEdit.type);
        setDate(sessionToEdit.date);
        setTime(sessionToEdit.time);
        setDuration(sessionToEdit.duration);
        setPrice(sessionToEdit.price);
        setHasBabysitterFee(sessionToEdit.hasBabysitterFee);
        setBabysitterFeeAmount(sessionToEdit.babysitterFeeAmount);
        setHasOfficeRentFee(sessionToEdit.hasOfficeRentFee ?? (sessionToEdit.type === 'face-to-face'));
        setOfficeRentFeeAmount(sessionToEdit.officeRentFeeAmount ?? defaultOfficeRentFee);
        setHasKDV(sessionToEdit.hasKDV ?? enableKDV);
        setIsKdvInclusive(sessionToEdit.isKdvInclusive ?? defaultIsKdvInclusive);
        setKdvRate(sessionToEdit.kdvRate ?? defaultKdvRate);
        setNotes(sessionToEdit.notes || '');
        setPaymentStatus(sessionToEdit.paymentStatus || 'unpaid');
        setRoomId(sessionToEdit.roomId || '');
      } else {
        // New session
        setClientName('');
        setType('online');
        setDate(selectedDate);
        setTime(prefilledTime || '10:00');
        setDuration(50);
        setPrice(defaultPrice);
        setHasBabysitterFee(true);
        setBabysitterFeeAmount(defaultBabysitterFee);
        setHasOfficeRentFee(false);
        setOfficeRentFeeAmount(defaultOfficeRentFee);
        setHasKDV(enableKDV);
        setIsKdvInclusive(defaultIsKdvInclusive);
        setKdvRate(defaultKdvRate);
        setNotes('');
        setPaymentStatus('unpaid');
        setRoomId(prefilledRoomId || '');
      }
    }
  }, [isOpen, sessionToEdit, selectedDate, defaultPrice, defaultBabysitterFee, defaultOfficeRentFee, prefilledRoomId, prefilledTime, enableKDV, defaultKdvRate, defaultIsKdvInclusive]);

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
      if (price === 0) {
        setPrice(defaultPrice);
      }
      setHasBabysitterFee(true);
      setHasOfficeRentFee(true);
      setHasKDV(enableKDV);
    } else { // online
      if (price === 0) {
        setPrice(defaultPrice);
      }
      setHasBabysitterFee(true);
      setHasOfficeRentFee(false);
      setHasKDV(enableKDV);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    const isNonSession = type === 'non-session';
    const isRentIncome = type === 'rent-income';
    const sessionPrice = isNonSession ? 0 : Number(price);
    const hasBaby = (isNonSession || isRentIncome) ? false : hasBabysitterFee;
    const babyAmt = (isNonSession || isRentIncome) ? 0 : (hasBaby ? Number(babysitterFeeAmount) : 0);
    const hasOffice = (isNonSession || isRentIncome) ? false : hasOfficeRentFee;
    const officeAmt = (isNonSession || isRentIncome) ? 0 : (hasOffice ? Number(officeRentFeeAmount) : 0);
    const hasTax = (isNonSession || isRentIncome) ? false : hasKDV;
    const taxRate = hasTax ? (Number(kdvRate) || 0) : 0;
    const taxAmt = hasTax 
      ? (isKdvInclusive 
          ? Math.round((sessionPrice * taxRate) / (100 + taxRate))
          : Math.round((sessionPrice * taxRate) / 100))
      : 0;

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
      paymentStatus: (type === 'cancelled' || type === 'non-session') ? 'unpaid' : paymentStatus,
      roomId: roomId || undefined,
    };

    onSave(sessionData);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overscroll-contain touch-none" id="session-modal-overlay" role="dialog" aria-modal="true">
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
          {/* Client Name */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] tracking-wider block">
              {type === 'rent-income' 
                ? 'ÖDEMEYİ YAPAN / TERAPİST' 
                : type === 'non-session' 
                  ? 'ETKİNLİK / TOPLANTI BAŞLIĞI' 
                  : 'DANIŞAN ADI SOYADI'}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-[#a5a58d]" />
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-base sm:text-sm bg-[#fdfbf7] border border-[#e5e1d8] rounded-2xl focus:outline-none focus:border-[#6b705c]"
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

          {/* Session Type Selector */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] tracking-wider block">ETKİNLİK TİPİ</label>
            <div className={`grid ${userRole === 'owner' ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'} gap-2`}>
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => handleTypeChange('online')}
                className={`py-2 px-2 sm:px-3 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer select-none touch-manipulation ${
                  type === 'online'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-100 font-bold'
                    : 'border-[#e5e1d8] hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                Online
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => handleTypeChange('face-to-face')}
                className={`py-2 px-2 sm:px-3 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer select-none touch-manipulation ${
                  type === 'face-to-face'
                    ? 'bg-amber-50 border-amber-300 text-amber-800 ring-2 ring-amber-100 font-bold'
                    : 'border-[#e5e1d8] hover:bg-slate-50 text-slate-600'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                Yüzyüze
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => handleTypeChange('cancelled')}
                className={`py-2 px-2 sm:px-3 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer select-none touch-manipulation ${
                  type === 'cancelled'
                    ? 'bg-red-50 border-red-200 text-red-800 ring-2 ring-red-50 font-bold'
                    : 'border-[#e5e1d8] hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                İptal
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() => handleTypeChange('non-session')}
                className={`py-2 px-1 sm:px-2 rounded-xl border text-[11px] sm:text-[11px] font-semibold flex items-center justify-center gap-1 sm:gap-1 transition-all cursor-pointer select-none touch-manipulation ${
                  type === 'non-session'
                    ? 'bg-slate-100 border-slate-300 text-slate-800 ring-2 ring-slate-200 font-bold'
                    : 'border-[#e5e1d8] hover:bg-slate-50 text-slate-600'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Seans Değil
              </motion.button>
              {userRole === 'owner' && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => handleTypeChange('rent-income')}
                  className={`py-2 px-2 sm:px-3 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer select-none touch-manipulation ${
                    type === 'rent-income'
                      ? 'bg-teal-50 border-teal-300 text-teal-800 ring-2 ring-teal-100 font-bold'
                      : 'border-[#e5e1d8] hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  Kira Geliri
                </motion.button>
              )}
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
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-base sm:text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-2xl focus:outline-none focus:border-[#6b705c] cursor-pointer h-[38px] font-medium"
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

          {/* Calendar synced or past session warning */}
          {(sessionToEdit?.isSyncedFromCalendar || isPastSession) && (
            <div className="text-[10px] sm:text-[11px] text-[#b58368] bg-[#fdfbf7] px-3 py-2 rounded-xl border border-[#cb997e]/30 flex items-start gap-1.5 animate-fade-in">
              <span className="mt-0.5">⚠️</span>
              {sessionToEdit?.isSyncedFromCalendar ? (
                <span>
                  <strong>Takvim Seansı:</strong> Tarih ve saat takviminizden otomatik eşitlenmiştir. Tarih veya saati değiştirmek için takvim uygulamanızı kullanın. Ücret, ödeme durumu ve notları buradan düzenleyebilirsiniz.
                </span>
              ) : isDateTimeLocked ? (
                <span>
                  <strong>Geçmiş Seans (7 Günden Eski):</strong> Muhasebeleştiği için tarih ve saat değiştirilemez. Ancak fiyat, ödeme durumu ve notları her zaman düzenleyebilirsiniz.
                </span>
              ) : (
                <span>
                  <strong>Geçmiş Seans (Son 1 Hafta):</strong> Tarih ve saat dahil tüm alanları düzenleyebilirsiniz.
                </span>
              )}
            </div>
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

          {/* Core Fields Grid: 2 rows x 2 columns (Date, Time, Duration, Price) */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* Row 1, Col 1: Tarih */}
            <div className="space-y-1">
              <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] tracking-wider block">TARİH</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#a5a58d]" />
                <input
                  type="date"
                  required
                  disabled={isDateTimeLocked}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full pl-8 pr-2 py-2 text-base sm:text-xs border rounded-xl focus:outline-none focus:border-[#6b705c] ${
                    isDateTimeLocked 
                      ? 'bg-slate-100/80 text-slate-400 border-slate-200 cursor-not-allowed font-medium' 
                      : 'bg-[#fdfbf7] border-[#e5e1d8]'
                  }`}
                />
              </div>
            </div>

            {/* Row 1, Col 2: Saat */}
            <div className="space-y-1">
              <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] tracking-wider block">SAAT</label>
              <div className="relative">
                <Clock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#a5a58d]" />
                <input
                  type="time"
                  required
                  disabled={isDateTimeLocked}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={`w-full pl-8 pr-2 py-2 text-base sm:text-xs border rounded-xl focus:outline-none focus:border-[#6b705c] ${
                    isDateTimeLocked 
                      ? 'bg-slate-100/80 text-slate-400 border-slate-200 cursor-not-allowed font-medium' 
                      : 'bg-[#fdfbf7] border-[#e5e1d8]'
                  }`}
                />
              </div>
            </div>

            {/* Row 2, Col 1: Süre */}
            {type !== 'rent-income' && (
              <div className="space-y-1">
                <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] tracking-wider block">SÜRE</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full px-2.5 py-2 text-base sm:text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] h-[34px]"
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
            <div className={`space-y-1 ${type === 'rent-income' ? 'col-span-2' : ''}`}>
              <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] tracking-wider block">
                {type === 'rent-income' ? 'KİRA TUTARI (₺)' : 'SEANS ÜCRETİ (₺)'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-[#a5a58d]">₺</span>
                <input
                  type="number"
                  required
                  min="0"
                  disabled={type === 'cancelled' || type === 'non-session'}
                  value={(type === 'cancelled' || type === 'non-session') ? 0 : (price === 0 ? '' : price)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPrice(val === '' ? '' : Number(val));
                    setIsPriceManuallyEdited(true);
                  }}
                  onFocus={(e) => e.target.select()}
                  className={`w-full pl-7 pr-2 py-1.5 text-base sm:text-xs border rounded-xl focus:outline-none focus:border-[#6b705c] ${
                    (type === 'cancelled' || type === 'non-session')
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed font-medium'
                      : 'bg-[#fdfbf7] border-[#e5e1d8]'
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
            <div className="space-y-1 bg-[#fdfbf7] p-3 rounded-xl border border-[#e5e1d8] flex items-center justify-between animate-fade-in">
              <div>
                <span className="text-xs font-bold text-[#6b705c] block">Ödeme Durumu</span>
                <span className="text-[10px] text-slate-600 font-medium">Ücret tahsil edildi mi?</span>
              </div>
              <div className="flex gap-1 bg-[#f5f5f0] p-0.5 rounded-lg border border-[#e5e1d8]/50">
                <button
                  type="button"
                  onClick={() => setPaymentStatus('unpaid')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    paymentStatus === 'unpaid'
                      ? 'bg-red-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Ödenmedi
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentStatus('paid')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    paymentStatus === 'paid'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Ödendi
                </button>
              </div>
            </div>
          )}

          {/* Expenses Settings (Sadece Online ve Yüz Yüze seanslarda gösterilir) */}
          {(type === 'online' || type === 'face-to-face') && (
            <div className="space-y-3 pt-1">
              <div className={`grid grid-cols-1 ${enableKDV ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
                {/* Babysitter Fee Switcher */}
                <div className="bg-[#f5f5f0] p-3 rounded-xl border border-[#e5e1d8]/60 flex flex-col justify-between min-h-[72px]">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-700">Bakıcı Gideri?</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasBabysitterFee}
                        onChange={(e) => setHasBabysitterFee(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#6b705c] peer-disabled:opacity-50"></div>
                    </label>
                  </div>

                  {hasBabysitterFee && (
                    <div className="mt-1 flex flex-col gap-1 w-full">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-500 shrink-0">Tutar:</span>
                        <input
                          type="number"
                          min="0"
                          value={babysitterFeeAmount === 0 ? '' : babysitterFeeAmount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBabysitterFeeAmount(val === '' ? '' : Number(val));
                            setIsBabysitterFeeManuallyEdited(true);
                          }}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-1.5 py-1 text-base sm:text-[10px] bg-white border border-[#e5e1d8] rounded focus:outline-none"
                        />
                        <span className="text-[9px] text-slate-500">₺</span>
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

                {/* Office Rent Fee Switcher */}
                <div className="bg-[#f5f5f0] p-3 rounded-xl border border-[#e5e1d8]/60 flex flex-col justify-between min-h-[72px]">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-700">Ofis Kira Gideri?</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasOfficeRentFee}
                        onChange={(e) => setHasOfficeRentFee(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#6b705c] peer-disabled:opacity-50"></div>
                    </label>
                  </div>

                  {hasOfficeRentFee && (
                    <div className="mt-1 flex flex-col gap-1 w-full">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-500 shrink-0">Tutar:</span>
                        <input
                          type="number"
                          min="0"
                          value={officeRentFeeAmount === 0 ? '' : officeRentFeeAmount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOfficeRentFeeAmount(val === '' ? '' : Number(val));
                            setIsOfficeRentFeeManuallyEdited(true);
                          }}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-1.5 py-1 text-base sm:text-[10px] bg-white border border-[#e5e1d8] rounded focus:outline-none"
                        />
                        <span className="text-[9px] text-slate-500">₺</span>
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

                {/* KDV Switcher (Görünür KDV ayarı açıksa veya seans verisinde varsa) */}
                {(enableKDV || sessionToEdit?.hasKDV) && (
                  <div className="bg-[#f5f5f0] p-3 rounded-xl border border-[#e5e1d8]/60 flex flex-col justify-between min-h-[72px]">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] sm:text-xs font-bold text-slate-700 flex items-center gap-1">
                        <Receipt className="w-3.5 h-3.5 text-[#6b705c]" />
                        KDV Kesintisi?
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasKDV}
                          onChange={(e) => setHasKDV(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#6b705c] peer-disabled:opacity-50"></div>
                      </label>
                    </div>

                    {hasKDV && (
                      <div className="mt-1.5 flex flex-col gap-1.5 w-full">
                        {/* KDV Type Selector Buttons */}
                        <div className="grid grid-cols-2 gap-1 bg-white p-0.5 rounded-lg border border-[#e5e1d8]">
                          <button
                            type="button"
                            onClick={() => setIsKdvInclusive(true)}
                            className={`py-1 px-1 text-[9px] font-bold rounded cursor-pointer transition-all ${
                              isKdvInclusive
                                ? 'bg-[#6b705c] text-white shadow-xs'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            KDV Dahil
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsKdvInclusive(false)}
                            className={`py-1 px-1 text-[9px] font-bold rounded cursor-pointer transition-all ${
                              !isKdvInclusive
                                ? 'bg-[#6b705c] text-white shadow-xs'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            KDV Hariç
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-slate-500 shrink-0">Oran:</span>
                          <div className="relative flex-1">
                            <span className="absolute left-1.5 top-1 text-[9px] font-bold text-slate-400">%</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={kdvRate === 0 ? '' : kdvRate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setKdvRate(val === '' ? '' : Number(val));
                              }}
                              onFocus={(e) => e.target.select()}
                              className="w-full pl-4 pr-1.5 py-1 text-base sm:text-[10px] bg-white border border-[#e5e1d8] rounded focus:outline-none"
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
                            <p className="text-[8px] text-rose-600 font-bold flex items-center gap-0.5">
                              {isKdvInclusive ? 'Fiyata dahil KDV:' : 'Fiyata eklenecek KDV:'} {formatMoney(kCut)}
                            </p>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Net Income Live Calculation Box */}
              {Number(price) > 0 && (() => {
                const p = Number(price);
                const r = Number(kdvRate) || 0;
                const kdvCut = hasKDV ? (isKdvInclusive ? Math.round((p * r) / (100 + r)) : Math.round((p * r) / 100)) : 0;
                const baby = hasBabysitterFee ? Number(babysitterFeeAmount) || 0 : 0;
                const office = hasOfficeRentFee ? Number(officeRentFeeAmount) || 0 : 0;

                const grossCollected = hasKDV && !isKdvInclusive ? (p + kdvCut) : p;
                const netEarnings = Math.max(0, grossCollected - kdvCut - baby - office);

                return (
                  <div className="bg-[#f8f7f2] p-2.5 rounded-xl border border-[#e5e1d8] text-xs space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span>{hasKDV && !isKdvInclusive ? 'Yalın Seans Ücreti (Matrah):' : 'Brüt Seans Ücreti:'}</span>
                      <span className="font-semibold text-slate-700">{formatMoney(p)}</span>
                    </div>

                    {hasKDV && !isKdvInclusive && (
                      <div className="flex justify-between items-center text-[10px] text-emerald-700 font-medium">
                        <span>+ KDV (%{r}):</span>
                        <span>+{formatMoney(kdvCut)}</span>
                      </div>
                    )}

                    {hasKDV && !isKdvInclusive && (
                      <div className="flex justify-between items-center text-[10px] text-slate-700 font-bold border-t border-dashed border-[#e5e1d8] pt-0.5">
                        <span>Müşteriden Alınan Toplam (Brüt):</span>
                        <span>{formatMoney(grossCollected)}</span>
                      </div>
                    )}

                    {hasKDV && (
                      <div className="flex justify-between items-center text-[10px] text-rose-600">
                        <span>KDV Kesintisi/Vergi (%{r} {isKdvInclusive ? 'Dahil' : 'Hariç'}):</span>
                        <span>-{formatMoney(kdvCut)}</span>
                      </div>
                    )}

                    {hasBabysitterFee && baby > 0 && (
                      <div className="flex justify-between items-center text-[10px] text-orange-600">
                        <span>Bakıcı Gideri:</span>
                        <span>-{formatMoney(baby)}</span>
                      </div>
                    )}

                    {hasOfficeRentFee && office > 0 && (
                      <div className="flex justify-between items-center text-[10px] text-amber-700">
                        <span>Ofis Kirası:</span>
                        <span>-{formatMoney(office)}</span>
                      </div>
                    )}

                    <div className="border-t border-[#e5e1d8] pt-1 flex justify-between items-center font-bold text-[#6b705c] text-xs">
                      <span>Net Ele Geçen Tutar:</span>
                      <span>{formatMoney(netEarnings)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] tracking-wider block">
              {type === 'rent-income' ? 'KİRA GELİRİ NOTLARI (ÖZEL)' : 'SEANS NOTLARI (ÖZEL)'}
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 w-4 h-4 text-[#a5a58d]" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={1}
                className="w-full pl-10 pr-4 py-2 text-base sm:text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-2xl focus:outline-none focus:border-[#6b705c] resize-none"
                placeholder="Geçmiş terapi notları, ödeme planı veya oda bilgisi..."
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
                whileTap={{ scale: 0.95 }}
                className="px-5 py-2 rounded-full bg-[#6b705c] hover:bg-[#585c4c] text-white text-xs font-semibold transition-colors cursor-pointer select-none touch-manipulation"
              >
                Kaydet
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
