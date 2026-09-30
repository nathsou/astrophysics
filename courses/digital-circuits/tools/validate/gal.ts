/**
 * `npm run validate:gal`: the course's GAL22V10 fuse maps against galette (github.com/simon-frankau/galette).
 *
 * For every GAL example of the course (the Studio's GAL22V10 examples, Chapter 26's designs and the polarity
 * demo's presets), the fitter writes a galette `.pld` file, galette assembles it, and its JEDEC file must
 * match, byte for byte:
 *
 * - the file of the fitter's galette-style writer (`fit.jedec({ style: 'galette' })`);
 * - the file that the course's `.pld` assembler makes of the same `.pld`;
 * - the fuse map of the file the Studio offers for download (`fit.jedec()`), which has another layout
 *   (`*QP24`, upper-case checksums) but the same fuses.
 *
 * Chapter 26's frozen fixtures (`gal22v10-fixtures.ts`) must also still be what galette writes today.
 * With a galette checkout (its `testcases/` directory) it also runs galette's own suite through the course's
 * assembler: every GAL22V10 success case must give galette's file, every failure the same message.
 *
 * galette: `GALETTE` (a binary; `GALETTE_BIN` is a synonym, as in the vitest comparison in
 * src/lib/pld/devices/gal22v10-galette.test.ts), else `galette` on PATH, else `GALETTE_DIR/target/release/galette`
 * (built with `cargo build --release` when the checkout has none yet and cargo is installed).
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PINS as POLARITY_PINS, PRESETS } from '../../content/chapters/26-pals-and-gals/widgets/polarity';
import { GalFitError, fitGal22v10, fitGal22v10Equations, type GalFit } from '../../src/lib/pld/devices/gal22v10-fit';
import { GAL_FIXTURES } from '../../src/lib/pld/devices/gal22v10-fixtures';
import { readGal22v10Jedec } from '../../src/lib/pld/devices/gal22v10-jedec';
import { PldError, assemblePld } from '../../src/lib/pld/devices/gal22v10-pld';
import { galAdapter } from '../../src/lib/studio/adapters/gal';
import { EXAMPLES } from '../../src/lib/studio/examples';
import { consoleLogger, findTool, firstDifference, realRunner, skipMessage, which, type Logger, type Runner } from './common';

export interface GalCase {
  group: string;
  name: string;
  /** The galette `.pld` the fitter writes. */
  pld: string;
  fit: GalFit;
  /** The `.pld` and the JEDEC file frozen in the course's fixtures, if the case has them. */
  frozen?: { pld: string; jedec: string };
}

export interface GalResult {
  group: string;
  name: string;
  problems: string[];
}

/** Every GAL example of the course, fitted. */
export function courseGalCases(): GalCase[] {
  const cases: GalCase[] = [];
  for (const ex of EXAMPLES.gal22v10) {
    const r = galAdapter.program(ex.source);
    if (!r.ok) throw new Error(`Studio example ${ex.id} does not fit: ${JSON.stringify(r.errors)}`);
    const fit = (r.fit as unknown as { chip: { fit: GalFit | null } }).chip.fit;
    if (!fit) throw new Error(`Studio example ${ex.id} has no fit`);
    cases.push({ group: 'studio', name: ex.id, pld: fit.pld(), fit });
  }
  for (const f of GAL_FIXTURES) {
    const fit = fitGal22v10(f.design());
    cases.push({ group: 'chapter 26', name: f.id, pld: fit.pld(), fit, frozen: { pld: f.pld, jedec: f.galetteJedec } });
  }
  for (const p of PRESETS) {
    // The polarity demo: the smallest macrocell the output fits in.
    for (const pin of POLARITY_PINS) {
      try {
        const fit = fitGal22v10Equations(p.equations, { pins: { Y: pin } });
        cases.push({ group: 'chapter 26 polarity demo', name: `${p.id} on pin ${pin}`, pld: fit.pld(), fit });
        break;
      } catch (e) {
        if (!(e instanceof GalFitError)) throw e;
      }
    }
  }
  return cases;
}

/**
 * Compares the files of the course's writers with galette's for one case. `galetteJedec` is what galette
 * wrote for `pld`; `assemble` and the fit's writers are the course's side.
 */
