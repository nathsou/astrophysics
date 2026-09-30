/**
 * `npm run validate:rv32i`: riscv-arch-test (github.com/riscv-non-isa/riscv-arch-test) against the course's RV32I
 * machines: the reference interpreter (`src/lib/sim/cpu/rv32i/machine.ts`) and the DCL core
 * (`content/designs/rv32i.dcl`) on the RTL simulator.
 *
 * `RISCV_ARCH_TEST` names a checkout. Its `*.elf` files (the RV32I tests, compiled for a target whose
 * `RVMODEL_HALT` writes to `tohost`, such as the `spike` target of the checkout) are loaded, run until they write
 * `tohost`, and the words between `begin_signature` and `end_signature` are compared with the test's
 * `<name>.reference_output` (found anywhere in the tree). Where a test has no reference file, the two machines are
 * compared with each other. Without ELF files, the `.S` tests of `riscv-test-suite/rv32i_m/I/src` are compiled
 * with a toolchain (`RISCV_PREFIX` such as `riscv64-unknown-elf-`, else the first of `riscv32-unknown-elf-`,
 * `riscv64-unknown-elf-`, `riscv-none-elf-` with `gcc` on PATH) for the target in `RISCV_TARGET` (default
 * `riscv-target/spike` of the checkout), with `-march` from `RISCV_MARCH` (default `rv32i_zicsr`).
 *
 * Programs are placed at the lowest address of their ELF and run there: the course's machines have RAM at 0, so
 * addresses are shifted down by the lowest loadable address (programs compiled for `-mcmodel=medany` do not care).
 * Tests that need traps or misaligned accesses (`misalign`, `ecall`, `ebreak`) are skipped by default: change it
 * with `--skip regexp` (or `RV32I_SKIP`). Other options: `--only regexp`, `--no-core` (the interpreter only),
 * `--max-steps n` (default 5,000,000 instructions).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { check } from '../../src/lib/hdl/check';
import { elaborate } from '../../src/lib/hdl/elaborate';
import { createRtlSim } from '../../src/lib/hdl/rtlsim';
import { Rv32Machine } from '../../src/lib/sim/cpu/rv32i/machine';
import { COURSE_ROOT, consoleLogger, realRunner, skipMessage, which, type Logger, type Runner } from './common';
import { parseElf32, type Elf32 } from './elf';
import { compareSignatures, parseSignature } from './signature';

export interface LoadedTest {
  /** The lowest loadable address of the ELF: address 0 of the machines. */
  base: number;
  memory: Uint8Array;
  entry: number;
  /** Shifted addresses. */
  tohost?: number;
  begin: number;
  end: number;
}

export class TestError extends Error {}

/** The ELF as a flat image at address 0 (see the header comment). */
export function loadTest(elf: Elf32): LoadedTest {
  if (elf.segments.length === 0) throw new TestError('the ELF file has no loadable segment');
  const base = (Math.min(...elf.segments.map((s) => s.vaddr)) & ~3) >>> 0;
  const top = Math.max(...elf.segments.map((s) => s.vaddr + s.data.length));
  const size = Math.max(0x10000, (top - base + 0x1000 + 3) & ~3);
  if (size > 0x1000_0000) throw new TestError(`the program spans ${top - base} bytes: too large`);
  const memory = new Uint8Array(size);
  for (const s of elf.segments) memory.set(s.data, s.vaddr - base);
  const begin = elf.symbols.get('begin_signature');
  const end = elf.symbols.get('end_signature');
  if (begin === undefined || end === undefined) throw new TestError('the ELF file has no begin_signature and end_signature symbols');
  const tohost = elf.symbols.get('tohost');
  return { base, memory, entry: elf.entry - base, tohost: tohost === undefined ? undefined : tohost - base, begin: begin - base, end: end - base };
}

const word = (m: Uint8Array, a: number): number => a < 0 || a + 4 > m.length ? 0 : (m[a]! | (m[a + 1]! << 8) | (m[a + 2]! << 16) | (m[a + 3]! << 24)) >>> 0;

const signatureOf = (t: LoadedTest, m: Uint8Array): number[] => {
  const words: number[] = [];
  for (let a = t.begin; a < t.end; a += 4) words.push(word(m, a));
  return words;
};

export interface MachineRun {
  signature?: number[];
  error?: string;
  /** Instructions (interpreter) or clock cycles (core). */
  count: number;
}

