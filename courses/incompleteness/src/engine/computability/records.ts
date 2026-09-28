// Computation records, Kleene's T and U, and the normal form φₑ(x) ≃ U(μs T(e, x, s)) (chapter
// "Computability Theory", sections "Coding Computations", "The Normal Form Theorem", "The
// Universal Partial Computable Function").
//
// The book proves the normal form theorem only in outline: *some* coding of computations makes
// T primitive recursive and U primitive recursive. This module is one such coding, THIS
// EDITION'S, built on the index coding of indices.ts (itself this edition's, not the book's).
//
// A computation record is a tree. Its root records one call of a definition on some arguments:
//
//   node = ⟨e, args, value, children⟩,   coded as  J(e, J(seq(args), J(value, seq(children))))
//   seq() = 0,   seq(a, b⃗) = 1 + J(a, seq(b⃗))        (a bijection between ℕ and finite lists)
//
// where e is the index of the (sub)definition called, and the children are the records of the
// calls the rule for that definition makes, in order:
//
//   zero, succ, P^n_i   no children
//   Comp(f; g₀…g_{k−1}) the calls g₀(x⃗), …, g_{k−1}(x⃗), then f(y₀, …, y_{k−1})
//   Rec(f, g) at x⃗, y   f(x⃗), then g(x⃗, 0, h₀), …, g(x⃗, y − 1, h_{y−1})
//   Min(f) at z⃗         f(0, z⃗), f(1, z⃗), …, f(m, z⃗): all nonzero except the last, which is 0
//
// Every natural number decodes to a tree of this shape (the coding is bijective), so T(e, x, s)
// says: the tree coded by s is a correct record of the call of definition e on the argument x.
// Checking it only ever looks at numbers ≤ s, which is why T is decidable (with more work, it is
// primitive recursive, as the book asserts). U(s) = K(L(L(s))) reads off the value at the root.
//
// Computation is deterministic, so for given e and x at most one s satisfies T(e, x, s): the
// search μs T(e, x, s) has only one possible answer. The codes are astronomically large for all
// but the smallest computations (each level of nesting roughly squares the number), so this
// module estimates sizes and computes codes exactly only when they are small enough.

import { decodeIndex } from './indices.ts';
import { J, unpair } from './beta.ts';

// ------------------------------------------------------------------ shapes of indices

/** The top constructor of the definition with index e and the indices of its parts (as in indices.ts). */
export type Shape =
  | { k: 'zero' }
  | { k: 'succ' }
  | { k: 'proj'; n: number; i: number }
  | { k: 'comp'; f: bigint; gs: bigint[] }
  | { k: 'rec'; f: bigint; g: bigint }
  | { k: 'min'; f: bigint };

function nonemptyListDecode(c: bigint): bigint[] {
  const out: bigint[] = [];
  for (;;) {
    const { x, y } = unpair(c);
    out.push(x);
    if (y === 0n) return out;
    c = y - 1n;
  }
}

/** Decodes only the top of index e (the arithmetic of indices.ts: 2 + 4·J(…), 3 + 4·J(…), …). */
export function shapeOf(e: bigint): Shape {
  if (e < 0n) throw new RangeError('indices are natural numbers');
  if (e === 0n) return { k: 'zero' };
  if (e === 1n) return { k: 'succ' };
  const tag = (e - 2n) % 4n;
  const p = (e - 2n) / 4n;
  if (tag === 0n) {
    const { x: i, y: rest } = unpair(p);
    const n = i + rest + 1n;
    if (n > 1_000_000n) throw new RangeError('projection too large');
    return { k: 'proj', n: Number(n), i: Number(i) };
  }
  if (tag === 1n) {
    const { x: f, y: l } = unpair(p);
    return { k: 'comp', f, gs: nonemptyListDecode(l) };
  }
  if (tag === 2n) {
    const { x: f, y: g } = unpair(p);
    return { k: 'rec', f, g };
  }
  return { k: 'min', f: p };
}

// ------------------------------------------------------------------ records

export type RecordRule = Shape['k'];

export interface RecordNode {
  /** index of the (sub)definition called */
  e: bigint;
  rule: RecordRule;
  args: bigint[];
  value: bigint;
  children: RecordNode[];
}

