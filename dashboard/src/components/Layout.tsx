import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { SkipLink } from './ui/SkipLink';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  return (
    <>
      <SkipLink />
      <div className="flex h-screen bg-gray-950 text-gray-100">
        <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
        <main id="main-content" className="flex-1 overflow-auto">{children}</main>
      </div>
    </>
  );
}
