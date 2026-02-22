import { useState, useCallback, useRef, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  timestamp: string;
}

const MAX_STORED_MESSAGES = 100;
const STORAGE_KEY = 'ari-chat-history';

function loadMessages(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: ChatMessage[]): void {
  try {
    const trimmed = messages.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable
  }
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [isLoading, setIsLoading] = useState(false);
  const pendingRef = useRef(false);

  const { send, isConnected, status } = useWebSocket({
    onMessage: (wsMessage) => {
      if (wsMessage.type === 'chat:response') {
        const payload = wsMessage.payload as any;
        const content = typeof payload.content === 'string' ? payload.content : JSON.stringify(payload);

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content,
          reasoning: payload.reasoning as string | undefined,
          timestamp: new Date().toISOString(),
        };

        setMessages(prev => {
          const updated = [...prev, assistantMessage];
          saveMessages(updated);
          return updated;
        });

        setIsLoading(false);
        pendingRef.current = false;
      } else if (wsMessage.type === 'chat:error') {
        const payload = wsMessage.payload as { error?: string };
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Error: ${payload.error ?? 'Something went wrong'}`,
          timestamp: new Date().toISOString(),
        };

        setMessages(prev => {
          const updated = [...prev, errorMessage];
          saveMessages(updated);
          return updated;
        });

        setIsLoading(false);
        pendingRef.current = false;
      }
    },
  });

  const sendMessage = useCallback((content: string) => {
    if (!content.trim() || pendingRef.current) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => {
      const updated = [...prev, userMessage];
      saveMessages(updated);
      return updated;
    });

    setIsLoading(true);
    pendingRef.current = true;

    send({
      type: 'chat:message',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    });
  }, [send]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Reset loading state if disconnected while waiting
  useEffect(() => {
    if (status === 'disconnected' && pendingRef.current) {
      setIsLoading(false);
      pendingRef.current = false;
    }
  }, [status]);

  return {
    messages,
    isLoading,
    isConnected,
    sendMessage,
    clearHistory,
  };
}
