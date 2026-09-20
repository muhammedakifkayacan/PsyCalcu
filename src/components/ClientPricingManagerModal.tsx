import React, { useState, useMemo } from 'react';
import { 
  X, 
  Users, 
  DollarSign, 
  CheckCircle2, 
  RotateCcw, 
  Save, 
  Search, 
  Sparkles, 
  History, 
  Baby, 
  Building2, 
  CreditCard,
  AlertCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { Session, AppSettings, Expense, DataBackupSnapshot, ClientPricingRule, getNormalizedClientName, bulkApplyClientRule } from '../types';

interface ClientPricingManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  settings: AppSettings;
  expenses: Expense[];
  snapshots?: DataBackupSnapshot[];
  onApplyRules: (updatedSessions: Session[], updatedSettings: AppSettings) => Promise<void>;
  onRestoreSnapshot?: (snapshot: DataBackupSnapshot) => Promise<void>;
  isAdminView?: boolean;
  targetUserName?: string;
}

interface ClientRowState {
  clientName: string;
  normalizedName: string;
  sessionCount: number;
  faceToFaceCount: number;
  onlineCount: number;
  currentPrice: number;
  newPrice: number;
  hasBabysitterFee: boolean;
  babysitterFeeAmount: number;
  hasOfficeRentFee: boolean;
  officeRentFeeAmount: number;
  bulkPaymentAction: 'keep' | 'all-paid' | 'all-unpaid';
  isModified: boolean;
}

