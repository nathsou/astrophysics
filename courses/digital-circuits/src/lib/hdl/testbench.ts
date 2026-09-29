/**
 * Runs the `test "…" { … }` blocks of a DCL source (HDL.md, *Tests*).
 *
 * Tests are the only place where code runs in order. Each `sim M(…)` creates an RTL simulator of the
 * checked module; `x.port = v` drives an input; `step n` pulses the clock of every simulated instance
 * (or only the named clock, with `step n on clk`); `expect` checks a condition and `print` writes a line.
 * `random(bits<N>)` draws from a seeded generator, so a run is reproducible: the same seed gives the same
 * values, and each test has its own stream, independent of the other tests.
 *
 * A failing `expect` does not stop the test. It is reported with its span, the values of the signals it
 * reads, and a small waveform: every port of the instance, a few cycles before and after the failure.
 */
import { check, type ModuleSpec, type TestPlanStmt } from './check';
import { renderDiagnostic, type Diagnostic } from './diagnostics';
import { elaborateSpec } from './elaborate';
import { createRtlSim, type RtlSim } from './rtlsim';
import { SourceFile, type Span } from './span';
import { EvalError, evalTExpr, formatValue, walkTExpr, widthOf, type TExpr, type Type } from './tir';

export interface RunTestsOptions {
  file?: string;
  /** Seed of `random(…)` (default 1). */
  seed?: number;
  /** Runs only the tests whose name contains this string (or passes this predicate). */
  filter?: string | ((name: string) => boolean);
  mode?: 'compiled' | 'interpreted';
  /** Stops a test after this many clock cycles (default 10 million). */
  maxCycles?: number;
  /** Cycles shown before and after a failure in its waveform (default 4 and 3). */
  before?: number;
  after?: number;
  /** Reports at most this many failures per test (default 10). */
  maxFailures?: number;
}

export interface WaveSignal {
  name: string;
  type: Type;
  values: bigint[];
}

/** Port values of one simulated instance over a range of cycles. */
export interface Waveform {
  sim: string;
  module: string;
  firstCycle: number;
  /** The cycle of the failure. */
  marker: number;
  signals: WaveSignal[];
}

export interface TestFailure {
  message: string;
  span: Span;
  /** The source text of the condition. */
  text: string;
  cycle: number;
  /** The signals and variables the condition reads, with their values. */
  values: { name: string; value: string }[];
  waveform?: Waveform;
}

export interface TestResult {
  name: string;
  span: Span;
  passed: boolean;
  /** Not run because the test (or the design it simulates) has errors. */
  skipped: boolean;
  failures: TestFailure[];
  /** Lines written by `print`. */
  output: string[];
  /** Clock cycles simulated (of the first instance). */
  cycles: number;
  /** A run-time error (a value that does not fit, too many cycles, …). */
  error?: { message: string; span: Span };
}

export interface TestRunResult {
  diagnostics: Diagnostic[];
  results: TestResult[];
  /** Whether the source checks without errors and every test passes. */
  passed: boolean;
  source: SourceFile;
}

// ------------------------------------------------------------------------------------ random numbers

/** A small, fast PRNG (sfc32-like) seeded from a string and a number. */
class Random {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  constructor(seed: number, name: string) {
    let h = 1779033703 ^ name.length;
    for (let i = 0; i < name.length; i++) {
      h = Math.imul(h ^ name.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    this.a = h >>> 0;
    this.b = seed >>> 0;
    this.c = 0x9e3779b9;
    this.d = (Math.imul(seed ^ 0x85ebca6b, 0xc2b2ae35) ^ h) >>> 0;
    for (let i = 0; i < 12; i++) this.next32();
  }
  next32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }
  bits(w: number): bigint {
    let v = 0n;
    for (let k = 0; k < w; k += 32) v = (v << 32n) | BigInt(this.next32());
    return v & ((1n << BigInt(w)) - 1n);
  }
}

// ------------------------------------------------------------------------------------ running

interface SimEntry {
  name: string;
  spec: ModuleSpec;
  sim: RtlSim;
  ports: { name: string; type: Type }[];
  /** Recent samples: cycle → port values. */
  ring: { cycle: number; values: bigint[] }[];
  /** Failures still collecting the cycles after them. */
  pending: { failure: TestFailure; remaining: number }[];
}

class Abort extends Error {
  constructor(
    message: string,
    readonly span: Span,
  ) {
    super(message);
  }
}

class TestRun {
  private sims = new Map<string, SimEntry>();
  private vars = new Map<string, bigint>();
  private rng: Random;
  private designs = new Map<string, ReturnType<typeof elaborateSpec>>();
  readonly result: TestResult;
  private cycles = 0;

