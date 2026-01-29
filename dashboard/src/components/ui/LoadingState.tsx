/**
 * Loading State Component
 *
 * Consistent loading indicator across all pages.
 * Supports spinner mode (default) or skeleton mode for structured loading states.
 */

import { ReactNode } from 'react';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'skeleton';
  skeleton?: ReactNode;
}

export function LoadingState({
  message = 'Loading...',
  size = 'md',
  variant = 'spinner',
  skeleton,
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  if (variant === 'skeleton' && skeleton) {
    return <>{skeleton}</>;
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <div className={`mb-2 animate-pulse text-purple-400 ${sizeClasses[size]}`}>◉</div>
        <p className={`text-gray-400 ${sizeClasses[size]}`}>{message}</p>
      </div>
    </div>
  );
}
