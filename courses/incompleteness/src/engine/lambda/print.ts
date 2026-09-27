// Printing lambda terms with minimal parentheses, following the book's conventions: application
// associates to the left, λ extends as far to the right as possible, and consecutive binders are
// merged (λf x.M for λf.λx.M). So an abstraction needs parentheses only when something follows
// it — the book writes (λx.xxy) λz.z — and an application needs them only in argument position.
//
//   print(t)    plain text (reparses with parseLambda to an α-equivalent term)
//   toTex(t)    KaTeX source (λ as \lambda, n̄ as \overline{n}, Succ as \mathrm{Succ})
//   printTokens(t)  the text as tokens, each with the ids of the nodes it belongs to (for a UI)
//
// Options can collapse subterms to names: labelled nodes (`labels`), any Church numeral up to α
// (`numerals`), or any subterm α-equivalent to one of the `known` terms.

import type { NodeId, Term } from './term.ts';
import { alphaEq } from './term.ts';
import { numeralLabel, numeralOfLabel, numeralValue } from './numerals.ts';

export interface KnownTerm {
  label: string;
  term: Term;
}

export interface LambdaPrintOptions {
  /** Show a labelled node as its label (K, Y, 2̄, Succ, …). Default false. */
  labels?: boolean;
  /** Show any subterm α-equivalent to a Church numeral as n̄. Default false. */
  numerals?: boolean;
  /** Show subterms α-equivalent to one of these as its label. */
  known?: KnownTerm[];
  /** Write λx.λy.M as λx y.M (text) / λxy.M (TeX). Default true. */
  mergeBinders?: boolean;
  /** Parenthesise every abstraction in argument position, e.g. p (λm n.m) rather than p λm n.m. Default false (minimal). */
  absArgParens?: boolean;
  /** Plain text: write λ as a backslash. Default false. */
  ascii?: boolean;
  /** TeX only: wrap the TeX of each node (before any parentheses are added around it). */
  wrap?: (node: Term, tex: string) => string;
}

/** The label to show for this node under the options, or null. */
export function collapsedLabel(t: Term, o: LambdaPrintOptions): string | null {
  if (o.labels && t.label !== undefined) return t.label;
  if (o.numerals) {
    const n = numeralValue(t);
    if (n !== null) return numeralLabel(n);
  }
  if (o.known) for (const k of o.known) if (alphaEq(t, k.term)) return k.label;
  return null;
}

// ------------------------------------------------------------------ tokens / text

export type TokenKind = 'lambda' | 'binder' | 'dot' | 'var' | 'label' | 'open' | 'close' | 'space';

export interface PrintToken {
  text: string;
  kind: TokenKind;
  /** The node this token belongs to: a variable, a binder (its abstraction), a label, or the node a parenthesis/space belongs to. */
  id: NodeId;
  /** Ids of all nodes containing this token, outermost first (ends with `id`). */
  owners: NodeId[];
}

export function printTokens(t: Term, o: LambdaPrintOptions = {}): PrintToken[] {
  const out: PrintToken[] = [];
  const merge = o.mergeBinders ?? true;
  const lambda = o.ascii ? '\\' : 'λ';
  const go = (s: Term, rightOpen: boolean, owners: NodeId[]) => {
    const own = [...owners, s.id];
    const push = (text: string, kind: TokenKind, id: NodeId = s.id, ow: NodeId[] = own) => out.push({ text, kind, id, owners: ow });
    const label = collapsedLabel(s, o);
    if (label !== null) return push(label, 'label');
    switch (s.k) {
      case 'var':
        return push(s.name, 'var');
      case 'app': {
        const argParen = (s.arg.k === 'app' || (o.absArgParens === true && s.arg.k === 'abs')) && collapsedLabel(s.arg, o) === null;
        go(s.fn, false, own);
        push(' ', 'space');
        if (argParen) push('(', 'open', s.arg.id, [...own, s.arg.id]);
        go(s.arg, argParen || rightOpen, own);
        if (argParen) push(')', 'close', s.arg.id, [...own, s.arg.id]);
        return;
      }
      case 'abs': {
        const paren = !rightOpen;
        if (paren) push('(', 'open');
        push(lambda, 'lambda');
        let cur: Term = s;
        let curOwn = own;
        let first = true;
        for (;;) {
          const a = cur as Term & { k: 'abs' };
          if (!first) push(' ', 'space', a.id, curOwn);
          push(a.param, 'binder', a.id, curOwn);
          first = false;
          const b = a.body;
          if (merge && b.k === 'abs' && collapsedLabel(b, o) === null) {
            cur = b;
            curOwn = [...curOwn, b.id];
            continue;
          }
          break;
        }
        push('.', 'dot', cur.id, curOwn);
        go((cur as Term & { k: 'abs' }).body, true, curOwn);
        if (paren) push(')', 'close');
        return;
      }
    }
  };
  go(t, true, []);
  return out;
}

