// Indices of partial recursive functions, and diagonalization (chapter "Computability Theory",
// sections "Coding Computations", "The Universal Partial Computable Function", "No Universal
// Computable Function", "The Halting Problem"; and "Non-Primitive Recursive Functions").
//
// THE CODING (this edition's convention). The book codes notations with sequence codes,
//   #(zero) = ⟨0⟩, #(succ) = ⟨1⟩, #(P^n_i) = ⟨2, n, i⟩, #(Comp[H, G₀, …]) = ⟨3, k, l, #H, #G₀, …⟩,
//   #(Rec[G, H]) = ⟨4, l, #G, #H⟩,
// which leaves almost every number unused and makes the codes of even tiny definitions
// astronomically large. To be able to *list* definitions, this edition uses a bijective coding
// with the same idea and the same order of the constructors, built on the book's pairing function
// J(x, y) = ½(x + y)(x + y + 1) + x (with inverses K, L), plus a case for minimization:
//
//   #zero            = 0
//   #succ            = 1
//   #P^n_i           = 2 + 4·J(i, n − 1 − i)                 (0 ≤ i < n)
//   #Comp(f, g⃗)      = 3 + 4·J(#f, list(#g₀, …, #g_{k−1}))    (k ≥ 1)
//   #Rec(f, g)       = 4 + 4·J(#f, #g)
//   #Min(f)          = 5 + 4·#f
//   list(a)          = J(a, 0),   list(a, b⃗) = J(a, list(b⃗) + 1)   (nonempty lists)
//
// Every natural number is the index of exactly one definition *tree*, and every tree has exactly
// one index. Trees that are not well formed (wrong numbers of arguments, e.g. Rec(zero, zero))
// are "not a function"; so are well-formed definitions of the wrong arity when a unary function is
// wanted. Named definitions are transparent: #R.def(name, tex, body) = #body. The basic functions
// add, mult and χ_= of the representability chapter are not part of this language.
//
// φₑ(x) is the unary partial function with index e. It is computed by running the definition
// with a budget of function calls ("fuel"). Running out of fuel is NOT evidence that φₑ(x) is
// undefined: whether it is defined is exactly the halting problem.

import { arity, evaluate, R, type RF } from '../recursive/rf.ts';
import { J, unpair } from './beta.ts';

// ------------------------------------------------------------------ coding

function listCode(xs: bigint[]): bigint {
  if (xs.length === 0) throw new RangeError('lists in the coding are nonempty');
  let c = J(xs[xs.length - 1], 0n);
  for (let i = xs.length - 2; i >= 0; i--) c = J(xs[i], c + 1n);
  return c;
}

function listDecode(c: bigint): bigint[] {
  const out: bigint[] = [];
  for (;;) {
    const { x, y } = unpair(c);
    out.push(x);
    if (y === 0n) return out;
    c = y - 1n;
  }
}

/** The index of a definition. Throws for the representability chapter's basic functions and for an empty composition. */
export function indexOf(f: RF): bigint {
  switch (f.k) {
    case 'zero':
      return 0n;
    case 'succ':
      return 1n;
    case 'proj':
      if (!(Number.isInteger(f.n) && Number.isInteger(f.i) && f.i >= 0 && f.i < f.n)) throw new RangeError(`P^${f.n}_${f.i} is not a projection (need 0 ≤ i < n)`);
      return 2n + 4n * J(BigInt(f.i), BigInt(f.n - 1 - f.i));
    case 'comp':
      return 3n + 4n * J(indexOf(f.f), listCode(f.gs.map(indexOf)));
    case 'rec':
      return 4n + 4n * J(indexOf(f.f), indexOf(f.g));
    case 'min':
      return 5n + 4n * indexOf(f.f);
    case 'def':
      return indexOf(f.body);
    case 'basic':
      throw new RangeError(`the basic function ${f.name} has no index: indices code definitions from zero, succ and projections`);
  }
}

/** The definition tree with index e (always exists; it may not be well formed). Fresh ids. */
export function termOf(e: bigint): RF {
  if (e < 0n) throw new RangeError('indices are natural numbers');
  if (e === 0n) return R.zero();
  if (e === 1n) return R.succ();
  const tag = (e - 2n) % 4n;
  const p = (e - 2n) / 4n;
  switch (tag) {
    case 0n: {
      const { x: i, y: rest } = unpair(p);
      const n = i + rest + 1n;
      if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('projection too large');
      return R.proj(Number(n), Number(i));
    }
    case 1n: {
      const { x: f, y: l } = unpair(p);
      return R.comp(termOf(f), listDecode(l).map(termOf));
    }
    case 2n: {
      const { x: f, y: g } = unpair(p);
      return R.rec(termOf(f), termOf(g));
    }
    default:
      return R.min(termOf(p));
  }
}

export type Decoded = { ok: true; rf: RF; arity: number } | { ok: false; rf?: RF; errors: string[] };

