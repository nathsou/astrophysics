/**
 * Front end for DCL's word-level RTL (`src/lib/hdl/rtl.ts`): `fromRtl(design)` lowers every RTL cell to AIG gates
 * and returns a `Design` for the rest of the flow. (This module reads the RTL format; it does not modify it.)
 *
 * - The hierarchy is flattened first; every cell keeps its source span and hierarchical path (`SourceInfo`), and
 *   the AIG nodes made from it record it as their origin.
 * - Input ports become input ports of the device, one per bit (`name[i]`); clock inputs are clocks. Output ports
 *   become output ports per bit.
 * - `add`/`sub` are ripple adders written as full adders (so carry-chain inference finds them), `mul` an array
 *   multiplier, shifts barrel shifters, comparisons ripple comparators, `pmux` a parallel multiplexer.
 * - A `reg` becomes flip-flops. When its data input comes from a multiplexer that holds the register's own value,
 *   that becomes the flip-flop's clock enable; a multiplexer outside it that selects a constant becomes a
 *   synchronous set/reset (the reset has priority over the enable, as in the RTL `if rst {…} else if en {…}`).
 * - A `mem` becomes block RAM, one RAM per read port (they share the write port). One write port only. Reads
 *   at addresses beyond the depth of a memory whose depth is not a power of two are not forced to 0.
 *
 * Clocks must be input ports (derived clocks are refused).
 */
import { flattenRtl, type RtlCell, type RtlDesign, type RtlModule, type SigId } from '../../hdl/rtl';
import { Aig, FALSE, TRUE } from './aig';
import { FlowError, type Design, type Port, type Ram, type Reg, type SourceInfo } from './design';

type Bits = number[];

const zeros = (n: number): Bits => new Array(n).fill(FALSE);