  constructor(
    name: string,
    span: Span,
    private opts: Required<Omit<RunTestsOptions, 'filter' | 'file' | 'mode'>> & { mode?: 'compiled' | 'interpreted' },
    private texts: (span: Span) => string,
  ) {
    this.rng = new Random(opts.seed, name);
    this.result = { name, span, passed: true, skipped: false, failures: [], output: [], cycles: 0 };
  }

  private value(e: TExpr): bigint {
    return evalTExpr(e, {
      ref: (r) => {
        if (r.ref === 'testvar') {
          const v = this.vars.get(r.name);
          if (v === undefined) throw new Abort(`\`${r.name}\` has no value yet`, r.span);
          return v;
        }
        if (r.ref === 'simport') {
          const dot = r.name.indexOf('.');
          const s = this.sims.get(r.name.slice(0, dot));
          if (!s) throw new Abort(`unknown instance \`${r.name.slice(0, dot)}\``, r.span);
          return s.sim.getBig(r.name.slice(dot + 1));
        }
        throw new Abort(`\`${r.name}\` cannot be read in a test`, r.span);
      },
      random: (t) => this.rng.bits(Math.max(1, widthOf(t))),
    });
  }

  private sample(s: SimEntry): void {
    const cycle = s.sim.cycle;
    const values = s.ports.map((p) => s.sim.getBig(p.name));
    const last = s.ring[s.ring.length - 1];
    if (last && last.cycle === cycle) {
      last.values = values;
      return;
    }
    // A new cycle: the previous sample is final, so failures waiting for later cycles get it.
    if (last) {
      for (const p of s.pending) {
        if (p.remaining > 0 && last.cycle > p.failure.cycle) {
          this.appendSample(p.failure, last);
          p.remaining--;
        }
      }
      s.pending = s.pending.filter((p) => p.remaining > 0);
    }
    s.ring.push({ cycle, values });
    if (s.ring.length > this.opts.before + 1) s.ring.shift();
  }

  private appendSample(f: TestFailure, sample: { cycle: number; values: bigint[] }): void {
    const w = f.waveform!;
    sample.values.forEach((v, i) => w.signals[i]!.values.push(v));
    void w;
  }

  /** Flushes the final samples into pending failures at the end of the test. */
  private finish(): void {
    for (const s of this.sims.values()) {
      this.sample(s);
      const last = s.ring[s.ring.length - 1];
      for (const p of s.pending) if (last && p.remaining > 0 && last.cycle > p.failure.cycle) this.appendSample(p.failure, last);
      s.pending = [];
    }
  }

  run(body: TestPlanStmt[]): void {
    try {
      this.stmts(body);
    } catch (e) {
      if (e instanceof Abort || e instanceof EvalError) this.result.error = { message: e.message, span: e.span };
      else throw e;
    }
    this.finish();
    this.result.cycles = this.cycles;
    this.result.passed = !this.result.error && this.result.failures.length === 0;
  }

  private stmts(list: TestPlanStmt[]): void {
    for (const s of list) this.stmt(s);
  }

