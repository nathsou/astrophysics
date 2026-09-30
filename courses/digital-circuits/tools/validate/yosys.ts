/**
 * `npm run validate:yosys`: the course's designs through the real open-source FPGA toolchain.
 *
 * Every design under `content/designs/` and `content/chapters/<chapter>/designs/` is exported with the interchange
 * writer (src/lib/pld/interchange, Yosys JSON), checked against the documented format, read by Yosys
 * (`read_json`), synthesised for iCE40 (`synth_ice40`) and placed and routed by nextpnr-ice40 for each chosen
 * part. The script checks that Yosys accepts the netlist and keeps its ports, and writes the utilisation
 * (Yosys's cell counts, nextpnr's resource use) and the fmax nextpnr reports to a JSON report, by default
 * `docs/validation/yosys.json`, for Chapter 31's comparison with the course's own flow. A part whose pads are fewer than
 * a design's port bits (an up5k-sg48 has 39) is recorded as `does-not-fit`, with the utilisation nextpnr printed before
 * it gave up (logic cells, block RAM: valid; no fmax). Yosys's log is read from a file (`-l`), because the WebAssembly
 * build loses the end of what it prints to a pipe.
 *
 * Tools: `YOSYS` (default `yosys` on PATH) and `NEXTPNR` (default `nextpnr-ice40`). Without Yosys the script
 * prints `skipped: yosys not found — …` and exits 0. Without nextpnr it runs Yosys only: the report has the
 * cell counts and no fmax. It exits 1 if the netlist is not valid, Yosys rejects it or changes its ports, or
 * nextpnr fails for a reason other than the design not fitting the part.
 *
 * Options (arguments, or `--key=value`): `--out file` (the report), `--parts up5k:sg48,hx8k:ct256` (or `ICE40_PARTS`),
 * `--freq MHz` (`ICE40_FREQ`, the clock constraint, default 12, an iCEBreaker's), `--seed n` (`ICE40_SEED`, default 1),
 * `--only name[,name…]` (designs by file name without extension), `--work dir` (keep the intermediate files there).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { check } from '../../src/lib/hdl/check';
import { elaborate } from '../../src/lib/hdl/elaborate';
import { SourceFile } from '../../src/lib/hdl/span';
import { toYosysJson, validateYosysJson, yosysModuleName, type YosysJson } from '../../src/lib/pld/interchange';
import { assembleOrThrow } from '../../src/lib/sim/cpu/rv32i';
import { programWords, withRom } from '../../content/chapters/31-cpus-on-a-chip/widgets/rv32-board';
import { COURSE_ROOT, consoleLogger, findTool, realRunner, relativeToCourse, skipMessage, type Logger, type Runner } from './common';
import {
  classifyNextpnrFailure,
  comparePorts,
  limitingFmax,
  parseNextpnrLog,
  parseNextpnrReport,
  parseYosysStat,
  summariseCells,
  type NextpnrResult,
  type ResourceUse,
  type YosysUtilisation,
} from './yosys-report';

export interface CourseDesign {
  /** The path relative to the course root, such as `content/designs/counter.dcl`. */
  file: string;
  /** The file name without extension. */
  name: string;
  /** The source that is checked: the file, after a library file if the design needs one. */
  source: string;
  /** The top module (a name in the source). */
  top?: string;
  /** Why the design cannot be exported. */
  problem?: string;
  /** The program that was put into the design's ROM (the design file has an empty one), by file name. */
  program?: string;
}

/**
 * Designs whose file leaves the contents of a ROM to a program: `rv32-board.dcl` has a wrapper whose instruction ROM
 * is empty (`_ => 0`, an illegal instruction), so the core traps at once and synthesis rightly removes all of it. The
 * chapter's walking-light program, as the board widget loads it, goes into the ROM.
 */
const ROM_PROGRAMS: Record<string, { program: string; fill: (source: string, asm: string) => string }> = {
  'rv32-board': {
    program: 'content/chapters/31-cpus-on-a-chip/programs/rv32-walk.asm',
    fill: (source, asm) => withRom(source, programWords(assembleOrThrow(asm, 'rv32-walk'))),
  },
};

