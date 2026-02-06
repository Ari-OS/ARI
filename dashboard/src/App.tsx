import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WebSocketProvider, useWebSocketContext } from './contexts/WebSocketContext';
import { AlertBanner } from './components/alerts/AlertBanner';
import { CommandPalette } from './components/CommandPalette';
import { PageSkeleton } from './components/PageSkeleton';

const SystemStatus = lazy(() => import('./pages/SystemStatus'));
const AgentsAndTools = lazy(() => import('./pages/AgentsAndTools'));
const Cognition = lazy(() => import('./pages/cognition'));
const Autonomy = lazy(() => import('./pages/Autonomy'));
const GovernanceAndAudit = lazy(() => import('./pages/GovernanceAndAudit'));
const Memory = lazy(() => import('./pages/Memory'));
const Operations = lazy(() => import('./pages/Operations'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { status: wsStatus } = useWebSocketContext();
  const currentPage = location.pathname.split('/')[1] || 'system';

  return (
    <>
      <AlertBanner onNavigateToAlerts={() => navigate('/governance')} />
      <CommandPalette onNavigate={(page) => navigate(`/${page}`)} />
      <Layout currentPage={currentPage} wsStatus={wsStatus}>
        <ErrorBoundary key={currentPage}>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<Navigate to="/system" replace />} />
              <Route path="/system" element={<SystemStatus />} />
              <Route path="/agents" element={<AgentsAndTools />} />
              <Route path="/cognition" element={<Cognition />} />
              <Route path="/autonomy" element={<Autonomy />} />
              <Route path="/governance" element={<GovernanceAndAudit />} />
              <Route path="/memory" element={<Memory />} />
              <Route path="/operations" element={<Operations />} />
              <Route path="*" element={<Navigate to="/system" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </WebSocketProvider>
    </QueryClientProvider>
  );
}

export default App;