/** The reference interpreter on a test. */
export function runInterpreter(t: LoadedTest, maxSteps: number): MachineRun {
  const m = new Rv32Machine({ ramSize: t.memory.length });
  m.memory.set(t.memory);
  m.entry = t.entry;
  m.reset();
  while (m.steps < maxSteps) {
    m.run(1024);
    if (m.halted) return { count: m.steps, error: `trap: ${m.trap?.message ?? 'halted'}` };
    if (t.tohost !== undefined && word(m.memory, t.tohost) !== 0) return { count: m.steps, signature: signatureOf(t, m.memory) };
  }
  return { count: m.steps, error: `no write to tohost in ${maxSteps} instructions` };
}

/** The elaborated DCL core, loaded once. */
let coreDesign: ReturnType<typeof elaborate> | undefined;
export function coreSource(): string {
  return readFileSync(path.join(COURSE_ROOT, 'content/designs/rv32i.dcl'), 'utf8');
}
function core(): ReturnType<typeof elaborate> {
  if (!coreDesign) {
    const r = check(coreSource(), { file: 'rv32i.dcl' });
    coreDesign = elaborate(r.program, 'riscv32');
  }
  return coreDesign;
}

/** The DCL core on the RTL simulator, with the memory model of rv32i.test.ts: fetch and data words are provided combinationally. */
export function runCore(t: LoadedTest, maxCycles: number): MachineRun {
  const sim = createRtlSim(core());
  const mem = t.memory.slice();
  const s = (n: string) => sim.signal(n);
  const p = { pc: s('pc_out'), address: s('memory_address'), write: s('memory_write'), data: s('memory_data'), width: s('memory_width'), instruction: s('instruction'), value: s('memory_value'), trap: s('trap_code') };
  const load = (a: number) => word(mem, a >>> 0);
  // The reset vector: the core starts at 0; a program whose entry is elsewhere gets a jump there.
  const store = (a: number, v: number, width: number) => {
    const n = width === 0 ? 1 : width === 1 ? 2 : 4;
    for (let b = 0; b < n; b++) {
      const at = ((a >>> 0) + b) >>> 0;
      if (at < mem.length) mem[at] = (v >>> (8 * b)) & 0xff;
    }
  };
  let cycles = 0;
  if (t.entry !== 0) return { count: 0, error: `the DCL core starts at address 0 and this program's entry is at 0x${t.entry.toString(16)} (after rebasing)` };
  while (cycles < maxCycles) {
    const trap = p.trap.get();
    if (trap) return { count: cycles, error: `trap code ${trap} (${['', 'illegal instruction', 'ecall', 'ebreak'][trap]}) at pc 0x${(p.pc.get() >>> 0).toString(16)}` };
    const addr = p.address.get();
    if (p.write.get()) {
      store(addr, p.data.get(), p.width.get());
      if (t.tohost !== undefined && word(mem, t.tohost) !== 0) return { count: cycles, signature: signatureOf(t, mem) };
    }
    p.instruction.set(load(p.pc.get()));
    p.value.set(load(addr));
    sim.step();
    cycles++;
  }
  return { count: cycles, error: `no write to tohost in ${maxCycles} cycles` };
}

export interface ArchTest {
  name: string;
  elf: string;
  reference?: string;
}

const walk = (dir: string, out: string[] = []): string[] => {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const f of names) {
    if (f === '.git' || f === 'node_modules') continue;
    const p = path.join(dir, f);
    let st: ReturnType<typeof lstatSync>;
    try {
      st = lstatSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, out);
    else if (st.isFile()) out.push(p);
  }
  return out;
};

/** The precompiled tests of a checkout: every `.elf`, with the `.reference_output` of the same name. */
export function findTests(root: string): ArchTest[] {
  const files = walk(root);
  const refs = new Map<string, string>();
  for (const f of files) if (f.endsWith('.reference_output')) refs.set(path.basename(f, '.reference_output'), refs.get(path.basename(f, '.reference_output')) ?? f);
  return files
    .filter((f) => f.endsWith('.elf'))
    .sort()
    .map((elf) => {
      const name = path.basename(elf, '.elf');
      return { name, elf, reference: refs.get(name) };
    });
}

