/**
 * Running assembly exercises: assemble for Octet or RV32I, run a test's set-up on the reference interpreter
 * and compare the final registers, memory, LEDs, hex display and console text with what the test expects.
 * Pure TypeScript: the component is a shell around it.
 */
import { octet, rv32i, type Diagnostic } from '$lib/sim/cpu';

export type Isa = 'octet' | 'rv32i';

export interface AsmTest {
  name?: string;
  setup?: {
    /** Register values: `R0`… for Octet, `x5` or ABI names (`a0`) for RV32I. */
    regs?: Record<string, number>;
    /** Bytes of memory: address (a number, `"0x80"` or a label of the program) → value. */
    mem?: Record<string, number>;
    /** RV32I words (little-endian), same keys. */
    words?: Record<string, number>;
    switches?: number;
    buttons?: number;
    adc?: number;
    /** Text waiting on the console input. */
    input?: string;
  };
  expect?: {
    regs?: Record<string, number>;
    mem?: Record<string, number>;
    words?: Record<string, number>;
    leds?: number;
    hex?: number;
    /** The console output must be exactly this text. */
    console?: string;
    /** The program must (default) or must not stop on its own. */
    halted?: boolean;
  };
  /** Instruction limit for this test (default: the exercise's). */
  maxSteps?: number;
}

export interface AsmInput {
  id: string;
  title?: string;
  prompt?: string;
  hints?: string[];
  explain?: string;
  isa?: Isa;
  start?: string;
  tests: AsmTest[];
  /** Instruction limit (default 100 000). */
  maxSteps?: number;
  /** The program may use at most this many bytes. */
  maxBytes?: number;
  /** Each test may take at most this many clock cycles. */
  maxCycles?: number;
  solution?: string;
}

export interface Assembled {
  ok: boolean;
  diagnostics: Diagnostic[];
  /** Bytes of code and data. */
  size: number;
  program?: octet.OctetProgram | rv32i.Rv32Program;
}

export function assembleSource(isa: Isa, source: string): Assembled {
  const p = isa === 'octet' ? octet.assemble(source) : rv32i.assemble(source);
  return { ok: p.ok, diagnostics: p.diagnostics, size: p.size, program: p };
}

const parseAddress = (key: string, symbols: Record<string, number>): number => {
  const k = String(key).trim();
  if (k in symbols) return symbols[k]!;
  const n = /^0x[0-9a-f]+$/i.test(k) ? parseInt(k, 16) : /^-?\d+$/.test(k) ? Number(k) : NaN;
  if (Number.isNaN(n)) throw new Error(`"${k}" is not an address or a label of the program`);
  return n;
};

export function octetRegister(name: string): number {
  const m = /^r([0-3])$/i.exec(name.trim());
  if (!m) throw new Error(`"${name}" is not an Octet register (R0 to R3)`);
  return Number(m[1]);
}

export function rv32Register(name: string): number {
  const n = rv32i.parseRegister(name.trim());
  if (n === undefined) throw new Error(`"${name}" is not an RV32I register`);
  return n;
}

export interface TestResult {
  name: string;
  pass: boolean;
  /** What went wrong, one message per mismatch. */
  failures: string[];
  steps: number;
  cycles: number;
  stopped: 'halted' | 'limit' | 'other';
  consoleText: string;
  leds: number;
  hex: number;
}

const hex = (n: number, w = 2) => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(w, '0');

