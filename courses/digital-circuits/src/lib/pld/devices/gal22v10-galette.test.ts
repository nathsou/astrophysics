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
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { fitGal22v10, type GalDesign } from './gal22v10-fit';
import { PldError, assemblePld } from './gal22v10-pld';
import { mulberry32 } from '../twolevel/random';

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

  test('fitted random designs: the .pld the fitter writes gives galette’s JEDEC file, and the fitter’s own fuses', () => {
    const rng = mulberry32(2718);
    const work = mkdtempSync(join(tmpdir(), 'galette-fit-'));
    const expr = (vars: string[], products: number, lits: number) =>
      Array.from({ length: 1 + rng.int(products) }, () => {
        const used = new Set<string>();
        const l: string[] = [];
        while (l.length < 1 + rng.int(lits)) {
          const v = vars[rng.int(vars.length)]!;
          if (used.has(v)) continue;
          used.add(v);
          l.push(rng.chance(0.5) ? v : `!${v}`);
        }
        return l.join(' & ');
      }).join(' | ');
    for (let trial = 0; trial < 40; trial++) {
      const inputs = ['A', 'B', 'C', 'D', 'R', 'S'];
      const state = ['Q0', 'Q1', 'Q2'].slice(0, rng.int(4));
      const outputs: GalDesign['outputs'] = state.map((name) => ({ name, expr: expr([...inputs.slice(0, 4), ...state], 3, 3), registered: true, polarity: rng.chance(0.3) ? ('auto' as const) : undefined }));
      const comb = ['Y0', 'Y1', 'Y2'].slice(0, 1 + rng.int(3));
      for (const name of comb) {
        const vars = [...inputs, ...state, ...outputs.filter((o) => !o.registered).map((o) => o.name)];
        outputs.push({ name, expr: expr(vars, 4, 3), oe: rng.chance(0.3) ? 'A & !B' : undefined });
      }
      const fit = fitGal22v10({ inputs, outputs, clock: state.length ? 'CLK' : undefined, ar: rng.chance(0.4) ? 'R & !S' : undefined, sp: rng.chance(0.3) ? 'S & !R' : undefined, signature: 'RND' });
      const pld = fit.pld();
      const file = join(work, `t${trial}.pld`);
      writeFileSync(file, pld);
      execFileSync(bin, [file]);
      const jed = readFileSync(file.replace(/\.pld$/, '.jed'), 'utf8');
      expect(assemblePld(pld).jedec(), pld).toBe(jed);
      expect(fit.jedec({ style: 'galette' }), pld).toBe(jed);
    }
  });
});
