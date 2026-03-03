import { test } from "@playwright/test";

const BASE = "https://trading-bot-saas.vercel.app";

test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14

test.setTimeout(120000);

test("mobile UX audit - backtester", async ({ page }) => {
  // Login
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "tests/e2e/screenshots/mob-01-login.png", fullPage: true });

  await page.locator('input[type="email"]').fill("guillermolhl@hotmail.com");
  await page.locator('input[type="password"]').fill("test1234");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL("**/dashboard**", { timeout: 15000 });
  
  // Dashboard mobile
  await page.screenshot({ path: "tests/e2e/screenshots/mob-02-dashboard.png", fullPage: true });

  // Backtester
  await page.goto(`${BASE}/backtester`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "tests/e2e/screenshots/mob-03-backtester-top.png", fullPage: false });
  await page.screenshot({ path: "tests/e2e/screenshots/mob-04-backtester-full.png", fullPage: true });

  // Execute backtest
  const executeBtn = page.locator('button:has-text("Ejecutar Backtest")').first();
  if (await executeBtn.isVisible()) {
    await executeBtn.click({ force: true });
    await page.waitForTimeout(8000);
    
    // Capture results at different scroll positions
    await page.screenshot({ path: "tests/e2e/screenshots/mob-05-results-top.png", fullPage: false });
    await page.screenshot({ path: "tests/e2e/screenshots/mob-06-results-full.png", fullPage: true });
    
    // Scroll to chart
    const chartSection = page.locator('text=Chart de Velas');
    if (await chartSection.count() > 0) {
      await chartSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "tests/e2e/screenshots/mob-07-chart.png", fullPage: false });
    }
    
    // Scroll to trade table
    const tradeTable = page.locator('text=Historial de Trades');
    if (await tradeTable.count() > 0) {
      await tradeTable.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "tests/e2e/screenshots/mob-08-trades.png", fullPage: false });
    }
    
    // Scroll to equity
    const equity = page.locator('text=Curva de Equity');
    if (await equity.count() > 0) {
      await equity.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "tests/e2e/screenshots/mob-09-equity.png", fullPage: false });
    }
    
    // Scroll to optimizer
    const optimizer = page.locator('text=Optimizador');
    if (await optimizer.count() > 0) {
      await optimizer.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "tests/e2e/screenshots/mob-10-optimizer.png", fullPage: false });
    }
  }
});
