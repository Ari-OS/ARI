import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getE2ERuns, type E2ERunsResponse } from '../api/client';
import { useWebSocket, type WebSocketMessage } from './useWebSocket';

export interface E2ELiveRun {
  id: string;
  status: 'passed' | 'failed' | 'running';
  startedAt: string;
  completed: number;
  total: number;
  passed: number;
  failed: number;
  currentScenario: string | null;
}

export function useE2E() {
  const queryClient = useQueryClient();
  const [liveRun, setLiveRun] = useState<E2ELiveRun | null>(null);

  // Fetch E2E runs data
  const { data, isLoading, isError } = useQuery<E2ERunsResponse>({
    queryKey: ['e2e', 'runs'],
    queryFn: getE2ERuns,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // WebSocket connection for live updates
  useWebSocket({
    onMessage: (message: WebSocketMessage) => {
      switch (message.type) {
        case 'e2e:run_started': {
          const payload = message.payload as {
            id: string;
            startedAt: string;
            total: number;
          };
          setLiveRun({
            id: payload.id,
            status: 'running',
            startedAt: payload.startedAt,
            completed: 0,
            total: payload.total,
            passed: 0,
            failed: 0,
            currentScenario: null,
          });
          break;
        }

        case 'e2e:scenario_complete': {
          const payload = message.payload as {
            runId: string;
            scenario: string;
            status: 'passed' | 'failed';
          };
          setLiveRun((prev) => {
            if (!prev || prev.id !== payload.runId) return prev;
            return {
              ...prev,
              completed: prev.completed + 1,
              passed: payload.status === 'passed' ? prev.passed + 1 : prev.passed,
              failed: payload.status === 'failed' ? prev.failed + 1 : prev.failed,
              currentScenario: payload.scenario,
            };
          });
          break;
        }

        case 'e2e:run_complete': {
          const payload = message.payload as {
            id: string;
            status: 'passed' | 'failed';
          };
          setLiveRun((prev) => {
            if (!prev || prev.id !== payload.id) return prev;
            return {
              ...prev,
              status: payload.status,
              currentScenario: null,
            };
          });
          // Invalidate runs query to fetch updated data
          void queryClient.invalidateQueries({ queryKey: ['e2e', 'runs'] });
          // Clear live run after a delay
          setTimeout(() => setLiveRun(null), 5000);
          break;
        }
      }
    },
    autoInvalidate: true,
  });

  // Extract stats and runs
  const runs = data?.runs || [];
  const stats = data?.stats || {
    totalRuns: 0,
    passRate: 0,
    lastRun: null,
    consecutiveFailures: 0,
  };

  return {
    runs,
    passRate: stats.passRate,
    lastRun: stats.lastRun,
    consecutiveFailures: stats.consecutiveFailures,
    totalRuns: stats.totalRuns,
    liveRun,
    isLoading,
    isError,
  };
}
