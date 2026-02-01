import { formatDistanceToNow } from 'date-fns';
import type { Alert, AlertSeverity } from '../../types/alerts';

interface AlertItemProps {
  alert: Alert;
  compact?: boolean;
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const SEVERITY_CONFIG: Record<AlertSeverity, { bg: string; border: string; text: string; icon: string }> = {
  critical: {
    bg: 'bg-red-900/20',
    border: 'border-red-800',
    text: 'text-red-400',
    icon: '⚠',
  },
  warning: {
    bg: 'bg-amber-900/20',
    border: 'border-amber-800',
    text: 'text-amber-400',
    icon: '⚡',
  },
  info: {
    bg: 'bg-blue-900/20',
    border: 'border-blue-800',
    text: 'text-blue-400',
    icon: 'ℹ',
  },
};

export function AlertItem({
  alert,
  compact = false,
  onAcknowledge,
  onResolve,
  onDelete,
}: AlertItemProps) {
  const config = SEVERITY_CONFIG[alert.severity];
  const timeAgo = formatDistanceToNow(new Date(alert.lastSeenAt), { addSuffix: true });

  if (compact) {
    return (
      <div
        className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${config.bg} ${config.border}`}
      >
        <span className={`${config.text} text-sm`}>{config.icon}</span>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${config.text}`}>{alert.title}</p>
          <p className="truncate text-xs text-gray-500">{alert.message}</p>
        </div>
        {alert.count > 1 && (
          <span className="rounded-full bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400">
            ×{alert.count}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border ${config.bg} ${config.border} p-4 transition-all hover:bg-opacity-30`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.bg} ${config.text}`}
          >
            {config.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className={`font-medium ${config.text}`}>{alert.title}</h4>
              {alert.count > 1 && (
                <span className="rounded-full bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400">
                  ×{alert.count}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-gray-400">{alert.message}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
              <span>Source: {alert.source}</span>
              <span>•</span>
              <span>{timeAgo}</span>
              {alert.status === 'acknowledged' && (
                <>
                  <span>•</span>
                  <span className="text-amber-400">Acknowledged</span>
                </>
              )}
              {alert.status === 'resolved' && (
                <>
                  <span>•</span>
                  <span className="text-emerald-400">Resolved</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {alert.status === 'active' && onAcknowledge && (
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="rounded-lg bg-gray-800 px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
            >
              Acknowledge
            </button>
          )}
          {alert.status !== 'resolved' && onResolve && (
            <button
              onClick={() => onResolve(alert.id)}
              className="rounded-lg bg-emerald-900/30 px-2 py-1 text-xs text-emerald-400 transition-colors hover:bg-emerald-900/50"
            >
              Resolve
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(alert.id)}
              className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-red-900/20 hover:text-red-400"
              aria-label="Delete alert"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
