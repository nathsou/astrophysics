// Printing terms and formulas: conventional notation (as the book writes them) and plain text.

import type { Formula, Node, Term } from './ast.ts';
import { constName, constTex, fnName, fnTex, predName, predTex, varName, varTex } from './language.ts';
import { evaluate, show, toTex as natTex, type Nat } from '../numbers/nat.ts';

export interface PrintOptions {
  /** Write ¬ s = t as s ≠ t (the book's abbreviation). Default true. */
  neq?: boolean;
  /** How to write a numeral whose value is small: as n̄ (default) or as 0′′…′. */
  numerals?: 'bar' | 'ticks';
}

function numeralValueTex(v: Nat): string {
  return natTex(v, { maxDigits: 12 });
}

export function termTex(t: Term, o: PrintOptions = {}): string {
  switch (t.k) {
    case 'var':
      return varTex(t.index);
    case 'const':
      return constTex(t.index);
    case 'numeral': {
      if (t.quotes !== undefined) return `\\ulcorner ${t.quotes} \\urcorner`;
      const n = evaluate(t.value, 64);
      if (o.numerals === 'ticks' && n !== null && n <= 12n) return `0${"'".repeat(Number(n))}`;
      return `\\overline{${numeralValueTex(t.value)}}`;
    }
    case 'app': {
      if (t.arity === 1 && t.index === 0) {
        // Sums and products already print with their parentheses: (x + y)′, not ((x + y))′.
        return `${termTex(t.args[0], o)}'`;
      }
      if (t.arity === 2 && (t.index === 0 || t.index === 1)) return `(${termTex(t.args[0], o)} ${fnTex(2, t.index)} ${termTex(t.args[1], o)})`;
      return `${fnTex(t.arity, t.index)}(${t.args.map((a) => termTex(a, o)).join(', ')})`;
    }
  }
}

const BIN_TEX = { and: '\\land', or: '\\lor', imp: '\\rightarrow', iff: '\\leftrightarrow' } as const;

export function formulaTex(f: Formula, o: PrintOptions = {}, outer = true): string {
  switch (f.k) {
    case 'bot':
      return '\\bot';
    case 'top':
      return '\\top';
    case 'eq':
      return `${termTex(f.l, o)} = ${termTex(f.r, o)}`;
    case 'pred':
      if (f.arity === 2 && f.index === 0) return `${termTex(f.args[0], o)} < ${termTex(f.args[1], o)}`;
      return `${predTex(f.arity, f.index)}(${f.args.map((a) => termTex(a, o)).join(', ')})`;
    case 'abbr':
      return `${f.tex}(${f.args.map((a) => termTex(a, o)).join(', ')})`;
    case 'not':
      if (o.neq !== false && f.a.k === 'eq') return `${termTex(f.a.l, o)} \\neq ${termTex(f.a.r, o)}`;
      return `\\lnot ${formulaTex(f.a, o, false)}`;
    case 'and':
    case 'or':
    case 'imp':
    case 'iff': {
      const s = `${formulaTex(f.a, o, false)} ${BIN_TEX[f.k]} ${formulaTex(f.b, o, false)}`;
      return outer ? s : `(${s})`;
    }
    case 'forall':
    case 'exists':
      return `${f.k === 'forall' ? '\\forall' : '\\exists'} ${varTex(f.v.index)}\\, ${formulaTex(f.body, o, false)}`;
  }
}

export function nodeTex(n: Node, o: PrintOptions = {}): string {
  return n.k === 'var' || n.k === 'const' || n.k === 'app' || n.k === 'numeral' ? termTex(n, o) : formulaTex(n, o);
}

// ------------------------------------------------------------------ plain text

export function termText(t: Term): string {
  switch (t.k) {
    case 'var':
      return varName(t.index);
    case 'const':
      return constName(t.index);
    case 'numeral':
      return t.value.k === 'lit' ? t.value.v.toString() : `#${show(t.value)}`;
    case 'app': {
      if (t.arity === 1 && t.index === 0) {
        return `${termText(t.args[0])}'`;
      }
      if (t.arity === 2 && (t.index === 0 || t.index === 1)) return `(${termText(t.args[0])} ${fnName(2, t.index)} ${termText(t.args[1])})`;
      return `${fnName(t.arity, t.index)}(${t.args.map(termText).join(', ')})`;
    }
  }
}

const BIN_TEXT = { and: '∧', or: '∨', imp: '→', iff: '↔' } as const;

/** Plain text in the syntax accepted by the parser (parse(formulaText(f)) ≡ f). */
export function formulaText(f: Formula, outer = true): string {
  switch (f.k) {
    case 'bot':
      return '⊥';
    case 'top':
      return '⊤';
    case 'eq':
      return `${termText(f.l)} = ${termText(f.r)}`;
    case 'pred':
      if (f.arity === 2 && f.index === 0) return `${termText(f.args[0])} < ${termText(f.args[1])}`;
      return `${predName(f.arity, f.index)}(${f.args.map(termText).join(', ')})`;
    case 'abbr':
      return `${f.name}(${f.args.map(termText).join(', ')})`;
    case 'not':
      return `¬${formulaText(f.a, false)}`;
    case 'and':
    case 'or':
    case 'imp':
    case 'iff': {
      const s = `${formulaText(f.a, false)} ${BIN_TEXT[f.k]} ${formulaText(f.b, false)}`;
      return outer ? s : `(${s})`;
    }
    case 'forall':
    case 'exists':
      return `${f.k === 'forall' ? '∀' : '∃'}${varName(f.v.index)} ${formulaText(f.body, false)}`;
  }
}

export function nodeText(n: Node): string {
  return n.k === 'var' || n.k === 'const' || n.k === 'app' || n.k === 'numeral' ? termText(n) : formulaText(n);
}