/** The RISC-V C compiler: from `RISCV_PREFIX` or PATH. */
export function findCompiler(env: NodeJS.ProcessEnv): string | undefined {
  if (env.RISCV_PREFIX) return which(`${env.RISCV_PREFIX}gcc`, env) ?? (existsSync(`${env.RISCV_PREFIX}gcc`) ? `${env.RISCV_PREFIX}gcc` : undefined);
  for (const prefix of ['riscv32-unknown-elf-', 'riscv64-unknown-elf-', 'riscv-none-elf-']) {
    const w = which(`${prefix}gcc`, env);
    if (w) return w;
  }
  return undefined;
}

/** Compiles the RV32I `.S` tests of a checkout; returns the tests and the compile failures. */
export function buildTests(root: string, gcc: string, work: string, env: NodeJS.ProcessEnv, run: Runner): { tests: ArchTest[]; failures: { name: string; message: string }[] } {
  const suite = path.join(root, 'riscv-test-suite/rv32i_m/I');
  // riscv-arch-test 2.x keeps the spike target in riscv-target/spike, 3.x in riscof-plugins/rv32/spike_simple/env.
  const target = env.RISCV_TARGET ?? [path.join(root, 'riscv-target/spike'), path.join(root, 'riscof-plugins/rv32/spike_simple/env')].find((t) => existsSync(path.join(t, 'model_test.h'))) ?? path.join(root, 'riscv-target/spike');
  const tests: ArchTest[] = [];
  const failures: { name: string; message: string }[] = [];
  if (!existsSync(path.join(suite, 'src'))) return { tests, failures: [{ name: '(suite)', message: `no ${path.join(suite, 'src')}` }] };
  mkdirSync(work, { recursive: true });
  for (const f of readdirSync(path.join(suite, 'src')).filter((x) => x.endsWith('.S')).sort()) {
    const name = f.replace(/\.S$/, '');
    const elf = path.join(work, `${name}.elf`);
    const r = run(gcc, [
      `-march=${env.RISCV_MARCH ?? 'rv32i_zicsr'}`, '-mabi=ilp32', '-static', '-mcmodel=medany', '-fvisibility=hidden', '-nostdlib', '-nostartfiles',
      '-T', path.join(target, 'link.ld'), '-I', path.join(root, 'riscv-test-suite/env'), '-I', target, '-DXLEN=32', '-DTEST_CASE_1=True',
      '-o', elf, path.join(suite, 'src', f),
    ]);
    if (r.status !== 0) failures.push({ name, message: (r.stderr || r.error || `exit status ${r.status}`).trim().split('\n').slice(0, 3).join(' ') });
    else {
      const ref = path.join(suite, 'references', `${name}.reference_output`);
      tests.push({ name, elf, reference: existsSync(ref) ? ref : undefined });
    }
  }
  return { tests, failures };
}

export interface TestOutcome {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  problems: string[];
  note?: string;
}

/** Runs one test on the machines and compares signatures. `runners` are injectable for tests. */
export function judgeTest(
  t: ArchTest,
  bytes: Uint8Array,
  options: { core: boolean; maxSteps: number },
  reference: number[] | undefined,
  runners = { interpreter: runInterpreter, core: runCore },
): TestOutcome {
  const problems: string[] = [];
  let loaded: LoadedTest;
  try {
    loaded = loadTest(parseElf32(bytes));
  } catch (e) {
    return { name: t.name, status: 'fail', problems: [`cannot load ${path.basename(t.elf)}: ${(e as Error).message}`] };
  }
  const interp = runners.interpreter(loaded, options.maxSteps);
  if (interp.error) problems.push(`interpreter: ${interp.error}`);
  else if (reference) {
    const d = compareSignatures(interp.signature!, reference, true);
    if (d) problems.push(`interpreter signature differs from the reference: ${d}`);
  }
  let coreRun: MachineRun | undefined;
  if (options.core) {
    coreRun = runners.core(loaded, options.maxSteps * 2);
    if (coreRun.error) problems.push(`DCL core: ${coreRun.error}`);
    else if (reference) {
      const d = compareSignatures(coreRun.signature!, reference, true);
      if (d) problems.push(`DCL core signature differs from the reference: ${d}`);
    } else if (interp.signature) {
      const d = compareSignatures(coreRun.signature!, interp.signature);
      if (d) problems.push(`DCL core signature differs from the interpreter's: ${d}`);
    }
  }
  return { name: t.name, status: problems.length ? 'fail' : 'pass', problems, note: reference ? undefined : 'no reference_output: machines compared with each other' };
}

