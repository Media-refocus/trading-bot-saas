import { test, expect } from '@playwright/test';

const VPS_URL = 'http://91.98.238.147:3000';

test.describe('VPS Home Test', () => {
  test('should load home page and check buttons', async ({ page }) => {
    // Ir a la home
    await page.goto(VPS_URL);
    await page.waitForLoadState('networkidle');

    // Screenshot inicial
    await page.screenshot({ path: 'tests/e2e/screenshots/vps-home.png', fullPage: true });

    // Buscar botones de CTA
    const buttons = await page.$$('button, a');
    console.log(`Found ${buttons.length} buttons/links`);

    // Buscar texto "comenzar" o "gratis"
    const pageContent = await page.content();
    console.log('Page has "comenzar":', pageContent.toLowerCase().includes('comenzar'));
    console.log('Page has "gratis":', pageContent.toLowerCase().includes('gratis'));
    console.log('Page has "empezar":', pageContent.toLowerCase().includes('empezar'));

    // Buscar todos los links y botones con su texto
    const allClickable = await page.$$('a, button');
    for (const el of allClickable) {
      const text = await el.textContent().catch(() => '');
      const href = await el.getAttribute('href').catch(() => '');
      const type = await el.getAttribute('type').catch(() => '');
      console.log(`Element: "${text?.trim()}" | href: ${href} | type: ${type}`);
    }

    // Buscar errores en consola
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });
  });

  test('should click on CTA button', async ({ page }) => {
    await page.goto(VPS_URL);
    await page.waitForLoadState('networkidle');

    // Intentar encontrar y hacer clic en botón de registro/CTA
    const ctaSelectors = [
      'text=Comenzar',
      'text=gratis',
      'text=Registrarse',
      'text=Empezar',
      'a[href*="register"]',
      'a[href*="signup"]',
      'button:has-text("Comenzar")',
      'button:has-text("Empezar")',
    ];

    for (const selector of ctaSelectors) {
      const element = await page.$(selector);
      if (element) {
        console.log(`Found element with selector: ${selector}`);
        const isVisible = await element.isVisible();
        const isEnabled = await element.isEnabled().catch(() => true);
        console.log(`Visible: ${isVisible}, Enabled: ${isEnabled}`);

        if (isVisible) {
          await element.click({ force: true });
          await page.waitForTimeout(2000);
          console.log(`Clicked on: ${selector}`);
          console.log(`New URL: ${page.url()}`);
          await page.screenshot({ path: 'tests/e2e/screenshots/vps-after-cta-click.png', fullPage: true });
          break;
        }
      }
    }
  });
});