  private stmt(s: TestPlanStmt): void {
    switch (s.k) {
      case 'sim': {
        let design = this.designs.get(s.spec.key);
        if (!design) {
          design = elaborateSpec(s.spec);
          this.designs.set(s.spec.key, design);
        }
        const sim = createRtlSim(design, undefined, { mode: this.opts.mode });
        const ports = [...s.spec.inputs, ...s.spec.outputs].filter((p) => p.type.k !== 'clock').map((p) => ({ name: p.name, type: p.type }));
        for (const [port, e] of s.inits) sim.set(port, this.value(e));
        const entry: SimEntry = { name: s.name, spec: s.spec, sim, ports, ring: [], pending: [] };
        this.sims.set(s.name, entry);
        break;
      }
      case 'let':
      case 'setvar':
        this.vars.set(s.name, this.value(s.expr));
        break;
      case 'setport': {
        const e = this.sims.get(s.sim)!;
        e.sim.set(s.port, this.value(s.expr));
        break;
      }
      case 'step': {
        const n = s.count ? Number(this.value(s.count)) : 1;
        if (n < 0) throw new Abort(`cannot step a negative number of cycles (${n})`, s.span);
        for (let i = 0; i < n; i++) {
          for (const e of this.sims.values()) {
            const clocks = e.spec.clocks;
            if (s.clock !== undefined && !clocks.includes(s.clock)) continue;
            if (!clocks.length) continue;
            this.sample(e);
            if (s.clock !== undefined) e.sim.tick(s.clock);
            else e.sim.step();
          }
          if (++this.cycles > this.opts.maxCycles) throw new Abort(`the test ran for more than ${this.opts.maxCycles} cycles`, s.span);
        }
        break;
      }
      case 'expect': {
        const v = this.value(s.cond);
        if (v) break;
        if (this.result.failures.length >= this.opts.maxFailures) break;
        this.fail(s);
        break;
      }
      case 'print': {
        const parts = s.args.map((a) => (typeof a === 'string' ? a : formatValue(this.value(a), a.t)));
        this.result.output.push(parts.join(' '));
        break;
      }
      case 'for': {
        const from = this.value(s.from);
        const to = this.value(s.to);
        for (let i = from; i < to; i++) {
          this.vars.set(s.var, i);
          this.stmts(s.body);
        }
        break;
      }
    }
  }

