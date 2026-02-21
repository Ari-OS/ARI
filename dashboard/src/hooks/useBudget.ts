import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBudgetStatus,
  setBudgetProfile,
  getApprovalQueue,
  approveItem,
  rejectItem,
} from '../api/client';
import type { BudgetProfileName } from '../types/api';

/**
 * Hook for fetching budget status with automatic polling
 */
export function useBudget() {
  return useQuery({
    queryKey: ['budget-status'],
    queryFn: getBudgetStatus,
    refetchInterval: 10000, // Every 10 seconds
  });
}

/**
 * Hook for switching budget profiles
 */
export function useBudgetProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profile: BudgetProfileName) => setBudgetProfile(profile),
    onSuccess: () => {
      // Invalidate budget status to refetch with new profile
      void queryClient.invalidateQueries({ queryKey: ['budget-status'] });
    },
  });
}

/**
 * Hook for fetching approval queue
 */
export function useApprovalQueue() {
  return useQuery({
    queryKey: ['approval-queue'],
    queryFn: getApprovalQueue,
    refetchInterval: 30000, // Every 30 seconds
  });
}

/**
 * Hook for approving items in the queue
 */
export function useApproveItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => approveItem(id, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
    },
  });
}

/**
 * Hook for rejecting items in the queue
 */
export function useRejectItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectItem(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['approval-queue'] });
    },
  });
}
