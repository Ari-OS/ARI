import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../../src/kernel/event-bus.js';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  it('should subscribe and receive events', () => {
    const handler = vi.fn();

    eventBus.on('test:event', handler);
    eventBus.emit('test:event', { data: 'test' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ data: 'test' });
  });

  it('should unsubscribe via returned function and stop receiving events', () => {
    const handler = vi.fn();

    const unsubscribe = eventBus.on('test:event', handler);
    eventBus.emit('test:event', { data: 'first' });

    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    eventBus.emit('test:event', { data: 'second' });

    expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
  });

  it('should remove specific handler with off()', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    eventBus.on('test:event', handler1);
    eventBus.on('test:event', handler2);

    eventBus.emit('test:event', { data: 'test' });
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);

    eventBus.off('test:event', handler1);
    eventBus.emit('test:event', { data: 'test2' });

    expect(handler1).toHaveBeenCalledTimes(1); // Not called again
    expect(handler2).toHaveBeenCalledTimes(2); // Called again
  });

  it('should fire once() handler only once', () => {
    const handler = vi.fn();

    eventBus.once('test:event', handler);

    eventBus.emit('test:event', { data: 'first' });
    eventBus.emit('test:event', { data: 'second' });
    eventBus.emit('test:event', { data: 'third' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ data: 'first' });
  });

  it('should fire multiple handlers for same event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();

    eventBus.on('test:event', handler1);
    eventBus.on('test:event', handler2);
    eventBus.on('test:event', handler3);

    eventBus.emit('test:event', { data: 'test' });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler3).toHaveBeenCalledTimes(1);
    expect(handler1).toHaveBeenCalledWith({ data: 'test' });
    expect(handler2).toHaveBeenCalledWith({ data: 'test' });
    expect(handler3).toHaveBeenCalledWith({ data: 'test' });
  });

  it('should remove all listeners with clear()', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();

    eventBus.on('event1', handler1);
    eventBus.on('event2', handler2);
    eventBus.on('event1', handler3);

    expect(eventBus.listenerCount('event1')).toBe(2);
    expect(eventBus.listenerCount('event2')).toBe(1);

    eventBus.clear();

    expect(eventBus.listenerCount('event1')).toBe(0);
    expect(eventBus.listenerCount('event2')).toBe(0);

    eventBus.emit('event1', {});
    eventBus.emit('event2', {});

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
    expect(handler3).not.toHaveBeenCalled();
  });

  it('should return correct listener count', () => {
    expect(eventBus.listenerCount('test:event')).toBe(0);

    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();

    eventBus.on('test:event', handler1);
    expect(eventBus.listenerCount('test:event')).toBe(1);

    eventBus.on('test:event', handler2);
    expect(eventBus.listenerCount('test:event')).toBe(2);

    eventBus.on('other:event', handler3);
    expect(eventBus.listenerCount('test:event')).toBe(2);
    expect(eventBus.listenerCount('other:event')).toBe(1);

    eventBus.off('test:event', handler1);
    expect(eventBus.listenerCount('test:event')).toBe(1);
  });

  it('should handle errors in one handler without breaking others', () => {
    const handler1 = vi.fn(() => {
      throw new Error('Handler 1 failed');
    });
    const handler2 = vi.fn();
    const handler3 = vi.fn();

    eventBus.on('test:event', handler1);
    eventBus.on('test:event', handler2);
    eventBus.on('test:event', handler3);

    // Should not throw
    expect(() => {
      eventBus.emit('test:event', { data: 'test' });
    }).not.toThrow();

    // All handlers should have been called
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler3).toHaveBeenCalledTimes(1);
  });
});
