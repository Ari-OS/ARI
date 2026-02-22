import { useState, useRef, useEffect } from 'react';
import { useChat } from '../hooks/useChat';
import { Virtuoso } from 'react-virtuoso';

export function Chat() {
  const { messages, isLoading, isConnected, sendMessage, clearHistory } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Chat
          </h1>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.75rem',
            color: isConnected ? 'var(--ari-success)' : 'var(--text-tertiary)',
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isConnected ? 'var(--ari-success)' : 'var(--text-tertiary)',
            }} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              color: 'var(--text-tertiary)',
              background: 'transparent',
              border: '1px solid var(--border-primary)',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {messages.length === 0 && !isLoading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-tertiary)',
            gap: '8px',
          }}>
            <span style={{ fontSize: '2rem' }}>&#9679;</span>
            <span style={{ fontSize: '1rem' }}>Ask ARI anything</span>
            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Messages are stored locally</span>
          </div>
        )}

        {messages.length > 0 && (
          <Virtuoso
            style={{ height: '100%' }}
            data={messages}
            followOutput="smooth"
            itemContent={(_index: number, msg: any) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: '16px',
                }}
              >
                <div style={{
                  maxWidth: '75%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  backgroundColor: msg.role === 'user'
                    ? 'var(--ari-accent, #6366f1)'
                    : 'var(--bg-tertiary)',
                  color: msg.role === 'user'
                    ? '#fff'
                    : 'var(--text-primary)',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                  
                  {msg.reasoning && (
                    <details style={{
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid rgba(255,255,255,0.1)',
                      fontSize: '0.75rem',
                      opacity: 0.8
                    }}>
                      <summary style={{ cursor: 'pointer', outline: 'none' }}>Thought Process</summary>
                      <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>
                        {msg.reasoning}
                      </div>
                    </details>
                  )}

                  <div style={{
                    fontSize: '0.65rem',
                    opacity: 0.6,
                    marginTop: '4px',
                    textAlign: msg.role === 'user' ? 'right' : 'left',
                  }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )}
          />
        )}

        {/* Typing indicator */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '16px' }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: '14px 14px 14px 4px',
              backgroundColor: 'var(--bg-tertiary)',
              display: 'flex',
              gap: '4px',
              alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--text-tertiary)',
                    animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 20px 20px',
        borderTop: '1px solid var(--border-primary)',
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? 'Message ARI...' : 'Waiting for connection...'}
            disabled={!isConnected}
            rows={1}
            style={{
              flex: 1,
              padding: '10px 14px',
              fontSize: '0.875rem',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: '12px',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              maxHeight: '120px',
              overflow: 'auto',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !isConnected}
            style={{
              padding: '10px 16px',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#fff',
              backgroundColor: !input.trim() || isLoading || !isConnected
                ? 'var(--text-tertiary)'
                : 'var(--ari-accent, #6366f1)',
              border: 'none',
              borderRadius: '12px',
              cursor: !input.trim() || isLoading || !isConnected ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Send
          </button>
        </div>
      </div>

      {/* Bounce animation for typing indicator */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