/** The definition with index e and its arity, or why it is not well formed. */
export function decodeIndex(e: bigint): Decoded {
  let rf: RF;
  try {
    rf = termOf(e);
  } catch (err) {
    if (err instanceof RangeError) return { ok: false, errors: [err.message] };
    throw err;
  }
  const a = arity(rf);
  if (a.ok) return { ok: true, rf, arity: a.arity };
  return { ok: false, rf, errors: a.errors.map((x) => x.message) };
}

/** A definition with named definitions unfolded (fresh ids). */
export function stripDefs(f: RF): RF {
  switch (f.k) {
    case 'zero':
      return R.zero();
    case 'succ':
      return R.succ();
    case 'proj':
      return R.proj(f.n, f.i);
    case 'basic':
      return R.basic(f.name);
    case 'comp':
      return R.comp(stripDefs(f.f), f.gs.map(stripDefs));
    case 'rec':
      return R.rec(stripDefs(f.f), stripDefs(f.g));
    case 'min':
      return R.min(stripDefs(f.f));
    case 'def':
      return stripDefs(f.body);
  }
}

/** Same definition, ignoring ids and names of definitions. */
export function sameDefinition(a: RF, b: RF): boolean {
  while (a.k === 'def') a = a.body;
  while (b.k === 'def') b = b.body;
  if (a.k !== b.k) return false;
  switch (a.k) {
    case 'zero':
    case 'succ':
      return true;
    case 'proj':
      return b.k === 'proj' && a.n === b.n && a.i === b.i;
    case 'basic':
      return b.k === 'basic' && a.name === b.name;
    case 'comp':
      return b.k === 'comp' && sameDefinition(a.f, b.f) && a.gs.length === b.gs.length && a.gs.every((g, i) => sameDefinition(g, b.gs[i]));
    case 'rec':
      return b.k === 'rec' && sameDefinition(a.f, b.f) && sameDefinition(a.g, b.g);
    case 'min':
      return b.k === 'min' && sameDefinition(a.f, b.f);
  }
}

/** A compact plain-text form: zero, succ, P^n_i, Comp(f; g, …), Rec(f, g), Min(f). */
export function showDefinition(f: RF): string {
  switch (f.k) {
    case 'zero':
      return 'zero';
    case 'succ':
      return 'succ';
    case 'proj':
      return `P^${f.n}_${f.i}`;
    case 'basic':
      return f.name;
    case 'comp':
      return `Comp(${showDefinition(f.f)}; ${f.gs.map(showDefinition).join(', ')})`;
    case 'rec':
      return `Rec(${showDefinition(f.f)}, ${showDefinition(f.g)})`;
    case 'min':
      return `Min(${showDefinition(f.f)})`;
    case 'def':
      return f.name;
  }
}

export interface UnaryDefinition {
  e: bigint;
  rf: RF;
}

/** The well-formed unary definitions with index ≤ maxIndex, in index order (at most `count`). */
export function enumerateUnary(opt: { maxIndex?: bigint; count?: number; from?: bigint } = {}): UnaryDefinition[] {
  const maxIndex = opt.maxIndex ?? 10_000n;
  const count = opt.count ?? Infinity;
  const out: UnaryDefinition[] = [];
  for (let e = opt.from ?? 0n; e <= maxIndex && out.length < count; e++) {
    const d = decodeIndex(e);
    if (d.ok && d.arity === 1) out.push({ e, rf: d.rf });
  }
  return out;
}

// ------------------------------------------------------------------ φₑ(x)

export type PhiOutcome =
  | { kind: 'value'; value: bigint; calls: number }
  /** no value within the budget: φₑ(x) may be undefined, or defined but need more steps */
  | { kind: 'outOfFuel'; calls: number }
  /** e does not index a unary partial recursive function */
  | { kind: 'notAFunction'; reason: string };

/** Runs a unary definition on x with a budget of `fuel` function calls. */
export function runUnary(rf: RF, x: bigint, fuel: number): PhiOutcome {
  const a = arity(rf);
  if (!a.ok) return { kind: 'notAFunction', reason: a.errors.map((er) => er.message).join('; ') };
  if (a.arity !== 1) return { kind: 'notAFunction', reason: `the definition takes ${a.arity} argument${a.arity === 1 ? '' : 's'}, not 1` };
  const r = evaluate(rf, [x], { fuel, maxTraceDepth: -1 });
  if (r.status === 'ok' && r.value !== undefined) return { kind: 'value', value: r.value, calls: r.calls };
  return { kind: 'outOfFuel', calls: r.calls };
}

/** φₑ(x), computed with at most `fuel` function calls. */
export function phi(e: bigint, x: bigint, fuel = 10_000): PhiOutcome {
  const d = decodeIndex(e);
  if (!d.ok) return { kind: 'notAFunction', reason: d.errors.join('; ') };
  return runUnary(d.rf, x, fuel);
}