export function runTest(isa: Isa, program: octet.OctetProgram | rv32i.Rv32Program, test: AsmTest, limits: { maxSteps?: number; maxCycles?: number } = {}): TestResult {
  const name = test.name ?? 'test';
  const failures: string[] = [];
  const maxSteps = test.maxSteps ?? limits.maxSteps ?? 100_000;
  const syms = program.symbols;
  const su = test.setup ?? {};
  let leds = 0;
  let hexv = 0;
  let consoleText = '';
  let steps = 0;
  let cycles = 0;
  let stopped: TestResult['stopped'] = 'other';
  let read: (kind: 'reg' | 'mem' | 'word', key: string) => { value: number; label: string };
  try {
    if (isa === 'octet') {
      const m = new octet.OctetMachine();
      m.load(program as octet.OctetProgram);
      for (const [k, v] of Object.entries(su.regs ?? {})) m.r[octetRegister(k)] = v & 255;
      for (const [k, v] of Object.entries(su.mem ?? {})) m.memory[parseAddress(k, syms) & 255] = v & 255;
      m.board.switches = su.switches ?? 0;
      m.board.buttons = su.buttons ?? 0;
      m.board.adc = su.adc ?? 0;
      if (su.input) m.board.type(su.input);
      const r = m.run(maxSteps);
      steps = r.steps;
      cycles = m.cycles;
      stopped = r.reason === 'halted' ? 'halted' : r.reason === 'max-steps' ? 'limit' : 'other';
      leds = m.board.leds;
      hexv = m.board.hex;
      consoleText = m.board.consoleText;
      read = (kind, key) => {
        if (kind === 'reg') return { value: m.r[octetRegister(key)]!, label: key.toUpperCase() };
        const a = parseAddress(key, syms) & 255;
        return { value: m.peek(a), label: `memory at ${key} (${hex(a)})` };
      };
    } else {
      const m = new rv32i.Rv32Machine();
      m.load(program as rv32i.Rv32Program);
      for (const [k, v] of Object.entries(su.regs ?? {})) m.setReg(rv32Register(k), v);
      for (const [k, v] of Object.entries(su.mem ?? {})) m.memory[parseAddress(k, syms)] = v & 255;
      for (const [k, v] of Object.entries(su.words ?? {})) m.write(parseAddress(k, syms), v, 4);
      m.board.switches = su.switches ?? 0;
      m.board.buttons = su.buttons ?? 0;
      m.board.adc = su.adc ?? 0;
      if (su.input) m.board.type(su.input);
      const r = m.run(maxSteps);
      steps = r.steps;
      cycles = m.cycles;
      const halted = r.reason === 'trap' && (m.trap?.cause === 'breakpoint' || m.trap?.cause === 'ecall');
      stopped = halted ? 'halted' : r.reason === 'max-steps' ? 'limit' : 'other';
      if (r.reason === 'trap' && !halted && m.trap) failures.push(`The program crashed: ${m.trap.message}.`);
      leds = m.board.leds;
      hexv = m.board.hex;
      consoleText = m.board.consoleText;
      read = (kind, key) => {
        if (kind === 'reg') return { value: m.reg(rv32Register(key)), label: key };
        const a = parseAddress(key, syms);
        if (kind === 'word') return { value: m.read(a, 4) >>> 0, label: `word at ${key} (${hex(a, 8)})` };
        return { value: m.read(a, 1), label: `memory at ${key} (${hex(a, 8)})` };
      };
    }
  } catch (e) {
    return { name, pass: false, failures: [e instanceof Error ? e.message : String(e)], steps, cycles, stopped, consoleText, leds, hex: hexv };
  }

  const ex = test.expect ?? {};
  if ((ex.halted ?? true) && stopped === 'limit') failures.push(`The program did not stop within ${maxSteps} instructions (an endless loop?).`);
  if (ex.halted === false && stopped === 'halted') failures.push('The program stopped, but it should keep running.');
  const num = (v: number, kind: 'reg' | 'mem' | 'word') => (kind === 'mem' || isa === 'octet' ? `${v} (${hex(v)})` : `${v | 0} (${hex(v, 8)})`);
  for (const [kind, table] of [['reg', ex.regs], ['mem', ex.mem], ['word', ex.words]] as const) {
    for (const [k, want] of Object.entries(table ?? {})) {
      let got;
      try {
        got = read(kind, k);
      } catch (e) {
        failures.push(e instanceof Error ? e.message : String(e));
        continue;
      }
      const w = kind === 'reg' && isa === 'octet' ? want & 255 : kind === 'mem' ? want & 255 : want >>> 0;
      if (got.value >>> 0 !== w >>> 0) failures.push(`${got.label} is ${num(got.value, kind)}, expected ${num(w, kind)}.`);
    }
  }
  if (ex.leds !== undefined && leds !== (ex.leds & 255)) failures.push(`The LEDs show ${hex(leds)}, expected ${hex(ex.leds & 255)}.`);
  if (ex.hex !== undefined && hexv !== ex.hex) failures.push(`The hex display shows ${hex(hexv, 4)}, expected ${hex(ex.hex, 4)}.`);
  if (ex.console !== undefined && consoleText !== ex.console) failures.push(`The console printed ${JSON.stringify(consoleText)}, expected ${JSON.stringify(ex.console)}.`);
  if (limits.maxCycles !== undefined && cycles > limits.maxCycles) failures.push(`It took ${cycles} clock cycles; the limit is ${limits.maxCycles}.`);
  return { name, pass: failures.length === 0, failures, steps, cycles, stopped, consoleText, leds, hex: hexv };
}

