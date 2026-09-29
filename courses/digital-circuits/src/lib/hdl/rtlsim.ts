/**
 * The RTL simulator (HDL.md, *Compiler*): runs a word-level RTL design (see rtl.ts) cycle by cycle.
 *
 * - **Compiled** (the default): the flattened design becomes JavaScript source, compiled once with
 *   `new Function` (the Verilator approach), which V8 then turns into machine code. Signals of up to 32
 *   bits are JavaScript numbers (unsigned, in a `Uint32Array`); wider signals are `Uint32Array` words,
 *   least significant word first, handled by the small word library `WORDS` below.
 * - **Interpreted**: the same semantics on BigInt values, one cell at a time. It is the fallback where
 *   `new Function` is not allowed (a strict Content-Security-Policy), and the reference the compiled
 *   code is tested against.
 *
 * Combinational logic is evaluated in topological order (the checker guarantees there are no loops).
 * Registers and memories update in two phases at a clock edge: every next value is sampled first, then
 * all of them are committed, so they all change together. Memory reads are synchronous: a read port's
 * data is the word at its address sampled at the edge, before that edge's write.
 */
import { flattenRtl, type RtlCell, type RtlDesign, type RtlModule, type SigId } from './rtl';

export interface RtlSimOptions {
  /** `compiled` (default when `new Function` is available), or `interpreted`. */
  mode?: 'compiled' | 'interpreted';
}

export interface RtlSim {
  /** The flattened design being simulated. */
  readonly module: RtlModule;
  readonly mode: 'compiled' | 'interpreted';
  /** Clock edges since power-up (or the last `reset`), counted on the first clock. */
  cycle: number;
  /** Sets an input port (clock inputs are driven by `tick` and `step`). */
  set(port: string, value: number | bigint): void;
  /** Reads a port or named signal of at most 32 bits, settling the logic first. */
  get(name: string): number;
  /** Reads a port or named signal of any width, settling the logic first. */
  getBig(name: string): bigint;
  /** Reads any named signal (hierarchical names such as `register_file.x[3]`), settling the logic first. */
  peek(name: string): bigint;
  /** Settles the combinational logic (done automatically by the readers and by `tick`). */
  eval(): void;
  /** One rising edge of `clock` (a clock input's name), or of every clock when omitted. */
  tick(clock?: string): void;
  /** `n` rising edges of every clock. */
  step(n?: number): void;
  /** Registers and memories back to their power-up values; inputs keep their values. */
  reset(): void;
  readMem(name: string, addr: number): bigint;
  writeMem(name: string, addr: number, value: number | bigint): void;
  /** A handle on a port or named signal, for fast repeated access (no name lookup). */
  signal(name: string): RtlSignalHandle;
  /** Every named signal (ports, `let`s, registers, memory read ports), hierarchical. */
  names(): string[];
  width(name: string): number;
}

export interface RtlSignalHandle {
  readonly name: string;
  readonly width: number;
  /** The value (settling the logic first); at most 32 bits. */
  get(): number;
  getBig(): bigint;
  /** Sets an input port. */
  set(value: number | bigint): void;
}

// ------------------------------------------------------------------------------------ word library

