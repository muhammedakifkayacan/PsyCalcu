import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  // Keep onRefresh ref updated
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Keep isRefreshing ref updated
  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  const THRESHOLD = 70; // Distance in px needed to trigger refresh

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
      if (isRefreshingRef.current) return;

      const scrollTop = getScrollTop();
      if (scrollTop <= 5 && e.touches.length === 1) {
        touchStartY.current = e.touches[0].clientY;
        isPulling.current = true;
        pullDistanceRef.current = 0;
      } else {
        isPulling.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshingRef.current) return;

      const currentY = e.touches[0].clientY;
      const diffY = currentY - touchStartY.current;
      const scrollTop = getScrollTop();

      if (diffY > 0 && scrollTop <= 5) {
        // Smooth non-linear pull curve
        const distance = Math.min(Math.pow(diffY, 0.85) * 1.5, 120);
        pullDistanceRef.current = distance;
        setPullDistance(distance);

        // Prevent native overscroll bouncing when pulling down significantly
        if (distance > 10 && e.cancelable) {
          e.preventDefault();
        }
      } else if (diffY < -10) {
        isPulling.current = false;
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current || isRefreshingRef.current) return;
      isPulling.current = false;

      const currentDistance = pullDistanceRef.current;

      if (currentDistance >= THRESHOLD) {
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
            pullDistanceRef.current = 0;
          }, 500);
        }
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
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
  }, []); // Run ONLY once on mount!

  const rotation = Math.min((pullDistance / THRESHOLD) * 180, 180);
  const opacity = Math.min(pullDistance / (THRESHOLD * 0.5), 1);

  return (
    <div className="relative w-full">
      {/* Indicator overlay */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              height: `${Math.max(pullDistance, isRefreshing ? THRESHOLD : 0)}px`,
            }}
            className="w-full flex items-center justify-center overflow-hidden transition-all duration-100 ease-out z-20 py-2"
          >
            <div className="bg-[#6b705c] text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2.5 text-xs font-bold border border-white/20">
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
                  ? 'Bırakın Güncellensin'
                  : 'Sayfayı Yenile'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main App Content Container */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${Math.min(pullDistance * 0.25, 30)}px)` : 'none',
          transition: isPulling.current ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