export type RunRecord =
  | { kind: 'halted'; root: RecordNode; nodes: number }
  /** the budget of `fuel` calls ran out: φₑ(x) may be undefined, or need more steps */
  | { kind: 'outOfFuel'; nodes: number }
  | { kind: 'notAFunction'; reason: string };

class OutOfFuel extends Error {}

/**
 * Runs the definition with index e on `args` directly from the index (decoding each part as it
 * is called, as the universal function does), recording every call. At most `fuel` calls.
 */
export function recordFromIndex(e: bigint, args: bigint[], fuel = 20_000): RunRecord {
  const d = decodeIndex(e);
  if (!d.ok) return { kind: 'notAFunction', reason: d.errors.join('; ') };
  if (d.arity !== args.length) return { kind: 'notAFunction', reason: `the definition takes ${d.arity} argument${d.arity === 1 ? '' : 's'}, not ${args.length}` };
  const shapes = new Map<bigint, Shape>();
  const shape = (i: bigint) => {
    let s = shapes.get(i);
    if (!s) shapes.set(i, (s = shapeOf(i)));
    return s;
  };
  let nodes = 0;
  const call = (i: bigint, xs: bigint[]): RecordNode => {
    if (++nodes > fuel) throw new OutOfFuel();
    const s = shape(i);
    const node: RecordNode = { e: i, rule: s.k, args: xs, value: 0n, children: [] };
    switch (s.k) {
      case 'zero':
        node.value = 0n;
        break;
      case 'succ':
        node.value = xs[0] + 1n;
        break;
      case 'proj':
        node.value = xs[s.i];
        break;
      case 'comp': {
        const inner = s.gs.map((g) => call(g, xs));
        node.children.push(...inner);
        const outer = call(s.f, inner.map((c) => c.value));
        node.children.push(outer);
        node.value = outer.value;
        break;
      }
      case 'rec': {
        const xv = xs.slice(0, -1);
        const y = xs[xs.length - 1];
        let prev = call(s.f, xv);
        node.children.push(prev);
        for (let j = 0n; j < y; j++) {
          prev = call(s.g, [...xv, j, prev.value]);
          node.children.push(prev);
        }
        node.value = prev.value;
        break;
      }
      case 'min': {
        for (let x = 0n; ; x++) {
          const t = call(s.f, [x, ...xs]);
          node.children.push(t);
          if (t.value === 0n) {
            node.value = x;
            break;
          }
        }
        break;
      }
    }
    return node;
  };
  try {
    const root = call(e, args);
    return { kind: 'halted', root, nodes };
  } catch (err) {
    if (err instanceof OutOfFuel) return { kind: 'outOfFuel', nodes: fuel };
    throw err;
  }
}

/** The record of the computation of φₑ(x), with at most `fuel` calls. */
export function computationRecord(e: bigint, x: bigint, fuel = 20_000): RunRecord {
  return recordFromIndex(e, [x], fuel);
}

/** The nodes of a record in the order the calls start (pre-order), with depth and path. */
export function flattenRecord(root: RecordNode): { node: RecordNode; depth: number; path: number[] }[] {
  const out: { node: RecordNode; depth: number; path: number[] }[] = [];
  const go = (n: RecordNode, depth: number, path: number[]) => {
    out.push({ node: n, depth, path });
    n.children.forEach((c, i) => go(c, depth + 1, [...path, i]));
  };
  go(root, 0, []);
  return out;
}

export function countNodes(root: RecordNode): number {
  let c = 1;
  for (const ch of root.children) c += countNodes(ch);
  return c;
}

// ------------------------------------------------------------------ coding of records

/** seq() = 0, seq(a, b⃗) = 1 + J(a, seq(b⃗)). */
export function seqCode(xs: readonly bigint[]): bigint {
  let c = 0n;
  for (let i = xs.length - 1; i >= 0; i--) c = 1n + J(xs[i], c);
  return c;
}

export function seqDecode(c: bigint, max = 100_000): bigint[] {
  const out: bigint[] = [];
  while (c > 0n) {
    if (out.length >= max) throw new RangeError('list too long');
    const { x, y } = unpair(c - 1n);
    out.push(x);
    c = y;
  }
  return out;
}

/** log₂ of the number of bits of n (at least 0). */
function log2Bits(n: bigint): number {
  if (n <= 1n) return 0;
  const hex = n.toString(16);
  const bits = (hex.length - 1) * 4 + Math.floor(Math.log2(parseInt(hex[0], 16))) + 1;
  return Math.log2(bits);
}

