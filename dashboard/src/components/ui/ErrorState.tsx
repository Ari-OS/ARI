/**
 * Error State Component
 *
 * Shown when data fetching fails.
 */

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Failed to load',
  message = 'Something went wrong while fetching data.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <div className="mb-3 text-4xl text-red-400">✗</div>
        <h3 className="mb-1 text-lg font-medium text-red-300">{title}</h3>
        <p className="mb-4 text-sm text-gray-400">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded bg-purple-700 px-4 py-2 text-sm text-white transition-colors hover:bg-purple-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
