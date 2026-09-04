// Tests the thing that actually gets published.
//
// Stages the site with the same script the deploy workflow uses, serves it under
// a project-page style path (/agent-ideas/, as GitHub Pages does for a repo
// site), and drives it there. This catches what a file:// test cannot: relative
// paths that break under a subpath, assets missing from the staged output, and
// anything reaching for a third-party host.
//
//   node test/site.test.mjs

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch } from './browser.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = '/agent-ideas';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

// --- stage, exactly as the workflow does ---------------------------------
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'still-site-'));
execFileSync(path.join(REPO, 'scripts', 'stage-site.sh'), [out], { stdio: 'inherit' });

const staged = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else staged.push(path.relative(out, full));
  }
})(out);

check('the app is staged', staged.includes('index.html'));
check('the icons are staged', staged.some((f) => f.startsWith('icons/')));
check('the font licence ships with the embedded font',
  staged.includes(path.join('licenses', 'Caveat-OFL.txt')));
check('tests and package manifests are not published',
  !staged.some((f) => /^test\/|package\.json|package-lock\.json|\.github/.test(f)),
  staged.join(' '));

// --- serve it under a subpath --------------------------------------------
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (!url.startsWith(PREFIX)) { res.writeHead(404); return res.end('not found'); }
  url = url.slice(PREFIX.length) || '/';
  if (url.endsWith('/')) url += 'index.html';
  const file = path.join(out, url);
  if (!file.startsWith(out) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${PREFIX}/`;

// --- drive it -------------------------------------------------------------
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAACAAIBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==', 'base64');
const body = (pages) => JSON.stringify({ query: { pages } });
const filePage = (i) => ({ ns: 6, title: `File:S${i}.jpg`, imageinfo: [{
  thumburl: `https://upload.wikimedia.org/t${i}.jpg`,
  descriptionurl: `https://commons.wikimedia.org/wiki/File:S${i}.jpg`,
  mime: 'image/jpeg', width: 4000, height: 3000,
  extmetadata: { ObjectName: { value: `Scene ${i}` }, Artist: { value: 'A Photographer' },
    LicenseShortName: { value: 'CC BY-SA 4.0' } } }] });

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const requests = [];
const problems = [];
page.on('request', (r) => requests.push(r.url()));
page.on('pageerror', (e) => problems.push('pageerror: ' + e));
page.on('requestfailed', (r) => problems.push(`failed ${r.url()} ${r.failure()?.errorText}`));
page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });

await page.route('**://commons.wikimedia.org/w/api.php*', (r) => {
  const u = new URL(r.request().url());
  if (u.searchParams.get('prop') === 'categoryinfo') {
    return r.fulfill({ contentType: 'application/json', body: body(
      u.searchParams.get('titles').split('|')
        .map((t) => ({ ns: 14, title: t, categoryinfo: { files: 200 } }))) });
  }
  return r.fulfill({ contentType: 'application/json',
    body: body(Array.from({ length: 30 }, (_, i) => filePage(i))) });
});
await page.route('**://upload.wikimedia.org/**', (r) =>
  r.fulfill({ contentType: 'image/jpeg', body: JPEG }));

await page.goto(base);
await page.waitForSelector('.shot.active', { timeout: 15000 });
check('the app runs from a project-page URL', !!(await page.getAttribute('.shot.active', 'src')));

const before = await page.getAttribute('.shot.active', 'src');
await page.mouse.click(640, 400);
await page.waitForFunction((p) =>
  document.querySelector('.shot.active')?.getAttribute('src') !== p, before, { timeout: 5000 });
check('clicking advances when served over http', true);

check('the manifest resolves under the subpath', await page.evaluate(async () =>
  (await fetch(document.querySelector('link[rel=manifest]').href)).ok));
check('every icon the manifest names exists', await page.evaluate(async () => {
  const href = document.querySelector('link[rel=manifest]').href;
  const manifest = await (await fetch(href)).json();
  for (const icon of manifest.icons) {
    if (!(await fetch(new URL(icon.src, href))).ok) return false;
  }
  return true;
}));
check('the home-screen icon resolves', await page.evaluate(async () =>
  (await fetch(document.querySelector('link[rel=apple-touch-icon]').href)).ok));

check('the embedded handwriting font is available without a network request',
  await page.evaluate(() => document.fonts.check('600 40px Caveat')));

const offsite = requests.filter((u) =>
  !u.startsWith(`http://127.0.0.1:${server.address().port}`) && !/wikimedia\.org/.test(u));
check('nothing is fetched from a third party', offsite.length === 0, offsite.join(' ') || 'none');
check('nothing 404s or fails to load', problems.length === 0, problems.join(' | '));

await browser.close();
server.close();
fs.rmSync(out, { recursive: true, force: true });

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
