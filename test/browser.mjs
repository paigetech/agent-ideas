// Launching Chromium, wherever it happens to live: Playwright's own download in
// CI and on a laptop, or a preinstalled build pointed at by
// PLAYWRIGHT_BROWSERS_PATH.
import { chromium } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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

export async function launch() {
  const args = ['--no-sandbox'];
  try {
    return await chromium.launch({ args });
  } catch (err) {
    const executablePath = discoverChromium();
    if (!executablePath) throw err;
    return chromium.launch({ args, executablePath });
  }
}
