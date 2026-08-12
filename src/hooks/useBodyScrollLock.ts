import { useEffect } from 'react';

/**
 * Custom hook to prevent body scroll and background pulling when a modal/overlay is open.
 */
export function useBodyScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    // Track active modal count to handle stacked / nested modals safely
    const currentCount = parseInt(document.body.dataset.modalCount || '0', 10);
    const newCount = currentCount + 1;
    document.body.dataset.modalCount = String(newCount);

    if (newCount === 1) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.body.classList.add('modal-open');
    }

    return () => {
      const activeCount = parseInt(document.body.dataset.modalCount || '0', 10);
      const updatedCount = Math.max(0, activeCount - 1);
      document.body.dataset.modalCount = String(updatedCount);

      if (updatedCount === 0) {
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        document.body.classList.remove('modal-open');
      }
    };
  }, [isOpen]);
}
