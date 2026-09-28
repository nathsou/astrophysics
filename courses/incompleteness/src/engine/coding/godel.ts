// Gödel numbering (sections Coding Symbols, Coding Terms, Coding Formulas).
//
// A term or formula is first written as a string of official symbols: prefix notation with
// parentheses and commas, e.g. v0 = 0 is the six symbols  = ( v0 , c0 ).  The Gödel number of
// the string s_0 … s_{n-1} is the sequence code ⟨c_{s_0}, …, c_{s_{n-1}}⟩ of the symbol codes.
//
// Numerals n̄ = 0′′…′ are written ′(′(…′(0)…)): for large or symbolic n the n repetitions are
// kept as a *run* rather than spelled out. Named formulas (such as Prov(x)) contribute their
// symbols as a named block. The defined connectives ↔ and ⊤ are expanded first, because only
// primitive symbols have codes.

import * as A from '../syntax/ast.ts';
import type { Formula, Node, NodeId, Term } from '../syntax/ast.ts';
import { describeSym, LOGICAL, symbolCode, symbolCodeSeq, symbolFromCodeSeq, symEqual, type LogicalName, type Sym } from '../syntax/language.ts';
import { expandDefined, type Expansion } from '../syntax/ops.ts';
import { formulaText } from '../syntax/print.ts';
import { parseFormula, type Abbreviation } from '../syntax/parse.ts';
import { decodeSeq, evaluate, lit, seqParts, type Nat, type SeqPart } from '../numbers/nat.ts';

/** One entry of the official symbol string. */
export type CodeItem =
  | { k: 'sym'; sym: Sym; node: NodeId; role: SymRole }
  /** A numeral written out as n copies of `′(`, then `0`, then n copies of `)`. */
  | { k: 'numeral'; node: NodeId; value: Nat }
  /** The symbols of a named formula, not spelled out. */
  | { k: 'abbr'; node: NodeId; formula: Formula; code: Nat };

/** Why a symbol is where it is (for inspectors). */
export type SymRole = 'symbol' | 'open' | 'close' | 'comma' | 'binder-var' | 'numeral-tick';

const L = (name: LogicalName): Sym => ({ k: 'logical', name });

export const SUCC_SYM: Sym = { k: 'fn', arity: 1, index: 0 };
export const ZERO_SYM: Sym = { k: 'const', index: 0 };

/** Numerals up to this value are spelled out symbol by symbol. */
export const SPELL_OUT_NUMERALS = 24n;

export function termItems(t: Term, out: CodeItem[] = []): CodeItem[] {
  switch (t.k) {
    case 'var':
      out.push({ k: 'sym', sym: { k: 'var', index: t.index }, node: t.id, role: 'symbol' });
      break;
    case 'const':
      out.push({ k: 'sym', sym: { k: 'const', index: t.index }, node: t.id, role: 'symbol' });
      break;
    case 'numeral': {
      const n = evaluate(t.value, 64);
      if (n !== null && n <= SPELL_OUT_NUMERALS) {
        for (let i = 0n; i < n; i++) {
          out.push({ k: 'sym', sym: SUCC_SYM, node: t.id, role: 'numeral-tick' });
          out.push({ k: 'sym', sym: L('('), node: t.id, role: 'numeral-tick' });
        }
        out.push({ k: 'sym', sym: ZERO_SYM, node: t.id, role: 'numeral-tick' });
        for (let i = 0n; i < n; i++) out.push({ k: 'sym', sym: L(')'), node: t.id, role: 'numeral-tick' });
      } else out.push({ k: 'numeral', node: t.id, value: t.value });
      break;
    }
    case 'app':
      out.push({ k: 'sym', sym: { k: 'fn', arity: t.arity, index: t.index }, node: t.id, role: 'symbol' });
      out.push({ k: 'sym', sym: L('('), node: t.id, role: 'open' });
      t.args.forEach((a, i) => {
        if (i > 0) out.push({ k: 'sym', sym: L(','), node: t.id, role: 'comma' });
        termItems(a, out);
      });
      out.push({ k: 'sym', sym: L(')'), node: t.id, role: 'close' });
      break;
  }
  return out;
}