export function fromRtl(design: RtlDesign | RtlModule): Design {
  const m: RtlModule = 'modules' in design ? flattenRtl(design) : flattenRtl({ top: design.name, modules: { [design.name]: design } });
  const aig = new Aig(4096);
  const sources: SourceInfo[] = [];
  const ports: Port[] = [];
  const regs: Reg[] = [];
  const rams: Ram[] = [];
  const warnings: string[] = [];

  const width = (s: SigId): number => m.signals[s]!.width;
  const bits: (Bits | undefined)[] = new Array(m.signals.length);
  const get = (s: SigId): Bits => {
    const b = bits[s];
    if (!b) throw new FlowError(`internal error: signal %${s} used before it is driven`, 'synthesis');
    return b;
  };
  const nameOf = (s: SigId): string | undefined => m.signals[s]?.name;

  const srcOfPort = (name: string): number => sources.push({ id: name, path: '', type: 'port' }) - 1;

  // Input ports.
  const clockPortOfSig = new Map<SigId, number>();
  for (const p of m.inputs) {
    aig.cur = undefined;
    const src = srcOfPort(p.name);
    aig.cur = [src];
    const b: Bits = [];
    for (let i = 0; i < p.width; i++) {
      const l = aig.addPi();
      b.push(l);
      ports.push({ name: p.width > 1 ? `${p.name}[${i}]` : p.name, dir: 'in', clock: p.clock, lit: l, src });
      if (p.clock) clockPortOfSig.set(p.sig, ports.length - 1);
    }
    bits[p.sig] = b;
  }

  // Sources for cells.
  const cellSrc: number[] = m.cells.map((c) => sources.push({ id: `${c.path}/${c.kind}#${c.id}`, path: c.path, type: c.kind, line: c.src?.line, col: c.src?.col }) - 1);

  // Registers and memory read data are inputs of the combinational logic.
  const regCells: number[] = [];
  const memCells: number[] = [];
  m.cells.forEach((c, i) => {
    aig.cur = [cellSrc[i]!];
    if (c.kind === 'reg') {
      regCells.push(i);
      bits[c.y] = Array.from({ length: width(c.y) }, () => aig.addPi());
    } else if (c.kind === 'mem') {
      memCells.push(i);
      // One RAM per read port; their data outputs are PIs.
      c.reads.forEach((r) => (bits[r.data] = Array.from({ length: width(r.data) }, () => aig.addPi())));
    }
  });

  // Combinational cells in dependency order.
  const comb = m.cells.map((_, i) => i).filter((i) => m.cells[i]!.kind !== 'reg' && m.cells[i]!.kind !== 'mem');
  const driver = new Map<SigId, number>();
  for (const i of comb) driver.set((m.cells[i] as { y: SigId }).y, i);
  const operands = (c: RtlCell): SigId[] => {
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
        return [(c as { a: SigId }).a, (c as { b: SigId }).b];
    }
  };
  const done = new Set<number>();
  const visiting = new Set<number>();
  const lower = (i: number) => {
    // Iterative post-order over the driver graph.
    const stack: { i: number; k: number }[] = [{ i, k: 0 }];
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      if (done.has(top.i)) {
        stack.pop();
        continue;
      }
      visiting.add(top.i);
      const c = m.cells[top.i]!;
      const ops = operands(c);
      if (top.k < ops.length) {
        const s = ops[top.k++]!;
        if (!bits[s]) {
          const d = driver.get(s);
          if (d === undefined) throw new FlowError(`Signal %${s}${nameOf(s) ? ` (${nameOf(s)})` : ''} has no driver.`, 'synthesis');
          if (visiting.has(d) && !done.has(d)) throw new FlowError(`Combinational loop through ${nameOf(s) ?? `%${s}`}.`, 'synthesis', [nameOf(s) ?? `%${s}`]);
          stack.push({ i: d, k: 0 });
        }
        continue;
      }
      aig.cur = [cellSrc[top.i]!];
      bits[(c as { y: SigId }).y] = lowerCell(c, aig, get, width);
      done.add(top.i);
      visiting.delete(top.i);
      stack.pop();
    }
  };
  for (const i of comb) lower(i);

  // Registers.
  const clockPort = (sig: SigId, what: string): number => {
    const p = clockPortOfSig.get(sig);
    if (p === undefined) throw new FlowError(`The clock of ${what} is not an input of the device (derived clocks are not supported; use clock enables).`, 'synthesis', [what]);
    ports[p]!.clock = true;
    return p;
  };
  const driverCell = (s: SigId): RtlCell | undefined => {
    const d = driver.get(s);
    return d === undefined ? undefined : m.cells[d];
  };
  const constBits = (s: SigId): Bits | undefined => {
    const b = get(s);
    return b.every((l) => l === FALSE || l === TRUE) ? b : undefined;
  };
  for (const i of regCells) {
    const c = m.cells[i]! as Extract<RtlCell, { kind: 'reg' }>;
    aig.cur = [cellSrc[i]!];
    const w = width(c.y);
    const q = get(c.y);
    const clk = clockPort(c.clk, nameOf(c.y) ?? `register %${c.y}`);
    let dSig = c.d;
    let sr = -1;
    let srVals: Bits | undefined;
    let ce = -1;
    // The multiplexer driving D, if any. `special` is true when it picks the register's own value (hold) or a constant.
    const peel = (): { special: number; other: SigId; konst: Bits | undefined; hold: boolean } | undefined => {
      const dc = driverCell(dSig);
      if (!dc || dc.kind !== 'mux') return undefined;
      const a = get(dc.a);
      const b = get(dc.b);
      const s = get(dc.s)[0]!;
      const isQ = (x: Bits) => x.length === q.length && x.every((l, k) => l === q[k]);
      if (isQ(a)) return { special: s ^ 1, other: dc.b, konst: undefined, hold: true };
      if (isQ(b)) return { special: s, other: dc.a, konst: undefined, hold: true };
      const ca = constBits(dc.a);
      const cb = constBits(dc.b);
      if (cb && !ca) return { special: s, other: dc.a, konst: cb, hold: false };
      if (ca && !cb) return { special: s ^ 1, other: dc.b, konst: ca, hold: false };
      return undefined;
    };
    // An outer multiplexer selecting a constant is a synchronous reset (or set); inside it, one holding Q is the enable.
    const outer = peel();
    if (outer && !outer.hold && outer.konst) {
      sr = outer.special;
      srVals = outer.konst;
      dSig = outer.other;
    }
    const inner = peel();
    if (inner && inner.hold) {
      ce = inner.special ^ 1;
      dSig = inner.other;
    }
    const d = get(dSig);
    for (let k = 0; k < w; k++) {
      // With a shared reset, bits whose constant differ get their own set/reset value.
      regs.push({
        name: w > 1 ? `${nameOf(c.y) ?? `reg${c.y}`}[${k}]` : (nameOf(c.y) ?? `reg${c.y}`),
        q: q[k]!,
        d: d[k]!,
        clk,
        ce: ce === -1 ? -1 : ce,
        sr: sr === -1 ? -1 : sr,
        srAsync: false,
        srVal: srVals ? (srVals[k] === TRUE ? 1 : 0) : 0,
        init: Number((c.init >> BigInt(k)) & 1n) as 0 | 1,
        src: cellSrc[i]!,
      });
    }
  }

  // Memories.
  for (const i of memCells) {
    const c = m.cells[i]! as Extract<RtlCell, { kind: 'mem' }>;
    aig.cur = [cellSrc[i]!];
    if (c.writes.length > 1) throw new FlowError(`Memory ${c.name} has ${c.writes.length} write ports; a block RAM has one.`, 'synthesis', [c.name]);
    const addrBits = Math.max(1, Math.ceil(Math.log2(c.depth)));
    const clk = clockPort(c.clk, c.name);
    const w = c.writes[0];
    const fit = (b: Bits): Bits => Array.from({ length: addrBits }, (_, k) => b[k] ?? FALSE);
    let we: number = FALSE;
    let waddr: Bits = [];
    let wdata: Bits = [];
    if (w) {
      waddr = fit(get(w.addr));
      wdata = get(w.data);
      we = get(w.en)[0]!;
      // Writes beyond the depth are ignored.
      const wa = get(w.addr);
      const high = wa.slice(addrBits);
      if (high.length) we = aig.and(we, aig.orN(high) ^ 1);
      if (c.depth < 2 ** addrBits) {
        const lt = lessThan(aig, wa.slice(0, addrBits).concat(zeros(0)), constant(BigInt(c.depth), addrBits), false);
        we = aig.and(we, lt);
      }
    }
    const contents = Array.from({ length: c.depth }, (_, a) => Number(c.init[a] ?? 0n));
    c.reads.forEach((r, ri) => {
      const dout = get(r.data);
      rams.push({
        name: c.reads.length > 1 ? `${c.name}.read${ri}` : c.name,
        async: false,
        addrBits,
        dataBits: c.width,
        raddr: fit(get(r.addr)),
        waddr,
        wdata,
        we,
        re: -1,
        clk,
        dout,
        contents,
        src: cellSrc[i]!,
      });
    });
  }

  // Output ports.
  for (const p of m.outputs) {
    const src = srcOfPort(p.name);
    aig.cur = [src];
    const b = get(p.sig);
    for (let i = 0; i < p.width; i++) ports.push({ name: p.width > 1 ? `${p.name}[${i}]` : p.name, dir: 'out', clock: false, lit: b[i]!, src });
  }
  aig.cur = undefined;
  return { aig, ports, regs, rams, sources, warnings, name: m.name };
}

