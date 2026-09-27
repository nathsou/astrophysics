/**
 * A minimal Chrome DevTools Protocol driver for checking pages without a visible browser.
 *
 *   node scripts/cdp.mjs <url> <steps.json> [width] [height]
 *
 * Steps run in order:
 *   { "eval": "js expression" }                 evaluated in the page (may use await); result printed
 *   { "cdp": "Input.insertText", "params": {} } any raw CDP command
 *   { "wait": 5000 }                             milliseconds
 *   { "shot": "name", "widget": "title text" }  screenshot of the figure.widget whose title contains the text
 *   { "shot": "name", "selector": "css" }        screenshot of an element (or the viewport without either)
 * Screenshots go to $SHOTS_DIR (default: <tmp>/lm-shots). Console errors and exceptions are printed at the end.
 * Extra Chrome flags can be passed in $CHROME_FLAGS (space-separated).
 */
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const shotsDir = process.env.SHOTS_DIR ?? join(tmpdir(), 'lm-shots');
mkdirSync(shotsDir, { recursive: true });
const [url, scriptPath, width = '1280', height = '900'] = process.argv.slice(2);
const steps = JSON.parse(readFileSync(scriptPath, 'utf8'));
const port = 9300 + Math.floor(Math.random() * 500);
// Chrome: $CHROME, or the usual install locations on macOS and Linux.
const candidates = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'];
const chromePath = candidates.find((c) => c && existsSync(c));
if (!chromePath) throw new Error('Chrome not found; set CHROME=/path/to/chrome');
const chrome = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${port}`, '--enable-unsafe-webgpu', '--enable-features=Vulkan',
  `--window-size=${width},${height}`, '--user-data-dir=' + join(tmpdir(), 'lm-chrome-' + port), '--no-first-run',
  // On Linux, headless Chrome falls back to SwiftShader (a CPU WebGPU) unless ANGLE uses Vulkan.
  ...(process.platform === 'linux' ? ['--use-angle=vulkan', '--ignore-gpu-blocklist'] : []),
  ...(process.env.CHROME_FLAGS?.split(' ').filter(Boolean) ?? []), 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method === 'Runtime.consoleAPICalled' && ['error','warning'].includes(d.params.type)) logs.push(d.params.type + ': ' + d.params.args.map(a => a.value ?? a.description).join(' ')); else if (d.method === 'Runtime.exceptionThrown') logs.push('exception: ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text)); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +width, height: +height, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(3000);
for (const s of steps) {
  if (s.eval) { const r = await send('Runtime.evaluate', { expression: `(async () => (${s.eval}))()`, awaitPromise: true, returnByValue: true }); console.log('eval →', JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description ?? r.result).slice(0, 2000)); }
  if (s.cdp) { const r = await send(s.cdp, s.params ?? {}); console.log('cdp', s.cdp, JSON.stringify(r.error ?? 'ok')); }
  if (s.wait) await sleep(s.wait);
  if (s.shot) {
    let clip;
    if (s.widget) s.selector = `__w`;
    if (s.selector) {
      const find = s.widget ? `[...document.querySelectorAll('figure.widget')].find(f => f.querySelector('h4')?.textContent.includes(${JSON.stringify(s.widget ?? '')}))` : `document.querySelector(${JSON.stringify(s.selector)})`;
      const r = await send('Runtime.evaluate', { expression: `(() => { const e = ${find}; e.scrollIntoView({block: 'start'}); window.scrollBy(0, -20); return null; })()`, returnByValue: true });
      await sleep(400);
      const b = await send('Runtime.evaluate', { expression: `(() => { const r = ${find}.getBoundingClientRect(); return {x: r.x, y: r.y + scrollY, w: r.width, h: r.height}; })()`, returnByValue: true });
      const v = b.result.result.value; clip = { x: v.x, y: v.y, width: v.w, height: Math.min(v.h, 4000), scale: 1 };
    }
    const r = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
    writeFileSync(join(shotsDir, `${s.shot}.png`), Buffer.from(r.result.data, 'base64')); console.log('shot', s.shot);
  }
}
console.log(logs.slice(0, 30).join('\n'));
ws.close(); chrome.kill("SIGKILL");
process.exit(0);
