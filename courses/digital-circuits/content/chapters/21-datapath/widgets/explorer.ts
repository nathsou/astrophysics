/**
 * The datapath as a bench instrument (Chapter 21's flagship): the gate-level datapath of Octet, with a set of
 * switches for every control line and a front panel of eight data switches that can drive the bus, so the
 * reader can be the control unit. No logic here draws anything; `DatapathExplorer.svelte` shows it.
 */
import type { SubResolver } from '$lib/sim/netlist/connect';
import { Hw } from '../hardware/hw';
import { addDatapath, FLAG_NETS } from '../hardware/datapath';
import { DATAPATH_LINES, OE_LINES, aluCode, type AluOp, type DatapathLine } from '../hardware/control-word';
import { Rig, built, referenceParts } from '../hardware/rig';
import type { Level } from '../hardware/hw';

/** Lines of the explorer: the datapath's 24, and the front panel's driver. */
export type ExplorerLine = DatapathLine | 'OE_SW';
export const EXPLORER_LINES: ExplorerLine[] = [...DATAPATH_LINES, 'OE_SW'];

export type LineSet = Partial<Record<ExplorerLine, boolean | number>>;

/** A source or destination of the bus, for drawing. */
export type Block = 'PC' | 'SP' | 'T' | 'MAR' | 'IR' | 'A' | 'B' | 'FLAGS' | 'RD' | 'RS' | 'ALU' | 'MEM' | 'SW' | 'RF';

export interface ExplorerState {
  pc?: number;
  sp?: number;
  mar?: number;
  ir?: number;
  a?: number;
  b?: number;
  t?: number;
  r: (number | undefined)[];
  flags: { z: boolean; c: boolean; n: boolean; v: boolean } | undefined;
  /** The bus as bits, most significant first: 0, 1, `z` (nothing drives it) or `?` (unknown: contention or an unknown input). */
  bus: string;
  busValue?: number;
  /** Two drivers disagree on a bus wire. */
  contention: boolean;
  /** The ALU's result and second operand (whatever the ALU is computing now). */
  alu?: number;
  aluB?: number;
  /** The memory byte MAR points at. */
  mem?: number;
}

export interface Preset {
  ir?: number;
  r?: number[];
  a?: number;
  b?: number;
  t?: number;
  pc?: number;
  mar?: number;
  /** Bytes of RAM. */
  mem?: Record<number, number>;
}

/** The explorer's circuit. */
export function buildExplorer(level: Level = 'parts') {
  const hw = new Hw('Octet datapath', level);
  addDatapath(hw, { memory: 'ram', declareInputs: true, panel: true });
  return built(hw);
}

export class Explorer {
  readonly rig: Rig;
  readonly half = 100e-9;
  /** Rising clock edges since reset or the last setup. */
  clocks = 0;
  /** Lines that are on now. */
  readonly on = new Set<ExplorerLine>();
  private sw = 0;

  constructor(o: { level?: Level; resolver?: SubResolver } = {}) {
    this.rig = new Rig(buildExplorer(o.level ?? 'parts'), o.resolver ?? referenceParts);
    this.rig.run(this.half);
    this.reset();
  }

  /** Reset the registers (RST for one clock edge) and turn every line off. */
  reset(): void {
    const r = this.rig;
    this.allOff();
    r.set('RST', 1);
    r.run(this.half);
    this.pulse();
    r.set('RST', 0);
    r.run(this.half);
    this.clocks = 0;
  }

  private pulse(): void {
    const r = this.rig;
    r.set('CLK', 1);
    r.run(this.half);
    r.set('CLK', 0);
    r.run(this.half);
  }

  allOff(): void {
    for (const n of [...this.on]) this.set(n, false);
  }

  /** Flip one control line. */
  set(name: ExplorerLine, on: boolean | number): void {
    const v = !!on;
    if (v) this.on.add(name);
    else this.on.delete(name);
    this.rig.set(name, v);
    this.rig.run(this.half);
  }

  /** Make exactly these lines the ones that are on. */
  apply(lines: LineSet): void {
    for (const n of EXPLORER_LINES) {
      const want = !!lines[n];
      if (want !== this.on.has(n)) this.set(n, want);
    }
  }

  /** The value of the front-panel switches. */
  setSwitches(v: number): void {
    this.sw = v & 255;
    this.rig.setWord('SW', this.sw);
    this.rig.run(this.half);
  }
  get switches(): number {
    return this.sw;
  }

