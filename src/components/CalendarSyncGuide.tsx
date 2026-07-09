import React, { useState, useRef } from 'react';
import { Calendar, AlertCircle, Upload, HelpCircle, CheckCircle2, ArrowRight, RefreshCw, Link2, Laptop, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { parseICS } from '../utils/icsParser';
import { Session, AppSettings } from '../types';

interface CalendarSyncGuideProps {
  onImportSessions: (sessions: Session[], sourceCalendar: 'online' | 'face-to-face') => { 
    addedCount: number; 
    updatedCount: number; 
    deletedCount?: number;
    totalParsed: number; 
    addedList?: any[];
    updatedList?: any[];
    deletedList?: any[];
  };
  defaultPrice: number;
  defaultBabysitterFee: number;
  defaultOfficeRentFee: number;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  sessions?: Session[];
  onGoToDate?: (date: string) => void;
  setActiveTab?: (tab: 'agenda' | 'stats' | 'sync' | 'backup' | 'debts' | 'settings') => void;
  showExplanations?: boolean;
}

export default function CalendarSyncGuide({
  onImportSessions,
  defaultPrice,
  defaultBabysitterFee,
  defaultOfficeRentFee,
  settings,
  onSaveSettings,
  showToast,
  sessions = [],
  onGoToDate,
  setActiveTab,
  showExplanations = true,
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
            const stats = onImportSessions(parsed, type);
            const typeLabel = type === 'online' ? 'Online' : 'Yüzyüze';
            if (stats.addedCount > 0 || stats.updatedCount > 0) {
              showToast(`${typeLabel} takvim (.ics) dosyası başarıyla içeri aktarıldı: ${stats.addedCount} yeni seans eklendi, ${stats.updatedCount} seans güncellendi.`, 'success');
            } else {
              showToast(`${typeLabel} takvim (.ics) dosyası içeri aktarıldı: Zaten güncel, yeni seans veya değişiklik bulunamadı.`, 'info');
            }
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

  const handleSyncOnline = async () => {
    if (!onlineUrl) {
      showToast('Senkronizasyon başarısız: Lütfen önce Online Seanslar Takvim Linki ekleyin.', 'error');
      return;
    }
    setIsOnlineSyncing(true);
    try {
      const response = await fetch(`/api/proxy-ical?url=${encodeURIComponent(onlineUrl)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP Hata: ${response.status}`);
      }
      const icsText = await response.text();
      const parsed = parseICS(icsText, defaultPrice, defaultBabysitterFee, defaultOfficeRentFee, 'online');
      const isValidIcs = icsText.toUpperCase().includes('BEGIN:VCALENDAR') || icsText.toUpperCase().includes('BEGIN:VEVENT');
      
      if (isValidIcs) {
        const stats = onImportSessions(parsed, 'online');
        if (stats.addedCount > 0 || stats.updatedCount > 0 || (stats.deletedCount || 0) > 0) {
          let msg = `Online Seanslar Takvimi eşitlendi: `;
          const parts = [];
          if (stats.addedCount > 0) parts.push(`${stats.addedCount} yeni seans eklendi`);
          if (stats.updatedCount > 0) parts.push(`${stats.updatedCount} seans güncellendi`);
          if ((stats.deletedCount || 0) > 0) parts.push(`${stats.deletedCount} silinen veya taşınan seans temizlendi`);
          msg += parts.join(', ') + '.';
          showToast(msg, 'success');
        } else {
          showToast(`Online Seanslar Takvimi kontrol edildi: Yeni bir seans veya değişiklik bulunamadı.`, 'info');
        }
      } else {
        showToast('Online takvim linkinden seans/etkinlik bilgisi alınamadı. Lütfen geçerli bir takvim linki (webcal veya ics) girdiğinizden emin olun.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast(`Senkronizasyon Hatası: ${err.message || 'Lütfen linkin doğruluğunu ve internet bağlantınızı kontrol edin.'}`, 'error');
    } finally {
      setIsOnlineSyncing(false);
    }
  };

  const handleSyncFaceToFace = async () => {
    if (!faceToFaceUrl) {
      showToast('Senkronizasyon başarısız: Lütfen önce Yüzyüze Seanslar Takvim Linki ekleyin.', 'error');
      return;
    }
    setIsFaceToFaceSyncing(true);
    try {
      const response = await fetch(`/api/proxy-ical?url=${encodeURIComponent(faceToFaceUrl)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP Hata: ${response.status}`);
      }
      const icsText = await response.text();
      const parsed = parseICS(icsText, defaultPrice, defaultBabysitterFee, defaultOfficeRentFee, 'face-to-face');
      const isValidIcs = icsText.toUpperCase().includes('BEGIN:VCALENDAR') || icsText.toUpperCase().includes('BEGIN:VEVENT');
      
      if (isValidIcs) {
        const stats = onImportSessions(parsed, 'face-to-face');
        if (stats.addedCount > 0 || stats.updatedCount > 0 || (stats.deletedCount || 0) > 0) {
          let msg = `Yüzyüze Seanslar Takvimi eşitlendi: `;
          const parts = [];
          if (stats.addedCount > 0) parts.push(`${stats.addedCount} yeni seans eklendi`);
          if (stats.updatedCount > 0) parts.push(`${stats.updatedCount} seans güncellendi`);
          if ((stats.deletedCount || 0) > 0) parts.push(`${stats.deletedCount} silinen veya taşınan seans temizlendi`);
          msg += parts.join(', ') + '.';
          showToast(msg, 'success');
        } else {
          showToast(`Yüzyüze Seanslar Takvimi kontrol edildi: Yeni bir seans veya değişiklik bulunamadı.`, 'info');
        }
      } else {
        showToast('Yüzyüze takvim linkinden seans/etkinlik bilgisi alınamadı. Lütfen geçerli bir takvim linki (webcal veya ics) girdiğinizden emin olun.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast(`Senkronizasyon Hatası: ${err.message || 'Lütfen linkin doğruluğunu ve internet bağlantınızı kontrol edin.'}`, 'error');
    } finally {
      setIsFaceToFaceSyncing(false);
    }
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
      {showExplanations && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#f5f5f0] p-6 rounded-2xl border border-[#e5e1d8]/60 text-slate-700 animate-fade-in">
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
      )}

      {/* ICS File Importer with Type Selector */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-[#6b705c]">
              Yöntem A: Takvim (.ics) Dosyasından Seans Yükle
            </h4>
            {showExplanations && (
              <p className="text-xs text-slate-500 mt-0.5 animate-fade-in">
                Google Takvim, Apple Takvim veya Outlook'tan indirdiğiniz .ics dosyasını seans tipini seçerek içeri aktarın.
              </p>
            )}
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
          {showExplanations && (
            <p className="text-xs text-slate-500 mt-0.5 animate-fade-in">
              Google, iCloud veya Outlook üzerinde herkese açık paylaştığınız takvimlerin webcal:// ile başlayan abonelik linklerini girin.
            </p>
          )}
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

      {/* Synced Events Overview & Preview */}
      {(() => {
        const syncedSessions = sessions.filter(s => s.isSyncedFromCalendar);
        if (syncedSessions.length === 0) return null;
        
        return (
          <div className="pt-6 border-t border-[#f5f5f0] space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-sm font-semibold text-[#6b705c] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Sistemdeki Aktif Takvim Verileri ({syncedSessions.length} Seans)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  iCloud/Google Takvimlerinizden başarıyla çekilmiş ve panele işlenmiş güncel seanslar listelenmektedir.
                </p>
              </div>
            </div>

            <div className="bg-[#fcfbf9] rounded-2xl border border-[#e5e1d8]/80 p-4">
              <div className="text-xs text-[#6b705c] mb-2.5 font-bold uppercase tracking-wider">Son Eklenen / Güncellenen 5 Takvim Seansı:</div>
              <div className="space-y-2">
                {[...syncedSessions]
                  .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
                  .slice(0, 5)
                  .map((session) => (
                    <div 
                      key={session.id} 
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white rounded-xl border border-slate-100 hover:border-[#6b705c]/30 transition-all text-xs gap-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${session.type === 'face-to-face' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        <div>
                          <div className="font-bold text-slate-800">{session.clientName}</div>
                          <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                            <span className="font-semibold text-[#6b705c]">{session.date.split('-').reverse().join('.')}</span>
                            <span>•</span>
                            <span>{session.time}</span>
                            <span>•</span>
                            <span>{session.type === 'online' ? 'ONLİNE' : 'YÜZYÜZE'}</span>
                          </div>
                        </div>
                      </div>
                      {onGoToDate && setActiveTab && (
                        <button
                          type="button"
                          onClick={() => {
                            onGoToDate(session.date);
                            setActiveTab('agenda');
                            showToast(`${session.clientName} seansının bulunduğu ${session.date.split('-').reverse().join('.')} tarihine yönlendirildiniz.`, 'info');
                          }}
                          className="self-end sm:self-auto px-3 py-1 bg-[#6b705c]/10 hover:bg-[#6b705c] hover:text-white text-[#6b705c] rounded-full text-[10px] font-bold transition-all cursor-pointer"
                        >
                          Tarihe Git & Görüntüle
                        </button>
                      )}
                    </div>
                  ))}
              </div>
              
              {showExplanations && (
                <div className="mt-3.5 text-[11px] text-[#cb997e] bg-[#cb997e]/5 p-3 rounded-xl border border-[#cb997e]/10 flex items-start gap-2 leading-relaxed animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#cb997e] mt-0.5" />
                  <span>
                    <strong>Bilgi:</strong> Takviminizden gelen seanslar, kendi orijinal tarihlerine yerleşir (örneğin geçmiş aylardaki seanslar kendi günlerine). 
                    Yukarıdaki <strong>"Tarihe Git & Görüntüle"</strong> butonunu kullanarak o tarihin ajandasına anında zıplayabilir ve seansı inceleyebilirsiniz.
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
