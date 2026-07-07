import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startAutoHeight } from './embed/autoHeight';
import './styles/theme.css';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Report height to a host page when embedded in an iframe (no-op otherwise).
startAutoHeight();
