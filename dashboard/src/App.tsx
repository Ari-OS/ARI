import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WebSocketProvider, useWebSocketContext } from './contexts/WebSocketContext';
import { AlertBanner } from './components/alerts/AlertBanner';
import { CommandPalette } from './components/CommandPalette';
import { Home } from './pages/Home';
import { Health } from './pages/Health';
import { Autonomy } from './pages/Autonomy';
import { Governance } from './pages/Governance';
import { Memory } from './pages/Memory';
import { Tools } from './pages/Tools';
import { Agents } from './pages/Agents';
import { Audit } from './pages/Audit';
import { Cognition } from './pages/Cognition';
import { E2E } from './pages/E2E';
import { Budget } from './pages/Budget';

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
  const [currentPage, setCurrentPage] = useState('home');
  const { status: wsStatus } = useWebSocketContext();

  const renderPage = () => {
    switch (currentPage) {
      case 'health':
        return <Health />;
      case 'autonomy':
        return <Autonomy />;
      case 'cognition':
        return <Cognition />;
      case 'governance':
        return <Governance />;
      case 'memory':
        return <Memory />;
      case 'tools':
        return <Tools />;
      case 'agents':
        return <Agents />;
      case 'audit':
        return <Audit />;
      case 'e2e':
        return <E2E />;
      case 'budget':
        return <Budget />;
      default:
        return <Home />;
    }
  };

  return (
    <>
      {/* Critical Alert Banner */}
      <AlertBanner onNavigateToAlerts={() => setCurrentPage('audit')} />

      {/* Command Palette */}
      <CommandPalette onNavigate={setCurrentPage} />

      <Layout currentPage={currentPage} onNavigate={setCurrentPage} wsStatus={wsStatus}>
        <ErrorBoundary>
          {renderPage()}
        </ErrorBoundary>
      </Layout>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        <AppContent />
      </WebSocketProvider>
    </QueryClientProvider>
  );
}

export default App;