// J(a, b) has about twice as many bits as the larger of a and b.
const jSize = (a: number, b: number) => Math.max(a, b, 0) + 1;

function seqSize(sizes: number[]): number {
  let c = 0;
  for (let i = sizes.length - 1; i >= 0; i--) c = jSize(sizes[i], c);
  return c;
}

/**
 * An estimate of the size of the code of a record, as log₂ of its number of bits (so the code
 * has roughly 2^size bits). Exact codes are computed only for small sizes.
 */
export function recordCodeSize(n: RecordNode): number {
  const args = seqSize(n.args.map(log2Bits));
  const children = seqSize(n.children.map(recordCodeSize));
  return jSize(log2Bits(n.e), jSize(args, jSize(log2Bits(n.value), children)));
}

/** A description of a size estimate, e.g. "about 1 200 digits" or "about 10^(3.1·10^14) digits". */
export function describeCodeSize(log2BitsEstimate: number): { digits: number | null; text: string } {
  const log10digits = log2BitsEstimate * Math.LOG10E * Math.LN2 + Math.log10(Math.LOG10E * Math.LN2);
  if (log10digits < 15) {
    const d = Math.max(1, Math.round(10 ** log10digits));
    return { digits: d, text: `about ${d.toLocaleString('en-US')} digit${d === 1 ? '' : 's'}` };
  }
  if (log10digits < 1e15) return { digits: null, text: `about 10^${Math.round(log10digits).toLocaleString('en-US')} digits` };
  return { digits: null, text: `about 10^(10^${Math.round(Math.log10(log10digits))}) digits` };
}

/** Default bound for exact codes: 2^17 bits (about 40 000 digits). */
export const MAX_EXACT_LOG2_BITS = 17;

/** The code s of a record, or null if it would be larger than 2^maxLog2Bits bits. */
export function encodeRecord(n: RecordNode, maxLog2Bits = MAX_EXACT_LOG2_BITS): bigint | null {
  if (recordCodeSize(n) > maxLog2Bits + 1) return null;
  const go = (m: RecordNode): bigint => J(m.e, J(seqCode(m.args), J(m.value, seqCode(m.children.map(go)))));
  return go(n);
}

/** A record as decoded from a number: the same shape, with no rule attached yet. */
export interface DecodedRecord {
  e: bigint;
  args: bigint[];
  value: bigint;
  children: DecodedRecord[];
}

/** The tree coded by s (every number codes one). Throws a RangeError beyond `maxNodes` nodes. */
export function decodeRecord(s: bigint, maxNodes = 20_000): DecodedRecord {
  let count = 0;
  const go = (c: bigint): DecodedRecord => {
    if (++count > maxNodes) throw new RangeError(`more than ${maxNodes} nodes`);
    const { x: e, y: r1 } = unpair(c);
    const { x: a, y: r2 } = unpair(r1);
    const { x: value, y: ch } = unpair(r2);
    return { e, args: seqDecode(a), value, children: seqDecode(ch).map(go) };
  };
  return go(s);
}

/** U(s): the value recorded at the root, K(L(L(s))). Total, and computed from s alone. */
export function U(s: bigint): bigint {
  return unpair(unpair(unpair(s).y).y).x;
}

// ------------------------------------------------------------------ T

export interface TCheck {
  /** position of the node in the tree: child indices from the root */
  path: number[];
  depth: number;
  ok: boolean;
  /** e.g. "succ: value 4 = 3 + 1" */
  what: string;
}

export interface TResult {
  holds: boolean;
  /** one entry per node checked (a node counts once its calls have been checked); checking stops at the first failure */
  checks: TCheck[];
  failure?: TCheck;
}

