// Front-end views for the pipeline explorer: the token stream, the AST as a
// tree, and the lowered CFG read back as three-address code with named
// variables. None of these changes the program; they make the steps between
// "source text" and "SSA" visible one at a time.

import type { Expr, FuncDecl, GlobalDecl, Pos, Program, Stmt } from './ast';
import type { Token } from './parser';
import { Instr, type Block, type Func, type Module, type Value } from '../ir/ir';
import { blockTok, valueTok } from '../ir/print';
import { tok, sp, lineText, type Line, type Tok } from '../listing';

// ------------------------------------------------------------------ tokens

const PUNCT = new Set(['(', ')', '{', '}', '[', ']', ',', ';']);
const KIND_NAME: Record<string, string> = { kw: 'keyword', id: 'identifier', num: 'number', op: 'operator', punct: 'punctuation' };

/** The lexer's output, one listing line per source line (tokens separated by a thin gap). */
export function tokenLines(toks: Token[]): Line[] {
  const byLine = new Map<number, Token[]>();
  for (const t of toks) {
    if (t.k === 'eof') continue;
    let l = byLine.get(t.pos.line);
    if (!l) byLine.set(t.pos.line, (l = []));
    l.push(t);
  }
  const out: Line[] = [{
    kind: 'comment',
    toks: [tok('; ', 'comment'), tok('keyword', 'kw'), tok('  '), tok('identifier', 'frame'), tok('  '), tok('call', 'sym'), tok('  '), tok('number', 'imm'), tok('  '), tok('operator', 'op'), tok('  '), tok('punctuation', 'punct'), tok(`   · ${toks.length - 1} tokens`, 'comment')],
  }];
  const lines = [...byLine.keys()].sort((a, b) => a - b);
  for (const ln of lines) {
    const row = byLine.get(ln)!;
    const out2: Tok[] = [tok(`${String(ln).padStart(3)} │ `, 'comment')];
    row.forEach((t, k) => {
      const next = row[k + 1] ?? toks.find((x) => x.pos.line > ln || (x.pos.line === ln && x.pos.col > t.pos.col));
      const kind = t.k === 'op' && PUNCT.has(t.s) ? 'punct' : t.k;
      const cls = kind === 'kw' ? 'kw' : kind === 'num' ? 'imm' : kind === 'punct' ? 'punct' : kind === 'op' ? 'op' : next?.s === '(' ? 'sym' : 'frame';
      if (k) out2.push(tok(' ', 'plain'));
      out2.push(tok(t.s, cls, undefined, {
        kind: 'text',
        title: `${KIND_NAME[kind]} ${t.k === 'num' && t.s !== String(t.v) ? `${t.s} = ${t.v}` : `‘${t.s}’`}`,
        body: `line ${t.pos.line}, column ${t.pos.col}. The parser sees only this stream: whitespace and comments are gone.`,
      }));
    });
    out.push({ kind: 'instr', toks: out2, key: `tok:${ln}`, links: [`src:${ln}`] });
  }
  return out;
}

// ------------------------------------------------------------------ AST

export interface Span { from: Pos; to: Pos }

export interface AstNode {
  /** node kind and its payload (operator, name, literal), as highlighted tokens */
  label: Tok[];
  /** the node's role in its parent: cond, then, body, init, ... */
  field?: string;
  /** a list of statements (body/then/else): no node of its own */
  group?: boolean;
  span?: Span;
  children: AstNode[];
}

function startOf(e: Expr | Stmt): Pos {
  if (e.k === 'bin') return startOf(e.l);
  if (e.k === 'index') return startOf(e.base);
  return e.pos;
}
const spanOf = (n: Expr | Stmt | FuncDecl | GlobalDecl): Span | undefined =>
  n.end ? { from: 'k' in n ? startOf(n) : n.pos, to: n.end } : undefined;

const K = (s: string) => tok(s, 'kw');
const V = (s: string) => tok(s, 'frame');

function exprNode(e: Expr, field?: string): AstNode {
  const n = (label: Tok[], children: AstNode[] = []): AstNode => ({ label, field, span: spanOf(e), children });
  switch (e.k) {
    case 'num': return n([K('Num'), sp, tok(e.v.toString(), 'imm')]);
    case 'var': return n([K('Var'), sp, V(e.name)]);
    case 'bin': return n([K('Binary'), sp, tok(e.op, 'op')], [exprNode(e.l, 'lhs'), exprNode(e.r, 'rhs')]);
    case 'un': return n([K('Unary'), sp, tok(e.op, 'op')], [exprNode(e.e)]);
    case 'call': return n([K('Call'), sp, tok(e.name, 'sym')], e.args.map((a, k) => exprNode(a, `arg${k}`)));
    case 'index': return n([K('Index')], [exprNode(e.base, 'base'), exprNode(e.idx, 'index')]);
  }
}