export interface AsmOutcome {
  pass: boolean;
  /** Assembly problems (nothing was run when there are errors). */
  diagnostics: Diagnostic[];
  size: number;
  results: TestResult[];
  /** Rule violations (size limit). */
  violations: string[];
}

/** Assemble and run every test. */
export function checkAsm(input: AsmInput, source: string): AsmOutcome {
  const isa = input.isa ?? 'octet';
  const a = assembleSource(isa, source);
  if (!a.ok) return { pass: false, diagnostics: a.diagnostics, size: a.size, results: [], violations: [] };
  const violations: string[] = [];
  if (input.maxBytes !== undefined && a.size > input.maxBytes) violations.push(`The program is ${a.size} bytes; the limit is ${input.maxBytes}.`);
  const results = input.tests.map((t, i) => runTest(isa, a.program!, { ...t, name: t.name ?? `test ${i + 1}` }, { maxSteps: input.maxSteps, maxCycles: input.maxCycles }));
  return { pass: results.every((r) => r.pass) && violations.length === 0, diagnostics: a.diagnostics, size: a.size, results, violations };
}

/** A run for the I/O panel: the final state of the LEDs, hex display, console, registers. */
export interface RunView {
  reason: string;
  steps: number;
  cycles: number;
  leds: number;
  hex: number;
  consoleText: string;
  matrix: number[];
  regs: { name: string; value: number }[];
  pc: number;
}

export function runOnce(isa: Isa, program: octet.OctetProgram | rv32i.Rv32Program, inputs: { switches?: number; buttons?: number; adc?: number; input?: string } = {}, maxSteps = 100_000): RunView {
  if (isa === 'octet') {
    const m = new octet.OctetMachine();
    m.load(program as octet.OctetProgram);
    m.board.switches = inputs.switches ?? 0;
    m.board.buttons = inputs.buttons ?? 0;
    m.board.adc = inputs.adc ?? 0;
    if (inputs.input) m.board.type(inputs.input);
    const r = m.run(maxSteps);
    return { reason: r.reason === 'halted' ? 'halted' : r.reason === 'max-steps' ? `stopped after ${maxSteps} instructions` : r.reason, steps: m.steps, cycles: m.cycles, leds: m.board.leds, hex: m.board.hex, consoleText: m.board.consoleText, matrix: [...m.board.matrix], regs: [...m.r].map((v, i) => ({ name: `R${i}`, value: v })), pc: m.pc };
  }
  const m = new rv32i.Rv32Machine();
  m.load(program as rv32i.Rv32Program);
  m.board.switches = inputs.switches ?? 0;
  m.board.buttons = inputs.buttons ?? 0;
  m.board.adc = inputs.adc ?? 0;
  if (inputs.input) m.board.type(inputs.input);
  const r = m.run(maxSteps);
  const reason = r.reason === 'trap' ? (m.trap?.cause === 'breakpoint' || m.trap?.cause === 'ecall' ? 'halted' : `crashed: ${m.trap?.message}`) : r.reason === 'max-steps' ? `stopped after ${maxSteps} instructions` : r.reason;
  return { reason, steps: m.steps, cycles: m.cycles, leds: m.board.leds, hex: m.board.hex, consoleText: m.board.consoleText, matrix: [...m.board.matrix], regs: [10, 11, 12, 13, 5, 6, 7].map((n) => ({ name: rv32i.registerName(n), value: m.reg(n) | 0 })), pc: m.pc };
}
