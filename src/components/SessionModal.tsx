import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Wallet, FileText, User, Laptop, MapPin, Ban, Building } from 'lucide-react';
import { Session, SessionType } from '../types';

interface SessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToEdit?: Session | null;
  onSave: (session: Session) => void;
  defaultPrice: number;
  defaultBabysitterFee: number;
  defaultOfficeRentFee: number;
  selectedDate: string; // prefill date
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
}: SessionModalProps) {
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
  const [notes, setNotes] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');

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
  const isDateTimeLocked = sessionToEdit ? isOlderThan7Days(sessionToEdit.date) : false;

  useEffect(() => {
    if (isOpen) {
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
        setNotes(sessionToEdit.notes || '');
        setPaymentStatus(sessionToEdit.paymentStatus || 'unpaid');
      } else {
        // New session
        setClientName('');
        setType('online');
        setDate(selectedDate);
        setTime('10:00');
        setDuration(50);
        setPrice(defaultPrice);
        setHasBabysitterFee(true);
        setBabysitterFeeAmount(defaultBabysitterFee);
        setHasOfficeRentFee(false);
        setOfficeRentFeeAmount(defaultOfficeRentFee);
        setNotes('');
        setPaymentStatus('unpaid');
      }
    }
  }, [isOpen, sessionToEdit, selectedDate, defaultPrice, defaultBabysitterFee, defaultOfficeRentFee]);

  if (!isOpen) return null;

  const handleTypeChange = (newType: SessionType) => {
    setType(newType);
    if (newType === 'cancelled') {
      // Cancellation defaults to ₺0 unless they charge cancellation fee
      setPrice(0);
      setHasBabysitterFee(false);
      setHasOfficeRentFee(false);
    } else if (newType === 'face-to-face') {
      if (price === 0) {
        setPrice(defaultPrice);
      }
      setHasBabysitterFee(true);
      setHasOfficeRentFee(true);
    } else { // online
      if (price === 0) {
        setPrice(defaultPrice);
      }
      setHasBabysitterFee(true);
      setHasOfficeRentFee(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    const sessionData: Session = {
      id: sessionToEdit ? sessionToEdit.id : 'session_' + Math.random().toString(36).substr(2, 9),
      clientName: clientName.trim(),
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
      isSyncedFromCalendar: sessionToEdit ? sessionToEdit.isSyncedFromCalendar : false,
      syncedCalendarType: sessionToEdit ? sessionToEdit.syncedCalendarType : undefined,
      paymentStatus: type === 'cancelled' ? 'unpaid' : paymentStatus
    };

    onSave(sessionData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" id="session-modal-overlay">
      <div 
        className="w-full max-w-lg bg-white rounded-[2rem] border border-[#e5e1d8] overflow-hidden shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh]"
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
            <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] uppercase tracking-wider block">Danışan Adı Soyadı</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-[#a5a58d]" />
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-[#fdfbf7] border border-[#e5e1d8] rounded-2xl focus:outline-none focus:border-[#6b705c]"
                placeholder="Örn. Ahmet Yılmaz"
              />
            </div>
          </div>

          {/* Session Type Selector */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] uppercase tracking-wider block">Seans Tipi</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange('online')}
                className={`py-2 px-2 sm:px-3 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                  type === 'online'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-100'
                    : 'border-[#e5e1d8] hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                Online
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('face-to-face')}
                className={`py-2 px-2 sm:px-3 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                  type === 'face-to-face'
                    ? 'bg-amber-50 border-amber-300 text-amber-800 ring-2 ring-amber-100'
                    : 'border-[#e5e1d8] hover:bg-slate-50 text-slate-600'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                Yüzyüze
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('cancelled')}
                className={`py-2 px-2 sm:px-3 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                  type === 'cancelled'
                    ? 'bg-red-50 border-red-200 text-red-800 ring-2 ring-red-50'
                    : 'border-[#e5e1d8] hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                İptal
              </button>
            </div>
          </div>

          {/* Past session warning */}
          {isPastSession && (
            <div className="text-[10px] sm:text-[11px] text-[#b58368] bg-[#fdfbf7] px-3 py-2 rounded-xl border border-[#cb997e]/30 flex items-start gap-1.5 animate-fade-in">
              <span className="mt-0.5">⚠️</span>
              {isDateTimeLocked ? (
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

          {/* Core Fields Grid: 2 rows x 2 columns (Date, Time, Duration, Price) */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* Row 1, Col 1: Tarih */}
            <div className="space-y-1">
              <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] uppercase tracking-wider block">Tarih</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#a5a58d]" />
                <input
                  type="date"
                  required
                  disabled={isDateTimeLocked}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full pl-8 pr-2 py-2 text-xs border rounded-xl focus:outline-none focus:border-[#6b705c] ${
                    isDateTimeLocked 
                      ? 'bg-slate-100/80 text-slate-400 border-slate-200 cursor-not-allowed font-medium' 
                      : 'bg-[#fdfbf7] border-[#e5e1d8]'
                  }`}
                />
              </div>
            </div>

            {/* Row 1, Col 2: Saat */}
            <div className="space-y-1">
              <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] uppercase tracking-wider block">Saat</label>
              <div className="relative">
                <Clock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#a5a58d]" />
                <input
                  type="time"
                  required
                  disabled={isDateTimeLocked}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={`w-full pl-8 pr-2 py-2 text-xs border rounded-xl focus:outline-none focus:border-[#6b705c] ${
                    isDateTimeLocked 
                      ? 'bg-slate-100/80 text-slate-400 border-slate-200 cursor-not-allowed font-medium' 
                      : 'bg-[#fdfbf7] border-[#e5e1d8]'
                  }`}
                />
              </div>
            </div>

            {/* Row 2, Col 1: Süre */}
            <div className="space-y-1">
              <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] uppercase tracking-wider block">Süre</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-2.5 py-2 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] h-[34px]"
              >
                <option value="30">30 Dakika</option>
                <option value="45">45 Dakika</option>
                <option value="50">50 Dk (Standart)</option>
                <option value="60">60 Dakika</option>
                <option value="90">90 Dakika</option>
              </select>
            </div>

            {/* Row 2, Col 2: Seans Ücreti */}
            <div className="space-y-1">
              <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] uppercase tracking-wider block">Seans Ücreti (₺)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-[#a5a58d]">₺</span>
                <input
                  type="number"
                  required
                  min="0"
                  value={price === 0 ? '' : price}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPrice(val === '' ? '' : Number(val));
                  }}
                  onFocus={(e) => e.target.select()}
                  className="w-full pl-7 pr-2 py-1.5 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c]"
                />
              </div>
            </div>
          </div>

          {/* Payment Status Selector */}
          {type !== 'cancelled' && (
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

          {/* Expenses Settings */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Babysitter Fee Switcher */}
            <div className="bg-[#f5f5f0] p-3 rounded-xl border border-[#e5e1d8]/60 flex flex-col justify-between min-h-[72px]">
              <div className="flex justify-between items-center">
                <span className="text-[10px] sm:text-xs font-bold text-slate-700">Bakıcı?</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasBabysitterFee}
                    onChange={(e) => setHasBabysitterFee(e.target.checked)}
                    className="sr-only peer"
                    disabled={type === 'cancelled'}
                  />
                  <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#6b705c] peer-disabled:opacity-50"></div>
                </label>
              </div>

              {hasBabysitterFee && (
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-[9px] text-slate-500 shrink-0">Tutar:</span>
                  <input
                    type="number"
                    min="0"
                    value={babysitterFeeAmount === 0 ? '' : babysitterFeeAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBabysitterFeeAmount(val === '' ? '' : Number(val));
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-1.5 py-0.5 text-[10px] bg-white border border-[#e5e1d8] rounded focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-500">₺</span>
                </div>
              )}
            </div>

            {/* Office Rent Fee Switcher */}
            <div className="bg-[#f5f5f0] p-3 rounded-xl border border-[#e5e1d8]/60 flex flex-col justify-between min-h-[72px]">
              <div className="flex justify-between items-center">
                <span className="text-[10px] sm:text-xs font-bold text-slate-700">Ofis Kira?</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasOfficeRentFee}
                    onChange={(e) => setHasOfficeRentFee(e.target.checked)}
                    className="sr-only peer"
                    disabled={type === 'cancelled'}
                  />
                  <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#6b705c] peer-disabled:opacity-50"></div>
                </label>
              </div>

              {hasOfficeRentFee && (
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-[9px] text-slate-500 shrink-0">Tutar:</span>
                  <input
                    type="number"
                    min="0"
                    value={officeRentFeeAmount === 0 ? '' : officeRentFeeAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOfficeRentFeeAmount(val === '' ? '' : Number(val));
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-1.5 py-0.5 text-[10px] bg-white border border-[#e5e1d8] rounded focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-500">₺</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-xs font-bold text-[#555a4a] uppercase tracking-wider block">Seans Notları (Özel)</label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 w-4 h-4 text-[#a5a58d]" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={1}
                className="w-full pl-10 pr-4 py-2 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-2xl focus:outline-none focus:border-[#6b705c] resize-none"
                placeholder="Geçmiş terapi notları, ödeme planı veya oda bilgisi..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#f5f5f0] flex gap-3 justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[#e5e1d8] hover:bg-[#f5f5f0] text-xs font-semibold text-[#6b705c] transition-colors cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full bg-[#6b705c] hover:bg-[#585c4c] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
