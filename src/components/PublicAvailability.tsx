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
  Lock, 
  AlertCircle,
  RefreshCw,
  Home,
  MessageCircle,
  Send,
  X,
  Sparkles,
  Check
} from 'lucide-react';
import { Room } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface PublicAvailabilityProps {
  userId: string;
}

interface PublicData {
  therapistName: string;
  therapistPhone?: string;
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
  // Load initial cached data from sessionStorage for instantaneous rendering
  const cacheKey = `psycalcu_pub_${userId}`;
  const cachedDataStr = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null;
  const initialCachedData: PublicData | null = cachedDataStr ? JSON.parse(cachedDataStr) : null;

  const [loading, setLoading] = useState(!initialCachedData);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PublicData | null>(initialCachedData);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Selected slot state for WhatsApp booking
  const [selectedSlot, setSelectedSlot] = useState<{
    roomId: string;
    roomName: string;
    hour: string;
    date: string;
  } | null>(null);

  const hoursList = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', 
    '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
  ];

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        if (!userId || userId === 'undefined' || userId === 'null' || userId.trim() === '') {
          throw new Error('Geçersiz paylaşım linki veya klinik ID\'si.');
        }

        // Demo klinik instant data
        if (userId === 'demo_klinik' || userId === 'demo') {
          const todayStr = new Date().toISOString().split('T')[0];
          const demoData: PublicData = {
            therapistName: 'PsyCalcu Örnek Klinik',
            therapistPhone: '05320000000',
            rooms: [
              { id: 'room_1', name: 'Oda 1 - Ege (Bireysel)', type: 'standard', color: '#6b705c' },
              { id: 'room_2', name: 'Oda 2 - Marmara (Oyun)', type: 'play-therapy', color: '#cb997e' },
              { id: 'room_3', name: 'Oda 3 - Akdeniz (Çift & Aile)', type: 'family-therapy', color: '#b5838d' }
            ],
            blockedSlots: [],
            sessions: [
              { id: 's1', date: todayStr, time: '10:00', duration: 50, roomId: 'room_1', type: 'busy' },
              { id: 's2', date: todayStr, time: '14:00', duration: 50, roomId: 'room_2', type: 'busy' },
              { id: 's3', date: todayStr, time: '16:00', duration: 50, roomId: 'room_3', type: 'busy' }
            ]
          };
          if (isMounted) {
            setData(demoData);
            setError(null);
            setLoading(false);
          }
          return;
        }

        // Fast parallel fetch: try Firestore client-side SDK & Express API route concurrently
        const fetchFromFirestore = async (): Promise<PublicData | null> => {
          try {
            const publicDocRef = doc(db, 'public_availability', userId);
            const docSnap = await getDoc(publicDocRef);
            if (docSnap.exists()) {
              const rawData = docSnap.data();
              return {
                therapistName: rawData.therapistName || 'Klinik',
                therapistPhone: rawData.therapistPhone || '',
                rooms: rawData.rooms || [],
                blockedSlots: rawData.blockedSlots || [],
                sessions: rawData.sessions || []
              };
            }
          } catch (e) {}
          return null;
        };

        const fetchFromApi = async (): Promise<PublicData | null> => {
          try {
            const res = await fetch(`/api/public-availability/${userId}`);
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const json = await res.json();
              if (res.ok && json) return json;
            }
          } catch (e) {}
          return null;
        };

        // Fire both fetches simultaneously for maximum speed
        const [fsData, apiData] = await Promise.all([
          fetchFromFirestore(),
          fetchFromApi()
        ]);

        const resolvedData = fsData || apiData;

        if (resolvedData) {
          if (isMounted) {
            setData(resolvedData);
            setError(null);
            sessionStorage.setItem(cacheKey, JSON.stringify(resolvedData));
          }
        } else {
          if (isMounted && !data) {
            throw new Error('Klinik veya oda müsaitlik takvimi henüz oluşturulmamış.');
          }
        }
      } catch (err: any) {
        if (isMounted && !data) {
          setError(err.message || 'Müsaitlik bilgileri yüklenemedi.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
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

  // Helper to build WhatsApp wa.me link
  const getWhatsAppLink = (slot?: { roomName: string; hour: string; date: string } | null) => {
    const rawPhone = data?.therapistPhone || '';
    let phoneNum = rawPhone.replace(/\D/g, '');
    if (phoneNum.startsWith('0')) {
      phoneNum = '90' + phoneNum.substring(1);
    } else if (phoneNum.length === 10) {
      phoneNum = '90' + phoneNum;
    }

    const therapistName = data?.therapistName || 'Klinik Yöneticisi';
    const dateFormatted = slot ? new Date(slot.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }) : '';
    
    let messageText = '';
    if (slot) {
      messageText = `Merhaba ${therapistName}, PsyCalcu Müsaitlik Takviminiz üzerinden ${dateFormatted} tarihi, saat ${slot.hour} için ${slot.roomName} odasını kiralama / rezervasyon talebinde bulunmak istiyorum. Müsaitliği teyit edebilir misiniz?`;
    } else {
      messageText = `Merhaba ${therapistName}, PsyCalcu Oda Müsaitlik Takvimi üzerinden oda kiralama ve seans rezervasyonu hakkında bilgi almak istiyorum.`;
    }

    const encodedText = encodeURIComponent(messageText);

    if (phoneNum) {
      return `https://wa.me/${phoneNum}?text=${encodedText}`;
    }
    return `https://wa.me/?text=${encodedText}`;
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

  const { therapistName, therapistPhone, rooms = [], blockedSlots = [], sessions = [] } = data;

  // Helpers for blockage and session checks
  const getCellStatus = (roomId: string, hourStr: string): { status: 'available' | 'busy' | 'blocked'; reason?: string } => {
    const targetHour = parseInt(hourStr.split(':')[0], 10);
    const dateObj = new Date(selectedDate);
    const dayOfWeekNum = dateObj.getDay();

    const block = blockedSlots.find(b => {
      const isRoomMatch = b.roomId === 'all' || b.roomId === roomId;
      if (!isRoomMatch) return false;

      const isTimeMatch = !b.time || parseInt(b.time.split(':')[0], 10) === targetHour;
      if (!isTimeMatch) return false;

      if (b.date && b.date === selectedDate) return true;
      if (b.dayOfWeek !== undefined && b.dayOfWeek === dayOfWeekNum) return true;

      return false;
    });

    if (block) {
      return { status: 'blocked', reason: block.reason || 'Rezervasyona Kapalı' };
    }

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

  const selectedDateFormatted = new Date(selectedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });

  return (
    <div className="min-h-screen bg-[#fdfbf7] font-sans flex flex-col justify-between py-8 px-4 sm:px-6 relative pb-28">
      <div className="max-w-5xl w-full mx-auto space-y-6">
        
        {/* Header Brand Banner */}
        <div className="bg-[#6b705c] p-6 sm:p-8 rounded-[2.5rem] text-white shadow-md relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
          
          <div className="space-y-2">
            <span className="text-[9px] bg-white/25 px-2.5 py-0.5 rounded-full font-bold tracking-wider uppercase">Çevrimiçi Müsaitlik Takvimi</span>
            <h1 className="text-xl sm:text-2xl font-serif italic font-bold">
              {therapistName}
            </h1>
            <p className="text-xs opacity-90 leading-relaxed max-w-md">
              Klinik çalışma odalarının günlük doluluk durumunu aşağıdan inceleyebilir ve müsait saatler için tek tıkla WhatsApp üzerinden iletişime geçebilirsiniz.
            </p>
          </div>

          {/* Direct WhatsApp Call to Action Header Button */}
          <a
            href={getWhatsAppLink(null)}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 shrink-0 border border-emerald-400 cursor-pointer active:scale-95"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            <span>WhatsApp ile İletişim</span>
          </a>
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
                  {selectedDateFormatted}
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
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedSlot(null);
                  }}
                  className="text-xs bg-transparent border-none p-0 focus:outline-none focus:ring-0 text-slate-700 font-bold cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Color Legend & WhatsApp hint */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium bg-[#fdfbf7] p-3 rounded-xl border border-[#e5e1d8]/40">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Gösterge:</span>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-lg bg-emerald-100 border border-emerald-300 inline-block shrink-0" />
                <span className="text-slate-700 font-bold">Müsait (Seç ve Kirala)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-lg bg-slate-100 border border-slate-200 inline-block shrink-0" />
                <span className="text-slate-500">Dolu (Rezerve)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-lg bg-amber-50 border border-amber-200 inline-block shrink-0" />
                <span className="text-slate-500">Kapalı</span>
              </div>
            </div>

            <p className="text-[11px] text-emerald-800 font-semibold italic flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Müsait saate tıklayarak WhatsApp mesaj şablonunu oluşturabilirsiniz.
            </p>
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

                        const isSelected = selectedSlot?.roomId === room.id && selectedSlot?.hour === hour;

                        return (
                          <button
                            key={hour}
                            type="button"
                            onClick={() => setSelectedSlot({
                              roomId: room.id,
                              roomName: room.name,
                              hour,
                              date: selectedDate
                            })}
                            className={`h-9 rounded-xl border flex items-center justify-center text-[10px] font-bold transition-all cursor-pointer active:scale-95 ${
                              isSelected 
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400 scale-105 z-10' 
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 hover:border-emerald-300'
                            }`}
                            title={`${room.name} - ${hour} için rezervasyon yap`}
                          >
                            {isSelected ? <Check className="w-3.5 h-3.5" /> : 'Müsait'}
                          </button>
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
            <h3 className="text-base font-bold font-serif text-slate-800">Rezervasyon ve Oda Kiralama Talebi</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Müsait odalar için seans oluşturmak, saatlik veya günlük oda kiralamak için direkt WhatsApp üzerinden klinik yöneticisine mesaj gönderebilirsiniz.
            </p>
          </div>
          
          <div className="pt-2 flex justify-center">
            <a
              href={getWhatsAppLink(selectedSlot)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl shadow-md transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>WhatsApp ile Genel Müsaitlik Sor / Mesaj Gönder</span>
            </a>
          </div>
        </div>

      </div>

      {/* Floating Sticky Bottom Bar when a specific available slot is selected */}
      {selectedSlot && (
        <div className="fixed bottom-4 left-4 right-4 max-w-xl mx-auto z-50 animate-bounce-in">
          <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-3xl shadow-2xl border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Seçili Müsait Saat</span>
              </div>
              <p className="text-sm font-bold truncate text-white">
                {selectedSlot.roomName} — {selectedSlot.hour}
              </p>
              <p className="text-[10px] text-slate-400">
                {new Date(selectedSlot.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <a
                href={getWhatsAppLink(selectedSlot)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>WhatsApp ile Kirala</span>
              </a>

              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-2xl transition-all cursor-pointer"
                title="Seçimi İptal Et"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Public Footer */}
      <div className="text-center text-[10px] text-slate-400 font-medium py-6">
        © 2026 PsyCalcu. Tüm Hakları Saklıdır. Güvenli Klinik Yönetim Ajandası.
      </div>
    </div>
  );
}
