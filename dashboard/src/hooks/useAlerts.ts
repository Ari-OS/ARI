import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Alert, AlertSummary, AlertSeverity, AlertStatus } from '../types/alerts';

const API_BASE = '/api';

interface AlertsResponse {
  alerts: Alert[];
  total: number;
}

interface AlertFilters {
  status?: AlertStatus;
  severity?: AlertSeverity;
  limit?: number;
  offset?: number;
}

async function fetchAlerts(filters?: AlertFilters): Promise<AlertsResponse> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.severity) params.set('severity', filters.severity);
  if (filters?.limit) params.set('limit', filters.limit.toString());
  if (filters?.offset) params.set('offset', filters.offset.toString());

  const queryString = params.toString();
  const response = await fetch(`${API_BASE}/alerts${queryString ? `?${queryString}` : ''}`);
  if (!response.ok) throw new Error('Failed to fetch alerts');
  return response.json();
}

async function fetchAlertSummary(): Promise<AlertSummary> {
  const response = await fetch(`${API_BASE}/alerts/summary`);
  if (!response.ok) throw new Error('Failed to fetch alert summary');
  return response.json();
}

async function acknowledgeAlert(id: string): Promise<Alert> {
  const response = await fetch(`${API_BASE}/alerts/${id}/acknowledge`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to acknowledge alert');
  const data = await response.json();
  return data.alert;
}

async function resolveAlert(id: string): Promise<Alert> {
  const response = await fetch(`${API_BASE}/alerts/${id}/resolve`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to resolve alert');
  const data = await response.json();
  return data.alert;
}

async function deleteAlert(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/alerts/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete alert');
}

export function useAlerts(filters?: AlertFilters) {
  return useQuery({
    queryKey: ['alerts', filters],
    queryFn: () => fetchAlerts(filters),
    refetchInterval: 10000,
  });
}

export function useActiveAlerts() {
  return useAlerts({ status: 'active', limit: 10 });
}

export function useCriticalAlerts() {
  return useAlerts({ status: 'active', severity: 'critical', limit: 5 });
}

export function useAlertSummary() {
  return useQuery({
    queryKey: ['alerts', 'summary'],
    queryFn: fetchAlertSummary,
    refetchInterval: 5000,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}
