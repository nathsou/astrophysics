/**
 * Pretty-printer for Vouch: prints an AST back to source, with the fewest parentheses that keep the meaning.
 * `print(parse(src))` re-parses to the same tree (tested by round-trip fuzzing), and the verifier uses
 * `printExpr` to show verification conditions in the reader's own notation.
 */
import type * as A from './ast';
import { isBlock } from './ast';

export interface PrintOptions {
  /** Use the mathematical spellings (∀ ⟹ ≤ …) instead of ASCII. */
  unicode?: boolean;
}

const UNI: Record<string, string> = { '==>': '⟹', '<==': '⟸', '<==>': '⟺', '<=': '≤', '>=': '≥', '!=': '≠', '&&': '∧', '||': '∨', forall: '∀', exists: '∃', '!': '¬', '|->': '↦', '**': '∗', '~>': '⇝' };

/** Binding power of binary operators (higher binds tighter). */
const PREC: Record<string, number> = {
  '<==>': 1,
  '==>': 2,
  '<==': 2,
  until: 3,
  '~>': 3,
  '||': 4,
  '&&': 5,
  '**': 5,
  '==': 6,
  '!=': 6,
  '<': 6,
  '<=': 6,
  '>': 6,
  '>=': 6,
  in: 6,
  '!in': 6,
  '|->': 6,
  '|': 7,
  '^': 8,
  '&': 9,
  '<<': 10,
  '>>': 10,
  '+': 11,
  '-': 11,
  '++': 11,
  '*': 12,
  '/': 12,
  '%': 12,
  '.': 15,
};
const P_QUANT = 0;
const P_CHAIN = 6;
const P_CAST = 13;
const P_UNARY = 14;
const P_POSTFIX = 15;

function precOf(e: A.Expr): number {
  switch (e.k) {
    case 'quant':
      return P_QUANT;
    case 'binary':
      return PREC[e.op] ?? 6;
    case 'chain':
      return P_CHAIN;
    case 'cast':
      return P_CAST;
    case 'unary':
    case 'mult':
      return e.k === 'unary' && e.op === '-' ? P_UNARY : P_UNARY;
    case 'if':
    case 'match':
      return P_QUANT;
    default:
      return P_POSTFIX + 1;
  }
}