/** Plain text with minimal parentheses, e.g. λf x.f (f x). */
export function print(t: Term, o: LambdaPrintOptions = {}): string {
  return printTokens(t, o)
    .map((k) => k.text)
    .join('');
}

// ------------------------------------------------------------------ TeX

/** TeX for a variable name: x, x′, x_1, x1 → x_{1}, longer names in \mathit. */
export function varTex(name: string): string {
  const pm = name.match(/'+$/);
  const primes = pm ? pm[0] : '';
  const base = name.slice(0, name.length - primes.length);
  let m: RegExpMatchArray | null;
  let core: string;
  if (/^[a-z]$/.test(base)) core = base;
  else if ((m = base.match(/^([a-z])_?([0-9]+)$/))) core = `${m[1]}_{${m[2]}}`;
  else if ((m = base.match(/^([a-z]+)_([a-z0-9]+)$/))) core = `${m[1]!.length === 1 ? m[1] : `\\mathit{${m[1]}}`}_{${m[2]}}`;
  else core = `\\mathit{${base.replace(/_/g, '\\_')}}`;
  return core + primes;
}

const GREEK: Record<string, string> = { Ω: '\\Omega', Θ: '\\Theta', Δ: '\\Delta', Λ: '\\Lambda', Φ: '\\Phi', Ψ: '\\Psi', Σ: '\\Sigma', Π: '\\Pi', Γ: '\\Gamma' };

/** TeX for a label: n̄ → \overline{n}; Y, K, Y_C as math letters; Ω → \Omega; Succ, true → \mathrm{…}. */
export function labelTex(label: string): string {
  const n = numeralOfLabel(label);
  if (n !== null) return `\\overline{${n}}`;
  const pm = label.match(/['′]+$/);
  const primes = pm ? "'".repeat(pm[0].length) : '';
  const base = label.slice(0, label.length - (pm ? pm[0].length : 0));
  const sub = base.match(/^(.+?)_(.+)$/);
  const head = sub ? sub[1]! : base;
  const tail = sub ? `_{${sub[2]}}` : '';
  let h: string;
  if (GREEK[head]) h = GREEK[head]!;
  else if (/^[A-Za-z]$/.test(head)) h = head;
  else h = `\\mathrm{${head}}`;
  return h + tail + primes;
}

type Edge = 'letter' | 'word' | 'paren' | 'lambda';
interface TexPiece {
  s: string;
  first: Edge;
  last: Edge;
}

const isLetterVar = (name: string) => /^[a-z](?:_?[0-9]+)?'*$/.test(name);

function sep(a: Edge, b: Edge): string {
  if (a === 'paren' || b === 'paren') return '';
  if (a === 'letter' && b === 'letter') return '';
  return '\\,';
}

/**
 * KaTeX for the term, e.g. \lambda fx.\, f(fx). Single-letter variables are juxtaposed as in the
 * book; names, labels and λs are separated by a thin space.
 */
export function toTex(t: Term, o: LambdaPrintOptions = {}): string {
  const merge = o.mergeBinders ?? true;
  const wrap = o.wrap ?? ((_n: Term, s: string) => s);
  const go = (s: Term, rightOpen: boolean): TexPiece => {
    const label = collapsedLabel(s, o);
    if (label !== null) {
      const tex = labelTex(label);
      return { s: wrap(s, tex), first: 'word', last: 'word' };
    }
    switch (s.k) {
      case 'var': {
        const kind: Edge = isLetterVar(s.name) ? 'letter' : 'word';
        return { s: wrap(s, varTex(s.name)), first: kind, last: kind };
      }
      case 'app': {
        const argParen = (s.arg.k === 'app' || (o.absArgParens === true && s.arg.k === 'abs')) && collapsedLabel(s.arg, o) === null;
        const f = go(s.fn, false);
        const a0 = go(s.arg, argParen || rightOpen);
        const a: TexPiece = argParen ? { s: `(${a0.s})`, first: 'paren', last: 'paren' } : a0;
        return { s: wrap(s, f.s + sep(f.last, a.first) + a.s), first: f.first, last: a.last };
      }
      case 'abs': {
        const params: string[] = [s.param];
        let cur: Term & { k: 'abs' } = s;
        while (merge && cur.body.k === 'abs' && collapsedLabel(cur.body, o) === null) {
          cur = cur.body;
          params.push(cur.param);
        }
        const joiner = params.every(isLetterVar) ? '' : '\\,';
        const body = go(cur.body, true);
        const inner = wrap(s, `\\lambda ${params.map(varTex).join(joiner)}.\\, ${body.s}`);
        return rightOpen ? { s: inner, first: 'lambda', last: body.last } : { s: `(${inner})`, first: 'paren', last: 'paren' };
      }
    }
  };
  return go(t, true).s;
}
