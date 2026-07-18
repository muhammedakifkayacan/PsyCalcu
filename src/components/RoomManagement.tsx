import React, { useState } from 'react';
import { 
  Building, 
  Plus, 
  Trash2, 
  Sparkles, 
  Clock, 
  Calendar, 
  User, 
  Info,
  CheckCircle,
  Laptop,
  MapPin,
  FileText,
  X,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  Share2,
  Copy,
  ExternalLink
} from 'lucide-react';
import { Room, Session, SessionType, BlockedSlot } from '../types';
import { motion } from 'motion/react';

interface RoomManagementProps {
  rooms: Room[];
  onAddRoom: (room: Room) => void;
  onDeleteRoom: (id: string) => void;
  sessions: Session[];
  selectedDate: string;
  onDateChange?: (dateStr: string) => void;
  onAddSessionForRoomAndHour: (roomId: string, time: string) => void;
  onEditSession: (session: Session) => void;
  onDeleteSession?: (id: string) => void;
  blockedSlots?: BlockedSlot[];
  onUpdateBlockedSlots?: (slots: BlockedSlot[]) => void;
  userId?: string;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  showExplanations: boolean;
  onHideExplanations?: () => void;
}

export default function RoomManagement({
  rooms = [],
  onAddRoom,
  onDeleteRoom,
  sessions = [],
  selectedDate,
  onDateChange,
  onAddSessionForRoomAndHour,
  onEditSession,
  onDeleteSession,
  blockedSlots = [],
  onUpdateBlockedSlots,
  userId,
  showToast,
  showExplanations,
  onHideExplanations
}: RoomManagementProps) {
  // Helpers for date navigation
  const handlePrevDay = () => {
    if (!onDateChange) return;
    const current = new Date(selectedDate);
    current.setDate(current.getDate() - 1);
    const prevDateStr = current.toISOString().split('T')[0];
    onDateChange(prevDateStr);
  };

  const handleNextDay = () => {
    if (!onDateChange) return;
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + 1);
    const nextDateStr = current.toISOString().split('T')[0];
    onDateChange(nextDateStr);
  };

  const handleToday = () => {
    if (!onDateChange) return;
    const todayStr = new Date().toISOString().split('T')[0];
    onDateChange(todayStr);
  };
  // Local state for room creator form
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState<Room['type']>('standard');
  const [newRoomColor, setNewRoomColor] = useState('#6b705c');
  const [occupancyView, setOccupancyView] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Generate weekly days starting from selectedDate
  const getWeeklyDays = () => {
    const days = [];
    const baseDate = new Date(selectedDate);
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      days.push(d);
    }
    return days;
  };

  // Generate calendar grid for the selectedDate month (padded for grid alignment)
  const getMonthlyDays = () => {
    const baseDate = new Date(selectedDate);
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Turkish Monday start (0=Mon, 1=Tue, ..., 6=Sun)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;
    
    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  // Blocker form state
  const [blockType, setBlockType] = useState<'date' | 'weekly'>('date');
  const [blockRoomId, setBlockRoomId] = useState<string>('all');
  const [blockDate, setBlockDate] = useState<string>(selectedDate);
  const [blockDaysOfWeek, setBlockDaysOfWeek] = useState<number[]>([]); // JS getDay format (0=Sun, 1=Mon, etc)
  const [blockHours, setBlockHours] = useState<string[]>([]);
  const [blockReason, setBlockReason] = useState<string>('');

  const daysOfWeekList = [
    { value: 1, label: 'Pazartesi' },
    { value: 2, label: 'Salı' },
    { value: 3, label: 'Çarşamba' },
    { value: 4, label: 'Perşembe' },
    { value: 5, label: 'Cuma' },
    { value: 6, label: 'Cumartesi' },
    { value: 0, label: 'Pazar' }
  ];

  const handleAddBlockedSlots = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateBlockedSlots) return;

    if (blockType === 'weekly' && blockDaysOfWeek.length === 0) {
      showToast('Lütfen kapatılacak haftalık günlerden en az birini seçin!', 'error');
      return;
    }

    if (blockHours.length === 0) {
      showToast('Lütfen kapatılacak saatlerden en az birini seçin!', 'error');
      return;
    }

    const newSlots: BlockedSlot[] = [];
    const reasonText = blockReason.trim() || 'Rezervasyona Kapalı';

    if (blockType === 'date') {
      blockHours.forEach(hour => {
        newSlots.push({
          id: 'block_' + Math.random().toString(36).substr(2, 9),
          roomId: blockRoomId,
          date: blockDate,
          time: hour,
          reason: reasonText
        });
      });
    } else {
      blockDaysOfWeek.forEach(day => {
        blockHours.forEach(hour => {
          newSlots.push({
            id: 'block_' + Math.random().toString(36).substr(2, 9),
            roomId: blockRoomId,
            dayOfWeek: day,
            time: hour,
            reason: reasonText
          });
        });
      });
    }

    onUpdateBlockedSlots([...blockedSlots, ...newSlots]);
    setBlockHours([]);
    setBlockDaysOfWeek([]);
    setBlockReason('');
    showToast(`${newSlots.length} adet saat dilimi başarıyla rezervasyona kapatıldı.`, 'success');
  };

  // Timeline hours
  const hoursList = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', 
    '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
  ];

  // Room visual color presets
  const colorPresets = [
    { value: '#6b705c', label: 'Zeytin Yeşili' },
    { value: '#cb997e', label: 'Toprak Gül' },
    { value: '#a5a58d', label: 'Adaçayı' },
    { value: '#ddbea9', label: 'Kumsal' },
    { value: '#ffe8d6', label: 'Şeftali' },
    { value: '#3f51b5', label: 'İndigo' },
    { value: '#009688', label: 'Teal' },
    { value: '#ff9800', label: 'Kehribar' }
  ];

  // Handle adding room
  const handleSubmitRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      showToast('Oda adı boş bırakılamaz!', 'error');
      return;
    }

    const room: Room = {
      id: 'room_' + Math.random().toString(36).substr(2, 9),
      name: newRoomName.trim(),
      type: newRoomType,
      color: newRoomColor
    };

    onAddRoom(room);
    setNewRoomName('');
    showToast(`'${room.name}' başarıyla eklendi.`, 'success');
  };

  // Helper to determine if a session is booked in a room at a specific hour
  const findSessionForRoomAndHour = (roomId: string, hourStr: string): Session | undefined => {
    const targetHour = parseInt(hourStr.split(':')[0], 10);
    return sessions.find(s => {
      if (s.date !== selectedDate || s.roomId !== roomId) return false;
      const sHour = parseInt(s.time.split(':')[0], 10);
      return sHour === targetHour;
    });
  };

  // Helper to determine if a room is blocked at a specific hour on selectedDate
  const findBlockedSlotForRoomAndHour = (roomId: string, hourStr: string): BlockedSlot | undefined => {
    const targetHour = parseInt(hourStr.split(':')[0], 10);
    const dateObj = new Date(selectedDate);
    const dayOfWeekNum = dateObj.getDay(); // 0 (Sunday) to 6 (Saturday)
    
    return blockedSlots.find(b => {
      // Room match: either specific room or "all"
      const isRoomMatch = b.roomId === 'all' || b.roomId === roomId;
      if (!isRoomMatch) return false;

      // Time match: either specific hour (e.g., "09:00") or entire day (no time specified)
      const isTimeMatch = !b.time || parseInt(b.time.split(':')[0], 10) === targetHour;
      if (!isTimeMatch) return false;

      // Date match OR DayOfWeek match
      if (b.date && b.date === selectedDate) return true;
      if (b.dayOfWeek !== undefined && b.dayOfWeek === dayOfWeekNum) return true;

      return false;
    });
  };

  const handleUnblockSlot = (id: string) => {
    if (!onUpdateBlockedSlots) return;
    if (window.confirm('Bu saat/gün için konulan rezervasyon engelini kaldırmak istiyor musunuz?')) {
      const updated = blockedSlots.filter(b => b.id !== id);
      onUpdateBlockedSlots(updated);
      showToast('Rezervasyon engeli başarıyla kaldırıldı.', 'success');
    }
  };

  // Preset room creator helper
  const addPresetRoom = (name: string, type: Room['type'], color: string) => {
    const room: Room = {
      id: 'room_' + Math.random().toString(36).substr(2, 9),
      name,
      type,
      color
    };
    onAddRoom(room);
    showToast(`'${name}' odası başarıyla eklendi.`, 'success');
  };

  // Translate room type
  const getRoomTypeLabel = (type: Room['type']) => {
    switch (type) {
      case 'standard': return 'Standart Terapi';
      case 'play-therapy': return 'Oyun Terapisi';
      case 'family-therapy': return 'Aile & Çift';
      case 'group-therapy': return 'Grup / Seminer';
      case 'other': return 'Çok Amaçlı';
    }
  };

  return (
    <div className="space-y-6 font-sans text-slate-800" id="room-management-tab">
      {/* Overview Banner */}
      <div className="bg-[#6b705c] p-6 sm:p-8 rounded-[2.5rem] text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
        <div className="max-w-2xl">
          <span className="text-[10px] bg-white/20 px-3 py-1 rounded-full font-semibold tracking-wider uppercase">Mülk Yönetimi</span>
          <h2 className="text-2xl sm:text-3xl font-serif mt-3 italic">Oda Yönetimi & Günlük Doluluk Ekranı</h2>
          <p className="text-xs sm:text-sm opacity-90 mt-2 leading-relaxed">
            Kliniğinizdeki farklı terapi odalarını tanımlayabilir, oda müsaitliklerini günlük timeline üzerinden izleyebilir ve seansları odalara atayabilirsiniz. Odalarınızın doluluk analizini yaparak verimliliği artırın.
          </p>
        </div>
      </div>

      {/* Main Room Occupancy Screen (Oda Doluluk Ekranı) */}
      <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-[#e5e1d8] shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold tracking-widest text-[#a5a58d] uppercase flex items-center gap-1.5">
              ODA DOLULUK MATRİSİ & PLANLAYICI
              {!showExplanations && (
                <div className="relative group inline-block">
                  <HelpCircle className="w-3.5 h-3.5 text-[#a5a58d] hover:text-[#6b705c] cursor-help transition-colors normal-case" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-72 bg-slate-800 text-white text-xs p-3 rounded-xl shadow-xl z-50 leading-relaxed font-normal normal-case tracking-normal">
                    <p className="font-semibold text-[#ffe8d6] mb-1">💡 Oda Doluluk Rehberi:</p>
                    <p>• Tarih değiştiricileri kullanarak yarın, gelecek hafta veya gelecek ayın doluluk durumuna bakabilirsiniz.</p>
                    <p>• Doluluk matrisinde boş saatlere tıklayarak o saat ve odaya hızlı seans/rezervasyon ekleyebilirsiniz.</p>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800" />
                  </div>
                </div>
              )}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-500 font-medium">Seçili Tarih:</span>
              <span className="text-xs font-semibold text-[#6b705c] bg-[#6b705c]/10 px-2.5 py-0.5 rounded-lg">
                {new Date(selectedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}
              </span>
            </div>
            
            {/* View Mode Segment Controller */}
            <div className="flex bg-[#f5f5f0] p-1 rounded-xl border border-[#e5e1d8] shrink-0 w-max mt-1">
              <button
                type="button"
                onClick={() => setOccupancyView('daily')}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  occupancyView === 'daily'
                    ? 'bg-[#6b705c] text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Günlük Matris
              </button>
              <button
                type="button"
                onClick={() => setOccupancyView('weekly')}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  occupancyView === 'weekly'
                    ? 'bg-[#6b705c] text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Haftalık Özet
              </button>
              <button
                type="button"
                onClick={() => setOccupancyView('monthly')}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  occupancyView === 'monthly'
                    ? 'bg-[#6b705c] text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Aylık Görünüm
              </button>
            </div>
          </div>

          {/* Date Picker and Day Navigators */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-50 border border-[#e5e1d8] rounded-xl p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevDay}
                disabled={!onDateChange}
                className="p-1.5 rounded-lg hover:bg-white text-slate-600 disabled:opacity-40 transition-all cursor-pointer"
                title="Önceki Gün"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleToday}
                disabled={!onDateChange}
                className="px-3 py-1 text-xs font-bold rounded-lg hover:bg-white text-[#6b705c] disabled:opacity-40 transition-all cursor-pointer"
              >
                Bugün
              </button>
              <button
                type="button"
                onClick={handleNextDay}
                disabled={!onDateChange}
                className="p-1.5 rounded-lg hover:bg-white text-slate-600 disabled:opacity-40 transition-all cursor-pointer"
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
                onChange={(e) => onDateChange?.(e.target.value)}
                className="text-xs bg-transparent border-none p-0 focus:outline-none focus:ring-0 text-slate-700 font-bold cursor-pointer"
              />
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-[11px] bg-[#fdfbf7] border border-[#e5e1d8]/60 px-3 py-1.5 rounded-xl text-slate-600">
              <span className="relative flex h-1.5 w-1.5">
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 animate-pulse"></span>
              </span>
              <span className="font-semibold">Hızlı Rezervasyon</span>
            </div>
          </div>
        </div>

        {rooms.length === 0 ? (
          <div className="py-12 text-center space-y-4 border-2 border-dashed border-slate-200 rounded-3xl p-6 bg-[#fdfbf7]/50">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mx-auto border border-amber-100">
              <Building className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-700">Henüz Oda Tanımlanmadı</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Doluluk matrisini görüntülemek için aşağıdan hızlı odalar ekleyebilir veya kendiniz özel odalar tanımlayabilirsiniz.
              </p>
            </div>
            <div className="flex justify-center gap-2 flex-wrap pt-2">
              <button
                onClick={() => addPresetRoom('Aşkın Terapi Odası', 'standard', '#6b705c')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer border border-slate-200"
              >
                + Standart Oda Ekle
              </button>
              <button
                onClick={() => addPresetRoom('Kum & Oyun Terapi Odası', 'play-therapy', '#cb997e')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer border border-slate-200"
              >
                + Oyun Terapi Odası Ekle
              </button>
            </div>
          </div>
        ) : occupancyView === 'weekly' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
            {getWeeklyDays().map((day, idx) => {
              const dayStr = day.toISOString().split('T')[0];
              const isSelectedDay = dayStr === selectedDate;
              const daySessions = sessions.filter(s => s.date === dayStr);
              const occupiedCount = daySessions.length;
              
              return (
                <div 
                  key={idx}
                  onClick={() => {
                    if (onDateChange) onDateChange(dayStr);
                    setOccupancyView('daily');
                    showToast(`${day.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} tarihindeki seans detaylarına yönlendirildiniz.`, 'info');
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer hover:border-[#6b705c] hover:shadow-xs group flex flex-col justify-between h-40 ${
                    isSelectedDay 
                      ? 'bg-[#6b705c]/5 border-[#6b705c]' 
                      : 'bg-slate-50/50 border-slate-200/80 hover:bg-white'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold text-[#cb997e] uppercase tracking-wider">
                        {day.toLocaleDateString('tr-TR', { weekday: 'long' })}
                      </span>
                      {isSelectedDay && (
                        <span className="text-[8px] bg-[#6b705c] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          Seçili
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 mt-1">
                      {day.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                    </h4>
                    
                    <div className="flex flex-wrap gap-1 mt-3">
                      {rooms.map(room => {
                        const roomSessions = daySessions.filter(s => s.roomId === room.id);
                        if (roomSessions.length === 0) return null;
                        return (
                          <span 
                            key={room.id}
                            style={{ backgroundColor: `${room.color}15`, color: room.color, borderColor: `${room.color}40` }}
                            className="text-[9px] font-extrabold px-2 py-0.5 rounded-full border truncate max-w-[120px]"
                          >
                            {room.name}: {roomSessions.length} seans
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-auto text-[10px] text-slate-500">
                    <span className="font-semibold text-slate-700">{occupiedCount > 0 ? `Toplam ${occupiedCount} seans dolu` : 'Oda boş / müsait'}</span>
                    <span className="text-[#6b705c] group-hover:translate-x-1 transition-transform font-bold flex items-center gap-0.5">
                      Detay <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : occupancyView === 'monthly' ? (
          <div className="space-y-4 animate-fade-in">
            {/* Calendar Grid Headers */}
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
              <div>Pzt</div>
              <div>Sal</div>
              <div>Çar</div>
              <div>Per</div>
              <div>Cum</div>
              <div>Cmt</div>
              <div>Paz</div>
            </div>

            {/* Calendar Grid Cells */}
            <div className="grid grid-cols-7 gap-2">
              {getMonthlyDays().map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="h-20 bg-slate-50/20 rounded-xl" />;
                }

                const dayStr = day.toISOString().split('T')[0];
                const isSelectedDay = dayStr === selectedDate;
                const isToday = dayStr === new Date().toISOString().split('T')[0];
                const daySessions = sessions.filter(s => s.date === dayStr);
                const count = daySessions.length;

                let bgColor = 'bg-white hover:bg-slate-50 border-slate-200/60';
                if (count > 0) {
                  if (count <= 2) bgColor = 'bg-emerald-50/50 hover:bg-emerald-50/70 border-emerald-100';
                  else if (count <= 5) bgColor = 'bg-emerald-100/60 hover:bg-emerald-100/80 border-emerald-200';
                  else bgColor = 'bg-emerald-200/50 hover:bg-emerald-200/70 border-[#6b705c]/30';
                }
                if (isSelectedDay) {
                  bgColor = 'bg-[#6b705c]/10 hover:bg-[#6b705c]/15 border-[#6b705c]';
                }

                return (
                  <div
                    key={dayStr}
                    onClick={() => {
                      if (onDateChange) onDateChange(dayStr);
                      setOccupancyView('daily');
                      showToast(`${day.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} tarihine yönlendirildiniz.`, 'info');
                    }}
                    className={`h-20 p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group ${bgColor}`}
                  >
                    <div className="flex justify-between items-start">
                      <span className={`text-[10px] font-bold ${
                        isSelectedDay 
                          ? 'text-[#6b705c]' 
                          : isToday 
                            ? 'bg-[#cb997e] text-white px-1.5 py-0.5 rounded-md text-[9px]' 
                            : 'text-slate-600'
                      }`}>
                        {day.getDate()}
                      </span>
                      {count > 0 && (
                        <span className="text-[8px] font-bold text-emerald-800 bg-white/85 px-1 py-0.5 rounded-full border border-emerald-100">
                          {count}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 items-center max-h-6 overflow-hidden mt-1">
                      {rooms.map(room => {
                        const roomSessions = daySessions.filter(s => s.roomId === room.id);
                        if (roomSessions.length === 0) return null;
                        return (
                          <span 
                            key={room.id}
                            className="w-1.5 h-1.5 rounded-full block"
                            style={{ backgroundColor: room.color }}
                            title={`${room.name}: ${roomSessions.length} seans`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto [scrollbar-width:thin]">
            <div className="min-w-[900px] space-y-3 pb-2">
              {/* Timeline Header Row */}
              <div className="grid grid-cols-12 gap-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider items-center border-b border-slate-100 pb-1 shrink-0">
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

              {/* Room Grid Rows */}
              {rooms.map(room => {
                return (
                  <div key={room.id} className="grid grid-cols-12 gap-2 items-center hover:bg-slate-50/50 p-1.5 rounded-2xl transition-all">
                    {/* Room Metadata Card */}
                    <div className="col-span-3 flex items-center gap-2.5 min-w-0 pl-1">
                      <div 
                        className="w-3.5 h-10 rounded-full shrink-0" 
                        style={{ backgroundColor: room.color || '#6b705c' }}
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-slate-800 block truncate" title={room.name}>
                          {room.name}
                        </span>
                        <span className="inline-block px-1.5 py-0.5 rounded-md text-[8px] font-bold bg-[#f5f5f0] border border-slate-200 text-slate-500 mt-0.5 uppercase tracking-wider">
                          {getRoomTypeLabel(room.type)}
                        </span>
                      </div>
                    </div>

                    {/* Timeline Cell Boxes */}
                    <div className="col-span-9 grid grid-cols-12 gap-1.5">
                      {hoursList.map(hour => {
                        const blocked = findBlockedSlotForRoomAndHour(room.id, hour);
                        if (blocked) {
                          return (
                            <button
                              key={hour}
                              onClick={() => handleUnblockSlot(blocked.id)}
                              className="h-11 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 transition-all transform hover:scale-[1.02] flex flex-col justify-between p-1.5 cursor-pointer relative group overflow-hidden"
                              title={`${blocked.reason || 'Rezervasyona Kapalı'}. Engeli kaldırmak için tıklayın.`}
                            >
                              <div className="flex justify-between items-center w-full">
                                <span className="text-[10px] font-extrabold truncate max-w-[85%] uppercase text-amber-900">
                                  {blocked.reason || 'KAPALI'}
                                </span>
                                <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                              </div>
                              <span className="text-[8px] font-bold font-mono opacity-85 text-amber-700 block">
                                {hour} (Kilidi Aç)
                              </span>
                            </button>
                          );
                        }

                        const session = findSessionForRoomAndHour(room.id, hour);
                        
                        if (session) {
                          const isOnline = session.type === 'online';
                          const isFaceToFace = session.type === 'face-to-face';
                          const isCancelled = session.type === 'cancelled';
                          
                          return (
                            <div
                              key={hour}
                              className="relative group h-11"
                            >
                              <button
                                onClick={() => onEditSession(session)}
                                className={`h-full w-full rounded-xl p-1.5 text-left border relative transition-all transform hover:scale-[1.02] cursor-pointer flex flex-col justify-between overflow-hidden ${
                                  isCancelled 
                                    ? 'bg-red-50 border-red-200 text-red-900' 
                                    : isOnline 
                                      ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900' 
                                      : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                }`}
                              >
                                <div className="flex justify-between items-center w-full">
                                  <span className="text-[10px] font-extrabold truncate max-w-[85%] uppercase">
                                    {session.clientName}
                                  </span>
                                  {isOnline ? (
                                    <Laptop className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                                  ) : isFaceToFace ? (
                                    <MapPin className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                                  ) : (
                                    <span className="text-[8px] font-bold text-red-500">✗</span>
                                  )}
                                </div>
                                <span className="text-[8px] font-bold font-mono opacity-80 block">
                                  {session.time} ({session.duration}dk)
                                </span>
                              </button>

                              {onDeleteSession && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteSession(session.id);
                                  }}
                                  className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-md cursor-pointer border-none"
                                  title="Seansı Sil"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          );
                        }

                        // Empty cell: Book Room button trigger
                        return (
                          <button
                            key={hour}
                            onClick={() => onAddSessionForRoomAndHour(room.id, hour)}
                            className="h-11 rounded-xl border-2 border-dashed border-slate-200 bg-white hover:bg-slate-50 text-slate-300 hover:text-slate-600 transition-colors flex items-center justify-center cursor-pointer group"
                            title={`${hour} saatine bu oda için seans rezervasyonu yap`}
                          >
                            <Plus className="w-4 h-4 opacity-50 group-hover:scale-110 transition-transform" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {showExplanations && (
          <div className="relative mt-2 bg-[#fdfbf7] p-4 rounded-2xl border border-[#e5e1d8] flex gap-3 items-start text-xs animate-fade-in leading-relaxed text-slate-600 pr-12">
            <Info className="w-5 h-5 text-[#cb997e] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-700">💡 Oda Doluluk Ekranı Rehberi:</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li>Doluluk matrisi, seçtiğiniz gündeki odalarınızın anlık durumunu saat dilimleri halinde gösterir.</li>
                <li>Dolu olan saat kutucuklarına tıklayarak doğrudan o seansın detaylarına gidebilir ve ücretlendirmeyi düzenleyebilirsiniz.</li>
                <li>Boş hücrelerdeki <strong className="text-slate-800">(+) artı butonlarına</strong> tıklayarak o odaya ve o saate ait seansı anında oluşturabilirsiniz.</li>
              </ul>
            </div>
            {onHideExplanations && (
              <button
                onClick={onHideExplanations}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Açıklamayı Gizle"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Two Columns Section: Add Room Form and Rooms List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Room Creator Form */}
        <div className="lg:col-span-4 bg-white p-5 sm:p-6 rounded-[2rem] border border-[#e5e1d8] shadow-xs flex flex-col justify-between">
          <form onSubmit={handleSubmitRoom} className="space-y-4">
            <div className="space-y-1 pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold tracking-widest text-[#a5a58d] uppercase">YENİ ODA EKLE</h3>
              <p className="text-[10px] text-slate-500">Kliniğinize ait yeni bir fiziksel alan tanımlayın</p>
            </div>

            {/* Room Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#555a4a] tracking-wider uppercase block">Oda Tanımlayıcı Adı</label>
              <input
                type="text"
                required
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c]"
                placeholder="Örn. Oda 3 (Yetişkin & Çift)"
              />
            </div>

            {/* Room Type */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#555a4a] tracking-wider uppercase block">Oda Tipi / Konsepti</label>
              <select
                value={newRoomType}
                onChange={(e) => setNewRoomType(e.target.value as any)}
                className="w-full px-3.5 py-2 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] cursor-pointer"
              >
                <option value="standard">🛋️ Standart Bireysel Terapi</option>
                <option value="play-therapy">🧸 Çocuk Oyun Terapisi</option>
                <option value="family-therapy">👩‍❤️‍👨 Aile & Çift Terapisi</option>
                <option value="group-therapy">👥 Grup / Seminer Salonu</option>
                <option value="other">🔮 Çok Amaçlı Oda</option>
              </select>
            </div>

            {/* Color Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#555a4a] tracking-wider uppercase block">Görsel Renk Kodu</label>
              <div className="grid grid-cols-4 gap-2 bg-[#fdfbf7] p-2 border border-[#e5e1d8] rounded-xl">
                {colorPresets.map(preset => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setNewRoomColor(preset.value)}
                    className={`h-8 w-full rounded-lg transition-all relative cursor-pointer border ${
                      newRoomColor === preset.value 
                        ? 'border-slate-800 ring-2 ring-slate-400/30 scale-105 shadow-sm' 
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: preset.value }}
                    title={preset.label}
                  >
                    {newRoomColor === preset.value && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold font-mono">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#6b705c] hover:bg-[#585c4c] text-white text-xs font-semibold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Odayı Listeye Kaydet
            </button>
          </form>

          {/* Quick presets for owners */}
          <div className="mt-5 pt-4 border-t border-slate-100 space-y-2.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">HAZIR REHBER PRESETLERİ</span>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => addPresetRoom('Teras Çocuk Oyun Odası', 'play-therapy', '#cb997e')}
                className="w-full py-1.5 px-3 bg-[#fdfbf7] hover:bg-slate-50 border border-slate-200 rounded-xl text-left text-[11px] text-[#cb997e] font-semibold flex items-center justify-between cursor-pointer"
              >
                <span>🧸 Oyun Terapisi Odası Ekle</span>
                <span className="text-[10px] font-bold">+ Ekle</span>
              </button>
              <button
                onClick={() => addPresetRoom('Boğaziçi Çift Terapi Salonu', 'family-therapy', '#3f51b5')}
                className="w-full py-1.5 px-3 bg-[#fdfbf7] hover:bg-slate-50 border border-slate-200 rounded-xl text-left text-[11px] text-[#3f51b5] font-semibold flex items-center justify-between cursor-pointer"
              >
                <span>👩‍❤️‍👨 Aile & Çift Odası Ekle</span>
                <span className="text-[10px] font-bold">+ Ekle</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Rooms List & Quick Occupancy Stats */}
        <div className="lg:col-span-8 bg-white p-5 sm:p-6 rounded-[2rem] border border-[#e5e1d8] shadow-xs flex flex-col justify-between">
          <div className="space-y-4 w-full">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold tracking-widest text-[#a5a58d] uppercase">KAYITLI ODALAR ({rooms.length})</h3>
                <p className="text-[10px] text-slate-500">Kliniğinizde aktif olarak kiralanan odaların listesi</p>
              </div>
            </div>

            {rooms.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 font-medium bg-[#fdfbf7]/50 rounded-2xl border border-dashed border-slate-200 p-6">
                Kayıtlı terapi odası bulunmuyor. Sol panelden kliniğiniz için ilk odayı ekleyin.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto [scrollbar-width:thin] pr-1">
                {rooms.map(room => {
                  const todayRoomSessions = sessions.filter(s => s.date === selectedDate && s.roomId === room.id && s.type !== 'cancelled' && s.type !== 'non-session');
                  
                  return (
                    <div 
                      key={room.id}
                      className="p-4 bg-[#fdfbf7] border border-[#e5e1d8]/70 rounded-2xl flex justify-between items-start hover:shadow-xs transition-shadow group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-2.5 h-2.5 rounded-full inline-block" 
                            style={{ backgroundColor: room.color || '#6b705c' }}
                          />
                          <h4 className="text-xs font-bold text-slate-800 leading-tight">
                            {room.name}
                          </h4>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold bg-[#f5f5f0] border border-slate-200/50 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-wider block w-max">
                            {getRoomTypeLabel(room.type)}
                          </span>
                          <span className="text-[9px] text-slate-500 font-medium block">
                            📅 Bugün Doluluk: <strong className="text-[#6b705c]">{todayRoomSessions.length} seans</strong> booked
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (window.confirm(`'${room.name}' odasını silmek istediğinizden emin misiniz? Bu odaya atanmış seansların oda bağı kuralı kaldırılacaktır.`)) {
                            onDeleteRoom(room.id);
                            showToast(`'${room.name}' odası silindi.`, 'info');
                          }
                        }}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer shrink-0"
                        title="Odayı sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 bg-[#f5f5f0]/80 p-4 rounded-2xl border border-slate-100 flex items-center justify-between text-xs font-medium text-slate-700">
            <div className="flex items-center gap-2">
              <span className="text-sm">🔑</span>
              <span>
                Toplam <strong>{rooms.length}</strong> kayıtlı oda ile günde maksimum <strong>{rooms.length * hoursList.length}</strong> seans seans kapasitesi mevcuttur.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: Batch Blocking Panel & Public Link Sharing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
         {/* Link Sharing (Col 5) */}
         <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-[2rem] border border-[#e5e1d8] shadow-xs flex flex-col justify-between" id="share-link-card">
           <div className="space-y-4">
             <div className="space-y-1 pb-2 border-b border-slate-100">
               <h3 className="text-xs font-bold tracking-widest text-[#a5a58d] uppercase flex items-center gap-1.5">
                 <Share2 className="w-3.5 h-3.5" />
                 MÜSAİTLİK DURUMU PAYLAŞIM LİNKİ
               </h3>
               <p className="text-[10px] text-slate-500">Kliniğinizin doluluk takvimini güvenle dışarıya açın</p>
             </div>

             <p className="text-xs text-slate-600 leading-relaxed">
               Bu güvenli bağlantı sayesinde danışanlarınız veya kiracı terapistleriniz, oda doluluk durumlarını <strong>anlık ve gizli (KVKK uyumlu)</strong> olarak izleyebilir. Danışanların isimleri, seans notları veya ücretler kesinlikle paylaşılmaz.
             </p>

             <div className="space-y-2.5 pt-2">
               <div className="relative">
                 <input
                   type="text"
                   readOnly
                   value={
                     userId 
                       ? `${window.location.origin}${window.location.pathname}?share=${userId}`
                       : `${window.location.origin}${window.location.pathname}?share=demo_klinik`
                   }
                   className="w-full pl-3 pr-20 py-2.5 text-[11px] bg-slate-50 border border-[#e5e1d8] rounded-xl text-slate-600 font-mono focus:outline-none select-all"
                   id="share-link-input"
                 />
                 <button
                   type="button"
                   onClick={() => {
                     const url = userId 
                       ? `${window.location.origin}${window.location.pathname}?share=${userId}`
                       : `${window.location.origin}${window.location.pathname}?share=demo_klinik`;
                     navigator.clipboard.writeText(url);
                     showToast('Paylaşım linki panoya kopyalandı!', 'success');
                   }}
                   className="absolute right-1.5 top-1.5 px-2.5 py-1.5 bg-[#6b705c] hover:bg-[#585c4c] text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                   id="share-link-copy-btn"
                 >
                   <Copy className="w-3 h-3" />
                   Kopyala
                 </button>
               </div>

               {userId && (
                 <button
                   type="button"
                   onClick={() => {
                     const url = `${window.location.origin}${window.location.pathname}?share=${userId}`;
                     window.open(url, '_blank');
                   }}
                   className="w-full py-2 bg-[#fdfbf7] hover:bg-slate-50 border border-slate-200 text-[#6b705c] text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                   id="open-share-link-btn"
                 >
                   <ExternalLink className="w-3.5 h-3.5" />
                   Paylaşım Sayfasını Yeni Sekmede Aç
                 </button>
               )}
             </div>
           </div>

           <div className="mt-5 pt-4 border-t border-slate-100 flex items-start gap-2.5 text-[10px] text-slate-500 bg-[#fdfbf7] p-3 rounded-xl border border-[#e5e1d8]/50">
             <Info className="w-4 h-4 text-[#cb997e] shrink-0 mt-0.5" />
             <span>
               Giriş yapmamış misafir kullanıcılar sadece <strong>Müsait</strong>, <strong>Dolu</strong> ve <strong>Kapalı</strong> statülerini görebilir.
             </span>
           </div>
         </div>

         {/* Multi-block Settings (Col 7) */}
         <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-[2rem] border border-[#e5e1d8] shadow-xs" id="multi-block-card">
           <form onSubmit={handleAddBlockedSlots} className="space-y-4">
             <div className="space-y-1 pb-2 border-b border-slate-100">
               <h3 className="text-xs font-bold tracking-widest text-[#a5a58d] uppercase flex items-center gap-1.5">
                 <Lock className="w-3.5 h-3.5" />
                 ÇOKLU REZERVASYONA KAPATMA (ENGELLEME) PANELİ
               </h3>
               <p className="text-[10px] text-slate-500">Oda veya tüm günleri toplu olarak rezerve edilemez olarak işaretleyin</p>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {/* Room Selection */}
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-[#555a4a] tracking-wider uppercase block">Kapatılacak Oda</label>
                 <select
                   value={blockRoomId}
                   onChange={(e) => setBlockRoomId(e.target.value)}
                   className="w-full px-3 py-2 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] cursor-pointer"
                   id="block-room-select"
                 >
                   <option value="all">🏢 Tüm Odalar Birden</option>
                   {rooms.map(r => (
                     <option key={r.id} value={r.id}>🛋️ {r.name}</option>
                   ))}
                 </select>
               </div>

               {/* Block Type */}
               <div className="space-y-1">
                 <label className="text-[10px] font-bold text-[#555a4a] tracking-wider uppercase block">Kapatma Periyodu</label>
                 <div className="grid grid-cols-2 gap-2 bg-[#fdfbf7] p-1 border border-[#e5e1d8] rounded-xl">
                   <button
                     type="button"
                     onClick={() => { setBlockType('date'); setBlockDaysOfWeek([]); }}
                     className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                       blockType === 'date' 
                         ? 'bg-[#6b705c] text-white shadow-xs' 
                         : 'text-slate-600 hover:bg-slate-100'
                     }`}
                     id="block-type-date-btn"
                   >
                     Tekil Tarih
                   </button>
                   <button
                     type="button"
                     onClick={() => setBlockType('weekly')}
                     className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                       blockType === 'weekly' 
                         ? 'bg-[#6b705c] text-white shadow-xs' 
                         : 'text-slate-600 hover:bg-slate-100'
                     }`}
                     id="block-type-weekly-btn"
                   >
                     Haftalık Tekrar
                   </button>
                 </div>
               </div>
             </div>

             {blockType === 'date' ? (
               /* Date picker for single date block */
               <div className="space-y-1" id="block-date-group">
                 <label className="text-[10px] font-bold text-[#555a4a] tracking-wider uppercase block">Kapatılacak Tarih</label>
                 <div className="relative">
                   <input
                     type="date"
                     required
                     value={blockDate}
                     onChange={(e) => setBlockDate(e.target.value)}
                     className="w-full px-3 py-2 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c] cursor-pointer"
                     id="block-date-input"
                   />
                 </div>
               </div>
             ) : (
               /* Multi-select checkboxes for days of the week */
               <div className="space-y-1.5" id="block-weekly-group">
                 <label className="text-[10px] font-bold text-[#555a4a] tracking-wider uppercase block">Kapatılacak Haftalık Günler (Çoklu Seçin)</label>
                 <div className="flex flex-wrap gap-2 bg-[#fdfbf7] p-2 border border-[#e5e1d8] rounded-xl">
                   {daysOfWeekList.map(day => {
                     const isChecked = blockDaysOfWeek.includes(day.value);
                     return (
                       <button
                         key={day.value}
                         type="button"
                         onClick={() => {
                           setBlockDaysOfWeek(prev => 
                             isChecked 
                               ? prev.filter(v => v !== day.value) 
                               : [...prev, day.value]
                           );
                         }}
                         className={`px-3 py-1.5 text-[10px] font-semibold rounded-lg transition-all border cursor-pointer ${
                           isChecked
                             ? 'bg-[#cb997e]/15 border-[#cb997e] text-[#cb997e] font-bold'
                             : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                         }`}
                         id={`block-day-btn-${day.value}`}
                       >
                         {day.label}
                       </button>
                     );
                   })}
                 </div>
               </div>
             )}

             {/* Multi-select working hours checkboxes */}
             <div className="space-y-1.5" id="block-hours-group">
               <div className="flex justify-between items-center">
                 <label className="text-[10px] font-bold text-[#555a4a] tracking-wider uppercase block">Kapatılacak Saat Dilimleri (Çoklu Seçin)</label>
                 <div className="flex gap-2">
                   <button
                     type="button"
                     onClick={() => setBlockHours(hoursList)}
                     className="text-[9px] font-bold text-[#6b705c] hover:underline bg-none border-none cursor-pointer"
                     id="block-select-all-hours-btn"
                   >
                     Tümünü Seç
                   </button>
                   <span className="text-[9px] text-slate-300">|</span>
                   <button
                     type="button"
                     onClick={() => setBlockHours([])}
                     className="text-[9px] font-bold text-rose-600 hover:underline bg-none border-none cursor-pointer"
                     id="block-clear-all-hours-btn"
                   >
                     Temizle
                   </button>
                 </div>
               </div>
               <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 bg-[#fdfbf7] p-2.5 border border-[#e5e1d8] rounded-xl">
                 {hoursList.map(hour => {
                   const isChecked = blockHours.includes(hour);
                   return (
                     <button
                       key={hour}
                       type="button"
                       onClick={() => {
                         setBlockHours(prev => 
                           isChecked 
                             ? prev.filter(v => v !== hour) 
                             : [...prev, hour]
                         );
                       }}
                       className={`py-1 text-[10px] font-semibold rounded-lg transition-all border text-center cursor-pointer ${
                         isChecked
                           ? 'bg-[#6b705c]/10 border-[#6b705c] text-[#6b705c] font-bold'
                           : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                       }`}
                       id={`block-hour-btn-${hour.replace(':', '-')}`}
                     >
                       {hour}
                     </button>
                   );
                 })}
               </div>
             </div>

             {/* Block reason */}
             <div className="space-y-1" id="block-reason-group">
               <label className="text-[10px] font-bold text-[#555a4a] tracking-wider uppercase block">Kapatma Nedeni / Açıklama (Opsiyonel)</label>
               <input
                 type="text"
                 value={blockReason}
                 onChange={(e) => setBlockReason(e.target.value)}
                 className="w-full px-3.5 py-2 text-xs bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl focus:outline-none focus:border-[#6b705c]"
                 placeholder="Örn. Öğle Arası, Temizlik, Kişisel Kullanım"
                 id="block-reason-input"
               />
             </div>

             <button
               type="submit"
               className="w-full py-2.5 bg-[#6b705c] hover:bg-[#585c4c] text-white text-xs font-semibold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
               id="submit-block-btn"
             >
               <Lock className="w-4 h-4" />
               Seçilen Zamanları Rezervasyona Kapat ({blockHours.length} Saat)
             </button>
           </form>
         </div>
      </div>
    </div>
  );
}
