import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share, PlusSquare, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed or standalone mode
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // Check if dismissed in localStorage
    const dismissed = localStorage.getItem('psycalcu_pwa_prompt_dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    // Capture beforeinstallprompt for Android/Chrome/Edge
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setTimeout(() => setIsDismissed(true), 2500);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      // Fallback for browsers where prompt isn't directly triggerable
      setShowIOSModal(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('psycalcu_pwa_prompt_dismissed', 'true');
  };

  // Do not show if already in standalone app mode, or dismissed
  if (isStandalone || isDismissed) {
    return null;
  }

  return (
    <>
      {/* Mobile Reminder Banner */}
      <AnimatePresence>
        {!isDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="sm:hidden bg-gradient-to-r from-[#6b705c] to-[#555a4a] text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs border-b border-white/10 relative z-30"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-3xs">
                <Smartphone className="w-4 h-4 text-emerald-200" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-white truncate text-[11px] leading-tight">
                  Ana Ekrana Ekle
                </p>
                <p className="text-[10px] text-white/80 truncate">
                  PsyCalcu'yu uygulama gibi hızlıca açın
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isInstalled ? (
                <span className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[10px] px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Eklendi
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="bg-white text-[#6b705c] hover:bg-[#fdfbf7] active:scale-95 text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Download className="w-3 h-3 text-[#6b705c]" />
                  <span>Yükle</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDismiss}
                className="p-1 text-white/70 hover:text-white rounded-md hover:bg-white/10 cursor-pointer"
                title="Kapat"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS & Manual Installation Instructions Modal */}
      <AnimatePresence>
        {showIOSModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 sm:p-0"
            onClick={() => setShowIOSModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-sm w-full border border-[#e5e1d8] shadow-2xl space-y-5"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#6b705c]/10 flex items-center justify-center text-[#6b705c]">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-slate-800 text-base">Ana Ekrana Ekleme</h3>
                    <p className="text-[11px] text-slate-400">Mobil tarayıcı rehberi</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-slate-600">
                <p className="font-medium">
                  PsyCalcu'yu telefonunuzun ana ekranında bağımsız bir mobil uygulama olarak kullanmak için:
                </p>

                {isIOS ? (
                  <div className="space-y-2.5 bg-[#fdfbf7] p-3.5 rounded-2xl border border-[#e5e1d8]">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#6b705c] text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                      <p>Safari alt menüsündeki <span className="font-bold text-blue-600 inline-flex items-center gap-0.5"><Share className="w-3.5 h-3.5" /> Paylaş</span> butonuna dokunun.</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#6b705c] text-white flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                      <p>Açılan listeden <span className="font-bold text-slate-800 inline-flex items-center gap-0.5"><PlusSquare className="w-3.5 h-3.5 text-slate-600" /> Ana Ekrana Ekle</span> seçeneğine dokunun.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5 bg-[#fdfbf7] p-3.5 rounded-2xl border border-[#e5e1d8]">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#6b705c] text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                      <p>Tarayıcı menüsünü (üç nokta) açın.</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#6b705c] text-white flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                      <p><span className="font-bold text-slate-800">Ana Ekrana Ekle</span> veya <span className="font-bold text-slate-800">Uygulamayı Yükle</span> butonuna dokunun.</p>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="w-full py-2.5 bg-[#6b705c] hover:bg-[#585c4c] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                Anladım
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
