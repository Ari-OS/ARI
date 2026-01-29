interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse rounded bg-gray-700 ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
      <Skeleton className="mb-3 h-4 w-24" />
      <Skeleton className="mb-2 h-6 w-16" />
      <Skeleton className="mt-4 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-3/4" />
    </div>
  );
}

export function AgentCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
      <div className="mb-4 flex justify-between">
        <div>
          <Skeleton className="h-5 w-20" />
          <Skeleton className="mt-1 h-3 w-32" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="mb-2 h-2 w-full rounded-full" />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
    </div>
  );
}

export function AuditEntrySkeleton() {
  return (
    <div className="border-b border-gray-700 p-4 last:border-b-0">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-48" />
        </div>
        <Skeleton className="h-5 w-24" />
      </div>
    </div>
  );
}

export function ToolCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <div className="mb-2 flex items-start justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-16 rounded" />
      </div>
      <Skeleton className="mb-3 h-3 w-full" />
      <Skeleton className="mb-3 h-3 w-2/3" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="h-5 w-12 rounded" />
      </div>
    </div>
  );
}

export function MemoryCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-5 w-14 rounded" />
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="h-5 w-20 rounded" />
      </div>
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="mb-3 h-4 w-3/4" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-12 rounded" />
        <Skeleton className="h-5 w-16 rounded" />
      </div>
      <div className="mt-3 flex justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

export function ProposalCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-full" />
        </div>
        <Skeleton className="h-5 w-20 rounded" />
      </div>
      <div className="mb-3 flex gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="mb-2 h-2 w-full rounded-full" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

export function StatusCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
      <Skeleton className="mb-3 h-4 w-20" />
      <Skeleton className="mb-4 h-6 w-16 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
