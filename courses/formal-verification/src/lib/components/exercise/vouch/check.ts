/**
 * The exercise contract (PLAN §5): what the reader's code must satisfy beyond "the verifier is happy". Pure
 * functions, tested in check.test.ts and used again at build time to check every exercise's reference solution.
 */
import type { DeclVerdicts } from '$lib/fv/verify/document';
import type { Verdict } from '$lib/fv/engines';
import { parse } from '$lib/fv/vouch/syntax/parser';

export interface Expectation {
  /** Which verdicts this applies to: a declaration name, or a substring of the verdict's subject. */
  decl?: string;
  subject?: string;
  status: 'verified' | 'violated' | 'not-verified';
}

export interface ContractProblem {
  message: string;
  line?: number;
}

/** The text of 1-based inclusive line ranges. */
function regions(text: string, locked: [number, number][]): string[] {
  const lines = text.split('\n');
  return locked.map(([a, b]) => lines.slice(a - 1, b).join('\n'));
}

/**
 * Locked regions must be unchanged. Lines may be added or removed elsewhere, so each locked region is looked up
 * by its text, in order.
 */
export function lockedIntact(starter: string, text: string, locked: [number, number][]): ContractProblem[] {
  const out: ContractProblem[] = [];
  let from = 0;
  for (const r of regions(starter, locked)) {
    const at = text.indexOf(r, from);
    if (at < 0) {
      out.push({ message: `A locked part of the exercise was changed:\n${r.split('\n')[0]}…` });
      continue;
    }
    from = at + r.length;
  }
  return out;
}

const WORD = (w: string) => new RegExp(`(^|[^\\w])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`, 'm');

/** Forbidden constructs (by default `assume`: it makes anything verify). Comments are ignored. */
export function forbidden(text: string, words: string[] = ['assume']): ContractProblem[] {
  const code = text.replace(/\/\/.*$/gm, '');
  const out: ContractProblem[] = [];
  for (const w of words) {
    const m = WORD(w).exec(code);
    if (m) out.push({ message: `\`${w}\` is not allowed in this exercise.`, line: code.slice(0, m.index).split('\n').length });
  }
  return out;
}

export interface Judgement {
  ok: boolean;
  /** Verdicts that did not meet the expectation. */
  unmet: { verdict?: Verdict; expectation: Expectation; reason: string }[];
}

const matches = (e: Expectation, d: DeclVerdicts, v: Verdict) => (!e.decl || e.decl === d.decl) && (!e.subject || v.subject.includes(e.subject));

const meets = (status: Expectation['status'], v: Verdict) =>
  status === 'verified' ? v.status === 'verified' || v.badge.kind === 'exhaustive' : status === 'violated' ? v.status === 'violated' : v.status !== 'verified';

/**
 * Do the verdicts meet the expectations? With no expectations: there is at least one verdict and every one of
 * them is a proof (verified, or an exhaustive check of a finite system).
 */
export function judge(verdicts: DeclVerdicts[], expect: Expectation[] = []): Judgement {
  const all = verdicts.flatMap((d) => d.verdicts.map((v) => ({ d, v })));
  const unmet: Judgement['unmet'] = [];
  if (!expect.length) {
    if (!all.length) unmet.push({ expectation: { status: 'verified' }, reason: 'There is nothing to check yet.' });
    for (const { v } of all) if (!meets('verified', v)) unmet.push({ verdict: v, expectation: { status: 'verified' }, reason: v.message ?? v.subject });
    return { ok: !unmet.length, unmet };
  }
  for (const e of expect) {
    const hits = all.filter(({ d, v }) => matches(e, d, v));
    if (!hits.length) {
      unmet.push({ expectation: e, reason: `No result for ${e.decl ?? e.subject ?? 'the program'} yet.` });
      continue;
    }
    if (e.status === 'verified') {
      for (const { v } of hits) if (!meets('verified', v)) unmet.push({ verdict: v, expectation: e, reason: v.message ?? v.subject });
    } else if (!hits.some(({ v }) => meets(e.status, v))) {
      unmet.push({ verdict: hits[0]!.v, expectation: e, reason: `Expected ${e.status === 'violated' ? 'a violation' : 'a failed check'} for ${e.decl ?? e.subject}.` });
    }
  }
  return { ok: !unmet.length, unmet };
}

/** Replace the body of function `fn` in `text` by `body` (a block, braces included). */
export function replaceBody(text: string, fn: string, body: string): string | undefined {
  const parsed = parse(text);
  const d = parsed.program.decls.find((x) => x.k === 'fn' && x.name === fn);
  if (!d || d.k !== 'fn' || !d.body) return undefined;
  const span = d.body.span;
  return text.slice(0, span.start) + body.trim() + text.slice(span.end);
}

/** All verdicts of a function are proofs. */
export function fnVerified(verdicts: DeclVerdicts[], fn: string): boolean {
  const d = verdicts.find((x) => x.decl === fn);
  return !!d && d.verdicts.length > 0 && d.verdicts.every((v) => v.status === 'verified');
}
