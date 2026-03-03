import { test, expect } from "@playwright/test";

const BASE = "https://trading-bot-saas.vercel.app";

test.setTimeout(120000);

test("backtester loads signals and renders chart", async ({ page }) => {
  // Capture console
  const consoleLogs: string[] = [];
  page.on("console", msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", err => consoleLogs.push(`[PAGE_ERROR] ${err.message}`));

  // 1. Login
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");

  await page.locator('input[type="email"]').fill("guillermolhl@hotmail.com");
  await page.locator('input[type="password"]').fill("test1234");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL("**/dashboard**", { timeout: 15000 });
  console.log("✅ Login OK, at:", page.url());

  // 2. Backtester
  await page.goto(`${BASE}/backtester`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "tests/e2e/screenshots/bt-04-backtester.png", fullPage: true });

  // 3. Click execute - force click to bypass any overlay
  const executeBtn = page.locator('button:has-text("Ejecutar Backtest")').first();
  await executeBtn.waitFor({ state: "visible", timeout: 5000 });
  console.log("Button visible, clicking...");
  
  // Try force click
  await executeBtn.click({ force: true });
  console.log("Clicked! Waiting for response...");
  
  // 4. Wait and check for state changes
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(5000);
    const bodyText = await page.locator("body").innerText();
    const hasPlaceholder = bodyText.includes("Ejecuta tu primer");
    const hasTrades = bodyText.toLowerCase().includes("trade");
    const hasLoading = bodyText.includes("Ejecutando") || bodyText.includes("Cargando");
    console.log(`[${(i+1)*5}s] placeholder=${hasPlaceholder} trades=${hasTrades} loading=${hasLoading}`);
    
    if (hasTrades && !hasPlaceholder) {
      console.log("✅ Results appeared!");
      break;
    }
  }

  await page.screenshot({ path: "tests/e2e/screenshots/bt-05-results.png", fullPage: true });

  // 5. Print console errors
  const errors = consoleLogs.filter(l => l.includes("[error]") || l.includes("[PAGE_ERROR]"));
  if (errors.length > 0) {
    console.log("--- Browser errors ---");
    errors.forEach(e => console.log(e));
  }

  // 6. Final state
  const finalText = await page.locator("body").innerText();
  console.log("Has results:", !finalText.includes("Ejecuta tu primer"));
  console.log("Canvas count:", await page.locator("canvas").count());
});
