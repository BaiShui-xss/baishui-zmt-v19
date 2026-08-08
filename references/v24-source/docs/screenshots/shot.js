const { chromium } = require('/Users/xiongsishui/.workbuddy/binaries/node/workspace/node_modules/playwright');
const fs = require('fs');

const OUT = '/Users/xiongsishui/WorkBuddy/个人工作台/新媒体运营工作台/docs/screenshots/v24-final';
fs.mkdirSync(OUT, { recursive: true });
const URL = 'https://b5053b29b4f74f0293cbae7a057ab833.sh4.agentos-app.net';
const CHROME = '/Users/xiongsishui/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const noProxy = { ...process.env, HTTP_PROXY:'', HTTPS_PROXY:'', http_proxy:'', https_proxy:'', ALL_PROXY:'', all_proxy:'' };

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, env: noProxy, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  const closeMask = async () => { await page.evaluate(() => { const m = document.getElementById('mask'); if (m) m.classList.remove('show'); }); await sleep(350); };
  const closeSettings = async () => { await page.evaluate(() => { const m = document.getElementById('settingsMask'); if (m) m.classList.remove('show'); }); await sleep(350); };

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.clear(); } catch(e){} });
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(1800);

  // 1. Dashboard
  await page.screenshot({ path: OUT + '/01-dashboard.png' });

  // 2. Account edit modal
  await page.click('.acard[data-act="edit-account"]', { timeout: 10000 });
  await sleep(700);
  await page.screenshot({ path: OUT + '/02-account-edit.png' });
  await closeMask();

  // 3. Sidebar
  const sb = await page.$('#sidebar');
  if (sb) await sb.screenshot({ path: OUT + '/03-sidebar.png' });

  // 4. Module-internal batch select (memo)
  console.log('step4: goto memo');
  await page.evaluate(() => { if (typeof go === 'function') go('memo'); });
  await sleep(800);
  // open batch mode via in-page handler
  const opened = await page.evaluate(() => {
    const btn = document.querySelector('#view-memo .card-batch-toggle');
    if (!btn) return false;
    btn.click();
    return true;
  });
  console.log('step4 batch toggle opened=', opened);
  await sleep(600);
  const cbInfo = await page.evaluate(() => {
    const list = [...document.querySelectorAll('#view-memo .card-cb')];
    list.slice(0,2).forEach(c => { c.checked = true; c.dispatchEvent(new Event('change', {bubbles:true})); });
    return { total: list.length, checked: list.filter(c=>c.checked).length };
  });
  console.log('step4 checkboxes', JSON.stringify(cbInfo));
  await sleep(500);
  await page.screenshot({ path: OUT + '/04-batch-select.png' });

  // 5. Selected state before delete + result after confirming
  await page.screenshot({ path: OUT + '/05-batch-selection.png' });
  // Accept native confirm to perform delete, then capture the updated list
  let dlgFired = false;
  page.on('dialog', async d => { dlgFired = true; await d.accept(); });
  const delClicked = await page.evaluate(() => {
    const btn = document.querySelector('#view-memo .card-batch-delete:not([disabled])');
    if (!btn) return false;
    btn.click();
    return true;
  });
  console.log('step5 delete clicked=', delClicked, 'dialogFired=', dlgFired);
  await sleep(900);
  await page.screenshot({ path: OUT + '/05-batch-after-delete.png' });

  // 6. Settings → clear data
  await page.click('#settingsBtn', { timeout: 10000 });
  await sleep(700);
  await page.screenshot({ path: OUT + '/06-settings-clear.png' });

  await browser.close();
  console.log('SHOTS DONE. errors=' + JSON.stringify(errors));
})().catch(e => { console.error('FATAL', e && e.message ? e.message : e); process.exit(1); });
