import { useQuery } from '@tanstack/react-query';
import { getSchedulerStatus, getSchedulerTasks } from '../api/client';

/**
 * Hook to fetch scheduler status
 * Polls every 10 seconds
 */
export function useSchedulerStatus() {
  return useQuery({
    queryKey: ['scheduler-status'],
    queryFn: getSchedulerStatus,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
}

/**
 * Hook to fetch all scheduled tasks
 * Polls every 10 seconds
 */
export function useSchedulerTasks() {
  return useQuery({
    queryKey: ['scheduler-tasks'],
    queryFn: getSchedulerTasks,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
}
