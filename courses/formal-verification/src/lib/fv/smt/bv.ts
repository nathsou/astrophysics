/**
 * Bit-blasting (chapter 14): a bit-vector term becomes a vector of propositional literals, least significant bit
 * first, and each operator becomes a circuit — ripple-carry adders, shift-and-add multipliers, barrel shifters,
 * comparators. Division is defined by its specification (a = q·b + r with r < b) rather than by a divider circuit.
 * This is the encoding Bitwuzla, Boolector and Z3 use for most bit-vector problems.
 */
import { eq, type Term } from '../logic/term';

export interface ClauseSink {
  newVar(): number;
  addClause(lits: number[]): void;
  /** The literal that is always true. */
  readonly T: number;
}

export class BitBlaster {
  private memo = new Map<Term, number[]>();
  private gates = new Map<string, number>();
  /** Leaves (variables, applications, array reads) and their bits, for models and for Ackermann constraints. */
  leaves = new Map<Term, number[]>();
  constructor(private s: ClauseSink, private atom: (t: Term) => number) {}

  private get T() {
    return this.s.T;
  }
  private get F() {
    return -this.s.T;
  }

  and(a: number, b: number): number {
    if (a === this.F || b === this.F || a === -b) return this.F;
    if (a === this.T) return b;
    if (b === this.T || a === b) return a;
    const k = a < b ? `&${a},${b}` : `&${b},${a}`;
    let x = this.gates.get(k);
    if (x === undefined) {
      x = this.s.newVar();
      this.s.addClause([-x, a]);
      this.s.addClause([-x, b]);
      this.s.addClause([x, -a, -b]);
      this.gates.set(k, x);
    }
    return x;
  }
  or(a: number, b: number): number {
    return -this.and(-a, -b);
  }
  xor(a: number, b: number): number {
    if (a === this.F) return b;
    if (b === this.F) return a;
    if (a === this.T) return -b;
    if (b === this.T) return -a;
    if (a === b) return this.F;
    if (a === -b) return this.T;
    const k = a < b ? `^${a},${b}` : `^${b},${a}`;
    let x = this.gates.get(k);
    if (x === undefined) {
      x = this.s.newVar();
      this.s.addClause([-x, a, b]);
      this.s.addClause([-x, -a, -b]);
      this.s.addClause([x, -a, b]);
      this.s.addClause([x, a, -b]);
      this.gates.set(k, x);
    }
    return x;
  }
  mux(c: number, a: number, b: number): number {
    if (c === this.T || a === b) return a;
    if (c === this.F) return b;
    return this.or(this.and(c, a), this.and(-c, b));
  }
  andAll(xs: number[]): number {
    return xs.reduce((acc, x) => this.and(acc, x), this.T);
  }
  orAll(xs: number[]): number {
    return xs.reduce((acc, x) => this.or(acc, x), this.F);
  }

  /** a + b + cin: [sum bits, carry out]. */
  adder(a: number[], b: number[], cin: number): [number[], number] {
    const out: number[] = [];
    let c = cin;
    for (let i = 0; i < a.length; i++) {
      const t = this.xor(a[i]!, b[i]!);
      out.push(this.xor(t, c));
      c = this.or(this.and(a[i]!, b[i]!), this.and(t, c));
    }
    return [out, c];
  }

  /** Unsigned a < b (or ≤ when orEqual). */
  ult(a: number[], b: number[], orEqual = false): number {
    let r = orEqual ? this.T : this.F;
    for (let i = 0; i < a.length; i++) {
      // From the least significant bit up: r = (¬aᵢ ∧ bᵢ) ∨ (aᵢ ⟺ bᵢ) ∧ r
      r = this.or(this.and(-a[i]!, b[i]!), this.and(-this.xor(a[i]!, b[i]!), r));
    }
    return r;
  }

  eqBits(a: number[], b: number[]): number {
    return this.andAll(a.map((x, i) => -this.xor(x, b[i]!)));
  }

