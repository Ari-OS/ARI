import { useState, useEffect } from 'react';
import { useCriticalAlerts, useAcknowledgeAlert } from '../../hooks/useAlerts';
import { formatDistanceToNow } from 'date-fns';

interface AlertBannerProps {
  onNavigateToAlerts?: () => void;
}

export function AlertBanner({ onNavigateToAlerts }: AlertBannerProps) {
  const { data: criticalAlerts } = useCriticalAlerts();
  const acknowledgeAlert = useAcknowledgeAlert();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Get first non-dismissed critical alert
  const alert = criticalAlerts?.alerts.find((a) => !dismissedIds.has(a.id));

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    if (!alert) return;

    const timeout = setTimeout(() => {
      setDismissedIds((prev) => new Set(prev).add(alert.id));
    }, 30000);

    return () => clearTimeout(timeout);
  }, [alert?.id]);

  if (!alert) return null;

  const timeAgo = formatDistanceToNow(new Date(alert.lastSeenAt), { addSuffix: true });

  return (
    <div className="animate-slideDown border-b border-red-800 bg-gradient-to-r from-red-900/40 via-red-900/30 to-red-900/40">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-900/50">
            <svg
              className="h-5 w-5 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-red-400">{alert.title}</span>
              {alert.count > 1 && (
                <span className="rounded-full bg-red-900/50 px-1.5 py-0.5 text-[10px] text-red-300">
                  ×{alert.count}
                </span>
              )}
            </div>
            <p className="text-xs text-red-300/70">{alert.message}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-red-300/50">{timeAgo}</span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => acknowledgeAlert.mutate(alert.id)}
              className="rounded-lg bg-red-900/50 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-900/70"
            >
              Acknowledge
            </button>
            {onNavigateToAlerts && (
              <button
                onClick={onNavigateToAlerts}
                className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
              >
                View All
              </button>
            )}
            <button
              onClick={() => setDismissedIds((prev) => new Set(prev).add(alert.id))}
              className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-900/50"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
