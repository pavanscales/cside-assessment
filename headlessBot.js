const fs = require('fs');
const { chromium, devices } = require('playwright');

const TARGET = 'https://cside-assesment.vercel.app';
const OUTFILE = 'bot-test-results.json';

async function grabDiagnostics(page) {
  try {
    await page.waitForTimeout(500);
    const json = await page.evaluate(() => {
      if (window.__BOT_DETECTION_OUTPUT__) return window.__BOT_DETECTION_OUTPUT__;
      const pre = document.querySelector('pre');
      if (pre) {
        try { return JSON.parse(pre.innerText); } catch (e) { return { raw: pre.innerText }; }
      }
      return { summary: undefined, signals: [] };
    });
    return json;
  } catch (err) {
    return { error: String(err) };
  }
}

function reportScenario(results, name) {
  return { scenario: name, timestamp: new Date().toISOString(), result: results };
}

async function doHumanInteraction(page) {
  for (let i = 0; i < 30; i++) {
    await page.mouse.move(100 + Math.random() * 300, 100 + Math.random() * 200, { steps: 3 });
    if (i % 5 === 0) await page.mouse.click(120 + Math.random() * 200, 120 + Math.random() * 100);
    await page.waitForTimeout(40 + Math.random() * 80);
  }
  await page.keyboard.type('hello test', { delay: 50 });
  await page.waitForTimeout(300);
}

async function doPerfectRegularMotion(page, events = 100, intervalMs = 20) {
  for (let i = 0; i < events; i++) {
    const x = 10 + (i % 50) * 5;
    const y = 10 + Math.floor(i / 50) * 5;
    await page.mouse.move(x, y);
    await page.waitForTimeout(intervalMs);
  }
}

async function runScenario({ name, launchOptions = {}, contextOptions = {}, initScript = null, actions = null, waitAfter = 7000 }) {
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  if (initScript) await page.addInitScript(initScript);
  await page.goto(TARGET, { waitUntil: 'domcontentloaded' });
  if (actions) {
    try {
      await actions(page);
    } catch (e) {
      console.error(`[${name}] action error`, e);
    }
  }
  await page.waitForTimeout(waitAfter);
  const diag = await grabDiagnostics(page);
  await browser.close();
  return reportScenario(diag, name);
}

(async () => {
  const results = [];

  results.push(await runScenario({
    name: 'human-headful-baseline',
    launchOptions: { headless: false },
    actions: async (page) => {
      await doHumanInteraction(page);
    },
    waitAfter: 3000
  }));

  results.push(await runScenario({
    name: 'headless-default-noinput',
    launchOptions: { headless: true },
    actions: null,
    waitAfter: 6000
  }));

  results.push(await runScenario({
    name: 'headless-force-webdriver',
    launchOptions: { headless: true },
    initScript: `Object.defineProperty(navigator, 'webdriver', { get: () => true }); window.__AUTOMATION_INJECTED__ = true;`,
    actions: null,
    waitAfter: 6000
  }));

  results.push(await runScenario({
    name: 'headless-ua-spoof',
    launchOptions: { headless: true },
    contextOptions: { userAgent: 'HeadlessChrome/1.0 (automated)' },
    actions: null,
    waitAfter: 6000
  }));

  results.push(await runScenario({
    name: 'headless-perfect-regular-motion',
    launchOptions: { headless: true },
    actions: async (page) => {
      await doPerfectRegularMotion(page, 200, 12);
    },
    waitAfter: 1000
  }));

  results.push(await runScenario({
    name: 'headless-automation-globals',
    launchOptions: { headless: true },
    initScript: `
      window.__nightmare = true;
      window.__selenium_unwrapped = true;
      window.__driver_evaluate = true;
      try { Object.defineProperty(navigator, 'webdriver', { get: () => true }); } catch(e) {}
    `,
    waitAfter: 6000
  }));

  results.push(await runScenario({
    name: 'headless-rapid-resize-blur',
    launchOptions: { headless: true },
    actions: async (page) => {
      await page.evaluate(() => {
        window.resizeTo(300,300); window.dispatchEvent(new Event('resize'));
        window.resizeTo(1200,800); window.dispatchEvent(new Event('resize'));
        window.dispatchEvent(new Event('blur'));
        window.dispatchEvent(new Event('focus'));
      });
    },
    waitAfter: 4000
  }));

  results.push(await runScenario({
    name: 'mobile-emulation-touch',
    launchOptions: { headless: true },
    contextOptions: { ...devices['iPhone 13'] },
    actions: async (page) => {
      await page.touchscreen.tap(100, 200);
      await page.evaluate(() => window.dispatchEvent(new Event('gesturestart')));
    },
    waitAfter: 4000
  }));

  results.push(await runScenario({
    name: 'headless-slow-network',
    launchOptions: { headless: true },
    actions: async (page) => {
      await page.route('**/*', route => route.continue());
    },
    waitAfter: 9000
  }));

  results.push(await runScenario({
    name: 'headless-force-flag-query-param',
    launchOptions: { headless: true },
    actions: async (page) => {
      await page.goto(TARGET + '?forceAutomation=true', { waitUntil: 'domcontentloaded' });
    },
    waitAfter: 4000
  }));

  fs.writeFileSync(OUTFILE, JSON.stringify({ target: TARGET, results }, null, 2));
  console.log('Saved results to', OUTFILE);
  console.log(JSON.stringify({ target: TARGET, results }, null, 2));
  process.exit(0);
})();
