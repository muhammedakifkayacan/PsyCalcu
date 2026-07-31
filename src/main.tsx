import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { PrivacyProvider } from './context/PrivacyContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <PrivacyProvider>
        <App />
      </PrivacyProvider>
    </ErrorBoundary>
  </StrictMode>,
);