/** The official symbol string of a formula whose defined connectives are already expanded. */
function formulaItems(f: Formula, out: CodeItem[]): CodeItem[] {
  const sym = (s: Sym, role: SymRole = 'symbol') => out.push({ k: 'sym', sym: s, node: f.id, role });
  switch (f.k) {
    case 'bot':
      sym(L('⊥'));
      break;
    case 'top':
    case 'iff':
      throw new Error('expand defined connectives first');
    case 'eq':
      sym(L('='));
      sym(L('('), 'open');
      termItems(f.l, out);
      sym(L(','), 'comma');
      termItems(f.r, out);
      sym(L(')'), 'close');
      break;
    case 'pred':
      sym({ k: 'pred', arity: f.arity, index: f.index });
      sym(L('('), 'open');
      f.args.forEach((a, i) => {
        if (i > 0) sym(L(','), 'comma');
        termItems(a, out);
      });
      sym(L(')'), 'close');
      break;
    case 'abbr':
      out.push({ k: 'abbr', node: f.id, formula: f, code: abbrCode(f) });
      break;
    case 'not':
      sym(L('¬'));
      formulaItems(f.a, out);
      break;
    case 'and':
    case 'or':
    case 'imp':
      sym(L('('), 'open');
      formulaItems(f.a, out);
      sym(L(f.k === 'and' ? '∧' : f.k === 'or' ? '∨' : '→'));
      formulaItems(f.b, out);
      sym(L(')'), 'close');
      break;
    case 'forall':
    case 'exists':
      sym(L(f.k === 'forall' ? '∀' : '∃'));
      out.push({ k: 'sym', sym: { k: 'var', index: f.v.index }, node: f.v.id, role: 'binder-var' });
      formulaItems(f.body, out);
      break;
  }
  return out;
}

/** The Gödel number of a named formula instance, known by name (`gn:` + its text). */
export function abbrCode(f: Extract<Formula, { k: 'abbr' }>): Nat {
  const text = formulaText(f);
  const tex = `{}^{\\#}${f.tex}(${f.args.map((a) => termTexShort(a)).join(', ')}){}^{\\#}`;
  // The named formula contains each argument (its parameters occur in it), so its code is at
  // least the code of the arguments' symbol strings in order.
  const atLeast = codeItemsToNat(f.args.flatMap((a) => termItems(a)));
  return { k: 'named', name: `gn:${text}`, tex, seq: true, atLeast };
}

function termTexShort(t: Term): string {
  // Local import cycle avoidance: a tiny printer for named-formula arguments.
  switch (t.k) {
    case 'var':
      return ['x', 'y', 'z', 'u', 'w'][t.index] ?? `v_{${t.index}}`;
    case 'const':
      return t.index === 0 ? '0' : `c_{${t.index}}`;
    case 'numeral':
      if (t.quotes !== undefined) return `\\ulcorner ${t.quotes} \\urcorner`;
      return t.value.k === 'lit' ? `\\overline{${t.value.v}}` : `\\overline{${t.value.k === 'named' ? t.value.tex : '\\ldots'}}`;
    case 'app':
      return t.arity === 1 && t.index === 0 ? `${termTexShort(t.args[0])}'` : `f(${t.args.map(termTexShort).join(', ')})`;
  }
}

export interface Encoding {
  /** The expression actually coded (defined connectives expanded). */
  expanded: Node;
  expansions: Expansion[];
  items: CodeItem[];
  /** ⟨c_{s_0}, …, c_{s_{n-1}}⟩ */
  number: Nat;
}

export function codeItemsToNat(items: CodeItem[]): Nat {
  const parts: SeqPart[] = [];
  for (const it of items) {
    if (it.k === 'sym') parts.push({ k: 'item', v: lit(symbolCode(it.sym)) });
    else if (it.k === 'numeral') {
      parts.push({ k: 'run', times: it.value, items: [lit(symbolCode(SUCC_SYM)), lit(symbolCode(L('(')))] });
      parts.push({ k: 'item', v: lit(symbolCode(ZERO_SYM)) });
      parts.push({ k: 'run', times: it.value, items: [lit(symbolCode(L(')')))] });
    } else parts.push({ k: 'splice', seq: it.code });
  }
  return { k: 'seq', parts };
}

/** The Gödel number of a term or formula, with its symbol string. */
export function godel(n: Node): Encoding {
  const expansions: Expansion[] = [];
  if (A.isTerm(n)) {
    const items = termItems(n);
    return { expanded: n, expansions, items, number: codeItemsToNat(items) };
  }
  const expanded = expandDefined(n, expansions);
  const items = formulaItems(expanded, []);
  return { expanded, expansions, items, number: codeItemsToNat(items) };
}

export function godelNumber(n: Node): Nat {
  return godel(n).number;
}

// ------------------------------------------------------------------ decoding

export type DecodedItem =
  | { k: 'sym'; sym: Sym; code: bigint; at: number }
  | { k: 'numeral'; value: Nat; at: number }
  | { k: 'abbr'; formula: Formula; at: number };

export type DecodeTrace =
  | { k: 'factor'; i: number; p: number; exponent: bigint; element: bigint | null }
  | { k: 'symbol'; position: number; code: bigint; codeSeq: bigint[]; sym: Sym | null; error?: string };

