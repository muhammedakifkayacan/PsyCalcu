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
  AlertTriangle,
  Settings,
  Shield,
  FileSpreadsheet,
  Sparkles,
  FileText,
  ChevronDown,
  Calendar,
  PieChart,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Registration {
  userId: string;
  email: string;
  displayName: string;
  status: 'approved' | 'pending' | 'rejected' | 'legacy_active';
  createdAt?: string;
  isLegacy?: boolean;
  maxSessionsLimit?: string | number;
  featuresAIAllowed?: boolean;
  featuresExportAllowed?: boolean;
  featuresCalendarAllowed?: boolean;
  featuresAccountingAllowed?: boolean;
  featuresDebtTrackerAllowed?: boolean;
  featuresSmartPriceMatchingAllowed?: boolean;
  adminNote?: string;
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
  const [openSettingsUserId, setOpenSettingsUserId] = useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = useState<{ [userId: string]: string }>({});

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
          createdAt: data.createdAt,
          maxSessionsLimit: data.maxSessionsLimit ?? 'unlimited',
          featuresAIAllowed: data.featuresAIAllowed !== false,
          featuresExportAllowed: data.featuresExportAllowed !== false,
          featuresCalendarAllowed: data.featuresCalendarAllowed !== false,
          featuresAccountingAllowed: data.featuresAccountingAllowed !== false,
          featuresDebtTrackerAllowed: data.featuresDebtTrackerAllowed !== false,
          featuresSmartPriceMatchingAllowed: data.featuresSmartPriceMatchingAllowed !== false,
          adminNote: data.adminNote || ''
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

  const handleUpdateAdvancedSettings = async (
    userId: string, 
    fields: { 
      maxSessionsLimit?: string | number; 
      featuresAIAllowed?: boolean; 
      featuresExportAllowed?: boolean; 
      featuresCalendarAllowed?: boolean; 
      featuresAccountingAllowed?: boolean; 
      featuresDebtTrackerAllowed?: boolean; 
      featuresSmartPriceMatchingAllowed?: boolean; 
      adminNote?: string;
    }
  ) => {
    try {
      const ref = doc(db, 'registrations', userId);
      await setDoc(ref, fields, { merge: true });
      showToast('Kullanıcı kısıtlamaları ve ayarları başarıyla güncellendi.', 'success');
    } catch (error) {
      console.error("Error updating advanced settings:", error);
      showToast('Ayarlar güncellenirken bir hata oluştu.', 'error');
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
          createdAt: undefined,
          maxSessionsLimit: 'unlimited',
          featuresAIAllowed: true,
          featuresExportAllowed: true,
          featuresCalendarAllowed: true,
          featuresAccountingAllowed: true,
          featuresDebtTrackerAllowed: true,
          adminNote: ''
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
      <div className="bg-white rounded-[2.5rem] border border-[#e5e1d8] shadow-xs relative z-10">
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
            {filteredRegistrations.map((reg, index) => (
              <div 
                key={reg.userId} 
                className={`p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-[#fdfbf7]/50 transition-colors relative ${
                  openSettingsUserId === reg.userId ? 'z-30' : 'z-10'
                } ${
                  index === 0 ? 'rounded-t-[2.5rem]' : ''
                } ${
                  index === filteredRegistrations.length - 1 ? 'rounded-b-[2.5rem]' : ''
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
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

                    {/* Advanced Setting Badges */}
                    {reg.maxSessionsLimit && reg.maxSessionsLimit !== 'unlimited' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase tracking-wider">
                        ⚠️ En Fazla {reg.maxSessionsLimit} Seans
                      </span>
                    )}
                    {reg.featuresAIAllowed === false && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-100 uppercase tracking-wider">
                        🤖 AI Engelli
                      </span>
                    )}
                    {reg.featuresExportAllowed === false && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wider">
                        📊 Dışa Aktarım Engelli
                      </span>
                    )}
                    {reg.featuresCalendarAllowed === false && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-100 uppercase tracking-wider">
                        📅 Takvim Engelli
                      </span>
                    )}
                    {reg.featuresAccountingAllowed === false && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase tracking-wider">
                        📉 Rapor Engelli
                      </span>
                    )}
                    {reg.featuresDebtTrackerAllowed === false && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-50 text-red-700 border border-red-100 uppercase tracking-wider">
                        💸 Borç Engelli
                      </span>
                    )}
                    {reg.adminNote && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider" title={reg.adminNote}>
                        📌 {reg.adminNote}
                      </span>
                    )}
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

                  {/* Settings Gear Button with Hover Effect */}
                  <button
                    onClick={() => setOpenSettingsUserId(openSettingsUserId === reg.userId ? null : reg.userId)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${
                      openSettingsUserId === reg.userId 
                        ? 'bg-[#6b705c] border-[#6b705c] text-white' 
                        : 'text-slate-400 hover:text-[#6b705c] hover:bg-slate-50 border-transparent hover:border-slate-100'
                    }`}
                    title="Gelişmiş Kısıtlamalar ve Ayarlar"
                  >
                    <Settings className={`w-4 h-4 transition-transform duration-300 ${openSettingsUserId === reg.userId ? 'rotate-90' : ''}`} />
                  </button>

                  <button
                    onClick={() => openConfirmModal('delete', reg.userId, reg.email, reg.displayName, reg.isLegacy)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-100 transition-colors cursor-pointer"
                    title="Kullanıcı Kaydını Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Advanced Settings Dropdown / Popup Window */}
                <AnimatePresence>
                  {openSettingsUserId === reg.userId && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-6 top-[72px] z-30 w-80 bg-white border border-[#e5e1d8] rounded-[2rem] shadow-xl p-5 space-y-4 text-xs text-slate-700"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <span className="font-serif font-bold text-slate-800 flex items-center gap-1.5">
                          <Settings className="w-4 h-4 text-[#cb997e]" />
                          Gelişmiş Ayarlar
                        </span>
                        <button 
                          onClick={() => setOpenSettingsUserId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Section 1: Session Limit */}
                      <div className="space-y-1.5">
                        <label className="font-semibold text-slate-600 flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-slate-400" />
                          Maksimum Seans Kotası
                        </label>
                        <select
                          value={reg.maxSessionsLimit ?? 'unlimited'}
                          onChange={(e) => handleUpdateAdvancedSettings(reg.userId, { maxSessionsLimit: e.target.value })}
                          className="w-full px-2.5 py-2 text-xs rounded-xl border border-[#e5e1d8] bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#6b705c]/30 cursor-pointer"
                        >
                          <option value="unlimited">Sınırsız (Önerilen)</option>
                          <option value="10">10 Seans Sınırı</option>
                          <option value="50">50 Seans Sınırı</option>
                          <option value="100">100 Seans Sınırı</option>
                          <option value="250">250 Seans Sınırı</option>
                          <option value="500">500 Seans Sınırı</option>
                        </select>
                      </div>

                      {/* Section 2: AI Daily Analysis */}
                      <div className="flex items-center justify-between py-1 border-t border-slate-50 pt-2.5">
                        <div className="space-y-0.5 text-left">
                          <span className="font-semibold text-slate-600 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-[#cb997e]" />
                            Yapay Zeka Analiz İzni
                          </span>
                          <p className="text-[10px] text-slate-400">Günlük yapay zeka klinik asistanı erişimi</p>
                        </div>
                        <button
                          onClick={() => handleUpdateAdvancedSettings(reg.userId, { featuresAIAllowed: !reg.featuresAIAllowed })}
                          className={`w-10 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${reg.featuresAIAllowed !== false ? 'bg-[#6b705c]' : 'bg-slate-200'}`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full shadow-xs transition-transform transform ${reg.featuresAIAllowed !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* Section 3: Spreadsheet Export */}
                      <div className="flex items-center justify-between py-1 border-t border-slate-50 pt-2.5">
                        <div className="space-y-0.5 text-left">
                          <span className="font-semibold text-slate-600 flex items-center gap-1">
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                            Excel / E-Tablo Dışa Aktarım
                          </span>
                          <p className="text-[10px] text-slate-400">Seans verilerini Excel/CSV indirme yetkisi</p>
                        </div>
                        <button
                          onClick={() => handleUpdateAdvancedSettings(reg.userId, { featuresExportAllowed: !reg.featuresExportAllowed })}
                          className={`w-10 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${reg.featuresExportAllowed !== false ? 'bg-[#6b705c]' : 'bg-slate-200'}`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full shadow-xs transition-transform transform ${reg.featuresExportAllowed !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* Section 4: Calendar Integration */}
                      <div className="flex items-center justify-between py-1 border-t border-slate-50 pt-2.5">
                        <div className="space-y-0.5 text-left">
                          <span className="font-semibold text-slate-600 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-rose-500" />
                            Takvim Entegrasyonu
                          </span>
                          <p className="text-[10px] text-slate-400">Google Calendar entegrasyon erişimi</p>
                        </div>
                        <button
                          onClick={() => handleUpdateAdvancedSettings(reg.userId, { featuresCalendarAllowed: reg.featuresCalendarAllowed !== false ? false : true })}
                          className={`w-10 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${reg.featuresCalendarAllowed !== false ? 'bg-[#6b705c]' : 'bg-slate-200'}`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full shadow-xs transition-transform transform ${reg.featuresCalendarAllowed !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* Section 5: Accounting Reports */}
                      <div className="flex items-center justify-between py-1 border-t border-slate-50 pt-2.5">
                        <div className="space-y-0.5 text-left">
                          <span className="font-semibold text-slate-600 flex items-center gap-1">
                            <PieChart className="w-3.5 h-3.5 text-amber-500" />
                            Muhasebe & Finans Raporları
                          </span>
                          <p className="text-[10px] text-slate-400">Haftalık/aylık detaylı gelir-gider grafikleri</p>
                        </div>
                        <button
                          onClick={() => handleUpdateAdvancedSettings(reg.userId, { featuresAccountingAllowed: reg.featuresAccountingAllowed !== false ? false : true })}
                          className={`w-10 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${reg.featuresAccountingAllowed !== false ? 'bg-[#6b705c]' : 'bg-slate-200'}`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full shadow-xs transition-transform transform ${reg.featuresAccountingAllowed !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* Section 6: Debt Tracker */}
                      <div className="flex items-center justify-between py-1 border-t border-slate-50 pt-2.5">
                        <div className="space-y-0.5 text-left">
                          <span className="font-semibold text-slate-600 flex items-center gap-1">
                            <CreditCard className="w-3.5 h-3.5 text-red-500" />
                            Borç & Alacak Takibi
                          </span>
                          <p className="text-[10px] text-slate-400">Danışanların ödenmemiş seans bakiyesi takibi</p>
                        </div>
                        <button
                          onClick={() => handleUpdateAdvancedSettings(reg.userId, { featuresDebtTrackerAllowed: reg.featuresDebtTrackerAllowed !== false ? false : true })}
                          className={`w-10 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${reg.featuresDebtTrackerAllowed !== false ? 'bg-[#6b705c]' : 'bg-slate-200'}`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full shadow-xs transition-transform transform ${reg.featuresDebtTrackerAllowed !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* Section 7: Smart Price Matching Permission */}
                      <div className="flex items-center justify-between py-1 border-t border-slate-50 pt-2.5">
                        <div className="space-y-0.5 text-left">
                          <span className="font-semibold text-slate-600 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Akıllı Fiyat Eşitleme
                          </span>
                          <p className="text-[10px] text-slate-400">Zamlı fiyatların ileri seanslara otomatik eşlenmesi</p>
                        </div>
                        <button
                          onClick={() => handleUpdateAdvancedSettings(reg.userId, { featuresSmartPriceMatchingAllowed: reg.featuresSmartPriceMatchingAllowed !== false ? false : true })}
                          className={`w-10 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${reg.featuresSmartPriceMatchingAllowed !== false ? 'bg-[#6b705c]' : 'bg-slate-200'}`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full shadow-xs transition-transform transform ${reg.featuresSmartPriceMatchingAllowed !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* Section 8: Admin Private Note */}
                      <div className="space-y-1.5 border-t border-slate-50 pt-2.5">
                        <label className="font-semibold text-slate-600 flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          Yönetici Özel Notu
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Örn: VIP, Premium, Stajyer..."
                            value={tempNoteText[reg.userId] !== undefined ? tempNoteText[reg.userId] : (reg.adminNote || '')}
                            onChange={(e) => setTempNoteText(prev => ({ ...prev, [reg.userId]: e.target.value }))}
                            className="flex-1 px-2.5 py-1.5 text-xs rounded-xl border border-[#e5e1d8] bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#6b705c]/30"
                          />
                          <button
                            onClick={() => handleUpdateAdvancedSettings(reg.userId, { adminNote: tempNoteText[reg.userId] || '' })}
                            className="px-3 py-1.5 bg-[#6b705c] hover:bg-[#585c4c] text-white text-[11px] font-semibold rounded-xl cursor-pointer transition-colors shadow-xs"
                          >
                            Kaydet
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
