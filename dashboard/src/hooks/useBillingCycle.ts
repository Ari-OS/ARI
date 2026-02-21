import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBillingCycle,
  startNewBillingCycle,
} from '../api/client';

/**
 * Hook for fetching billing cycle status
 */
export function useBillingCycle() {
  return useQuery({
    queryKey: ['billing-cycle'],
    queryFn: getBillingCycle,
    refetchInterval: 60000, // Every minute
  });
}

/**
 * Hook for starting a new billing cycle
 */
export function useStartNewCycleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startNewBillingCycle,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['billing-cycle'] });
      void queryClient.invalidateQueries({ queryKey: ['budget-status'] });
    },
  });
}