export const ClientPricingManagerModal: React.FC<ClientPricingManagerModalProps> = ({
  isOpen,
  onClose,
  sessions,
  settings,
  expenses,
  snapshots = [],
  onApplyRules,
  onRestoreSnapshot,
  isAdminView = false,
  targetUserName
}) => {
  const [activeTab, setActiveTab] = useState<'clients' | 'snapshots'>('clients');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Group and extract all unique clients from sessions
  const clientRows = useMemo(() => {
    const map = new Map<string, ClientRowState>();
    const customPrices = settings.clientCustomPrices || {};

    sessions.forEach(s => {
      if (!s || !s.clientName || s.type === 'cancelled' || s.type === 'non-session') return;
      const norm = getNormalizedClientName(s.clientName);
      if (!norm) return;

      if (!map.has(norm)) {
        const customRule = customPrices[norm];
        const defaultPrice = customRule?.price ?? (s.price > 0 ? s.price : settings.defaultSessionPrice ?? 1200);
        const hasBabysitter = customRule?.hasBabysitterFee ?? s.hasBabysitterFee ?? true;
        const babysitterAmount = customRule?.babysitterFeeAmount ?? s.babysitterFeeAmount ?? settings.defaultBabysitterFee ?? 250;
        const hasOfficeRent = customRule?.hasOfficeRentFee ?? (s.type === 'face-to-face' ? (s.hasOfficeRentFee ?? true) : false);
        const officeRentAmount = customRule?.officeRentFeeAmount ?? (s.hasOfficeRentFee ? s.officeRentFeeAmount : settings.defaultOfficeRentFee ?? 200);

        map.set(norm, {
          clientName: s.clientName, // display name
          normalizedName: norm,
          sessionCount: 0,
          faceToFaceCount: 0,
          onlineCount: 0,
          currentPrice: defaultPrice,
          newPrice: defaultPrice,
          hasBabysitterFee: hasBabysitter,
          babysitterFeeAmount: babysitterAmount,
          hasOfficeRentFee: hasOfficeRent,
          officeRentFeeAmount: officeRentAmount,
          bulkPaymentAction: 'keep',
          isModified: false
        });
      }

      const row = map.get(norm)!;
      row.sessionCount += 1;
      if (s.type === 'face-to-face') row.faceToFaceCount += 1;
      if (s.type === 'online') row.onlineCount += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.sessionCount - a.sessionCount);
  }, [sessions, settings]);

  const [clientStates, setClientStates] = useState<{ [normalized: string]: ClientRowState }>({});

  // Initialize client states when modal opens or clientRows change
  React.useEffect(() => {
    const initial: { [normalized: string]: ClientRowState } = {};
    clientRows.forEach(r => {
      initial[r.normalizedName] = { ...r };
    });
    setClientStates(initial);
  }, [clientRows, isOpen]);

  if (!isOpen) return null;

  const filteredClients = clientRows.filter(r => 
    r.clientName.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR')) ||
    r.normalizedName.includes(searchTerm.toLocaleLowerCase('tr-TR'))
  );

  const handlePriceChange = (norm: string, val: number) => {
    setClientStates(prev => {
      const current = prev[norm] || clientRows.find(r => r.normalizedName === norm);
      if (!current) return prev;
      return {
        ...prev,
        [norm]: {
          ...current,
          newPrice: val,
          isModified: true
        }
      };
    });
  };

  const handleBabysitterToggle = (norm: string) => {
    setClientStates(prev => {
      const current = prev[norm] || clientRows.find(r => r.normalizedName === norm);
      if (!current) return prev;
      return {
        ...prev,
        [norm]: {
          ...current,
          hasBabysitterFee: !current.hasBabysitterFee,
          isModified: true
        }
      };
    });
  };

  const handleBabysitterAmountChange = (norm: string, val: number) => {
    setClientStates(prev => {
      const current = prev[norm] || clientRows.find(r => r.normalizedName === norm);
      if (!current) return prev;
      return {
        ...prev,
        [norm]: {
          ...current,
          babysitterFeeAmount: val,
          isModified: true
        }
      };
    });
  };

  const handleOfficeRentToggle = (norm: string) => {
    setClientStates(prev => {
      const current = prev[norm] || clientRows.find(r => r.normalizedName === norm);
      if (!current) return prev;
      return {
        ...prev,
        [norm]: {
          ...current,
          hasOfficeRentFee: !current.hasOfficeRentFee,
          isModified: true
        }
      };
    });
  };

  const handleOfficeRentAmountChange = (norm: string, val: number) => {
    setClientStates(prev => {
      const current = prev[norm] || clientRows.find(r => r.normalizedName === norm);
      if (!current) return prev;
      return {
        ...prev,
        [norm]: {
          ...current,
          officeRentFeeAmount: val,
          isModified: true
        }
      };
    });
  };

  const handlePaymentActionChange = (norm: string, action: 'keep' | 'all-paid' | 'all-unpaid') => {
    setClientStates(prev => {
      const current = prev[norm] || clientRows.find(r => r.normalizedName === norm);
      if (!current) return prev;
      return {
        ...prev,
        [norm]: {
          ...current,
          bulkPaymentAction: action,
          isModified: true
        }
      };
    });
  };

  // Bulk Apply All Changes
  const handleApplyAllChanges = async () => {
    try {
      setIsSaving(true);
      let updatedSessionsList = [...sessions];
      const updatedCustomPrices: { [normalized: string]: ClientPricingRule } = {
        ...(settings.clientCustomPrices || {})
      };

      Object.values(clientStates).forEach(row => {
        if (!row.isModified) return;

        // 1. Save rule to settings memory
        updatedCustomPrices[row.normalizedName] = {
          price: row.newPrice,
          hasBabysitterFee: row.hasBabysitterFee,
          babysitterFeeAmount: row.babysitterFeeAmount,
          hasOfficeRentFee: row.hasOfficeRentFee,
          officeRentFeeAmount: row.officeRentFeeAmount,
          updatedAt: Date.now()
        };

        // 2. Bulk apply to all sessions of this client
        const paymentRule = row.bulkPaymentAction === 'all-paid' 
          ? ('paid' as const) 
          : row.bulkPaymentAction === 'all-unpaid' 
            ? ('unpaid' as const) 
            : undefined;

        updatedSessionsList = bulkApplyClientRule(
          updatedSessionsList,
          row.clientName,
          {
            price: row.newPrice,
            hasBabysitterFee: row.hasBabysitterFee,
            babysitterFeeAmount: row.babysitterFeeAmount,
            hasOfficeRentFee: row.hasOfficeRentFee,
            officeRentFeeAmount: row.officeRentFeeAmount,
            paymentStatus: paymentRule
          },
          'all'
        );
      });

      const updatedSettings = {
        ...settings,
        clientCustomPrices: updatedCustomPrices
      };

      await onApplyRules(updatedSessionsList, updatedSettings);
      setSaveSuccessMessage('Tüm danışan fiyatları ve seans muhasebe kayıtları başarıyla güncellendi!');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      alert('Güncelleme sırasında hata oluştu: ' + (err?.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800">
                  {isAdminView ? `Danışan Fiyat & Geçmiş Kurtarma Paneli (${targetUserName || 'Kullanıcı'})` : 'Danışan Özel Fiyat & Muhasebe Kurtarma Merkezi'}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                  84 Günlük Tam Senkronizasyon
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Danışanlarınıza özel seans ücretlerini, bakıcı ve ofis kiralarını tek ekrandan ayarlayın; tüm geçmiş ve gelecek seanslara anında uygulansın.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-3">
          <button
            onClick={() => setActiveTab('clients')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'clients'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            Danışan Fiyat Listesi ({clientRows.length})
          </button>
          <button
            onClick={() => setActiveTab('snapshots')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'snapshots'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-4 h-4" />
            Zaman Yolculuğu & Yedek Noktaları ({snapshots.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
          
          {saveSuccessMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-sm font-medium animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              {saveSuccessMessage}
            </div>
          )}

          {activeTab === 'clients' && (
            <div className="space-y-4">
              {/* Search & Actions Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Danışan adı ile ara..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <span className="text-xs text-slate-500">
                    Toplam <strong>{clientRows.length}</strong> farklı danışan tespit edildi.
                  </span>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Danışan Adı</th>
                        <th className="px-3 py-3 text-center">Toplam Seans</th>
                        <th className="px-4 py-3">Seans Ücreti (₺)</th>
                        <th className="px-3 py-3">Bakıcı Gideri</th>
                        <th className="px-3 py-3">Ofis Kirası</th>
                        <th className="px-3 py-3">Toplu Ödeme Durumu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredClients.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-10 text-slate-400">
                            Danışan bulunamadı.
                          </td>
                        </tr>
                      ) : (
                        filteredClients.map(row => {
                          const state = clientStates[row.normalizedName] || row;
                          return (
                            <tr key={row.normalizedName} className={`hover:bg-slate-50/80 transition-colors ${state.isModified ? 'bg-amber-50/40' : ''}`}>
                              
                              {/* Name & Stats */}
                              <td className="px-4 py-3.5">
                                <div className="font-semibold text-slate-800">
                                  {row.clientName}
                                </div>
                                <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                                  {row.faceToFaceCount > 0 && <span>🏢 {row.faceToFaceCount} Yüzyüze</span>}
                                  {row.onlineCount > 0 && <span>🌐 {row.onlineCount} Online</span>}
                                </div>
                              </td>

                              {/* Count */}
                              <td className="px-3 py-3.5 text-center">
                                <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-xs">
                                  {row.sessionCount}
                                </span>
                              </td>

                              {/* Price */}
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-slate-400">₺</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="50"
                                    value={state.newPrice}
                                    onChange={e => handlePriceChange(row.normalizedName, Number(e.target.value) || 0)}
                                    className="w-28 px-2.5 py-1.5 text-sm font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  />
                                </div>
                              </td>

                              {/* Babysitter */}
                              <td className="px-3 py-3.5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={`baby-${row.normalizedName}`}
                                    checked={state.hasBabysitterFee}
                                    onChange={() => handleBabysitterToggle(row.normalizedName)}
                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                                  />
                                  {state.hasBabysitterFee && (
                                    <input
                                      type="number"
                                      min="0"
                                      step="50"
                                      value={state.babysitterFeeAmount}
                                      onChange={e => handleBabysitterAmountChange(row.normalizedName, Number(e.target.value) || 0)}
                                      className="w-20 px-1.5 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500"
                                    />
                                  )}
                                </div>
                              </td>

                              {/* Office Rent */}
                              <td className="px-3 py-3.5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={`office-${row.normalizedName}`}
                                    checked={state.hasOfficeRentFee}
                                    onChange={() => handleOfficeRentToggle(row.normalizedName)}
                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                                  />
                                  {state.hasOfficeRentFee && (
                                    <input
                                      type="number"
                                      min="0"
                                      step="50"
                                      value={state.officeRentFeeAmount}
                                      onChange={e => handleOfficeRentAmountChange(row.normalizedName, Number(e.target.value) || 0)}
                                      className="w-20 px-1.5 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500"
                                    />
                                  )}
                                </div>
                              </td>

                              {/* Payment Status Action */}
                              <td className="px-3 py-3.5">
                                <select
                                  value={state.bulkPaymentAction}
                                  onChange={e => handlePaymentActionChange(row.normalizedName, e.target.value as any)}
                                  className="text-xs py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 text-slate-700"
                                >
                                  <option value="keep">Mevcut Durumu Koru</option>
                                  <option value="all-paid">✅ Hepsini 'Ödendi' Yap</option>
                                  <option value="all-unpaid">⏳ Hepsini 'Ödenmedi' Yap</option>
                                </select>
                              </td>

                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'snapshots' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-900 text-xs flex items-start gap-2.5">
                <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Zaman Yolculuğu & Noktasal Geri Yükleme (Point-in-Time Recovery)</p>
                  <p className="mt-0.5 text-blue-700">
                    Sistem her kritik işlemde (takvim eşitlemesi, toplu fiyat güncellemesi, gün sonu) verilerinizin eksiksiz bir anlık kopyasını saklar.
                    İstediğiniz tarihteki yedeğe tek tıkla geri dönebilirsiniz.
                  </p>
                </div>
              </div>

              {snapshots.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
                  <History className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-medium text-slate-600">Henüz kayıtlı bir geçmiş yedek noktası bulunmuyor.</p>
                  <p className="text-xs text-slate-400 mt-1">İlk takvim eşitlemesi veya fiyat kaydından sonra otomatik yedekler burada listelenecektir.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {snapshots.map(snap => (
                    <div key={snap.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-emerald-300 transition-all flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            {new Date(snap.timestamp).toLocaleString('tr-TR')}
                          </span>
                          <span className="text-xs text-slate-400">
                            {snap.sessionCount} Seans
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm mt-2">{snap.label}</h4>
                        <div className="grid grid-cols-2 gap-2 mt-3 text-xs bg-slate-50 p-2.5 rounded-lg">
                          <div>
                            <span className="text-slate-400">Toplam Brüt Gelir:</span>
                            <div className="font-bold text-slate-700">₺{snap.totalGrossIncome?.toLocaleString('tr-TR')}</div>
                          </div>
                          <div>
                            <span className="text-slate-400">Tahsil Edilen:</span>
                            <div className="font-bold text-emerald-600">{snap.paidSessionsCount} Seans</div>
                          </div>
                        </div>
                      </div>

                      {onRestoreSnapshot && (
                        <button
                          onClick={() => {
                            if (window.confirm(`${new Date(snap.timestamp).toLocaleString('tr-TR')} tarihli yedeği geri yüklemek istediğinize emin misiniz? Mevcut seanslarınız bu yedekle değiştirilecektir.`)) {
                              onRestoreSnapshot(snap);
                            }
                          }}
                          className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Bu Yedeğe Geri Dön
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Kapat
          </button>

          {activeTab === 'clients' && (
            <button
              onClick={handleApplyAllChanges}
              disabled={isSaving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Tüm Seanslara Uygulanıyor...' : 'Tüm 84 Günlük Seanslara Uygula ve Kaydet'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
