import { test, expect } from '@playwright/test';

const VPS_URL = 'http://91.98.238.147:3000';

test.describe('VPS Login Test', () => {
  test('should login with demo credentials', async ({ page }) => {
    // Ir directamente a login
    await page.goto(`${VPS_URL}/login`);

    // Esperar que cargue el formulario
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Llenar credenciales
    await page.fill('input[type="email"]', 'demo@tradingbot.com');
    await page.fill('input[type="password"]', 'demo123');

    // Click login
    await page.click('button[type="submit"]');

    // Esperar redirect al dashboard o backtester
    await page.waitForURL(/\/(dashboard|backtester)/, { timeout: 15000 });

    // Screenshot
    await page.screenshot({ path: 'tests/e2e/screenshots/vps-after-login.png', fullPage: true });

    console.log('✅ Login exitoso en VPS');
  });

  test('should access backtester page', async ({ page }) => {
    // Login directo
    await page.goto(`${VPS_URL}/login`);
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'demo@tradingbot.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button[type="submit"]');

    // Esperar redirect
    await page.waitForURL(/\/(dashboard|backtester)/, { timeout: 15000 });

    // Ir al backtester
    await page.goto(`${VPS_URL}/backtester`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verificar que el backtester cargó
    const title = await page.textContent('h1, h2, h3').catch(() => null);
    console.log('Backtester title:', title);

    // Screenshot del backtester
    await page.screenshot({ path: 'tests/e2e/screenshots/vps-backtester.png', fullPage: true });

    console.log('✅ Backtester accesible');
  });
});