  mulBits(a: number[], b: number[]): number[] {
    const n = a.length;
    let acc = Array<number>(n).fill(this.F);
    for (let i = 0; i < n; i++) {
      const partial = Array.from({ length: n }, (_, j) => (j < i ? this.F : this.and(a[j - i]!, b[i]!)));
      acc = this.adder(acc, partial, this.F)[0];
    }
    return acc;
  }

  private shift(a: number[], amount: number[], dir: 'l' | 'r', fill: number): number[] {
    const n = a.length;
    let cur = a;
    for (let k = 0; k < amount.length; k++) {
      const by = 2 ** k;
      if (by >= n) {
        // Shifting by ≥ n gives all fill bits.
        cur = cur.map((x) => this.mux(amount[k]!, fill, x));
        continue;
      }
      cur = cur.map((x, i) => {
        const src = dir === 'l' ? i - by : i + by;
        const shifted = src >= 0 && src < n ? cur[src]! : fill;
        return this.mux(amount[k]!, shifted, x);
      });
    }
    return cur;
  }

  /** Unsigned division by specification: fresh q, r with b ≠ 0 ⟹ a = q·b + r ∧ r < b (no overflow), b = 0 ⟹ q = 1…1, r = a. */
  private udivrem(a: number[], b: number[]): [number[], number[]] {
    const n = a.length;
    const q = Array.from({ length: n }, () => this.s.newVar());
    const r = Array.from({ length: n }, () => this.s.newVar());
    // Work in 2n bits so that q·b + r cannot overflow silently.
    const ext = (x: number[]) => [...x, ...Array<number>(n).fill(this.F)];
    const prod = this.mulBits(ext(q), ext(b));
    const [sum] = this.adder(prod, ext(r), this.F);
    const bz = this.andAll(b.map((x) => -x));
    const ok = this.and(this.eqBits(sum, ext(a)), this.ult(r, b));
    this.s.addClause([bz, ok]);
    this.s.addClause([-bz, this.andAll(q)]);
    this.s.addClause([-bz, this.eqBits(r, a)]);
    return [q, r];
  }

  private negBits(a: number[]): number[] {
    return this.adder(a.map((x) => -x), a.map(() => this.F), this.T)[0];
  }

  blast(t: Term): number[] {
    const m = this.memo.get(t);
    if (m) return m;
    const r = this.blastNew(t);
    this.memo.set(t, r);
    return r;
  }

  private blastNew(t: Term): number[] {
    const w = t.sort.k === 'bv' ? t.sort.w : 1;
    const A = () => this.blast(t.args[0]!);
    const B = () => this.blast(t.args[1]!);
    switch (t.op) {
      case 'bvnum':
        return Array.from({ length: w }, (_, i) => ((t.value! >> BigInt(i)) & 1n ? this.T : this.F));
      case 'ite': {
        const c = this.atom(t.args[0]!);
        const a = this.blast(t.args[1]!);
        const b = this.blast(t.args[2]!);
        return a.map((x, i) => this.mux(c, x, b[i]!));
      }
      case 'bvadd':
        return this.adder(A(), B(), this.F)[0];
      case 'bvsub':
        return this.adder(A(), B().map((x) => -x), this.T)[0];
      case 'bvneg':
        return this.negBits(A());
      case 'bvmul':
        return this.mulBits(A(), B());
      case 'bvudiv':
        return this.udivrem(A(), B())[0];
      case 'bvurem':
        return this.udivrem(A(), B())[1];
      case 'bvsdiv':
      case 'bvsrem': {
        const a = A();
        const b = B();
        const sa = a[w - 1]!;
        const sb = b[w - 1]!;
        const absA = this.negIf(sa, a);
        const absB = this.negIf(sb, b);
        const [q, r] = this.udivrem(absA, absB);
        return t.op === 'bvsdiv' ? this.negIf(this.xor(sa, sb), q) : this.negIf(sa, r);
      }
      case 'bvand':
        return A().map((x, i) => this.and(x, B()[i]!));
      case 'bvor':
        return A().map((x, i) => this.or(x, B()[i]!));
      case 'bvxor':
        return A().map((x, i) => this.xor(x, B()[i]!));
      case 'bvnot':
        return A().map((x) => -x);
      case 'bvshl':
        return this.shift(A(), B(), 'l', this.F);
      case 'bvlshr':
        return this.shift(A(), B(), 'r', this.F);
      case 'bvashr': {
        const a = A();
        return this.shift(a, B(), 'r', a[w - 1]!);
      }
      case 'concat':
        return [...B(), ...A()];
      case 'extract': {
        const [hi, lo] = t.params as [number, number];
        return A().slice(lo, hi + 1);
      }
      case 'zext':
        return [...A(), ...Array<number>(t.params![0]!).fill(this.F)];
      case 'sext': {
        const a = A();
        return [...a, ...Array<number>(t.params![0]!).fill(a[a.length - 1]!)];
      }
      default: {
        // A leaf: variable, uninterpreted application, array read.
        const bits = Array.from({ length: w }, () => this.s.newVar());
        this.leaves.set(t, bits);
        return bits;
      }
    }
  }

