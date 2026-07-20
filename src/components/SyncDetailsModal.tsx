import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Video, MapPin, User, AlertCircle, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';

interface SyncedSessionInfo {
  id: string;
  clientName: string;
  date: string;
  time: string;
  type: 'online' | 'face-to-face' | 'cancelled';
}

interface SyncDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncDetails: {
    added: SyncedSessionInfo[];
    updated: SyncedSessionInfo[];
    deleted?: SyncedSessionInfo[];
  } | null;
}

export default function SyncDetailsModal({ isOpen, onClose, syncDetails }: SyncDetailsModalProps) {
  if (!syncDetails) return null;

  const totalChanges = syncDetails.added.length + syncDetails.updated.length + (syncDetails.deleted?.length || 0);

  // Helper to format date into Turkish format
  const formatTurkishDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];
        const months = [
          'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
          'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
        ];
        return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="bg-white rounded-[2rem] w-full max-w-xl max-h-[85vh] overflow-hidden border border-[#e5e1d8] shadow-2xl flex flex-col z-10"
            id="sync-details-modal-box"
          >
            {/* Header */}
            <div className="p-6 md:p-8 border-b border-[#e5e1d8] bg-[#fdfbf7] flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <h3 className="font-serif italic text-lg md:text-xl text-[#6b705c] font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5.5 h-5.5 text-[#cb997e]" />
                  Senkronizasyon Detayları
                </h3>
                <p className="text-xs text-slate-500">
                  Takviminizden aktarılan toplam <strong className="text-[#cb997e]">{totalChanges}</strong> seansın detayları aşağıdadır.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 text-xs md:text-sm">
              
              {/* ADDED SESSIONS SECTION */}
              {syncDetails.added.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100/60 flex items-center gap-1.5 w-fit">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Yeni Eklenen Seanslar ({syncDetails.added.length})
                  </h4>
                  <div className="grid grid-cols-1 gap-2.5">
                    {syncDetails.added.map((session, index) => (
                      <div 
                        key={`added-${session.id}-${index}`}
                        className="bg-[#fdfbf7] p-4 rounded-2xl border border-emerald-100 flex items-center justify-between gap-4 shadow-2xs hover:bg-[#f5f5f0]/30 transition-colors"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {session.clientName}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
                              session.type === 'online' 
                                ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                                : session.type === 'cancelled' 
                                  ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                                  : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {session.type === 'online' ? <Video className="w-2.5 h-2.5" /> : session.type === 'cancelled' ? <AlertCircle className="w-2.5 h-2.5" /> : <MapPin className="w-2.5 h-2.5" />}
                              {session.type === 'online' ? 'Online' : session.type === 'cancelled' ? 'İptal' : 'Yüz Yüze'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-[#6b705c]/60" />
                              {formatTurkishDate(session.date)}
                            </span>
                            <span className="font-semibold text-[#cb997e]">{session.time}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-lg">
                            + EKLENDİ
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* UPDATED SESSIONS SECTION */}
              {syncDetails.updated.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100/60 flex items-center gap-1.5 w-fit">
                    <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin-slow" />
                    Güncellenen Seanslar ({syncDetails.updated.length})
                  </h4>
                  <div className="grid grid-cols-1 gap-2.5">
                    {syncDetails.updated.map((session, index) => (
                      <div 
                        key={`updated-${session.id}-${index}`}
                        className="bg-[#fdfbf7] p-4 rounded-2xl border border-blue-100 flex items-center justify-between gap-4 shadow-2xs hover:bg-[#f5f5f0]/30 transition-colors"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {session.clientName}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
                              session.type === 'online' 
                                ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                                : session.type === 'cancelled' 
                                  ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                                  : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {session.type === 'online' ? <Video className="w-2.5 h-2.5" /> : session.type === 'cancelled' ? <AlertCircle className="w-2.5 h-2.5" /> : <MapPin className="w-2.5 h-2.5" />}
                              {session.type === 'online' ? 'Online' : session.type === 'cancelled' ? 'İptal' : 'Yüz Yüze'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-[#6b705c]/60" />
                              {formatTurkishDate(session.date)}
                            </span>
                            <span className="font-semibold text-[#cb997e]">{session.time}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" /> GÜNCELLENDİ
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DELETED SESSIONS SECTION */}
              {syncDetails.deleted && syncDetails.deleted.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100/60 flex items-center gap-1.5 w-fit">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                    Takvimden Silinen/Taşınan Seanslar ({syncDetails.deleted.length})
                  </h4>
                  <div className="grid grid-cols-1 gap-2.5">
                    {syncDetails.deleted.map((session, index) => (
                      <div 
                        key={`deleted-${session.id}-${index}`}
                        className="bg-[#fdfbf7] p-4 rounded-2xl border border-rose-100 flex items-center justify-between gap-4 shadow-2xs hover:bg-[#f5f5f0]/30 transition-colors"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm line-through decoration-slate-400 flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {session.clientName}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
                              session.type === 'online' 
                                ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                                : session.type === 'cancelled' 
                                  ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                                  : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {session.type === 'online' ? <Video className="w-2.5 h-2.5" /> : session.type === 'cancelled' ? <AlertCircle className="w-2.5 h-2.5" /> : <MapPin className="w-2.5 h-2.5" />}
                              {session.type === 'online' ? 'Online' : session.type === 'cancelled' ? 'İptal' : 'Yüz Yüze'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-[#6b705c]/60" />
                              {formatTurkishDate(session.date)}
                            </span>
                            <span className="font-semibold text-[#cb997e]">{session.time}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2.5 py-1 rounded-lg">
                            - SİLİNDİ
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[#e5e1d8] bg-[#fdfbf7] shrink-0 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="font-serif italic">PsyCalcu Takvim Entegrasyon Modülü</span>
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#6b705c] hover:bg-[#585c4c] text-white font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                Anlaşıldı, Kapat
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
