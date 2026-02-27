import { test, expect } from '@playwright/test';

const LOCAL_URL = 'http://localhost:3000';

test.describe('Local Home Test', () => {
  test('should click Comenzar Gratis and navigate to register', async ({ page }) => {
    await page.goto(LOCAL_URL);
    await page.waitForLoadState('networkidle');

    // Click "Comenzar Gratis"
    await page.click('text=Comenzar Gratis');

    // Should navigate to /register
    await page.waitForURL('**/register', { timeout: 5000 });
    console.log('✅ Navigated to:', page.url());

    // Screenshot
    await page.screenshot({ path: 'tests/e2e/screenshots/local-register.png', fullPage: true });
  });

  test('should click Ver Demo and navigate to login', async ({ page }) => {
    await page.goto(LOCAL_URL);
    await page.waitForLoadState('networkidle');

    // Click "Ver Demo"
    await page.click('text=Ver Demo');

    // Should navigate to /login
    await page.waitForURL('**/login', { timeout: 5000 });
    console.log('✅ Navigated to:', page.url());

    // Screenshot
    await page.screenshot({ path: 'tests/e2e/screenshots/local-login.png', fullPage: true });
  });
});
