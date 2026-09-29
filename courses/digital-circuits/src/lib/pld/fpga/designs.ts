/**
 * Generators for gate-level designs used by the tests and the benchmark: counters, an FSM, an LFSR, adders, and
 * an ALU datapath that can be scaled to fill a device. All use parts-bin elements only, so the digital engine
 * can run the same netlist that the flow turns into a bitstream.
 */
import { NetlistBuilder } from '../../sim/digital';
import type { FlatNetlist } from '../../sim/netlist/types';
import { mulberry32 } from '../twolevel/random';

export interface SeqBench {
  nl: FlatNetlist;
  /** Element ids of the clock switch, data inputs and output indicators. */
  clock: string;
  inputs: string[];
  outputs: string[];
}

const bus = (b: NetlistBuilder, n: number, prefix?: string) => b.nets(n, prefix);

/** An n-bit up counter with enable and asynchronous clear: outputs q0…, built from flip-flops and gates. */
export function counter(bits: number): SeqBench {
  const b = new NetlistBuilder();
  const clk = b.net('clk');
  const en = b.net('en');
  const clr = b.net('clr');
  b.add('toggle', 'clk', { Y: clk });
  b.add('toggle', 'en', { Y: en });
  b.add('toggle', 'clr', { Y: clr });
  const q = bus(b, bits, 'q');
  let carry = en;
  for (let i = 0; i < bits; i++) {
    const d = b.net();
    b.add('xor', `x${i}`, { A: q[i]!, B: carry, Y: d });
    const nc = b.net();
    b.add('and', `c${i}`, { A: q[i]!, B: carry, Y: nc });
    carry = nc;
    b.add('dffr', `ff${i}`, { D: d, CLK: clk, CLR: clr, Q: q[i]! });
    b.add('indicator', `led${i}`, { A: q[i]! });
  }
  return { nl: b.build(), clock: 'clk', inputs: ['en', 'clr'], outputs: Array.from({ length: bits }, (_, i) => `led${i}`) };
}

/** A Moore FSM that detects the input sequence 1, 0, 1 (overlapping); output `z` is 1 in the last state. */
export function sequenceDetector(): SeqBench {
  const b = new NetlistBuilder();
  const clk = b.net('clk');
  const x = b.net('x');
  const rst = b.net('rst');
  b.add('toggle', 'clk', { Y: clk });
  b.add('toggle', 'x', { Y: x });
  b.add('toggle', 'rst', { Y: rst });
  // States: 0 idle, 1 saw "1", 2 saw "10", 3 saw "101". Encoded s1 s0.
  const s0 = b.net('s0');
  const s1 = b.net('s1');
  const nx = b.net();
  b.add('not', 'nx', { A: x, Y: nx });
  const ns0 = b.net();
  const ns1 = b.net();
  const nots1 = b.net();
  const nots0 = b.net();
  b.add('not', 'inv1', { A: s1, Y: nots1 });
  b.add('not', 'inv0', { A: s0, Y: nots0 });
  // next s0 = x (any state -> 1 after reading 1; from 1 or 3 with x=0 -> 0; 2 with x=1 -> 3): s0' = x
  b.add('buffer', 'ns0', { A: x, Y: ns0 });
  // next s1: from 1 with x=0 -> 2; from 2 with x=1 -> 3; from 3 with x=0 -> 2; from 2 with x=0 -> 0; from 3 with x=1 -> 1 (overlap) ; 0 -> 0/1
  // s1' = (!s1 & s0 & !x) | (s1 & !s0 & x) | (s1 & s0 & !x)
  const t1 = b.net();
  const t2 = b.net();
  const t3 = b.net();
  b.add('and', 't1', { A: nots1, B: s0, C: nx, Y: t1 }, { inputs: 3 });
  b.add('and', 't2', { A: s1, B: nots0, C: x, Y: t2 }, { inputs: 3 });
  b.add('and', 't3', { A: s1, B: s0, C: nx, Y: t3 }, { inputs: 3 });
  b.add('or', 'o1', { A: t1, B: t2, C: t3, Y: ns1 }, { inputs: 3 });
  b.add('dffr', 'f0', { D: ns0, CLK: clk, CLR: rst, Q: s0 });
  b.add('dffr', 'f1', { D: ns1, CLK: clk, CLR: rst, Q: s1 });
  const z = b.net();
  b.add('and', 'zand', { A: s1, B: s0, Y: z });
  b.add('indicator', 'z', { A: z });
  b.add('indicator', 's0', { A: s0 });
  b.add('indicator', 's1', { A: s1 });
  return { nl: b.build(), clock: 'clk', inputs: ['x', 'rst'], outputs: ['z', 's0', 's1'] };
}