  private negIf(c: number, a: number[]): number[] {
    const n = this.negBits(a);
    return a.map((x, i) => this.mux(c, n[i]!, x));
  }

  /** A Boolean bit-vector predicate as one literal. */
  predicate(t: Term): number {
    const a = this.blast(t.args[0]!);
    const b = this.blast(t.args[1]!);
    const w = a.length;
    switch (t.op) {
      case 'eq':
        return this.eqBits(a, b);
      case 'bvult':
        return this.ult(a, b);
      case 'bvule':
        return this.ult(a, b, true);
      case 'bvslt':
      case 'bvsle': {
        // Flip the sign bits and compare unsigned.
        const fa = [...a.slice(0, w - 1), -a[w - 1]!];
        const fb = [...b.slice(0, w - 1), -b[w - 1]!];
        return this.ult(fa, fb, t.op === 'bvsle');
      }
      default:
        throw new Error(`not a bit-vector predicate: ${t.op}`);
    }
  }

  /** Ackermann's reduction for uninterpreted functions over bit-vectors: equal arguments give equal results. */
  ackermann(): void {
    const byName = new Map<string, Term[]>();
    for (const t of this.leaves.keys()) {
      if (t.op !== 'app' && t.op !== 'select') continue;
      const k = t.op === 'app' ? `app:${t.name}` : `select:${t.args[0]!.id}`;
      (byName.get(k) ?? byName.set(k, []).get(k)!).push(t);
    }
    for (const ts of byName.values()) {
      for (let i = 0; i < ts.length; i++) {
        for (let j = i + 1; j < ts.length; j++) {
          const a = ts[i]!;
          const b = ts[j]!;
          const argsEq = this.andAll(a.args.slice(a.op === 'select' ? 1 : 0).map((x, k) => this.eqArg(x, b.args[k + (a.op === 'select' ? 1 : 0)]!)));
          this.s.addClause([-argsEq, this.eqBits(this.blast(a), this.blast(b))]);
        }
      }
    }
  }

  private eqArg(x: Term, y: Term): number {
    if (x.sort.k === 'bv') return this.eqBits(this.blast(x), this.blast(y));
    if (x === y) return this.T;
    return this.atom(eq(x, y));
  }

  /** The value of a blasted term in a SAT model. */
  value(t: Term, model: readonly boolean[]): bigint {
    const bits = this.memo.get(t);
    if (!bits) return 0n;
    let v = 0n;
    bits.forEach((b, i) => {
      const val = b === this.T ? true : b === this.F ? false : b > 0 ? model[b] === true : model[-b] !== true;
      if (val) v |= 1n << BigInt(i);
    });
    return v;
  }
}
