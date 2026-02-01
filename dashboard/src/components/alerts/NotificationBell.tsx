import { useState } from 'react';
import { useAlertSummary, useActiveAlerts, useAcknowledgeAlert, useResolveAlert } from '../../hooks/useAlerts';
import { AlertItem } from './AlertItem';

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className = '' }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: summary } = useAlertSummary();
  const { data: activeAlerts } = useActiveAlerts();
  const acknowledgeAlert = useAcknowledgeAlert();
  const resolveAlert = useResolveAlert();

  const unacknowledgedCount = summary?.active ?? 0;
  const hasCritical = (summary?.bySeverity.critical ?? 0) > 0;

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative rounded-lg p-2 transition-colors ${
          unacknowledgedCount > 0
            ? hasCritical
              ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
              : 'bg-amber-900/30 text-amber-400 hover:bg-amber-900/50'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
        }`}
        aria-label={`Notifications (${unacknowledgedCount} unacknowledged)`}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unacknowledgedCount > 0 && (
          <span
            className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
              hasCritical ? 'bg-red-500 text-white' : 'bg-amber-500 text-gray-900'
            }`}
          >
            {unacknowledgedCount > 9 ? '9+' : unacknowledgedCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown content */}
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <h3 className="text-sm font-medium text-white">Notifications</h3>
              <div className="flex items-center gap-3 text-xs">
                {summary && (
                  <div className="flex items-center gap-2">
                    {summary.bySeverity.critical > 0 && (
                      <span className="rounded-full bg-red-900/30 px-2 py-0.5 text-red-400">
                        {summary.bySeverity.critical} critical
                      </span>
                    )}
                    {summary.bySeverity.warning > 0 && (
                      <span className="rounded-full bg-amber-900/30 px-2 py-0.5 text-amber-400">
                        {summary.bySeverity.warning} warning
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {activeAlerts?.alerts && activeAlerts.alerts.length > 0 ? (
                <div className="space-y-2 p-3">
                  {activeAlerts.alerts.map((alert) => (
                    <AlertItem
                      key={alert.id}
                      alert={alert}
                      compact
                      onAcknowledge={(id) => acknowledgeAlert.mutate(id)}
                      onResolve={(id) => resolveAlert.mutate(id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="text-2xl">🎉</div>
                  <p className="mt-2 text-sm text-gray-500">All clear! No active alerts.</p>
                </div>
              )}
            </div>

            {activeAlerts?.alerts && activeAlerts.alerts.length > 0 && (
              <div className="border-t border-gray-800 p-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full rounded-lg px-3 py-2 text-xs text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                >
                  View All Alerts →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
