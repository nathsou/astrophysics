/**
 * Copies stroke-order data (hanzi-writer-data, Arphic Public License; see static/strokes/LICENSE)
 * for every character in the course dictionary and lessons into static/strokes/, so writing
 * practice works offline and without a CDN.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'node_modules/hanzi-writer-data');
const out = join(root, 'static/strokes');
mkdirSync(out, { recursive: true });

const chars = new Set<string>();
const add = (text: string) => {
  for (const ch of text) if (/\p{Script=Han}/u.test(ch)) chars.add(ch);
};
add(Object.keys(JSON.parse(readFileSync(join(root, 'content/data/lexicon.json'), 'utf8'))).join(''));
add(Object.keys(JSON.parse(readFileSync(join(root, 'content/data/chars.json'), 'utf8'))).join(''));
const lessons = join(root, 'content/lessons');
if (existsSync(lessons)) for (const f of readdirSync(lessons)) if (f.endsWith('.md')) add(readFileSync(join(lessons, f), 'utf8'));

let n = 0;
const missing: string[] = [];
for (const ch of chars) {
  const file = join(src, `${ch}.json`);
  if (!existsSync(file)) {
    missing.push(ch);
    continue;
  }
  copyFileSync(file, join(out, `${ch}.json`));
  n++;
}
copyFileSync(join(src, 'ARPHICPL.TXT'), join(out, 'LICENSE'));
writeFileSync(join(out, 'README.md'), 'Stroke data from hanzi-writer-data (https://github.com/chanind/hanzi-writer-data), derived from Make Me a Hanzi and the Arphic PL fonts; distributed under the Arphic Public License (LICENSE). Regenerate with `npm run strokes`.\n');
console.log(`${n} characters copied${missing.length ? `; no data for ${missing.join('')}` : ''}`);
