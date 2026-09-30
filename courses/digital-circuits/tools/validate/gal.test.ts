import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assemblePld } from '../../src/lib/pld/devices/gal22v10-pld';
import type { Logger, Runner, ToolResult } from './common';
import { compareGalCase, compareSuite, courseGalCases, galetteSuite, galetteVersionOf, locateGalette, main } from './gal';

const collect = (): Logger & { lines: string[] } => {
  const lines: string[] = [];
  return { lines, log: (l) => void lines.push(l), error: (l) => void lines.push(l) };
};

/** A stand-in for galette that assembles with the course's own assembler (so it agrees), or damages the file. */
function fakeGalette(damage = false): Runner {
  return (command, args): ToolResult => {
    if (args[0] === '--version') return { status: 0, stdout: 'galette 0.3.0\n', stderr: '' };
    const file = args[args.length - 1]!;
    try {
      let jed = assemblePld(readFileSync(file, 'utf8')).jedec();
      if (damage) jed = jed.replace(/^(\*L\d+ )1/m, '$10');
      writeFileSync(file.replace(/\.pld$/, '.jed'), jed);
      return { status: 0, stdout: '', stderr: '' };
    } catch (e) {
      return { status: 1, stdout: '', stderr: (e as Error).message };
    }
  };
}

// Any executable file does as the "galette" binary; the fake runner never starts it.
const ENV = { GALETTE: process.execPath, PATH: '' };

describe('the course’s GAL cases', () => {
  const cases = courseGalCases();
  it('cover the Studio examples, Chapter 26’s fixtures and the polarity demo', () => {
    const groups = new Set(cases.map((c) => c.group));
    expect([...groups].sort()).toEqual(['chapter 26', 'chapter 26 polarity demo', 'studio']);
    expect(cases.filter((c) => c.group === 'studio').map((c) => c.name)).toEqual(['traffic-light', 'seven-segment', 'counter', 'decoder']);
    expect(cases.filter((c) => c.group === 'chapter 26').map((c) => c.name)).toEqual(['decoder', 'traffic', 'sevenseg']);
    expect(cases).toHaveLength(10);
  });

  it('agree with themselves: the fitter, its writer and the .pld assembler give the same fuses', () => {
    for (const c of cases) {
      const jed = assemblePld(c.pld).jedec();
      expect(compareGalCase(c, jed).problems, c.name).toEqual([]);
    }
  });

  it('notice one fuse that differs, and a stale fixture', () => {
    const c = cases[0]!;
    const good = assemblePld(c.pld).jedec();
    const bad = good.replace(/^(\*L\d+ )1/m, '$10');
    const problems = compareGalCase(c, bad).problems.join('\n');
    expect(problems).toMatch(/galette-style JEDEC file differs from galette's file at line \d+/);
    expect(problems).toMatch(/assembled from the fitter's \.pld differs/);
    expect(problems).toMatch(/different fuse \d+/);
    const fixture = cases.find((x) => x.frozen)!;
    const stale = compareGalCase({ ...fixture, frozen: { ...fixture.frozen!, jedec: fixture.frozen!.jedec.replace('QF5892', 'QF5893') } }, assemblePld(fixture.pld).jedec());
    expect(stale.problems.join('\n')).toMatch(/frozen galette JEDEC fixture is stale/);
  });
});

describe('galette’s own suite', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'galette-fake-'));
  mkdirSync(path.join(dir, 'testcases/success'), { recursive: true });
  mkdirSync(path.join(dir, 'testcases/failure'), { recursive: true });
  const ok = 'GAL22V10\nT\n\nClock I0 I1 I2 I3 I4 I5 I6 I7 I8 I9 GND\n/OE O0 O1 O2 O3 O4 O5 O6 O7 O8 O9 VCC\n\nO0 = I0 * I1\n\nDESCRIPTION\n\nx\n';
  writeFileSync(path.join(dir, 'testcases/success/one.pld'), ok);
  writeFileSync(path.join(dir, 'testcases/success/one.jed'), assemblePld(ok).jedec());
  writeFileSync(path.join(dir, 'testcases/success/gal16v8.pld'), 'GAL16V8\nT\n');
  writeFileSync(path.join(dir, 'testcases/failure/bad.pld'), 'GAL22V10\nT\n\nClock I0 I1 I2 I3 I4 I5 I6 I7 I8 I9 GND\n/OE O0 O1 O2 O3 O4 O5 O6 O7 O8 O9 VCC\n\nAR = I0\nAR = I1\n\nDESCRIPTION\n\nx\n');

  it('lists the GAL22V10 cases only', () => {
    expect(galetteSuite(dir).map((c) => c.name)).toEqual(['success/one.pld', 'failure/bad.pld']);
  });

  it('agrees with an agreeing galette and reports messages that differ', () => {
    const cases = galetteSuite(dir);
    const galette = (pld: string) => {
      try {
        return { jedec: assemblePld(pld).jedec() };
      } catch (e) {
        return { error: (e as Error).message };
      }
    };
    expect(compareSuite(cases, galette).map((r) => r.problems)).toEqual([[], []]);
    const other = (pld: string) => ('jedec' in galette(pld) ? galette(pld) : { error: 'Error: something else entirely' });
    expect(compareSuite(cases, other)[1]!.problems.join('')).toMatch(/different messages/);
    const lenient = () => ({ jedec: 'x' });
    expect(compareSuite(cases, lenient)[1]!.problems.join('')).toMatch(/galette succeeds but the course's assembler fails/);
  });
});

