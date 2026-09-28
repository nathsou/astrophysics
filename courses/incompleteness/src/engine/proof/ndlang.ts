// The language of the natural deduction appendix: sentences with formula letters.
//
// The book states its rules and examples with schematic letters: A, B, C for sentences and
// A(x), C(x, b) for formulas with a free variable. Here a letter is a named formula (an `abbr`
// node) with as many arguments as it is written with: A is a sentence letter, A(x) a one-place
// formula letter, C(x, b) a two-place one. A letter stands for one definite formula, so two
// occurrences of A(t) with the same t are the same sentence, which is all the rules need.
//
// The core parser requires parentheses after a named formula; this module accepts bare
// sentence letters (A ∧ B → A) by rewriting them to A() before parsing, and prints them
// without the parentheses. Consequently A, B, C, D are always formula letters here (write ∀ or
// "forall" for the universal quantifier, not the ASCII "A x").

import * as Ast from '../syntax/ast.ts';
import type { Formula, Node, Term } from '../syntax/ast.ts';
import { tryParseFormula, tryParseTerm, type Abbreviation, type ParseResult } from '../syntax/parse.ts';
import { formulaTex, formulaText, termTex, termText } from '../syntax/print.ts';
import { isTerm } from '../syntax/ast.ts';

export const LETTERS = ['A', 'B', 'C', 'D'] as const;

/** A formula letter applied to terms (no arguments: a sentence letter). */
export function letter(name: string, args: Term[] = []): Formula {
  return Ast.abbr(name, name, args.map((_, i) => i), args);
}

/** Is this a formula letter of this module? */
export function isLetter(f: Formula): f is Formula & { k: 'abbr' } {
  return f.k === 'abbr' && (LETTERS as readonly string[]).includes(f.name) && f.tex === f.name;
}

interface Rewrite {
  src: string;
  /** positions in the rewritten string where "()" was inserted (in the original string's coordinates) */
  inserted: number[];
  abbreviations: Abbreviation[];
  error?: { error: string; pos: number };
}

function rewrite(src: string): Rewrite {
  const arities = new Map<string, { arity: number; pos: number }>();
  const inserted: number[] = [];
  let out = '';
  let last = 0;
  let error: Rewrite['error'];
  const re = /(?<![A-Za-z0-9_#])([ABCD])(?![A-Za-z0-9_])/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const name = m[1];
    const at = m.index;
    let j = at + 1;
    while (j < src.length && /\s/.test(src[j])) j++;
    let arity = 0;
    if (src[j] === '(') {
      // count the top-level arguments
      let depth = 0;
      let commas = 0;
      let empty = true;
      let k = j;
      for (; k < src.length; k++) {
        const c = src[k];
        if (c === '(') depth++;
        else if (c === ')') {
          depth--;
          if (depth === 0) break;
        } else if (depth === 1 && c === ',') commas++;
        else if (depth >= 1 && !/\s/.test(c)) empty = false;
      }
      arity = empty ? 0 : commas + 1;
    } else {
      out += src.slice(last, at + 1) + '()';
      last = at + 1;
      inserted.push(at + 1);
    }
    const prev = arities.get(name);
    if (prev && prev.arity !== arity && !error) {
      error = { error: `the letter ${name} is used with ${prev.arity} and with ${arity} argument${arity === 1 ? '' : 's'}`, pos: at };
    }
    if (!prev) arities.set(name, { arity, pos: at });
  }
  out += src.slice(last);
  const abbreviations: Abbreviation[] = [...arities.entries()].map(([name, { arity }]) => ({
    name,
    tex: name,
    params: Array.from({ length: arity }, (_, i) => i),
    description: arity === 0 ? `the sentence letter ${name}` : `the ${arity}-place formula letter ${name}`,
  }));
  return { src: out, inserted, abbreviations, error };
}

/** Parses a sentence in the notation of the appendix (formula letters A–D allowed). */
export function parseND(src: string): ParseResult<Formula> {
  const r = rewrite(src);
  if (r.error) return { ok: false, ...r.error };
  const p = tryParseFormula(r.src, { abbreviations: r.abbreviations });
  if (p.ok) return p;
  // map the error position back to the original string
  let pos = p.pos;
  for (const ins of r.inserted) {
    if (pos > ins) pos -= 2;
  }
  return { ok: false, error: p.error.replace(/\(\)/g, ''), pos: Math.max(0, Math.min(src.length, pos)) };
}

/** Parses a formula; throws on error (for authored examples). */
export function nd(src: string): Formula {
  const p = parseND(src);
  if (!p.ok) throw new Error(`parseND(${src}): ${p.error} at ${p.pos}`);
  return p.value;
}

export function parseNDTerm(src: string): ParseResult<Term> {
  return tryParseTerm(src);
}

const strip = (s: string) => s.replace(/\(\)/g, '');

/** TeX for a formula or term, with sentence letters written without parentheses. */
export function ndTex(n: Node): string {
  return strip(isTerm(n) ? termTex(n) : formulaTex(n));
}

/** Plain text (re-parsable by parseND). */
export function ndText(n: Node): string {
  return strip(isTerm(n) ? termText(n) : formulaText(n));
}

/** Messages from the checker mention formulas in plain text; drop the "()" of sentence letters. */
export function ndMessage(m: string): string {
  return strip(m);
}