/** An n-bit Fibonacci LFSR (taps as a bit mask) with a load-`seed` input `load`; outputs are the state bits. */
export function lfsr(bits: number, taps: number): SeqBench {
  const b = new NetlistBuilder();
  const clk = b.net('clk');
  const load = b.net('load');
  b.add('toggle', 'clk', { Y: clk });
  b.add('toggle', 'load', { Y: load });
  const q = bus(b, bits, 'q');
  const tapNets = q.filter((_, i) => (taps >> i) & 1);
  let fb = tapNets[0]!;
  tapNets.slice(1).forEach((t, i) => {
    const y = b.net();
    b.add('xor', `fb${i}`, { A: fb, B: t, Y: y });
    fb = y;
  });
  // Loading forces the state to 0…01 (bit 0 set): d0 = load | fb, other bits shift and are cleared by load.
  const nload = b.net();
  b.add('not', 'nload', { A: load, Y: nload });
  for (let i = 0; i < bits; i++) {
    const d = b.net();
    if (i === 0) b.add('or', 'd0', { A: load, B: fb, Y: d });
    else b.add('and', `d${i}`, { A: q[i - 1]!, B: nload, Y: d });
    b.add('dff', `ff${i}`, { D: d, CLK: clk, Q: q[i]! });
    b.add('indicator', `led${i}`, { A: q[i]! });
  }
  return { nl: b.build(), clock: 'clk', inputs: ['load'], outputs: Array.from({ length: bits }, (_, i) => `led${i}`) };
}

export interface CombBench {
  nl: FlatNetlist;
  inputs: string[];
  outputs: string[];
}

/** An adder computing a + b + cin. `kind`: the `adder` block, or a ripple adder of XOR/AND/OR gates. */
export function adder(bits: number, kind: 'block' | 'gates', withCarryOut = true, cinInput = true): CombBench {
  const b = new NetlistBuilder();
  const a = bus(b, bits, 'a');
  const bb = bus(b, bits, 'b');
  const cin = b.net('cin');
  const inputs: string[] = [];
  a.forEach((n, i) => {
    b.add('toggle', `a${i}`, { Y: n });
    inputs.push(`a${i}`);
  });
  bb.forEach((n, i) => {
    b.add('toggle', `b${i}`, { Y: n });
    inputs.push(`b${i}`);
  });
  if (cinInput) {
    b.add('toggle', 'cin', { Y: cin });
    inputs.push('cin');
  } else b.add('const', 'cin', { Y: cin }, { value: 0 });
  const outputs: string[] = [];
  const s = bus(b, bits, 's');
  const cout = b.net('cout');
  if (kind === 'block') {
    const pins: Record<string, number> = { CIN: cin, COUT: cout };
    a.forEach((n, i) => (pins[`A${i}`] = n));
    bb.forEach((n, i) => (pins[`B${i}`] = n));
    s.forEach((n, i) => (pins[`S${i}`] = n));
    b.add('adder', 'add', pins, { bits });
  } else {
    let c = cin;
    for (let i = 0; i < bits; i++) {
      const p = b.net();
      b.add('xor', `p${i}`, { A: a[i]!, B: bb[i]!, Y: p });
      b.add('xor', `s${i}`, { A: p, B: c, Y: s[i]! });
      const g = b.net();
      const pc = b.net();
      b.add('and', `g${i}`, { A: a[i]!, B: bb[i]!, Y: g });
      b.add('and', `pc${i}`, { A: p, B: c, Y: pc });
      const nc = i === bits - 1 ? cout : b.net();
      b.add('or', `c${i}`, { A: g, B: pc, Y: nc });
      c = nc;
    }
  }
  s.forEach((n, i) => {
    b.add('indicator', `sum${i}`, { A: n });
    outputs.push(`sum${i}`);
  });
  if (withCarryOut) {
    b.add('indicator', 'cout', { A: cout });
    outputs.push('cout');
  }
  return { nl: b.build(), inputs, outputs };
}

