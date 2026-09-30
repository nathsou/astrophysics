/**
 * The virtual board: a clock, a reset button, 4 buttons, 8 switches, 8 LEDs and four 7-segment digits, and the
 * rules that bind a design's top-level ports to them **by name and type**.
 *
 * | port | direction | type | board resource |
 * |---|---|---|---|
 * | `clk` | in | `clock` | the board's clock |
 * | `rst`, `reset` | in | `bit` | the reset button (active high) |
 * | `btn` | in | `bits<4>` | the four push buttons |
 * | `sw` | in | `bits<8>` | the eight switches |
 * | `led` | out | `bits<8>` | the eight LEDs |
 * | `seg0` … `seg3` | out | `bits<7>` or `bits<8>` | the segments of digit 0 (right) … 3 (left): `seg[0]` = a … `seg[6]` = g, `seg[7]` = the dot |
 * | `seg`, `an` | out | `bits<7|8>`, `bits<4>` | one shared set of segments and a digit select (multiplexed display: digit i shows `seg` while `an[i]` is 1) |
 *
 * A port whose name is a board resource's but whose direction or width differs is an error (as `top` in DCL will
 * be); other ports are "free": inputs get a switch of their own, outputs an LED.
 */
export interface BoardPort {
  name: string;
  dir: 'in' | 'out';
  width: number;
  clock: boolean;
}

export interface BoardBit {
  /** The design's port bit as the flow names it: `led[3]`, `clk`. */
  port: string;
  /** The board element: `sw`, `btn`, `led`, `rst`, `clk`, `seg0`… */
  resource: string;
  /** Index within the resource (bit of `sw`, segment of a digit …). */
  index: number;
}

export interface BoardBinding {
  bound: BoardBit[];
  /** Input and output bits with no board resource, named as the flow names them. */
  freeInputs: string[];
  freeOutputs: string[];
  /** Type errors: a name that means a board resource, used with the wrong direction or width. */
  errors: string[];
  /** The resources the design uses. */
  uses: { clock: boolean; reset: boolean; buttons: boolean; switches: boolean; leds: boolean; digits: number[]; multiplexed: boolean };
}

const bit = (name: string, width: number, i: number) => (width > 1 ? `${name}[${i}]` : name);

interface Rule {
  names: string[];
  dir: 'in' | 'out';
  widths: number[];
  clock?: boolean;
  resource: string;
  what: string;
}

const RULES: Rule[] = [
  { names: ['clk'], dir: 'in', widths: [1], clock: true, resource: 'clk', what: 'the board clock (type clock)' },
  { names: ['rst', 'reset'], dir: 'in', widths: [1], clock: false, resource: 'rst', what: 'the reset button (type bit)' },
  { names: ['btn'], dir: 'in', widths: [4], clock: false, resource: 'btn', what: 'the 4 buttons (bits<4>)' },
  { names: ['sw'], dir: 'in', widths: [8], clock: false, resource: 'sw', what: 'the 8 switches (bits<8>)' },
  { names: ['led'], dir: 'out', widths: [8], resource: 'led', what: 'the 8 LEDs (bits<8>)' },
  { names: ['seg0', 'seg1', 'seg2', 'seg3'], dir: 'out', widths: [7, 8], resource: 'seg', what: 'a 7-segment digit (bits<7> or bits<8> with the dot)' },
  { names: ['seg'], dir: 'out', widths: [7, 8], resource: 'segm', what: 'the shared segments of a multiplexed display (bits<7> or bits<8>)' },
  { names: ['an'], dir: 'out', widths: [4], resource: 'an', what: 'the digit select of a multiplexed display (bits<4>)' },
];

