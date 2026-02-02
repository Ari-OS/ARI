import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { SkipLink } from './ui/SkipLink';
import type { ConnectionStatus } from '../hooks/useWebSocket';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  wsStatus?: ConnectionStatus;
}

export function Layout({ children, currentPage, onNavigate, wsStatus = 'disconnected' }: LayoutProps) {
  return (
    <>
      <SkipLink />
      <div
        className="flex h-screen"
        style={{
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
        }}
      >
        <Sidebar currentPage={currentPage} onNavigate={onNavigate} wsStatus={wsStatus} />
        <main
          id="main-content"
          className="flex-1 overflow-auto custom-scrollbar bg-ari-radial"
        >
          {children}
        </main>
      </div>
    </>
  );
}
