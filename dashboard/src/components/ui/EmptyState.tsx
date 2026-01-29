/**
 * Empty State Component
 *
 * Shown when there's no data to display.
 */

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: string;
}

export function EmptyState({
  title = 'No data',
  message = 'Nothing to display yet.',
  icon = '○',
}: EmptyStateProps) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <div className="mb-3 text-4xl text-gray-600">{icon}</div>
        <h3 className="mb-1 text-lg font-medium text-gray-300">{title}</h3>
        <p className="text-sm text-gray-400">{message}</p>
      </div>
    </div>
  );
}