// ─── Word-level lowering ──────────────────────────────────────────────────────────────────────────

const constant = (v: bigint, w: number): Bits => Array.from({ length: w }, (_, i) => (((v >> BigInt(i)) & 1n) === 1n ? TRUE : FALSE));

/** a + b + cin over the width of a and b, as full adders; returns the sum bits and the carry out. */
export function ripple(aig: Aig, a: Bits, b: Bits, cin: number): { sum: Bits; cout: number } {
  const sum: Bits = [];
  let c = cin;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    const p = aig.xor(x, y);
    sum.push(aig.xor(p, c));
    c = aig.or(aig.and(x, y), aig.and(c, p));
  }
  return { sum, cout: c };
}

/** Unsigned (or signed) a < b. */
function lessThan(aig: Aig, a: Bits, b: Bits, signed: boolean): number {
  let lt = FALSE;
  const n = a.length;
  for (let i = 0; i < n; i++) {
    let x = a[i]!;
    let y = b[i]!;
    if (signed && i === n - 1) {
      x ^= 1;
      y ^= 1;
    }
    lt = aig.or(aig.and(x ^ 1, y), aig.and(aig.xor(x, y) ^ 1, lt));
  }
  return lt;
}

function shift(aig: Aig, a: Bits, amount: Bits, left: boolean, signed: boolean): Bits {
  const w = a.length;
  const K = Math.min(amount.length, w <= 1 ? 0 : Math.ceil(Math.log2(w)));
  let y = a.slice();
  const fill = left ? FALSE : signed ? a[w - 1]! : FALSE;
  for (let k = 0; k < K; k++) {
    const sh = 1 << k;
    const moved = y.map((_, j) => (left ? (j >= sh ? y[j - sh]! : FALSE) : j + sh < w ? y[j + sh]! : fill));
    y = y.map((v, j) => aig.mux(amount[k]!, v, moved[j]!));
  }
  const over = aig.orN(amount.slice(K));
  return y.map((v) => aig.mux(over, v, fill));
}

