import { useQuery } from '@tanstack/react-query';
import { getSystemMetrics } from '../api/client';

/**
 * Hook to fetch system metrics (memory, uptime, etc.)
 * Polls every 5 seconds for real-time monitoring
 */
export function useSystemMetrics() {
  return useQuery({
    queryKey: ['system-metrics'],
    queryFn: getSystemMetrics,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
}