describe('locating galette', () => {
  it('reads the version', () => {
    expect(galetteVersionOf('galette', fakeGalette())).toBe('0.3.0');
    expect(galetteVersionOf('galette', () => ({ status: 0, stdout: 'no idea', stderr: '' }))).toBeUndefined();
  });

  it('finds nothing without GALETTE, PATH or a checkout', () => {
    expect(locateGalette({ PATH: '' })).toEqual({ bin: undefined, dir: undefined });
  });

  it('complains about a GALETTE that names nothing', () => {
    expect(locateGalette({ GALETTE: '/no/such/galette', PATH: '' }).problem).toMatch(/GALETTE=\/no\/such\/galette is not an executable file/);
  });
});

describe('validate:gal', () => {
  it('skips, saying what to install and what to set, when galette is missing', async () => {
    const log = collect();
    expect(await main({ env: { PATH: '' }, log })).toBe(0);
    expect(log.lines).toHaveLength(1);
    expect(log.lines[0]).toMatch(/^skipped: galette not found — install .* or set GALETTE=/);
  });

  it('exits 0 when every file matches', async () => {
    const log = collect();
    expect(await main({ env: ENV, run: fakeGalette(), log })).toBe(0);
    expect(log.lines.at(-1)).toBe('validate:gal: 10 of 10 match');
    expect(log.lines.some((l) => l.includes('FAIL'))).toBe(false);
  });

  it('exits 1 on a mismatch, and says where', async () => {
    const log = collect();
    expect(await main({ env: ENV, run: fakeGalette(true), log })).toBe(1);
    expect(log.lines.filter((l) => l.includes('FAIL')).length).toBe(10);
    expect(log.lines.at(-1)).toMatch(/10 MISMATCH/);
    expect(log.lines.join('\n')).toMatch(/differs from galette's file at line/);
  });

  it('exits 1 when galette refuses a file the fitter wrote', async () => {
    const log = collect();
    const refuse: Runner = (c, a) => (a[0] === '--version' ? { status: 0, stdout: '0.3.0', stderr: '' } : { status: 1, stdout: '', stderr: 'Error in line 3: no' });
    expect(await main({ env: ENV, run: refuse, log })).toBe(1);
    expect(log.lines.join('\n')).toMatch(/galette refused the fitter's \.pld: Error in line 3: no/);
  });
});
