/**
 * Comparison with galette itself (`validate:gal` in miniature). Skipped unless GALETTE_DIR points at a
 * checkout of https://github.com/simon-frankau/galette (MIT) that has been built with
 * `cargo build --release` (or GALETTE_BIN names the binary):
 *
 *   GALETTE_DIR=~/galette npx vitest run src/lib/pld/devices/gal22v10-galette.test.ts
 *
 * Every GAL22V10 test case of galette's suite must give the same JEDEC file byte for byte, and
 * every failing case the same message.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { PldError, assemblePld } from './gal22v10-pld';

const dir = process.env.GALETTE_DIR;
const bin = process.env.GALETTE_BIN ?? (dir ? join(dir, 'target/release/galette') : '');
const ready = !!dir && existsSync(join(dir, 'testcases')) && existsSync(bin);

describe.skipIf(!ready)('galette compatibility', () => {
  const cases = (sub: string) =>
    ready
      ? readdirSync(join(dir!, 'testcases', sub))
          .filter((f) => f.endsWith('.pld'))
          .filter((f) => readFileSync(join(dir!, 'testcases', sub, f), 'utf8').startsWith('GAL22V10\n') || readFileSync(join(dir!, 'testcases', sub, f), 'utf8').startsWith('GAL22V10\r'))
      : [];

  test.each(cases('success'))('%s assembles to galette’s JEDEC file', (f) => {
    const text = readFileSync(join(dir!, 'testcases/success', f), 'utf8');
    const expected = readFileSync(join(dir!, 'testcases/success', f.replace(/\.pld$/, '.jed')), 'utf8');
    expect(assemblePld(text).jedec()).toBe(expected);
  });

  test('security bit', () => {
    const text = readFileSync(join(dir!, 'testcases/security/security_bit.pld'), 'utf8');
    if (!text.startsWith('GAL22V10')) return;
    const expected = readFileSync(join(dir!, 'testcases/security/security_bit.jed'), 'utf8');
    expect(assemblePld(text, { security: true }).jedec()).toBe(expected);
  });

  test.each(cases('failure'))('%s fails with galette’s message', (f) => {
    const work = mkdtempSync(join(tmpdir(), 'galette-'));
    copyFileSync(join(dir!, 'testcases/failure', f), join(work, f));
    let message = '';
    try {
      execFileSync(bin, [join(work, f)], { stdio: 'pipe' });
      throw new Error('galette unexpectedly succeeded');
    } catch (e) {
      message = String((e as { stderr?: Buffer }).stderr ?? e).trim();
    }
    const text = readFileSync(join(dir!, 'testcases/failure', f), 'utf8');
    let ours = '';
    try {
      assemblePld(text);
      ours = 'no error';
    } catch (e) {
      ours = e instanceof PldError ? e.message : String(e);
    }
    expect(message.endsWith(ours)).toBe(true);
  });
});
