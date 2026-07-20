const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:4173';
const SCREENSHOTS = '/tmp/musika-test-screenshots';
const CHROME = '/usr/bin/google-chrome-stable';

const ROUTES = [
  { path: '/', name: 'Home' },
  { path: '/search', name: 'Search' },
  { path: '/favorites', name: 'Favorites' },
  { path: '/history', name: 'History' },
  { path: '/playlists', name: 'Playlists' },
  { path: '/profile', name: 'Profile' },
  { path: '/download-app', name: 'Download App' },
  { path: '/download', name: 'Download Alt' },
  { path: '/auth', name: 'Auth' },
  { path: '/ai', name: 'AI Chat' },
  { path: '/nonexistent', name: '404 Not Found' },
];

const results = [];
let errors = [];
let consoleLogs = [];

fs.mkdirSync(SCREENSHOTS, { recursive: true });

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function testRoute(page, route) {
  const start = Date.now();
  try {
    const response = await page.goto(`${BASE}${route.path}`, {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });

    // Wait for splash screen to disappear (1.9s + transition)
    await sleep(2500);

    const status = response ? response.status() : 'no response';
    const url = page.url();
    const title = await page.title();

    await page.screenshot({
      path: `${SCREENSHOTS}/${route.name.replace(/\s+/g, '_')}.png`,
      fullPage: false,
    });

    // Check page content
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 200) || '');
    const hasContent = bodyText.length > 10;

    results.push({
      route: route.path,
      name: route.name,
      status,
      title,
      hasContent,
      url,
      time: Date.now() - start,
      passed: status === 200 && hasContent,
    });

    console.log(`[${status}] ${route.path} -> ${title} (${Date.now() - start}ms)`);
  } catch (e) {
    results.push({
      route: route.path,
      name: route.name,
      status: 'ERROR',
      error: e.message,
      passed: false,
    });
    console.error(`[ERROR] ${route.path}: ${e.message}`);
  }
}

async function testInteractive(page) {
  const interactions = [];

  // Test clicks on available buttons and links
  try {
    const clickables = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('a, button, [role="button"], [tabindex="0"]').forEach(el => {
        const text = el.textContent?.trim()?.substring(0, 50) || el.getAttribute('aria-label') || el.tagName;
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0) {
          items.push({ text, tag: el.tagName, href: el.href || '' });
        }
      });
      return items.slice(0, 20);
    });

    interactions.push({ type: 'clickables_found', count: clickables.length, items: clickables });
    console.log(`Found ${clickables.length} clickable elements`);

    // Try clicking first few clickables
    for (let i = 0; i < Math.min(5, clickables.length); i++) {
      try {
        const el = clickables[i];
        const els = await page.$$('a, button, [role="button"]');
        if (els[i]) {
          await els[i].click();
          await sleep(1000);
          interactions.push({ type: 'click', target: el.text, success: true, url: page.url() });
        }
      } catch (e) {
        interactions.push({ type: 'click', target: clickables[i]?.text, success: false, error: e.message });
      }
    }
  } catch (e) {
    interactions.push({ type: 'error', message: e.message });
  }

  return interactions;
}

async function run() {
  console.log('=== MUSIKA E2E TEST SUITE ===\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1080,2400',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 2400 });

  // Collect console errors and logs
  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    errors.push({ type: 'page_error', message: err.message, stack: err.stack });
  });
  page.on('requestfailed', (req) => {
    errors.push({ type: 'request_failed', url: req.url(), error: req.failure()?.errorText });
  });

  // 1. Test all routes
  console.log('\n--- Testing Routes ---\n');
  for (const route of ROUTES) {
    await testRoute(page, route);
  }

  // 2. Go back to home for interactive testing
  console.log('\n--- Interactive Testing ---\n');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 15000 });
  await sleep(2500);
  await page.screenshot({ path: `${SCREENSHOTS}/Home_after_nav.png` });

  const interactions = await testInteractive(page);

  // 3. Check dark mode
  console.log('\n--- Dark Mode Check ---\n');
  const themeColor = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    return meta ? meta.getAttribute('content') : 'not found';
  });
  console.log(`Theme color: ${themeColor}`);

  // 4. Responsive check
  console.log('\n--- Responsive Check ---\n');
  await page.setViewport({ width: 375, height: 812 }); // iPhone X
  await sleep(1000);
  await page.screenshot({ path: `${SCREENSHOTS}/Responsive_375x812.png` });
  console.log('Mobile screenshot taken (375x812)');

  await page.setViewport({ width: 768, height: 1024 }); // iPad
  await sleep(1000);
  await page.screenshot({ path: `${SCREENSHOTS}/Responsive_768x1024.png` });
  console.log('Tablet screenshot taken (768x1024)');

  await browser.close();

  // ========== REPORT ==========
  console.log('\n========== TEST REPORT ==========\n');

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Routes tested: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Console errors: ${errors.length}`);
  console.log(`Console logs: ${consoleLogs.length}`);

  console.log('\n--- Route Results ---\n');
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.name} (${r.route}) -> ${r.status} ${r.error || ''}`);
  }

  if (errors.length > 0) {
    console.log('\n--- Errors Found ---\n');
    for (const e of errors) {
      console.log(`[${e.type}] ${e.message || e.error || e.url}`);
    }
  }

  // Write report
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE,
    summary: { total, passed, failed, errorCount: errors.length, consoleLogs: consoleLogs.length },
    routes: results,
    errors,
    interactions,
    screenshots: fs.readdirSync(SCREENSHOTS),
  };

  fs.writeFileSync('/tmp/musika-test-report.json', JSON.stringify(report, null, 2));
  console.log('\nReport saved to /tmp/musika-test-report.json');

  // Final verdict
  const ok = failed === 0 && errors.length === 0;
  console.log(`\n${ok ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  process.exit(ok ? 0 : 1);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