export type HaltsWithin =
  | { halts: true; value: bigint; calls: number }
  | { halts: false; reason: 'out-of-fuel'; calls: number }
  | { halts: false; reason: 'not-a-function'; detail: string };

/**
 * Does the computation of φₑ(x) halt within `fuel` calls? Unlike the halting function h(e, x),
 * this bounded question is decidable (it is the analogue of ∃s ≤ fuel T(e, x, s)). `halts: false`
 * with reason 'out-of-fuel' does not mean the computation never halts.
 */
export function haltsWithin(e: bigint, x: bigint, fuel: number): HaltsWithin {
  const o = phi(e, x, fuel);
  if (o.kind === 'value') return { halts: true, value: o.value, calls: o.calls };
  if (o.kind === 'outOfFuel') return { halts: false, reason: 'out-of-fuel', calls: o.calls };
  return { halts: false, reason: 'not-a-function', detail: o.reason };
}

// ------------------------------------------------------------------ diagonalization

export interface TableRow {
  /** the index of this row's function */
  e: bigint;
  rf: RF;
  /** φₑ(0), φₑ(1), … */
  cells: PhiOutcome[];
}

export interface DiagonalTableOptions {
  /** 'indices' (default): row r is φ_r. 'unary': row r is the r-th well-formed unary definition. */
  rows?: 'indices' | 'unary';
  /** bound on indices searched for unary definitions (default 100 000) */
  maxIndex?: bigint;
}

/** The values φₑ(x) for `rows` functions and x < `cols`, each with budget `fuel`. */
export function diagonalTable(rows: number, cols: number, fuel: number, opt: DiagonalTableOptions = {}): TableRow[] {
  const defs: UnaryDefinition[] =
    opt.rows === 'unary'
      ? enumerateUnary({ count: rows, maxIndex: opt.maxIndex ?? 100_000n })
      : Array.from({ length: rows }, (_, r) => ({ e: BigInt(r), rf: termOf(BigInt(r)) })); // small indices always decode
  return defs.map(({ e, rf }) => ({ e, rf, cells: Array.from({ length: cols }, (_, x) => runUnary(rf, BigInt(x), fuel)) }));
}

export interface DiagonalEntry {
  /** row number r = the argument x of the diagonal function */
  x: number;
  /** the index of row x */
  e: bigint;
  /** the diagonal entry: row x at argument x */
  diag: PhiOutcome;
  /**
   * d(x) = (row x)(x) + 1: a number when the diagonal entry was computed; 'unknown' when it ran
   * out of fuel (the entry may be undefined, or just need more steps); for rows that are not
   * functions, 1 under the book's convention that such rows are the constant-0 function, or
   * 'n/a' when such rows are excluded.
   */
  d: bigint | 'unknown' | 'n/a';
  /** does d differ from row x at x? true when certain, 'unknown' when not known */
  differs: true | 'unknown' | 'n/a';
  /** did every cell of the row get a value within the budget? */
  rowFullyComputed: boolean;
}

export interface DiagonalizeOptions extends DiagonalTableOptions {
  /**
   * How rows that are not unary functions count. 'constantZero' (default) follows the book's
   * enumeration in "Non-Primitive Recursive Functions" (fᵢ is the constant 0 function when i is
   * not a notation); 'excluded' leaves them out of the argument.
   */
  nonFunctionRows?: 'constantZero' | 'excluded';
}

/**
 * The diagonal argument: d(x) = f_x(x) + 1 differs from every row f_x at the argument x. With a
 * total universal function Un′ this would give a total computable function not on the list (the
 * theorem "no universal computable function"). Here the rows are partial and only computed with
 * a budget, so entries that ran out of fuel are reported as 'unknown', never as 'undefined'.
 */
export function diagonalize(n: number, cols: number, fuel: number, opt: DiagonalizeOptions = {}): { table: TableRow[]; diagonal: DiagonalEntry[] } {
  const table = diagonalTable(n, Math.max(cols, n), fuel, opt);
  const convention = opt.nonFunctionRows ?? 'constantZero';
  const diagonal = table.map((row, x): DiagonalEntry => {
    const diag = row.cells[x];
    const rowFullyComputed = row.cells.every((c) => c.kind === 'value');
    if (diag.kind === 'value') return { x, e: row.e, diag, d: diag.value + 1n, differs: true, rowFullyComputed };
    if (diag.kind === 'outOfFuel') return { x, e: row.e, diag, d: 'unknown', differs: 'unknown', rowFullyComputed };
    return convention === 'constantZero'
      ? { x, e: row.e, diag, d: 1n, differs: true, rowFullyComputed }
      : { x, e: row.e, diag, d: 'n/a', differs: 'n/a', rowFullyComputed };
  });
  return { table, diagonal };
}