  /** ALU operation and second-operand source as lines. */
  static aluLines(op: AluOp, b: 'B' | 'A' | 'ONE' = 'B'): LineSet {
    const c = aluCode(op);
    return { ALU_OP0: c & 1, ALU_OP1: (c >> 1) & 1, ALU_OP2: (c >> 2) & 1, BSEL_A: b === 'A', BSEL_1: b === 'ONE' };
  }

  /** One rising edge of the clock: every register whose load line is on listens to the bus. */
  tick(): void {
    this.pulse();
    this.clocks++;
  }

  /** Set the lines, clock once, and turn the lines off again: one micro-step of a control unit. */
  microStep(lines: LineSet, panel?: number): void {
    if (panel !== undefined) this.setSwitches(panel);
    this.apply(lines);
    this.tick();
    this.allOff();
  }

  /** Bring the datapath to a state by clocking values in from the front panel. Leaves every line off and the clock count at 0. */
  setup(p: Preset): void {
    this.reset();
    const load = (line: DatapathLine, v: number) => this.microStep({ OE_SW: 1, [line]: 1 }, v);
    if (p.a !== undefined) load('LD_A', p.a);
    if (p.b !== undefined) load('LD_B', p.b);
    if (p.t !== undefined) load('LD_T', p.t);
    if (p.mar !== undefined) load('LD_MAR', p.mar);
    if (p.pc !== undefined) load('PC_LD', p.pc);
    (p.r ?? []).forEach((v, i) => {
      this.microStep({ OE_SW: 1, LD_IR: 1 }, i << 2);
      load('WE_R', v);
    });
    if (p.ir !== undefined) load('LD_IR', p.ir);
    else if (p.r?.length) load('LD_IR', 0);
    for (const [a, v] of Object.entries(p.mem ?? {})) this.rig.poke(Number(a), v);
    this.setSwitches(0);
    this.clocks = 0;
  }

  state(): ExplorerState {
    const r = this.rig;
    const f = (n: string) => r.bit(n) === 1;
    const flags = [FLAG_NETS.Z, FLAG_NETS.C, FLAG_NETS.N, FLAG_NETS.V].every((n) => !Number.isNaN(r.bit(n)))
      ? { z: f(FLAG_NETS.Z), c: f(FLAG_NETS.C), n: f(FLAG_NETS.N), v: f(FLAG_NETS.V) }
      : undefined;
    let contention = false;
    for (let i = 0; i < 8; i++) if (r.engine.contended(r.net(`BUS${i}`))) contention = true;
    const mar = r.word('MAR');
    return {
      pc: r.word('PC'),
      sp: r.word('SP'),
      mar,
      ir: r.word('IR'),
      a: r.word('A'),
      b: r.word('B'),
      t: r.word('T'),
      r: [0, 1, 2, 3].map((i) => r.word(`R${i}_`)),
      flags,
      bus: r.bits('BUS'),
      busValue: r.word('BUS'),
      contention,
      alu: r.word('ALU_Y'),
      mem: mar === undefined ? undefined : r.peek(mar),
    };
  }

  /** Which blocks are talking to the bus, and which are listening, from the lines that are on. */
  activity(): { drivers: Block[]; listeners: Block[] } {
    const on = (n: ExplorerLine) => this.on.has(n);
    const drivers: Block[] = [];
    const src: Block[] = ['RD', 'RS', 'PC', 'SP', 'ALU', 'MEM', 'T'];
    OE_LINES.forEach((n, i) => on(n) && drivers.push(src[i]!));
    if (on('OE_SW')) drivers.push('SW');
    const listeners: Block[] = [];
    if (on('LD_MAR')) listeners.push('MAR');
    if (on('LD_IR')) listeners.push('IR');
    if (on('LD_A')) listeners.push('A');
    if (on('LD_B')) listeners.push('B');
    if (on('LD_T')) listeners.push('T');
    if (on('WE_R')) listeners.push('RF');
    if (on('PC_LD')) listeners.push('PC');
    if (on('MEM_WR')) listeners.push('MEM');
    return { drivers, listeners };
  }
}

/** One micro-step of the reference solutions of the challenges: lines, and the text. */
export interface Step {
  lines: LineSet;
  text: string;
}

export interface Challenge {
  id: string;
  title: string;
  task: string;
  preset: Preset;
  /** Fewest clock cycles this can take. */
  par: number;
  /** A reference solution, one micro-step per clock. */
  solution: Step[];
  goal: (s: ExplorerState) => boolean;
  goalText: string;
}

const hex = (v: number) => v.toString(16).toUpperCase().padStart(2, '0');

