/**
 * What every engine returns: a verdict with an honest badge (PLAN §2, "Honest results"), the certificate that backs
 * it and whether a trusted checker re-checked it, the assumptions it rests on, statistics, and a counterexample when
 * there is one. Everything here is plain data, so it crosses the worker boundary and the language server unchanged.
 */
import type { Span } from './vouch/syntax/lexer';

export type Status = 'verified' | 'violated' | 'unknown' | 'timeout' | 'error';

/** The badge ladder: what was established, from weakest to strongest. */
export type Badge =
  | { kind: 'tested'; runs: number; discarded?: number }
  | { kind: 'bounded'; bound: number; what: string }
  | { kind: 'exhaustive'; states: number; instance: string }
  | { kind: 'verified'; scope: string }
  | { kind: 'violated'; replayed: boolean }
  /** A constraint problem: how many solutions it has (every one checked by the interpreter). */
  | { kind: 'counted'; count: number; more: boolean; solve?: boolean }
  | { kind: 'unknown'; reason: string }
  | { kind: 'error'; reason: string };

export type CertificateKind = 'model' | 'solutions' | 'drat' | 'smt-proof' | 'trace' | 'lasso' | 'inductive-invariant' | 'state-space' | 'none';

export interface Certificate {
  kind: CertificateKind;
  /** Was it re-checked by a trusted checker? */
  checked: boolean;
  /** Which checker (e.g. "DRAT checker", "trace replay by the reference interpreter"). */
  checker: string;
  detail?: string;
}

export interface TraceState {
  /** Slot name → value, as Vouch text. */
  values: { name: string; value: string; kind: 'state' | 'local' | 'pc' | 'var' }[];
}

export interface TraceStep {
  /** The step taken to reach this state (absent for the initial state). */
  label?: string;
  /** Instance index or action name, for colouring lanes. */
  actor?: string;
  state: TraceState;
  /** For program traces: the statement executed. */
  span?: Span;
}

export interface Trace {
  steps: TraceStep[];
  /** For lassos: the index of the step the cycle returns to (the trace repeats steps[loopsTo…] forever). */
  loopsTo?: number;
}

export interface Verdict {
  engine: string;
  status: Status;
  /** The property or declaration checked, in words. */
  subject: string;
  badge: Badge;
  certificate: Certificate;
  /** What the result rests on, e.g. "the instance has 3 shards", "the SMT solver's arithmetic". */
  assumptions: string[];
  stats: Record<string, number>;
  trace?: Trace;
  message?: string;
  /** Where in the source the failing property or obligation is. */
  span?: Span;
}

/** One-line description of a badge, used by the UI and tests. */
export function badgeText(b: Badge): string {
  switch (b.kind) {
    case 'tested':
      return `tested on ${b.runs.toLocaleString('en-GB')} input${b.runs === 1 ? '' : 's'}`;
    case 'bounded':
      return `checked up to ${b.what} ${b.bound}`;
    case 'exhaustive':
      return `all ${b.states.toLocaleString('en-GB')} states of ${b.instance}`;
    case 'verified':
      return `verified for ${b.scope}`;
    case 'violated':
      return b.replayed ? 'violated · counterexample replayed' : 'violated · counterexample not replayed';
    case 'counted':
      return b.count === 0 ? 'no solution' : b.solve ? 'a solution found' : b.more ? `more than ${b.count.toLocaleString('en-GB')} solutions` : `${b.count.toLocaleString('en-GB')} solution${b.count === 1 ? '' : 's'}`;
    case 'unknown':
      return `unknown · ${b.reason}`;
    case 'error':
      return `error · ${b.reason}`;
  }
}

export interface EngineOptions {
  signal?: AbortSignal;
  /** Called with progress (0…1 when known) and running statistics. */
  onProgress?: (p: { fraction?: number; stats: Record<string, number>; message?: string }) => void;
  /** Wall-clock budget in milliseconds. */
  timeout?: number;
}
