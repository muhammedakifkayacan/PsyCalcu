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
  ChevronRight
} from 'lucide-react';
import { Room, Session, SessionType } from '../types';
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
                        const session = findSessionForRoomAndHour(room.id, hour);
                        
                        if (session) {
                          const isOnline = session.type === 'online';
                          const isFaceToFace = session.type === 'face-to-face';
                          const isCancelled = session.type === 'cancelled';
                          
                          return (
                            <button
                              key={hour}
                              onClick={() => onEditSession(session)}
                              className={`h-11 rounded-xl p-1.5 text-left border relative group transition-all transform hover:scale-[1.02] cursor-pointer flex flex-col justify-between overflow-hidden ${
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
    </div>
  );
}
