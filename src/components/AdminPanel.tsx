import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  setDoc,
  getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Users, 
  Check, 
  X, 
  Search, 
  Clock, 
  ShieldAlert,
  UserCheck,
  UserX,
  Trash2,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Registration {
  userId: string;
  email: string;
  displayName: string;
  status: 'approved' | 'pending' | 'rejected' | 'legacy_active';
  createdAt?: string;
  isLegacy?: boolean;
}

interface AdminPanelProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function AdminPanel({ showToast }: AdminPanelProps) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [legacyUsers, setLegacyUsers] = useState<{ userId: string; therapistName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [search, setSearch] = useState('');

  // Confirmation Modal with countdown state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'approve' | 'restrict' | 'delete';
    userId: string;
    email: string;
    displayName: string;
    isLegacy?: boolean;
  } | null>(null);
  const [confirmCountdown, setConfirmCountdown] = useState(5);

  // Safety countdown effect (5 seconds)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (confirmModal?.isOpen && confirmCountdown > 0) {
      timer = setTimeout(() => {
        setConfirmCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [confirmModal?.isOpen, confirmCountdown]);

  const openConfirmModal = (
    type: 'approve' | 'restrict' | 'delete', 
    userId: string, 
    email: string, 
    displayName: string,
    isLegacy?: boolean
  ) => {
    setConfirmModal({
      isOpen: true,
      type,
      userId,
      email,
      displayName,
      isLegacy
    });
    setConfirmCountdown(5);
  };

  useEffect(() => {
    const q = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Registration[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          userId: docSnap.id,
          email: data.email || '',
          displayName: data.displayName || '',
          status: data.status || 'pending',
          createdAt: data.createdAt
        });
      });
      setRegistrations(list);
      setLoading(false);
    }, (error) => {
      console.error("Registrations subscription error:", error);
      showToast('Kullanıcı kayıtları yüklenirken bir hata oluştu.', 'error');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch legacy users (registered before rule creation)
  useEffect(() => {
    const fetchLegacyUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const list: { userId: string; therapistName: string }[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Exclude admin themselves from legacy user checks
          if (docSnap.id !== 'muhammedakifkayacan@gmail.com') {
            list.push({
              userId: docSnap.id,
              therapistName: data.settings?.therapistName || 'Eski Sistem Kullanıcısı'
            });
          }
        });
        setLegacyUsers(list);
      } catch (error) {
        console.error("Error fetching legacy users:", error);
      }
    };
    fetchLegacyUsers();
  }, [registrations]);

  const handleConfirmedAction = async () => {
    if (!confirmModal) return;
    const { type, userId, email, displayName } = confirmModal;
    
    setConfirmModal(null);
    
    const displayEmail = email.includes('Eski Kayıt') ? 'eski.kayit@psycalcu.com' : email;
    
    if (type === 'approve') {
      try {
        const ref = doc(db, 'registrations', userId);
        const existingReg = registrations.find(r => r.userId === userId);
        const originalCreatedAt = existingReg?.createdAt || new Date().toISOString();
        await setDoc(ref, {
          userId,
          email: displayEmail,
          displayName: displayName || 'Psikolog',
          status: 'approved',
          createdAt: originalCreatedAt
        }, { merge: true });
        showToast(`${displayName || displayEmail} kullanıcısına başarıyla onay verildi.`, 'success');
      } catch (error) {
        console.error("Error approving registration status:", error);
        showToast('Durum güncellenirken bir sorun oluştu.', 'error');
      }
    } else if (type === 'restrict') {
      try {
        const ref = doc(db, 'registrations', userId);
        const existingReg = registrations.find(r => r.userId === userId);
        const originalCreatedAt = existingReg?.createdAt || new Date().toISOString();
        await setDoc(ref, {
          userId,
          email: displayEmail,
          displayName: displayName || 'Psikolog',
          status: 'rejected',
          createdAt: originalCreatedAt
        }, { merge: true });
        showToast(`${displayName || displayEmail} kullanıcısı başarıyla sınırlandırıldı.`, 'success');
      } catch (error) {
        console.error("Error restricting registration status:", error);
        showToast('Durum güncellenirken bir sorun oluştu.', 'error');
      }
    } else if (type === 'delete') {
      try {
        const regRef = doc(db, 'registrations', userId);
        await deleteDoc(regRef);
        
        // Also wipe user settings and sessions document to completely clean database
        const userRef = doc(db, 'users', userId);
        await deleteDoc(userRef);
        
        showToast(`${displayName || displayEmail} kaydı ve tüm verileri tamamen silindi.`, 'success');
      } catch (error) {
        console.error("Error deleting registration:", error);
        showToast('Kayıt silinirken bir sorun oluştu.', 'error');
      }
    }
  };

  // Combine standard registrations and legacy users
  const combinedUsers = useMemo(() => {
    const list: Registration[] = registrations.map(r => ({ ...r, isLegacy: false }));
    legacyUsers.forEach(lu => {
      const exists = registrations.some(r => r.userId === lu.userId);
      if (!exists) {
        list.push({
          userId: lu.userId,
          email: 'Eski Kayıt (Giriş yaptığında e-posta alınacak)',
          displayName: lu.therapistName || 'Eski Terapist',
          status: 'pending',
          isLegacy: true,
          createdAt: undefined
        });
      }
    });
    return list;
  }, [registrations, legacyUsers]);

  const filteredRegistrations = useMemo(() => {
    return combinedUsers.filter(reg => {
      const matchesFilter = filter === 'all' || reg.status === filter;
      const matchesSearch = 
        reg.email.toLowerCase().includes(search.toLowerCase()) || 
        reg.displayName.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [combinedUsers, filter, search]);

  const pendingCount = useMemo(() => {
    return combinedUsers.filter(r => r.status === 'pending').length;
  }, [combinedUsers]);

  return (
    <div className="space-y-6" id="admin-panel-component">
      {/* Editorial Header */}
      <div className="bg-[#6b705c] p-8 rounded-[2.5rem] text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
        <div className="max-w-2xl">
          <span className="text-[10px] bg-white/20 px-3 py-1 rounded-full font-semibold tracking-wider">KURUCU PANELİ</span>
          <h2 className="text-3xl font-serif mt-3">Kullanıcı Onay & Kayıt Yönetimi</h2>
          <p className="text-sm opacity-90 mt-2 leading-relaxed">
            PsyCalcu sistemine kayıt talebi gönderen psikolog ve terapistlerin durumlarını bu sayfadan kontrol edebilir, kullanım onaylarını yönetebilirsiniz.
          </p>
        </div>
      </div>

      {/* Stats Summary Bento cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-[#e5e1d8] shadow-xs flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Toplam Kayıt</span>
          <span className="text-2xl font-serif font-bold text-slate-700 mt-2">{combinedUsers.length}</span>
        </div>
        <div className="bg-amber-50/40 p-5 rounded-3xl border border-amber-100 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] text-amber-600 font-bold tracking-widest uppercase">Onay Bekleyen</span>
          <div className="flex justify-between items-baseline mt-2">
            <span className="text-2xl font-serif font-bold text-amber-700">{pendingCount}</span>
            {pendingCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
        </div>
        <div className="bg-emerald-50/40 p-5 rounded-3xl border border-emerald-100 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] text-emerald-600 font-bold tracking-widest uppercase">Onaylanan</span>
          <span className="text-2xl font-serif font-bold text-emerald-700 mt-2">
            {combinedUsers.filter(r => r.status === 'approved').length}
          </span>
        </div>
        <div className="bg-rose-50/40 p-5 rounded-3xl border border-rose-100 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] text-rose-600 font-bold tracking-widest uppercase">Reddedilen</span>
          <span className="text-2xl font-serif font-bold text-rose-700 mt-2">
            {combinedUsers.filter(r => r.status === 'rejected').length}
          </span>
        </div>
      </div>

      {/* Filters and Search toolbar */}
      <div className="bg-white p-4 rounded-[2rem] border border-[#e5e1d8] shadow-xs flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((t) => {
            const approvedCount = combinedUsers.filter(r => r.status === 'approved').length;
            const rejectedCount = combinedUsers.filter(r => r.status === 'rejected').length;
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filter === t 
                    ? 'bg-[#6b705c] text-white shadow-xs' 
                    : 'text-[#6b705c] hover:bg-slate-50'
                }`}
              >
                {t === 'all' && 'Tüm Kayıtlar'}
                {t === 'pending' && (
                  <span className="flex items-center gap-1.5">
                    Onay Bekleyenler
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === t ? 'bg-white text-[#6b705c]' : 'bg-amber-100 text-amber-800'}`}>
                      {pendingCount}
                    </span>
                  </span>
                )}
                {t === 'approved' && (
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${filter === t ? 'bg-white' : 'animate-pulse'}`} />
                    Aktif Kullanıcılar
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === t ? 'bg-white text-[#6b705c]' : 'bg-emerald-100 text-emerald-800'}`}>
                      {approvedCount}
                    </span>
                  </span>
                )}
                {t === 'rejected' && (
                  <span className="flex items-center gap-1.5">
                    Sınırlandırılanlar
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === t ? 'bg-white text-[#6b705c]' : 'bg-rose-100 text-rose-800'}`}>
                      {rejectedCount}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="İsim veya e-posta ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-[#e5e1d8] bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#6b705c]/30"
          />
        </div>
      </div>

      {/* Registrations List */}
      <div className="bg-white rounded-[2.5rem] border border-[#e5e1d8] shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
            <RefreshCw className="w-8 h-8 text-[#6b705c] animate-spin" />
            <p className="text-xs text-slate-400 italic">Yükleniyor...</p>
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <Users className="w-12 h-12 text-[#a5a58d]/30 stroke-[1.5]" />
            <div>
              <p className="text-sm font-semibold text-slate-600">Herhangi bir kayıt bulunamadı</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                {search || filter !== 'all' 
                  ? 'Yaptığınız filtrelemeye veya aramaya uyan bir kayıt bulunamadı.' 
                  : 'Sisteme kayıtlı veya onay bekleyen kullanıcı talebi bulunmuyor.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#f5f5f0]">
            {filteredRegistrations.map((reg) => (
              <div 
                key={reg.userId} 
                className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-[#fdfbf7]/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-slate-800 font-bold text-sm">
                      {reg.displayName || 'Bilinmeyen Kullanıcı'}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      reg.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      reg.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                      reg.isLegacy ? 'bg-[#6b705c]/10 text-[#6b705c] border border-[#6b705c]/20' :
                      'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                    }`}>
                      {reg.status === 'approved' && 'Onaylandı'}
                      {reg.status === 'rejected' && 'Sınırlandı'}
                      {reg.isLegacy && 'Eski Sistem Kaydı'}
                      {!reg.isLegacy && reg.status === 'pending' && 'Onay Bekliyor'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">{reg.email}</p>
                  
                  {reg.isLegacy && (
                    <p className="text-[11px] text-[#cb997e] font-semibold leading-relaxed mt-1">
                      ⚠️ Bu terapist onay sistemi kurulmadan önce kayıt olmuştur. Giriş yetkisi için onay vermeniz önerilir.
                    </p>
                  )}
                  
                  {reg.createdAt && (
                    <p className="text-[10px] text-slate-400">
                      Talep Tarihi: {new Date(reg.createdAt).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {reg.status !== 'approved' && (
                    <button
                      onClick={() => openConfirmModal('approve', reg.userId, reg.email, reg.displayName, reg.isLegacy)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      title="Kullanıcıya Giriş Onayı Ver"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Girişe Onay Ver
                    </button>
                  )}

                  {reg.status !== 'rejected' && (
                    <button
                      onClick={() => openConfirmModal('restrict', reg.userId, reg.email, reg.displayName, reg.isLegacy)}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl border border-rose-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Kullanıcı Girişini Engelle/Sınırla"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Sınırla
                    </button>
                  )}

                  <button
                    onClick={() => openConfirmModal('delete', reg.userId, reg.email, reg.displayName, reg.isLegacy)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-100 transition-colors cursor-pointer"
                    title="Kullanıcı Kaydını Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dynamic Confirmation Modal with Counter */}
      <AnimatePresence>
        {confirmModal?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] border border-[#e5e1d8] shadow-xl p-8 overflow-hidden z-10"
            >
              {/* Decorative top strip */}
              <div className={`absolute top-0 left-0 right-0 h-2 ${
                confirmModal.type === 'delete' ? 'bg-rose-500' :
                confirmModal.type === 'approve' ? 'bg-emerald-500' : 'bg-amber-500'
              }`} />

              <div className="text-center space-y-6">
                {/* Icon Wrapper */}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border ${
                  confirmModal.type === 'delete' 
                    ? 'bg-rose-50 border-rose-100 text-rose-600' 
                    : confirmModal.type === 'approve'
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                      : 'bg-amber-50 border-amber-100 text-amber-600'
                }`}>
                  {confirmModal.type === 'delete' ? (
                    <Trash2 className="w-8 h-8" />
                  ) : confirmModal.type === 'approve' ? (
                    <UserCheck className="w-8 h-8" />
                  ) : (
                    <UserX className="w-8 h-8" />
                  )}
                </div>

                {/* Text Content */}
                <div className="space-y-2">
                  <h3 className="text-xl font-serif text-slate-800 font-bold">
                    {confirmModal.type === 'delete' ? 'Kaydı Tamamen Sil' :
                     confirmModal.type === 'approve' ? 'Kullanıcı Girişini Onayla' : 'Kullanıcıyı Sınırla'}
                  </h3>
                  <div className="space-y-1">
                    <p className="text-xs font-serif text-slate-500 italic">
                      {confirmModal.displayName || 'Bilinmeyen Terapist'}
                    </p>
                    <p className="text-xs font-mono text-slate-400">
                      {confirmModal.email}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-[#e5e1d8]/60 text-left space-y-2">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {confirmModal.type === 'delete' ? (
                      <>
                        Bu işlem geri alınamaz. Terapistin kayıt isteği, onay bilgileri ve tüm bulut verileri veritabanından <strong>kalıcı olarak silinecektir</strong>.
                      </>
                    ) : confirmModal.type === 'approve' ? (
                      <>
                        {confirmModal.isLegacy ? (
                          <>
                            Bu kullanıcı eski sisteme aittir. Giriş yapabilmesi için yeni sistemde <strong>onay kaydı oluşturularak aktif edilecektir</strong>.
                          </>
                        ) : (
                          <>
                            Bu terapistin sisteme erişimi ve veri senkronizasyonu <strong>onaylanacaktır</strong>. Hemen giriş yapabilecektir.
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        Bu terapistin sisteme erişimi derhal <strong>kısıtlanacaktır</strong>. Tekrar giriş yapmak istediğinde onay bekleme ekranıyla karşılaşacaktır.
                      </>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    ⚠️ Kazaları önlemek için güvenlik sayacı aktif edilmiştir. Lütfen bekleyin.
                  </p>
                </div>

                {/* Control Buttons */}
                <div className="flex flex-col gap-2.5 pt-2">
                  <button
                    disabled={confirmCountdown > 0}
                    onClick={handleConfirmedAction}
                    className={`w-full py-3.5 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                      confirmCountdown > 0
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        : confirmModal.type === 'delete'
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : confirmModal.type === 'approve'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-amber-600 hover:bg-amber-700 text-white'
                    }`}
                  >
                    {confirmCountdown > 0 ? (
                      <>
                        <span>⏳ Onayla ({confirmCountdown}s)</span>
                      </>
                    ) : (
                      <>
                        <span>⚠️ Güvenle Onayla</span>
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => setConfirmModal(null)}
                    className="w-full py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl border border-[#e5e1d8] transition-all cursor-pointer"
                  >
                    Vazgeç / İptal Et
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