function group(field: string, stmts: Stmt[]): AstNode {
  const first = stmts[0], last = stmts[stmts.length - 1];
  const span = first && last?.end ? { from: startOf(first), to: last.end } : undefined;
  return { label: [], field, group: true, span, children: stmts.map((s) => stmtNode(s)) };
}

function stmtNode(s: Stmt, field?: string): AstNode {
  const n = (label: Tok[], children: AstNode[] = []): AstNode => ({ label, field, span: spanOf(s), children });
  switch (s.k) {
    case 'let': return n([K('Let'), sp, V(s.name), ...(s.size !== undefined ? [tok(`[${s.size}]`, 'imm')] : [])], s.init ? [exprNode(s.init, 'init')] : []);
    case 'assign': return n([K('Assign')], [exprNode(s.target, 'target'), exprNode(s.value, 'value')]);
    case 'if': return n([K('If')], [exprNode(s.cond, 'cond'), group('then', s.then), ...(s.else ? [group('else', s.else)] : [])]);
    case 'while': return n([K('While')], [exprNode(s.cond, 'cond'), group('body', s.body)]);
    case 'for': return n([K('For'), sp, V(s.name)], [exprNode(s.from, 'from'), exprNode(s.to, 'to'), group('body', s.body)]);
    case 'return': return n([K('Return')], s.e ? [exprNode(s.e)] : []);
    case 'break': return n([K('Break')]);
    case 'continue': return n([K('Continue')]);
    case 'expr': return n([K('ExprStmt')], [exprNode(s.e)]);
  }
}

export function astTree(p: Program): AstNode {
  const globals: AstNode[] = p.globals.map((g) => ({
    label: [K('Global'), sp, V(g.name), ...(g.isArray ? [tok(`[${g.size}]`, 'imm')] : []), ...(g.init.length ? [tok(' = ', 'punct'), tok(g.init.join(', '), 'imm')] : [])],
    span: spanOf(g),
    children: [],
  }));
  const funcs: AstNode[] = p.funcs.map((f) => {
    const params: Tok[] = [];
    f.params.forEach((x, k) => { if (k) params.push(tok(', ', 'punct')); params.push(V(x)); });
    return { label: [K('Fn'), sp, tok(f.name, 'sym'), tok('(', 'punct'), ...params, tok(')', 'punct')], span: spanOf(f), children: [group('body', f.body)] };
  });
  return { label: [K('Program')], children: [...globals, ...funcs] };
}

/** Plain-text rendering of the tree, two spaces per level (used by tests and "copy"). */
export function astText(p: Program | AstNode): string {
  const root = 'funcs' in p ? astTree(p) : p;
  const out: string[] = [];
  const walk = (n: AstNode, d: number) => {
    const label = n.label.map((t) => t.t).join('');
    out.push(`${'  '.repeat(d)}${n.field ? `${n.field}:${label ? ' ' : ''}` : ''}${label}`);
    n.children.forEach((c) => walk(c, d + 1));
  };
  walk(root, 0);
  return out.join('\n');
}

// ------------------------------------------------------------------ three-address code

const INFIX: Record<string, string> = {
  add: '+', sub: '-', mul: '*', sdiv: '/', srem: '%', and: '&', or: '|', xor: '^', shl: '<<', ashr: '>>', lshr: '>>>',
  eq: '==', ne: '!=', slt: '<', sle: '<=', sgt: '>', sge: '>=',
};

/**
 * The lowered (pre-mem2reg) CFG read back as three-address code. Scalar stack
 * slots become named variables: `store v, %n.addr` prints as `n = v`, and a
 * load that feeds a single later instruction in the same block (with no store
 * to the variable in between) is folded into it, so `%4 = load %n.addr;
 * %5 = srem %4, 2` reads `%5 = n % 2`. Short-circuit φs become an assignment
 * on each incoming path. The result has no φ and no SSA property: variables
 * are assigned as often as the program assigns them.
 */