/** The DCL designs of the course: `content/designs/*.dcl` and `content/chapters/<chapter>/designs/*.dcl`. */
export function courseDesignFiles(root: string = COURSE_ROOT): string[] {
  const files: string[] = [];
  const add = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.dcl')).sort()) files.push(path.join(dir, f));
  };
  add(path.join(root, 'content/designs'));
  const chapters = path.join(root, 'content/chapters');
  if (existsSync(chapters)) for (const c of readdirSync(chapters).sort()) add(path.join(chapters, c, 'designs'));
  return files;
}

/** The modules a source declares that no other module of it instantiates. */
function rootModules(source: string): string[] {
  const declared = [...source.matchAll(/^(?:top\s+)?module\s+([A-Za-z_]\w*)/gm)].map((m) => m[1]!);
  const used = new Set([...source.matchAll(/\binst\s+\w+\s*:\s*([A-Za-z_]\w*)/g)].map((m) => m[1]!));
  return declared.filter((d) => !used.has(d));
}

/** `top module` marks the design's top; a file without one has the single module nothing else instantiates. */
function pickTop(source: string): { top?: string; problem?: string } {
  const marked = /^top\s+module\s+([A-Za-z_]\w*)/m.exec(source);
  if (marked) return { top: marked[1]! };
  const roots = rootModules(source);
  if (roots.length === 1) return { top: roots[0]! };
  return { problem: roots.length === 0 ? 'no module to use as the top' : `no \`top\` marker, and several modules that nothing instantiates: ${roots.join(', ')}` };
}

const errorsOf = (source: string, file: string) => check(source, { file }).diagnostics.filter((d) => d.severity === 'error');
const stripTop = (s: string) => s.replace(/^top\s+module\b/m, 'module');

/**
 * The designs, with their tops. A chapter design that uses a module it does not declare (the RV32I board
 * uses the core) is completed with the first file of `content/designs/` that makes it check, its `top` marker
 * removed.
 */
