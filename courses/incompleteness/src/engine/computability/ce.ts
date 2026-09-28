// Computably enumerable sets, step by step (sections "Computably Enumerable Sets", "Equivalent
// Definitions of C. E. Sets", "There Are Non-Computable Sets", "Computably Enumerable Sets not
// Closed under Complement"), on this edition's indices (indices.ts) and records (records.ts).
//
// Dovetailing. W_e = {x : φₑ(x)↓} is enumerated in stages: at stage s, every x < s whose
// computation halts within s calls is listed. Each x ∈ W_e appears at some stage; an x that has
// not appeared by stage s may appear later, or never — the enumeration alone never says which.
// The same for K = {e : φₑ(e)↓} and K₀ = {⟨e, x⟩ : φₑ(x)↓}.
//
// "Halts within s calls" is decidable, like T(e, x, s): the enumeration in stages is the book's
// search through pairs ⟨x, s⟩ with T(e, x, s), with a step count in place of the record s.

import { decodeIndex, phi, type PhiOutcome } from './indices.ts';
import { certainlyUndefined } from './divergence.ts';
import { J, unpair } from './beta.ts';
import { computationRecord, encodeRecord, T, U } from './records.ts';

export type Membership =
  /** appeared at `stage`: the computation halted with `value` after `calls` calls */
  | { kind: 'in'; stage: number; value: bigint; calls: number }
  /** not in the set, for a reason these simple tests can certify; `trivial` when e is not even a one-place definition */
  | { kind: 'out'; reason: string; trivial?: boolean }
  /** has not appeared by the last stage computed: may appear later, or never */
  | { kind: 'notYet' };

/** Stage at which x appears when φₑ(x) halts after `calls` calls (stage s lists x < s halting within s calls). */
export const stageOf = (x: number, calls: number) => Math.max(x + 1, calls);

/** Membership of φₑ(x)↓ as seen by stage `maxStage` (with a certificate of divergence when one is easy). */
export function membership(e: bigint, x: bigint, maxStage: number, xStage = Number(x)): Membership {
  const d = decodeIndex(e);
  if (!d.ok) return { kind: 'out', reason: `${e} is not a well-formed definition: no computation of φ_${e} ever halts`, trivial: true };
  if (d.arity !== 1) return { kind: 'out', reason: `${e} defines a ${d.arity}-place function, so φ_${e} (unary) is nowhere defined`, trivial: true };
  const o = phi(e, x, maxStage);
  if (o.kind === 'value') {
    const stage = stageOf(xStage, o.calls);
    if (stage <= maxStage) return { kind: 'in', stage, value: o.value, calls: o.calls };
    return { kind: 'notYet' };
  }
  const why = certainlyUndefined(d.rf, [x]);
  if (why) return { kind: 'out', reason: why };
  return { kind: 'notYet' };
}

export interface Enumeration {
  maxStage: number;
  /** membership of each candidate 0 … maxStage − 1 */
  members: Membership[];
  /** stage → elements listed at that stage (in increasing order) */
  byStage: bigint[][];
}

function collect(members: Membership[], maxStage: number, label: (i: number) => bigint): Enumeration {
  const byStage: bigint[][] = Array.from({ length: maxStage + 1 }, () => []);
  members.forEach((m, i) => {
    if (m.kind === 'in') byStage[m.stage].push(label(i));
  });
  return { maxStage, members, byStage };
}

/** W_e = dom φₑ, enumerated by dovetailing up to stage maxStage (≤ 400). */
export function enumerateW(e: bigint, maxStage: number): Enumeration {
  const n = Math.max(0, Math.min(400, Math.floor(maxStage)));
  const members = Array.from({ length: n }, (_, x) => membership(e, BigInt(x), n));
  return collect(members, n, BigInt);
}

/** K = {e : φₑ(e)↓}, enumerated by dovetailing up to stage maxStage (≤ 400). */
export function enumerateK(maxStage: number): Enumeration {
  const n = Math.max(0, Math.min(400, Math.floor(maxStage)));
  const members = Array.from({ length: n }, (_, e) => membership(BigInt(e), BigInt(e), n));
  return collect(members, n, BigInt);
}

/** K₀ restricted to e < rows, x < cols: the stage at which ⟨e, x⟩ appears, by dovetailing. */
export function enumerateK0(rows: number, cols: number, maxStage: number): Membership[][] {
  const r = Math.min(60, rows);
  const c = Math.min(60, cols);
  return Array.from({ length: r }, (_, e) =>
    Array.from({ length: c }, (_, x) => {
      const m = membership(BigInt(e), BigInt(x), maxStage, Math.max(e, x));
      return m;
    }),
  );
}

// ------------------------------------------------------------------ range and domain

export interface RangeStep {
  z: bigint;
  /** (z)₀ and (z)₁ in this edition's pairing: z = J(x, n) */
  x: bigint;
  n: bigint;
  /** φₑ(x) if it halts within n calls, else the default element a */
  out: bigint;
  hit: boolean;
}

