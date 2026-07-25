import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Check } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}

const PULL_THRESHOLD = 65; // Pull distance in px required to trigger refresh
const MAX_PULL = 110;       // Maximum pull visual limit

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const startYRef = useRef(0);
  const isTouchActiveRef = useRef(false);
  const hasTriggeredVibration = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (disabled || isRefreshing) return;

    // Only enable if user is scrolled to the absolute top of the page
    if (window.scrollY <= 2) {
      startYRef.current = e.touches[0].clientY;
      isTouchActiveRef.current = true;
      hasTriggeredVibration.current = false;
    } else {
      isTouchActiveRef.current = false;
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (!isTouchActiveRef.current || disabled || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    // Only pull down when scrolled at the very top and moving downward
    if (diff > 0 && window.scrollY <= 2) {
      // Damped elastic formula
      const damped = Math.min(diff * 0.42, MAX_PULL);
      setPullDistance(damped);
      setIsPulling(true);

      // Haptic feedback pulse when crossing threshold
      if (damped >= PULL_THRESHOLD && !hasTriggeredVibration.current) {
        hasTriggeredVibration.current = true;
        if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
          try {
            navigator.vibrate(12);
          } catch (err) {
            // ignore
          }
        }
      } else if (damped < PULL_THRESHOLD && hasTriggeredVibration.current) {
        hasTriggeredVibration.current = false;
      }
    } else if (diff <= 0) {
      setPullDistance(0);
      setIsPulling(false);
    }
  }, [disabled, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isTouchActiveRef.current || disabled || isRefreshing) return;

    isTouchActiveRef.current = false;
    setIsPulling(false);

    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD); // Hold position at threshold height

      try {
        await onRefresh();
        setIsSuccess(true);
        setTimeout(() => {
          setIsSuccess(false);
          setIsRefreshing(false);
          setPullDistance(0);
        }, 800);
      } catch (error) {
        console.error("Pull to refresh error:", error);
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, disabled, isRefreshing, onRefresh]);

  // Bind passive window listeners for touch
  useEffect(() => {
    const onStart = (e: TouchEvent) => handleTouchStart(e);
    const onMove = (e: TouchEvent) => handleTouchMove(e);
    const onEnd = () => handleTouchEnd();

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);

    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const rotation = Math.min((pullDistance / PULL_THRESHOLD) * 360, 360);
  const progressPercent = Math.min(Math.round((pullDistance / PULL_THRESHOLD) * 100), 100);

  return (
    <div className="relative w-full min-h-screen">
      {/* Pull-To-Refresh Visual Indicator (Top Fixed/Sticky overlay) */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{
              opacity: 1,
              y: Math.max(pullDistance * 0.7 - 8, 12),
              scale: 1
            }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
          >
            <div className="flex items-center gap-2.5 px-4 py-2 bg-white/95 backdrop-blur-md rounded-full border border-[#e5e1d8] shadow-lg text-slate-700 text-xs font-medium font-sans">
              <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
                {isSuccess ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                  </motion.div>
                ) : isRefreshing ? (
                  <RefreshCw className="w-4 h-4 text-[#6b705c] animate-spin" />
                ) : (
                  <RefreshCw
                    className="w-4 h-4 text-slate-500 transition-transform duration-75"
                    style={{ transform: `rotate(${rotation}deg)` }}
                  />
                )}
              </div>

              <span className="text-slate-700 font-semibold tracking-wide">
                {isSuccess
                  ? 'Güncellendi!'
                  : isRefreshing
                  ? 'Sayfa güncelleniyor...'
                  : pullDistance >= PULL_THRESHOLD
                  ? 'Bırakın, yenilensin'
                  : `Yenilemek için çekin (%${progressPercent})`}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container Content */}
      <motion.div
        animate={{
          y: isRefreshing ? PULL_THRESHOLD * 0.5 : isPulling ? pullDistance * 0.25 : 0
        }}
        transition={isPulling ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 30 }}
        className="w-full min-h-screen"
      >
        {children}
      </motion.div>
    </div>
  );
};

export default PullToRefresh;