export function printExpr(e: A.Expr, o: PrintOptions = {}): string {
  const op = (s: string) => (o.unicode && UNI[s] ? UNI[s]! : s);
  const at = (x: A.Expr, min: number): string => {
    const s = printExpr(x, o);
    return precOf(x) < min ? `(${s})` : s;
  };
  switch (e.k) {
    case 'int':
      return e.value.toString();
    case 'bool':
      return String(e.value);
    case 'null':
      return 'null';
    case 'emp':
      return 'emp';
    case 'var':
      return e.name;
    case 'unary': {
      const word = e.op === 'always' || e.op === 'eventually' || e.op === 'next';
      const s = at(e.arg, P_UNARY);
      return word ? `${e.op} ${s}` : `${op(e.op)}${e.op === '-' && s.startsWith('-') ? ' ' : ''}${s}`;
    }
    case 'mult':
      return `${e.m} ${at(e.arg, P_UNARY)}`;
    case 'binary': {
      const p = PREC[e.op] ?? 6;
      if (e.op === '.') return `${at(e.left, P_POSTFIX)}.${at(e.right, P_UNARY)}`;
      // ==> is right-associative; everything else is left-associative; comparisons do not associate.
      const rightAssoc = e.op === '==>';
      const nonAssoc = p === 6 || e.op === '<==>';
      const l = at(e.left, nonAssoc || rightAssoc ? p + 1 : p);
      const r = at(e.right, nonAssoc || !rightAssoc ? p + 1 : p);
      return `${l} ${op(e.op)} ${r}`;
    }
    case 'chain':
      return e.args.map((a, i) => (i ? ` ${op(e.ops[i - 1]!)} ` : '') + at(a, P_CHAIN + 1)).join('');
    case 'call':
      return `${e.callee}(${e.args.map((a, i) => (e.inout[i] ? 'inout ' : '') + printExpr(a, o)).join(', ')})`;
    case 'index':
      return `${at(e.target, P_POSTFIX)}[${e.indices.map((x) => printExpr(x, o)).join(', ')}]`;
    case 'slice':
      return `${at(e.target, P_POSTFIX)}[${e.lo ? printExpr(e.lo, o) : ''}..${e.hi ? printExpr(e.hi, o) : ''}]`;
    case 'update':
      return `${at(e.target, P_POSTFIX)}[${printExpr(e.index, o)} := ${printExpr(e.value, o)}]`;
    case 'field':
      return `${at(e.target, P_POSTFIX)}.${e.name}`;
    case 'struct':
      return `${e.name} { ${e.fields.map((f) => `${f.name}: ${printExpr(f.value, o)}`).join(', ')} }`;
    case 'new':
      return `new ${e.cls}${e.fields.length ? ` { ${e.fields.map((f) => `${f.name}: ${printExpr(f.value, o)}`).join(', ')} }` : ''}`;
    case 'seqlit':
      return `[${e.elems.map((x) => printExpr(x, o)).join(', ')}]`;
    case 'setlit':
      return `{${e.elems.map((x) => printExpr(x, o)).join(', ')}}`;
    case 'tuple':
      return `(${e.elems.map((x) => printExpr(x, o)).join(', ')})`;
    case 'quant': {
      const trig = e.triggers.map((t) => ` {${t.map((x) => printExpr(x, o)).join(', ')}}`).join('');
      return `${op(e.q)} ${printBinders(e.binders, o)}${trig} :: ${printExpr(e.body, o)}`;
    }
    case 'comprehension':
      if (e.seq && e.value) return `[${printExpr(e.value, o)} | ${printBinders(e.binders, o)}]`;
      return `{ ${printBinders(e.binders, o)} | ${printExpr(e.body, o)} }`;
    case 'if':
      return `if ${printExpr(e.cond, o)} { ${printExpr(e.then, o)} } else ${e.else.k === 'if' ? printExpr(e.else, o) : `{ ${printExpr(e.else, o)} }`}`;
    case 'match':
      return `match ${printExpr(e.scrutinee, o)} { ${e.arms.map((a) => `${printPattern(a.pattern, o)} => ${printExpr(a.body, o)}`).join(', ')} }`;
    case 'block':
      return `{ ${e.lets.map((l) => `let ${l.name}${l.type ? `: ${printType(l.type, o)}` : ''} = ${printExpr(l.value, o)}\n`).join('')}${printExpr(e.body, o)} }`;
    case 'old':
      return `old(${printExpr(e.arg, o)})`;
    case 'at':
      return `${at(e.proc, P_POSTFIX)} at ${e.label}`;
    case 'cast':
      return `${at(e.arg, P_CAST)} as ${printType(e.type, o)}`;
  }
}

function printBinders(bs: A.Binder[], o: PrintOptions): string {
  // Group consecutive binders that share a type or range (they came from `i, j: int`).
  const parts: string[] = [];
  for (let i = 0; i < bs.length; ) {
    let j = i + 1;
    while (j < bs.length && bs[j]!.type === bs[i]!.type && bs[j]!.range === bs[i]!.range) j++;
    const names = bs.slice(i, j).map((b) => b.name).join(', ');
    const b = bs[i]!;
    if (b.type) parts.push(`${names}: ${printType(b.type, o)}`);
    else if (b.range && 'set' in b.range) parts.push(`${names} in ${printExpr(b.range.set, o)}`);
    else if (b.range) parts.push(`${names} in ${printExpr(b.range.lo, o)}${b.range.inclusive ? '..=' : '..'}${printExpr(b.range.hi, o)}`);
    else parts.push(names);
    i = j;
  }
  return parts.join(', ');
}

function printPattern(p: A.Pattern, o: PrintOptions): string {
  if (p.k === 'wild') return '_';
  if (p.k === 'lit') return printExpr(p.value, o);
  return p.binds.length ? `${p.name}(${p.binds.map((b) => b.name).join(', ')})` : p.name;
}

export function printType(t: A.TypeExpr, o: PrintOptions = {}): string {
  switch (t.k) {
    case 'named':
      return t.args.length ? `${t.name}<${t.args.map((a) => printType(a, o)).join(', ')}>` : t.name;
    case 'range':
      return `${printExpr(t.lo, o)}${t.inclusive ? '..=' : '..'}${printExpr(t.hi, o)}`;
    case 'seq':
      return `[${printType(t.elem, o)}]`;
    case 'func':
      return `${t.params.length === 1 ? printType(t.params[0]!, o) : `(${t.params.map((p) => printType(p, o)).join(', ')})`} -> ${printType(t.result, o)}`;
    case 'ref':
      return `ref ${t.cls}${t.nullable ? '?' : ''}`;
    case 'enum':
      return `{${t.variants.map((v) => v.name).join(', ')}}`;
    case 'tuple':
      return `(${t.elems.map((e) => printType(e, o)).join(', ')})`;
    case 'rel':
      return t.cols.map((c, i) => (i === t.cols.length - 1 && i > 0 && t.mult !== 'set' ? `${t.mult} ` : '') + printType(c, o)).join(' -> ');
  }
}

