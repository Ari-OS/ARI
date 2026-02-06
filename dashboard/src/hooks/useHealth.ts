import { useQuery } from '@tanstack/react-query';
import { getHealth, getDetailedHealth } from '../api/client';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchIntervalInBackground: false,
  });
}

export function useDetailedHealth() {
  return useQuery({
    queryKey: ['health', 'detailed'],
    queryFn: getDetailedHealth,
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchIntervalInBackground: false,
  });
}