export function courseDesigns(root: string = COURSE_ROOT): CourseDesign[] {
  const files = courseDesignFiles(root);
  const libs = files.filter((f) => path.dirname(f) === path.join(root, 'content/designs'));
  return files.map((abs) => {
    const file = path.relative(root, abs).split(path.sep).join('/');
    const name = path.basename(abs, '.dcl');
    const own = readFileSync(abs, 'utf8');
    const design: CourseDesign = { file, name, source: own };
    const errors = errorsOf(own, file);
    if (errors.length > 0) {
      for (const lib of libs.filter((l) => l !== abs)) {
        const source = `${stripTop(readFileSync(lib, 'utf8'))}\n${own}`;
        if (errorsOf(source, file).length === 0) {
          design.source = source;
          break;
        }
      }
      const again = errorsOf(design.source, file);
      if (again.length > 0) design.problem = `does not check: ${again[0]!.message}`;
    }
    const rom = ROM_PROGRAMS[name];
    if (rom && !design.problem) {
      try {
        design.source = rom.fill(design.source, readFileSync(path.join(root, rom.program), 'utf8'));
        design.program = path.basename(rom.program);
      } catch (e) {
        design.problem = `cannot put its program into the ROM: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    if (!design.problem) {
      const t = pickTop(design.source);
      if (t.problem) design.problem = t.problem;
      else design.top = t.top;
    }
    return design;
  });
}

/** `dev:package` pairs that nextpnr-ice40 takes as `--<dev> --package <package>`. */
export const ICE40_DEVICES = ['lp384', 'lp1k', 'lp8k', 'hx1k', 'hx4k', 'hx8k', 'up5k', 'u1k', 'u2k', 'u4k'];

export interface Part {
  device: string;
  package: string;
  /** `up5k-sg48`. */
  id: string;
}

export function parseParts(text: string): Part[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [device, pkg] = s.split(':');
      if (!device || !pkg || !ICE40_DEVICES.includes(device)) throw new Error(`bad part "${s}": use device:package with a device from ${ICE40_DEVICES.join(', ')}, such as up5k:sg48`);
      return { device, package: pkg, id: `${device}-${pkg}` };
    });
}

export const DEFAULT_PARTS = 'up5k:sg48,hx8k:ct256';

export interface PartResult {
  /** `ok`; `does-not-fit` (more of a resource than the part has); `failed`; `skipped` (no nextpnr). */
  status: 'ok' | 'does-not-fit' | 'failed' | 'skipped';
  message?: string;
  /** The limiting clock's maximum frequency, MHz; null for a design without a clock. */
  fmaxMHz?: number | null;
  clock?: string;
  targetMHz?: number;
  utilisation?: Record<string, ResourceUse>;
}

export interface DesignReport {
  design: string;
  file: string;
  top?: string;
  /** The program in the design's ROM, when the design file leaves it empty. */
  program?: string;
  status: 'ok' | 'failed' | 'skipped';
  message?: string;
  /** Things that are not failures but look wrong (Yosys removed every register of a design that has some). */
  warnings?: string[];
  /** The interchange netlist: its size. */
  netlist?: { modules: number; cells: number };
  yosys?: YosysUtilisation;
  parts?: Record<string, PartResult>;
}

export interface YosysReport {
  tools: { yosys: string | null; nextpnr: string | null };
  parameters: { targetMHz: number; seed: number; parts: string[] };
  designs: DesignReport[];
}

export interface YosysOptions {
  env?: NodeJS.ProcessEnv;
  run?: Runner;
  log?: Logger;
  /** Command-line arguments (after the script name). */
  args?: string[];
  /** The designs (default: the course's). */
  designs?: CourseDesign[];
}

function parseArgs(args: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    const m = /^--([a-z]+)(?:=(.*))?$/.exec(a);
    if (!m) throw new Error(`unexpected argument ${a}`);
    out[m[1]!] = m[2] ?? args[++i] ?? '';
  }
  return out;
}

const versionLine = (r: { stdout: string; stderr: string }) => `${r.stdout}${r.stderr}`.trim().split('\n')[0] ?? '';

/** Writes the netlist, runs Yosys and nextpnr for one design. */
function runDesign(d: CourseDesign, work: string, tools: { yosys: string; nextpnr?: string }, parts: Part[], targetMHz: number, seed: number, run: Runner, log: Logger): DesignReport {
  const report: DesignReport = { design: d.name, file: d.file, top: d.top, ...(d.program ? { program: d.program } : {}), status: 'ok' };
  if (d.problem || !d.top) return { ...report, status: 'skipped', message: d.problem ?? 'no top module' };
  const fail = (message: string): DesignReport => ({ ...report, status: 'failed', message });

  let json: YosysJson;
  try {
    const source = new SourceFile(d.file, d.source);
    const program = check(d.source, { file: d.file }).program;
    json = toYosysJson(elaborate(program, d.top), { sources: (f) => (f === d.file ? source : undefined) });
  } catch (e) {
    return fail(`cannot export: ${e instanceof Error ? e.message : String(e)}`);
  }
  const problems = validateYosysJson(json);
  if (problems.length) return fail(`the interchange netlist is not valid: ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? ` (and ${problems.length - 5} more)` : ''}`);
  const top = yosysModuleName(d.top);
  report.netlist = { modules: Object.keys(json.modules).length, cells: Object.values(json.modules).reduce((n, m) => n + Object.keys(m.cells).length, 0) };

  const dir = path.join(work, d.name);
  mkdirSync(dir, { recursive: true });
  const input = path.join(dir, `${d.name}.json`);
  const synth = path.join(dir, `${d.name}.synth.json`);
  writeFileSync(input, JSON.stringify(json));

  // File names are relative to the design's folder, where the tools run: the WebAssembly builds (YoWASP) only see
  // their working directory, and native builds do not mind.
  const inputName = path.basename(input);
  const synthName = path.basename(synth);
  // The log goes to a file (`-l`) and is read from there: the WebAssembly build of Yosys (YoWASP) loses whatever it
  // prints to a pipe once ABC has run, which includes the `stat` report at the end; the log file is complete.
  const logName = 'yosys.log';
  const y = run(tools.yosys, ['-p', `read_json ${inputName}; synth_ice40 -top ${top} -json ${synthName}; stat`, '-l', logName], { cwd: dir });
  const fileLog = existsSync(path.join(dir, logName)) ? readFileSync(path.join(dir, logName), 'utf8') : '';
  const yosysLog = fileLog.includes('Printing statistics') || !(y.stdout + y.stderr) ? fileLog || y.stdout + y.stderr : y.stdout + y.stderr;
  writeFileSync(path.join(dir, logName), yosysLog);
  if (y.status !== 0) {
    const last = `${y.stderr}\n${y.stdout}`.split('\n').filter((l) => /ERROR/.test(l)).pop() ?? y.error ?? `exit status ${y.status}`;
    return fail(`Yosys rejected the netlist: ${last.trim()}`);
  }
  let synthJson: unknown;
  try {
    synthJson = JSON.parse(readFileSync(synth, 'utf8'));
  } catch (e) {
    return fail(`Yosys wrote no readable ${path.basename(synth)}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const portProblems = comparePorts(json, synthJson, top);
  if (portProblems.length) return fail(`Yosys changed the ports: ${portProblems.join('; ')}`);
  report.yosys = summariseCells(parseYosysStat(yosysLog));
  if (Object.keys(report.yosys.cells).length === 0) log.log(`  warning: no SB_ cells found in Yosys's statistics for ${d.name} (a new layout of stat?)`);
  // A design with registers or a memory that comes out of synthesis with neither has been optimised away: its
  // inputs are constant, or its outputs do not depend on them. That can be the design's own doing (a ROM left
  // empty), so it is reported, not failed.
  const stateful = Object.values(json.modules).some((m) => Object.values(m.cells).some((c) => c.type === '$dff' || c.type === '$mem_v2'));
  if (stateful && report.yosys.flipFlops + report.yosys.brams === 0 && Object.keys(report.yosys.cells).length > 0) {
    (report.warnings ??= []).push('the design has registers or a memory, and Yosys removed every one of them: its outputs are constant or do not depend on its state');
  }

  report.parts = {};
  for (const part of parts) {
    if (!tools.nextpnr) {
      report.parts[part.id] = { status: 'skipped', message: 'nextpnr-ice40 not found' };
      continue;
    }
    const reportFile = path.join(dir, `${part.id}.report.json`);
    const logFile = path.join(dir, `${part.id}.nextpnr.log`);
    const n = run(tools.nextpnr, [`--${part.device}`, '--package', part.package, '--json', synthName, '--freq', String(targetMHz), '--seed', String(seed), '--report', path.basename(reportFile), '--log', path.basename(logFile)], { cwd: dir });
    const output = `${n.stdout}\n${n.stderr}\n${existsSync(logFile) ? readFileSync(logFile, 'utf8') : ''}`;
    if (n.status !== 0) {
      const why = classifyNextpnrFailure(output);
      if (why.kind === 'other') {
        report.parts[part.id] = { status: 'failed', message: why.message };
        report.status = 'failed';
        report.message ??= `nextpnr failed on ${part.id}: ${why.message}`;
      } else {
        // The utilisation table that nextpnr prints before it gives up shows by how much.
        const utilisation = parseNextpnrLog(output).utilisation;
        const over = Object.entries(utilisation).filter(([, u]) => u.used > u.available).map(([t, u]) => `${t} ${u.used} of ${u.available}`);
        report.parts[part.id] = { status: 'does-not-fit', message: `${why.message} (${why.kind}${over.length ? `: ${over.join(', ')}` : ''})`, ...(Object.keys(utilisation).length ? { utilisation } : {}) };
      }
      continue;
    }
    let result: NextpnrResult;
    try {
      result = parseNextpnrReport(JSON.parse(readFileSync(reportFile, 'utf8')));
    } catch {
      result = parseNextpnrLog(output);
    }
    const limit = limitingFmax(result);
    report.parts[part.id] = { status: 'ok', fmaxMHz: limit ? limit.achievedMHz : null, clock: limit?.clock, targetMHz, utilisation: result.utilisation };
    // A clocked design can still have no fmax: when every register is loaded straight from an input (a register
    // file whose write data comes from pins), there is no register-to-register path to time.
    if (!limit && result.domains.length > 0) report.parts[part.id]!.message = `clocked by ${result.domains.join(', ')}, but no register-to-register path: nextpnr reports no fmax`;
  }
  return report;
}

/** The script: returns the exit status. */
export async function main(options: YosysOptions = {}): Promise<number> {
  const env = options.env ?? process.env;
  const run = options.run ?? realRunner;
  const log = options.log ?? consoleLogger;
  let args: Record<string, string>;
  let parts: Part[];
  try {
    args = parseArgs(options.args ?? []);
    parts = parseParts(args.parts ?? env.ICE40_PARTS ?? DEFAULT_PARTS);
  } catch (e) {
    log.error(`validate:yosys: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  const yosys = findTool('YOSYS', ['yosys'], env);
  if (yosys.problem) {
    log.error(`validate:yosys: ${yosys.problem}`);
    return 1;
  }
  if (!yosys.path) {
    log.log(skipMessage('yosys', 'Yosys (https://github.com/YosysHQ/yosys, or the "yosys" package of your system)', 'YOSYS=/path/to/yosys (and NEXTPNR=/path/to/nextpnr-ice40)'));
    return 0;
  }
  const nextpnr = findTool('NEXTPNR', ['nextpnr-ice40'], env);
  if (nextpnr.problem) {
    log.error(`validate:yosys: ${nextpnr.problem}`);
    return 1;
  }
  if (!nextpnr.path) log.log(skipMessage('nextpnr-ice40', 'nextpnr (https://github.com/YosysHQ/nextpnr, built with -DARCH=ice40; the report will have cell counts and no fmax)', 'NEXTPNR=/path/to/nextpnr-ice40'));
  const targetMHz = Number(args.freq ?? env.ICE40_FREQ ?? 12);
  const seed = Number(args.seed ?? env.ICE40_SEED ?? 1);
  if (!(targetMHz > 0) || !Number.isInteger(seed)) {
    log.error('validate:yosys: --freq must be a positive number and --seed an integer');
    return 2;
  }
  const yv = run(yosys.path, ['-V']);
  const nv = nextpnr.path ? run(nextpnr.path, ['--version']) : undefined;
  const only = args.only ? new Set(args.only.split(',')) : undefined;
  const designs = (options.designs ?? courseDesigns()).filter((d) => !only || only.has(d.name));
  if (designs.length === 0) {
    log.error('validate:yosys: no designs selected');
    return 1;
  }
  const work = args.work ? path.resolve(args.work) : mkdtempSync(path.join(tmpdir(), 'validate-yosys-'));
  mkdirSync(work, { recursive: true });
  log.log(`validate:yosys: ${versionLine(yv)}; ${nv ? versionLine(nv) : 'no nextpnr'}; parts ${parts.map((p) => p.id).join(', ')}; ${targetMHz} MHz; seed ${seed}; files in ${work}`);

  const report: YosysReport = {
    tools: { yosys: versionLine(yv) || null, nextpnr: nv ? versionLine(nv) || null : null },
    parameters: { targetMHz, seed, parts: parts.map((p) => p.id) },
    designs: [],
  };
  let bad = 0;
  for (const d of designs) {
    const r = runDesign(d, work, { yosys: yosys.path, nextpnr: nextpnr.path }, parts, targetMHz, seed, run, log);
    report.designs.push(r);
    if (r.status === 'failed') bad++;
    const head = r.status === 'ok' ? 'ok   ' : r.status === 'skipped' ? 'skip ' : 'FAIL ';
    log.log(`  ${head} ${d.file}${r.top ? ` (${r.top})` : ''}${r.message ? `: ${r.message}` : ''}`);
    for (const w of r.warnings ?? []) log.log(`         warning: ${w}`);
    if (r.yosys) log.log(`         Yosys: ${r.yosys.luts} LUT4, ${r.yosys.carries} carry, ${r.yosys.flipFlops} flip-flops, ${r.yosys.brams} block RAM`);
    for (const [id, p] of Object.entries(r.parts ?? {})) {
      const detail = p.status === 'ok' ? (p.fmaxMHz == null ? (p.message ?? 'placed and routed, no clock') : `fmax ${p.fmaxMHz.toFixed(2)} MHz (${p.clock})`) : (p.message ?? p.status);
      log.log(`         ${id}: ${p.status === 'ok' ? '' : `${p.status}: `}${detail}`);
    }
  }
  const out = path.resolve(COURSE_ROOT, args.out ?? 'docs/validation/yosys.json');
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  log.log(`validate:yosys: ${designs.length - bad} of ${designs.length} designs went through${bad ? `, ${bad} FAILED` : ''}; report in ${relativeToCourse(out)}`);
  return bad ? 1 : 0;
}