/**
 * The enumeration of the range of φₑ in the proof of Theorem ce-equiv, with a step count in
 * place of the record: f(J(x, n)) = φₑ(x) if the computation halts within n calls, else a.
 * f is total, and its range is ran φₑ ∪ {a}.
 */
export function rangeEnumeration(e: bigint, a: bigint, count: number): RangeStep[] {
  const out: RangeStep[] = [];
  for (let z = 0n; z < BigInt(Math.min(count, 2000)); z++) {
    const { x, y: n } = unpair(z);
    // n = 0 allows no call at all; budgets beyond 5000 calls are not tried here (listed as a).
    const o: PhiOutcome | null = n > 0n && n <= 5000n ? phi(e, x, Number(n)) : null;
    const hit = o !== null && o.kind === 'value';
    out.push({ z, x, n, out: o !== null && o.kind === 'value' ? o.value : a, hit });
  }
  return out;
}

/** The book's f(z) = U((z)₁) if T(e, (z)₀, (z)₁), else a — with this edition's pairing and records. */
export function bookRangeFunction(e: bigint, a: bigint, z: bigint): { x: bigint; s: bigint; holds: boolean; out: bigint; why?: string } {
  const { x, y: s } = unpair(z);
  const r = T(e, x, s, { maxNodes: 5000 });
  return { x, s, holds: r.holds, out: r.holds ? U(s) : a, why: r.failure?.what };
}

/** A z with T(e, (z)₀, (z)₁), for an x at which φₑ halts: z = J(x, s) with s the record. Null if too large. */
export function witnessPair(e: bigint, x: bigint, fuel = 2000): { z: bigint; s: bigint } | null {
  const r = computationRecord(e, x, fuel);
  if (r.kind !== 'halted') return null;
  const s = encodeRecord(r.root, 12);
  if (s === null) return null;
  return { z: J(x, s), s };
}

/** g(y) = μx (f(x) = y) for a total f given by index: the domain of g is the range of f. */
export function inverseSearch(e: bigint, y: bigint, maxX: number, fuel = 5000): { kind: 'found'; x: bigint } | { kind: 'notFound'; searched: number; stuck?: bigint } {
  for (let x = 0; x < maxX; x++) {
    const o = phi(e, BigInt(x), fuel);
    if (o.kind !== 'value') return { kind: 'notFound', searched: x, stuck: BigInt(x) };
    if (o.value === y) return { kind: 'found', x: BigInt(x) };
  }
  return { kind: 'notFound', searched: maxX };
}

// ------------------------------------------------------------------ deciding A from A and its complement

export interface RaceResult {
  x: bigint;
  /** calls φ_d(x) needed, or null if not within the budget */
  d: number | null;
  e: number | null;
  verdict: 'inA' | 'inComplement' | 'both' | 'unknown';
}

/**
 * The procedure in the proof of Theorem ce-comp: run φ_d(x) and φₑ(x) side by side, with the
 * same growing budget, until one halts. If A = W_d and its complement is W_e, exactly one halts.
 */
export function race(d: bigint, e: bigint, x: bigint, maxFuel: number): RaceResult {
  return raceSides({ kind: 'index', e: d }, { kind: 'index', e }, x, maxFuel);
}

/** A semi-decision procedure: φₑ(x)↓ for a given index, or K's own, φₓ(x)↓. */
export type Side = { kind: 'index'; e: bigint } | { kind: 'K' };

function haltsCalls(side: Side, x: bigint, maxFuel: number): number | null {
  const o = side.kind === 'K' ? phi(x, x, maxFuel) : phi(side.e, x, maxFuel);
  return o.kind === 'value' ? o.calls : null;
}

/** The race between two semi-decision procedures on x, with the same budget for both. */
export function raceSides(a: Side, b: Side, x: bigint, maxFuel: number): RaceResult {
  const nd = haltsCalls(a, x, maxFuel);
  const ne = haltsCalls(b, x, maxFuel);
  let verdict: RaceResult['verdict'] = 'unknown';
  if (nd !== null && ne !== null) verdict = 'both';
  else if (nd !== null) verdict = 'inA';
  else if (ne !== null) verdict = 'inComplement';
  return { x, d: nd, e: ne, verdict };
}

// ------------------------------------------------------------------ bounded "halting deciders"

/**
 * H_N(e, x) = 1 if φₑ(x) halts within N calls, else 0: a total computable function, and a wrong
 * answer to the halting problem. Returns an index e whose computation on e halts, but only after
 * more than N calls — so H_N(e, e) = 0 although φₑ(e)↓ — searching e < maxIndex.
 */
export function boundedDeciderCounterexample(N: number, maxIndex = 5000, fuel = 200_000): { e: bigint; calls: number; value: bigint } | null {
  for (let e = 0n; e < BigInt(maxIndex); e++) {
    const d = decodeIndex(e);
    if (!d.ok || d.arity !== 1) continue;
    const quick = phi(e, e, N);
    if (quick.kind !== 'outOfFuel') continue;
    const o = phi(e, e, fuel);
    if (o.kind === 'value') return { e, calls: o.calls, value: o.value };
  }
  return null;
}
