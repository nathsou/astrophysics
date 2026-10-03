/**
 * Finding what is at a position in the source: the innermost expression, statement or declaration whose span
 * contains an offset. Used by the language server for hover, go-to-definition, completion and code actions.
 */
import type * as A from './ast';

export type Located =
  | { kind: 'expr'; node: A.Expr }
  | { kind: 'stmt'; node: A.Stmt }
  | { kind: 'decl'; node: A.Decl | A.Member }
  | { kind: 'param'; node: A.Param }
  | { kind: 'binder'; node: A.Binder }
  | { kind: 'type'; node: A.TypeExpr };

const inside = (s: { start: number; end: number }, off: number) => s.start <= off && off <= s.end;

/** Every node containing the offset, outermost first. */
export function locateAll(p: A.Program, off: number): Located[] {
  const out: Located[] = [];
  const expr = (e: A.Expr | undefined): void => {
    if (!e || !inside(e.span, off)) return;
    out.push({ kind: 'expr', node: e });
    switch (e.k) {
      case 'unary':
      case 'old':
      case 'mult':
        expr(e.arg);
        break;
      case 'cast':
        expr(e.arg);
        type(e.type);
        break;
      case 'binary':
        expr(e.left);
        expr(e.right);
        break;
      case 'chain':
        e.args.forEach(expr);
        break;
      case 'call':
        e.args.forEach(expr);
        break;
      case 'index':
        expr(e.target);
        e.indices.forEach(expr);
        break;
      case 'slice':
        expr(e.target);
        expr(e.lo);
        expr(e.hi);
        break;
      case 'update':
        expr(e.target);
        expr(e.index);
        expr(e.value);
        break;
      case 'field':
        expr(e.target);
        break;
      case 'struct':
      case 'new':
        e.fields.forEach((f) => expr(f.value));
        break;
      case 'seqlit':
      case 'setlit':
      case 'tuple':
        e.elems.forEach(expr);
        break;
      case 'quant':
      case 'comprehension':
        for (const b of e.binders) {
          if (inside(b.span, off)) out.push({ kind: 'binder', node: b });
          if (b.type) type(b.type);
          if (b.range && 'set' in b.range) expr(b.range.set);
          else if (b.range) {
            expr(b.range.lo);
            expr(b.range.hi);
          }
        }
        if (e.k === 'quant') e.triggers.flat().forEach(expr);
        expr(e.body);
        if (e.k === 'comprehension') expr(e.value);
        break;
      case 'if':
        expr(e.cond);
        expr(e.then);
        expr(e.else);
        break;
      case 'match':
        expr(e.scrutinee);
        e.arms.forEach((a) => expr(a.body));
        break;
      case 'block':
        e.lets.forEach((l) => expr(l.value));
        expr(e.body);
        break;
      case 'at':
        expr(e.proc);
        break;
    }
  };
  const type = (t: A.TypeExpr | undefined): void => {
    if (!t || !inside(t.span, off)) return;
    out.push({ kind: 'type', node: t });
    if (t.k === 'named') t.args.forEach(type);
    else if (t.k === 'seq') type(t.elem);
    else if (t.k === 'func') {
      t.params.forEach(type);
      type(t.result);
    } else if (t.k === 'tuple') t.elems.forEach(type);
    else if (t.k === 'range') {
      expr(t.lo);
      expr(t.hi);
    }
  };
  const block = (b: A.Block | undefined): void => {
    if (!b || !inside(b.span, off)) return;
    b.stmts.forEach(stmt);
  };
  const stmt = (s: A.Stmt): void => {
    if (!inside(s.span, off)) return;
    out.push({ kind: 'stmt', node: s });
    switch (s.k) {
      case 'let':
        type(s.type);
        expr(s.init);
        break;
      case 'assign':
        expr(s.target);
        expr(s.value);
        break;
      case 'multi':
        s.targets.forEach(expr);
        s.values.forEach(expr);
        break;
      case 'if':
        expr(s.cond);
        block(s.then);
        if (s.else) 'stmts' in s.else ? block(s.else) : stmt(s.else);
        break;
      case 'while':
        expr(s.cond);
        s.spec.invariants.forEach((i) => expr(i.value));
        s.spec.decreases?.forEach(expr);
        block(s.body);
        break;
      case 'for':
        expr(s.lo);
        expr(s.hi);
        s.spec.invariants.forEach((i) => expr(i.value));
        s.spec.decreases?.forEach(expr);
        block(s.body);
        break;
      case 'loop':
      case 'atomic':
        block(s.body);
        break;
      case 'match':
        expr(s.scrutinee);
        s.arms.forEach((a) => block(a.body));
        break;
      case 'return':
        expr(s.value);
        break;
      case 'assert':
      case 'assume':
      case 'await':
        expr(s.cond);
        break;
      case 'expr':
        expr(s.expr);
        break;
      case 'block':
        block(s.body);
        break;
      case 'label':
        stmt(s.stmt);
        break;
      case 'choose':
        type(s.type);
        expr(s.where);
        break;
      case 'free':
        expr(s.target);
        break;
    }
  };
  const fn = (f: A.FnDecl) => {
    for (const p of f.params) {
      if (inside(p.span, off)) {
        out.push({ kind: 'param', node: p });
        type(p.type);
      }
    }
    if (f.result) type(f.result.type);
    f.spec.requires.forEach((r) => expr(r.value));
    f.spec.ensures.forEach((r) => expr(r.value));
    f.spec.decreases?.forEach(expr);
    if (f.body) 'stmts' in f.body ? block(f.body) : expr(f.body);
  };
  const member = (m: A.Decl | A.Member): void => {
    if (!inside(m.span, off)) return;
    out.push({ kind: 'decl', node: m });
    switch (m.k) {
      case 'fn':
        fn(m);
        break;
      case 'const':
        type(m.type);
        expr(m.value);
        break;
      case 'system':
      case 'world':
      case 'problem':
        m.members.forEach(member);
        break;
      case 'var':
        type(m.type);
        expr(m.init);
        break;
      case 'action':
        for (const p of m.params) if (inside(p.span, off)) out.push({ kind: 'param', node: p });
        m.params.forEach((p) => type(p.type));
        expr(m.guard);
        block(m.body);
        break;
      case 'process':
        for (const p of m.params) if (inside(p.span, off)) out.push({ kind: 'param', node: p });
        block(m.body);
        break;
      case 'init':
        block(m.body);
        break;
      case 'invariant':
      case 'property':
      case 'fact':
      case 'check':
      case 'run':
      case 'constraint':
        expr(m.expr);
        break;
      case 'type':
        type(m.def);
        break;
      case 'rel':
        type(m.type);
        break;
      case 'struct':
      case 'class':
        m.fields.forEach((f) => type(f.type));
        break;
      case 'enum':
        m.variants.forEach((v) => v.fields.forEach((f) => type(f.type)));
        break;
      case 'refines':
        m.mapping.forEach((x) => expr(x.value));
        break;
    }
  };
  p.decls.forEach(member);
  return out;
}

/** The innermost node at the offset. */
export function locate(p: A.Program, off: number): Located | undefined {
  return locateAll(p, off).at(-1);
}
