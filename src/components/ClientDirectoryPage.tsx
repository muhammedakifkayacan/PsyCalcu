import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  ArrowUpDown, 
  Calendar, 
  ChevronRight, 
  ArrowLeft,
  X,
  UserCheck,
  Laptop,
  MapPin,
  Clock
} from 'lucide-react';
import { Session, SessionType, getNormalizedClientName } from '../types';
import { usePrivacy } from '../context/PrivacyContext';

interface ClientDirectoryPageProps {
  sessions: Session[];
  onSelectClient: (clientName: string) => void;
  onBack: () => void;
}

type SortOrder = 'latest-desc' | 'latest-asc' | 'name-asc' | 'name-desc';

interface ClientItem {
  originalName: string;
  normalizedName: string;
  latestSessionDate: string;
  latestSessionTime: string;
  latestSessionType: SessionType;
  totalSessions: number;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return 'Tarih yok';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr;
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function getRelativeDateStr(dateStr: string): string {
  if (!dateStr) return '';
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (dateStr === todayStr) return 'Bugün';

  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return '';
  const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diffMs = todayDate.getTime() - targetDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return 'Dün';
  if (diffDays === -1) return 'Yarın';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} gün önce`;
  if (diffDays < -1 && diffDays > -7) return `${Math.abs(diffDays)} gün sonra`;
  if (diffDays >= 7 && diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} hafta önce`;
  }
  if (diffDays >= 30 && diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ay önce`;
  }
  if (diffDays >= 365) {
    const years = Math.floor(diffDays / 365);
    return `${years} yıl önce`;
  }
  if (diffDays < -7) {
    return 'Gelecek seans';
  }
  return '';
}

export const ClientDirectoryPage: React.FC<ClientDirectoryPageProps> = ({
  sessions,
  onSelectClient,
  onBack
}) => {
  const { formatClientName } = usePrivacy();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('latest-desc');

  // Extract unique clients and their latest session info
  const clientList = useMemo(() => {
    const map = new Map<string, ClientItem>();

    sessions.forEach(s => {
      if (s.isDeleted || s.type === 'non-session') return;
      const rawName = (s.clientName || '').trim();
      if (!rawName) return;

      const normName = getNormalizedClientName(rawName) || rawName.toLowerCase();
      const existing = map.get(normName);

      if (!existing) {
        map.set(normName, {
          originalName: rawName,
          normalizedName: normName,
          latestSessionDate: s.date || '',
          latestSessionTime: s.time || '',
          latestSessionType: s.type,
          totalSessions: 1
        });
      } else {
        existing.totalSessions += 1;
        const isLater = (s.date > existing.latestSessionDate) || 
          (s.date === existing.latestSessionDate && (s.time || '') > (existing.latestSessionTime || ''));
        if (isLater) {
          existing.latestSessionDate = s.date || '';
          existing.latestSessionTime = s.time || '';
          existing.latestSessionType = s.type;
          existing.originalName = rawName;
        }
      }
    });

    return Array.from(map.values());
  }, [sessions]);

  // Filtered and sorted clients
  const filteredAndSortedClients = useMemo(() => {
    let result = clientList;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(c => 
        c.originalName.toLowerCase().includes(q) ||
        c.normalizedName.toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      if (sortOrder === 'latest-desc') {
        if (!a.latestSessionDate && !b.latestSessionDate) return 0;
        if (!a.latestSessionDate) return 1;
        if (!b.latestSessionDate) return -1;
        if (b.latestSessionDate !== a.latestSessionDate) {
          return b.latestSessionDate.localeCompare(a.latestSessionDate);
        }
        return (b.latestSessionTime || '').localeCompare(a.latestSessionTime || '');
      }
      if (sortOrder === 'latest-asc') {
        if (!a.latestSessionDate && !b.latestSessionDate) return 0;
        if (!a.latestSessionDate) return 1;
        if (!b.latestSessionDate) return -1;
        if (a.latestSessionDate !== b.latestSessionDate) {
          return a.latestSessionDate.localeCompare(b.latestSessionDate);
        }
        return (a.latestSessionTime || '').localeCompare(b.latestSessionTime || '');
      }
      if (sortOrder === 'name-asc') {
        return a.originalName.localeCompare(b.originalName, 'tr');
      }
      if (sortOrder === 'name-desc') {
        return b.originalName.localeCompare(a.originalName, 'tr');
      }
      return 0;
    });
  }, [clientList, searchQuery, sortOrder]);

  const toggleDateSort = () => {
    if (sortOrder === 'latest-desc') {
      setSortOrder('latest-asc');
    } else {
      setSortOrder('latest-desc');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 animate-fade-in">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl border border-[#e5e1d8] p-5 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-[#fdfbf7] border border-[#e5e1d8] flex items-center justify-center text-slate-600 hover:text-[#6b705c] hover:border-[#6b705c]/50 transition-all cursor-pointer shadow-3xs shrink-0"
            title="Geri Dön"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-serif font-bold text-slate-800 flex items-center gap-2">
                Danışan Listesi
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#6b705c]/10 text-[#6b705c] border border-[#6b705c]/20">
                {clientList.length} Danışan
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Kayıtlı danışanlarınız ve son seans tarihleri. Profilini açmak için isme tıklayın.
            </p>
          </div>
        </div>

        {/* Quick Date Sort Toggle Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleDateSort}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow-3xs select-none ${
              sortOrder.startsWith('latest')
                ? 'bg-[#6b705c] text-white border-[#6b705c]'
                : 'bg-white text-slate-700 border-[#e5e1d8] hover:bg-slate-50'
            }`}
            title="Son seans tarihine göre sırala"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>
              {sortOrder === 'latest-desc' 
                ? 'Son Seans (Yeniden Eskiye)' 
                : sortOrder === 'latest-asc' 
                  ? 'Son Seans (Eskiden Yeniye)' 
                  : 'Tarihe Göre Sırala'}
            </span>
          </button>
        </div>
      </div>

      {/* Search & Sort Controls Bar */}
      <div className="bg-white rounded-2xl border border-[#e5e1d8] p-3 shadow-3xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Danışan adı ile arayın..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#6b705c] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort Dropdown & Quick Options */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-between sm:justify-end">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
            Sıralama:
          </span>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="text-xs font-semibold bg-[#fdfbf7] border border-[#e5e1d8] rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-[#6b705c] cursor-pointer w-full sm:w-auto"
          >
            <option value="latest-desc">Son Seans Tarihi (Yeniden Eskiye)</option>
            <option value="latest-asc">Son Seans Tarihi (Eskiden Yeniye)</option>
            <option value="name-asc">Danışan İsmi (A → Z)</option>
            <option value="name-desc">Danışan İsmi (Z → A)</option>
          </select>
        </div>
      </div>

      {/* Client List Rows Table / Card */}
      <div className="bg-white rounded-3xl border border-[#e5e1d8] overflow-hidden shadow-sm">
        {/* Table Header Bar */}
        <div className="bg-[#fdfbf7] px-5 py-3 border-b border-[#e5e1d8] flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-[#6b705c]" />
            <span>Danışan İsmi</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#6b705c]" />
            <span>Son Seans Tarihi</span>
          </div>
        </div>

        {/* Client Rows */}
        {filteredAndSortedClients.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">
                {searchQuery ? 'Aramayla eşleşen danışan bulunamadı' : 'Henüz kayıtlı danışanınız yok'}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchQuery 
                  ? `"${searchQuery}" ifadesine uygun bir danışan kaydı bulunmuyor.`
                  : 'Takvimlerinizi eşitleyerek veya yeni seanslar ekleyerek danışanlarınızı bu listede görebilirsiniz.'}
              </p>
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Aramayı Temizle
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#f5f5f0]">
            {filteredAndSortedClients.map((client, idx) => {
              const displayName = formatClientName(client.originalName);
              const displayDate = formatDisplayDate(client.latestSessionDate);
              const relativeDate = getRelativeDateStr(client.latestSessionDate);
              const initialLetter = (client.originalName.trim().charAt(0) || 'D').toUpperCase();

              return (
                <motion.div
                  key={client.normalizedName}
                  whileHover={{ backgroundColor: 'rgba(253, 251, 247, 0.8)' }}
                  whileTap={{ scale: 0.995 }}
                  onClick={() => onSelectClient(client.originalName)}
                  className="px-4 md:px-5 py-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors group select-none touch-manipulation"
                >
                  {/* Left: Client Avatar & Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-2xl bg-[#6b705c]/10 text-[#6b705c] font-serif font-bold text-sm flex items-center justify-center shrink-0 border border-[#6b705c]/15 group-hover:bg-[#6b705c] group-hover:text-white transition-colors">
                      {initialLetter}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 group-hover:text-[#6b705c] transition-colors truncate">
                        {displayName}
                      </p>
                    </div>
                  </div>

                  {/* Right: Last Session Date & Action Arrow */}
                  <div className="flex items-center gap-3 shrink-0 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-bold text-slate-700 group-hover:text-[#6b705c] transition-colors">
                        {displayDate}
                      </span>
                      {relativeDate && (
                        <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {relativeDate}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#6b705c] group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Footer info bar */}
        {filteredAndSortedClients.length > 0 && (
          <div className="bg-[#fdfbf7] px-5 py-2.5 border-t border-[#e5e1d8] flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>Toplam {filteredAndSortedClients.length} danışan gösteriliyor</span>
            <span className="italic">Detaylar için isme dokunun</span>
          </div>
        )}
      </div>
    </div>
  );
};