const IND = '  ';

function printSpecExprs(kw: string, xs: A.Labelled<A.Expr>[], indent: string, o: PrintOptions): string {
  return xs.map((x) => `\n${indent}${IND}${kw} ${x.label ? `${x.label}: ` : ''}${printExpr(x.value, o)}`).join('');
}

export function printStmt(s: A.Stmt, indent: string, o: PrintOptions = {}): string {
  const e = (x: A.Expr) => printExpr(x, o);
  switch (s.k) {
    case 'let':
      return `${indent}${s.ghost ? 'ghost ' : ''}${s.mutable ? 'var' : 'let'} ${s.name}${s.type ? `: ${printType(s.type, o)}` : ''}${s.init ? ` = ${e(s.init)}` : ''}`;
    case 'assign':
      return `${indent}${e(s.target)} ${s.op} ${e(s.value)}`;
    case 'multi':
      return `${indent}${s.declare ? (s.mutable ? 'var ' : 'let ') : ''}${s.targets.map(e).join(', ')} = ${s.values.map(e).join(', ')}`;
    case 'if': {
      let out = `${indent}if ${e(s.cond)} ${printBlock(s.then, indent, o)}`;
      if (s.else) out += ` else ${!isBlock(s.else) ? printStmt(s.else, indent, o).trimStart() : printBlock(s.else, indent, o)}`;
      return out;
    }
    case 'while':
      return `${indent}while ${e(s.cond)}${printLoopSpec(s.spec, indent, o)}${s.spec.invariants.length || s.spec.decreases ? `\n${indent}` : ' '}${printBlock(s.body, indent, o)}`;
    case 'for':
      return `${indent}for ${s.v} in ${e(s.lo)}${s.inclusive ? '..=' : '..'}${e(s.hi)}${printLoopSpec(s.spec, indent, o)}${s.spec.invariants.length || s.spec.decreases ? `\n${indent}` : ' '}${printBlock(s.body, indent, o)}`;
    case 'loop':
      return `${indent}loop ${printBlock(s.body, indent, o)}`;
    case 'atomic':
      return `${indent}atomic ${printBlock(s.body, indent, o)}`;
    case 'match':
      return `${indent}match ${e(s.scrutinee)} {\n${s.arms.map((a) => `${indent}${IND}${printPattern(a.pattern, o)} => ${printBlock(a.body, indent + IND, o)}`).join('\n')}\n${indent}}`;
    case 'return':
      return `${indent}return${s.value ? ` ${e(s.value)}` : ''}`;
    case 'break':
      return `${indent}break`;
    case 'skip':
      return `${indent}skip`;
    case 'assert':
      return `${indent}assert ${s.label ? `${s.label}: ` : ''}${e(s.cond)}`;
    case 'assume':
      return `${indent}assume ${e(s.cond)}`;
    case 'await':
      return `${indent}await ${e(s.cond)}`;
    case 'free':
      return `${indent}free ${e(s.target)}`;
    case 'choose':
      return `${indent}choose ${s.name}: ${printType(s.type, o)}${s.where ? ` where ${e(s.where)}` : ''}`;
    case 'expr':
      return `${indent}${e(s.expr)}`;
    case 'block':
      return `${indent}${printBlock(s.body, indent, o)}`;
    case 'label':
      return `${indent}${s.label}: ${printStmt(s.stmt, indent, o).trimStart()}`;
  }
}

function printLoopSpec(spec: A.LoopSpec, indent: string, o: PrintOptions): string {
  return printSpecExprs('invariant', spec.invariants, indent, o) + (spec.decreases ? `\n${indent}${IND}decreases ${spec.decreases.map((x) => printExpr(x, o)).join(', ')}` : '');
}

export function printBlock(b: A.Block, indent: string, o: PrintOptions = {}): string {
  if (!b.stmts.length) return '{}';
  return `{\n${b.stmts.map((s) => printStmt(s, indent + IND, o)).join('\n')}\n${indent}}`;
}

function printParams(ps: A.Param[], o: PrintOptions): string {
  return ps.map((p) => `${p.ghost ? 'ghost ' : ''}${p.mode === 'inout' ? 'inout ' : ''}${p.name}: ${printType(p.type, o)}`).join(', ');
}

