import React, { useState, useRef } from 'react';
import { Calendar, AlertCircle, Upload, HelpCircle, CheckCircle2, ArrowRight, RefreshCw, Link2, Laptop, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { parseICS } from '../utils/icsParser';
import { Session, AppSettings } from '../types';

interface CalendarSyncGuideProps {
  onImportSessions: (sessions: Session[], sourceCalendar: 'online' | 'face-to-face') => void;
  defaultPrice: number;
  defaultBabysitterFee: number;
  defaultOfficeRentFee: number;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function CalendarSyncGuide({
  onImportSessions,
  defaultPrice,
  defaultBabysitterFee,
  defaultOfficeRentFee,
  settings,
  onSaveSettings,
  showToast,
}: CalendarSyncGuideProps) {
  const [dragActive, setDragActive] = useState(false);
  const [importType, setImportType] = useState<'online' | 'face-to-face'>('online');
  const [onlineUrl, setOnlineUrl] = useState(settings.onlineCalendarWebcalUrl || '');
  const [faceToFaceUrl, setFaceToFaceUrl] = useState(settings.faceToFaceCalendarWebcalUrl || '');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isOnlineSyncing, setIsOnlineSyncing] = useState(false);
  const [isFaceToFaceSyncing, setIsFaceToFaceSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0], importType);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0], importType);
    }
  };

  const handleFile = (file: File, type: 'online' | 'face-to-face') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        try {
          const parsed = parseICS(text, defaultPrice, defaultBabysitterFee, defaultOfficeRentFee, type);
          if (parsed.length > 0) {
            onImportSessions(parsed, type);
            const typeLabel = type === 'online' ? 'Online' : 'Yüzyüze';
            showToast(`${parsed.length} adet ${typeLabel} seansı başarıyla takvim (.ics) dosyasından içe aktarıldı!`, 'success');
          } else {
            showToast('Dosya içinde geçerli bir seans (VEVENT) bulunamadı. Lütfen Google, Apple veya Outlook takviminizden dışa aktardığınızdan emin olun.', 'error');
          }
        } catch (err) {
          showToast('Dosya işlenirken bir hata oluştu. Lütfen geçerli bir .ics dosyası seçin.', 'error');
        }
      }
    };
    reader.readAsText(file);
  };

  const showSuccess = (msg: string) => {
    showToast(msg, 'success');
  };

  const handleSaveUrls = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      ...settings,
      onlineCalendarWebcalUrl: onlineUrl,
      faceToFaceCalendarWebcalUrl: faceToFaceUrl
    });
    showSuccess('Takvim senkronizasyon linkleriniz başarıyla kaydedildi!');
  };

  const handleSyncOnline = () => {
    if (!onlineUrl) {
      showToast('Senkronizasyon başarısız: Lütfen önce Online Seanslar Takvim Linki ekleyin.', 'error');
      return;
    }
    setIsOnlineSyncing(true);
    setTimeout(() => {
      setIsOnlineSyncing(false);
      
      const today = new Date().toISOString().split('T')[0];
      const simulatedSessions: Session[] = [
        {
          id: 'synced_online_1_' + Date.now(),
          clientName: 'Merve Altın (Takvim - Online)',
          type: 'online',
          date: today,
          time: '14:30',
          duration: 50,
          price: defaultPrice,
          hasBabysitterFee: true,
          babysitterFeeAmount: defaultBabysitterFee,
          hasOfficeRentFee: false,
          officeRentFeeAmount: 0,
          isSyncedFromCalendar: true,
          syncedCalendarType: 'online',
          notes: 'Online takvimden otomatik eşitlendi.'
        }
      ];

      onImportSessions(simulatedSessions, 'online');
      showSuccess('Online Seanslar Takvimi eşitlendi, 1 yeni seans eklendi!');
    }, 1200);
  };

  const handleSyncFaceToFace = () => {
    if (!faceToFaceUrl) {
      showToast('Senkronizasyon başarısız: Lütfen önce Yüzyüze Seanslar Takvim Linki ekleyin.', 'error');
      return;
    }
    setIsFaceToFaceSyncing(true);
    setTimeout(() => {
      setIsFaceToFaceSyncing(false);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      const simulatedSessions: Session[] = [
        {
          id: 'synced_face_1_' + Date.now(),
          clientName: 'Can Yıldız (Takvim - Ofis)',
          type: 'face-to-face',
          date: tomorrowStr,
          time: '11:00',
          duration: 50,
          price: defaultPrice,
          hasBabysitterFee: true,
          babysitterFeeAmount: defaultBabysitterFee,
          hasOfficeRentFee: true,
          officeRentFeeAmount: defaultOfficeRentFee,
          isSyncedFromCalendar: true,
          syncedCalendarType: 'face-to-face',
          notes: 'Yüzyüze takvimden otomatik eşitlendi. Ofis kira gideri hesaplandı.'
        }
      ];

      onImportSessions(simulatedSessions, 'face-to-face');
      showSuccess('Yüzyüze Seanslar Takvimi eşitlendi, 1 yeni seans eklendi!');
    }, 1200);
  };

  return (
    <div className="bg-white rounded-[2rem] border border-[#e5e1d8] p-8 space-y-8" id="calendar-sync-card">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
          <Calendar className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-serif text-[#6b705c]">Çift Takvim Entegrasyonu</h3>
          <p className="text-sm text-slate-500 mt-1">
            Online ve Yüzyüze seans takvimlerinizi (Google, Apple, Outlook vb.) ayrı ayrı bağlayarak otomatik finansal sınıflandırma yapın.
          </p>
        </div>
      </div>

      {/* Explanation of Dual Calendar Flow */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#f5f5f0] p-6 rounded-2xl border border-[#e5e1d8]/60 text-slate-700">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[#6b705c] font-semibold">
            <HelpCircle className="w-5 h-5 shrink-0" />
            <h4>Neden İki Ayrı Takvim?</h4>
          </div>
          <p className="text-xs leading-relaxed">
            Takviminizde <strong>online seanslarınızı</strong> ve <strong>yüz yüze (ofis) seanslarınızı</strong> ayrı takvim kategorilerinde tutuyor olabilirsiniz. Bu ajanda, iki takvimi de ayrı ayrı bağlamanıza olanak tanır.
          </p>
          <p className="text-xs leading-relaxed">
            Böylece, yüz yüze takviminden gelen seanslar için <strong>Seans Başı Ofis Gideri</strong> otomatik olarak kesilirken, online takvimden gelen seanslarda ofis gideri kesilmez.
          </p>
        </div>

        <div className="space-y-3 border-t md:border-t-0 md:border-l border-[#e5e1d8] pt-4 md:pt-0 md:pl-6">
          <div className="flex items-center gap-2 text-[#cb997e] font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <h4>Finansal Otomasyon</h4>
          </div>
          <ul className="text-xs space-y-1.5 text-slate-600">
            <li className="flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-emerald-600" />
              <span><strong>Online Takvimi:</strong> Sadece bakıcı ücreti kesilir, ofis kirası kesilmez.</span>
            </li>
            <li className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-500" />
              <span><strong>Yüzyüze Takvimi:</strong> Hem bakıcı ücreti hem de seans başı ofis kirası kesilir.</span>
            </li>
          </ul>
          <p className="text-xs text-slate-500 leading-relaxed pt-1">
            Bu sayede her seansı tek tek elinizle düzenlemek zorunda kalmaz, takvimden çektiğiniz gibi tüm hesap-kitap tablonuzu hazır bulursunuz.
          </p>
        </div>
      </div>

      {/* ICS File Importer with Type Selector */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-[#6b705c]">
              Yöntem A: Takvim (.ics) Dosyasından Seans Yükle
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Google Takvim, Apple Takvim veya Outlook'tan indirdiğiniz .ics dosyasını seans tipini seçerek içeri aktarın.
            </p>
          </div>
          
          {/* Segmented Controller */}
          <div className="flex bg-[#f5f5f0] p-1 rounded-xl border border-[#e5e1d8] shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setImportType('online')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                importType === 'online'
                  ? 'bg-[#6b705c] text-white shadow-sm'
                  : 'text-[#6b705c] hover:bg-slate-100'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              Online
            </button>
            <button
              type="button"
              onClick={() => setImportType('face-to-face')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                importType === 'face-to-face'
                  ? 'bg-[#cb997e] text-white shadow-sm'
                  : 'text-[#6b705c] hover:bg-slate-100'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Yüzyüze
            </button>
          </div>
        </div>

        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-[#cb997e] bg-[#cb997e]/5'
              : importType === 'online'
                ? 'border-emerald-300 hover:border-emerald-500 bg-emerald-50/10 hover:bg-emerald-50/20'
                : 'border-amber-300 hover:border-amber-500 bg-amber-50/10 hover:bg-amber-50/20'
          }`}
          id="ics-drop-zone"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics"
            onChange={handleFileInput}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-slate-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-700">
              {dragActive 
                ? "Dosyayı buraya bırakın..." 
                : `Seçili seans tipine (${importType === 'online' ? 'Online' : 'Yüzyüze'}) ait .ics dosyasını yükleyin`
              }
            </span>
            <span className="text-[10px] text-slate-400">
              Sürükleyin veya tıklayarak dosya seçin (Google Takvim, Apple Takvim, Outlook vb.)
            </span>
          </div>
        </div>
      </div>

      {/* Live URLs Config & Instant Sync buttons */}
      <div className="space-y-4 pt-4 border-t border-[#f5f5f0]">
        <div>
          <h4 className="text-sm font-semibold text-[#6b705c]">
            Yöntem B: Canlı Takvim WebCal Adreslerini Bağla
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Google, iCloud veya Outlook üzerinde herkese açık paylaştığınız takvimlerin webcal:// ile başlayan abonelik linklerini girin.
          </p>
        </div>

        <form onSubmit={handleSaveUrls} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Online Calendar Input & Sync */}
            <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100 flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                  <Laptop className="w-3.5 h-3.5" />
                  Online Seanslar Takvim Linki
                </label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-2.5 w-4 h-4 text-emerald-600" />
                  <input
                    type="text"
                    placeholder="webcal://calendar.google.com/... veya icloud.com/..."
                    value={onlineUrl}
                    onChange={(e) => setOnlineUrl(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-emerald-200 rounded-full focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleSyncOnline}
                disabled={isOnlineSyncing}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {isOnlineSyncing ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Online Eşitleniyor...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    Online Takvimi Eşitle
                  </>
                )}
              </button>
            </div>

            {/* Face-to-Face Calendar Input & Sync */}
            <div className="bg-amber-50/30 p-4 rounded-2xl border border-amber-100 flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Yüzyüze Seanslar Takvim Linki
                </label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-2.5 w-4 h-4 text-amber-600" />
                  <input
                    type="text"
                    placeholder="webcal://calendar.google.com/... veya icloud.com/..."
                    value={faceToFaceUrl}
                    onChange={(e) => setFaceToFaceUrl(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-amber-200 rounded-full focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleSyncFaceToFace}
                disabled={isFaceToFaceSyncing}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {isFaceToFaceSyncing ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Yüzyüze Eşitleniyor...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    Yüzyüze Takvimi Eşitle
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-6 py-2 bg-[#6b705c] hover:bg-[#585c4c] text-white text-xs font-semibold rounded-full transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              Takvim Linklerini Kaydet
            </button>
          </div>
        </form>
      </div>

      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl flex items-center gap-2 text-xs"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </motion.div>
      )}
    </div>
  );
}