const same = (a: readonly bigint[], b: readonly bigint[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const tup = (xs: readonly bigint[]) => `(${xs.join(', ')})`;

/**
 * Whether the tree is a correct record of the call of definition e on args: the check behind
 * T(e, x, s). Works on the tree (decoded from s, or built by running, or altered by hand).
 */
export function checkRecord(root: DecodedRecord | RecordNode, e: bigint, args: bigint[], opt: { maxNodes?: number } = {}): TResult {
  const checks: TCheck[] = [];
  const maxNodes = opt.maxNodes ?? 20_000;
  const fail = (path: number[], depth: number, what: string): TResult => {
    const c = { path, depth, ok: false, what };
    checks.push(c);
    return { holds: false, checks, failure: c };
  };
  if (root.e !== e) return fail([], 0, `the root records a call of definition ${root.e}, not of ${e}`);
  if (!same(root.args, args)) return fail([], 0, `the root records a call on ${tup(root.args)}, not on ${tup(args)}`);
  const d = decodeIndex(e);
  if (!d.ok) return fail([], 0, `${e} is not the index of a well-formed definition, so nothing is a record of it`);
  if (d.arity !== args.length) return fail([], 0, `definition ${e} takes ${d.arity} argument${d.arity === 1 ? '' : 's'}, not ${args.length}`);

  // Below the root, every node's index is a part of a well-formed definition with the right
  // number of arguments, because the parent's check fixed both. Each node is checked in two
  // halves: its wiring (which calls it made, on which arguments) before its children, and its
  // value after them — so a wrong value is reported at the lowest call where it appears.
  let failure: TCheck | null = null;
  let visited = 0;
  const visit = (n: DecodedRecord, path: number[], depth: number): boolean => {
    if (++visited > maxNodes) {
      failure = { path, depth, ok: false, what: `stopped after ${maxNodes} nodes` };
      return false;
    }
    const s = shapeOf(n.e);
    const kids = n.children;
    const v = n.value;
    let problem: string | null = null;
    // wiring
    switch (s.k) {
      case 'zero':
      case 'succ':
      case 'proj':
        if (kids.length) problem = `${s.k === 'proj' ? 'a projection' : s.k} makes no calls, but the record lists some`;
        break;
      case 'comp': {
        const k = s.gs.length;
        if (kids.length !== k + 1) {
          problem = `a composition with ${k} inner function${k === 1 ? '' : 's'} makes ${k + 1} calls, but the record lists ${kids.length}`;
          break;
        }
        for (let j = 0; j < k && !problem; j++) {
          if (kids[j].e !== s.gs[j]) problem = `call ${j} should be of the inner function g${j} (index ${s.gs[j]}), not of ${kids[j].e}`;
          else if (!same(kids[j].args, n.args)) problem = `call ${j} should be on ${tup(n.args)}, not on ${tup(kids[j].args)}`;
        }
        if (problem) break;
        const ys = kids.slice(0, k).map((c) => c.value);
        if (kids[k].e !== s.f) problem = `the last call should be of the outer function (index ${s.f}), not of ${kids[k].e}`;
        else if (!same(kids[k].args, ys)) problem = `the outer function should be called on the inner values ${tup(ys)}, not on ${tup(kids[k].args)}`;
        break;
      }
      case 'rec': {
        const xv = n.args.slice(0, -1);
        const y = n.args[n.args.length - 1];
        if (BigInt(kids.length) !== y + 1n) {
          problem = `primitive recursion at y = ${y} makes ${y + 1n} calls, but the record lists ${kids.length}`;
          break;
        }
        if (kids[0].e !== s.f) problem = `the first call should be of the base function (index ${s.f}), not of ${kids[0].e}`;
        else if (!same(kids[0].args, xv)) problem = `the base function should be called on ${tup(xv)}, not on ${tup(kids[0].args)}`;
        for (let j = 1; j < kids.length && !problem; j++) {
          const want = [...xv, BigInt(j - 1), kids[j - 1].value];
          if (kids[j].e !== s.g) problem = `call ${j} should be of the step function (index ${s.g}), not of ${kids[j].e}`;
          else if (!same(kids[j].args, want)) problem = `call ${j} should be on ${tup(want)}, not on ${tup(kids[j].args)}`;
        }
        break;
      }
      case 'min': {
        if (kids.length === 0) {
          problem = 'a search makes at least one call, but the record lists none';
          break;
        }
        for (let j = 0; j < kids.length && !problem; j++) {
          const want = [BigInt(j), ...n.args];
          if (kids[j].e !== s.f) problem = `test ${j} should be a call of the searched function (index ${s.f}), not of ${kids[j].e}`;
          else if (!same(kids[j].args, want)) problem = `test ${j} should be on ${tup(want)}, not on ${tup(kids[j].args)}`;
        }
        break;
      }
    }
    if (problem) {
      failure = { path, depth, ok: false, what: problem };
      return false;
    }
    for (let j = 0; j < kids.length; j++) if (!visit(kids[j], [...path, j], depth + 1)) return false;
    // value
    let what = '';
    switch (s.k) {
      case 'zero':
        if (v !== 0n) problem = `zero${tup(n.args)} is 0, but the record says ${v}`;
        else what = `zero${tup(n.args)} = 0`;
        break;
      case 'succ':
        if (v !== n.args[0] + 1n) problem = `succ(${n.args[0]}) is ${n.args[0] + 1n}, but the record says ${v}`;
        else what = `succ(${n.args[0]}) = ${v}`;
        break;
      case 'proj':
        if (v !== n.args[s.i]) problem = `P^${s.n}_${s.i}${tup(n.args)} is ${n.args[s.i]}, but the record says ${v}`;
        else what = `P^${s.n}_${s.i}${tup(n.args)} = ${v}`;
        break;
      case 'comp': {
        const last = kids[kids.length - 1].value;
        if (v !== last) problem = `the value should be the outer function's value ${last}, not ${v}`;
        else what = `composition: inner values ${tup(kids.slice(0, -1).map((c) => c.value))}, outer value ${v}`;
        break;
      }
      case 'rec': {
        const last = kids[kids.length - 1].value;
        if (v !== last) problem = `the value should be h${tup(n.args)} = ${last}, not ${v}`;
        else what = `primitive recursion: ${kids.length} call${kids.length === 1 ? '' : 's'}, h${tup(n.args)} = ${v}`;
        break;
      }
      case 'min': {
        const m = kids.length - 1;
        const early = kids.findIndex((c, j) => j < m && c.value === 0n);
        if (early >= 0) problem = `test ${early} gave 0, so the search should have stopped there`;
        else if (kids[m].value !== 0n) problem = `the last test gave ${kids[m].value}, not 0, so the search has not ended`;
        else if (v !== BigInt(m)) problem = `the search ended at ${m}, but the record says ${v}`;
        else what = `search: tests 0 … ${m}, the first 0 at ${m}`;
        break;
      }
    }
    if (problem) {
      failure = { path, depth, ok: false, what: problem };
      return false;
    }
    checks.push({ path, depth, ok: true, what });
    return true;
  };
  if (!visit(root, [], 0)) {
    const f = failure as unknown as TCheck;
    checks.push(f);
    return { holds: false, checks, failure: f };
  }
  return { holds: true, checks };
}

/** T(e, x, s): s codes a correct record of the computation of φₑ on x. */
export function T(e: bigint, x: bigint, s: bigint, opt: { maxNodes?: number } = {}): TResult {
  let tree: DecodedRecord;
  try {
    tree = decodeRecord(s, opt.maxNodes ?? 20_000);
  } catch (err) {
    if (err instanceof RangeError) {
      const c = { path: [], depth: 0, ok: false, what: `s decodes to a tree too large to check here (${err.message})` };
      return { holds: false, checks: [c], failure: c };
    }
    throw err;
  }
  return checkRecord(tree, e, [x], opt);
}

// ------------------------------------------------------------------ the normal form

export interface NormalFormSearch {
  /** the least s < limit with T(e, x, s), if one was found */
  found: bigint | null;
  /** how many candidates were tested */
  tested: bigint;
  /** the first few rejected candidates and why */
  rejected: { s: bigint; why: string }[];
  /** how many candidates were rejected already by the first component of s (the index) */
  rejectedByIndex: bigint;
}

/**
 * μs T(e, x, s), searched literally: s = 0, 1, 2, … up to `limit`. Only feasible for the
 * smallest computations, since codes of records grow very fast.
 */
export function searchNormalForm(e: bigint, x: bigint, limit: bigint, sample = 8): NormalFormSearch {
  const rejected: { s: bigint; why: string }[] = [];
  let rejectedByIndex = 0n;
  for (let s = 0n; s < limit; s++) {
    // Fast path of the same check: the first component must be e.
    if (unpair(s).x !== e) {
      rejectedByIndex++;
      if (rejected.length < sample) rejected.push({ s, why: `records a call of definition ${unpair(s).x}, not ${e}` });
      continue;
    }
    const r = T(e, x, s, { maxNodes: 2000 });
    if (r.holds) return { found: s, tested: s + 1n, rejected, rejectedByIndex };
    if (rejected.length < sample) rejected.push({ s, why: r.failure!.what });
  }
  return { found: null, tested: limit, rejected, rejectedByIndex };
}