export function printFn(f: A.FnDecl, indent = '', o: PrintOptions = {}): string {
  const head =
    f.flavour === 'pure'
      ? `${f.ghost ? 'ghost ' : ''}pure fn`
      : f.flavour === 'pred'
        ? 'pred'
        : f.flavour === 'lemma'
          ? 'lemma'
          : `${f.ghost ? 'ghost ' : ''}fn`;
  let out = `${indent}${head} ${f.name}(${printParams(f.params, o)})`;
  if (f.result && f.flavour !== 'pred') out += ` -> ${f.result.name ? `(${f.result.name}: ${printType(f.result.type, o)})` : printType(f.result.type, o)}`;
  out += printSpecExprs('requires', f.spec.requires, indent, o);
  out += printSpecExprs('ensures', f.spec.ensures, indent, o);
  if (f.spec.decreases) out += `\n${indent}${IND}decreases ${f.spec.decreases.map((x) => printExpr(x, o)).join(', ')}`;
  if (f.body) {
    const multiline = f.spec.requires.length || f.spec.ensures.length || f.spec.decreases;
    const sep = multiline ? `\n${indent}` : ' ';
    if ('stmts' in f.body) out += `${sep}${printBlock(f.body, indent, o)}`;
    else out += `${sep}{\n${indent}${IND}${printExpr(f.body, o).replace(/\n/g, `\n${indent}${IND}`)}\n${indent}}`;
  }
  return out;
}

function printMember(m: A.Member, indent: string, o: PrintOptions): string {
  const e = (x: A.Expr) => printExpr(x, o);
  switch (m.k) {
    case 'fn':
      return printFn(m, indent, o);
    case 'const':
      return `${indent}const ${m.name}${m.type ? `: ${printType(m.type, o)}` : ''} = ${e(m.value)}`;
    case 'enum':
      return `${indent}enum ${m.name} { ${m.variants.map((v) => (v.fields.length ? `${v.name}(${v.fields.map((f) => `${f.name}: ${printType(f.type, o)}`).join(', ')})` : v.name)).join(', ')} }`;
    case 'struct':
    case 'class':
      return `${indent}${m.k} ${m.name} {\n${m.fields.map((f) => `${indent}${IND}${f.ghost ? 'ghost ' : ''}${f.name}: ${printType(f.type, o)}`).join('\n')}\n${indent}}`;
    case 'type':
      return `${indent}${m.symmetric ? 'symmetric ' : ''}type ${m.names.map((n) => n.name).join(', ')}${m.def ? ` = ${printType(m.def, o)}` : ''}`;
    case 'var':
      return `${indent}${m.ghost ? 'ghost ' : ''}var ${m.name}: ${printType(m.type, o)}${m.init ? ` = ${e(m.init)}` : ''}`;
    case 'init':
      return `${indent}init ${printBlock(m.body, indent, o)}`;
    case 'action':
      return `${indent}action ${m.name}${m.params.length ? `(${printParams(m.params, o)})` : ''}${m.guard ? ` when ${e(m.guard)}` : ''} ${printBlock(m.body, indent, o)}`;
    case 'process':
      return `${indent}process ${m.name}${m.params.length ? `(${printParams(m.params, o)})` : ''} ${printBlock(m.body, indent, o)}`;
    case 'invariant':
    case 'property':
    case 'fact':
    case 'check':
    case 'run':
    case 'constraint':
      return `${indent}${m.k} ${m.name ? `${m.name}: ` : ''}${e(m.expr)}${m.scope !== undefined ? ` for ${m.scope}` : ''}`;
    case 'fairness':
      return `${indent}fairness ${m.strength} ${m.targets.map((t) => t.name).join(', ')}`;
    case 'instance':
      return `${indent}instance ${m.type} = ${m.size}`;
    case 'rel':
      return `${indent}rel ${m.name}: ${printType(m.type, o)}`;
    case 'refines':
      return `${indent}refines ${m.spec}${m.mapping.length ? ` via { ${m.mapping.map((x) => `${x.name} = ${e(x.value)}`).join(', ')} }` : ''}`;
    case 'solve':
    case 'count':
      return `${indent}${m.k}`;
  }
}

export function printDecl(d: A.Decl, o: PrintOptions = {}): string {
  if (d.k === 'system' || d.k === 'world' || d.k === 'problem') {
    return `${d.k} ${d.name} {\n${d.members.map((m) => printMember(m, IND, o)).join('\n')}\n}`;
  }
  return printMember(d as A.Member, '', o);
}

export function printProgram(p: A.Program, o: PrintOptions = {}): string {
  return p.decls.map((d) => printDecl(d, o)).join('\n\n') + '\n';
}