export interface Rv32iOptions {
  env?: NodeJS.ProcessEnv;
  run?: Runner;
  log?: Logger;
  args?: string[];
  /** Replaces the two machines (tests). */
  runners?: Parameters<typeof judgeTest>[4];
}

function parseArgs(args: string[]): { flags: Set<string>; values: Record<string, string> } {
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
    if (!m) throw new Error(`unexpected argument ${a}`);
    if (m[1] === 'no-core') flags.add('no-core');
    else if (['only', 'skip', 'max-steps'].includes(m[1]!)) values[m[1]!] = m[2] ?? args[++i] ?? '';
    else throw new Error(`unknown option ${a}`);
  }
  return { flags, values };
}

export async function main(options: Rv32iOptions = {}): Promise<number> {
  const env = options.env ?? process.env;
  const run = options.run ?? realRunner;
  const log = options.log ?? consoleLogger;
  let parsed: ReturnType<typeof parseArgs>;
  let only: RegExp | undefined;
  let skip: RegExp | undefined;
  try {
    parsed = parseArgs(options.args ?? []);
    only = parsed.values.only ? new RegExp(parsed.values.only) : undefined;
    skip = new RegExp(parsed.values.skip ?? env.RV32I_SKIP ?? 'misalign|ecall|ebreak');
  } catch (e) {
    log.error(`validate:rv32i: ${(e as Error).message}`);
    return 2;
  }
  const maxSteps = Number(parsed.values['max-steps'] ?? 5_000_000);
  const root = env.RISCV_ARCH_TEST;
  if (!root) {
    log.log(skipMessage('riscv-arch-test', 'it (git clone https://github.com/riscv-non-isa/riscv-arch-test; its tests as ELF files, or a RISC-V toolchain to build them)', 'RISCV_ARCH_TEST=/path/to/riscv-arch-test'));
    return 0;
  }
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    log.error(`validate:rv32i: RISCV_ARCH_TEST=${root} is not a directory`);
    return 1;
  }
  let tests = findTests(root);
  const buildFailures: { name: string; message: string }[] = [];
  if (tests.length === 0) {
    const gcc = findCompiler(env);
    if (!gcc) {
      log.log(skipMessage('a RISC-V toolchain', 'riscv64-unknown-elf-gcc (or riscv-none-elf-gcc), or precompiled .elf tests under RISCV_ARCH_TEST,', 'RISCV_PREFIX=riscv64-unknown-elf-'));
      return 0;
    }
    const work = mkdtempSync(path.join(tmpdir(), 'validate-rv32i-'));
    log.log(`validate:rv32i: no .elf files under ${root}; compiling the RV32I tests with ${gcc} into ${work}`);
    const built = buildTests(root, gcc, work, env, run);
    tests = built.tests;
    buildFailures.push(...built.failures);
  }
  const selected = tests.filter((t) => !only || only.test(t.name));
  const outcomes: TestOutcome[] = buildFailures.map((f) => ({ name: f.name, status: 'fail' as const, problems: [`cannot compile: ${f.message}`] }));
  for (const t of selected) {
    if (skip.test(t.name)) {
      outcomes.push({ name: t.name, status: 'skip', problems: [] });
      continue;
    }
    let reference: number[] | undefined;
    try {
      reference = t.reference ? parseSignature(readFileSync(t.reference, 'utf8')) : undefined;
    } catch (e) {
      outcomes.push({ name: t.name, status: 'fail', problems: [`bad reference file ${t.reference}: ${(e as Error).message}`] });
      continue;
    }
    outcomes.push(judgeTest(t, readFileSync(t.elf), { core: !parsed.flags.has('no-core'), maxSteps }, reference, options.runners));
  }
  let pass = 0;
  let fail = 0;
  let skipped = 0;
  for (const o of outcomes) {
    if (o.status === 'pass') pass++;
    else if (o.status === 'skip') skipped++;
    else fail++;
    log.log(`  ${o.status === 'pass' ? 'ok  ' : o.status === 'skip' ? 'skip' : 'FAIL'}  ${o.name}${o.note ? ` (${o.note})` : ''}`);
    for (const p of o.problems) log.log(`          ${p}`);
  }
  log.log(`validate:rv32i: ${pass} passed, ${fail} failed, ${skipped} skipped, of ${outcomes.length} tests${parsed.flags.has('no-core') ? ' (interpreter only)' : ''}`);
  return fail ? 1 : 0;
}