export function compareGalCase(c: GalCase, galetteJedec: string, galetteVersion?: string): GalResult {
  const problems: string[] = [];
  const version = galetteVersion ? { galetteVersion } : {};
  const note = (what: string, ours: string) => {
    const d = firstDifference(ours, galetteJedec);
    if (d) problems.push(`${what} differs from galette's file at ${d}`);
  };
  note("the fitter's galette-style JEDEC file", c.fit.jedec({ style: 'galette', ...version }));
  try {
    note("the JEDEC file assembled from the fitter's .pld", assemblePld(c.pld).jedec(version));
  } catch (e) {
    problems.push(`the course's assembler refused the fitter's .pld: ${e instanceof Error ? e.message : String(e)}`);
  }
  // The Studio's download: another layout, the same fuses.
  try {
    const theirs = readGal22v10Jedec(galetteJedec, false).fuses;
    const ours = readGal22v10Jedec(c.fit.jedec()).fuses;
    const at = ours.findIndex((v, i) => v !== theirs[i]);
    if (at >= 0) problems.push(`the Studio's JEDEC download has a different fuse ${at} (${ours[at]}) from galette's (${theirs[at]})`);
  } catch (e) {
    problems.push(`cannot compare the fuse maps: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (c.frozen) {
    if (c.frozen.pld !== c.pld) problems.push(`the frozen .pld fixture is stale: ${firstDifference(c.pld, c.frozen.pld, ['fitter now', 'fixture'])}`);
    const d = firstDifference(c.frozen.jedec, galetteJedec, ['fixture', 'galette now']);
    if (d) problems.push(`the frozen galette JEDEC fixture is stale: ${d}`);
  }
  return { group: c.group, name: c.name, problems };
}

/** What galette does with a `.pld`: its JEDEC file, or the message it fails with. */
export type GaletteRun = { jedec: string } | { error: string };
export type GaletteFn = (pld: string) => GaletteRun;

/** A galette runner over a binary: copies the source into a work directory, as galette writes beside it. */
export function galetteRunner(bin: string, run: Runner = realRunner): GaletteFn {
  const work = mkdtempSync(path.join(tmpdir(), 'validate-gal-'));
  let n = 0;
  return (pld) => {
    const file = path.join(work, `case${n++}.pld`);
    writeFileSync(file, pld);
    const r = run(bin, ['-c', file]);
    if (r.status !== 0) return { error: (r.stderr || r.stdout || r.error || `exit status ${r.status}`).trim() };
    const out = file.replace(/\.pld$/, '.jed');
    if (!existsSync(out)) return { error: 'galette wrote no .jed file' };
    return { jedec: readFileSync(out, 'utf8') };
  };
}

/** The GAL22V10 cases of galette's own test suite: the source and, for successes, its JEDEC file. */
export function galetteSuite(dir: string): { name: string; pld: string; expected?: string }[] {
  const out: { name: string; pld: string; expected?: string }[] = [];
  for (const sub of ['success', 'failure']) {
    const d = path.join(dir, 'testcases', sub);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((x) => x.endsWith('.pld')).sort()) {
      const pld = readFileSync(path.join(d, f), 'utf8');
      if (!/^GAL22V10\r?\n/.test(pld)) continue;
      const jed = path.join(d, f.replace(/\.pld$/, '.jed'));
      out.push({ name: `${sub}/${f}`, pld, expected: sub === 'success' && existsSync(jed) ? readFileSync(jed, 'utf8') : undefined });
    }
  }
  return out;
}

/** galette's own suite through the course's assembler, against the checked-in files and the binary. */
export function compareSuite(cases: ReturnType<typeof galetteSuite>, galette: GaletteFn): GalResult[] {
  return cases.map((c) => {
    const problems: string[] = [];
    const theirs = galette(c.pld);
    let ours: { jedec: string } | { error: string };
    try {
      ours = { jedec: assemblePld(c.pld).jedec() };
    } catch (e) {
      ours = { error: e instanceof PldError ? e.message : String(e) };
    }
    if ('error' in theirs) {
      if (!('error' in ours)) problems.push(`galette fails (${theirs.error.split('\n').pop()}) but the course's assembler succeeds`);
      else if (!theirs.error.endsWith(ours.error)) problems.push(`different messages: galette says ${JSON.stringify(theirs.error.split('\n').pop())}, the course says ${JSON.stringify(ours.error)}`);
    } else if ('error' in ours) problems.push(`galette succeeds but the course's assembler fails: ${ours.error}`);
    else {
      const d = firstDifference(ours.jedec, theirs.jedec);
      if (d) problems.push(`JEDEC file differs from galette's at ${d}`);
      if (c.expected !== undefined) {
        const e = firstDifference(theirs.jedec, c.expected, ['galette now', 'checked-in file']);
        if (e) problems.push(`galette's file differs from the one in its testcases (another galette version?) at ${e}`);
      }
    }
    return { group: "galette's suite", name: c.name, problems };
  });
}

