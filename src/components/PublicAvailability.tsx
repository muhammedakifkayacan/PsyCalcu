import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Building, 
  MapPin, 
  Phone, 
  Mail, 
  CheckCircle, 
  Lock, 
  AlertCircle,
  RefreshCw,
  Home
} from 'lucide-react';
import { Room } from '../types';

interface PublicAvailabilityProps {
  userId: string;
}

interface PublicData {
  therapistName: string;
  rooms: Room[];
  blockedSlots: {
    id: string;
    roomId: string;
    date?: string;
    dayOfWeek?: number;
    time?: string;
    reason?: string;
  }[];
  sessions: {
    id: string;
    date: string;
    time: string;
    duration: number;
    roomId: string;
    type: string;
  }[];
}

export default function PublicAvailability({ userId }: PublicAvailabilityProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublicData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const hoursList = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', 
    '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
  ];

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        if (!userId || userId === 'undefined' || userId === 'null' || userId.trim() === '') {
          throw new Error('Geçersiz paylaşım linki veya klinik ID\'si.');
        }

        const res = await fetch(`/api/public-availability/${userId}`);
        
        // Safety check for Content-Type to avoid Parsing HTML as JSON (which causes the "Unexpected token '<'" error)
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          throw new Error('Sunucu müsaitlik bilgisi yerine bir web sayfası (HTML) döndürdü. Lütfen linki doğru kopyaladığınızdan ve klinisyenin paneline en az bir kere girdiğinden emin olun.');
        }

        if (!res.ok) {
          let errorMessage = 'Müsaitlik bilgileri yüklenirken sunucu hatası oluştu.';
          try {
            const errJson = await res.json();
            if (errJson && errJson.error) {
              errorMessage = errJson.error;
            }
          } catch (e) {
            if (res.status === 404) {
              errorMessage = 'Klinik veya terapist bulunamadı.';
            }
          }
          throw new Error(errorMessage);
        }

        const json = await res.json();
        setData(json);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [userId]);

  const handlePrevDay = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() - 1);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + 1);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center p-6 font-sans">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin text-[#6b705c] mx-auto" />
          <p className="text-sm font-serif italic text-slate-500">Klinik oda müsaitlik durumu sorgulanıyor...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-[2rem] border border-[#e5e1d8] shadow-sm p-8 text-center space-y-6">
          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto border border-rose-100">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold font-serif text-slate-800">Müsaitlik Bilgisi Alınamadı</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {error || 'Sorgulanan kliniğe ait geçerli bir kayıt bulunamadı veya paylaşım linki geçersiz.'}
            </p>
          </div>
          <button
            onClick={() => window.location.href = window.location.origin}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Home className="w-4 h-4" />
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  const { therapistName, rooms = [], blockedSlots = [], sessions = [] } = data;

  // Helpers for blockage and session checks
  const getCellStatus = (roomId: string, hourStr: string): { status: 'available' | 'busy' | 'blocked'; reason?: string } => {
    const targetHour = parseInt(hourStr.split(':')[0], 10);
    const dateObj = new Date(selectedDate);
    const dayOfWeekNum = dateObj.getDay(); // 0 (Sunday) to 6 (Saturday)

    // 1. Check for specific date blockage or day-of-week blockage
    const block = blockedSlots.find(b => {
      // Room match: either specific room or "all"
      const isRoomMatch = b.roomId === 'all' || b.roomId === roomId;
      if (!isRoomMatch) return false;

      // Time match: either specific time hour or entire day (no time specified)
      const isTimeMatch = !b.time || parseInt(b.time.split(':')[0], 10) === targetHour;
      if (!isTimeMatch) return false;

      // Date match OR DayOfWeek match
      if (b.date && b.date === selectedDate) return true;
      if (b.dayOfWeek !== undefined && b.dayOfWeek === dayOfWeekNum) return true;

      return false;
    });

    if (block) {
      return { status: 'blocked', reason: block.reason || 'Rezervasyona Kapalı' };
    }

    // 2. Check for active non-cancelled session
    const session = sessions.find(s => {
      if (s.date !== selectedDate || s.roomId !== roomId) return false;
      const sHour = parseInt(s.time.split(':')[0], 10);
      return sHour === targetHour && s.type !== 'cancelled';
    });

    if (session) {
      return { status: 'busy' };
    }

    return { status: 'available' };
  };

  const getRoomTypeLabel = (type: Room['type']) => {
    switch (type) {
      case 'standard': return 'Bireysel Terapi';
      case 'play-therapy': return 'Oyun Terapisi';
      case 'family-therapy': return 'Aile & Çift';
      case 'group-therapy': return 'Grup / Seminer';
      case 'other': return 'Çok Amaçlı';
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7] font-sans flex flex-col justify-between py-8 px-4 sm:px-6">
      <div className="max-w-5xl w-full mx-auto space-y-6">
        
        {/* Header Brand Banner */}
        <div className="bg-[#6b705c] p-6 sm:p-8 rounded-[2.5rem] text-white shadow-md relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
          
          <div className="space-y-2">
            <span className="text-[9px] bg-white/25 px-2.5 py-0.5 rounded-full font-bold tracking-wider uppercase">Çevrimiçi Müsaitlik</span>
            <h1 className="text-xl sm:text-2xl font-serif italic font-bold">
              {therapistName}
            </h1>
            <p className="text-xs opacity-90 leading-relaxed max-w-md">
              Klinik çalışma odalarının günlük doluluk durumunu aşağıdan izleyebilir ve müsait saatler için iletişime geçebilirsiniz.
            </p>
          </div>

          <div className="bg-white/10 border border-white/20 p-4 rounded-2xl text-xs space-y-2 shrink-0 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-[#ffe8d6]" />
              <span>Güvenli & KVKK Uyumlu Takvim</span>
            </div>
            <p className="text-[10px] text-white/75 max-w-[220px]">
              Tüm danışan detayları gizlidir; sadece doluluk bilgisi paylaşılmaktadır.
            </p>
          </div>
        </div>

        {/* Calendar Navigation and Interactive Timeline Grid */}
        <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-[#e5e1d8] shadow-xs space-y-6">
          
          {/* Top controller: Date selectors and Legend */}
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 pb-4 border-b border-slate-100">
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold tracking-widest text-[#a5a58d] uppercase">
                ODA REZERVASYON DURUMU
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-slate-500 font-medium">Seçili Tarih:</span>
                <span className="text-xs font-semibold text-[#6b705c] bg-[#6b705c]/10 px-2.5 py-0.5 rounded-lg">
                  {new Date(selectedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}
                </span>
              </div>
            </div>

            {/* Date selection controller */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center bg-slate-50 border border-[#e5e1d8] rounded-xl p-0.5 shadow-2xs">
                <button
                  onClick={handlePrevDay}
                  className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-all cursor-pointer"
                  title="Önceki Gün"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleToday}
                  className="px-3 py-1 text-xs font-bold rounded-lg hover:bg-white text-[#6b705c] transition-all cursor-pointer"
                >
                  Bugün
                </button>
                <button
                  onClick={handleNextDay}
                  className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-all cursor-pointer"
                  title="Sonraki Gün"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 border border-[#e5e1d8] rounded-xl px-3 py-1.5 shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-[#cb997e] shrink-0" />
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="text-xs bg-transparent border-none p-0 focus:outline-none focus:ring-0 text-slate-700 font-bold cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Color Legend for public users */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium bg-[#fdfbf7] p-3 rounded-xl border border-[#e5e1d8]/40">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Gösterge:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-lg bg-emerald-50 border border-emerald-200 inline-block shrink-0" />
              <span className="text-slate-600">Boş / Müsait</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-lg bg-slate-100 border border-slate-200 inline-block shrink-0" />
              <span className="text-slate-600">Dolu (Rezerve)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-lg bg-amber-50 border border-amber-200 inline-block shrink-0" />
              <span className="text-slate-600">Rezervasyona Kapalı</span>
            </div>
          </div>

          {/* Timeline Table Grid */}
          {rooms.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 font-medium">
              Bu kliniğe ait henüz hiçbir terapi odası tanımlanmamıştır.
            </div>
          ) : (
            <div className="overflow-x-auto [scrollbar-width:thin]">
              <div className="min-w-[900px] space-y-3 pb-2">
                
                {/* Time header row */}
                <div className="grid grid-cols-12 gap-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider items-center border-b border-slate-100 pb-1">
                  <div className="col-span-3 text-left pl-3 text-slate-500">Oda Adı & Tip</div>
                  <div className="col-span-9 grid grid-cols-12 gap-1.5">
                    {hoursList.map(h => (
                      <div key={h} className="py-1 bg-slate-50 rounded-lg flex flex-col justify-center items-center">
                        <Clock className="w-3 h-3 mb-0.5 text-slate-300" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rooms loop rows */}
                {rooms.map(room => (
                  <div key={room.id} className="grid grid-cols-12 gap-2 items-center p-1 hover:bg-slate-50/40 rounded-2xl transition-all">
                    
                    {/* Room Metadata */}
                    <div className="col-span-3 flex items-center gap-2 pl-1">
                      <div 
                        className="w-3 h-8 rounded-full shrink-0" 
                        style={{ backgroundColor: room.color || '#6b705c' }}
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-slate-800 block truncate">
                          {room.name}
                        </span>
                        <span className="inline-block text-[8px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">
                          {getRoomTypeLabel(room.type)}
                        </span>
                      </div>
                    </div>

                    {/* Timeline columns */}
                    <div className="col-span-9 grid grid-cols-12 gap-1.5">
                      {hoursList.map(hour => {
                        const cell = getCellStatus(room.id, hour);

                        if (cell.status === 'blocked') {
                          return (
                            <div
                              key={hour}
                              className="h-9 rounded-xl bg-amber-50/55 border border-amber-200/60 flex items-center justify-center text-amber-600 text-[10px] font-semibold select-none cursor-not-allowed group relative"
                              title={cell.reason}
                            >
                              <Lock className="w-3 h-3 text-amber-400" />
                              
                              {/* Hover Reason tooltip */}
                              <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-[9px] py-1 px-2.5 rounded shadow-lg z-20 whitespace-nowrap">
                                {cell.reason}
                              </div>
                            </div>
                          );
                        }

                        if (cell.status === 'busy') {
                          return (
                            <div
                              key={hour}
                              className="h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-[10px] font-medium select-none cursor-not-allowed"
                              title="Bu saat doludur"
                            >
                              Dolu
                            </div>
                          );
                        }

                        return (
                          <div
                            key={hour}
                            className="h-9 rounded-xl bg-emerald-50/45 border border-emerald-100 flex items-center justify-center text-emerald-700 text-[10px] font-bold select-none cursor-default"
                            title="Bu saat rezervasyon için uygundur"
                          >
                            Müsait
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Booking Request Call to Action */}
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-[#e5e1d8] shadow-xs text-center space-y-4">
          <div className="w-12 h-12 bg-[#6b705c]/10 rounded-2xl flex items-center justify-center text-[#6b705c] mx-auto">
            <Building className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base font-bold font-serif text-slate-800">Rezervasyon ve Seans Talebi</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Müsait odalar için seans oluşturmak, saatlik veya aylık oda kiralamak veya diğer detayları görüşmek için klinik iletişimiyle irtibata geçebilirsiniz.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-2 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-[#cb997e]" />
              <span>muhammedakifkayacan@gmail.com</span>
            </div>
            <div className="hidden sm:inline text-slate-300">|</div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#cb997e]" />
              <span>PsyCalcu Klinik Kampüsü</span>
            </div>
          </div>
        </div>

      </div>

      {/* Public Footer */}
      <div className="text-center text-[10px] text-slate-400 font-medium py-6">
        © 2026 PsyCalcu. Tüm Hakları Saklıdır. Güvenli Klinik Yönetim Ajandası.
      </div>
    </div>
  );
}