export type DecodeOutcome =
  | { ok: true; node: Node; items: DecodedItem[]; trace: DecodeTrace[] }
  | { ok: false; stage: 'sequence' | 'symbols' | 'syntax'; error: string; at?: number; items: DecodedItem[]; trace: DecodeTrace[] };

/**
 * Decodes a Gödel number: factor it as a sequence code, decode each element as a symbol code,
 * then read the symbol string as a term or formula.
 */
export function decode(n: Nat, opts: { expect?: 'term' | 'formula' | 'any'; abbreviations?: Abbreviation[] } = {}): DecodeOutcome {
  const trace: DecodeTrace[] = [];
  const items: DecodedItem[] = [];
  let parts: SeqPart[] | null = seqParts(n);
  if (!parts) {
    const v = evaluate(n, 1 << 22);
    if (v === null) return { ok: false, stage: 'sequence', error: 'this number is too large, or known only by name, to factor here', items, trace };
    const d = decodeSeq(v);
    for (const s of d.steps) trace.push({ k: 'factor', ...s });
    if (!d.ok) return { ok: false, stage: 'sequence', error: d.reason, items, trace };
    parts = d.items.map((x) => ({ k: 'item', v: lit(x) }));
  }
  // Symbol codes, with runs recognised as numerals.
  const succCode = symbolCode(SUCC_SYM);
  const openCode = symbolCode(L('('));
  const closeCode = symbolCode(L(')'));
  const zeroCode = symbolCode(ZERO_SYM);
  let position = 0;
  for (let pi = 0; pi < parts.length; pi++) {
    const p = parts[pi];
    if (p.k === 'run') {
      // Expect run(n, [′, (]), 0, run(n, [)]).
      const zero = parts[pi + 1];
      const closes = parts[pi + 2];
      const isNumeral =
        p.items.length === 2 && evaluate(p.items[0], 64) === succCode && evaluate(p.items[1], 64) === openCode &&
        zero?.k === 'item' && evaluate(zero.v, 64) === zeroCode &&
        closes?.k === 'run' && closes.items.length === 1 && evaluate(closes.items[0], 64) === closeCode;
      if (!isNumeral) return { ok: false, stage: 'symbols', error: 'a repeated block that is not a numeral', at: position, items, trace };
      items.push({ k: 'numeral', value: p.times, at: position });
      position++;
      pi += 2;
      continue;
    }
    if (p.k === 'splice') {
      const code = p.seq;
      if (code.k === 'named' && code.name.startsWith('gn:')) {
        try {
          const formula = parseFormula(code.name.slice(3), { abbreviations: opts.abbreviations });
          items.push({ k: 'abbr', formula, at: position });
          position++;
          continue;
        } catch {
          /* fall through */
        }
      }
      return { ok: false, stage: 'symbols', error: 'part of this number is known only by name', at: position, items, trace };
    }
    const code = evaluate(p.v, 1 << 16);
    if (code === null) return { ok: false, stage: 'symbols', error: 'an element too large to be a symbol code', at: position, items, trace };
    const d = decodeSeq(code);
    if (!d.ok) {
      trace.push({ k: 'symbol', position, code, codeSeq: [], sym: null, error: d.reason });
      return { ok: false, stage: 'symbols', error: `element ${position}, ${code}, is not the code of a sequence, so not a symbol code`, at: position, items, trace };
    }
    const s = symbolFromCodeSeq(d.items);
    if ('error' in s) {
      trace.push({ k: 'symbol', position, code, codeSeq: d.items, sym: null, error: s.error });
      return { ok: false, stage: 'symbols', error: `element ${position}: ${s.error}`, at: position, items, trace };
    }
    trace.push({ k: 'symbol', position, code, codeSeq: d.items, sym: s });
    items.push({ k: 'sym', sym: s, code, at: position });
    position++;
  }
  const r = parseOfficial(items, opts.expect ?? 'any');
  if ('error' in r) return { ok: false, stage: 'syntax', error: r.error, at: r.at, items, trace };
  return { ok: true, node: r.node, items, trace };
}

