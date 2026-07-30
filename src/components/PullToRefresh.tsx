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

  const THRESHOLD = 75; // Distance in px needed to trigger refresh

  useEffect(() => {
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      // Only pull if page is scrolled at top
      if (window.scrollY === 0 && e.touches.length === 1) {
        startY = e.touches[0].clientY;
        touchStartY.current = startY;
        isPulling.current = true;
      } else {
        isPulling.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const diffY = currentY - touchStartY.current;

      // Only care about pulling down from top
      if (diffY > 0 && window.scrollY === 0) {
        // Apply resistance formula
        const distance = Math.min(diffY * 0.45, 120);
        setPullDistance(distance);

        // Prevent default scrolling bouncing if pulling down significantly
        if (distance > 10 && e.cancelable) {
          e.preventDefault();
        }
      } else {
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current || isRefreshing) return;
      isPulling.current = false;

      if (pullDistance >= THRESHOLD) {
        setIsRefreshing(true);
        setPullDistance(THRESHOLD);

        try {
          await onRefresh();
        } catch (err) {
          console.error('Pull to refresh failed:', err);
        } finally {
          setTimeout(() => {
            setIsRefreshing(false);
            setPullDistance(0);
          }, 600);
        }
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, onRefresh]);

  const rotation = Math.min((pullDistance / THRESHOLD) * 180, 180);
  const opacity = Math.min(pullDistance / (THRESHOLD * 0.6), 1);

  return (
    <div className="relative w-full">
      {/* Indicator area */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ height: `${Math.max(pullDistance, isRefreshing ? THRESHOLD : 0)}px` }}
            className="w-full flex items-center justify-center overflow-hidden transition-all duration-150 ease-out sm:hidden"
          >
            <div className="bg-[#6b705c] text-white px-4 py-2 rounded-full shadow-md flex items-center gap-2 text-xs font-medium">
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                style={{
                  transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
                  opacity: opacity,
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

      {/* Main App Content */}
      <div
        style={{
          transform: pullDistance > 0 && !isRefreshing ? `translateY(${pullDistance * 0.3}px)` : 'none',
          transition: isPulling.current ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
