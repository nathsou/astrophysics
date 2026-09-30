// The untyped λ-calculus, with named variables.
//
// This module powers Part I of the course: parsing, printing, capture-avoiding
// substitution, several reduction strategies, reduction graphs, de Bruijn
// indices and Church encodings. Nodes carry ids so that visualisations can
// animate a term as it is rewritten.

export type U =
  | { k: 'var'; name: string; id: number }
  | { k: 'lam'; name: string; body: U; id: number }
  | { k: 'app'; fn: U; arg: U; id: number }
  | { k: 'def'; name: string; id: number };

let nextId = 1;
const fresh = () => nextId++;

export const V = (name: string): U => ({ k: 'var', name, id: fresh() });
export const L = (name: string, body: U): U => ({ k: 'lam', name, body, id: fresh() });
export const A = (fn: U, arg: U): U => ({ k: 'app', fn, arg, id: fresh() });
export const D = (name: string): U => ({ k: 'def', name, id: fresh() });

export type Path = number[]; // app: 0 = fn, 1 = arg; lam: 0 = body

export function at(t: U, p: Path): U {
  let cur = t;
  for (const i of p) {
    if (cur.k === 'app') cur = i === 0 ? cur.fn : cur.arg;
    else if (cur.k === 'lam') cur = cur.body;
    else throw new Error('bad path');
  }
  return cur;
}

export function replaceAt(t: U, p: Path, f: (u: U) => U, depth = 0): U {
  if (depth === p.length) return f(t);
  const i = p[depth];
  if (t.k === 'app') {
    return i === 0 ? { ...t, fn: replaceAt(t.fn, p, f, depth + 1) } : { ...t, arg: replaceAt(t.arg, p, f, depth + 1) };
  }
  if (t.k === 'lam') return { ...t, body: replaceAt(t.body, p, f, depth + 1) };
  throw new Error('bad path');
}

/** deep copy with fresh ids (used when an argument is duplicated) */
export function copy(t: U): U {
  switch (t.k) {
    case 'var':
      return V(t.name);
    case 'def':
      return D(t.name);
    case 'lam':
      return L(t.name, copy(t.body));
    case 'app':
      return A(copy(t.fn), copy(t.arg));
  }
}

export function size(t: U): number {
  switch (t.k) {
    case 'var':
    case 'def':
      return 1;
    case 'lam':
      return 1 + size(t.body);
    case 'app':
      return 1 + size(t.fn) + size(t.arg);
  }
}

export function freeVars(t: U, out = new Set<string>()): Set<string> {
  const go = (t: U, bound: Set<string>) => {
    switch (t.k) {
      case 'var':
        if (!bound.has(t.name)) out.add(t.name);
        return;
      case 'def':
        return;
      case 'lam': {
        const b = new Set(bound);
        b.add(t.name);
        go(t.body, b);
        return;
      }
      case 'app':
        go(t.fn, bound);
        go(t.arg, bound);
    }
  };
  go(t, new Set());
  return out;
}