function lowerCell(c: RtlCell, aig: Aig, get: (s: SigId) => Bits, width: (s: SigId) => number): Bits {
  const w = 'y' in c && c.kind !== 'mem' ? width(c.y) : 0;
  switch (c.kind) {
    case 'const':
      return constant(c.value, w);
    case 'add':
      return ripple(aig, get(c.a), get(c.b), FALSE).sum;
    case 'sub':
      return ripple(aig, get(c.a), get(c.b).map((l) => l ^ 1), TRUE).sum;
    case 'mul': {
      const a = get(c.a);
      const b = get(c.b);
      let acc = zeros(w);
      for (let i = 0; i < w; i++) {
        const pp = Array.from({ length: w }, (_, k) => (k < i ? FALSE : aig.and(a[k - i]!, b[i]!)));
        acc = ripple(aig, acc, pp, FALSE).sum;
      }
      return acc;
    }
    case 'and':
      return get(c.a).map((x, i) => aig.and(x, get(c.b)[i]!));
    case 'or':
      return get(c.a).map((x, i) => aig.or(x, get(c.b)[i]!));
    case 'xor':
      return get(c.a).map((x, i) => aig.xor(x, get(c.b)[i]!));
    case 'not':
      return get(c.a).map((x) => x ^ 1);
    case 'neg':
      return ripple(aig, zeros(w), get(c.a).map((l) => l ^ 1), TRUE).sum;
    case 'shl':
      return shift(aig, get(c.a), get(c.b), true, false);
    case 'shr':
      return shift(aig, get(c.a), get(c.b), false, c.signed);
    case 'eq':
    case 'ne': {
      const a = get(c.a);
      const b = get(c.b);
      const e = aig.andN(a.map((x, i) => aig.xor(x, b[i]!) ^ 1));
      return [c.kind === 'eq' ? e : e ^ 1];
    }
    case 'lt':
      return [lessThan(aig, get(c.a), get(c.b), c.signed)];
    case 'gt':
      return [lessThan(aig, get(c.b), get(c.a), c.signed)];
    case 'le':
      return [lessThan(aig, get(c.b), get(c.a), c.signed) ^ 1];
    case 'ge':
      return [lessThan(aig, get(c.a), get(c.b), c.signed) ^ 1];
    case 'mux': {
      const s = get(c.s)[0]!;
      const a = get(c.a);
      const b = get(c.b);
      return a.map((x, i) => aig.mux(s, x, b[i]!));
    }
    case 'pmux': {
      const s = get(c.s);
      let y = get(c.default).slice();
      for (const cs of c.cases) {
        const hit = aig.orN(cs.match.map((v) => aig.andN(s.map((l, i) => (((v >> BigInt(i)) & 1n) === 1n ? l : l ^ 1)))));
        const d = get(cs.data);
        y = y.map((v, i) => aig.mux(hit, v, d[i]!));
      }
      return y;
    }
    case 'slice':
      return get(c.a).slice(c.lo, c.lo + w);
    case 'concat': {
      const out: Bits = [];
      for (let i = c.parts.length - 1; i >= 0; i--) out.push(...get(c.parts[i]!));
      return out;
    }
    case 'repeat': {
      const a = get(c.a);
      const out: Bits = [];
      for (let i = 0; i < c.n; i++) out.push(...a);
      return out;
    }
    case 'zext':
      return [...get(c.a), ...zeros(w - get(c.a).length)];
    case 'sext': {
      const a = get(c.a);
      return [...a, ...new Array(w - a.length).fill(a[a.length - 1]!)];
    }
    case 'reduce_and':
      return [aig.andN(get(c.a))];
    case 'reduce_or':
      return [aig.orN(get(c.a))];
    case 'reduce_xor':
      return [aig.xorN(get(c.a))];
    case 'popcount': {
      let nums: Bits[] = get(c.a).map((b) => [b]);
      if (nums.length === 0) return zeros(w);
      while (nums.length > 1) {
        const next: Bits[] = [];
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const x = nums[i]!;
          const y = nums[i + 1]!;
          const n = Math.max(x.length, y.length);
          const pad = (v: Bits) => [...v, ...zeros(n - v.length)];
          const r = ripple(aig, pad(x), pad(y), FALSE);
          next.push([...r.sum, r.cout]);
        }
        if (nums.length & 1) next.push(nums[nums.length - 1]!);
        nums = next;
      }
      const out = nums[0]!;
      return Array.from({ length: w }, (_, i) => out[i] ?? FALSE);
    }
    default:
      throw new FlowError(`RTL cell ${c.kind} cannot be lowered`, 'synthesis');
  }
}
