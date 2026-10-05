import React, { useState } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  X, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  Check, 
  Laptop, 
  Building, 
  Ban,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Session } from '../types';
import { usePrivacy } from '../context/PrivacyContext';

interface TrashBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  deletedSessions: Session[];
  onRestoreSession: (session: Session) => void;
  onRestoreAll: () => void;
  onPermanentDelete: (sessionId: string) => void;
  onEmptyTrash: () => void;
}

export const TrashBinModal: React.FC<TrashBinModalProps> = ({
  isOpen,
  onClose,
  deletedSessions,
  onRestoreSession,
  onRestoreAll,
  onPermanentDelete,
  onEmptyTrash
}) => {
  const { formatMoney, formatClientName } = usePrivacy();
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  if (!isOpen) return null;

  const sortedDeleted = [...deletedSessions].sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));

  const getDaysLeft = (deletedAt?: number) => {
    if (!deletedAt) return 30;
    const diffMs = Date.now() - deletedAt;
    const daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - daysPassed);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overscroll-contain">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-3xs">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  Geri Dönüşüm Kutusu
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                    {deletedSessions.length} Seans
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Silinen seanslar 30 gün boyunca burada saklanır ve istediğiniz an geri yüklenebilir.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
              title="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Subheader Banner (Zero-bloat & TTL info) */}
          <div className="px-4 sm:px-5 py-2.5 bg-amber-50/70 border-b border-amber-100/70 text-[11px] sm:text-xs text-amber-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Veri tabanını şişirmemek için 30 günü dolduran seanslar sistem tarafından otomatik temizlenir.
            </span>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 bg-[#fdfbf7]/40">
            {sortedDeleted.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 text-emerald-500" />
                </div>
                <h4 className="text-sm font-bold text-slate-700">Çöp Kutusu Boş</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Silinmiş herhangi bir seans kaydı bulunmuyor. Tüm seanslarınız ajandanızda güvende.
                </p>
              </div>
            ) : (
              sortedDeleted.map((session) => {
                const daysLeft = getDaysLeft(session.deletedAt);
                const isPaid = session.paymentStatus === 'paid';

                return (
                  <div
                    key={session.id}
                    className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-3xs hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm truncate">
                          {formatClientName(session.clientName)}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          session.type === 'cancelled'
                            ? 'bg-slate-100 text-slate-500 border-slate-200 line-through'
                            : session.type === 'face-to-face'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-sky-50 text-sky-800 border-sky-200'
                        }`}>
                          {session.type === 'face-to-face' ? 'Yüz Yüze' : session.type === 'online' ? 'Online' : 'İptal'}
                        </span>
                        {isPaid && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5 stroke-[3]" /> Ödendi
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {session.date} {session.time}
                        </span>
                        <span>·</span>
                        <span className="font-semibold text-slate-700">
                          {formatMoney(session.price)}
                        </span>
                        <span>·</span>
                        <span className="text-[11px] text-rose-600 font-medium">
                          {daysLeft} gün sonra kalıcı silinir
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => onRestoreSession(session)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Seansı Ajandaya Geri Yükle"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Geri Yükle</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onPermanentDelete(session.id)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Kalıcı Olarak Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Actions */}
          {sortedDeleted.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                {confirmEmpty ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-rose-600 font-bold">Emin misiniz?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onEmptyTrash();
                        setConfirmEmpty(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors cursor-pointer"
                    >
                      Evet, Kalıcı Olarak Temizle
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmEmpty(false)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      Vazgeç
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmEmpty(true)}
                    className="text-xs text-slate-400 hover:text-rose-600 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Çöp Kutusunu Boşalt</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onRestoreAll}
                  className="px-4 py-2 rounded-xl bg-[#6b705c] hover:bg-[#585c4c] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Tümünü Geri Yükle ({sortedDeleted.length})</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