/** Binds the top module's ports to the board. */
export function bindBoard(ports: BoardPort[]): BoardBinding {
  const out: BoardBinding = { bound: [], freeInputs: [], freeOutputs: [], errors: [], uses: { clock: false, reset: false, buttons: false, switches: false, leds: false, digits: [], multiplexed: false } };
  for (const p of ports) {
    const rule = RULES.find((r) => r.names.includes(p.name));
    if (!rule) {
      for (let i = 0; i < p.width; i++) (p.dir === 'in' ? out.freeInputs : out.freeOutputs).push(bit(p.name, p.width, i));
      continue;
    }
    const problems: string[] = [];
    if (p.dir !== rule.dir) problems.push(`the board's ${p.name} is an ${rule.dir === 'in' ? 'input' : 'output'} of the design, not an ${p.dir === 'in' ? 'input' : 'output'}`);
    if (!rule.widths.includes(p.width)) problems.push(`it is ${rule.what}, not ${p.width} bit${p.width === 1 ? '' : 's'}`);
    if (rule.clock !== undefined && p.dir === rule.dir && p.clock !== rule.clock) problems.push(rule.clock ? 'the board clock needs a port of type clock' : `${p.name} is a clock, but the board's ${p.name} is an ordinary bit`);
    if (problems.length) {
      out.errors.push(`Port \`${p.name}\` does not match the board: ${problems.join('; ')}.`);
      for (let i = 0; i < p.width; i++) (p.dir === 'in' ? out.freeInputs : out.freeOutputs).push(bit(p.name, p.width, i));
      continue;
    }
    const digit = /^seg([0-3])$/.exec(p.name);
    const resource = digit ? p.name : rule.resource === 'segm' ? 'seg' : rule.resource;
    for (let i = 0; i < p.width; i++) out.bound.push({ port: bit(p.name, p.width, i), resource, index: i });
    if (rule.resource === 'clk') out.uses.clock = true;
    else if (rule.resource === 'rst') out.uses.reset = true;
    else if (rule.resource === 'btn') out.uses.buttons = true;
    else if (rule.resource === 'sw') out.uses.switches = true;
    else if (rule.resource === 'led') out.uses.leds = true;
    else if (digit) out.uses.digits.push(Number(digit[1]));
    else if (rule.resource === 'segm' || rule.resource === 'an') out.uses.multiplexed = true;
  }
  out.uses.digits.sort();
  const hasSeg = out.bound.some((b) => b.resource === 'seg');
  const hasAn = out.bound.some((b) => b.resource === 'an');
  if (hasSeg !== hasAn) out.errors.push(hasSeg ? 'A multiplexed display needs `an` (bits<4>) as well as `seg`.' : 'A digit select `an` needs the shared segments `seg`.');
  if (hasSeg && out.bound.some((b) => /^seg[0-3]$/.test(b.resource))) out.errors.push('Use either `seg0`…`seg3` or `seg` with `an`, not both.');
  return out;
}

/** The board's inputs as the user has set them. */
export interface BoardInputs {
  reset: boolean;
  buttons: boolean[];
  switches: boolean[];
  /** Values of the free inputs by bit name. */
  free: Record<string, boolean>;
}

export const emptyBoardInputs = (): BoardInputs => ({ reset: false, buttons: [false, false, false, false], switches: new Array(8).fill(false), free: {} });

/** The level of a design input bit given the board: `undefined` for the clock (driven by the clock button). */
export function inputLevel(b: BoardBit, inputs: BoardInputs): boolean | undefined {
  switch (b.resource) {
    case 'clk':
      return undefined;
    case 'rst':
      return inputs.reset;
    case 'btn':
      return inputs.buttons[b.index] ?? false;
    case 'sw':
      return inputs.switches[b.index] ?? false;
    default:
      return false;
  }
}

/** What the board shows, computed from the design's output bits. */
export interface BoardOutputs {
  leds: (0 | 1 | 'x')[];
  /** Segment masks of the four digits (bit 0 = a … bit 6 = g, bit 7 = dot), digit 0 on the right. */
  digits: number[];
  /** Which digits are lit at all (a digit no output drives is dark and drawn dim). */
  digitLit: boolean[];
  free: Record<string, 0 | 1 | 'x'>;
}

export type Level = 0 | 1 | 'x';

/**
 * Board outputs from the levels of the design's output bits (by bit name). `latch` holds the segments each digit last
 * showed while its `an` bit was 1 (the multiplexed display): the caller keeps it between calls (persistence of vision).
 */
export function boardOutputs(binding: BoardBinding, level: (bitName: string) => Level, latch: number[] = [0, 0, 0, 0]): BoardOutputs {
  const leds: (0 | 1 | 'x')[] = new Array(8).fill(0);
  const digits = latch.slice(0, 4);
  const digitLit = [false, false, false, false];
  const free: Record<string, Level> = {};
  const seg: number[] = [];
  let segMask = 0;
  const an: boolean[] = [];
  for (const b of binding.bound) {
    const v = level(b.port);
    if (b.resource === 'led') leds[b.index] = v;
    else if (b.resource === 'seg') {
      if (v === 1) segMask |= 1 << b.index;
    } else if (b.resource === 'an') an[b.index] = v === 1;
    else if (/^seg[0-3]$/.test(b.resource)) {
      const d = Number(b.resource[3]);
      digitLit[d] = true;
      seg[d] = (seg[d] ?? 0) | (v === 1 ? 1 << b.index : 0);
    }
  }
  for (let d = 0; d < 4; d++) if (seg[d] !== undefined) digits[d] = seg[d]!;
  if (binding.uses.multiplexed) {
    for (let d = 0; d < 4; d++) {
      digitLit[d] = true;
      if (an[d]) digits[d] = segMask;
    }
  }
  for (const name of binding.freeOutputs) free[name] = level(name);
  return { leds, digits, digitLit, free };
}

/** A hexadecimal digit as a segment mask (a = bit 0 … g = bit 6), for tests and for the design's lookup table. */
export const HEX_SEGMENTS: readonly number[] = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71];

/** The hex digit a segment mask shows, or −1. */
export const digitOfMask = (mask: number): number => HEX_SEGMENTS.indexOf(mask & 0x7f);
