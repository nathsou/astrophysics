/**
 * Two adders as propositional circuits, for the miter bench: ripple carry, and two-level carry lookahead (4-bit
 * blocks with their own lookahead, and a second level that computes the carry into each block from the blocks'
 * generate and propagate signals). Optionally with a planted bug: the second-level carry into the top block
 * forgets the term for a carry generated in block 0 and propagated through every block in between, a path that
 * random inputs almost never exercise (bridge: Digital Circuits, chapter 14).
 */
import { fand, forr, fxor, fnot, type Formula } from '$lib/fv/sat/encode';

const T: Formula = { k: 'const', value: true };
const F: Formula = { k: 'const', value: false };
const and = (...xs: Formula[]): Formula => (xs.some((x) => x.k === 'const' && !x.value) ? F : xs.filter((x) => !(x.k === 'const' && x.value)).length === 0 ? T : fand(...xs.filter((x) => !(x.k === 'const' && x.value))));
const or = (...xs: Formula[]): Formula => (xs.some((x) => x.k === 'const' && x.value) ? T : xs.filter((x) => !(x.k === 'const' && !x.value)).length === 0 ? F : forr(...xs.filter((x) => !(x.k === 'const' && !x.value))));
const xor = (a: Formula, b: Formula): Formula => fxor(a, b);

export interface AdderInputs {
  a: Formula[];
  b: Formula[];
}

/** Ripple carry: each column's carry comes from the column below. Returns w sum bits and the carry out. */
export function rippleAdder({ a, b }: AdderInputs): Formula[] {
  let c: Formula = F;
  const out: Formula[] = [];
  for (let i = 0; i < a.length; i++) {
    out.push(xor(xor(a[i]!, b[i]!), c));
    c = or(and(a[i]!, b[i]!), and(a[i]!, c), and(b[i]!, c));
  }
  out.push(c);
  return out;
}

/** Two-level carry lookahead with 4-bit blocks (w a multiple of 4). */
export function lookaheadAdder({ a, b }: AdderInputs, bug = false): Formula[] {
  const w = a.length;
  const g = a.map((x, i) => and(x, b[i]!));
  const p = a.map((x, i) => xor(x, b[i]!));
  const blocks = w / 4;
  // Block generate and propagate.
  const G: Formula[] = [];
  const P: Formula[] = [];
  for (let k = 0; k < blocks; k++) {
    const i = 4 * k;
    G.push(or(g[i + 3]!, and(p[i + 3]!, g[i + 2]!), and(p[i + 3]!, p[i + 2]!, g[i + 1]!), and(p[i + 3]!, p[i + 2]!, p[i + 1]!, g[i]!)));
    P.push(and(p[i]!, p[i + 1]!, p[i + 2]!, p[i + 3]!));
  }
  // Second level: the carry into block k (carry in to the adder is 0).
  const carryInto = (k: number): Formula => {
    const terms: Formula[] = [];
    for (let j = k - 1; j >= 0; j--) {
      if (bug && k === blocks - 1 && j === 0) continue; // the forgotten term
      terms.push(and(...P.slice(j + 1, k), G[j]!));
    }
    return or(...terms);
  };
  const out: Formula[] = [];
  for (let k = 0; k < blocks; k++) {
    const cin = carryInto(k);
    const i = 4 * k;
    // First level: carries inside the block, each as one sum of products.
    const c: Formula[] = [cin];
    for (let j = 0; j < 4; j++) {
      const terms: Formula[] = [g[i + j]!];
      for (let m = j - 1; m >= 0; m--) terms.push(and(...p.slice(i + m + 1, i + j + 1), g[i + m]!));
      terms.push(and(...p.slice(i, i + j + 1), cin));
      c.push(or(...terms));
    }
    for (let j = 0; j < 4; j++) out.push(xor(p[i + j]!, c[j]!));
    if (k === blocks - 1) out.push(c[4]!);
  }
  return out;
}

/** The miter: true exactly when the two circuits disagree on some output. */
export function miter(x: Formula[], y: Formula[]): Formula {
  return or(...x.map((s, i) => fxor(s, y[i]!)));
}

/** Evaluate an adder on concrete inputs (for random testing), by direct simulation of the same structure. */
export function simulate(adder: (inp: AdderInputs) => Formula[], w: number, a: bigint, b: bigint): bigint {
  const bit = (n: bigint, i: number): Formula => ((n >> BigInt(i)) & 1n ? T : F);
  const outs = adder({ a: Array.from({ length: w }, (_, i) => bit(a, i)), b: Array.from({ length: w }, (_, i) => bit(b, i)) });
  return outs.reduce((n, f, i) => (evalConst(f) ? n | (1n << BigInt(i)) : n), 0n);
}

function evalConst(f: Formula): boolean {
  switch (f.k) {
    case 'const':
      return f.value;
    case 'not':
      return !evalConst(f.a);
    case 'and':
      return f.args.every(evalConst);
    case 'or':
      return f.args.some(evalConst);
    case 'xor':
      return evalConst(f.a) !== evalConst(f.b);
    case 'iff':
      return evalConst(f.a) === evalConst(f.b);
    case 'imp':
      return !evalConst(f.a) || evalConst(f.b);
    case 'var':
      throw new Error('not a constant circuit');
  }
}

export { fnot };

/** Fast simulation of the lookahead adder (same logic, on booleans) for millions of random tests. */
export function lookaheadNumeric(w: number, a: boolean[], b: boolean[], bug: boolean): boolean[] {
  const g = a.map((x, i) => x && b[i]!);
  const p = a.map((x, i) => x !== b[i]!);
  const blocks = w / 4;
  const G: boolean[] = [];
  const P: boolean[] = [];
  for (let k = 0; k < blocks; k++) {
    const i = 4 * k;
    G.push(g[i + 3]! || (p[i + 3]! && g[i + 2]!) || (p[i + 3]! && p[i + 2]! && g[i + 1]!) || (p[i + 3]! && p[i + 2]! && p[i + 1]! && g[i]!));
    P.push(p[i]! && p[i + 1]! && p[i + 2]! && p[i + 3]!);
  }
  const out: boolean[] = [];
  for (let k = 0; k < blocks; k++) {
    let cin = false;
    for (let j = k - 1; j >= 0 && !cin; j--) {
      if (bug && k === blocks - 1 && j === 0) continue;
      let t = G[j]!;
      for (let m = j + 1; m < k && t; m++) t = P[m]!;
      cin = t;
    }
    let c = cin;
    for (let j = 0; j < 4; j++) {
      const i = 4 * k + j;
      out.push(p[i]! !== c);
      c = g[i]! || (p[i]! && c);
    }
    if (k === blocks - 1) out.push(c);
  }
  return out;
}

/** The probability that random inputs expose the planted bug: block 0 generates a carry and every block between propagates it. */
export function bugProbability(w: number): number {
  const blocks = w / 4;
  return (120 / 256) * (1 / 16) ** Math.max(0, blocks - 2);
}
