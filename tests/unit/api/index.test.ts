import { describe, it, expect } from 'vitest';
import { apiRoutes, WebSocketBroadcaster } from '../../../src/api/index.js';

describe('API module exports', () => {
  it('should export apiRoutes', () => {
    expect(apiRoutes).toBeDefined();
    expect(typeof apiRoutes).toBe('function');
  });

  it('should export WebSocketBroadcaster', () => {
    expect(WebSocketBroadcaster).toBeDefined();
    expect(typeof WebSocketBroadcaster).toBe('function');
  });
});