/**
 * A datapath: `alus` copies of a registered 16-bit ALU (operands from input switches and from the other ALUs'
 * results, 8 operations selected by 3 switches), plus `counters` free-running 16-bit counters with enable
 * (built on `register` and `adder` blocks so they use carry chains). Outputs: the low `outBits` bits of every
 * result register and counter, to indicators.
 */
export function datapath(alus: number, counters: number, width = 16, outBits = 2): SeqBench {
  const b = new NetlistBuilder();
  const clk = b.net('clk');
  b.add('toggle', 'clk', { Y: clk });
  const one = b.net('one');
  b.add('const', 'one', { Y: one }, { value: 1 });
  const zero = b.net('zero');
  b.add('const', 'zero', { Y: zero }, { value: 0 });
  const inputs: string[] = [];
  const outputs: string[] = [];
  const sw = (id: string) => {
    const n = b.net(id);
    b.add('toggle', id, { Y: n });
    inputs.push(id);
    return n;
  };
  const op = [sw('op0'), sw('op1'), sw('op2')];
  const inA = bus(b, width).map((n, i) => {
    b.add('toggle', `ina${i}`, { Y: n });
    inputs.push(`ina${i}`);
    return n;
  });
  const results: number[][] = [];
  for (let k = 0; k < alus; k++) {
    // Operands: A from the input (k = 0) or from the previous ALU's result; B from a rotated result of the ALU before that.
    const A = k === 0 ? inA : results[k - 1]!;
    const Bsrc = k < 2 ? inA.map((_, i) => inA[(i + 3 * (k + 1)) % width]!) : results[k - 2]!.map((_, i, r) => r[(i + 5) % width]!);
    const nb = bus(b, width);
    // Subtract when op0 & !op1 & !op2 is not modelled: b is inverted by op2, carry-in is op2 (so op2 = subtract).
    Bsrc.forEach((n, i) => b.add('xor', `alu${k}.bx${i}`, { A: n, B: op[2]!, Y: nb[i]! }));
    const sum = bus(b, width);
    const cout = b.net();
    const pins: Record<string, number> = { CIN: op[2]!, COUT: cout };
    A.forEach((n, i) => (pins[`A${i}`] = n));
    nb.forEach((n, i) => (pins[`B${i}`] = n));
    sum.forEach((n, i) => (pins[`S${i}`] = n));
    b.add('adder', `alu${k}.add`, pins, { bits: width });
    const res = bus(b, width);
    for (let i = 0; i < width; i++) {
      const andv = b.net();
      const orv = b.net();
      const xorv = b.net();
      b.add('and', `alu${k}.and${i}`, { A: A[i]!, B: Bsrc[i]!, Y: andv });
      b.add('or', `alu${k}.or${i}`, { A: A[i]!, B: Bsrc[i]!, Y: orv });
      b.add('xor', `alu${k}.xor${i}`, { A: A[i]!, B: Bsrc[i]!, Y: xorv });
      const shl = i === 0 ? zero : A[i - 1]!;
      const shr = i === width - 1 ? zero : A[i + 1]!;
      const y = b.net();
      // op: 0 add, 1 and, 2 or, 3 xor, 4 shl, 5 shr, 6 a, 7 sub-result (adder again).
      b.add('mux', `alu${k}.mux${i}`, { D0: sum[i]!, D1: andv, D2: orv, D3: xorv, D4: shl, D5: shr, D6: A[i]!, D7: sum[i]!, S0: op[0]!, S1: op[1]!, S2: op[2]!, Y: y }, { select: 3 });
      res[i] = y;
    }
    const q = bus(b, width, `alu${k}.q`);
    const dpins: Record<string, number> = { CLK: clk, EN: one, CLR: zero };
    res.forEach((n, i) => (dpins[`D${i}`] = n));
    q.forEach((n, i) => (dpins[`Q${i}`] = n));
    b.add('register', `alu${k}.reg`, dpins, { bits: width });
    results.push(q);
    for (let i = 0; i < outBits; i++) {
      b.add('indicator', `alu${k}.out${i}`, { A: q[i]! });
      outputs.push(`alu${k}.out${i}`);
    }
  }
  for (let c = 0; c < counters; c++) {
    const en = sw(`cen${c}`);
    const q = bus(b, width, `cnt${c}.q`);
    const sum = bus(b, width);
    const pins: Record<string, number> = { CIN: zero };
    q.forEach((n, i) => (pins[`A${i}`] = n));
    bus(b, width).forEach((n, i) => {
      // B = 0…01: add one.
      b.add('const', `cnt${c}.one${i}`, { Y: n }, { value: i === 0 ? 1 : 0 });
      pins[`B${i}`] = n;
    });
    sum.forEach((n, i) => (pins[`S${i}`] = n));
    b.add('adder', `cnt${c}.add`, pins, { bits: width });
    const dpins: Record<string, number> = { CLK: clk, EN: en, CLR: zero };
    sum.forEach((n, i) => (dpins[`D${i}`] = n));
    q.forEach((n, i) => (dpins[`Q${i}`] = n));
    b.add('register', `cnt${c}.reg`, dpins, { bits: width });
    for (let i = 0; i < outBits; i++) {
      b.add('indicator', `cnt${c}.out${i}`, { A: q[i]! });
      outputs.push(`cnt${c}.out${i}`);
    }
  }
  return { nl: b.build(), clock: 'clk', inputs, outputs };
}

