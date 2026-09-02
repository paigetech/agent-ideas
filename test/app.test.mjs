// Browser tests for Still.
//
// The Wikimedia Commons API and the image CDN are both mocked, so these run
// without a network connection and never touch Wikimedia's servers.
//
//   npm i playwright && npx playwright install chromium
//   node test/app.test.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import zlib from 'node:zlib';

const APP = 'file://' + join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html');

// --------------------------------------------------------------------------
// Launching, wherever Chromium happens to live
// --------------------------------------------------------------------------

function discoverChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith('chromium-')) continue;
    const bin = join(root, entry, 'chrome-linux', 'chrome');
    if (existsSync(bin)) return bin;
  }
  return undefined;
}

async function launch() {
  const args = ['--no-sandbox'];
  try {
    return await chromium.launch({ args });
  } catch (err) {
    const executablePath = discoverChromium();
    if (!executablePath) throw err;
    return chromium.launch({ args, executablePath });
  }
}

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

// A real 2x2 JPEG, so the browser's image decoder is genuinely exercised.
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAACAAIBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==', 'base64');

const body = (pages) => JSON.stringify({ batchcomplete: true, query: { pages } });

function filePage(i, opts = {}) {
  return {
    ns: 6,
    title: opts.title || `File:Scene ${i}.jpg`,
    imageinfo: [{
      thumburl: `https://upload.wikimedia.org/thumb-${i}.jpg`,
      descriptionurl: `https://commons.wikimedia.org/wiki/File:Scene_${i}.jpg`,
      mime: opts.mime || 'image/jpeg',
      width: opts.width ?? 4000,
      height: 3000,
      extmetadata: {
        ObjectName: { value: `<span lang="en">Lake ${i} at dawn</span>` },
        Artist: { value: `<a href="//commons.wikimedia.org/wiki/User:P">Photographer ${i}</a>` },
        LicenseShortName: { value: 'CC BY-SA 4.0' },
        LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' },
      },
    }],
  };
}

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass });
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

const shownSrc = (page) => page.evaluate(() =>
  document.querySelector('.layer.active')?.getAttribute('src') || null);

const browser = await launch();

// Wires up a page with Commons mocked. `categoryFiles: 0` makes every candidate
// category look empty; `imageFailFor` aborts selected image requests.
async function mount({
  categoryFiles = 300, imageFailFor = null, viewport = { width: 1280, height: 800 },
  contextOpts = {}, batch = 40, virtualClock = false,
} = {}) {
  const ctx = await browser.newContext({ viewport, ...contextOpts });
  const page = await ctx.newPage();
  if (virtualClock) await page.clock.install();
  const calls = [];

  await page.route('**://commons.wikimedia.org/w/api.php*', (route) => {
    const url = new URL(route.request().url());
    calls.push(url);

    if (url.searchParams.get('prop') === 'categoryinfo') {
      const titles = url.searchParams.get('titles').split('|');
      return route.fulfill({ contentType: 'application/json', body: body(
        titles.map((t, i) => (i % 3 === 0 || !categoryFiles
          ? { ns: 14, title: t, missing: true }
          : { ns: 14, title: t, categoryinfo: { files: categoryFiles } })))});
    }

    const generator = url.searchParams.get('generator');
    const seed = generator === 'search'
      ? 5000 : (url.searchParams.get('gcmtitle') || '').length * 1000;
    const pages = Array.from({ length: batch }, (_, i) => filePage(seed + i));
    // Things that live in these categories but are not photographs.
    pages.push(filePage(9001, { title: 'File:Map of the valley.jpg' }));
    pages.push(filePage(9002, { mime: 'image/svg+xml' }));
    pages.push(filePage(9003, { width: 400 }));
    pages.push({ ns: 6, title: 'File:No imageinfo.jpg' });
    return route.fulfill({ contentType: 'application/json', body: body(pages) });
  });

  await page.route('**://upload.wikimedia.org/**', (route) => {
    const url = route.request().url();
    calls.push(new URL(url));
    if (imageFailFor && imageFailFor(url)) return route.abort('failed');
    return route.fulfill({ contentType: 'image/jpeg', body: JPEG });
  });

  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    // A deliberately-aborted image logs a resource error; that is the scenario
    // under test, not a defect. Everything else counts.
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) {
      errors.push('console: ' + m.text());
    }
  });

  return { ctx, page, calls, errors };
}

