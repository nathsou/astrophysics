/**
 * Word-level RTL cells → gates (see `index.ts` for the scheme). Every function takes bit vectors (least
 * significant bit first) and returns the bits of the cell's result.
 */
import type { RtlCell } from '../rtl';
import { GateBuilder } from './builder';
import { CONST0, CONST1, isConst, type Bit } from './types';

const zeros = (n: number): Bit[] => Array.from({ length: n }, () => CONST0);

function ceilLog2(n: number): number {
  let s = 0;
  while (2 ** s < n) s++;
  return s;
}

const bitOf = (v: bigint, i: number): Bit => ((v >> BigInt(i)) & 1n ? CONST1 : CONST0);

/** `a + b + cin` as gates, or as `adder` blocks of up to 16 bits when asked and worthwhile. */
export function addBits(gb: GateBuilder, a: Bit[], b: Bit[], cin: Bit, blocks: boolean): { sum: Bit[]; cout: Bit } {
  const worthIt = blocks && a.some((x, i) => !isConst(x) || !isConst(b[i]!));
  if (!worthIt) {
    // A constant operand folds a full adder into a half adder, or into wires.
    if (b.every((x) => x === CONST0) && cin !== CONST0) return gb.inc(a, cin);
    if (a.every((x) => x === CONST0) && cin !== CONST0) return gb.inc(b, cin);
    return gb.add(a, b, cin);
  }
  const sum: Bit[] = [];
  let c = cin;
  for (let lo = 0; lo < a.length; lo += 16) {
    const n = Math.min(16, a.length - lo);
    const ins: Record<string, Bit> = { CIN: c };
    const outs: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      ins[`A${i}`] = a[lo + i]!;
      ins[`B${i}`] = b[lo + i]!;
      outs[`S${i}`] = gb.net();
    }
    const cout = gb.net();
    outs.COUT = cout;
    gb.bit(lo);
    gb.emit('adder', ins, outs, { bits: n }, 'adder');
    for (let i = 0; i < n; i++) sum.push(outs[`S${i}`]!);
    c = cout;
  }
  gb.bit(undefined);
  return { sum, cout: c };
}

/** `a == constant`: an AND of literals. */
function eqConst(gb: GateBuilder, s: Bit[], m: bigint, role: string): Bit {
  if (m >> BigInt(s.length)) return CONST0;
  return gb.andN(
    s.map((x, i) => (bitOf(m, i) === CONST1 ? x : gb.not(x))),
    role,
  );
}

/** Unsigned (or signed) `a < b`: a chain that keeps "less so far", deciding at every bit where a and b differ. */
function lessThan(gb: GateBuilder, a: Bit[], b: Bit[], signed: boolean): Bit {
  let lt = CONST0;
  for (let i = 0; i < a.length; i++) {
    gb.bit(i);
    const differ = gb.xor2(a[i]!, b[i]!, 'lt.differ');
    // Where they differ, a < b when b has the 1 (unsigned) or, for the sign bit, when a has it.
    const decide = signed && i === a.length - 1 ? a[i]! : b[i]!;
    lt = gb.mux(differ, lt, decide, 'lt.mux');
  }
  gb.bit(undefined);
  return lt;
}

function shifter(gb: GateBuilder, a: Bit[], amt: Bit[], left: boolean, arith: boolean): Bit[] {
  const w = a.length;
  const S = ceilLog2(w);
  const stages = Math.min(S, amt.length);
  const fill = arith ? a[w - 1]! : CONST0;
  let cur = a;
  for (let k = 0; k < stages; k++) {
    const sh = 2 ** k;
    const sel = amt[k]!;
    const prev = cur;
    cur = prev.map((x, i) => {
      gb.bit(i);
      const from = left ? (i - sh >= 0 ? prev[i - sh]! : CONST0) : i + sh < w ? prev[i + sh]! : fill;
      return gb.mux(sel, x, from, `shift${k}`);
    });
  }
  gb.bit(undefined);
  // Amounts of 2^S or more (bits above the stages) shift everything out.
  const over = gb.orN(amt.slice(S), 'over');
  if (over === CONST0) return cur;
  return cur.map((x, i) => {
    gb.bit(i);
    return gb.mux(over, x, fill, 'clear');
  });
}

/** A parallel multiplexer: AND-OR over decoded selects. */
function pmux(gb: GateBuilder, s: Bit[], cases: { match: bigint[]; data: Bit[] }[], dflt: Bit[]): Bit[] {
  const w = dflt.length;
  const sels = cases.map((k) => gb.orN(k.match.map((m) => eqConst(gb, s, m, 'decode')), 'decode.or'));
  // When the cases cover every value of a narrow select, there is no "none of them" and no default.
  const covered = new Set<bigint>();
  for (const k of cases) for (const m of k.match) covered.add(m);
  const full = s.length <= 20 && covered.size >= 2 ** s.length;
  let none: Bit | undefined;
  const out: Bit[] = [];
  for (let i = 0; i < w; i++) {
    gb.bit(i);
    const terms: Bit[] = cases.map((k, j) => gb.and2(sels[j]!, k.data[i]!, 'sel'));
    if (!full && dflt[i] !== CONST0) {
      none ??= gb.not(gb.orN(sels, 'none'));
      terms.push(gb.and2(none, dflt[i]!, 'sel'));
    }
    out.push(gb.orN(terms, 'or'));
  }
  gb.bit(undefined);
  return out;
}

