import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface WebSocketMessage {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  autoInvalidate?: boolean;
}

// Map WebSocket event types to React Query keys for automatic invalidation
const EVENT_TO_QUERY_KEYS: Record<string, string[][]> = {
  'message:accepted': [['health'], ['audit']],
  'message:rejected': [['health'], ['audit']],
  'security:detected': [['health'], ['audit'], ['alerts']],
  'vote:started': [['proposals'], ['governance']],
  'vote:cast': [['proposals'], ['governance']],
  'vote:completed': [['proposals'], ['governance']],
  'vote:vetoed': [['proposals'], ['governance']],
  'arbiter:ruling': [['governance', 'rules'], ['audit']],
  'overseer:gate': [['governance', 'gates'], ['audit']],
  'scheduler:task_run': [['scheduler'], ['audit']],
  'scheduler:task_complete': [['scheduler'], ['audit'], ['execution-history']],
  'subagent:spawned': [['subagents']],
  'subagent:progress': [['subagents']],
  'subagent:completed': [['subagents']],
  'permission:granted': [['audit']],
  'permission:denied': [['audit'], ['alerts']],
  'memory:stored': [['memory']],
  'memory:quarantined': [['memory'], ['alerts']],
  'tool:executed': [['tools'], ['audit']],
  'agent:started': [['agents'], ['health']],
  'agent:stopped': [['agents'], ['health']],
  'alert:created': [['alerts']],
  'alert:acknowledged': [['alerts']],
  'alert:resolved': [['alerts']],
  'e2e:run_started': [['e2e', 'runs']],
  'e2e:scenario_complete': [['e2e', 'runs']],
  'e2e:run_complete': [['e2e', 'runs']],
};

const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 2000;

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { onMessage, onStatusChange, autoInvalidate = true } = options;
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [messageCount, setMessageCount] = useState(0);

  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    updateStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      updateStatus('connected');
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY; // Reset delay on successful connection
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;

      try {
        const message = JSON.parse(String(event.data)) as WebSocketMessage;
        setLastMessage(message);
        setMessageCount(prev => prev + 1);

        // Call custom handler
        onMessage?.(message);

        // Auto-invalidate React Query caches
        if (autoInvalidate) {
          const queryKeys = EVENT_TO_QUERY_KEYS[message.type];
          if (queryKeys) {
            for (const key of queryKeys) {
              void queryClient.invalidateQueries({ queryKey: key });
            }
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      // Error will be followed by close, so just log
      // eslint-disable-next-line no-console
      console.error('WebSocket error occurred');
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      updateStatus('disconnected');

      // Schedule reconnection with exponential backoff
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY);

      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          updateStatus('reconnecting');
          connect();
        }
      }, delay);
    };
  }, [queryClient, onMessage, autoInvalidate, updateStatus]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    updateStatus('disconnected');
  }, [updateStatus]);

  const send = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Send ping to keep connection alive
  const ping = useCallback(() => {
    return send({ type: 'ping' });
  }, [send]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    // Set up ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (status === 'connected') {
        ping();
      }
    }, 30000);

    return () => {
      mountedRef.current = false;
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, ping, status]);

  return {
    status,
    isConnected: status === 'connected',
    lastMessage,
    messageCount,
    send,
    ping,
    connect,
    disconnect,
  };
}
