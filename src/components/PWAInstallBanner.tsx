import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, X, Share, PlusSquare, ArrowDown, Check, Sparkles } from 'lucide-react';

export const PWAInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(true); // default true until checked
  const [showIOSGuide, setShowIOSGuide] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if running in standalone mode (already installed to home screen)
    const checkStandalone = () => {
      const isStandaloneMatch = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (navigator as any).standalone === true;
      return isStandaloneMatch || isIOSStandalone;
    };

    if (checkStandalone()) {
      setIsStandalone(true);
      return;
    }

    // 2. Check if user previously dismissed banner
    const dismissed = localStorage.getItem('psycalcu_pwa_banner_dismissed') === 'true';
    setIsDismissed(dismissed);

    // 3. Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    // 4. Capture native beforeinstallprompt event (Android / Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Trigger native Android / Chrome install dialog
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsDismissed(true);
        localStorage.setItem('psycalcu_pwa_banner_dismissed', 'true');
      }
      setDeferredPrompt(null);
    } else {
      // For iOS Safari or browsers without beforeinstallprompt event
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('psycalcu_pwa_banner_dismissed', 'true');
  };

  // Do not render if standalone or dismissed
  if (isStandalone || isDismissed) {
    return null;
  }

  return (
    <>
      {/* Floating Bottom Reminder Banner */}
      <AnimatePresence>
        {!isDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="fixed bottom-20 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 z-40 sm:max-w-md w-auto"
            id="pwa-install-banner"
          >
            <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-[#e5e1d8] p-3.5 shadow-xl shadow-slate-900/10 flex items-center justify-between gap-3 text-slate-800">
              {/* Left Icon & Text */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#6b705c] to-[#a5a58d] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Smartphone className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-slate-800 tracking-tight font-sans truncate">
                      PsyCalcu'yu Ana Ekrana Ekleyin
                    </h4>
                    <span className="px-1.5 py-0.5 rounded-md bg-[#6b705c]/10 text-[#6b705c] text-[10px] font-bold">
                      Uygulama
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate font-sans mt-0.5">
                    Tarayıcı açmadan direkt ana ekrandan hızlıca erişin.
                  </p>
                </div>
              </div>

              {/* Action & Dismiss Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleInstallClick}
                  className="px-3 py-1.5 bg-[#6b705c] hover:bg-[#585c4b] active:scale-95 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Ekle</span>
                </button>

                <button
                  onClick={handleDismiss}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Kapat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS / Safari Step-By-Step Installation Guide Modal */}
      <AnimatePresence>
        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIOSGuide(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-[#e5e1d8] flex flex-col gap-5 z-10 text-slate-800 font-sans"
            >
              {/* Header */}
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/60">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Ana Ekrana Nasıl Eklenir?</h3>
                    <p className="text-xs text-slate-500 mt-0.5">3 kolay adımda PsyCalcu ikonunu ekleyin</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Steps List */}
              <div className="space-y-3 bg-[#fdfbf7] p-4 rounded-2xl border border-[#e5e1d8]/80 text-xs text-slate-700">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#6b705c] text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    Tarayıcınızın alt veya üst menüsündeki <span className="font-semibold text-blue-600 inline-flex items-center gap-0.5"><Share className="w-3.5 h-3.5 inline" /> Paylaş</span> butonuna dokunun.
                  </div>
                </div>

                <div className="w-full h-px bg-slate-200/60" />

                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#6b705c] text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    Açılan menüyü aşağı kaydırıp <span className="font-semibold text-slate-900 inline-flex items-center gap-0.5"><PlusSquare className="w-3.5 h-3.5 inline" /> "Ana Ekrana Ekle"</span> seçeneğini belirleyin.
                  </div>
                </div>

                <div className="w-full h-px bg-slate-200/60" />

                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#6b705c] text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    Sağ üst köşedeki <span className="font-semibold text-emerald-600">"Ekle"</span> butonuna basarak PsyCalcu'yu telefonunuza yükleyin.
                  </div>
                </div>
              </div>

              {/* Close / Understood Button */}
              <button
                onClick={() => {
                  setShowIOSGuide(false);
                  handleDismiss();
                }}
                className="w-full py-2.5 bg-[#6b705c] hover:bg-[#585c4b] active:scale-[0.98] text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Anladım, Kapat
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PWAInstallBanner;
