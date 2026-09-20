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
  ArrowRight,
  GitMerge,
  Upload,
  Layers,
  Check
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
  newOnlinePrice: number;
  newFaceToFacePrice: number;
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
  const [activeTab, setActiveTab] = useState<'clients' | 'reconcile' | 'snapshots'>('clients');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Reconciliation state
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>(snapshots[0]?.id || '');
  const [uploadedBackupSessions, setUploadedBackupSessions] = useState<Session[] | null>(null);
  const [reconcileResult, setReconcileResult] = useState<{
    matchedCount: number;
    pricesRestored: number;
    babysitterRestored: number;
    officeRestored: number;
    paymentsRestored: number;
  } | null>(null);

  // Helper to extract base UID
  const extractBaseUid = (id: string) => {
    if (!id || !id.startsWith('ics_')) return id;
    const withoutPrefix = id.slice(4);
    const lastUnderscore = withoutPrefix.lastIndexOf('_');
    if (lastUnderscore !== -1) {
      const after = withoutPrefix.slice(lastUnderscore + 1);
      if (/^\d{8}$/.test(after)) {
        return withoutPrefix.slice(0, lastUnderscore);
      }
    }
    return withoutPrefix;
  };

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
        const defaultGeneralPrice = customRule?.price ?? (s.price > 0 ? s.price : settings.defaultSessionPrice ?? 1200);
        const onlineRulePrice = customRule?.onlinePrice ?? customRule?.price ?? settings.defaultOnlinePrice ?? defaultGeneralPrice;
        const faceRulePrice = customRule?.faceToFacePrice ?? customRule?.price ?? settings.defaultFaceToFacePrice ?? defaultGeneralPrice;
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
          currentPrice: defaultGeneralPrice,
          newPrice: defaultGeneralPrice,
          newOnlinePrice: onlineRulePrice,
          newFaceToFacePrice: faceRulePrice,
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

  // Handle uploaded JSON file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const extractedSessions: Session[] = Array.isArray(parsed) 
          ? parsed 
          : (Array.isArray(parsed.sessions) ? parsed.sessions : []);

        if (extractedSessions.length > 0) {
          setUploadedBackupSessions(extractedSessions);
          alert(`Yedek dosyasından ${extractedSessions.length} adet seans başarıyla okundu!`);
        } else {
          alert('Dosya içinde geçerli seans verisi bulunamadı.');
        }
      } catch (err: any) {
        alert('Dosya okunurken hata oluştu: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Perform ID-Based Reconciliation
  const handleReconcileFromSource = async (sourceSessions: Session[], sourceLabel: string) => {
    try {
      setIsSaving(true);
      
      // Index source sessions by ID, baseUid+date, and normClient+date+time
      const sourceById = new Map<string, Session>();
      const sourceByUidDate = new Map<string, Session>();
      const sourceByClientDateTime = new Map<string, Session>();

      sourceSessions.forEach(s => {
        if (!s || !s.id) return;
        sourceById.set(s.id, s);
        if (s.id.startsWith('ics_')) {
          const base = extractBaseUid(s.id);
          if (base && s.date) {
            sourceByUidDate.set(`${base}_${s.date}`, s);
          }
        }
        const norm = getNormalizedClientName(s.clientName);
        if (norm && s.date && s.time) {
          sourceByClientDateTime.set(`${norm}_${s.date}_${s.time}`, s);
        }
      });

      let matchedCount = 0;
      let pricesRestored = 0;
      let babysitterRestored = 0;
      let officeRestored = 0;
      let paymentsRestored = 0;

      const mergedSessions: Session[] = sessions.map(liveSession => {
        if (!liveSession) return liveSession;

        // 1. Direct ID match
        let matchedSource = sourceById.get(liveSession.id);

        // 2. Base UID + Date match
        if (!matchedSource && liveSession.id.startsWith('ics_')) {
          const base = extractBaseUid(liveSession.id);
          if (base && liveSession.date) {
            matchedSource = sourceByUidDate.get(`${base}_${liveSession.date}`);
          }
        }

        // 3. Fallback: Normalized Client + Date + Time match
        if (!matchedSource) {
          const norm = getNormalizedClientName(liveSession.clientName);
          if (norm && liveSession.date && liveSession.time) {
            matchedSource = sourceByClientDateTime.get(`${norm}_${liveSession.date}_${liveSession.time}`);
          }
        }

        if (matchedSource) {
          matchedCount++;
          const updated: Session = { ...liveSession };
          let changed = false;

          // Merge Price
          if (matchedSource.price && matchedSource.price > 0) {
            updated.price = matchedSource.price;
            pricesRestored++;
            changed = true;
          }

          // Merge Babysitter
          if (matchedSource.hasBabysitterFee) {
            updated.hasBabysitterFee = true;
            updated.babysitterFeeAmount = matchedSource.babysitterFeeAmount || settings.defaultBabysitterFee || 250;
            babysitterRestored++;
            changed = true;
          }

          // Merge Office Rent
          if (matchedSource.hasOfficeRentFee) {
            updated.hasOfficeRentFee = true;
            updated.officeRentFeeAmount = matchedSource.officeRentFeeAmount || settings.defaultOfficeRentFee || 200;
            officeRestored++;
            changed = true;
          }

          // Merge Payment Record
          if (matchedSource.paymentStatus === 'paid' || matchedSource.paymentStatus === 'partial' || (Number(matchedSource.paidAmount) || 0) > 0) {
            updated.paymentStatus = matchedSource.paymentStatus;
            updated.paidAmount = matchedSource.paidAmount;
            updated.paymentMethod = matchedSource.paymentMethod;
            paymentsRestored++;
            changed = true;
          }

          // Merge manual edit flag and notes
          if (matchedSource.notes && !updated.notes) {
            updated.notes = matchedSource.notes;
          }
          if (matchedSource.roomId && !updated.roomId) {
            updated.roomId = matchedSource.roomId;
          }

          if (changed) {
            updated.isManuallyEdited = true;
            updated.updatedAt = Date.now();
          }

          return updated;
        }

        return liveSession;
      });

      setReconcileResult({
        matchedCount,
        pricesRestored,
        babysitterRestored,
        officeRestored,
        paymentsRestored
      });

      await onApplyRules(mergedSessions, settings);
      setSaveSuccessMessage(`${sourceLabel} kaynağından ${matchedCount} seans benzersiz ID ile eşleştirildi ve tüm muhasebe kayıtları seanslara geri yüklendi!`);
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    } catch (err: any) {
      alert('Eşleştirme ve geri yükleme sırasında hata oluştu: ' + (err?.message || err));
    } finally {
      setIsSaving(false);
    }
  };

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
          newOnlinePrice: val,
          newFaceToFacePrice: val,
          isModified: true
        }
      };
    });
  };

  const handleOnlinePriceChange = (norm: string, val: number) => {
    setClientStates(prev => {
      const current = prev[norm] || clientRows.find(r => r.normalizedName === norm);
      if (!current) return prev;
      return {
        ...prev,
        [norm]: {
          ...current,
          newOnlinePrice: val,
          isModified: true
        }
      };
    });
  };

  const handleFaceToFacePriceChange = (norm: string, val: number) => {
    setClientStates(prev => {
      const current = prev[norm] || clientRows.find(r => r.normalizedName === norm);
      if (!current) return prev;
      return {
        ...prev,
        [norm]: {
          ...current,
          newFaceToFacePrice: val,
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
          onlinePrice: row.newOnlinePrice,
          faceToFacePrice: row.newFaceToFacePrice,
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
            onlinePrice: row.newOnlinePrice,
            faceToFacePrice: row.newFaceToFacePrice,
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
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('clients')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'clients'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            Danışan Fiyat Listesi ({clientRows.length})
          </button>
          <button
            onClick={() => setActiveTab('reconcile')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'reconcile'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <GitMerge className="w-4 h-4 text-emerald-600" />
            <span>ID ile Akıllı Muhasebe Eşitleme</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold">1-Tıkla Aktar</span>
          </button>
          <button
            onClick={() => setActiveTab('snapshots')}
            className={`pb-3 px-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'snapshots'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-4 h-4" />
            Zaman Yolculuğu ({snapshots.length})
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
                                <div className="space-y-1.5">
                                  {row.onlineCount > 0 && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-semibold text-sky-700 w-14 shrink-0 flex items-center gap-0.5">🌐 Online:</span>
                                      <span className="text-xs text-slate-400">₺</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="50"
                                        value={state.newOnlinePrice}
                                        onChange={e => handleOnlinePriceChange(row.normalizedName, Number(e.target.value) || 0)}
                                        className="w-24 px-2 py-1 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                      />
                                    </div>
                                  )}
                                  {row.faceToFaceCount > 0 && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-semibold text-emerald-700 w-14 shrink-0 flex items-center gap-0.5">🏢 Yüzyüze:</span>
                                      <span className="text-xs text-slate-400">₺</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="50"
                                        value={state.newFaceToFacePrice}
                                        onChange={e => handleFaceToFacePriceChange(row.normalizedName, Number(e.target.value) || 0)}
                                        className="w-24 px-2 py-1 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                      />
                                    </div>
                                  )}
                                  {row.onlineCount === 0 && row.faceToFaceCount === 0 && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs text-slate-400">₺</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="50"
                                        value={state.newPrice}
                                        onChange={e => handlePriceChange(row.normalizedName, Number(e.target.value) || 0)}
                                        className="w-24 px-2 py-1 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                      />
                                    </div>
                                  )}
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

          {activeTab === 'reconcile' && (
            <div className="space-y-4">
              {/* Info Header */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-950 text-xs flex items-start gap-3">
                <GitMerge className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-sm text-emerald-900">
                    Benzersiz ID Tabanlı Akıllı Muhasebe Eşitleme (Deterministic Reconciliation)
                  </p>
                  <p className="text-emerald-800 leading-relaxed">
                    Takvimden eşitlenen her bir seansın benzersiz bir kimliği (<strong>ID</strong>) bulunur. 
                    Bu araç; yedek noktasında veya yedek dosyasında kullanıcının önceden elle girdiği 
                    <strong> Seans Ücreti</strong>, <strong>Bakıcı Gideri</strong>, <strong>Ofis Payı</strong>, 
                    <strong> Ödeme Durumu (Ödendi/Ödenmedi)</strong> ve <strong>Özel Notları</strong> tespit eder; 
                    canlı seansların ID'leriyle birebir eşleştirerek tüm muhasebe girişlerini eksiksiz şekilde seanslara geri yükler.
                  </p>
                </div>
              </div>

              {/* Source Selection Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  Kaynak Yedek Seçimi
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* System Snapshots */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                    <label className="block text-xs font-bold text-slate-700">
                      1. Sistem Yedek Noktalarından Seç ({snapshots.length} Kayıtlı)
                    </label>
                    {snapshots.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Sistemde kayıtlı yedek noktası bulunamadı.</p>
                    ) : (
                      <div className="space-y-2">
                        <select
                          value={selectedSnapshotId}
                          onChange={e => setSelectedSnapshotId(e.target.value)}
                          className="w-full text-xs py-2 px-3 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-emerald-500"
                        >
                          {snapshots.map(s => (
                            <option key={s.id} value={s.id}>
                              {new Date(s.timestamp).toLocaleString('tr-TR')} - {s.label} ({s.sessionCount} Seans)
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const snap = snapshots.find(s => s.id === selectedSnapshotId);
                          if (!snap) return null;
                          return (
                            <button
                              onClick={() => handleReconcileFromSource(snap.sessions, snap.label)}
                              disabled={isSaving}
                              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
                            >
                              <GitMerge className="w-4 h-4" />
                              {isSaving ? 'Eşleştiriliyor...' : 'Bu Yedeğin Muhasebe Kayıtlarını ID ile Eşitle'}
                            </button>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Upload Backup JSON */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                    <label className="block text-xs font-bold text-slate-700">
                      2. Bilgisayardan Yedek Dosyası (.json) Yükle
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200 cursor-pointer"
                      />
                    </div>
                    {uploadedBackupSessions && uploadedBackupSessions.length > 0 && (
                      <div className="pt-2">
                        <span className="text-xs text-emerald-700 font-medium block mb-2">
                          ✅ {uploadedBackupSessions.length} seans içeren dosya hazır.
                        </span>
                        <button
                          onClick={() => handleReconcileFromSource(uploadedBackupSessions, 'Yüklenen Dosya')}
                          disabled={isSaving}
                          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
                        >
                          <GitMerge className="w-4 h-4" />
                          {isSaving ? 'Eşleştiriliyor...' : 'Dosyadaki Tüm Fiyat & Masrafları ID ile Eşitle'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Reconciliation Results Stat Box */}
              {reconcileResult && (
                <div className="bg-white rounded-xl border border-emerald-200 p-5 shadow-sm space-y-3 animate-in fade-in">
                  <h4 className="font-bold text-emerald-800 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Son Eşleştirme Raporu
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <div className="text-xl font-bold text-emerald-700">{reconcileResult.matchedCount}</div>
                      <div className="text-[11px] text-emerald-600 mt-0.5 font-medium">Eşleşen Seans (ID)</div>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="text-xl font-bold text-blue-700">{reconcileResult.pricesRestored}</div>
                      <div className="text-[11px] text-blue-600 mt-0.5 font-medium">Aktarılan Ücret</div>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <div className="text-xl font-bold text-amber-700">{reconcileResult.babysitterRestored}</div>
                      <div className="text-[11px] text-amber-600 mt-0.5 font-medium">Aktarılan Bakıcı Payı</div>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                      <div className="text-xl font-bold text-purple-700">{reconcileResult.officeRestored}</div>
                      <div className="text-[11px] text-purple-600 mt-0.5 font-medium">Aktarılan Ofis Payı</div>
                    </div>
                    <div className="p-3 bg-teal-50 rounded-xl border border-teal-100">
                      <div className="text-xl font-bold text-teal-700">{reconcileResult.paymentsRestored}</div>
                      <div className="text-[11px] text-teal-600 mt-0.5 font-medium">Aktarılan Ödeme Durumu</div>
                    </div>
                  </div>
                </div>
              )}
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