export function tacFunc(f: Func): Line[] {
  const uses = f.uses();
  const users = (v: Value) => uses.get(v) ?? [];

  // ---- which stack slots are plain scalar variables?
  const vars = new Map<Instr, string>();
  const taken = new Map<string, number>();
  for (const i of f.instructions()) {
    if (i.op !== 'alloca' || i.size !== 8) continue;
    const ok = users(i).every((u) => (u.op === 'load' && u.args[0] === i) || (u.op === 'store' && u.args[1] === i && u.args[0] !== i));
    if (!ok) continue;
    const base = (i.name ?? `slot${i.id}`).replace(/\.addr$/, '');
    const k = taken.get(base) ?? 0;
    taken.set(base, k + 1);
    vars.set(i, k ? `${base}.${k + 1}` : base);
  }
  const varOf = (i: Instr) => (i.op === 'load' || i.op === 'store') && i.args[i.op === 'load' ? 0 : 1] instanceof Instr ? vars.get(i.args[i.op === 'load' ? 0 : 1] as Instr) : undefined;
  const varTok = (slot: Instr): Tok => tok(vars.get(slot)!, 'frame', `v:${f.name}:${slot.id}`, {
    kind: 'text',
    title: `variable ${vars.get(slot)}`,
    body: `A named, mutable local. In the pre-SSA IR it is the stack slot ${'%' + (slot.name ?? '') + slot.id}; mem2reg later replaces it with SSA values.`,
  });

  // ---- folding decisions
  const foldedLoad = new Set<Instr>();
  for (const b of f.blocks) {
    b.instrs.forEach((l, li) => {
      const x = l.op === 'load' ? varOf(l) : undefined;
      if (x === undefined) return;
      const us = users(l);
      if (us.length !== 1) return;
      const u = us[0];
      const ui = b.instrs.indexOf(u);
      if (u.block !== b || u.op === 'phi' || ui <= li) return;
      for (let k = li + 1; k < ui; k++) if (b.instrs[k].op === 'store' && b.instrs[k].args[1] === l.args[0]) return;
      foldedLoad.add(l);
    });
  }
  /** instructions printed as part of their single user (a store to a variable, or a condbr) */
  const inlined = new Set<Instr>();
  for (const b of f.blocks) {
    b.instrs.forEach((s, si) => {
      const prev = b.instrs[si - 1];
      if (!prev || !(prev instanceof Instr) || foldedLoad.has(prev) || users(prev).length !== 1) return;
      if (s.op === 'store' && varOf(s) !== undefined && s.args[0] === prev && !['phi', 'alloca', 'param'].includes(prev.op)) inlined.add(prev);
      if (s.op === 'condbr' && s.args[0] === prev && prev.op === 'icmp') inlined.add(prev);
    });
  }
  // φ (only produced for short-circuit && / || values) -> assignment in each predecessor
  const edgeCopies = new Map<Block, Instr[]>();
  for (const b of f.blocks) for (const p of b.phis) p.blocks.forEach((pb) => {
    let l = edgeCopies.get(pb);
    if (!l) edgeCopies.set(pb, (l = []));
    l.push(p);
  });

  // ---- printing
  const operand = (v: Value): Tok[] => {
    if (v instanceof Instr && foldedLoad.has(v)) return [varTok(v.args[0] as Instr)];
    if (v instanceof Instr && inlined.has(v)) return rhs(v);
    return [valueTok(v, f)];
  };
  const opTok = (s: string, i: Instr) => tok(s, 'op', undefined, { kind: 'irop', op: i.op, pred: i.pred });
  function rhs(i: Instr): Tok[] {
    const a = i.args;
    if (INFIX[i.op] && a.length === 2) return [...operand(a[0]), sp, opTok(INFIX[i.op], i), sp, ...operand(a[1])];
    if (i.op === 'icmp') return [...operand(a[0]), sp, opTok(INFIX[i.pred!], i), sp, ...operand(a[1])];
    if (i.op === 'load') {
      const x = varOf(i);
      return x !== undefined ? [varTok(a[0] as Instr)] : [tok('mem', 'kw', undefined, { kind: 'irop', op: 'load' }), tok('[', 'punct'), ...operand(a[0]), tok(']', 'punct')];
    }
    if (i.op === 'select') return [...operand(a[0]), tok(' ? ', 'op'), ...operand(a[1]), tok(' : ', 'op'), ...operand(a[2])];
    if (i.op === 'call') {
      const out: Tok[] = [tok('@' + i.sym, 'sym', `s:${i.sym}`, { kind: 'sym', name: i.sym!, what: 'function' }), tok('(', 'punct')];
      a.forEach((x, k) => { if (k) out.push(tok(', ', 'punct')); out.push(...operand(x)); });
      return [...out, tok(')', 'punct')];
    }
    if (i.op === 'gaddr') return [tok('&', 'op'), tok('@' + i.sym, 'sym', `s:${i.sym}`, { kind: 'sym', name: i.sym!, what: 'global variable' })];
    if (i.op === 'alloca') return [tok('alloca', 'kw', undefined, { kind: 'irop', op: 'alloca' }), sp, tok(String(i.size), 'imm')];
    const out: Tok[] = [tok(i.op, 'kw', undefined, { kind: 'irop', op: i.op, pred: i.pred })];
    a.forEach((x, k) => { out.push(tok(k ? ', ' : ' ', 'punct')); out.push(...operand(x)); });
    return out;
  }
  const line = (i: Instr, toks: Tok[], note?: string): Line => ({
    kind: 'instr', indent: 2, toks, key: `i:${f.name}:${i.id}`, links: i.line ? [`src:${i.line}`] : [], note: note ?? i.note,
  });

  const out: Line[] = [];
  const params: Tok[] = [];
  f.params.forEach((p, k) => { if (k) params.push(tok(', ', 'punct')); params.push(valueTok(p, f)); });
  out.push({
    kind: 'header',
    toks: [tok('fn ', 'kw'), tok('@' + f.name, 'sym', `s:${f.name}`, { kind: 'sym', name: f.name, what: 'function' }), tok('(', 'punct'), ...params, tok(') {', 'punct')],
    links: f.line ? [`src:${f.line}`] : [],
  });
  if (vars.size) {
    const vt: Tok[] = [tok('var ', 'kw')];
    [...vars.keys()].forEach((s, k) => { if (k) vt.push(tok(', ', 'punct')); vt.push(varTok(s)); });
    out.push({ kind: 'instr', indent: 2, toks: vt, note: 'the function’s scalar locals: named, mutable, assigned any number of times' });
  }
  for (const b of f.blocks) {
    out.push({ kind: 'label', toks: [blockTok(b), tok(':', 'punct')], key: `b:${f.name}:${b.id}` });
    for (const i of b.instrs) {
      if (i.op === 'phi' || foldedLoad.has(i) || inlined.has(i)) continue;
      if (i.op === 'alloca' && vars.has(i)) continue;
      if (i.isTerminator) {
        for (const p of edgeCopies.get(b) ?? []) {
          const v = p.args[p.blocks.indexOf(b)];
          out.push(line(p, [valueTok(p, f), tok(' = ', 'punct'), ...operand(v)], `${p.note ?? 'φ'}: assigned on this path, read after the join (no φ needed while temporaries are mutable)`));
        }
      }
      if (i.op === 'store') {
        const x = varOf(i);
        const v = i.args[0];
        if (x !== undefined) out.push(line(i, [varTok(i.args[1] as Instr), tok(' = ', 'punct'), ...(v instanceof Instr && inlined.has(v) ? rhs(v) : operand(v))]));
        else out.push(line(i, [tok('mem', 'kw', undefined, { kind: 'irop', op: 'store' }), tok('[', 'punct'), ...operand(i.args[1]), tok('] = ', 'punct'), ...operand(v)]));
      } else if (i.op === 'br') {
        out.push(line(i, [tok('goto ', 'kw'), blockTok(i.blocks[0])]));
      } else if (i.op === 'condbr') {
        out.push(line(i, [tok('if ', 'kw'), ...operand(i.args[0]), tok(' goto ', 'kw'), blockTok(i.blocks[0]), tok(' else goto ', 'kw'), blockTok(i.blocks[1])]));
      } else if (i.op === 'ret') {
        out.push(line(i, [tok('return ', 'kw'), ...operand(i.args[0])]));
      } else if (i.op === 'call' && users(i).length === 0) {
        out.push(line(i, rhs(i)));
      } else {
        out.push(line(i, [valueTok(i, f), tok(' = ', 'punct'), ...rhs(i)]));
      }
    }
  }
  out.push({ kind: 'header', toks: [tok('}', 'punct')] });
  return out;
}

export function tacModule(m: Module): Line[] {
  const out: Line[] = [];
  for (const g of m.globals) {
    out.push({
      kind: 'directive',
      toks: [tok('global ', 'kw'), tok('@' + g.name, 'sym', `s:${g.name}`, { kind: 'sym', name: g.name, what: 'global variable' }), tok(` : [${g.words} x i64]${g.init.length ? ` = [${g.init.join(', ')}]` : ''}`, 'comment')],
      links: g.line ? [`src:${g.line}`] : [],
    });
  }
  if (m.globals.length) out.push({ kind: 'blank', toks: [] });
  m.funcs.forEach((f, k) => {
    if (k) out.push({ kind: 'blank', toks: [] });
    out.push(...tacFunc(f));
  });
  return out;
}

export const tacText = (m: Module) => tacModule(m).map(lineText).join('\n');
