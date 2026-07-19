import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Save, Landmark, Baby, User, Sparkles, Lock, AlertTriangle, ChevronDown, Building } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  showExplanations: boolean;
  onToggleExplanations: () => void;
  featuresSmartPriceMatchingAllowed?: boolean;
}

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  settings, 
  onSave, 
  showExplanations,
  onToggleExplanations,
  featuresSmartPriceMatchingAllowed = true
}: SettingsModalProps) {
  const [therapistName, setTherapistName] = useState(settings.therapistName);
  const [defaultSessionPrice, setDefaultSessionPrice] = useState<number | string>(settings.defaultSessionPrice);
  const [defaultBabysitterFee, setDefaultBabysitterFee] = useState<number | string>(settings.defaultBabysitterFee);
  const [defaultOfficeRentFee, setDefaultOfficeRentFee] = useState<number | string>(settings.defaultOfficeRentFee);
  const [enableSmartClientPriceMatching, setEnableSmartClientPriceMatching] = useState(settings.enableSmartClientPriceMatching ?? false);
  const [defaultLandingPage, setDefaultLandingPage] = useState<'agenda' | 'stats' | 'sync' | 'backup' | 'debts' | 'search'>(settings.defaultLandingPage || 'agenda');
  const [userRole, setUserRole] = useState<'tenant' | 'owner' | undefined>(settings.userRole);

  const [pendingSmartPriceToggle, setPendingSmartPriceToggle] = useState<boolean | null>(null);
  const [confirmCountdown, setConfirmCountdown] = useState(5);

  useEffect(() => {
    let interval: any = null;
    if (pendingSmartPriceToggle !== null && confirmCountdown > 0) {
      interval = setInterval(() => {
        setConfirmCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pendingSmartPriceToggle, confirmCountdown]);

  useEffect(() => {
    if (isOpen) {
      setTherapistName(settings.therapistName);
      setDefaultSessionPrice(settings.defaultSessionPrice);
      setDefaultBabysitterFee(settings.defaultBabysitterFee);
      setDefaultOfficeRentFee(settings.defaultOfficeRentFee);
      setEnableSmartClientPriceMatching(settings.enableSmartClientPriceMatching ?? false);
      setDefaultLandingPage(settings.defaultLandingPage || 'agenda');
      setUserRole(settings.userRole);
      setPendingSmartPriceToggle(null);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...settings,
      therapistName,
      defaultSessionPrice: Number(defaultSessionPrice),
      defaultBabysitterFee: Number(defaultBabysitterFee),
      defaultOfficeRentFee: Number(defaultOfficeRentFee),
      enableSmartClientPriceMatching,
      defaultLandingPage,
      userRole,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" id="settings-modal-overlay">
      <div 
        className="w-full max-w-md bg-white rounded-[2rem] border border-[#e5e1d8] overflow-hidden shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh]"
        id="settings-modal-content"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#f5f5f0] flex justify-between items-center bg-[#fdfbf7]">
          <div>
            <h3 className="text-lg font-serif text-[#6b705c] italic">Finansal Parametreler</h3>
            <p className="text-xs text-slate-600 font-sans font-medium">Varsayılan muhasebe ayarlarını düzenleyin</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f0] hover:bg-[#e5e5df] text-[#6b705c] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1 overflow-y-auto font-sans">
          {/* Therapist Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#555a4a] uppercase tracking-wider block">Psikolog Adı</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-[#a5a58d]" />
              <input
                type="text"
                required
                value={therapistName}
                onChange={(e) => setTherapistName(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-base sm:text-sm bg-[#fdfbf7] border border-[#e5e1d8] rounded-2xl focus:outline-none focus:border-[#6b705c]"
                placeholder="Örn. Dr. Melis Kaya"
              />
            </div>
          </div>

          {/* User Role Display (Read-Only) */}
          <div className="space-y-1.5 pb-1">
            <label className="text-xs font-bold text-[#555a4a] uppercase tracking-wider block">Uygulama Rolünüz</label>
            <div className="flex items-center gap-3 px-4 py-3 bg-[#fdfbf7] border border-[#e5e1d8] rounded-2xl relative overflow-hidden group">
              {userRole === 'owner' ? (
                <>
                  <div className="w-8 h-8 rounded-xl bg-[#6b705c]/10 text-[#6b705c] flex items-center justify-center shrink-0">
                    <Building className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-[#6b705c] leading-tight flex items-center gap-1">
                      Ofis Sahibi (Mülk Sahibi)
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-normal mt-0.5">Rolünüz yönetici tarafından tanımlanmıştır ve değiştirilemez.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-xl bg-[#cb997e]/10 text-[#cb997e] flex items-center justify-center shrink-0">
                    <User className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-[#cb997e] leading-tight flex items-center gap-1">
                      Ofis Kiralayan (Terapist)
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-normal mt-0.5">Rolünüz yönetici tarafından tanımlanmıştır ve değiştirilemez.</p>
                  </div>
                </>
              )}
            </div>
            {showExplanations && (
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed px-1">
                {userRole === 'owner' 
                  ? 'Mülk sahibi yetkilerinizle çoklu takvim entegrasyonu yapabilir ve kira gelirlerinizi listeleyebilirsiniz.'
                  : 'Terapist yetkilerinizle seanslarınızı, seans başı bakıcı/kira giderlerinizi ve borçlarınızı takip edebilirsiniz.'}
              </p>
            )}
          </div>

          {/* Session Price */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#555a4a] uppercase tracking-wider block">Varsayılan Seans Ücreti (₺)</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm font-bold text-[#a5a58d]">₺</span>
              <input
                type="number"
                required
                min="0"
                value={defaultSessionPrice === 0 ? '' : defaultSessionPrice}
                onChange={(e) => {
                  const val = e.target.value;
                  setDefaultSessionPrice(val === '' ? '' : Number(val));
                }}
                onFocus={(e) => e.target.select()}
                className="w-full pl-8 pr-4 py-2 text-base sm:text-sm bg-[#fdfbf7] border border-[#e5e1d8] rounded-2xl focus:outline-none focus:border-[#6b705c]"
              />
            </div>
            {showExplanations && (
              <p className="text-[10px] text-slate-600 font-medium animate-fade-in">Yeni oluşturulan veya içe aktarılan seanslar için başlangıç fiyatı.</p>
            )}
          </div>

          {/* Babysitter Fee */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#555a4a] uppercase tracking-wider block">Seans Başı Bakıcı Ücreti (₺)</label>
            <div className="relative">
              <Baby className="absolute left-3 top-2.5 w-4 h-4 text-[#a5a58d]" />
              <input
                type="number"
                required
                min="0"
                value={defaultBabysitterFee === 0 ? '' : defaultBabysitterFee}
                onChange={(e) => {
                  const val = e.target.value;
                  setDefaultBabysitterFee(val === '' ? '' : Number(val));
                }}
                onFocus={(e) => e.target.select()}
                className="w-full pl-10 pr-4 py-2 text-base sm:text-sm bg-[#fdfbf7] border border-[#e5e1d8] rounded-2xl focus:outline-none focus:border-[#6b705c]"
              />
            </div>
            {showExplanations && (
              <p className="text-[10px] text-slate-600 font-medium animate-fade-in">Seans süresince çocuğa bakan bakıcıya seans başı verilen sabit ücret.</p>
            )}
          </div>

          {/* Office Rent Fee */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#555a4a] uppercase tracking-wider block">Seans Başı Ofis Kira Gideri (₺)</label>
            <div className="relative">
              <Landmark className="absolute left-3 top-2.5 w-4 h-4 text-[#a5a58d]" />
              <input
                type="number"
                required
                min="0"
                value={defaultOfficeRentFee === 0 ? '' : defaultOfficeRentFee}
                onChange={(e) => {
                  const val = e.target.value;
                  setDefaultOfficeRentFee(val === '' ? '' : Number(val));
                }}
                onFocus={(e) => e.target.select()}
                className="w-full pl-10 pr-4 py-2 text-base sm:text-sm bg-[#fdfbf7] border border-[#e5e1d8] rounded-2xl focus:outline-none focus:border-[#6b705c]"
              />
            </div>
            {showExplanations && (
              <p className="text-[10px] text-slate-600 font-medium animate-fade-in">Yüzyüze seansların yapıldığı ofis için ödenecek seans başı kira payı.</p>
            )}
          </div>

          {/* Smart Client Price Matching Toggle */}
          <div className="space-y-1">
            <div className={`flex items-center justify-between p-3.5 rounded-2xl border transition-colors ${
              !featuresSmartPriceMatchingAllowed ? 'border-rose-100 bg-rose-50/10' : 'border-[#e5e1d8] bg-[#fdfbf7]'
            }`}>
              <div className="space-y-0.5 max-w-[75%]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Sparkles className="w-3.5 h-3.5 text-[#cb997e]" />
                  <label className="text-xs font-bold text-[#555a4a] uppercase tracking-wider block">Akıllı Fiyat Eşitleme</label>
                  {!featuresSmartPriceMatchingAllowed && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-bold bg-rose-50 text-rose-500 uppercase tracking-wide">
                      <Lock className="w-2 h-2" /> Sınırlandırıldı
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Aynı danışanın farklı varyasyon seanslarında (örn. Zuhal Şen 1, Zuhal Şen 2) son girilen zamlı fiyatı ileri tarihli seanslara otomatik uygular.
                </p>
                {!featuresSmartPriceMatchingAllowed && (
                  <p className="text-[9px] text-rose-500 font-medium mt-1">
                    Bu özellik yöneticiniz tarafından sınırlandırılmıştır.
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={!featuresSmartPriceMatchingAllowed}
                onClick={() => {
                  if (featuresSmartPriceMatchingAllowed) {
                    setPendingSmartPriceToggle(!enableSmartClientPriceMatching);
                    setConfirmCountdown(5);
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  !featuresSmartPriceMatchingAllowed ? 'bg-slate-100 cursor-not-allowed opacity-60' :
                  enableSmartClientPriceMatching ? 'bg-[#6b705c] cursor-pointer' : 'bg-slate-200 cursor-pointer'
                }`}
                role="switch"
                aria-checked={enableSmartClientPriceMatching}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                    enableSmartClientPriceMatching && featuresSmartPriceMatchingAllowed ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Default Landing Page Option */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#555a4a] uppercase tracking-wider block">Açılış Sekmesi</label>
            <div className="relative">
              <select
                value={defaultLandingPage}
                onChange={(e) => setDefaultLandingPage(e.target.value as any)}
                className="w-full pl-4 pr-10 py-2.5 text-xs sm:text-sm bg-[#fdfbf7] border border-[#e5e1d8] rounded-2xl focus:outline-none focus:border-[#6b705c] appearance-none cursor-pointer font-semibold text-slate-700"
              >
                <option value="agenda">📅 Ajanda / Takvim</option>
                <option value="stats">📊 Analiz & İstatistikler</option>
                <option value="debts">💸 Borç Takip</option>
                <option value="sync">🔄 Takvim Senkronizasyonu</option>
                <option value="backup">💾 Veri Yedekleme</option>
                <option value="search">🔍 Gelişmiş Arama</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
            {showExplanations && (
              <p className="text-[10px] text-slate-600 font-medium animate-fade-in">
                Uygulama ilk açıldığında sizi otomatik karşılayacak ana sekme.
              </p>
            )}
          </div>

          {/* Toggle Explanations Switch */}
          <div className="space-y-1">
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[#e5e1d8] bg-[#fdfbf7]">
              <div className="space-y-0.5 max-w-[75%]">
                <label className="text-xs font-bold text-[#555a4a] uppercase tracking-wider block">Yardımcı Açıklamaları Göster</label>
                <p className="text-[10px] text-slate-500 leading-tight">Arayüzdeki rehber, uyarı ve bilgilendirici metinleri gösterir.</p>
              </div>
              <button
                type="button"
                onClick={onToggleExplanations}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  showExplanations ? 'bg-[#6b705c]' : 'bg-slate-200'
                }`}
                role="switch"
                aria-checked={showExplanations}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                    showExplanations ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Tip */}
          {showExplanations && (
            <div className="bg-[#f5f5f0] p-4 rounded-2xl border border-[#e5e1d8]/60 flex gap-3 items-start animate-fade-in">
              <ShieldAlert className="w-5 h-5 text-[#cb997e] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-slate-700 font-sans">Otomatik Hesaplama Algoritması</h4>
                <p className="text-[10px] text-slate-600 leading-relaxed font-sans font-medium">
                  Uygulama, seans gelirlerinizden seans başı bakıcı ücretini otomatik düşer. Yüzyüze seanslarda ise ek olarak seans başı ofis kira gideri de düşülerek net kârınız anlık hesaplanır. Online seanslarda ofis kirası kesilmez.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-[#f5f5f0] flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[#e5e1d8] hover:bg-[#f5f5f0] text-xs font-semibold text-[#6b705c] transition-colors cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full bg-[#6b705c] hover:bg-[#585c4c] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Ayarları Kaydet
            </button>
          </div>
        </form>
      </div>

      {pendingSmartPriceToggle !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in" id="smart-price-confirm-overlay">
          <div className="w-full max-w-sm bg-[#fdfbf7] rounded-3xl border border-[#e5e1d8] overflow-hidden shadow-2xl p-6 space-y-4 font-sans text-slate-800">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2 bg-amber-50 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-[#cb997e]" />
              </div>
              <h4 className="font-serif text-base font-bold text-[#6b705c] italic">
                {pendingSmartPriceToggle ? 'Akıllı Fiyat Eşitleme Aktif Edilsin mi?' : 'Akıllı Fiyat Eşitleme Kapatılsın mı?'}
              </h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {pendingSmartPriceToggle ? (
                <>
                  Bu özelliği açmak istediğinize emin misiniz? <strong className="text-[#cb997e]">Bu tarihten sonra yaptığınız fiyat değişiklikleri</strong>, aynı danışanın ileri seanslarına otomatik olarak uygulanacaktır.
                </>
              ) : (
                <>
                  Bu özelliği kapatmak istediğinize emin misiniz? <strong className="text-rose-500">Bundan sonra yapacağınız fiyat değişiklikleri</strong> ileri seansları otomatik olarak etkilemeyecektir. <strong className="text-[#6b705c]">Geçmişteki düzenlemeler ise aynen kalacaktır.</strong>
                </>
              )}
            </p>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setPendingSmartPriceToggle(null)}
                className="px-4 py-2 rounded-full border border-[#e5e1d8] hover:bg-[#f5f5f0] text-xs font-semibold text-[#6b705c] transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={confirmCountdown > 0}
                onClick={() => {
                  setEnableSmartClientPriceMatching(pendingSmartPriceToggle);
                  setPendingSmartPriceToggle(null);
                }}
                className={`px-5 py-2 rounded-full text-white text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  confirmCountdown > 0 
                    ? 'bg-slate-300 cursor-not-allowed text-slate-500' 
                    : 'bg-[#6b705c] hover:bg-[#585c4c] cursor-pointer'
                }`}
              >
                {confirmCountdown > 0 ? (
                  <span>Onayla ({confirmCountdown}s)</span>
                ) : (
                  <span>Onayla</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