// --------------------------------------------------------------------------
console.log('\n# showing a photo');
{
  const { ctx, page, calls, errors } = await mount();
  await page.goto(APP);
  await page.waitForSelector('.layer.active', { timeout: 10000 });

  check('a photo appears on load', !!(await shownSrc(page)));

  const credit = await page.textContent('#credit');
  check('credit names the place, the photographer and the licence',
    /Lake .* at dawn/.test(credit) && /Photographer/.test(credit) &&
    /CC BY-SA 4\.0/.test(credit) && /Wikimedia Commons/.test(credit));

  check('licence is a real link, and HTML in the metadata is stripped',
    (await page.getAttribute('#credit a', 'href')) ===
      'https://creativecommons.org/licenses/by-sa/4.0' && !/</.test(credit));

  const members = calls.filter((u) => u.searchParams.get('generator') === 'categorymembers');
  check('only uses a category Commons confirmed exists', members.length > 0,
    members[0]?.searchParams.get('gcmtitle'));
  check('requests a screen-sized copy, not the full-resolution original',
    Number(members[0].searchParams.get('iiurlwidth')) >= 1280);
  check('sends origin=* so CORS works from file://',
    members[0].searchParams.get('origin') === '*');

  const requested = calls.filter((u) => u.hostname === 'upload.wikimedia.org').map((u) => u.href);
  check('never downloads the map, the SVG, the small file or the entry with no info',
    !requested.some((u) => /thumb-900[123]\.jpg/.test(u)));

  check('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// --------------------------------------------------------------------------
console.log('\n# clicking through');
{
  const { ctx, page, errors } = await mount();
  await page.goto(APP);
  await page.waitForSelector('.layer.active');

  const first = await shownSrc(page);
  await page.mouse.click(640, 400);
  await page.waitForFunction((prev) =>
    document.querySelector('.layer.active')?.getAttribute('src') !== prev, first, { timeout: 5000 });
  check('clicking anywhere shows a different photo', (await shownSrc(page)) !== first);

  // The whole point: the next one is already in memory, so this is a swap.
  const t0 = Date.now();
  const cur = await shownSrc(page);
  await page.keyboard.press('Space');
  await page.waitForFunction((prev) =>
    document.querySelector('.layer.active')?.getAttribute('src') !== prev, cur, { timeout: 5000 });
  const swapMs = Date.now() - t0;
  check('the next photo is preloaded, so the swap is instant', swapMs < 250, swapMs + 'ms');

  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    await page.mouse.click(640, 400);
    await page.waitForTimeout(60);
    const s = await shownSrc(page);
    if (s) seen.add(s);
  }
  check('impatient clicking keeps producing photos, and never repeats',
    seen.size >= 20, seen.size + ' distinct');

  await page.waitForTimeout(2000);
  check('stacked layers are cleaned up afterwards',
    (await page.evaluate(() => document.querySelectorAll('#stage .layer').length)) <= 2);
  check('refills the queue without being asked',
    (await page.evaluate(() => document.querySelectorAll('img').length)) <= 2);

  check('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// --------------------------------------------------------------------------
console.log('\n# controls and preferences');
{
  const { ctx, page, errors } = await mount();
  await page.goto(APP);
  await page.waitForSelector('.layer.active');
  await page.mouse.move(640, 400);

  await page.click('#btn-breathe');
  check('breathing guide turns on', await page.evaluate(() =>
    document.body.classList.contains('breathing') &&
    getComputedStyle(document.querySelector('#breath')).display !== 'none'));

  await page.click('#btn-fit');
  check('fit switches the photo to contain', await page.evaluate(() =>
    getComputedStyle(document.querySelector('.layer.active')).objectFit === 'contain'));

  await page.keyboard.press('b');
  check('the b key turns breathing back off',
    !(await page.evaluate(() => document.body.classList.contains('breathing'))));

  await page.reload();
  await page.waitForSelector('.layer.active');
  check('preferences survive a reload', await page.evaluate(() =>
    document.body.classList.contains('fit-contain') &&
    !document.body.classList.contains('breathing')));

  const cur = await shownSrc(page);
  await page.mouse.move(640, 400);
  await page.click('#btn-fit');
  await page.waitForTimeout(400);
  check('clicking a control does not also advance the photo', (await shownSrc(page)) === cur);

  check('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// --------------------------------------------------------------------------
console.log('\n# the interface gets out of the way');
{
  const { ctx, page } = await mount();
  await page.goto(APP);
  await page.waitForSelector('.layer.active');
  await page.mouse.move(640, 400);
  await page.waitForTimeout(300);
  check('chrome is visible while you are moving',
    await page.evaluate(() => document.body.classList.contains('chrome-visible')));
  await page.waitForTimeout(3200);
  check('chrome fades away when you go still',
    await page.evaluate(() => !document.body.classList.contains('chrome-visible')));
  await page.mouse.move(300, 300);
  await page.waitForTimeout(200);
  check('chrome comes back on movement',
    await page.evaluate(() => document.body.classList.contains('chrome-visible')));
  await ctx.close();
}

// --------------------------------------------------------------------------
console.log('\n# when things go wrong');
{
  const { ctx, page, calls, errors } = await mount({ categoryFiles: 0 });
  await page.goto(APP);
  await page.waitForSelector('.layer.active', { timeout: 10000 });
  check('falls back to search when no category resolves',
    calls.some((u) => u.searchParams.get('generator') === 'search'));
  check('no page errors on the fallback path', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

{
  let n = 0;
  const { ctx, page, errors } = await mount({ imageFailFor: () => (n++ % 3 !== 2) });
  await page.goto(APP);
  await page.waitForSelector('.layer.active', { timeout: 15000 });
  check('skips photos that fail to download and shows one that works',
    (await page.evaluate(() => document.querySelector('.layer.active').naturalWidth)) > 0);
  check('no page errors while skipping', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

{
  // Commons entirely unreachable, then back.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let online = false;
  await page.route('**://commons.wikimedia.org/**', (route) => online
    ? route.fulfill({ contentType: 'application/json',
        body: body(Array.from({ length: 20 }, (_, i) => filePage(i))) })
    : route.abort('failed'));
  await page.route('**://upload.wikimedia.org/**', (route) =>
    route.fulfill({ contentType: 'image/jpeg', body: JPEG }));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(APP);
  await page.waitForSelector('#retry', { timeout: 15000 });
  check('offline shows a plain-language message, not a stack trace',
    /could not be reached/i.test(await page.textContent('#status')));

  online = true;
  await page.click('#retry');
  await page.waitForSelector('.layer.active', { timeout: 15000 });
  check('retry recovers once the network is back', !!(await shownSrc(page)));
  check('no unhandled rejections while offline', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// --------------------------------------------------------------------------
console.log('\n# the check-in');
{
  const { ctx, page } = await mount({ virtualClock: true });
  await page.goto(APP);
  await page.waitForSelector('.layer.active', { timeout: 15000 });
  const shown = () => page.evaluate(() =>
    document.querySelector('#checkin').classList.contains('show'));

  check('hidden at the start', !(await shown()));
  await page.clock.runFor('05:00');
  check('still hidden after five minutes', !(await shown()));

  await page.clock.runFor('11:00');
  const text = await page.textContent('#checkin');
  check('appears after fifteen active minutes', await shown());
  check('the wording is a question, not a scold',
    /Still what you need/i.test(text) && !/(stop|wasting|too long|you should)/i.test(text));

  await page.click('#checkin');
  check('tapping dismisses it', !(await shown()));
  await page.clock.runFor('30:00');
  check('it never returns a second time', !(await shown()));
  await ctx.close();
}

{
  const { ctx, page } = await mount({ virtualClock: true });
  await page.goto(APP);
  await page.waitForSelector('.layer.active', { timeout: 15000 });
  await page.evaluate(() =>
    Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }));
  await page.clock.runFor('40:00');
  check('time spent in a background tab does not count',
    !(await page.evaluate(() => document.querySelector('#checkin').classList.contains('show'))));
  await ctx.close();
}

// --------------------------------------------------------------------------
console.log('\n# on a phone');
{
  const { ctx, page } = await mount({
    viewport: { width: 390, height: 844 },
    contextOpts: { deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  });
  await page.goto(APP);
  await page.waitForSelector('.layer.active', { timeout: 10000 });

  const overflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - window.innerWidth,
    y: document.documentElement.scrollHeight - window.innerHeight,
  }));
  check('nothing scrolls', overflow.x <= 0 && overflow.y <= 0, JSON.stringify(overflow));

  const before = await shownSrc(page);
  await page.touchscreen.tap(195, 400);
  await page.waitForFunction((p) =>
    document.querySelector('.layer.active')?.getAttribute('src') !== p, before, { timeout: 5000 });
  check('tapping advances', true);
  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
