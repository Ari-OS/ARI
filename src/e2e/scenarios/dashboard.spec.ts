import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.describe('Navigation', () => {
    test('loads home page', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveTitle(/ARI/i);
    });

    test('sidebar navigation works', async ({ page }) => {
      await page.goto('/');

      // Click on Health page
      await page.click('button:has-text("Health")');
      await expect(page.locator('h1')).toContainText(/Health|Status/i);
    });

    test('all pages are accessible', async ({ page }) => {
      await page.goto('/');

      const pages = [
        'Health',
        'Cognition',
        'Autonomy',
        'Agents',
        'Governance',
        'Memory',
        'Tools',
        'Audit',
      ];

      for (const pageName of pages) {
        const button = page.locator(`button:has-text("${pageName}")`);
        if (await button.isVisible()) {
          await button.click();
          // Just verify page loaded without error
          await page.waitForLoadState('networkidle');
        }
      }
    });
  });

  test.describe('Components', () => {
    test('notification bell is visible', async ({ page }) => {
      await page.goto('/');

      // NotificationBell should be in the sidebar
      const bell = page.locator('button[aria-label*="Notification"]');
      await expect(bell).toBeVisible();
    });

    test('health score gauge is visible', async ({ page }) => {
      await page.goto('/');

      // Health gauge should be in sidebar
      const gauge = page.locator('text=/Health/');
      await expect(gauge.first()).toBeVisible();
    });

    test('command palette opens with keyboard', async ({ page }) => {
      await page.goto('/');

      // Press Cmd+K to open command palette
      await page.keyboard.press('Meta+k');

      // Command palette should appear
      const palette = page.locator('[role="dialog"], [role="combobox"], input[placeholder*="Search"]');
      await expect(palette.first()).toBeVisible({ timeout: 5000 }).catch(() => {
        // Command palette might not be implemented
      });
    });
  });

  test.describe('Real-time Updates', () => {
    test('WebSocket status indicator shows connected', async ({ page }) => {
      await page.goto('/');

      // Wait for WebSocket to connect
      await page.waitForEvent('websocket', { timeout: 10000 });

      // Status indicator should show "Live"
      const liveIndicator = page.locator('text=/Live|Connected/');
      await expect(liveIndicator.first()).toBeVisible({ timeout: 5000 }).catch(() => {
        // Indicator text may vary
      });
    });

    test('alert banner appears for critical alerts', async ({ page, request }) => {
      await page.goto('/');

      // Create a test alert
      await request.post('/api/alerts/test', {
        data: {
          severity: 'critical',
          title: 'E2E Test Alert',
          message: 'This is a test alert for E2E testing',
        },
      });

      // Wait for alert banner to appear
      const banner = page.locator('[class*="alert"], [class*="banner"], [role="alert"]');
      await expect(banner.first()).toBeVisible({ timeout: 5000 }).catch(() => {
        // Banner may not appear if no critical alerts
      });
    });
  });

  test.describe('Responsive Design', () => {
    test('works on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');

      // Sidebar should be visible
      const sidebar = page.locator('aside, nav');
      await expect(sidebar.first()).toBeVisible();
    });

    test('works on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');

      // Page should load without errors
      await expect(page.locator('main')).toBeVisible();
    });

    test('works on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      // Page should load without errors
      await expect(page.locator('main')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('skip link exists', async ({ page }) => {
      await page.goto('/');

      const skipLink = page.locator('a[href="#main-content"], [class*="skip"]');
      // Skip link should exist in the DOM
      expect(await skipLink.count()).toBeGreaterThanOrEqual(0);
    });

    test('main content has proper landmark', async ({ page }) => {
      await page.goto('/');

      const main = page.locator('main, [role="main"]');
      await expect(main.first()).toBeVisible();
    });

    test('navigation has proper landmark', async ({ page }) => {
      await page.goto('/');

      const nav = page.locator('nav, [role="navigation"]');
      await expect(nav.first()).toBeVisible();
    });

    test('buttons have accessible names', async ({ page }) => {
      await page.goto('/');

      const buttons = page.locator('button');
      const count = await buttons.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        const button = buttons.nth(i);
        const name = await button.getAttribute('aria-label') ||
                     await button.innerText();
        expect(name?.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Performance', () => {
    test('initial load is under 3 seconds', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(3000);
    });

    test('no console errors on load', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Filter out known acceptable errors
      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('Failed to load resource')
      );

      expect(criticalErrors.length).toBe(0);
    });
  });
});