/** Reads an official symbol string (prefix notation). */
export function parseOfficial(items: DecodedItem[], expect: 'term' | 'formula' | 'any'): { node: Node } | { error: string; at: number } {
  let i = 0;
  class Fail extends Error {
    at: number;
    constructor(msg: string, at: number) {
      super(msg);
      this.at = at;
    }
  }
  const isLogical = (it: DecodedItem | undefined, name: LogicalName) => it?.k === 'sym' && it.sym.k === 'logical' && it.sym.name === name;
  const want = (name: LogicalName) => {
    const it = items[i];
    if (!isLogical(it, name)) throw new Fail(`expected “${name}” at position ${i}${it ? '' : ' (the string ended)'}`, i);
    i++;
  };
  const term = (): Term => {
    const it = items[i];
    if (!it) throw new Fail('the string ended where a term was expected', i);
    i++;
    if (it.k === 'numeral') return A.numeral(it.value);
    if (it.k === 'abbr') throw new Fail('a formula where a term was expected', i - 1);
    const s = it.sym;
    if (s.k === 'var') return A.v(s.index);
    if (s.k === 'const') return A.c(s.index);
    if (s.k === 'fn') {
      want('(');
      const args: Term[] = [term()];
      for (let k = 1; k < s.arity; k++) {
        want(',');
        args.push(term());
      }
      want(')');
      return A.app(s.arity, s.index, args);
    }
    throw new Fail(`${describeSym(s)} cannot start a term`, i - 1);
  };
  const formula = (): Formula => {
    const it = items[i];
    if (!it) throw new Fail('the string ended where a formula was expected', i);
    if (it.k === 'abbr') {
      i++;
      return A.cloneFresh(it.formula);
    }
    if (it.k === 'numeral') throw new Fail('a term where a formula was expected', i);
    const s = it.sym;
    i++;
    if (s.k === 'logical') {
      switch (s.name) {
        case '⊥':
          return A.bot();
        case '¬':
          return A.not(formula());
        case '=': {
          want('(');
          const l = term();
          want(',');
          const r = term();
          want(')');
          return A.eq(l, r);
        }
        case '(': {
          const a = formula();
          const op = items[i];
          if (!(op?.k === 'sym' && op.sym.k === 'logical' && (op.sym.name === '∧' || op.sym.name === '∨' || op.sym.name === '→'))) {
            throw new Fail(`expected ∧, ∨ or → at position ${i}`, i);
          }
          i++;
          const b = formula();
          want(')');
          return A.bin(op.sym.name === '∧' ? 'and' : op.sym.name === '∨' ? 'or' : 'imp', a, b);
        }
        case '∀':
        case '∃': {
          const vIt = items[i];
          if (!(vIt?.k === 'sym' && vIt.sym.k === 'var')) throw new Fail(`a quantifier must be followed by a variable (position ${i})`, i);
          i++;
          const x = A.v(vIt.sym.index);
          const body = formula();
          return s.name === '∀' ? A.forall(x, body) : A.exists(x, body);
        }
        default:
          throw new Fail(`“${s.name}” cannot start a formula`, i - 1);
      }
    }
    if (s.k === 'pred') {
      want('(');
      const args: Term[] = [term()];
      for (let k = 1; k < s.arity; k++) {
        want(',');
        args.push(term());
      }
      want(')');
      return A.pred(s.arity, s.index, args);
    }
    throw new Fail(`${describeSym(s)} cannot start a formula`, i - 1);
  };
  try {
    let node: Node;
    if (expect === 'term') node = term();
    else if (expect === 'formula') node = formula();
    else {
      const first = items[0];
      const startsTerm = first && (first.k === 'numeral' || (first.k === 'sym' && (first.sym.k === 'var' || first.sym.k === 'const' || first.sym.k === 'fn')));
      node = startsTerm ? term() : formula();
    }
    if (i !== items.length) throw new Fail(`extra symbols after position ${i - 1}`, i);
    return { node: collapseNumerals(node) };
  } catch (e) {
    if (e instanceof Fail) return { error: e.message, at: e.at };
    throw e;
  }
}

/** Rewrites spelled-out numerals 0′′…′ (at least one ′) as numeral nodes. */
export function collapseNumerals<T extends Node>(n: T): T {
  const goT = (t: Term): Term => {
    if (t.k === 'app') {
      if (t.arity === 1 && t.index === 0) {
        let k = 0n;
        let x: Term = t;
        while (x.k === 'app' && x.arity === 1 && x.index === 0) {
          k++;
          x = x.args[0];
        }
        if (x.k === 'const' && x.index === 0) return { k: 'numeral', id: t.id, value: lit(k) };
        if (x.k === 'numeral' && x.value.k === 'lit') return { k: 'numeral', id: t.id, value: lit(x.value.v + k) };
      }
      return { ...t, args: t.args.map(goT) };
    }
    return t;
  };
  const goF = (f: Formula): Formula => {
    switch (f.k) {
      case 'eq':
        return { ...f, l: goT(f.l), r: goT(f.r) };
      case 'pred':
      case 'abbr':
        return { ...f, args: f.args.map(goT) };
      case 'not':
        return { ...f, a: goF(f.a) };
      case 'and':
      case 'or':
      case 'imp':
      case 'iff':
        return { ...f, a: goF(f.a), b: goF(f.b) };
      case 'forall':
      case 'exists':
        return { ...f, body: goF(f.body) };
      default:
        return f;
    }
  };
  return (A.isTerm(n) ? goT(n) : goF(n as Formula)) as T;
}

export { symbolCodeSeq, symEqual, LOGICAL };