function allNames(t: U, out = new Set<string>()): Set<string> {
  switch (t.k) {
    case 'var':
      out.add(t.name);
      break;
    case 'lam':
      out.add(t.name);
      allNames(t.body, out);
      break;
    case 'app':
      allNames(t.fn, out);
      allNames(t.arg, out);
      break;
  }
  return out;
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
export function freshName(base: string, avoid: Set<string>): string {
  const stem = base.replace(/[₀-₉']+$/, '');
  if (!avoid.has(stem)) return stem;
  for (let i = 1; ; i++) {
    const c = stem + String(i).split('').map((d) => SUB[+d]).join('');
    if (!avoid.has(c)) return c;
  }
}

export interface SubstEvent {
  kind: 'rename';
  from: string;
  to: string;
}

/**
 * Capture-avoiding substitution t[x := s]. The first copy of `s` keeps its
 * node ids (so animations can track it); further copies get fresh ids.
 */
export function subst(t: U, x: string, s: U, events: SubstEvent[] = []): U {
  const fvS = freeVars(s);
  let used = false;
  const go = (t: U): U => {
    switch (t.k) {
      case 'var':
        if (t.name !== x) return t;
        if (!used) {
          used = true;
          return s;
        }
        return copy(s);
      case 'def':
        return t;
      case 'app':
        return { ...t, fn: go(t.fn), arg: go(t.arg) };
      case 'lam': {
        if (t.name === x) return t; // x is shadowed
        if (!freeVars(t.body).has(x)) return t;
        if (fvS.has(t.name)) {
          // rename the binder to avoid capturing a free variable of s
          const avoid = new Set([...fvS, ...allNames(t.body), x]);
          const nn = freshName(t.name, avoid);
          events.push({ kind: 'rename', from: t.name, to: nn });
          const body = rename(t.body, t.name, nn);
          return { ...t, name: nn, body: go(body) };
        }
        return { ...t, body: go(t.body) };
      }
    }
  };
  return go(t);
}

/** naive (capturing!) substitution, for the chapter on why capture matters */
export function naiveSubst(t: U, x: string, s: U): U {
  switch (t.k) {
    case 'var':
      return t.name === x ? copy(s) : t;
    case 'def':
      return t;
    case 'app':
      return { ...t, fn: naiveSubst(t.fn, x, s), arg: naiveSubst(t.arg, x, s) };
    case 'lam':
      return t.name === x ? t : { ...t, body: naiveSubst(t.body, x, s) };
  }
}

function rename(t: U, from: string, to: string): U {
  switch (t.k) {
    case 'var':
      return t.name === from ? { ...t, name: to } : t;
    case 'def':
      return t;
    case 'app':
      return { ...t, fn: rename(t.fn, from, to), arg: rename(t.arg, from, to) };
    case 'lam':
      return t.name === from ? t : { ...t, body: rename(t.body, from, to) };
  }
}

// ---------------------------------------------------------------------------
// α-equivalence and de Bruijn indices

export type DB = { k: 'var'; i: number } | { k: 'free'; name: string } | { k: 'lam'; hint: string; body: DB } | { k: 'app'; fn: DB; arg: DB };

export function toDB(t: U, defs?: Map<string, U>): DB {
  const go = (t: U, ctx: string[]): DB => {
    switch (t.k) {
      case 'var': {
        const i = ctx.lastIndexOf(t.name);
        return i < 0 ? { k: 'free', name: t.name } : { k: 'var', i: ctx.length - 1 - i };
      }
      case 'def':
        return defs?.has(t.name) ? go(defs.get(t.name)!, []) : { k: 'free', name: t.name };
      case 'lam':
        return { k: 'lam', hint: t.name, body: go(t.body, [...ctx, t.name]) };
      case 'app':
        return { k: 'app', fn: go(t.fn, ctx), arg: go(t.arg, ctx) };
    }
  };
  return go(t, []);
}

export function dbKey(d: DB): string {
  switch (d.k) {
    case 'var':
      return String(d.i);
    case 'free':
      return `'${d.name}`;
    case 'lam':
      return `λ${dbKey(d.body)}`;
    case 'app':
      return `(${dbKey(d.fn)} ${dbKey(d.arg)})`;
  }
}

export function dbToString(d: DB): string {
  const go = (d: DB, prec: number): string => {
    switch (d.k) {
      case 'var':
        return String(d.i);
      case 'free':
        return d.name;
      case 'lam': {
        const s = `λ ${go(d.body, 0)}`;
        return prec > 0 ? `(${s})` : s;
      }
      case 'app': {
        const s = `${go(d.fn, 1)} ${go(d.arg, 2)}`;
        return prec > 1 ? `(${s})` : s;
      }
    }
  };
  return go(d, 0);
}

export const alphaEq = (a: U, b: U): boolean => dbKey(toDB(a)) === dbKey(toDB(b));

// ---------------------------------------------------------------------------
// parsing
//
//   term ::= λ x y z. term | app
//   app  ::= atom atom*
//   atom ::= x | NAME | n | (term)
//
// Identifiers bound by a definition `NAME = term` are references (δ-redexes);
// numerals denote Church numerals.

export class UParseError extends Error {
  constructor(
    message: string,
    readonly pos: number,
  ) {
    super(message);
  }
}

export interface UProgram {
  defs: Map<string, U>;
  defOrder: string[];
  main?: U;
  mainSrc?: string;
}

export function parseTerm(src: string, defNames: Set<string> = new Set(), offset = 0): U {
  let i = 0;
  const ws = () => {
    while (i < src.length) {
      if (/\s/.test(src[i])) i++;
      else if (src[i] === '-' && src[i + 1] === '-') {
        while (i < src.length && src[i] !== '\n') i++;
      } else break;
    }
  };
  const isIdStart = (c: string) => /[\p{L}_]/u.test(c) && c !== 'λ';
  const isId = (c: string) => isIdStart(c) || /[0-9'₀-₉]/.test(c);
  const ident = (): string => {
    ws();
    const s = i;
    if (!isIdStart(src[i] ?? '')) throw new UParseError(`expected a variable name, found ${src[i] ? `'${src[i]}'` : 'end of input'}`, offset + i);
    while (i < src.length && isId(src[i])) i++;
    return src.slice(s, i);
  };
  const term = (): U => {
    ws();
    if (src[i] === 'λ' || src[i] === '\\') {
      i++;
      const names: string[] = [];
      ws();
      while (i < src.length && isIdStart(src[i])) {
        names.push(ident());
        ws();
      }
      if (names.length === 0) throw new UParseError('expected a variable after λ', offset + i);
      if (src[i] === '.') i++;
      else if (src.startsWith('=>', i)) i += 2;
      else if (src[i] === '→') i++;
      else throw new UParseError("expected '.' after the λ-bound variables", offset + i);
      const body = term();
      return names.reduceRight((b, n) => L(n, b), body);
    }
    let t = atom();
    for (;;) {
      ws();
      if (i >= src.length || src[i] === ')') break;
      if (src[i] === 'λ' || src[i] === '\\') {
        t = A(t, term());
        break;
      }
      t = A(t, atom());
    }
    return t;
  };
  const atom = (): U => {
    ws();
    const c = src[i];
    if (c === '(') {
      i++;
      const t = term();
      ws();
      if (src[i] !== ')') throw new UParseError("expected ')'", offset + i);
      i++;
      return t;
    }
    if (c !== undefined && /[0-9]/.test(c)) {
      const s = i;
      while (i < src.length && /[0-9]/.test(src[i])) i++;
      const n = Number(src.slice(s, i));
      if (n > 200) throw new UParseError('numeral too large', offset + s);
      return church(n);
    }
    if (c !== undefined && isIdStart(c)) {
      const n = ident();
      return defNames.has(n) ? D(n) : V(n);
    }
    throw new UParseError(c === undefined ? 'unexpected end of input' : `unexpected '${c}'`, offset + i);
  };
  const t = term();
  ws();
  if (i < src.length) throw new UParseError(`unexpected '${src[i]}'`, offset + i);
  return t;
}

/** Parse lines `NAME = term` followed by an optional main term. */
export function parseProgram(src: string): UProgram {
  const defs = new Map<string, U>();
  const defOrder: string[] = [];
  let main: U | undefined;
  let mainSrc: string | undefined;
  // split into logical lines (continuation lines start with whitespace)
  const lines: { text: string; offset: number }[] = [];
  let off = 0;
  for (const raw of src.split('\n')) {
    const stripped = raw.replace(/--.*$/, '');
    if (stripped.trim() === '') {
      off += raw.length + 1;
      continue;
    }
    if (/^\s/.test(raw) && lines.length > 0) lines[lines.length - 1].text += '\n' + stripped;
    else lines.push({ text: stripped, offset: off });
    off += raw.length + 1;
  }
  for (const ln of lines) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_']*)\s*(?::=|=)(?!>)/.exec(ln.text);
    if (m) {
      const body = ln.text.slice(m[0].length);
      const t = parseTerm(body, new Set(defOrder), ln.offset + m[0].length);
      defs.set(m[1], t);
      if (!defOrder.includes(m[1])) defOrder.push(m[1]);
    } else {
      main = parseTerm(ln.text, new Set(defOrder), ln.offset);
      mainSrc = ln.text.trim();
    }
  }
  return { defs, defOrder, main, mainSrc };
}

// ---------------------------------------------------------------------------
// printing

export interface UTok {
  text: string;
  id?: number; // node id of the smallest enclosing node
  path?: Path;
  role?: 'binder' | 'var' | 'def' | 'lambda' | 'paren' | 'dot' | 'space' | 'num';
}

export interface PrintOpts {
  /** collapse λx.λy. into λx y. */
  compact?: boolean;
  /** show recognised Church numerals / booleans by name */
  recognise?: boolean;
  defs?: Map<string, U>;
}

export function printTokens(t: U, opts: PrintOpts = {}): UTok[] {
  const out: UTok[] = [];
  const compact = opts.compact ?? true;
  const go = (t: U, prec: number, path: Path) => {
    // prec: 0 = top/λ body, 1 = function position, 2 = argument
    if (opts.recognise && (t.k === 'lam' || t.k === 'app')) {
      const n = churchValue(t);
      if (n !== undefined && t.k === 'lam') {
        out.push({ text: String(n), id: t.id, path, role: 'num' });
        return;
      }
    }
    switch (t.k) {
      case 'var':
        out.push({ text: t.name, id: t.id, path, role: 'var' });
        return;
      case 'def':
        out.push({ text: t.name, id: t.id, path, role: 'def' });
        return;
      case 'lam': {
        const paren = prec > 0;
        if (paren) out.push({ text: '(', id: t.id, path, role: 'paren' });
        out.push({ text: 'λ', id: t.id, path, role: 'lambda' });
        let cur: U = t;
        let p = path;
        let first = true;
        while (cur.k === 'lam') {
          if (!first) out.push({ text: ' ', role: 'space' });
          out.push({ text: cur.name, id: cur.id, path: p, role: 'binder' });
          first = false;
          const next: U = cur.body;
          p = [...p, 0];
          if (!compact || next.k !== 'lam') {
            cur = next;
            break;
          }
          cur = next;
        }
        out.push({ text: '. ', role: 'dot' });
        go(cur, 0, p);
        if (paren) out.push({ text: ')', id: t.id, path, role: 'paren' });
        return;
      }
      case 'app': {
        const paren = prec > 1;
        if (paren) out.push({ text: '(', id: t.id, path, role: 'paren' });
        go(t.fn, 1, [...path, 0]);
        out.push({ text: ' ', role: 'space' });
        go(t.arg, 2, [...path, 1]);
        if (paren) out.push({ text: ')', id: t.id, path, role: 'paren' });
        return;
      }
    }
  };
  go(t, 0, []);
  return out;
}

export function print(t: U, opts: PrintOpts = {}): string {
  return printTokens(t, opts)
    .map((x) => x.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Church encodings

export function church(n: number): U {
  let body: U = V('x');
  for (let i = 0; i < n; i++) body = A(V('f'), body);
  return L('f', L('x', body));
}

/** if `t` is (α-equivalent to) a Church numeral, its value */
export function churchValue(t: U): number | undefined {
  if (t.k !== 'lam' || t.body.k !== 'lam') return undefined;
  const f = t.name;
  const x = t.body.name;
  if (f === x) return undefined;
  let n = 0;
  let cur = t.body.body;
  while (cur.k === 'app' && cur.fn.k === 'var' && cur.fn.name === f) {
    n++;
    cur = cur.arg;
  }
  return cur.k === 'var' && cur.name === x ? n : undefined;
}

export function churchBool(t: U): boolean | undefined {
  if (t.k !== 'lam' || t.body.k !== 'lam' || t.name === t.body.name) return undefined;
  const b = t.body.body;
  if (b.k !== 'var') return undefined;
  if (b.name === t.name) return true;
  if (b.name === t.body.name) return false;
  return undefined;
}

/** describe a normal form in human terms ("the Church numeral 3") */
export function describeValue(t: U, defs?: Map<string, U>): string | undefined {
  const n = churchValue(t);
  if (n !== undefined) return n === 0 ? 'the Church numeral 0 (also FALSE)' : n === 1 ? 'the Church numeral 1' : `the Church numeral ${n}`;
  const b = churchBool(t);
  if (b !== undefined) return b ? 'the Church boolean TRUE' : 'the Church boolean FALSE';
  if (defs) {
    const key = dbKey(toDB(t));
    for (const [name, d] of defs) if (dbKey(toDB(d, defs)) === key) return `the definition ${name}`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// reduction

export type Strategy = 'normal' | 'applicative' | 'cbn' | 'cbv';

export const strategyInfo: Record<Strategy, { name: string; blurb: string }> = {
  normal: { name: 'Normal order', blurb: 'Contract the leftmost-outermost redex. Finds the normal form whenever one exists.' },
  applicative: { name: 'Applicative order', blurb: 'Contract the leftmost-innermost redex: arguments are reduced before they are substituted.' },
  cbn: { name: 'Call by name', blurb: 'Normal order, but never reduce under a λ: stops at weak head normal form.' },
  cbv: { name: 'Call by value', blurb: 'Reduce the argument to a value (a λ) before substituting; never reduce under a λ.' },
};

export interface Redex {
  path: Path;
  kind: 'beta' | 'delta';
}

/** all redexes, in leftmost-outermost order */
export function redexes(t: U, defs?: Map<string, U>): Redex[] {
  const out: Redex[] = [];
  const go = (t: U, p: Path) => {
    if (t.k === 'app' && t.fn.k === 'lam') out.push({ path: p, kind: 'beta' });
    if (t.k === 'def' && defs?.has(t.name)) out.push({ path: p, kind: 'delta' });
    if (t.k === 'app') {
      go(t.fn, [...p, 0]);
      go(t.arg, [...p, 1]);
    } else if (t.k === 'lam') go(t.body, [...p, 0]);
  };
  go(t, []);
  return out;
}

export function isValue(t: U): boolean {
  return t.k === 'lam' || t.k === 'var';
}

/** the redex a strategy would contract next */
export function nextRedex(t: U, strategy: Strategy, defs?: Map<string, U>): Redex | undefined {
  const isDelta = (u: U) => u.k === 'def' && !!defs?.has(u.name);
  switch (strategy) {
    case 'normal': {
      const go = (t: U, p: Path): Redex | undefined => {
        if (t.k === 'app' && t.fn.k === 'lam') return { path: p, kind: 'beta' };
        if (isDelta(t)) return { path: p, kind: 'delta' };
        if (t.k === 'app') return go(t.fn, [...p, 0]) ?? go(t.arg, [...p, 1]);
        if (t.k === 'lam') return go(t.body, [...p, 0]);
        return undefined;
      };
      return go(t, []);
    }
    case 'applicative': {
      const go = (t: U, p: Path): Redex | undefined => {
        if (isDelta(t)) return { path: p, kind: 'delta' };
        if (t.k === 'app') {
          const inner = go(t.fn, [...p, 0]) ?? go(t.arg, [...p, 1]);
          if (inner) return inner;
          if (t.fn.k === 'lam') return { path: p, kind: 'beta' };
          return undefined;
        }
        if (t.k === 'lam') return go(t.body, [...p, 0]);
        return undefined;
      };
      return go(t, []);
    }
    case 'cbn': {
      const go = (t: U, p: Path): Redex | undefined => {
        if (t.k === 'app' && t.fn.k === 'lam') return { path: p, kind: 'beta' };
        if (isDelta(t)) return { path: p, kind: 'delta' };
        if (t.k === 'app') return go(t.fn, [...p, 0]);
        return undefined;
      };
      return go(t, []);
    }
    case 'cbv': {
      const go = (t: U, p: Path): Redex | undefined => {
        if (isDelta(t)) return { path: p, kind: 'delta' };
        if (t.k === 'app') {
          const f = go(t.fn, [...p, 0]);
          if (f) return f;
          const a = go(t.arg, [...p, 1]);
          if (a) return a;
          if (t.fn.k === 'lam') return { path: p, kind: 'beta' };
        }
        return undefined;
      };
      return go(t, []);
    }
  }
}

export interface StepResult {
  term: U;
  redex: Redex;
  /** for β: the bound variable, argument and body */
  info?: { var: string; arg: U; renames: SubstEvent[]; copies: number; erased: boolean };
}

export function contract(t: U, r: Redex, defs?: Map<string, U>): StepResult {
  let info: StepResult['info'];
  const term = replaceAt(t, r.path, (u) => {
    if (r.kind === 'delta') {
      if (u.k !== 'def' || !defs?.has(u.name)) throw new Error('not a δ-redex');
      return copy(defs.get(u.name)!);
    }
    if (u.k !== 'app' || u.fn.k !== 'lam') throw new Error('not a β-redex');
    const lam = u.fn;
    const events: SubstEvent[] = [];
    const occurrences = countFree(lam.body, lam.name);
    info = { var: lam.name, arg: u.arg, renames: events, copies: occurrences, erased: occurrences === 0 };
    return subst(lam.body, lam.name, u.arg, events);
  });
  return { term, redex: r, info };
}

function countFree(t: U, x: string): number {
  switch (t.k) {
    case 'var':
      return t.name === x ? 1 : 0;
    case 'def':
      return 0;
    case 'lam':
      return t.name === x ? 0 : countFree(t.body, x);
    case 'app':
      return countFree(t.fn, x) + countFree(t.arg, x);
  }
}

export function step(t: U, strategy: Strategy, defs?: Map<string, U>): StepResult | undefined {
  const r = nextRedex(t, strategy, defs);
  return r ? contract(t, r, defs) : undefined;
}

export interface NormalizeResult {
  steps: StepResult[];
  final: U;
  normal: boolean;
  reason?: 'fuel' | 'size';
}

export function normalize(t: U, strategy: Strategy, defs?: Map<string, U>, maxSteps = 1000, maxSize = 5000): NormalizeResult {
  const steps: StepResult[] = [];
  let cur = t;
  for (let i = 0; i < maxSteps; i++) {
    const s = step(cur, strategy, defs);
    if (!s) return { steps, final: cur, normal: true };
    steps.push(s);
    cur = s.term;
    if (size(cur) > maxSize) return { steps, final: cur, normal: false, reason: 'size' };
  }
  return { steps, final: cur, normal: false, reason: 'fuel' };
}

/** expand all δ-redexes */
export function expandDefs(t: U, defs: Map<string, U>, depth = 0): U {
  if (depth > 50) return t;
  switch (t.k) {
    case 'def':
      return defs.has(t.name) ? expandDefs(copy(defs.get(t.name)!), defs, depth + 1) : t;
    case 'var':
      return t;
    case 'lam':
      return { ...t, body: expandDefs(t.body, defs, depth) };
    case 'app':
      return { ...t, fn: expandDefs(t.fn, defs, depth), arg: expandDefs(t.arg, defs, depth) };
  }
}

// ---------------------------------------------------------------------------
// reduction graphs

export interface RGraph {
  nodes: { id: number; term: U; key: string; normal: boolean; depth: number }[];
  edges: { from: number; to: number; path: Path }[];
  truncated: boolean;
}

/** explore all reduction paths (β only, δ expanded first), up to a node limit */
export function reductionGraph(t0: U, defs?: Map<string, U>, maxNodes = 300, maxSize = 400): RGraph {
  const t = defs ? expandDefs(t0, defs) : t0;
  const nodes: RGraph['nodes'] = [];
  const edges: RGraph['edges'] = [];
  const index = new Map<string, number>();
  const key = (u: U) => dbKey(toDB(u));
  const queue: number[] = [];
  const add = (u: U, depth: number): number => {
    const k = key(u);
    const ex = index.get(k);
    if (ex !== undefined) return ex;
    const id = nodes.length;
    nodes.push({ id, term: u, key: k, normal: redexes(u).length === 0, depth });
    index.set(k, id);
    queue.push(id);
    return id;
  };
  add(t, 0);
  let truncated = false;
  while (queue.length > 0) {
    const id = queue.shift()!;
    const n = nodes[id];
    for (const r of redexes(n.term)) {
      const next = contract(n.term, r).term;
      if (size(next) > maxSize) {
        truncated = true;
        continue;
      }
      if (nodes.length >= maxNodes && !index.has(key(next))) {
        truncated = true;
        continue;
      }
      const to = add(next, n.depth + 1);
      if (!edges.some((e) => e.from === id && e.to === to)) edges.push({ from: id, to, path: r.path });
    }
  }
  return { nodes, edges, truncated };
}

// ---------------------------------------------------------------------------
// standard library for the playgrounds

export const STDLIB = `-- booleans
TRUE  = λt f. t
FALSE = λt f. f
IF    = λb t f. b t f
NOT   = λb. b FALSE TRUE
AND   = λp q. p q p
OR    = λp q. p p q
-- pairs
PAIR  = λa b s. s a b
FST   = λp. p TRUE
SND   = λp. p FALSE
-- numerals: n = λf x. f (f … (f x))
SUCC  = λn f x. f (n f x)
PLUS  = λm n f x. m f (n f x)
MULT  = λm n f. m (n f)
EXP   = λm n. n m
ISZERO = λn. n (λx. FALSE) TRUE
PRED  = λn f x. n (λg h. h (g f)) (λu. x) (λu. u)
-- recursion
Y     = λf. (λx. f (x x)) (λx. f (x x))
OMEGA = (λx. x x) (λx. x x)
`;