export interface GalOptions {
  env?: NodeJS.ProcessEnv;
  run?: Runner;
  log?: Logger;
}

/** Locates galette: the binary and, if there is one, the checkout it was built in. */
export function locateGalette(env: NodeJS.ProcessEnv, run: Runner = realRunner, log: Logger = consoleLogger): { bin?: string; dir?: string; problem?: string } {
  const dirEnv = env.GALETTE_DIR;
  const viaEnv = findTool(env.GALETTE ? 'GALETTE' : 'GALETTE_BIN', ['galette'], env);
  if (viaEnv.problem) return { problem: viaEnv.problem };
  let bin = viaEnv.path;
  let dir = dirEnv && existsSync(path.join(dirEnv, 'testcases')) ? dirEnv : undefined;
  if (!bin && dirEnv) {
    const built = path.join(dirEnv, 'target/release/galette');
    if (existsSync(built)) bin = built;
    else if (existsSync(path.join(dirEnv, 'Cargo.toml')) && which('cargo', env)) {
      log.log(`building galette in ${dirEnv} (cargo build --release)…`);
      const r = run('cargo', ['build', '--release'], { cwd: dirEnv });
      if (r.status !== 0) return { problem: `cargo build --release failed in ${dirEnv}:\n${(r.stderr || r.stdout).trim().split('\n').slice(-8).join('\n')}` };
      if (existsSync(built)) bin = built;
    }
  }
  if (bin && !dir) {
    // A binary inside a checkout: <checkout>/target/release/galette.
    const guess = path.resolve(bin, '../../..');
    if (existsSync(path.join(guess, 'testcases'))) dir = guess;
  }
  return { bin, dir };
}

/** The version galette reports (`galette --version`), if it says. */
export function galetteVersionOf(bin: string, run: Runner = realRunner): string | undefined {
  const r = run(bin, ['--version']);
  return /(\d+\.\d+\.\d+)/.exec(`${r.stdout}${r.stderr}`)?.[1];
}

/** The script: returns the exit status (0: all match, or skipped; 1: a mismatch or an error). */
export async function main(options: GalOptions = {}): Promise<number> {
  const env = options.env ?? process.env;
  const run = options.run ?? realRunner;
  const log = options.log ?? consoleLogger;
  const found = locateGalette(env, run, log);
  if (found.problem) {
    log.error(`validate:gal: ${found.problem}`);
    return 1;
  }
  if (!found.bin) {
    log.log(skipMessage('galette', 'it (https://github.com/simon-frankau/galette: `cargo build --release`)', 'GALETTE=/path/to/galette or GALETTE_DIR=/path/to/galette-checkout'));
    return 0;
  }
  const version = galetteVersionOf(found.bin, run);
  log.log(`validate:gal: galette ${version ?? '(version unknown)'} at ${found.bin}`);
  const galette = galetteRunner(found.bin, run);
  const results: GalResult[] = [];
  for (const c of courseGalCases()) {
    const r = galette(c.pld);
    if ('error' in r) results.push({ group: c.group, name: c.name, problems: [`galette refused the fitter's .pld: ${r.error}`] });
    else results.push(compareGalCase(c, r.jedec, version));
  }
  if (found.dir) results.push(...compareSuite(galetteSuite(found.dir), galette));
  else log.log("validate:gal: no galette checkout (GALETTE_DIR), so galette's own test suite is not run");
  let bad = 0;
  for (const r of results) {
    if (r.problems.length === 0) log.log(`  ok    ${r.group}: ${r.name}`);
    else {
      bad++;
      log.log(`  FAIL  ${r.group}: ${r.name}`);
      for (const p of r.problems) log.log(`          ${p}`);
    }
  }
  log.log(`validate:gal: ${results.length - bad} of ${results.length} match${bad ? `, ${bad} MISMATCH` : ''}`);
  return bad ? 1 : 0;
}
