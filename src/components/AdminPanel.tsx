import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
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
  RefreshCw
} from 'lucide-react';

interface Registration {
  userId: string;
  email: string;
  displayName: string;
  status: 'approved' | 'pending' | 'rejected';
  createdAt?: string;
}

interface AdminPanelProps {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function AdminPanel({ showToast }: AdminPanelProps) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [search, setSearch] = useState('');

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

  const handleUpdateStatus = async (userId: string, email: string, newStatus: 'approved' | 'rejected') => {
    try {
      const ref = doc(db, 'registrations', userId);
      await updateDoc(ref, { status: newStatus });
      showToast(`${email} kullanıcısı başarıyla ${newStatus === 'approved' ? 'onaylandı' : 'sınırlandırıldı'}.`, 'success');
    } catch (error) {
      console.error("Error updating registration status:", error);
      showToast('Durum güncellenirken bir sorun oluştu.', 'error');
    }
  };

  const handleDeleteRegistration = async (userId: string, email: string) => {
    if (!window.confirm(`${email} kaydını tamamen silmek istediğinize emin misiniz?`)) {
      return;
    }
    try {
      const ref = doc(db, 'registrations', userId);
      await deleteDoc(ref);
      showToast(`${email} kaydı tamamen silindi.`, 'success');
    } catch (error) {
      console.error("Error deleting registration:", error);
      showToast('Kayıt silinirken bir sorun oluştu.', 'error');
    }
  };

  const filteredRegistrations = registrations.filter(reg => {
    const matchesFilter = filter === 'all' || reg.status === filter;
    const matchesSearch = 
      reg.email.toLowerCase().includes(search.toLowerCase()) || 
      reg.displayName.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const pendingCount = registrations.filter(r => r.status === 'pending').length;

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
          <span className="text-2xl font-serif font-bold text-slate-700 mt-2">{registrations.length}</span>
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
            {registrations.filter(r => r.status === 'approved').length}
          </span>
        </div>
        <div className="bg-rose-50/40 p-5 rounded-3xl border border-rose-100 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] text-rose-600 font-bold tracking-widest uppercase">Reddedilen</span>
          <span className="text-2xl font-serif font-bold text-rose-700 mt-2">
            {registrations.filter(r => r.status === 'rejected').length}
          </span>
        </div>
      </div>

      {/* Filters and Search toolbar */}
      <div className="bg-white p-4 rounded-[2rem] border border-[#e5e1d8] shadow-xs flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="flex flex-wrap gap-1 w-full sm:w-auto">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                filter === t 
                  ? 'bg-[#6b705c] text-white shadow-xs' 
                  : 'text-[#6b705c] hover:bg-slate-50'
              }`}
            >
              {t === 'all' && 'Tümü'}
              {t === 'pending' && `Onay Bekleyen (${pendingCount})`}
              {t === 'approved' && 'Onaylananlar'}
              {t === 'rejected' && 'Reddedilenler'}
            </button>
          ))}
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
                      'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                    }`}>
                      {reg.status === 'approved' && 'Onaylandı'}
                      {reg.status === 'rejected' && 'Sınırlandı'}
                      {reg.status === 'pending' && 'Onay Bekliyor'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">{reg.email}</p>
                  {reg.createdAt && (
                    <p className="text-[10px] text-slate-400">
                      Talebi Tarihi: {new Date(reg.createdAt).toLocaleDateString('tr-TR', {
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
                      onClick={() => handleUpdateStatus(reg.userId, reg.email, 'approved')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      title="Kullanıcıya Giriş Onayı Ver"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Girişe Onay Ver
                    </button>
                  )}

                  {reg.status !== 'rejected' && (
                    <button
                      onClick={() => handleUpdateStatus(reg.userId, reg.email, 'rejected')}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl border border-rose-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Kullanıcı Girişini Engelle/Sınırla"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Sınırla
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteRegistration(reg.userId, reg.email)}
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
    </div>
  );
}