/** Lowers one combinational cell. `get` returns the bits of a signal. */
export function lowerCell(gb: GateBuilder, c: RtlCell, get: (s: number) => Bit[], width: (s: number) => number, blocks: boolean): Bit[] {
  if (c.kind === 'reg' || c.kind === 'mem') throw new Error('not a combinational cell');
  const w = width(c.y);
  const perBit = (f: (i: number) => Bit): Bit[] => {
    const out: Bit[] = [];
    for (let i = 0; i < w; i++) {
      gb.bit(i);
      out.push(f(i));
    }
    gb.bit(undefined);
    return out;
  };
  switch (c.kind) {
    case 'const':
      return Array.from({ length: w }, (_, i) => bitOf(c.value, i));
    case 'and': {
      const a = get(c.a), b = get(c.b);
      return perBit((i) => gb.and2(a[i]!, b[i]!));
    }
    case 'or': {
      const a = get(c.a), b = get(c.b);
      return perBit((i) => gb.or2(a[i]!, b[i]!));
    }
    case 'xor': {
      const a = get(c.a), b = get(c.b);
      return perBit((i) => gb.xor2(a[i]!, b[i]!));
    }
    case 'not': {
      const a = get(c.a);
      return perBit((i) => gb.not(a[i]!));
    }
    case 'add':
      return addBits(gb, get(c.a), get(c.b), CONST0, blocks).sum;
    case 'sub': {
      const nb = perBit((i) => gb.not(get(c.b)[i]!));
      return addBits(gb, get(c.a), nb, CONST1, blocks).sum;
    }
    case 'neg': {
      const na = perBit((i) => gb.not(get(c.a)[i]!));
      return addBits(gb, zeros(w), na, CONST1, blocks).sum;
    }
    case 'mul': {
      const a = get(c.a), b = get(c.b);
      let acc = zeros(w);
      for (let j = 0; j < w; j++) {
        if (b[j] === CONST0) continue;
        gb.bit(j);
        const part = zeros(w);
        for (let i = j; i < w; i++) part[i] = gb.and2(a[i - j]!, b[j]!, 'pp');
        acc = j === 0 ? part : addBits(gb, acc, part, CONST0, blocks).sum;
      }
      gb.bit(undefined);
      return acc;
    }
    case 'shl':
      return shifter(gb, get(c.a), get(c.b), true, false);
    case 'shr':
      return shifter(gb, get(c.a), get(c.b), false, c.signed);
    case 'eq':
    case 'ne': {
      const a = get(c.a), b = get(c.b);
      if (c.kind === 'eq') {
        const bits = a.map((x, i) => (gb.bit(i), gb.xnor2(x, b[i]!, 'xnor')));
        gb.bit(undefined);
        return [gb.andN(bits, 'all')];
      }
      const bits = a.map((x, i) => (gb.bit(i), gb.xor2(x, b[i]!, 'xor')));
      gb.bit(undefined);
      return [gb.orN(bits, 'any')];
    }
    case 'lt':
      return [lessThan(gb, get(c.a), get(c.b), c.signed)];
    case 'gt':
      return [lessThan(gb, get(c.b), get(c.a), c.signed)];
    case 'ge':
      return [gb.not(lessThan(gb, get(c.a), get(c.b), c.signed))];
    case 'le':
      return [gb.not(lessThan(gb, get(c.b), get(c.a), c.signed))];
    case 'mux': {
      const s = get(c.s)[0]!, a = get(c.a), b = get(c.b);
      return perBit((i) => gb.mux(s, a[i]!, b[i]!));
    }
    case 'pmux':
      return pmux(
        gb,
        get(c.s),
        c.cases.map((k) => ({ match: k.match, data: get(k.data) })),
        get(c.default),
      );
    case 'slice':
      return get(c.a).slice(c.lo, c.lo + w);
    case 'concat': {
      // The first part is the most significant.
      const out: Bit[] = [];
      for (let i = c.parts.length - 1; i >= 0; i--) out.push(...get(c.parts[i]!));
      return out;
    }
    case 'repeat': {
      const a = get(c.a);
      const out: Bit[] = [];
      for (let i = 0; i < c.n; i++) out.push(...a);
      return out;
    }
    case 'zext': {
      const a = get(c.a);
      return [...a, ...zeros(w - a.length)];
    }
    case 'sext': {
      const a = get(c.a);
      return [...a, ...Array.from({ length: w - a.length }, () => a[a.length - 1]!)];
    }
    case 'reduce_and':
      return [gb.andN(get(c.a), 'all')];
    case 'reduce_or':
      return [gb.orN(get(c.a), 'any')];
    case 'reduce_xor':
      return [gb.xorN(get(c.a), 'parity')];
    case 'popcount': {
      // Count ones by adding the bits one at a time to a growing counter (a chain of half adders each).
      let acc: Bit[] = [];
      get(c.a).forEach((x, k) => {
        gb.bit(k);
        let carry = x;
        const next: Bit[] = [];
        for (let j = 0; j < acc.length; j++) {
          next.push(gb.xor2(acc[j]!, carry, 'ha.xor'));
          carry = gb.and2(acc[j]!, carry, 'ha.and');
        }
        if (acc.length === 0 || carry !== CONST0) next.push(carry);
        acc = next;
      });
      gb.bit(undefined);
      return acc.length >= w ? acc.slice(0, w) : [...acc, ...zeros(w - acc.length)];
    }
  }
}
