import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Enable mock data when backend is offline (dev mode only)
if (import.meta.env.DEV) {
  import('./mocks/interceptor').then(({ enableMockInterceptor }) => {
    enableMockInterceptor();
  });
}

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