export { mulberry32 };

/** A RAM (asynchronous read, write on the rising clock edge when `we` is 1) with switches on every input. */
export function ramDesign(addrBits: number, dataBits: number): SeqBench {
  const b = new NetlistBuilder();
  const clk = b.net('clk');
  b.add('toggle', 'clk', { Y: clk });
  const inputs: string[] = [];
  const pins: Record<string, number> = { CLK: clk };
  for (let i = 0; i < addrBits; i++) {
    const n = b.net();
    b.add('toggle', `a${i}`, { Y: n });
    inputs.push(`a${i}`);
    pins[`A${i}`] = n;
  }
  for (let i = 0; i < dataBits; i++) {
    const n = b.net();
    b.add('toggle', `d${i}`, { Y: n });
    inputs.push(`d${i}`);
    pins[`DI${i}`] = n;
  }
  const we = b.net();
  b.add('toggle', 'we', { Y: we });
  inputs.push('we');
  pins.WE = we;
  const outputs: string[] = [];
  for (let i = 0; i < dataBits; i++) {
    const n = b.net();
    pins[`DO${i}`] = n;
    b.add('indicator', `q${i}`, { A: n });
    outputs.push(`q${i}`);
  }
  b.add('ram', 'mem', pins, { addrBits, dataBits });
  return { nl: b.build(), clock: 'clk', inputs, outputs };
}

/** A ROM with the given hexadecimal words, addressed by switches. */
export function romDesign(addrBits: number, dataBits: number, words: number[]): CombBench {
  const b = new NetlistBuilder();
  const pins: Record<string, number> = {};
  const inputs: string[] = [];
  for (let i = 0; i < addrBits; i++) {
    const n = b.net();
    b.add('toggle', `a${i}`, { Y: n });
    inputs.push(`a${i}`);
    pins[`A${i}`] = n;
  }
  const outputs: string[] = [];
  for (let i = 0; i < dataBits; i++) {
    const n = b.net();
    pins[`DO${i}`] = n;
    b.add('indicator', `q${i}`, { A: n });
    outputs.push(`q${i}`);
  }
  b.add('rom', 'mem', pins, { addrBits, dataBits, contents: words.map((w) => w.toString(16)).join(',') });
  return { nl: b.build(), inputs, outputs };
}
