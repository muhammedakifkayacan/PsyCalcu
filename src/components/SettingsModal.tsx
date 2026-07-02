import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Save, Landmark, Baby, User, Trash2 } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClearAllSessions: () => void;
}

export default function SettingsModal({ isOpen, onClose, settings, onSave, onClearAllSessions }: SettingsModalProps) {
  const [therapistName, setTherapistName] = useState(settings.therapistName);
  const [defaultSessionPrice, setDefaultSessionPrice] = useState(settings.defaultSessionPrice);
  const [defaultBabysitterFee, setDefaultBabysitterFee] = useState(settings.defaultBabysitterFee);
  const [defaultOfficeRentFee, setDefaultOfficeRentFee] = useState(settings.defaultOfficeRentFee);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTherapistName(settings.therapistName);
      setDefaultSessionPrice(settings.defaultSessionPrice);
      setDefaultBabysitterFee(settings.defaultBabysitterFee);
      setDefaultOfficeRentFee(settings.defaultOfficeRentFee);
      setShowConfirm(false);
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
                className="w-full pl-10 pr-4 py-2 text-sm bg-[#fdfbf7] border border-[#e5e1d8] rounded-2xl focus:outline-none focus:border-[#6b705c]"
                placeholder="Örn. Dr. Melis Kaya"
              />
            </div>
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
                value={defaultSessionPrice}
                onChange={(e) => setDefaultSessionPrice(Number(e.target.value))}
                className="w-full pl-8 pr-4 py-2 text-sm bg-[#fdfbf7] border border-[#e5e1d8] rounded-2xl focus:outline-none focus:border-[#6b705c]"
              />
            </div>
            <p className="text-[10px] text-slate-600 font-medium">Yeni oluşturulan veya içe aktarılan seanslar için başlangıç fiyatı.</p>
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
                value={defaultBabysitterFee}
                onChange={(e) => setDefaultBabysitterFee(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-2 text-sm bg-[#fdfbf7] border border-[#e5e1d8] rounded-2xl focus:outline-none focus:border-[#6b705c]"
              />
            </div>
            <p className="text-[10px] text-slate-600 font-medium">Seans süresince çocuğa bakan bakıcıya seans başı verilen sabit ücret.</p>
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
                value={defaultOfficeRentFee}
                onChange={(e) => setDefaultOfficeRentFee(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-2 text-sm bg-[#fdfbf7] border border-[#e5e1d8] rounded-2xl focus:outline-none focus:border-[#6b705c]"
              />
            </div>
            <p className="text-[10px] text-slate-600 font-medium">Yüzyüze seansların yapıldığı ofis için ödenecek seans başı kira payı.</p>
          </div>

          {/* Tip */}
          <div className="bg-[#f5f5f0] p-4 rounded-2xl border border-[#e5e1d8]/60 flex gap-3 items-start">
            <ShieldAlert className="w-5 h-5 text-[#cb997e] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-slate-700 font-sans">Otomatik Hesaplama Algoritması</h4>
              <p className="text-[10px] text-slate-600 leading-relaxed font-sans font-medium">
                Uygulama, seans gelirlerinizden seans başı bakıcı ücretini otomatik düşer. Yüzyüze seanslarda ise ek olarak seans başı ofis kira gideri de düşülerek net kârınız anlık hesaplanır. Online seanslarda ofis kirası kesilmez.
              </p>
            </div>
          </div>

          {/* Danger Zone */}
          {showConfirm ? (
            <div className="bg-red-50 p-4 rounded-2xl border border-red-100 space-y-3">
              <div className="flex gap-2.5 items-start">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-red-950 font-sans">Kalıcı Olarak Silinecek!</h4>
                  <p className="text-[10px] text-red-700 leading-relaxed font-sans">
                    DİKKAT: Tüm seans verileriniz kalıcı olarak silinecektir! Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClearAllSessions();
                    onClose();
                    setShowConfirm(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-semibold transition-colors cursor-pointer"
                >
                  Evet, Tümünü Sil
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#fff5f5] p-4 rounded-2xl border border-red-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="space-y-0.5 text-center sm:text-left">
                <h4 className="text-xs font-bold text-red-800 font-sans">Veri Temizleme & Sıfırlama</h4>
                <p className="text-[10px] text-red-600 font-sans">
                  Tüm mevcut seans verilerinizi siler ve boş bir takvim sayfası açar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                className="px-3.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 hover:text-red-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Tüm Verileri Temizle
              </button>
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
    </div>
  );
}