  private fail(s: Extract<TestPlanStmt, { k: 'expect' }>): void {
    // The values the condition reads.
    const values: TestFailure['values'] = [];
    const seen = new Set<string>();
    let simName: string | undefined;
    walkTExpr(s.cond, (e) => {
      if (e.k !== 'ref' || seen.has(e.name)) return;
      if (e.ref !== 'simport' && e.ref !== 'testvar') return;
      seen.add(e.name);
      if (e.ref === 'simport') simName ??= e.name.slice(0, e.name.indexOf('.'));
      values.push({ name: e.name, value: formatValue(this.value(e), e.t) });
    });
    values.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const entry = simName ? this.sims.get(simName) : this.sims.values().next().value;
    const cycle = entry?.sim.cycle ?? 0;
    const failure: TestFailure = { message: `expectation failed: ${s.text}`, span: s.span, text: s.text, cycle, values };
    if (entry) {
      this.sample(entry);
      const window = entry.ring.slice(-(this.opts.before + 1));
      failure.waveform = {
        sim: entry.name,
        module: entry.spec.key,
        firstCycle: window[0]?.cycle ?? cycle,
        marker: cycle,
        signals: entry.ports.map((p, i) => ({ name: p.name, type: p.type, values: window.map((w) => w.values[i]!) })),
      };
      if (this.opts.after > 0) entry.pending.push({ failure, remaining: this.opts.after });
    }
    this.result.failures.push(failure);
    void this.texts;
  }
}

/** Checks a DCL source and runs its tests. */
export function runTests(source: string, options: RunTestsOptions = {}): TestRunResult {
  const file = options.file ?? 'input.dcl';
  const { diagnostics, program } = check(source, { file });
  const errors = diagnostics.some((d) => d.severity === 'error');
  const filter = options.filter;
  const wanted = (name: string) => (filter === undefined ? true : typeof filter === 'string' ? name.includes(filter) : filter(name));
  const opts = {
    seed: options.seed ?? 1,
    maxCycles: options.maxCycles ?? 10_000_000,
    before: options.before ?? 4,
    after: options.after ?? 3,
    maxFailures: options.maxFailures ?? 10,
    mode: options.mode,
  };
  const text = (span: Span) => program.source.text.slice(span.start, span.end);
  const results: TestResult[] = [];
  for (const plan of program.tests) {
    if (!wanted(plan.name)) continue;
    const run = new TestRun(plan.name, plan.span, opts, text);
    const specsOk = plan.body.every((s) => s.k !== 'sim' || !hasErrorsDeep(s.spec));
    if (!plan.ok || !specsOk || errors) {
      run.result.passed = false;
      run.result.skipped = true;
      const first = diagnostics.find((d) => d.severity === 'error');
      run.result.error = { message: first ? `not run: ${first.message}` : 'not run: the test has errors', span: first?.span ?? plan.span };
      results.push(run.result);
      continue;
    }
    run.run(plan.body);
    results.push(run.result);
  }
  return { diagnostics, results, passed: !errors && results.every((r) => r.passed), source: program.source };
}

function hasErrorsDeep(spec: ModuleSpec, seen = new Set<string>()): boolean {
  if (seen.has(spec.key)) return false;
  seen.add(spec.key);
  if (spec.hasErrors) return true;
  for (const i of spec.insts.values()) if (hasErrorsDeep(i.spec, seen)) return true;
  return false;
}

// ------------------------------------------------------------------------------------ rendering

function short(v: bigint, t: Type): string {
  if (t.k === 'enum') {
    const i = t.codes.indexOf(v);
    return i >= 0 ? t.variants[i]! : `?${v}`;
  }
  if (t.k === 'bits' && t.signed) return formatValue(v, t);
  if (widthOf(t) <= 8) return String(v);
  return `0x${v.toString(16)}`;
}

/** A waveform as a text table, with the failing cycle in brackets. */
export function renderWaveform(w: Waveform): string {
  const n = w.signals[0]?.values.length ?? 0;
  const cycles = Array.from({ length: n }, (_, i) => w.firstCycle + i);
  const cols = cycles.map((c, i) => {
    const cells = w.signals.map((s) => short(s.values[i]!, s.type));
    const head = c === w.marker ? `[${c}]` : String(c);
    const width = Math.max(head.length, ...cells.map((x) => x.length));
    return { head, cells, width };
  });
  const names = w.signals.map((s) => `${w.sim}.${s.name}`);
  const nameW = Math.max('cycle'.length, ...names.map((x) => x.length));
  const lines = [`${'cycle'.padStart(nameW)} │ ${cols.map((c) => c.head.padStart(c.width)).join('  ')}`];
  w.signals.forEach((_, i) => lines.push(`${names[i]!.padStart(nameW)} │ ${cols.map((c) => c.cells[i]!.padStart(c.width)).join('  ')}`));
  return lines.join('\n');
}

/** A test result as text: the failures as diagnostics, with their values and waveforms. */
export function renderTestResult(source: string | SourceFile, r: TestResult): string {
  const src = typeof source === 'string' ? new SourceFile(r.span.file, source) : source;
  const out = [`${r.passed ? 'PASS' : r.skipped ? 'SKIP' : 'FAIL'} ${r.name} (${r.cycles} cycles)`];
  for (const line of r.output) out.push(`  print: ${line}`);
  if (r.error) out.push(renderDiagnostic(src, { severity: 'error', code: 'test-error', message: r.error.message, span: r.error.span }));
  for (const f of r.failures) {
    const values = f.values.map((v) => `${v.name} = ${v.value}`).join(', ');
    out.push(
      renderDiagnostic(src, {
        severity: 'error', code: 'expect-failed', message: f.message, span: f.span,
        label: values ? values : 'false', notes: [`at cycle ${f.cycle}`],
      }),
    );
    if (f.waveform) out.push(renderWaveform(f.waveform).replace(/^/gm, '    '));
  }
  return out.join('\n');
}