/** Challenges for the flagship, easiest first. Register numbers come from the IR the task loads (`ADD R1, R2` = 0x86). */
export const CHALLENGES: Challenge[] = [
  {
    id: 'move',
    title: 'Move a byte',
    task: 'IR holds MOV R3, R1 (0x1D) and R1 holds 0x2A. Copy R1 into R3.',
    preset: { ir: 0x1d, r: [0, 0x2a, 0, 0], },
    par: 1,
    solution: [{ lines: { OE_RS: 1, WE_R: 1 }, text: 'Rd ← Rs' }],
    goal: (s) => s.r[3] === 0x2a && s.r[1] === 0x2a,
    goalText: 'R3 = 0x2A, and R1 still 0x2A',
  },
  {
    id: 'fetch',
    title: 'Fetch an instruction',
    task: 'PC is 0 and memory address 0 holds 0x86 (ADD R1, R2). Fetch it into IR, and leave PC pointing at the next byte.',
    preset: { pc: 0, mem: { 0: 0x86 } },
    par: 2,
    solution: [
      { lines: { OE_PC: 1, LD_MAR: 1 }, text: 'MAR ← PC' },
      { lines: { OE_MEM: 1, LD_IR: 1, PC_INC: 1 }, text: 'IR ← M[MAR]; PC ← PC + 1' },
    ],
    goal: (s) => s.ir === 0x86 && s.pc === 1,
    goalText: 'IR = 0x86 and PC = 1',
  },
  {
    id: 'add',
    title: 'Add two registers',
    task: 'IR holds ADD R1, R2 (0x86), R1 = 5 and R2 = 9. Make R1 = R1 + R2, and set the flags. There is only one bus, so the ALU’s two inputs must be loaded one after the other.',
    preset: { ir: 0x86, r: [0, 5, 9, 0] },
    par: 3,
    solution: [
      { lines: { OE_RD: 1, LD_A: 1 }, text: 'A ← Rd' },
      { lines: { OE_RS: 1, LD_B: 1 }, text: 'B ← Rs' },
      { lines: { OE_ALU: 1, WE_R: 1, LD_FLAGS: 1, ...Explorer.aluLines('ADD') }, text: 'Rd ← A + B; flags' },
    ],
    goal: (s) => s.r[1] === 14 && s.r[2] === 9 && s.flags?.z === false && s.flags?.c === false,
    goalText: 'R1 = 14, R2 = 9, and the flags are updated (Z = 0, C = 0)',
  },
  {
    id: 'push',
    title: 'Push on the stack',
    task: 'IR holds PUSH R2 (0x78), R2 = 0x77 and SP = 0xF0. Push R2: SP goes down first, then the byte is written where SP points. (The stack pointer has no way to put its value on the bus except through MAR.)',
    preset: { ir: 0x78, r: [0, 0, 0x77, 0] },
    par: 3,
    solution: [
      { lines: { SP_DEC: 1 }, text: 'SP ← SP − 1' },
      { lines: { OE_SP: 1, LD_MAR: 1 }, text: 'MAR ← SP' },
      { lines: { OE_RD: 1, MEM_WR: 1 }, text: 'M[MAR] ← Rd' },
    ],
    goal: (s) => s.sp === 0xef && s.mem === 0x77 && s.mar === 0xef,
    goalText: 'SP = 0xEF and memory at 0xEF holds 0x77',
  },
  {
    id: 'double',
    title: 'Double a register with no shifter',
    task: 'IR holds SHL R0 (0xE0) and R0 = 0x96. Octet has no shifter: SHL is ADD with both ALU inputs the same. Get 0x2C in R0 and the carry flag set, in two clocks.',
    preset: { ir: 0xe0, r: [0x96, 0, 0, 0] },
    par: 2,
    solution: [
      { lines: { OE_RD: 1, LD_A: 1 }, text: 'A ← Rd' },
      { lines: { OE_ALU: 1, WE_R: 1, LD_FLAGS: 1, ...Explorer.aluLines('ADD', 'A') }, text: 'Rd ← A + A; flags' },
    ],
    goal: (s) => s.r[0] === 0x2c && s.flags?.c === true && s.flags?.v === true,
    goalText: 'R0 = 0x2C, with C = 1 (the carry out) and V = 1 (−106 doubled does not fit in a signed byte)',
  },
];

/** Run a challenge's reference solution on the explorer (used by the "show me" button and the tests). */
export function playSolution(e: Explorer, c: Challenge): void {
  e.setup(c.preset);
  for (const s of c.solution) e.microStep(s.lines);
}

export { hex };
