import { useEffect } from 'react';

/**
 * Bulletproof hook to prevent background scrolling and rubber-banding
 * across iOS Safari, iPadOS, Android, and Desktop browsers when any modal is open.
 * Uses the industry-standard position: fixed + scroll offset technique with
 * scrollbar width compensation to eliminate horizontal layout jumps.
 */
export function useBodyScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    // Track active modal count to safely handle nested / stacked modals
    const currentCount = parseInt(document.body.dataset.modalCount || '0', 10);
    const newCount = currentCount + 1;
    document.body.dataset.modalCount = String(newCount);

    if (newCount === 1) {
      // 1. Capture current scroll position and scrollbar width
      const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      
      document.body.dataset.lockedScrollY = String(scrollY);

      // 2. Prevent horizontal jump if desktop scrollbar disappears
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }

      // 3. Pin body in place with position: fixed (the only 100% reliable fix on iOS WebKit)
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';

      document.body.classList.add('modal-open');
      document.documentElement.classList.add('modal-open');
    }

    return () => {
      const activeCount = parseInt(document.body.dataset.modalCount || '0', 10);
      const updatedCount = Math.max(0, activeCount - 1);
      document.body.dataset.modalCount = String(updatedCount);

      // Only release the lock when ALL modals are closed
      if (updatedCount === 0) {
        const savedScrollY = parseInt(document.body.dataset.lockedScrollY || '0', 10);

        // Restore styles
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        document.body.style.paddingRight = '';

        document.documentElement.style.overflow = '';
        document.documentElement.style.overscrollBehavior = '';

        document.body.classList.remove('modal-open');
        document.documentElement.classList.remove('modal-open');
        delete document.body.dataset.lockedScrollY;

        // Restore user's exact scroll position without smooth animation jump
        window.scrollTo({
          top: savedScrollY,
          left: 0,
          behavior: 'instant' as ScrollBehavior
        });
      }
    };
  }, [isOpen]);
}
