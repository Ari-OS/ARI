import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useWebSocket, type WebSocketMessage, type ConnectionStatus } from '../hooks/useWebSocket';

interface WebSocketContextValue {
  status: ConnectionStatus;
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  messageCount: number;
  send: (message: Record<string, unknown>) => boolean;
  subscribe: (eventType: string, handler: (payload: Record<string, unknown>) => void) => () => void;
  unsubscribe: (eventType: string, handler: (payload: Record<string, unknown>) => void) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

type EventHandler = (payload: Record<string, unknown>) => void;

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [subscribers] = useState<Map<string, Set<EventHandler>>>(() => new Map());

  const handleMessage = useCallback((message: WebSocketMessage) => {
    const handlers = subscribers.get(message.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message.payload);
        } catch (error) {
          console.error(`Error in WebSocket handler for ${message.type}:`, error);
        }
      }
    }

    // Also emit to wildcard subscribers
    const wildcardHandlers = subscribers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler({ type: message.type, ...message.payload });
        } catch (error) {
          console.error('Error in WebSocket wildcard handler:', error);
        }
      }
    }
  }, [subscribers]);

  const { status, isConnected, lastMessage, messageCount, send } = useWebSocket({
    onMessage: handleMessage,
    autoInvalidate: true,
  });

  const subscribe = useCallback((eventType: string, handler: EventHandler) => {
    if (!subscribers.has(eventType)) {
      subscribers.set(eventType, new Set());
    }
    subscribers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = subscribers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          subscribers.delete(eventType);
        }
      }
    };
  }, [subscribers]);

  const unsubscribe = useCallback((eventType: string, handler: EventHandler) => {
    const handlers = subscribers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        subscribers.delete(eventType);
      }
    }
  }, [subscribers]);

  return (
    <WebSocketContext.Provider
      value={{
        status,
        isConnected,
        lastMessage,
        messageCount,
        send,
        subscribe,
        unsubscribe,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}

/**
 * Hook to subscribe to specific WebSocket event types
 */
export function useWebSocketEvent(
  eventType: string,
  handler: (payload: Record<string, unknown>) => void,
  deps: React.DependencyList = []
) {
  const { subscribe } = useWebSocketContext();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableHandler = useCallback(handler, deps);

  // Subscribe on mount, unsubscribe on unmount
  useEffect(() => {
    const unsubscribe = subscribe(eventType, stableHandler);
    return unsubscribe;
  }, [eventType, stableHandler, subscribe]);
}