/** Operations on wide values stored as Uint32Array words (least significant first). */
export const WORDS = {
  /** Bits [lo, lo + w) of a, for w ≤ 32, as an unsigned number. */
  get(a: Uint32Array, lo: number, w: number): number {
    const i = lo >>> 5;
    const o = lo & 31;
    let v = (a[i] ?? 0) >>> o;
    if (o !== 0 && o + w > 32) v |= (a[i + 1] ?? 0) << (32 - o);
    return w === 32 ? v >>> 0 : (v & ((1 << w) - 1)) >>> 0;
  },
  /** ORs the w-bit number v into d at bit lo (d's bits there must be zero). */
  put(d: Uint32Array, lo: number, v: number, w: number): void {
    const i = lo >>> 5;
    const o = lo & 31;
    d[i]! |= v << o;
    if (o !== 0 && o + w > 32) d[i + 1]! |= v >>> (32 - o);
  },
  putw(d: Uint32Array, lo: number, a: Uint32Array, w: number): void {
    for (let k = 0; k < w; k += 32) {
      const c = Math.min(32, w - k);
      WORDS.put(d, lo + k, WORDS.get(a, k, c), c);
    }
  },
  /** d = bits [lo, lo + w) of a. */
  slice(d: Uint32Array, a: Uint32Array, lo: number, w: number): void {
    d.fill(0);
    for (let k = 0; k < w; k += 32) {
      const c = Math.min(32, w - k);
      WORDS.put(d, k, WORDS.get(a, lo + k, c), c);
    }
  },
  clear(d: Uint32Array): void {
    d.fill(0);
  },
  copy(d: Uint32Array, a: Uint32Array): void {
    d.set(a);
  },
  top(d: Uint32Array, w: number): void {
    const r = w & 31;
    if (r) d[d.length - 1]! &= (1 << r) - 1;
  },
  fromNum(d: Uint32Array, v: number): void {
    d.fill(0);
    d[0] = v;
  },
  and(d: Uint32Array, a: Uint32Array, b: Uint32Array): void {
    for (let i = 0; i < d.length; i++) d[i] = a[i]! & b[i]!;
  },
  or(d: Uint32Array, a: Uint32Array, b: Uint32Array): void {
    for (let i = 0; i < d.length; i++) d[i] = a[i]! | b[i]!;
  },
  xor(d: Uint32Array, a: Uint32Array, b: Uint32Array): void {
    for (let i = 0; i < d.length; i++) d[i] = a[i]! ^ b[i]!;
  },
  not(d: Uint32Array, a: Uint32Array, w: number): void {
    for (let i = 0; i < d.length; i++) d[i] = ~a[i]!;
    WORDS.top(d, w);
  },
  add(d: Uint32Array, a: Uint32Array, b: Uint32Array, w: number): void {
    let c = 0;
    for (let i = 0; i < d.length; i++) {
      const s = a[i]! + b[i]! + c;
      d[i] = s;
      c = s > 0xffffffff ? 1 : 0;
    }
    WORDS.top(d, w);
  },
  sub(d: Uint32Array, a: Uint32Array, b: Uint32Array, w: number): void {
    let c = 1;
    for (let i = 0; i < d.length; i++) {
      const s = a[i]! + (~b[i]! >>> 0) + c;
      d[i] = s;
      c = s > 0xffffffff ? 1 : 0;
    }
    WORDS.top(d, w);
  },
  neg(d: Uint32Array, a: Uint32Array, w: number): void {
    let c = 1;
    for (let i = 0; i < d.length; i++) {
      const s = (~a[i]! >>> 0) + c;
      d[i] = s;
      c = s > 0xffffffff ? 1 : 0;
    }
    WORDS.top(d, w);
  },
  mul(d: Uint32Array, a: Uint32Array, b: Uint32Array, w: number): void {
    // Schoolbook multiplication on 16-bit halves, keeping the low words.
    const n = d.length;
    const h = new Array<number>(2 * n).fill(0);
    for (let i = 0; i < 2 * n; i++) {
      const ai = (a[i >> 1]! >>> ((i & 1) * 16)) & 0xffff;
      if (!ai) continue;
      let carry = 0;
      for (let j = 0; i + j < 2 * n; j++) {
        const bj = (b[j >> 1]! >>> ((j & 1) * 16)) & 0xffff;
        const t = h[i + j]! + ai * bj + carry;
        h[i + j] = t % 65536;
        carry = Math.floor(t / 65536);
      }
    }
    for (let i = 0; i < n; i++) d[i] = (h[2 * i]! | (h[2 * i + 1]! << 16)) >>> 0;
    WORDS.top(d, w);
  },
  /** A shift amount: the value, saturated to 2^32 − 1 when it does not fit. */
  amt(a: Uint32Array): number {
    for (let i = 1; i < a.length; i++) if (a[i]) return 0xffffffff;
    return a[0]!;
  },
  shl(d: Uint32Array, a: Uint32Array, sh: number, w: number): void {
    d.fill(0);
    if (sh >= w) return;
    for (let k = 0; k + sh < w; k += 32) {
      const c = Math.min(32, w - sh - k);
      WORDS.put(d, k + sh, WORDS.get(a, k, c), c);
    }
  },
  shr(d: Uint32Array, a: Uint32Array, sh: number, w: number, signed: boolean): void {
    const neg = signed && WORDS.get(a, w - 1, 1) === 1;
    d.fill(0);
    const s = Math.min(sh, w);
    for (let k = 0; k + s < w; k += 32) {
      const c = Math.min(32, w - s - k);
      WORDS.put(d, k, WORDS.get(a, k + s, c), c);
    }
    if (neg) for (let k = w - s; k < w; k++) d[k >>> 5]! |= 1 << (k & 31);
  },
  eq(a: Uint32Array, b: Uint32Array): number {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return 0;
    return 1;
  },
  /** −1, 0 or 1. */
  cmp(a: Uint32Array, b: Uint32Array, w: number, signed: boolean): number {
    if (signed) {
      const sa = WORDS.get(a, w - 1, 1);
      const sb = WORDS.get(b, w - 1, 1);
      if (sa !== sb) return sa ? -1 : 1;
    }
    for (let i = a.length - 1; i >= 0; i--) if (a[i] !== b[i]) return a[i]! < b[i]! ? -1 : 1;
    return 0;
  },
  sext(d: Uint32Array, a: Uint32Array | number, wa: number, w: number): void {
    d.fill(0);
    if (typeof a === 'number') WORDS.put(d, 0, a, wa);
    else WORDS.putw(d, 0, a, wa);
    const neg = typeof a === 'number' ? (a >>> (wa - 1)) & 1 : WORDS.get(a, wa - 1, 1);
    if (neg) for (let k = wa; k < w; k++) d[k >>> 5]! |= 1 << (k & 31);
  },
  zext(d: Uint32Array, a: Uint32Array | number, wa: number): void {
    d.fill(0);
    if (typeof a === 'number') d[0] = a;
    else WORDS.putw(d, 0, a, wa);
  },
  repeat(d: Uint32Array, a: Uint32Array | number, wa: number, n: number): void {
    d.fill(0);
    for (let i = 0; i < n; i++) {
      if (typeof a === 'number') WORDS.put(d, i * wa, a, wa);
      else WORDS.putw(d, i * wa, a, wa);
    }
  },
  all(a: Uint32Array, w: number): number {
    for (let k = 0; k < w; k += 32) {
      const c = Math.min(32, w - k);
      if (WORDS.get(a, k, c) !== (c === 32 ? 0xffffffff : (1 << c) - 1)) return 0;
    }
    return 1;
  },
  any(a: Uint32Array): number {
    for (let i = 0; i < a.length; i++) if (a[i]) return 1;
    return 0;
  },
  pop(v: number): number {
    v = v - ((v >>> 1) & 0x55555555);
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    return (Math.imul((v + (v >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24) & 0xff;
  },
  popw(a: Uint32Array): number {
    let n = 0;
    for (let i = 0; i < a.length; i++) n += WORDS.pop(a[i]!);
    return n;
  },
  toBig(a: Uint32Array): bigint {
    let v = 0n;
    for (let i = a.length - 1; i >= 0; i--) v = (v << 32n) | BigInt(a[i]!);
    return v;
  },
  fromBig(d: Uint32Array, v: bigint): void {
    for (let i = 0; i < d.length; i++) {
      d[i] = Number(v & 0xffffffffn);
      v >>= 32n;
    }
  },
};

// ------------------------------------------------------------------------------------ shared analysis

interface Analysis {
  mod: RtlModule;
  /** Combinational cells in evaluation order. */
  order: RtlCell[];
  regs: Extract<RtlCell, { kind: 'reg' }>[];
  mems: Extract<RtlCell, { kind: 'mem' }>[];
  clocks: { name: string; sig: SigId }[];
  width: (s: SigId) => number;
}

const mask = (w: number) => (1n << BigInt(w)) - 1n;

function analyse(mod: RtlModule): Analysis {
  const width = (s: SigId) => mod.signals[s]!.width;
  const driver = new Map<SigId, RtlCell>();
  const regs: Analysis['regs'] = [];
  const mems: Analysis['mems'] = [];
  const comb: RtlCell[] = [];
  for (const c of mod.cells) {
    if (c.kind === 'reg') regs.push(c);
    else if (c.kind === 'mem') mems.push(c);
    else {
      comb.push(c);
      driver.set(c.y, c);
    }
  }
  // Kahn's algorithm over combinational cells.
  const indeg = new Map<RtlCell, number>();
  const users = new Map<SigId, RtlCell[]>();
  for (const c of comb) {
    let n = 0;
    for (const s of new Set(combInputs(c))) {
      if (!driver.has(s)) continue;
      n++;
      let u = users.get(s);
      if (!u) users.set(s, (u = []));
      u.push(c);
    }
    indeg.set(c, n);
  }
  const order: RtlCell[] = [];
  const ready = comb.filter((c) => indeg.get(c) === 0);
  while (ready.length) {
    const c = ready.pop()!;
    order.push(c);
    for (const u of users.get(c.y) ?? []) {
      const n = indeg.get(u)! - 1;
      indeg.set(u, n);
      if (n === 0) ready.push(u);
    }
  }
  if (order.length !== comb.length) throw new Error('the design has a combinational loop');
  const clocks = mod.inputs.filter((p) => p.clock).map((p) => ({ name: p.name, sig: p.sig }));
  return { mod, order, regs, mems, clocks, width };
}

function combInputs(c: RtlCell): SigId[] {
  switch (c.kind) {
    case 'const':
      return [];
    case 'not':
    case 'neg':
    case 'slice':
    case 'repeat':
    case 'zext':
    case 'sext':
    case 'reduce_and':
    case 'reduce_or':
    case 'reduce_xor':
    case 'popcount':
      return [c.a];
    case 'mux':
      return [c.s, c.a, c.b];
    case 'pmux':
      return [c.s, ...c.cases.map((x) => x.data), c.default];
    case 'concat':
      return c.parts;
    case 'reg':
    case 'mem':
      return [];
    default:
      return [c.a, c.b];
  }
}

// ------------------------------------------------------------------------------------ semantics (BigInt)

function toSigned(v: bigint, w: number): bigint {
  return v & (1n << BigInt(w - 1)) ? v - (1n << BigInt(w)) : v;
}

/** The value of a combinational cell, on BigInt bit patterns. */
export function evalCell(c: RtlCell, val: (s: SigId) => bigint, width: (s: SigId) => number): bigint {
  const w = c.kind === 'mem' ? 0 : width(c.y);
  const m = mask(w);
  switch (c.kind) {
    case 'const':
      return c.value & m;
    case 'add':
      return (val(c.a) + val(c.b)) & m;
    case 'sub':
      return (val(c.a) - val(c.b)) & m;
    case 'mul':
      return (val(c.a) * val(c.b)) & m;
    case 'and':
      return val(c.a) & val(c.b);
    case 'or':
      return val(c.a) | val(c.b);
    case 'xor':
      return val(c.a) ^ val(c.b);
    case 'not':
      return ~val(c.a) & m;
    case 'neg':
      return -val(c.a) & m;
    case 'shl': {
      const b = val(c.b);
      return b >= BigInt(w) ? 0n : (val(c.a) << b) & m;
    }
    case 'shr': {
      const b = val(c.b);
      const a = val(c.a);
      if (c.signed) return (toSigned(a, w) >> (b >= BigInt(w) ? BigInt(w) : b)) & m;
      return b >= BigInt(w) ? 0n : a >> b;
    }
    case 'eq':
      return val(c.a) === val(c.b) ? 1n : 0n;
    case 'ne':
      return val(c.a) !== val(c.b) ? 1n : 0n;
    case 'lt':
    case 'le':
    case 'gt':
    case 'ge': {
      const wa = width(c.a);
      const a = c.signed ? toSigned(val(c.a), wa) : val(c.a);
      const b = c.signed ? toSigned(val(c.b), wa) : val(c.b);
      const r = c.kind === 'lt' ? a < b : c.kind === 'le' ? a <= b : c.kind === 'gt' ? a > b : a >= b;
      return r ? 1n : 0n;
    }
    case 'mux':
      return val(c.s) ? val(c.b) : val(c.a);
    case 'pmux': {
      const s = val(c.s);
      for (const k of c.cases) if (k.match.includes(s)) return val(k.data);
      return val(c.default);
    }
    case 'slice':
      return (val(c.a) >> BigInt(c.lo)) & m;
    case 'concat': {
      let v = 0n;
      for (const p of c.parts) v = (v << BigInt(width(p))) | val(p);
      return v;
    }
    case 'repeat': {
      const a = val(c.a);
      const wa = BigInt(width(c.a));
      let v = 0n;
      for (let i = 0; i < c.n; i++) v = (v << wa) | a;
      return v;
    }
    case 'zext':
      return val(c.a);
    case 'sext':
      return toSigned(val(c.a), width(c.a)) & m;
    case 'reduce_and':
      return val(c.a) === mask(width(c.a)) ? 1n : 0n;
    case 'reduce_or':
      return val(c.a) !== 0n ? 1n : 0n;
    case 'reduce_xor':
    case 'popcount': {
      let v = val(c.a);
      let n = 0n;
      while (v) {
        n += v & 1n;
        v >>= 1n;
      }
      return c.kind === 'popcount' ? n & m : n & 1n;
    }
    case 'reg':
    case 'mem':
      throw new Error('not a combinational cell');
  }
}

// ------------------------------------------------------------------------------------ backends

interface Backend {
  mode: 'compiled' | 'interpreted';
  read(s: SigId): bigint;
  readNum(s: SigId): number;
  write(s: SigId, v: number | bigint): void;
  eval(): void;
  /** Rising edge of the clocks whose signals are listed (all of them at once). */
  tick(clocks: SigId[]): void;
  reset(): void;
  memGet(i: number, addr: number): bigint;
  memSet(i: number, addr: number, v: bigint): void;
}

function interpreter(an: Analysis): Backend {
  const { mod, order, regs, mems, width } = an;
  const vals: bigint[] = new Array<bigint>(mod.signals.length).fill(0n);
  const memData: bigint[][] = mems.map((m) => m.init.slice(0, m.depth).concat(new Array<bigint>(Math.max(0, m.depth - m.init.length)).fill(0n)));
  const val = (s: SigId) => vals[s]!;
  const reset = () => {
    for (const r of regs) vals[r.y] = r.init & mask(width(r.y));
    mems.forEach((m, i) => {
      for (let a = 0; a < m.depth; a++) memData[i]![a] = (m.init[a] ?? 0n) & mask(m.width);
      for (const r of m.reads) vals[r.data] = 0n;
    });
  };
  reset();
  return {
    mode: 'interpreted',
    read: (s) => vals[s]!,
    readNum: (s) => Number(vals[s]!),
    write: (s, v) => {
      vals[s] = BigInt(v) & mask(width(s));
    },
    eval() {
      for (const c of order) vals[c.y] = evalCell(c, val, width);
    },
    tick(clocks) {
      const commits: (() => void)[] = [];
      for (const r of regs) {
        if (!clocks.includes(r.clk)) continue;
        const d = vals[r.d]!;
        commits.push(() => (vals[r.y] = d));
      }
      mems.forEach((m, i) => {
        if (!clocks.includes(m.clk)) return;
        const data = memData[i]!;
        for (const r of m.reads) {
          const a = vals[r.addr]!;
          const d = a < BigInt(m.depth) ? data[Number(a)]! : 0n;
          commits.push(() => (vals[r.data] = d));
        }
        for (const wr of m.writes) {
          if (!vals[wr.en]) continue;
          const a = vals[wr.addr]!;
          const d = vals[wr.data]!;
          if (a < BigInt(m.depth)) commits.push(() => (data[Number(a)] = d));
        }
      });
      for (const f of commits) f();
    },
    reset,
    memGet: (i, a) => memData[i]![a] ?? 0n,
    memSet: (i, a, v) => {
      const m = mems[i]!;
      if (a >= 0 && a < m.depth) memData[i]![a] = v & mask(m.width);
    },
  };
}

/** The number of cells per generated function, to stay within V8's limits for optimisation. */
const CHUNK = 1200;

function compiled(an: Analysis): Backend {
  const { mod, order, regs, mems, width } = an;
  const nsig = mod.signals.length;
  const V = new Uint32Array(nsig);
  const W: (Uint32Array | undefined)[] = mod.signals.map((s) => (s.width > 32 ? new Uint32Array(Math.ceil(s.width / 32)) : undefined));
  const M: (Uint32Array | Uint32Array[])[] = mems.map((m) =>
    m.width > 32 ? Array.from({ length: m.depth }, () => new Uint32Array(Math.ceil(m.width / 32))) : new Uint32Array(m.depth),
  );
  const consts: Uint32Array[] = [];
  const wide = (s: SigId) => width(s) > 32;

  // Signals that must be visible outside the function computing them.
  const stored = new Set<SigId>();
  for (const p of [...mod.inputs, ...mod.outputs]) stored.add(p.sig);
  for (const s of Object.values(mod.names)) stored.add(s);
  for (const r of regs) stored.add(r.d);
  for (const m of mems) {
    for (const r of m.reads) stored.add(r.addr);
    for (const w of m.writes) stored.add(w.addr).add(w.data).add(w.en);
  }
  const chunkOf = new Map<SigId, number>();
  order.forEach((c, i) => chunkOf.set(c.y, Math.floor(i / CHUNK)));
  order.forEach((c, i) => {
    for (const s of combInputs(c)) if (chunkOf.has(s) && chunkOf.get(s) !== Math.floor(i / CHUNK)) stored.add(s);
  });

  const constNum = new Map<SigId, number>();
  for (const c of order) if (c.kind === 'const' && !wide(c.y)) constNum.set(c.y, Number(c.value & mask(width(c.y))));

  const fns: string[] = [];
  const hoisted: string[] = [];
  for (let s = 0; s < nsig; s++) if (W[s]) hoisted.push(`const w${s} = W[${s}];`);

  for (let k = 0; k * CHUNK < Math.max(1, order.length); k++) {
    const cells = order.slice(k * CHUNK, (k + 1) * CHUNK);
    const body: string[] = [];
    const loaded = new Set<SigId>();
    const local = new Set<SigId>();
    /** A narrow operand as an expression. */
    const n = (s: SigId): string => {
      const c = constNum.get(s);
      if (c !== undefined) return String(c);
      if (local.has(s)) return `s${s}`;
      if (!loaded.has(s)) {
        loaded.add(s);
        body.unshift(`const s${s} = V[${s}];`);
      }
      return `s${s}`;
    };
    /** A wide operand (its word array). */
    const wv = (s: SigId): string => `w${s}`;
    /** Any operand as `number | Uint32Array`. */
    const any = (s: SigId): string => (wide(s) ? wv(s) : n(s));
    const fix = (e: string, w: number) => (w === 32 ? `((${e}) >>> 0)` : `((${e}) & ${2 ** w - 1})`);
    const sx = (e: string, w: number) => (w === 32 ? `(${e} | 0)` : `((${e} << ${32 - w}) >> ${32 - w})`);
    const amt = (s: SigId) => (wide(s) ? `rt.amt(${wv(s)})` : n(s));

    for (const c of cells) {
      const y = c.y;
      const w = width(y);
      if (c.kind === 'const') {
        if (wide(y)) {
          WORDS.fromBig(W[y]!, c.value & mask(w));
        } else if (stored.has(y)) body.push(`V[${y}] = ${constNum.get(y)};`);
        continue;
      }
      if (wide(y)) {
        const d = `w${y}`;
        switch (c.kind) {
          case 'add':
          case 'sub':
          case 'mul':
            body.push(`rt.${c.kind}(${d}, ${wv(c.a)}, ${wv(c.b)}, ${w});`);
            break;
          case 'and':
          case 'or':
          case 'xor':
            body.push(`rt.${c.kind}(${d}, ${wv(c.a)}, ${wv(c.b)});`);
            break;
          case 'not':
          case 'neg':
            body.push(`rt.${c.kind}(${d}, ${wv(c.a)}, ${w});`);
            break;
          case 'shl':
            body.push(`rt.shl(${d}, ${wv(c.a)}, ${amt(c.b)}, ${w});`);
            break;
          case 'shr':
            body.push(`rt.shr(${d}, ${wv(c.a)}, ${amt(c.b)}, ${w}, ${c.signed});`);
            break;
          case 'mux':
            body.push(`rt.copy(${d}, ${n(c.s)} ? ${wv(c.b)} : ${wv(c.a)});`);
            break;
          case 'pmux':
            body.push(pmux(c, (s) => `rt.copy(${d}, ${wv(s)});`));
            break;
          case 'slice':
            body.push(`rt.slice(${d}, ${wv(c.a)}, ${c.lo}, ${w});`);
            break;
          case 'concat': {
            body.push(`rt.clear(${d});`);
            let lo = w;
            for (const p of c.parts) {
              const pw = width(p);
              lo -= pw;
              body.push(wide(p) ? `rt.putw(${d}, ${lo}, ${wv(p)}, ${pw});` : `rt.put(${d}, ${lo}, ${n(p)}, ${pw});`);
            }
            break;
          }
          case 'repeat':
            body.push(`rt.repeat(${d}, ${any(c.a)}, ${width(c.a)}, ${c.n});`);
            break;
          case 'zext':
            body.push(`rt.zext(${d}, ${any(c.a)}, ${width(c.a)});`);
            break;
          case 'sext':
            body.push(`rt.sext(${d}, ${any(c.a)}, ${width(c.a)}, ${w});`);
            break;
          default:
            throw new Error(`cell ${c.kind} cannot be wide`);
        }
        continue;
      }
      let e: string;
      const wa = 'a' in c ? width(c.a) : 0;
      switch (c.kind) {
        case 'add':
          e = fix(`${n(c.a)} + ${n(c.b)}`, w);
          break;
        case 'sub':
          e = fix(`${n(c.a)} - ${n(c.b)}`, w);
          break;
        case 'mul':
          e = fix(`Math.imul(${n(c.a)}, ${n(c.b)})`, w);
          break;
        case 'and':
          e = w === 32 ? `((${n(c.a)} & ${n(c.b)}) >>> 0)` : `(${n(c.a)} & ${n(c.b)})`;
          break;
        case 'or':
          e = w === 32 ? `((${n(c.a)} | ${n(c.b)}) >>> 0)` : `(${n(c.a)} | ${n(c.b)})`;
          break;
        case 'xor':
          e = w === 32 ? `((${n(c.a)} ^ ${n(c.b)}) >>> 0)` : `(${n(c.a)} ^ ${n(c.b)})`;
          break;
        case 'not':
          e = fix(`~${n(c.a)}`, w);
          break;
        case 'neg':
          e = fix(`-${n(c.a)}`, w);
          break;
        case 'shl': {
          const b = amt(c.b);
          e = `(${b} >= ${w} ? 0 : ${fix(`${n(c.a)} << ${b}`, w)})`;
          break;
        }
        case 'shr': {
          const b = amt(c.b);
          e = c.signed
            ? fix(`${sx(n(c.a), w)} >> (${b} >= ${w} ? ${w - 1} : ${b})`, w)
            : `(${b} >= ${w} ? 0 : ${n(c.a)} >>> ${b})`;
          break;
        }
        case 'eq':
        case 'ne': {
          const op = c.kind === 'eq' ? '===' : '!==';
          e = wide(c.a) ? (c.kind === 'eq' ? `rt.eq(${wv(c.a)}, ${wv(c.b)})` : `(1 - rt.eq(${wv(c.a)}, ${wv(c.b)}))`) : `(${n(c.a)} ${op} ${n(c.b)} ? 1 : 0)`;
          break;
        }
        case 'lt':
        case 'le':
        case 'gt':
        case 'ge': {
          const op = { lt: '<', le: '<=', gt: '>', ge: '>=' }[c.kind];
          if (wide(c.a)) e = `(rt.cmp(${wv(c.a)}, ${wv(c.b)}, ${wa}, ${c.signed}) ${op} 0 ? 1 : 0)`;
          else if (c.signed) e = `(${sx(n(c.a), wa)} ${op} ${sx(n(c.b), wa)} ? 1 : 0)`;
          else e = `(${n(c.a)} ${op} ${n(c.b)} ? 1 : 0)`;
          break;
        }
        case 'mux':
          e = `(${n(c.s)} ? ${n(c.b)} : ${n(c.a)})`;
          break;
        case 'pmux':
          body.push(`let s${y};`);
          local.add(y);
          body.push(pmux(c, (s) => `s${y} = ${n(s)};`));
          if (stored.has(y)) body.push(`V[${y}] = s${y};`);
          continue;
        case 'slice':
          if (wide(c.a)) e = `rt.get(${wv(c.a)}, ${c.lo}, ${w})`;
          else e = c.lo === 0 ? fix(n(c.a), w) : fix(`${n(c.a)} >>> ${c.lo}`, w);
          break;
        case 'concat': {
          const terms: string[] = [];
          let lo = w;
          for (const p of c.parts) {
            lo -= width(p);
            terms.push(lo ? `(${n(p)} << ${lo})` : n(p));
          }
          e = `((${terms.join(' | ')}) >>> 0)`;
          break;
        }
        case 'repeat': {
          const terms: string[] = [];
          for (let i = 0; i < c.n; i++) terms.push(i ? `(${n(c.a)} << ${i * wa})` : n(c.a));
          e = `((${terms.join(' | ')}) >>> 0)`;
          break;
        }
        case 'zext':
          e = n(c.a);
          break;
        case 'sext':
          e = fix(sx(n(c.a), wa), w);
          break;
        case 'reduce_and':
          e = wide(c.a) ? `rt.all(${wv(c.a)}, ${wa})` : `(${n(c.a)} === ${2 ** wa - 1} ? 1 : 0)`;
          break;
        case 'reduce_or':
          e = wide(c.a) ? `rt.any(${wv(c.a)})` : `(${n(c.a)} !== 0 ? 1 : 0)`;
          break;
        case 'reduce_xor':
          e = wide(c.a) ? `(rt.popw(${wv(c.a)}) & 1)` : `(rt.pop(${n(c.a)}) & 1)`;
          break;
        case 'popcount':
          e = wide(c.a) ? `rt.popw(${wv(c.a)})` : `rt.pop(${n(c.a)})`;
          break;
        default:
          throw new Error(`unexpected cell ${c.kind}`);
      }
      body.push(`const s${y} = ${e};`);
      local.add(y);
      if (stored.has(y)) body.push(`V[${y}] = s${y};`);
    }
    fns.push(`function eval${k}() {\n${body.join('\n')}\n}`);

    function pmux(c: Extract<RtlCell, { kind: 'pmux' }>, assign: (s: SigId) => string): string {
      if (wide(c.s)) {
        const lines: string[] = [];
        c.cases.forEach((k2, i) => {
          const conds = k2.match.map((v) => {
            const arr = new Uint32Array(Math.ceil(width(c.s) / 32));
            WORDS.fromBig(arr, v);
            consts.push(arr);
            return `rt.eq(${wv(c.s)}, C[${consts.length - 1}])`;
          });
          lines.push(`${i ? 'else ' : ''}if (${conds.join(' || ') || 'false'}) { ${assign(k2.data)} }`);
        });
        lines.push(c.cases.length ? `else { ${assign(c.default)} }` : assign(c.default));
        return lines.join('\n');
      }
      const sel = n(c.s);
      const lines = [`switch (${sel}) {`];
      for (const k2 of c.cases) {
        if (!k2.match.length) continue;
        lines.push(`${k2.match.map((v) => `case ${Number(v)}:`).join(' ')} ${assign(k2.data)} break;`);
      }
      lines.push(`default: ${assign(c.default)}`, '}');
      return lines.join('\n');
    }
  }

  // Clock edges: one function per set of clocks, generated when first used.
  const makeTick = (clocks: SigId[]): (() => void) => {
    const prelude: string[] = [];
    const sample: string[] = [];
    const commit: string[] = [];
    let t = 0;
    const tmp = (words: number) => {
      prelude.push(`const t${t} = new Uint32Array(${words});`);
      return `t${t}`;
    };
    const addr = (s: SigId) => (wide(s) ? `rt.amt(W[${s}])` : `V[${s}]`);
    for (const r of regs) {
      if (!clocks.includes(r.clk)) continue;
      if (wide(r.y)) {
        const x = tmp(W[r.y]!.length);
        sample.push(`rt.copy(${x}, W[${r.d}]);`);
        commit.push(`rt.copy(W[${r.y}], ${x});`);
      } else {
        sample.push(`const t${t} = V[${r.d}];`);
        commit.push(`V[${r.y}] = t${t};`);
      }
      t++;
    }
    mems.forEach((m, i) => {
      if (!clocks.includes(m.clk)) return;
      for (const r of m.reads) {
        if (m.width > 32) {
          const x = tmp(W[r.data]!.length);
          sample.push(`{ const a = ${addr(r.addr)}; if (a < ${m.depth}) rt.copy(${x}, M[${i}][a]); else rt.clear(${x}); }`);
          commit.push(`rt.copy(W[${r.data}], ${x});`);
        } else {
          sample.push(`const a${t} = ${addr(r.addr)}; const t${t} = a${t} < ${m.depth} ? M[${i}][a${t}] : 0;`);
          commit.push(`V[${r.data}] = t${t};`);
        }
        t++;
      }
      for (const wr of m.writes) {
        if (m.width > 32) {
          const x = tmp(W[wr.data]!.length);
          sample.push(`rt.copy(${x}, W[${wr.data}]); const e${t} = V[${wr.en}], a${t} = ${addr(wr.addr)};`);
          commit.push(`if (e${t} && a${t} < ${m.depth}) rt.copy(M[${i}][a${t}], ${x});`);
        } else {
          sample.push(`const e${t} = V[${wr.en}], a${t} = ${addr(wr.addr)}, d${t} = V[${wr.data}];`);
          commit.push(`if (e${t} && a${t} < ${m.depth}) M[${i}][a${t}] = d${t};`);
        }
        t++;
      }
    });
    const src = `"use strict";\n${prelude.join('\n')}\nreturn function tick() {\n${sample.join('\n')}\n${commit.join('\n')}\n};`;
    return (new Function('V', 'W', 'M', 'rt', src) as (...a: unknown[]) => () => void)(V, W, M, WORDS);
  };

  const source = `"use strict";\n${hoisted.join('\n')}\n${fns.join('\n')}\nreturn function evalAll() { ${fns.map((_, k) => `eval${k}();`).join(' ')} };`;
  const evalAll = (new Function('V', 'W', 'M', 'C', 'rt', source) as (...args: unknown[]) => () => void)(V, W, M, consts, WORDS);
  const ticks = new Map<string, () => void>();

  const reset = () => {
    for (const r of regs) {
      const v = r.init & mask(width(r.y));
      if (W[r.y]) WORDS.fromBig(W[r.y]!, v);
      else V[r.y] = Number(v);
    }
    mems.forEach((m, i) => {
      const data = M[i]!;
      for (let a = 0; a < m.depth; a++) {
        const v = (m.init[a] ?? 0n) & mask(m.width);
        if (Array.isArray(data)) WORDS.fromBig(data[a]!, v);
        else data[a] = Number(v);
      }
      for (const r of m.reads) {
        if (W[r.data]) W[r.data]!.fill(0);
        else V[r.data] = 0;
      }
    });
  };
  reset();
  return {
    mode: 'compiled',
    read: (s) => (W[s] ? WORDS.toBig(W[s]!) : BigInt(V[s]!)),
    readNum: (s) => (W[s] ? Number(WORDS.toBig(W[s]!)) : V[s]!),
    write: (s, v) => {
      const b = BigInt(v) & mask(width(s));
      if (W[s]) WORDS.fromBig(W[s]!, b);
      else V[s] = Number(b);
    },
    eval: evalAll,
    tick(clocks) {
      const key = clocks.join(',');
      let f = ticks.get(key);
      if (!f) ticks.set(key, (f = makeTick(clocks)));
      f();
    },
    reset,
    memGet(i, a) {
      const data = M[i]!;
      if (a < 0 || a >= mems[i]!.depth) return 0n;
      return Array.isArray(data) ? WORDS.toBig(data[a]!) : BigInt(data[a]!);
    },
    memSet(i, a, v) {
      const m = mems[i]!;
      const data = M[i]!;
      if (a < 0 || a >= m.depth) return;
      const b = v & mask(m.width);
      if (Array.isArray(data)) WORDS.fromBig(data[a]!, b);
      else data[a] = Number(b);
    },
  };
}

function canCompile(): boolean {
  try {
    return new Function('return 1')() === 1;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------------------------ public API

/** Creates a simulator for `top` (default: the design's top) of an elaborated design. */
export function createRtlSim(design: RtlDesign | RtlModule, top?: string, options: RtlSimOptions = {}): RtlSim {
  const mod = 'modules' in design ? flattenRtl(design, top ?? design.top) : design;
  const an = analyse(mod);
  const mode = options.mode ?? (canCompile() ? 'compiled' : 'interpreted');
  const be = mode === 'compiled' ? compiled(an) : interpreter(an);
  const inputs = new Map(mod.inputs.map((p) => [p.name, p]));
  const clockSigs = an.clocks.map((c) => c.sig);
  const memIndex = new Map<string, number>(an.mems.map((m, i) => [m.name, i]));
  // Memories are named by their declaration; after flattening, prefix them with the instance path.
  for (const [i, m] of an.mems.entries()) {
    const path = m.path.split('.').slice(1).join('.');
    memIndex.set(path ? `${path}.${m.name}` : m.name, i);
  }
  let dirty = true;
  const sigOf = (name: string): number => {
    const s = mod.names[name];
    if (s === undefined) {
      const p = mod.outputs.find((o) => o.name === name) ?? mod.inputs.find((o) => o.name === name);
      if (p) return p.sig;
      throw new Error(`no signal named \`${name}\``);
    }
    return s;
  };
  const settle = () => {
    if (dirty) {
      be.eval();
      dirty = false;
    }
  };
  const sim: RtlSim = {
    module: mod,
    mode: be.mode,
    cycle: 0,
    set(port, value) {
      const p = inputs.get(port);
      if (!p) throw new Error(mod.outputs.some((o) => o.name === port) ? `\`${port}\` is an output` : `no input named \`${port}\``);
      if (p.clock) throw new Error(`\`${port}\` is a clock: use tick() or step()`);
      be.write(p.sig, value);
      dirty = true;
    },
    get(name) {
      const s = sigOf(name);
      if (mod.signals[s]!.width > 32) throw new Error(`\`${name}\` is wider than 32 bits: use getBig()`);
      settle();
      return be.readNum(s);
    },
    getBig(name) {
      const s = sigOf(name);
      settle();
      return be.read(s);
    },
    peek(name) {
      return sim.getBig(name);
    },
    eval() {
      dirty = true;
      settle();
    },
    tick(clock) {
      let clocks = clockSigs;
      if (clock !== undefined) {
        const p = inputs.get(clock);
        if (!p || !p.clock) throw new Error(`no clock input named \`${clock}\``);
        clocks = [p.sig];
      }
      settle();
      be.tick(clocks);
      dirty = true;
      if (clock === undefined || clocks[0] === clockSigs[0]) sim.cycle++;
    },
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        settle();
        be.tick(clockSigs);
        dirty = true;
      }
      sim.cycle += n;
    },
    reset() {
      be.reset();
      sim.cycle = 0;
      dirty = true;
    },
    readMem(name, addr) {
      const i = memIndex.get(name);
      if (i === undefined) throw new Error(`no memory named \`${name}\``);
      return be.memGet(i, addr);
    },
    writeMem(name, addr, value) {
      const i = memIndex.get(name);
      if (i === undefined) throw new Error(`no memory named \`${name}\``);
      be.memSet(i, addr, BigInt(value));
    },
    signal(name) {
      const s = sigOf(name);
      const width = mod.signals[s]!.width;
      const input = inputs.get(name);
      return {
        name,
        width,
        get() {
          if (width > 32) throw new Error(`\`${name}\` is wider than 32 bits: use getBig()`);
          if (dirty) settle();
          return be.readNum(s);
        },
        getBig() {
          settle();
          return be.read(s);
        },
        set(value) {
          if (!input || input.clock) throw new Error(`\`${name}\` is not a data input`);
          be.write(s, value);
          dirty = true;
        },
      };
    },
    names: () => Object.keys(mod.names),
    width: (name) => mod.signals[sigOf(name)]!.width,
  };
  return sim;
}
