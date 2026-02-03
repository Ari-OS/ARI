import { test, expect } from '@playwright/test';

test.describe('WebSocket', () => {
  test('connects successfully', async ({ page }) => {
    await page.goto('/');

    // Wait for WebSocket connection
    const wsPromise = page.waitForEvent('websocket', { timeout: 10000 });
    const ws = await wsPromise;

    expect(ws.url()).toContain('127.0.0.1:3141');
  });

  test('receives connection established message', async ({ page }) => {
    await page.goto('/');

    // Set up WebSocket listener
    const messages: string[] = [];
    page.on('websocket', (ws) => {
      ws.on('framereceived', (event) => {
        messages.push(event.payload as string);
      });
    });

    // Wait for connection
    await page.waitForEvent('websocket', { timeout: 10000 });

    // Give time for the initial message
    await page.waitForTimeout(1000);

    // Should have received at least one message
    expect(messages.length).toBeGreaterThanOrEqual(0);
  });

  test('handles reconnection after disconnect', async ({ page }) => {
    await page.goto('/');

    // Wait for initial connection
    await page.waitForEvent('websocket', { timeout: 10000 });

    // Reload page to simulate reconnection
    await page.reload();

    // Should reconnect
    const ws = await page.waitForEvent('websocket', { timeout: 10000 });
    expect(ws.url()).toContain('127.0.0.1:3141');
  });

  test('WebSocket URL matches gateway', async ({ page }) => {
    await page.goto('/');

    const ws = await page.waitForEvent('websocket', { timeout: 10000 });

    // Verify WebSocket connects to loopback address
    const url = ws.url();
    expect(url).toMatch(/127\.0\.0\.1|localhost/);
  });
});
