import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Check, 
  HelpCircle,
  Calendar,
  Plus,
  TrendingUp,
  DollarSign,
  Wallet,
  RefreshCw,
  Sliders,
  EyeOff,
  CheckCircle2
} from 'lucide-react';

export interface TourStep {
  targetId?: string;
  title: string;
  content: string;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  tab?: string;
}

interface InteractiveTourProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function InteractiveTour({ isOpen, onClose, setActiveTab, showToast }: InteractiveTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; placement: string }>({ top: 0, left: 0, placement: 'center' });
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Dynamically listen for mobile viewport size changes
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const steps: TourStep[] = [
    {
      title: "PsyCalcu'ya Hoş Geldiniz! 🌸",
      content: "Klinik seanslarınızı, gelir-giderlerinizi ve ajandanızı tek bir yerden kolayca yönetmenizi sağlayacak interaktif tanıtım turuna hoş geldiniz. Hadi birlikte 1 dakikada keşfedelim!",
      placement: "center"
    },
    {
      targetId: "daily-agenda-section",
      title: "Günlük Ajanda & Seanslar",
      content: "Bu alandan günlük seanslarınızı ve ajandanızı takip edebilirsiniz. İster telefonunuzun takvimiyle entegre çalışın, isterseniz tüm seanslarınızı doğrudan buradan yönetin.",
      placement: "bottom",
      tab: "agenda"
    },
    {
      targetId: "add-session-btn",
      title: "Manuel Seans Ekleme",
      content: "Buraya tıklayarak seans tarih, saat ve ücretini girip saniyeler içinde yeni bir seans kaydedebilir, ajandanıza ekleyebilirsiniz.",
      placement: "bottom",
      tab: "agenda"
    },
    {
      targetId: "balance-card",
      title: "Finansal Durum & Hesaplamalar",
      content: "Seanslarınız tamamlandıkça, o ayki tahmini net kârınız, brüt geliriniz ve seans başı biriken otomatik giderleriniz burada anlık hesaplanır.",
      placement: "right",
      tab: "agenda"
    },
    {
      targetId: "ai-summary-card",
      title: "Yapay Zeka Klinik Asistanı",
      content: "Gününüz bittiğinde seans dengenizi, gelir/giderlerinizi ve klinikteki durumunuzu yapay zekanın analiz edip hazırladığı özel klinik raporla okuyabilirsiniz.",
      placement: "top",
      tab: "agenda"
    },
    {
      targetId: "tab-debts",
      title: "Borç ve Ödeme Takip Sayfası",
      content: "Tamamlanan ama henüz ücreti alınmayan seansları danışan bazında burada görebilir, ödeme aldığınızda tek tıkla tahsil edildi olarak işaretleyebilirsiniz.",
      placement: "bottom",
      tab: "debts"
    },
    {
      targetId: "tab-sync",
      title: "Otomatik Takvim Senkronizasyonu",
      content: "Seanslarınızı telefonunuzdan yönetiyorsanız, buraya iCloud veya Google Takvim iCal linkinizi ekleyerek seanslarınızı otomatik buraya aktarabilirsiniz.",
      placement: "bottom",
      tab: "sync"
    },
    {
      targetId: "settings-btn",
      title: "Seans Başı Giderlerinizi Özelleştirin",
      content: "Buradan seans başı çocuk bakıcı ücretinizi, ofis seans kira payınızı ve terapist isminizi belirleyebilirsiniz. Bütçeniz otomatik hesaplanır.",
      placement: "left",
      tab: "agenda"
    },
    {
      targetId: "toggle-explanations-btn",
      title: "Yardımcı Açıklamaları Yönetin",
      content: "Sistemdeki tüm eğitici ve bilgilendirici açıklamaları tek tıkla gizleyerek daha sade ve minimalist bir arayüze geçiş yapabilirsiniz.",
      placement: "left",
      tab: "agenda"
    },
    {
      title: "Her Şey Hazır! 🎉",
      content: "PsyCalcu ile artık klinik süreçlerinizi ve bütçenizi kontrol etmek çok pratik. Dilediğiniz zaman sağ üstteki SSS / Yardım butonuna basarak bu tanıtımı tekrar başlatabilirsiniz. İyi seanslar dileriz!",
      placement: "center"
    }
  ];

  const currentStep = steps[currentStepIndex];

  // Helper to render high quality visual icon representing each step on mobile
  const getStepIcon = (index: number) => {
    switch (index) {
      case 0:
        return (
          <div className="w-12 h-12 bg-[#cb997e]/15 text-[#cb997e] rounded-2xl flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6 animate-bounce" />
          </div>
        );
      case 1:
        return (
          <div className="w-12 h-12 bg-[#6b705c]/15 text-[#6b705c] rounded-2xl flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
        );
      case 2:
        return (
          <div className="w-12 h-12 bg-[#cb997e]/15 text-[#cb997e] rounded-2xl flex items-center justify-center shrink-0">
            <Plus className="w-6 h-6" />
          </div>
        );
      case 3:
        return (
          <div className="w-12 h-12 bg-[#6b705c]/15 text-[#6b705c] rounded-2xl flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        );
      case 4:
        return (
          <div className="w-12 h-12 bg-[#cb997e]/15 text-[#cb997e] rounded-2xl flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
        );
      case 5:
        return (
          <div className="w-12 h-12 bg-[#6b705c]/15 text-[#6b705c] rounded-2xl flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
        );
      case 6:
        return (
          <div className="w-12 h-12 bg-[#cb997e]/15 text-[#cb997e] rounded-2xl flex items-center justify-center shrink-0">
            <RefreshCw className="w-6 h-6 animate-spin-slow" />
          </div>
        );
      case 7:
        return (
          <div className="w-12 h-12 bg-[#6b705c]/15 text-[#6b705c] rounded-2xl flex items-center justify-center shrink-0">
            <Sliders className="w-6 h-6" />
          </div>
        );
      case 8:
        return (
          <div className="w-12 h-12 bg-[#cb997e]/15 text-[#cb997e] rounded-2xl flex items-center justify-center shrink-0">
            <EyeOff className="w-6 h-6" />
          </div>
        );
      case 9:
        return (
          <div className="w-12 h-12 bg-[#6b705c]/15 text-[#6b705c] rounded-2xl flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-[#6b705c]" />
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 bg-[#cb997e]/15 text-[#cb997e] rounded-2xl flex items-center justify-center shrink-0">
            <HelpCircle className="w-6 h-6" />
          </div>
        );
    }
  };

  // If step requires changing active tab, change it
  useEffect(() => {
    if (isOpen && currentStep.tab) {
      setActiveTab(currentStep.tab);
    }
  }, [currentStepIndex, isOpen]);

  // Add temporary bottom padding to body on mobile so any element can be scrolled high enough above the bottom sheet
  useEffect(() => {
    if (isOpen && isMobile) {
      const originalPaddingBottom = document.body.style.paddingBottom;
      // 450px padding bottom gives plenty of scrollable track so elements at the bottom can be lifted above the bottom sheet
      document.body.style.paddingBottom = '450px';
      
      return () => {
        document.body.style.paddingBottom = originalPaddingBottom;
      };
    }
  }, [isOpen, isMobile]);

  // Smoothly scroll target element into view only when the active step changes
  useEffect(() => {
    if (!isOpen) return;

    setIsTransitioning(true);
    setRect(null); // Hide highlight immediately during transitions

    const performScroll = () => {
      if (!currentStep.targetId) {
        setIsTransitioning(false);
        return;
      }

      const element = document.getElementById(currentStep.targetId);
      if (element) {
        // Horizontally center/scroll the element if it's in a horizontal scrollable container (e.g. tabs)
        element.scrollIntoView({
          behavior: 'auto',
          block: 'nearest',
          inline: 'center'
        });

        if (isMobile) {
          // On mobile, scroll the target element to a safe offset below the sticky navbar.
          // Measure sticky navbar height dynamically (defaults to 140px on mobile).
          const navEl = document.querySelector('nav');
          const navHeight = navEl ? navEl.getBoundingClientRect().height : 140;
          
          const elementRect = element.getBoundingClientRect();
          const absoluteElementTop = elementRect.top + window.scrollY;
          // Position it exactly 24px below the sticky header for a clear and clean visual gap
          const targetScrollY = Math.max(0, absoluteElementTop - navHeight - 24);
          
          window.scrollTo({
            top: targetScrollY,
            behavior: 'smooth'
          });
        } else {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }

      // Keep in transitioning mode until smooth scroll finishes
      setTimeout(() => {
        setIsTransitioning(false);
      }, 450);
    };

    // Give some brief time (150ms) for tab switches and active states to trigger/mount
    const timer = setTimeout(performScroll, 150);
    return () => clearTimeout(timer);
  }, [currentStepIndex, isOpen, isMobile, currentStep.targetId]);

  // Track and calculate highlighted element bounds
  useEffect(() => {
    if (!isOpen || isTransitioning) return;

    const updatePosition = () => {
      if (!currentStep.targetId) {
        setRect(null);
        setTooltipPos({ top: 0, left: 0, placement: 'center' });
        return;
      }

      const element = document.getElementById(currentStep.targetId);
      if (element) {
        const r = element.getBoundingClientRect();
        // Ensure element is actually mounted and visible
        if (r.width > 0 && r.height > 0) {
          setRect(r);
        } else {
          setRect(null);
        }

        if (isMobile) {
          // On mobile, keep tooltip fixed at the bottom for readability
          setTooltipPos({ top: 0, left: 0, placement: 'mobile-bottom' });
          return;
        }

        // Desktop positioning
        let top = 0;
        let left = 0;
        const padding = 16;
        const tooltipWidth = 320;
        const tooltipHeight = 180;

        switch (currentStep.placement) {
          case 'bottom':
            top = r.bottom + padding;
            left = r.left + r.width / 2 - tooltipWidth / 2;
            break;
          case 'top':
            top = r.top - tooltipHeight - padding;
            left = r.left + r.width / 2 - tooltipWidth / 2;
            break;
          case 'left':
            top = r.top + r.height / 2 - tooltipHeight / 2;
            left = r.left - tooltipWidth - padding;
            break;
          case 'right':
            top = r.top + r.height / 2 - tooltipHeight / 2;
            left = r.right + padding;
            break;
          default:
            break;
        }

        // Ensure it doesn't overflow screen boundaries
        left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, left));
        top = Math.max(16, top);

        setTooltipPos({ top, left, placement: currentStep.placement });
      } else {
        // Element not found (perhaps not loaded yet)
        setRect(null);
        setTooltipPos({ top: 0, left: 0, placement: 'center' });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    const checkInterval = setInterval(updatePosition, 100);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
      clearInterval(checkInterval);
    };
  }, [currentStepIndex, isOpen, isTransitioning, currentStep.targetId, currentStep.placement, isMobile]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleFinish = () => {
    if (dontShowAgain) {
      localStorage.setItem('psycalcu_tour_completed', 'true');
    }
    if (showToast) {
      showToast("Tanıtım turu tamamlandı! Keyifli kullanımlar dileriz.", "success");
    }
    onClose();
    setCurrentStepIndex(0);
  };

  const handleSkip = () => {
    if (dontShowAgain) {
      localStorage.setItem('psycalcu_tour_completed', 'true');
    }
    onClose();
    setCurrentStepIndex(0);
  };

  return (
    <div className="fixed inset-0 z-55 overflow-hidden font-sans select-none" id="tour-backdrop-overlay">
      {/* 
        PUNCH-OUT OVERLAY MASK (Desktop & Mobile):
        - Both desktop and mobile now use the punch-out SVG mask to ensure the targeted element is completely clear and unblurred.
        - On mobile, we use a slightly softer overlay color (rgba(15, 23, 42, 0.55)) so that the interface stays friendly and readable,
          while ensuring the focused area is fully transparent/sharp and highlighted.
      */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-40">
        <defs>
          <mask id="tour-mask">
            {/* White color lets things pass (dark backdrop) */}
            <rect width="100%" height="100%" fill="white" />
            {/* Black color punches a transparent hole in the mask */}
            {rect && (
              <rect 
                x={rect.left - 6} 
                y={rect.top - 6} 
                width={rect.width + 12} 
                height={rect.height + 12} 
                rx={12} 
                fill="black" 
              />
            )}
          </mask>
        </defs>
        <rect 
          width="100%" 
          height="100%" 
          fill={isMobile ? "rgba(15, 23, 42, 0.55)" : "rgba(15, 23, 42, 0.75)"} 
          mask="url(#tour-mask)" 
          className="pointer-events-auto cursor-pointer"
          onClick={handleSkip}
        />
      </svg>

      {/* Pulsing highlight overlay around target element */}
      {rect && (
        <div 
          className={`absolute z-45 border-2 border-[#cb997e] rounded-xl pointer-events-none animate-pulse shadow-[0_0_15px_rgba(203,153,126,0.5)]`}
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        />
      )}

      {/* Tooltip Card / Mobile Bottom Sheet Wrapper */}
      <div className={`absolute inset-0 z-50 pointer-events-none flex ${isMobile ? 'items-end' : 'items-center justify-center'}`}>
        <AnimatePresence mode="wait">
          {isMobile ? (
            // MOBILE: Native Bottom Sheet style modal
            <motion.div
              key={currentStepIndex}
              initial={{ y: "100%", opacity: 0.5 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0.5 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="pointer-events-auto bg-white rounded-t-[2.5rem] border-t border-[#e5e1d8] p-6 pb-10 shadow-[0_-10px_35px_rgba(15,23,42,0.12)] flex flex-col w-full max-w-full fixed bottom-0 left-0 right-0"
            >
              {/* Pull handle design helper for premium touch */}
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />

              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] bg-[#6b705c]/10 text-[#6b705c] px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                  Adım {currentStepIndex + 1} / {steps.length}
                </span>
                <button 
                  onClick={handleSkip}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full hover:bg-slate-50"
                  title="Turu Atla"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Visual mini-illustration + Content */}
              <div className="flex gap-4 items-start mb-6">
                {getStepIcon(currentStepIndex)}
                <div className="space-y-1.5 flex-1">
                  <h4 className="text-sm font-bold text-slate-800 font-serif leading-tight">
                    {currentStep.title}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {currentStep.content}
                  </p>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-col gap-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-600">
                    <input 
                      type="checkbox" 
                      checked={dontShowAgain}
                      onChange={(e) => setDontShowAgain(e.target.checked)}
                      className="rounded border-slate-300 text-[#6b705c] focus:ring-[#6b705c] w-4 h-4 cursor-pointer"
                    />
                    <span>Bir daha gösterme</span>
                  </label>

                  {/* Dot Page Indicator */}
                  <div className="flex items-center gap-1.5">
                    {steps.map((_, idx) => (
                      <div 
                        key={idx} 
                        className={`h-1 rounded-full transition-all duration-300 ${
                          idx === currentStepIndex ? 'w-4 bg-[#cb997e]' : 'w-1 bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Back / Next actions */}
                <div className="flex justify-between items-center mt-1 gap-3">
                  <button
                    onClick={handlePrev}
                    disabled={currentStepIndex === 0}
                    className={`px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${
                      currentStepIndex === 0 
                        ? 'text-slate-300 bg-slate-50 cursor-not-allowed' 
                        : 'text-slate-600 hover:bg-slate-50 cursor-pointer border border-slate-200'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Geri
                  </button>

                  <div className="flex items-center gap-2">
                    {currentStepIndex < steps.length - 1 ? (
                      <>
                        <button
                          onClick={handleSkip}
                          className="text-slate-400 hover:text-slate-600 text-xs font-semibold px-4 py-2.5 rounded-full hover:bg-slate-50 cursor-pointer"
                        >
                          Atla
                        </button>
                        <button
                          onClick={handleNext}
                          className="px-6 py-2.5 bg-[#6b705c] hover:bg-[#585c4c] text-white rounded-full text-xs font-bold flex items-center gap-1 transition-all shadow-md cursor-pointer"
                        >
                          İleri
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleFinish}
                        className="px-6 py-2.5 bg-[#cb997e] hover:bg-[#b58368] text-white rounded-full text-xs font-bold flex items-center gap-1 transition-all shadow-md cursor-pointer animate-pulse"
                      >
                        <Check className="w-4 h-4" />
                        Tamamla
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            // DESKTOP: Traditional tooltips centered or aligned with target bounds
            <motion.div
              key={currentStepIndex}
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={`pointer-events-auto bg-white rounded-3xl border border-[#e5e1d8] p-5 shadow-2xl flex flex-col ${
                tooltipPos.placement === 'center'
                  ? 'relative w-full max-w-md mx-4'
                  : 'absolute w-80'
              }`}
              style={
                tooltipPos.placement !== 'center'
                  ? { top: tooltipPos.top, left: tooltipPos.left }
                  : undefined
              }
            >
              {/* Header / Title */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] bg-[#6b705c]/10 text-[#6b705c] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                  Adım {currentStepIndex + 1} / {steps.length}
                </span>
                <button 
                  onClick={handleSkip}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                  title="Turu Atla"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-2 mb-5">
                <h4 className="text-sm font-bold text-slate-800 font-serif flex items-center gap-1.5">
                  {currentStepIndex === 0 || currentStepIndex === steps.length - 1 ? (
                    <Sparkles className="w-4 h-4 text-[#cb997e] shrink-0" />
                  ) : null}
                  {currentStep.title}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {currentStep.content}
                </p>
              </div>

              {/* Navigation and Actions */}
              <div className="flex flex-col gap-3 mt-auto pt-3 border-t border-[#f5f5f0]">
                <div className="flex items-center justify-between">
                  {/* Don't show again checkbox */}
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-400 hover:text-slate-600">
                    <input 
                      type="checkbox" 
                      checked={dontShowAgain}
                      onChange={(e) => setDontShowAgain(e.target.checked)}
                      className="rounded border-slate-300 text-[#6b705c] focus:ring-[#6b705c] w-3.5 h-3.5"
                    />
                    <span>Bir daha gösterme</span>
                  </label>

                  {/* Step indicators (dots) */}
                  <div className="flex items-center gap-1">
                    {steps.map((_, idx) => (
                      <div 
                        key={idx} 
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          idx === currentStepIndex ? 'w-3 bg-[#cb997e]' : 'w-1.5 bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Back / Next buttons */}
                <div className="flex justify-between items-center mt-1">
                  <button
                    onClick={handlePrev}
                    disabled={currentStepIndex === 0}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition-all ${
                      currentStepIndex === 0 
                        ? 'text-slate-300 cursor-not-allowed bg-slate-50' 
                        : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Geri
                  </button>

                  <div className="flex items-center gap-2">
                    {currentStepIndex < steps.length - 1 ? (
                      <>
                        <button
                          onClick={handleSkip}
                          className="text-slate-400 hover:text-slate-600 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-slate-50 cursor-pointer"
                        >
                          Atla
                        </button>
                        <button
                          onClick={handleNext}
                          className="px-4 py-2 bg-[#6b705c] hover:bg-[#585c4c] text-white rounded-full text-xs font-semibold flex items-center gap-1 transition-all shadow-xs cursor-pointer"
                        >
                          İleri
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleFinish}
                        className="px-5 py-2 bg-[#cb997e] hover:bg-[#b58368] text-white rounded-full text-xs font-bold flex items-center gap-1 transition-all shadow-md cursor-pointer animate-pulse"
                      >
                        <Check className="w-4 h-4" />
                        Tamamla
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
