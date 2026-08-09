import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Sparkles, Trash2, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [pullPercent, setPullPercent] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const pullDistanceRef = useRef(0);
  const rawDiffYRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const isClearingCacheRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  // Keep onRefresh ref updated
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Keep isRefreshing ref updated
  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  const THRESHOLD = 70; // Distance in px needed for standard refresh

  useEffect(() => {
    const getScrollTop = () => {
      return (
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0
      );
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current || isClearingCacheRef.current) return;

      const scrollTop = getScrollTop();
      if (scrollTop <= 5 && e.touches.length === 1) {
        touchStartY.current = e.touches[0].clientY;
        isPulling.current = true;
        pullDistanceRef.current = 0;
        rawDiffYRef.current = 0;
      } else {
        isPulling.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshingRef.current || isClearingCacheRef.current) return;

      const currentY = e.touches[0].clientY;
      const diffY = currentY - touchStartY.current;
      const scrollTop = getScrollTop();

      if (diffY > 0 && scrollTop <= 5) {
        rawDiffYRef.current = diffY;
        const viewportHeight = window.innerHeight || 800;
        const percent = Math.min(100, Math.max(0, Math.round((diffY / viewportHeight) * 100)));
        setPullPercent(percent);

        // Smooth distance calculation up to screen height
        const distance = Math.min(diffY, viewportHeight * 0.95);
        pullDistanceRef.current = distance;
        setPullDistance(distance);

        // Prevent native overscroll bouncing when pulling down significantly
        if (distance > 10 && e.cancelable) {
          e.preventDefault();
        }
      } else if (diffY < -10) {
        isPulling.current = false;
        pullDistanceRef.current = 0;
        rawDiffYRef.current = 0;
        setPullDistance(0);
        setPullPercent(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current || isRefreshingRef.current || isClearingCacheRef.current) return;
      isPulling.current = false;

      const viewportHeight = window.innerHeight || 800;
      const rawDiff = rawDiffYRef.current;
      const currentPercent = Math.min(100, Math.round((rawDiff / viewportHeight) * 100));

      // Deep pull check: 90% or more of screen height
      if (currentPercent >= 90 || rawDiff >= viewportHeight * 0.90) {
        setIsClearingCache(true);
        isClearingCacheRef.current = true;

        try {
          // Clear session storage and web caches
          sessionStorage.clear();
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
        } catch (err) {
          console.error("Cache clear error during deep pull reload:", err);
        }

        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else if (rawDiff >= THRESHOLD) {
        setIsRefreshing(true);
        setPullDistance(THRESHOLD);

        try {
          await onRefreshRef.current();
        } catch (err) {
          console.error('Pull to refresh error:', err);
        } finally {
          setTimeout(() => {
            setIsRefreshing(false);
            setPullDistance(0);
            setPullPercent(0);
            pullDistanceRef.current = 0;
            rawDiffYRef.current = 0;
          }, 500);
        }
      } else {
        pullDistanceRef.current = 0;
        rawDiffYRef.current = 0;
        setPullDistance(0);
        setPullPercent(0);
      }
    };

    // Attach listeners once with passive: false for touchmove
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []); // Run ONLY once on mount

  const rotation = Math.min((pullDistance / THRESHOLD) * 180, 180);
  const opacity = Math.min(pullDistance / (THRESHOLD * 0.5), 1);
  const isNinetyPercent = pullPercent >= 90;

  return (
    <div className="relative w-full">
      {/* Indicator Overlay */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing || isClearingCache) && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              height: isClearingCache
                ? '90px'
                : `${Math.max(Math.min(pullDistance, 140), isRefreshing ? THRESHOLD : 0)}px`,
            }}
            className="w-full flex items-center justify-center overflow-hidden transition-all duration-100 ease-out z-50 py-2 fixed top-0 inset-x-0 pointer-events-none"
          >
            {isClearingCache ? (
              <div className="bg-rose-600 text-white px-6 py-3 rounded-full shadow-2xl border-2 border-rose-300 flex items-center gap-3 animate-pulse pointer-events-auto">
                <RotateCcw className="w-5 h-5 animate-spin" />
                <span className="font-bold text-xs sm:text-sm">🧹 Önbellek temizleniyor ve sayfa yenileniyor...</span>
              </div>
            ) : isNinetyPercent ? (
              <div className="bg-gradient-to-r from-amber-600 to-rose-600 text-white px-5 py-3 rounded-2xl shadow-2xl border-2 border-amber-200 flex items-center gap-3 animate-bounce pointer-events-auto">
                <Sparkles className="w-5 h-5 text-yellow-200 animate-spin" />
                <div className="text-left">
                  <div className="font-extrabold text-xs sm:text-sm flex items-center gap-1.5">
                    <span>🔥 TAM ÖNBELLEK TEMİZLEME (%{pullPercent})</span>
                  </div>
                  <p className="text-[10px] text-amber-100 font-medium">
                    Bıraktığınızda tüm geçici veriler temizlenip sayfa yenilenecektir!
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-[#6b705c] text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2.5 text-xs font-bold border border-white/20 pointer-events-auto">
                <RefreshCw
                  className={`w-4 h-4 text-amber-300 ${isRefreshing ? 'animate-spin' : ''}`}
                  style={{
                    transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
                    opacity: isRefreshing ? 1 : opacity,
                  }}
                />
                <span>
                  {isRefreshing
                    ? 'Güncelleniyor...'
                    : pullDistance >= THRESHOLD
                    ? `Bırakın Güncellensin (%${pullPercent})`
                    : `Aşağı Çekin (%${pullPercent})`}
                </span>
                <div className="w-10 h-1.5 bg-white/20 rounded-full overflow-hidden ml-1">
                  <div
                    className="h-full bg-amber-300 transition-all duration-75"
                    style={{ width: `${pullPercent}%` }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main App Content Container */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${Math.min(pullDistance * 0.2, 40)}px)` : 'none',
          transition: isPulling.current ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

