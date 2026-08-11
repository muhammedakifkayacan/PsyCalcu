import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { PrivacyProvider } from './context/PrivacyContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

// Apple-style subtle haptic feedback for mobile touch events
if (typeof window !== 'undefined') {
  window.addEventListener('touchstart', (e: TouchEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (
      target.tagName === 'BUTTON' ||
      target.closest('button') ||
      target.closest('[role="button"]') ||
      target.classList.contains('cursor-pointer') ||
      target.closest('.cursor-pointer')
    )) {
      if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(8); // Subtle 8ms tactile tick
        } catch (_) {
          // Ignore if vibration permissions are blocked
        }
      }
    }
  }, { passive: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <PrivacyProvider>
        <App />
      </PrivacyProvider>
    </ErrorBoundary>
  </StrictMode>,
);


