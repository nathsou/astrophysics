/**
 * The Vouch type checker: resolves names, assigns a type to every expression, and reports learner-friendly
 * diagnostics (codes listed in docs/VOUCH.md). Its output is what the interpreter, the verifier, the model
 * checkers and the language server all work from.
 */
import type * as A from '../syntax/ast';
import { forEachSubExpr, isBlock } from '../syntax/ast';
import type { Span } from '../syntax/lexer';
import { diag, type Diagnostic } from '../diagnostics';
import { Scope, suggest, type Sym, type SymKind } from './symbols';
import {
  BOOL, ERR, HEAPPROP, INT, NAT, TEMPORAL, UNKNOWN, VOID,
  assignable, finiteSize, intBounds, isIntLike, isPermissive, join, machBounds, showTy, tyEq, type Ty,
} from './types';

export interface FnInfo {
  decl: A.FnDecl;
  sym: Sym;
  params: Sym[];
  result?: Sym;
  locals: Sym[];
  container?: string;
}

export interface ActionInfo {
  decl: A.ActionDecl;
  sym: Sym;
  params: Sym[];
}

export interface ProcessInfo {
  decl: A.ProcessDecl;
  sym: Sym;
  params: Sym[];
  /** Process-local variables (declared with `var` in the body outside loops): part of the state. */
  locals: Sym[];
  /** Step labels, in program order. */
  labels: string[];
}

export interface ContainerInfo {
  decl: A.ContainerDecl;
  kind: 'system' | 'world' | 'problem';
  sym: Sym;
  scope: Scope;
  vars: Sym[];
  actions: ActionInfo[];
  processes: ProcessInfo[];
  invariants: A.PropDecl[];
  properties: A.PropDecl[];
  facts: A.PropDecl[];
  checks: A.PropDecl[];
  constraints: A.PropDecl[];
  fairness: A.FairnessDecl[];
  rels: Sym[];
  atoms: Ty[];
  init?: A.InitDecl;
  refines?: A.RefinesDecl;
  goal?: 'solve' | 'count';
  fns: FnInfo[];
}

export interface Checked {
  program: A.Program;
  diagnostics: Diagnostic[];
  /** The type of every expression. */
  types: Map<A.Expr, Ty>;
  /** What each name refers to: var, call, field, at, pattern and type nodes → symbol. */
  refs: Map<object, Sym>;
  /** Every reference to each symbol (by id), for the language server. */
  uses: Map<number, Span[]>;
  symbols: Sym[];
  globals: Scope;
  fns: Map<string, FnInfo>;
  containers: Map<string, ContainerInfo>;
  /** Scope at each block, for completion. */
  scopes: { span: Span; scope: Scope }[];
}

interface Ctx {
  scope: Scope;
  /** In a specification (requires, ensures, invariants, assertions, ghost code, pure functions): arithmetic is mathematical. */
  spec: boolean;
  fn?: FnInfo;
  container?: ContainerInfo;
  process?: ProcessInfo;
  /** Inside `old(…)`. */
  inOld?: boolean;
  /** May old() be used here? */
  allowOld?: boolean;
  /** Inside a loop (for break). */
  inLoop?: boolean;
  /** Inside an action or process step (await is allowed). */
  inStep?: boolean;
  /** Allow calls to executable functions (only as the whole right-hand side of a statement). */
  allowExecCall?: boolean;
  /** Ghost code: may not write to non-ghost state. */
  ghost?: boolean;
}

const BUILTINS = ['len', 'multiset', 'set', 'min', 'max', 'abs', 'reversed', 'keys', 'slt', 'sle', 'sgt', 'sge', 'sdiv', 'srem', 'ashr', 'sum', 'seq_of'];

export function check(program: A.Program): Checked {
  return new Checker(program).run();
}

class Checker {
  diagnostics: Diagnostic[] = [];
  types = new Map<A.Expr, Ty>();
  refs = new Map<object, Sym>();
  uses = new Map<number, Span[]>();
  symbols: Sym[] = [];
  globals = new Scope();
  fns = new Map<string, FnInfo>();
  containers = new Map<string, ContainerInfo>();
  scopes: { span: Span; scope: Scope }[] = [];
  private nextId = 1;
  /** Type declarations whose definition is being resolved (to report cycles). */
  private resolving = new Set<string>();
  private pendingTypes = new Map<string, { decl: A.TypeDecl; name: A.Ident; scope: Scope }>();

  constructor(readonly program: A.Program) {}

  run(): Checked {
    // Pass 1: declare every top-level name, so declarations can refer to each other in any order.
    for (const d of this.program.decls) this.declare(d, this.globals, undefined);
    // Pass 2: signatures, then bodies.
    for (const d of this.program.decls) if (d.k === 'fn') this.signature(d, this.globals);
    for (const d of this.program.decls) {
      if (d.k === 'const') this.checkConst(d, { scope: this.globals, spec: true });
      else if (d.k === 'fn') this.fnBody(this.fns.get(d.name)!, this.globals);
      else if (d.k === 'system' || d.k === 'world' || d.k === 'problem') this.containerBody(d);
    }
    return {
      program: this.program,
      diagnostics: this.diagnostics,
      types: this.types,
      refs: this.refs,
      uses: this.uses,
      symbols: this.symbols,
      globals: this.globals,
      fns: this.fns,
      containers: this.containers,
      scopes: this.scopes,
    };
  }

  // ── Diagnostics and symbols ──
  err(span: Span, code: string, message: string): void {
    this.diagnostics.push(diag('error', code, message, span));
  }
  warn(span: Span, code: string, message: string): void {
    this.diagnostics.push(diag('warning', code, message, span));
  }

  sym(kind: SymKind, name: string, ty: Ty, def: Span, extra: Partial<Sym> = {}): Sym {
    const s: Sym = { id: this.nextId++, kind, name, ty, def, ...extra };
    this.symbols.push(s);
    this.uses.set(s.id, []);
    return s;
  }

  define(scope: Scope, s: Sym): void {
    const prev = scope.names.get(s.name);
    if (prev && prev.kind !== 'builtin') {
      this.err(s.def, 'name/duplicate', `“${s.name}” is already declared in this scope (line ${'?'}). Choose another name.`);
      return;
    }
    // Shadowing a variable of an enclosing scope is allowed but easy to get wrong; quantifier variables excepted.
    scope.names.set(s.name, s);
  }

  use(node: object, s: Sym, span: Span): void {
    this.refs.set(node, s);
    this.uses.get(s.id)?.push(span);
  }

  // ── Declarations ──
  declare(d: A.Decl | A.Member, scope: Scope, owner: string | undefined): void {
    switch (d.k) {
      case 'fn': {
        const s = this.sym('fn', d.name, VOID, d.nameSpan, { decl: d, owner, doc: d.doc, ghost: d.ghost });
        this.define(scope, s);
        const info: FnInfo = { decl: d, sym: s, params: [], locals: [], container: owner };
        this.fns.set(owner ? `${owner}.${d.name}` : d.name, info);
        break;
      }
      case 'const':
        this.define(scope, this.sym('const', d.name, UNKNOWN, d.nameSpan, { decl: d, owner }));
        break;
      case 'enum': {
        const ty: Ty = { k: 'enum', name: d.name, variants: d.variants.map((v) => ({ name: v.name, fields: [] })) };
        this.define(scope, this.sym('type', d.name, ty, d.nameSpan, { owner }));
        d.variants.forEach((v, i) => this.define(scope, this.sym('variant', v.name, ty, v.span, { index: i, owner })));
        // Field types are resolved once every type is declared.
        queueMicrotaskLike(() => {
          d.variants.forEach((v, i) => {
            (ty as { variants: { fields: { name: string; ty: Ty }[] }[] }).variants[i]!.fields = v.fields.map((f) => ({ name: f.name, ty: this.resolveType(f.type, scope) }));
          });
        }, this);
        break;
      }
      case 'struct':
      case 'class': {
        const ty: Ty = { k: 'struct', name: d.name, fields: [] };
        this.define(scope, this.sym('type', d.name, ty, d.nameSpan, { owner }));
        queueMicrotaskLike(() => {
          (ty as { fields: { name: string; ty: Ty; ghost: boolean }[] }).fields = d.fields.map((f) => ({ name: f.name, ty: this.resolveType(f.type, scope), ghost: f.ghost }));
        }, this);
        if (d.k === 'class') this.classes.set(d.name, ty);
        break;
      }
      case 'type':
        for (const n of d.names) {
          if (!d.def) {
            const ty: Ty = { k: 'atom', name: n.name, symmetric: d.symmetric };
            this.define(scope, this.sym('type', n.name, ty, n.span, { owner }));
          } else {
            const s = this.sym('type', n.name, UNKNOWN, n.span, { owner });
            this.define(scope, s);
            this.pendingTypes.set(`${owner ?? ''}.${n.name}`, { decl: d, name: n, scope });
            queueMicrotaskLike(() => {
              if (isPermissive(s.ty)) s.ty = this.typeAlias(d, n, scope);
            }, this);
          }
        }
        break;
      case 'system':
      case 'world':
      case 'problem': {
        const s = this.sym('container', d.name, VOID, d.nameSpan, { decl: d });
        this.define(scope, s);
        const cscope = new Scope(scope);
        const info: ContainerInfo = {
          decl: d, kind: d.k, sym: s, scope: cscope, vars: [], actions: [], processes: [], invariants: [], properties: [], facts: [], checks: [],
          constraints: [], fairness: [], rels: [], atoms: [], fns: [],
        };
        this.containers.set(d.name, info);
        // Types and functions first, so state variables can use them.
        for (const m of d.members) if (m.k === 'type' || m.k === 'enum' || m.k === 'struct' || m.k === 'class' || m.k === 'fn' || m.k === 'const') this.declare(m, cscope, d.name);
        this.flushQueued();
        break;
      }
    }
    if (!owner) this.flushQueued();
  }

  classes = new Map<string, Ty>();
  private queued: (() => void)[] = [];
  flushQueued(): void {
    while (this.queued.length) this.queued.shift()!();
  }

  typeAlias(d: A.TypeDecl, n: A.Ident, scope: Scope): Ty {
    const key = n.name;
    if (this.resolving.has(key)) {
      this.err(n.span, 'type/cycle', `The type “${n.name}” is defined in terms of itself.`);
      return ERR;
    }
    this.resolving.add(key);
    try {
      return this.resolveType(d.def!, scope);
    } finally {
      this.resolving.delete(key);
    }
  }

  /** Evaluate a constant integer expression (range bounds, instance sizes). */
  constInt(e: A.Expr, scope: Scope): bigint | undefined {
    switch (e.k) {
      case 'int':
        return e.value;
      case 'var': {
        const s = scope.lookup(e.name);
        if (s?.kind === 'const') {
          this.use(e, s, e.span);
          if (s.value === undefined && s.decl && s.decl.k === 'const') this.checkConst(s.decl, { scope, spec: true });
          return typeof s.value === 'bigint' ? s.value : undefined;
        }
        return undefined;
      }
      case 'unary':
        if (e.op === '-') {
          const v = this.constInt(e.arg, scope);
          return v === undefined ? undefined : -v;
        }
        return undefined;
      case 'binary': {
        const l = this.constInt(e.left, scope);
        const r = this.constInt(e.right, scope);
        if (l === undefined || r === undefined) return undefined;
        switch (e.op) {
          case '+':
            return l + r;
          case '-':
            return l - r;
          case '*':
            return l * r;
          case '/':
            return r === 0n ? undefined : l / r;
          case '%':
            return r === 0n ? undefined : l % r;
        }
        return undefined;
      }
      default:
        return undefined;
    }
  }

  resolveType(t: A.TypeExpr, scope: Scope): Ty {
    switch (t.k) {
      case 'named': {
        const n = t.name;
        const args = t.args.map((a) => this.resolveType(a, scope));
        const want = (k: number) => {
          if (args.length !== k) this.err(t.span, 'type/args', `“${n}” takes ${k} type argument${k === 1 ? '' : 's'}.`);
        };
        switch (n) {
          case 'bool':
            return BOOL;
          case 'int':
            return INT;
          case 'nat':
            return NAT;
          case 'set':
          case 'multiset':
          case 'seq':
            want(1);
            return n === 'seq' ? { k: 'seq', elem: args[0] ?? ERR } : { k: n, elem: args[0] ?? ERR };
          case 'map':
            want(2);
            return { k: 'map', key: args[0] ?? ERR, val: args[1] ?? ERR };
        }
        const m = /^([iu])(8|16|32|64)$/.exec(n);
        if (m) return { k: 'mach', signed: m[1] === 'i', bits: Number(m[2]) };
        const b = /^bv([0-9]+)$/.exec(n);
        if (b) {
          const bits = Number(b[1]);
          if (bits < 1 || bits > 64) this.err(t.span, 'type/bv', 'Bit-vector widths go from bv1 to bv64.');
          return { k: 'bv', bits: Math.min(64, Math.max(1, bits)) };
        }
        const s = scope.lookup(n);
        if (!s || s.kind !== 'type') {
          const names = scope.visible().filter((x) => x.kind === 'type').map((x) => x.name);
          const hint = suggest(n, [...names, 'int', 'nat', 'bool', 'i32', 'u64', 'set', 'map']);
          this.err(t.span, 'type/unknown', `Unknown type “${n}”.${hint.length ? ` Did you mean ${hint.map((h) => `“${h}”`).join(' or ')}?` : ''}`);
          return ERR;
        }
        this.use(t, s, t.span);
        if (isPermissive(s.ty)) {
          const pending = [...this.pendingTypes.values()].find((p) => p.name.name === n && p.scope === scope);
          if (pending) s.ty = this.typeAlias(pending.decl, pending.name, pending.scope);
        }
        return s.ty;
      }
      case 'range': {
        const lo = this.constInt(t.lo, scope);
        const hi = this.constInt(t.hi, scope);
        if (lo === undefined || hi === undefined) {
          this.err(t.span, 'type/range', 'The bounds of a range type must be constants (numbers or `const` names).');
          return INT;
        }
        const top = t.inclusive ? hi + 1n : hi;
        if (top <= lo) this.err(t.span, 'type/empty-range', `The range ${lo}..${t.inclusive ? '=' : ''}${hi} is empty.`);
        return { k: 'range', lo, hi: top };
      }
      case 'seq':
        return { k: 'seq', elem: this.resolveType(t.elem, scope) };
      case 'func':
        return { k: 'func', params: t.params.map((p) => this.resolveType(p, scope)), result: this.resolveType(t.result, scope) };
      case 'tuple':
        return { k: 'tuple', elems: t.elems.map((e) => this.resolveType(e, scope)) };
      case 'ref': {
        if (!this.classes.has(t.cls)) this.err(t.span, 'type/class', `Unknown class “${t.cls}”: a \`ref\` points to an object of a class declared with \`class\`.`);
        return { k: 'ref', cls: t.cls, nullable: t.nullable };
      }
      case 'enum': {
        const name = `{${t.variants.map((v) => v.name).join(', ')}}`;
        const ty: Ty = { k: 'enum', name, variants: t.variants.map((v) => ({ name: v.name, fields: [] })) };
        t.variants.forEach((v, i) => {
          const existing = scope.lookup(v.name);
          if (existing?.kind === 'variant' && existing.ty.k === 'enum' && existing.ty.name === name) return;
          this.define(scope, this.sym('variant', v.name, ty, v.span, { index: i }));
        });
        return ty;
      }
      case 'rel':
        return { k: 'rel', cols: t.cols.map((c) => this.resolveType(c, scope)) };
    }
  }

  checkConst(d: A.ConstDecl, ctx: Ctx): void {
    const s = ctx.scope.lookup(d.name);
    if (!s || s.kind !== 'const' || !isPermissive(s.ty)) return;
    s.ty = ERR; // guard against cycles
    const want = d.type ? this.resolveType(d.type, ctx.scope) : undefined;
    const ty = this.expr(d.value, ctx, want);
    s.ty = want ?? ty;
    if (want) this.coerce(d.value, ty, want, 'const');
    const v = this.constInt(d.value, ctx.scope);
    if (v !== undefined) s.value = v;
    else if (d.value.k === 'bool') s.value = d.value.value;
  }

  signature(d: A.FnDecl, scope: Scope, owner?: string): void {
    const info = this.fns.get(owner ? `${owner}.${d.name}` : d.name)!;
    info.params = d.params.map((p) => this.sym('param', p.name, this.resolveType(p.type, scope), p.span, { mutable: p.mode === 'inout', inout: p.mode === 'inout', ghost: p.ghost || d.ghost || d.flavour === 'lemma', owner: d.name }));
    if (d.result) info.result = this.sym('result', d.result.name ?? 'result', this.resolveType(d.result.type, scope), d.result.span, { mutable: true, owner: d.name });
    if (d.flavour !== 'fn' && d.params.some((p) => p.mode === 'inout')) this.err(d.nameSpan, 'fn/inout', `Only executable functions (fn) can have inout parameters; a ${d.flavour === 'lemma' ? 'lemma' : 'pure function'} cannot change its arguments.`);
    if ((d.flavour === 'pure' || d.flavour === 'pred') && !d.result) this.err(d.nameSpan, 'fn/result', 'A pure function needs a result type: `pure fn f(x: int) -> int { … }`.');
    // A predicate whose body uses separation logic (`**`, `|->`, `emp`) describes a heap, not a truth value.
    if (d.flavour === 'pred' && info.result && d.body && !('stmts' in d.body) && usesSpatial(d.body)) info.result.ty = HEAPPROP;
    info.sym.ty = { k: 'func', params: info.params.map((p) => p.ty), result: info.result?.ty ?? VOID };
  }

  fnBody(info: FnInfo, scope: Scope): void {
    const d = info.decl;
    const fscope = new Scope(scope);
    for (const p of info.params) this.define(fscope, p);
    const pure = d.flavour === 'pure' || d.flavour === 'pred';
    const base: Ctx = { scope: fscope, spec: true, fn: info, ghost: d.ghost, container: info.container ? this.containers.get(info.container) : undefined };
    for (const r of d.spec.requires) this.expectBoolish(r.value, base, 'requires');
    const post = new Scope(fscope);
    if (info.result) this.define(post, info.result);
    for (const e of d.spec.ensures) this.expectBoolish(e.value, { ...base, scope: post, allowOld: d.flavour === 'fn' || d.flavour === 'lemma' }, 'ensures');
    for (const e of d.spec.decreases ?? []) this.decreasesExpr(e, base);
    if (!d.body) {
      if (d.flavour === 'fn') this.warn(d.nameSpan, 'fn/no-body', `“${d.name}” has no body: the verifier will trust its contract without checking it.`);
      return;
    }
    if ('stmts' in d.body) {
      if (pure) this.err(d.body.span, 'fn/pure-body', 'The body of a pure function is an expression, not statements.');
      const bscope = new Scope(fscope);
      if (info.result) {
        this.define(bscope, info.result);
        if (!d.result?.name) {
          // An anonymous result is set with `return e`; it cannot be named in the body.
          bscope.names.delete(info.result.name);
        }
      }
      this.block(d.body, { ...base, scope: bscope, spec: d.flavour === 'lemma' || d.ghost, allowOld: true });
    } else {
      const ty = this.expr(d.body, { ...base, spec: true });
      if (info.result) this.coerce(d.body, ty, info.result.ty, 'result');
    }
  }

  decreasesExpr(e: A.Expr, ctx: Ctx): void {
    const t = this.expr(e, { ...ctx, spec: true });
    if (!isPermissive(t) && !isIntLike(t) && t.k !== 'seq' && t.k !== 'set' && t.k !== 'multiset' && t.k !== 'bool')
      this.err(e.span, 'spec/decreases', `A termination measure must be an integer (or a sequence, set or multiset that shrinks), not ${showTy(t)}.`);
  }

  containerBody(d: A.ContainerDecl): void {
    const info = this.containers.get(d.name)!;
    const scope = info.scope;
    const base: Ctx = { scope, spec: true, container: info };
    for (const m of d.members) {
      switch (m.k) {
        case 'const':
          this.checkConst(m, base);
          break;
        case 'instance': {
          const s = scope.lookup(m.type);
          if (!s || s.kind !== 'type' || s.ty.k !== 'atom') this.err(m.span, 'system/instance', `\`instance\` sets the size of a declared type without a definition (like \`type Node\`); “${m.type}” is not one.`);
          else {
            (s.ty as { size?: number }).size = m.size;
            this.use(m, s, m.span);
          }
          break;
        }
      }
    }
    for (const m of d.members) if (m.k === 'fn') this.signature(m, scope, d.name);
    for (const m of d.members) {
      if (m.k === 'type') for (const n of m.names) {
        const s = scope.lookup(n.name);
        if (s?.ty.k === 'atom') info.atoms.push(s.ty);
      }
    }
    // State variables and relations, in order.
    for (const m of d.members) {
      if (m.k === 'var') {
        const ty = this.resolveType(m.type, scope);
        const s = this.sym('statevar', m.name, ty, m.nameSpan, { mutable: true, ghost: m.ghost, owner: d.name, decl: m });
        this.define(scope, s);
        info.vars.push(s);
      } else if (m.k === 'rel') {
        const ty = this.resolveType(m.type, scope);
        const s = this.sym('rel', m.name, ty, m.nameSpan, { owner: d.name });
        this.define(scope, s);
        info.rels.push(s);
      }
    }
    // Actions and processes are names too (fairness and refinement refer to them).
    for (const m of d.members) {
      if (m.k === 'action') {
        const s = this.sym('action', m.name, VOID, m.nameSpan, { decl: m, owner: d.name });
        this.define(scope, s);
        info.actions.push({ decl: m, sym: s, params: [] });
      } else if (m.k === 'process') {
        const s = this.sym('process', m.name, VOID, m.nameSpan, { decl: m, owner: d.name });
        this.define(scope, s);
        info.processes.push({ decl: m, sym: s, params: [], locals: [], labels: collectLabels(m.body) });
      }
    }
    // Initial values.
    for (const m of d.members) {
      if (m.k === 'var' && m.init) {
        const s = info.vars.find((v) => v.name === m.name)!;
        const t = this.expr(m.init, base, s.ty);
        // `var flag: Proc -> bool = false` sets every entry.
        const target = s.ty.k === 'func' && assignable(t, s.ty) === 'no' ? s.ty.result : s.ty;
        this.coerce(m.init, t, target, 'init');
      }
    }
    for (const m of d.members) {
      switch (m.k) {
        case 'fn':
          this.fnBody(this.fns.get(`${d.name}.${m.name}`)!, scope);
          info.fns.push(this.fns.get(`${d.name}.${m.name}`)!);
          break;
        case 'init':
          if (info.init) this.err(m.span, 'system/init', 'A system has at most one `init` block.');
          info.init = m;
          this.block(m.body, { ...base, spec: false, scope: new Scope(scope), inStep: true });
          break;
        case 'action': {
          const a = info.actions.find((x) => x.decl === m)!;
          const ascope = new Scope(scope);
          a.params = m.params.map((p) => {
            const s = this.sym('param', p.name, this.resolveType(p.type, scope), p.span, { owner: m.name });
            this.define(ascope, s);
            this.paramDomain(s, p.span, m.guard);
            return s;
          });
          if (m.guard) this.expectBool(m.guard, { ...base, scope: ascope }, 'when');
          this.block(m.body, { ...base, spec: false, scope: new Scope(ascope), inStep: true });
          break;
        }
        case 'process': {
          const p = info.processes.find((x) => x.decl === m)!;
          const pscope = new Scope(scope);
          p.params = m.params.map((q) => {
            const s = this.sym('param', q.name, this.resolveType(q.type, scope), q.span, { owner: m.name });
            this.define(pscope, s);
            if (finiteSize(s.ty) === undefined) this.err(q.span, 'system/process-param', `A process parameter must range over a finite type (like \`0..2\` or a declared type with an \`instance\` size), so the checker knows how many copies run; ${showTy(s.ty)} is not finite.`);
            return s;
          });
          const pctx: Ctx = { ...base, spec: false, scope: pscope, process: p, inStep: true };
          this.block(m.body, pctx, true);
          // Process-local variables: every `var` declared directly in the body (not inside a loop).
          for (const st of m.body.stmts) {
            const inner = st.k === 'label' ? st.stmt : st;
            if (inner.k === 'let' && inner.mutable) {
              const sym = this.refs.get(inner);
              if (sym) p.locals.push(sym);
            }
          }
          const dup = p.labels.find((l, i) => p.labels.indexOf(l) !== i);
          if (dup) this.err(m.nameSpan, 'system/label', `The label “${dup}” is used twice in process ${m.name}.`);
          break;
        }
        case 'invariant':
          info.invariants.push(m);
          this.expectBool(m.expr, base, 'invariant');
          break;
        case 'property': {
          info.properties.push(m);
          const t = this.expr(m.expr, base, TEMPORAL);
          if (!isPermissive(t) && t.k !== 'bool' && t.k !== 'temporal') this.err(m.expr.span, 'type/property', `A property is a temporal formula, not ${showTy(t)}.`);
          break;
        }
        case 'fact':
        case 'check':
        case 'run':
        case 'constraint':
          (m.k === 'fact' ? info.facts : m.k === 'constraint' ? info.constraints : info.checks).push(m);
          this.expectBool(m.expr, base, m.k);
          break;
        case 'fairness':
          info.fairness.push(m);
          for (const t of m.targets) {
            const s = scope.lookup(t.name);
            if (!s || (s.kind !== 'action' && s.kind !== 'process')) this.err(t.span, 'system/fairness', `Fairness applies to an action or a process; “${t.name}” is neither.`);
            else this.use(t, s, t.span);
          }
          break;
        case 'refines': {
          info.refines = m;
          const spec = this.containers.get(m.spec);
          if (!spec) this.err(m.span, 'system/refines', `No system called “${m.spec}” to refine.`);
          else if (spec.decl.span.start > m.span.start) this.err(m.span, 'system/refines', `Declare ${m.spec} before the system that refines it.`);
          for (const item of m.mapping) {
            const target = spec?.vars.find((v) => v.name === item.name);
            if (spec && !target) this.err(item.span, 'system/refines', `${m.spec} has no state variable called “${item.name}”.`);
            const t = this.expr(item.value, base, target?.ty);
            if (target && !isPermissive(t) && assignable(t, target.ty) === 'no') this.err(item.value.span, 'type/refines', `${item.name} in ${m.spec} has type ${showTy(target.ty)}, but this is ${showTy(t)}.`);
          }
          if (spec) for (const v of spec.vars) if (!m.mapping.some((x) => x.name === v.name) && !info.vars.some((w) => w.name === v.name)) this.err(m.span, 'system/refines', `The refinement mapping must give a value to ${m.spec}’s variable ${v.name} (or this system must have a variable of the same name).`);
          break;
        }
        case 'solve':
        case 'count':
          info.goal = m.k;
          break;
      }
    }
    if (d.k === 'system' && !info.actions.length && !info.processes.length) this.warn(d.nameSpan, 'system/static', 'This system has no actions or processes: its state never changes.');
  }

  /** Action parameters must range over something finite, or be drawn from a state set by the guard (`m in net`). */
  paramDomain(s: Sym, span: Span, guard: A.Expr | undefined): void {
    if (finiteSize(s.ty) !== undefined) return;
    const fromGuard = guard && conjuncts(guard).some((c) => c.k === 'binary' && c.op === 'in' && c.left.k === 'var' && c.left.name === s.name);
    if (!fromGuard && s.ty.k !== 'atom') this.err(span, 'system/action-param', `The checker must try every value of “${s.name}”, so its type must be finite, or the guard must say where it comes from (\`when ${s.name} in someSet\`).`);
  }

  // ── Statements ──
  block(b: A.Block, ctx: Ctx, keepScope = false): void {
    const scope = keepScope ? ctx.scope : new Scope(ctx.scope);
    this.scopes.push({ span: b.span, scope });
    const inner = { ...ctx, scope };
    for (const s of b.stmts) this.stmt(s, inner);
  }

  stmt(s: A.Stmt, ctx: Ctx): void {
    switch (s.k) {
      case 'let': {
        const want = s.type ? this.resolveType(s.type, ctx.scope) : undefined;
        let ty = want ?? ERR;
        if (s.init) {
          const t = this.expr(s.init, { ...ctx, allowExecCall: true }, want);
          if (want) this.coerce(s.init, t, want, 'let');
          else ty = widenLiteral(t);
        } else if (!want) this.err(s.nameSpan, 'type/annotate', `Give “${s.name}” a type or an initial value: \`var ${s.name}: int = 0\`.`);
        else if (!s.mutable) this.err(s.nameSpan, 'stmt/let-init', `A \`let\` needs a value; use \`var\` for a variable you assign later.`);
        const sym = this.sym(ctx.process && ctx.scope === ctx.scope ? 'local' : 'local', s.name, ty, s.nameSpan, { mutable: s.mutable, ghost: s.ghost || ctx.ghost, owner: ctx.fn?.decl.name ?? ctx.process?.decl.name });
        this.refs.set(s, sym);
        this.define(ctx.scope, sym);
        ctx.fn?.locals.push(sym);
        break;
      }
      case 'multi': {
        if (s.targets.length !== s.values.length) {
          this.err(s.span, 'stmt/multi', `${s.targets.length} targets but ${s.values.length} values.`);
          return;
        }
        const tys = s.values.map((v, i) => {
          if (s.declare) return this.expr(v, ctx);
          return this.expr(v, ctx, this.peekLvalueType(s.targets[i]!, ctx));
        });
        s.targets.forEach((t, i) => {
          if (s.declare && t.k === 'var') {
            const sym = this.sym('local', t.name, widenLiteral(tys[i]!), t.span, { mutable: s.mutable, ghost: ctx.ghost });
            this.define(ctx.scope, sym);
            this.use(t, sym, t.span);
            this.types.set(t, sym.ty);
            ctx.fn?.locals.push(sym);
          } else {
            const lt = this.lvalue(t, ctx);
            this.coerce(s.values[i]!, tys[i]!, lt, 'assign');
          }
        });
        break;
      }
      case 'assign': {
        const lt = this.lvalue(s.target, ctx);
        const vt = this.expr(s.value, { ...ctx, allowExecCall: s.op === '=' }, lt);
        if (s.op !== '=') {
          if (!isPermissive(lt) && !isIntLike(lt) && lt.k !== 'bv') this.err(s.span, 'type/compound', `\`${s.op}\` works on numbers, not ${showTy(lt)}.`);
          const t = this.arith(s.op[0] as '+', lt, vt, ctx, s.span);
          this.coerce(s.value, t, lt, 'assign');
        } else this.coerce(s.value, vt, lt, 'assign');
        break;
      }
      case 'if':
        this.expectBool(s.cond, ctx, 'if');
        this.block(s.then, ctx);
        if (s.else) !isBlock(s.else) ? this.stmt(s.else, ctx) : this.block(s.else, ctx);
        break;
      case 'while':
        this.expectBool(s.cond, ctx, 'while');
        this.loopSpec(s.spec, ctx);
        this.block(s.body, { ...ctx, inLoop: true });
        break;
      case 'for': {
        const lo = this.expr(s.lo, ctx, INT);
        const hi = this.expr(s.hi, ctx, INT);
        for (const [e, t] of [[s.lo, lo], [s.hi, hi]] as const) if (!isPermissive(t) && !isIntLike(t)) this.err(e.span, 'type/for', `Loop bounds are integers, not ${showTy(t)}.`);
        const scope = new Scope(ctx.scope);
        const v = this.sym('local', s.v, INT, s.vSpan, { mutable: false, owner: ctx.fn?.decl.name });
        this.refs.set(s, v);
        this.define(scope, v);
        ctx.fn?.locals.push(v);
        const inner = { ...ctx, scope };
        this.loopSpec(s.spec, inner);
        this.block(s.body, { ...inner, inLoop: true });
        break;
      }
      case 'loop':
        this.block(s.body, { ...ctx, inLoop: true });
        break;
      case 'atomic':
        if (!ctx.process) this.err(s.span, 'stmt/atomic', '`atomic` groups statements into one step of a process; outside a process every statement already runs on its own.');
        this.block(s.body, ctx);
        break;
      case 'match': {
        const t = this.expr(s.scrutinee, ctx);
        for (const arm of s.arms) {
          const scope = new Scope(ctx.scope);
          this.pattern(arm.pattern, t, scope);
          this.block(arm.body, { ...ctx, scope });
        }
        this.exhaustive(s.scrutinee, t, s.arms.map((a) => a.pattern), s.span);
        break;
      }
      case 'return': {
        if (ctx.process || !ctx.fn) {
          this.err(s.span, 'stmt/return', '`return` is only allowed in a function.');
          return;
        }
        const r = ctx.fn.result;
        if (s.value) {
          if (!r) this.err(s.value.span, 'stmt/return-value', `“${ctx.fn.decl.name}” returns nothing; remove the value.`);
          else this.coerce(s.value, this.expr(s.value, { ...ctx, allowExecCall: true }, r.ty), r.ty, 'return');
        } else if (r && !ctx.fn.decl.result?.name) this.err(s.span, 'stmt/return-missing', `“${ctx.fn.decl.name}” must return a ${showTy(r.ty)}.`);
        break;
      }
      case 'break':
        if (!ctx.inLoop) this.err(s.span, 'stmt/break', '`break` is only allowed inside a loop.');
        break;
      case 'assert':
        this.expectBoolish(s.cond, { ...ctx, spec: true }, 'assert');
        break;
      case 'assume':
        this.expectBoolish(s.cond, { ...ctx, spec: true }, 'assume');
        if (ctx.fn) this.warn(s.span, 'stmt/assume', 'An `assume` is trusted without proof: anything after it is only checked for executions where it holds.');
        break;
      case 'await':
        if (!ctx.inStep) this.err(s.span, 'stmt/await', '`await` blocks a process until a condition holds; it is only allowed in processes and actions.');
        this.expectBool(s.cond, { ...ctx, spec: true }, 'await');
        break;
      case 'choose': {
        const ty = this.resolveType(s.type, ctx.scope);
        if (finiteSize(ty) === undefined && ctx.container) this.err(s.span, 'stmt/choose', `\`choose\` picks any value of a finite type; ${showTy(ty)} is not finite.`);
        const sym = this.sym('local', s.name, ty, s.nameSpan, { mutable: false });
        this.refs.set(s, sym);
        this.define(ctx.scope, sym);
        if (s.where) this.expectBool(s.where, { ...ctx, spec: true }, 'where');
        break;
      }
      case 'free': {
        const t = this.expr(s.target, ctx);
        if (!isPermissive(t) && t.k !== 'ref') this.err(s.target.span, 'heap/free', `\`free\` takes an object reference, not ${showTy(t)}.`);
        break;
      }
      case 'expr': {
        const e = s.expr;
        if (e.k !== 'call') {
          this.err(e.span, 'stmt/expr', 'This expression is computed and then thrown away. Did you mean to assign it (`x = …`) or to `assert` it?');
          this.expr(e, ctx);
          return;
        }
        this.expr(e, { ...ctx, allowExecCall: true, spec: ctx.spec });
        break;
      }
      case 'block':
        this.block(s.body, ctx);
        break;
      case 'label':
        if (!ctx.process) this.warn(s.labelSpan, 'stmt/label', 'Labels name the atomic steps of a process; here the label has no effect.');
        this.stmt(s.stmt, ctx);
        break;
      case 'skip':
        break;
    }
  }

  loopSpec(spec: A.LoopSpec, ctx: Ctx): void {
    for (const inv of spec.invariants) this.expectBoolish(inv.value, { ...ctx, spec: true, allowOld: true }, 'invariant');
    for (const d of spec.decreases ?? []) this.decreasesExpr(d, ctx);
  }

  /** Type of an assignment target without reporting (for typing the right-hand side). */
  peekLvalueType(e: A.Expr, ctx: Ctx): Ty | undefined {
    if (e.k === 'var') return ctx.scope.lookup(e.name)?.ty;
    return undefined;
  }

  lvalue(e: A.Expr, ctx: Ctx): Ty {
    switch (e.k) {
      case 'var': {
        const s = ctx.scope.lookup(e.name);
        if (!s) return this.expr(e, ctx);
        this.use(e, s, e.span);
        this.types.set(e, s.ty);
        if (!s.mutable) {
          const why =
            s.kind === 'param' ? 'Parameters cannot be assigned unless they are declared `inout`.'
            : s.kind === 'local' ? `It was declared with \`let\`; use \`var ${s.name}\` for a variable.`
            : s.kind === 'bound' ? 'It is a bound variable.'
            : '';
          this.err(e.span, 'stmt/immutable', `“${e.name}” cannot be assigned. ${why}`.trim());
        }
        if (ctx.ghost === false && s.ghost === false) {
          /* executable code may write executable state */
        }
        if (ctx.fn && (ctx.fn.decl.flavour === 'lemma' || ctx.fn.decl.ghost) && s.kind !== 'local' && !s.ghost) this.err(e.span, 'ghost/write', `Ghost code cannot change “${e.name}”.`);
        return s.ty;
      }
      case 'index': {
        const t = this.lvalue(e.target, ctx);
        const r = this.indexType(e, t, ctx);
        this.types.set(e, r);
        return r;
      }
      case 'field': {
        // A field of a struct variable, or of an object on the heap.
        const tt = this.expr(e.target, ctx);
        if (tt.k === 'struct') this.lvalue(e.target, ctx);
        const r = this.fieldType(e, tt, ctx);
        this.types.set(e, r);
        return r;
      }
      default:
        this.err(e.span, 'stmt/lvalue', 'You can only assign to a variable, an element `a[i]` or a field `s.f`.');
        return this.expr(e, ctx);
    }
  }

  // ── Expressions ──
  expectBool(e: A.Expr, ctx: Ctx, where: string): void {
    const t = this.expr(e, ctx, BOOL);
    if (!isPermissive(t) && t.k !== 'bool') this.err(e.span, 'type/bool', `The condition of \`${where}\` must be a bool, but this is ${showTy(t)}.`);
  }

  /** Booleans, or separation-logic assertions (in heap code). */
  expectBoolish(e: A.Expr, ctx: Ctx, where: string): void {
    const t = this.expr(e, ctx, BOOL);
    if (!isPermissive(t) && t.k !== 'bool' && t.k !== 'heapprop') this.err(e.span, 'type/bool', `\`${where}\` needs a bool, but this is ${showTy(t)}.`);
  }

  coerce(e: A.Expr, from: Ty, to: Ty, what: string): void {
    // In worlds everything is a relation: a set of atoms of type T stands where an atom of type T is expected
    // (Alloy's convention; the predicate then speaks about every atom of the set at once).
    const unaryOf = (t: Ty) => (t.k === 'rel' && t.cols.length === 1 ? t.cols[0] : undefined);
    if (to.k === 'atom' && unaryOf(from)?.k === 'atom' && (unaryOf(from) as { name: string }).name === to.name) return;
    if (from.k === 'atom' && unaryOf(to)?.k === 'atom' && (unaryOf(to) as { name: string }).name === from.name) return;
    const r = assignable(from, to);
    if (r === 'no') {
      const conv = isIntLike(from) && (to.k === 'mach' || to.k === 'bv') ? ` Convert it explicitly with \`as ${showTy(to)}\` (which is checked).` : '';
      this.err(e.span, 'type/mismatch', `Expected ${showTy(to)} here (${what}), but this is ${showTy(from)}.${conv}`);
    }
  }

  record(e: A.Expr, t: Ty): Ty {
    this.types.set(e, t);
    return t;
  }

  expr(e: A.Expr, ctx: Ctx, expected?: Ty): Ty {
    // Executable calls are only allowed as the whole right-hand side of a statement, never nested.
    if (ctx.allowExecCall && e.k !== 'call') ctx = { ...ctx, allowExecCall: false };
    return this.record(e, this.exprInner(e, ctx, expected));
  }

  exprInner(e: A.Expr, ctx: Ctx, expected?: Ty): Ty {
    switch (e.k) {
      case 'int':
        return this.literal(e, expected);
      case 'bool':
        return BOOL;
      case 'null':
        return expected?.k === 'ref' ? { ...expected, nullable: true } : { k: 'ref', cls: '', nullable: true };
      case 'emp':
        return HEAPPROP;
      case 'var':
        return this.name(e, ctx);
      case 'unary':
        return this.unary(e, ctx, expected);
      case 'binary':
        return this.binary(e, ctx, expected);
      case 'chain': {
        const tys = e.args.map((a) => this.expr(a, ctx));
        tys.forEach((t, i) => {
          if (!isPermissive(t) && !isIntLike(t) && t.k !== 'bv') this.err(e.args[i]!.span, 'type/compare', `Only numbers can be ordered with < and <=; this is ${showTy(t)}.`);
        });
        return BOOL;
      }
      case 'call':
        return this.call(e, ctx, expected);
      case 'index': {
        const t = this.expr(e.target, ctx);
        return this.indexType(e, t, ctx);
      }
      case 'slice': {
        const t = this.expr(e.target, ctx);
        for (const b of [e.lo, e.hi]) if (b) this.intExpr(b, ctx);
        if (!isPermissive(t) && t.k !== 'seq') this.err(e.target.span, 'type/slice', `Only sequences can be sliced; this is ${showTy(t)}.`);
        return t.k === 'seq' ? t : ERR;
      }
      case 'update': {
        const t = this.expr(e.target, ctx);
        if (t.k === 'seq') {
          this.intExpr(e.index, ctx);
          this.coerce(e.value, this.expr(e.value, ctx, t.elem), t.elem, 'element');
          return t;
        }
        if (t.k === 'map') {
          this.coerce(e.index, this.expr(e.index, ctx, t.key), t.key, 'key');
          this.coerce(e.value, this.expr(e.value, ctx, t.val), t.val, 'value');
          return t;
        }
        if (t.k === 'func' && t.params.length === 1) {
          this.coerce(e.index, this.expr(e.index, ctx, t.params[0]), t.params[0]!, 'argument');
          this.coerce(e.value, this.expr(e.value, ctx, t.result), t.result, 'value');
          return t;
        }
        if (!isPermissive(t)) this.err(e.span, 'type/update', `\`[i := v]\` updates a sequence, map or state function, not ${showTy(t)}.`);
        return ERR;
      }
      case 'field': {
        // `Vote.none`: a variant named through its enum.
        if (e.target.k === 'var') {
          const ts = ctx.scope.lookup(e.target.name);
          if (ts?.kind === 'type' && ts.ty.k === 'enum') {
            this.use(e.target, ts, e.target.span);
            const i = ts.ty.variants.findIndex((v) => v.name === e.name);
            if (i < 0) {
              this.err(e.nameSpan, 'name/variant', `${ts.name} has no value “${e.name}”. Its values are ${ts.ty.variants.map((v) => v.name).join(', ')}.`);
              return ERR;
            }
            const vs = ctx.scope.lookup(e.name);
            if (vs?.kind === 'variant') this.use(e, vs, e.nameSpan);
            return ts.ty;
          }
        }
        const t = this.expr(e.target, ctx);
        return this.fieldType(e, t, ctx);
      }
      case 'struct': {
        const s = ctx.scope.lookup(e.name);
        if (!s || s.kind !== 'type' || s.ty.k !== 'struct') {
          this.err(e.span, 'name/struct', `“${e.name}” is not a struct.`);
          e.fields.forEach((f) => this.expr(f.value, ctx));
          return ERR;
        }
        this.use(e, s, { start: e.span.start, end: e.span.start + e.name.length });
        const st = s.ty;
        for (const f of e.fields) {
          const fd = st.fields.find((x) => x.name === f.name);
          if (!fd) {
            this.err(f.span, 'name/field', `${e.name} has no field “${f.name}”.`);
            this.expr(f.value, ctx);
          } else this.coerce(f.value, this.expr(f.value, ctx, fd.ty), fd.ty, `field ${f.name}`);
        }
        const missing = st.fields.filter((fd) => !e.fields.some((f) => f.name === fd.name)).map((f) => f.name);
        if (missing.length) this.err(e.span, 'type/missing-field', `Missing field${missing.length > 1 ? 's' : ''} ${missing.join(', ')} of ${e.name}.`);
        return st;
      }
      case 'new': {
        const ty = this.classes.get(e.cls);
        if (!ty || ty.k !== 'struct') {
          this.err(e.span, 'heap/new', `Unknown class “${e.cls}”.`);
          return ERR;
        }
        for (const f of e.fields) {
          const fd = ty.fields.find((x) => x.name === f.name);
          if (!fd) this.err(f.span, 'name/field', `${e.cls} has no field “${f.name}”.`);
          else this.coerce(f.value, this.expr(f.value, ctx, fd.ty), fd.ty, `field ${f.name}`);
        }
        return { k: 'ref', cls: e.cls, nullable: false };
      }
      case 'seqlit': {
        const want = expected?.k === 'seq' ? expected.elem : undefined;
        let elem: Ty = want ?? UNKNOWN;
        for (const x of e.elems) {
          const t = this.expr(x, ctx, want ?? (isPermissive(elem) ? undefined : elem));
          const j = want ? (assignable(t, want) !== 'no' ? want : undefined) : join(elem, widenLiteral(t));
          if (!j) this.err(x.span, 'type/elements', `All elements of a sequence have one type; this is ${showTy(t)}, the others are ${showTy(elem)}.`);
          else elem = j;
        }
        return { k: 'seq', elem };
      }
      case 'setlit': {
        const kind = expected?.k === 'multiset' ? 'multiset' : 'set';
        const want = expected?.k === 'set' || expected?.k === 'multiset' ? expected.elem : undefined;
        let elem: Ty = want ?? UNKNOWN;
        for (const x of e.elems) {
          const t = this.expr(x, ctx, want);
          const j = want ? (assignable(t, want) !== 'no' ? want : undefined) : join(elem, widenLiteral(t));
          if (!j) this.err(x.span, 'type/elements', `All elements of a set have one type; this is ${showTy(t)}, the others are ${showTy(elem)}.`);
          else elem = j;
        }
        return { k: kind, elem };
      }
      case 'tuple':
        return { k: 'tuple', elems: e.elems.map((x, i) => this.expr(x, ctx, expected?.k === 'tuple' ? expected.elems[i] : undefined)) };
      case 'quant': {
        const scope = new Scope(ctx.scope);
        this.binders(e.binders, ctx, scope);
        const inner = { ...ctx, scope, spec: true };
        for (const trig of e.triggers) for (const t of trig) this.expr(t, inner);
        const t = this.expr(e.body, inner, expected?.k === 'heapprop' || expected?.k === 'temporal' ? expected : BOOL);
        if (!isPermissive(t) && t.k !== 'bool' && t.k !== 'heapprop' && t.k !== 'temporal') this.err(e.body.span, 'type/bool', `The body of a quantifier is a condition (bool), not ${showTy(t)}.`);
        return t.k === 'heapprop' || t.k === 'temporal' ? t : BOOL;
      }
      case 'comprehension': {
        const scope = new Scope(ctx.scope);
        const bs = this.binders(e.binders, ctx, scope);
        const inner = { ...ctx, scope, spec: true };
        this.expectBool(e.body, inner, 'comprehension');
        if (e.seq) {
          if (bs.length !== 1 || !e.binders[0]!.range || 'set' in e.binders[0]!.range) this.err(e.span, 'type/seq-comprehension', 'A sequence comprehension has one variable over a range: `[f(k) | k in 0..n]`.');
          const vt = this.expr(e.value!, inner);
          return { k: 'seq', elem: widenLiteral(vt) };
        }
        if (e.value) return { k: 'set', elem: widenLiteral(this.expr(e.value, inner)) };
        if (bs.length !== 1) this.err(e.span, 'type/comprehension', 'A set comprehension binds one variable: `{ x: T | condition }`.');
        const bt = bs[0]?.ty ?? ERR;
        if (bt.k === 'atom' && ctx.container?.kind === 'world') return { k: 'rel', cols: [bt] };
        return { k: 'set', elem: bt };
      }
      case 'mult': {
        const t = this.expr(e.arg, ctx);
        if (!isPermissive(t) && !['set', 'multiset', 'seq', 'rel', 'atom'].includes(t.k)) this.err(e.arg.span, 'type/mult', `\`${e.m}\` applies to a set or relation, not ${showTy(t)}.`);
        return BOOL;
      }
      case 'if': {
        this.expectBool(e.cond, ctx, 'if');
        const a = this.expr(e.then, ctx, expected);
        const b = this.expr(e.else, ctx, expected);
        const j = join(a, b);
        if (!j) {
          this.err(e.span, 'type/branches', `The two branches have different types: ${showTy(a)} and ${showTy(b)}.`);
          return ERR;
        }
        return j;
      }
      case 'match': {
        const st = this.expr(e.scrutinee, ctx);
        let result: Ty | undefined;
        for (const arm of e.arms) {
          const scope = new Scope(ctx.scope);
          this.pattern(arm.pattern, st, scope);
          const t = this.expr(arm.body, { ...ctx, scope }, expected);
          const j = result ? join(result, t) : t;
          if (!j) this.err(arm.body.span, 'type/branches', `This arm has type ${showTy(t)}, the others ${showTy(result!)}.`);
          else result = j;
        }
        this.exhaustive(e.scrutinee, st, e.arms.map((a) => a.pattern), e.span);
        return result ?? ERR;
      }
      case 'block': {
        const scope = new Scope(ctx.scope);
        for (const l of e.lets) {
          const want = l.type ? this.resolveType(l.type, ctx.scope) : undefined;
          const t = this.expr(l.value, { ...ctx, scope }, want);
          if (want) this.coerce(l.value, t, want, 'let');
          const s = this.sym('local', l.name, want ?? widenLiteral(t), l.span, { mutable: false });
          this.refs.set(l, s);
          this.define(scope, s);
        }
        return this.expr(e.body, { ...ctx, scope }, expected);
      }
      case 'old': {
        if (!ctx.allowOld) this.err(e.span, 'spec/old', '`old(e)` means “e when the function was called”: it is only allowed in a postcondition, a loop invariant or an assertion of a function.');
        if (ctx.inOld) this.warn(e.span, 'spec/old-nested', '`old` inside `old` has no further effect.');
        return this.expr(e.arg, { ...ctx, inOld: true }, expected);
      }
      case 'at': {
        if (e.proc.k !== 'call') {
          this.err(e.proc.span, 'system/at', 'Write `P(i) at label`: the process, its parameters, and the label of a step.');
          return BOOL;
        }
        const ps = ctx.scope.lookup(e.proc.callee);
        if (!ps || ps.kind !== 'process') {
          this.err(e.proc.calleeSpan, 'system/at', `“${e.proc.callee}” is not a process.`);
          e.proc.args.forEach((a) => this.expr(a, ctx));
          return BOOL;
        }
        this.use(e.proc, ps, e.proc.calleeSpan);
        const info = ctx.container?.processes.find((p) => p.sym === ps);
        const params = info?.params ?? [];
        if (e.proc.args.length !== (info?.decl.params.length ?? 0)) this.err(e.proc.span, 'system/at-args', `Process ${ps.name} takes ${info?.decl.params.length ?? 0} parameter(s).`);
        e.proc.args.forEach((a, i) => {
          const pt = params[i]?.ty;
          const t = this.expr(a, ctx, pt);
          if (pt) this.coerce(a, t, pt, 'process parameter');
        });
        this.types.set(e.proc, VOID);
        if (info && !info.labels.includes(e.label)) {
          const hint = suggest(e.label, info.labels);
          this.err(e.labelSpan, 'system/label', `Process ${ps.name} has no step labelled “${e.label}”.${hint.length ? ` Did you mean “${hint[0]}”?` : ` Its labels are ${info.labels.join(', ')}.`}`);
        }
        return BOOL;
      }
      case 'cast': {
        const from = this.expr(e.arg, ctx);
        const to = this.resolveType(e.type, ctx.scope);
        if (!isPermissive(from) && !((isIntLike(from) || from.k === 'bv') && (isIntLike(to) || to.k === 'bv')))
          this.err(e.span, 'type/cast', `\`as\` converts between number types; it cannot turn ${showTy(from)} into ${showTy(to)}.`);
        return to;
      }
    }
  }

  literal(e: A.Expr & { k: 'int' }, expected?: Ty): Ty {
    if (expected && (expected.k === 'mach' || expected.k === 'bv' || expected.k === 'range' || expected.k === 'nat')) {
      const [lo, hi] = expected.k === 'bv' ? [0n, (1n << BigInt(expected.bits)) - 1n] : intBounds(expected);
      if ((lo !== undefined && e.value < lo) || (hi !== undefined && e.value > hi)) {
        if (expected.k === 'mach' || expected.k === 'bv') this.err(e.span, 'type/literal-range', `${e.value} does not fit in ${showTy(expected)} (${lo}…${hi}).`);
        return INT;
      }
      return expected;
    }
    return INT;
  }

  name(e: A.Expr & { k: 'var' }, ctx: Ctx): Ty {
    const s = ctx.scope.lookup(e.name);
    if (!s) {
      if (BUILTINS.includes(e.name)) {
        this.err(e.span, 'name/builtin', `\`${e.name}\` is a function: call it, as in \`${e.name}(…)\`.`);
        return ERR;
      }
      const hint = suggest(e.name, ctx.scope.visible().map((x) => x.name));
      this.err(e.span, 'name/unknown', `Unknown name “${e.name}”.${hint.length ? ` Did you mean ${hint.map((h) => `“${h}”`).join(' or ')}?` : ''}`);
      return ERR;
    }
    this.use(e, s, e.span);
    switch (s.kind) {
      case 'type':
        if (s.ty.k === 'atom' && ctx.container?.kind === 'world') return { k: 'rel', cols: [s.ty] };
        this.err(e.span, 'name/type', `“${e.name}” is a type, not a value.`);
        return ERR;
      case 'fn':
        this.err(e.span, 'name/fn', `“${e.name}” is a function: call it with arguments.`);
        return ERR;
      case 'process':
      case 'action':
      case 'container':
        this.err(e.span, 'name/not-value', `“${e.name}” is ${s.kind === 'container' ? 'a system' : `an ${s.kind}`}, not a value.`);
        return ERR;
      case 'const':
        if (isPermissive(s.ty) && s.decl?.k === 'const') this.checkConst(s.decl, { ...ctx, scope: ctx.scope });
        return s.ty;
      default:
        if (ctx.spec === false && s.ghost && !ctx.ghost && ctx.fn && !ctx.fn.decl.ghost) {
          /* reading ghost state in executable code is reported by the ghost pass below */
        }
        return s.ty;
    }
  }

  intExpr(e: A.Expr, ctx: Ctx): Ty {
    const t = this.expr(e, ctx, INT);
    if (!isPermissive(t) && !isIntLike(t)) this.err(e.span, 'type/int', `Expected an integer, but this is ${showTy(t)}.`);
    return t;
  }

  /** Result type of + - * / % on two numbers. In specifications, integer arithmetic is mathematical. */
  arith(op: '+' | '-' | '*' | '/' | '%', l: Ty, r: Ty, ctx: Ctx, span: Span): Ty {
    if (isPermissive(l) || isPermissive(r)) return isPermissive(l) ? r : l;
    if (l.k === 'bv' || r.k === 'bv') {
      if (l.k === 'bv' && r.k === 'bv' && l.bits !== r.bits) this.err(span, 'type/bv-width', `Both operands must have the same width: ${showTy(l)} and ${showTy(r)}.`);
      else if (l.k !== r.k) this.err(span, 'type/bv-mix', `Bit-vectors do not mix with integers; convert with \`as ${showTy(l.k === 'bv' ? l : r)}\`.`);
      return l.k === 'bv' ? l : r;
    }
    if (!isIntLike(l) || !isIntLike(r)) {
      this.err(span, 'type/arith', `\`${op}\` works on numbers, not ${showTy(isIntLike(l) ? r : l)}.`);
      return ERR;
    }
    if (l.k === 'mach' || r.k === 'mach') {
      if (l.k === 'mach' && r.k === 'mach' && !tyEq(l, r)) {
        // Lossless widening of one side is allowed.
        if (assignable(l, r) === 'ok') return ctx.spec ? INT : r;
        if (assignable(r, l) === 'ok') return ctx.spec ? INT : l;
        this.err(span, 'type/mach-mix', `Cannot mix ${showTy(l)} and ${showTy(r)}: convert one side with \`as\`.`);
        return ERR;
      }
      if (ctx.spec) return INT;
      const m = l.k === 'mach' ? l : r;
      const other = l.k === 'mach' ? r : l;
      // Mixing a machine integer with a mathematical one gives a mathematical result unless the other side fits.
      return assignable(other, m) === 'ok' ? m : INT;
    }
    return INT;
  }

  unary(e: A.Expr & { k: 'unary' }, ctx: Ctx, expected?: Ty): Ty {
    switch (e.op) {
      case '-': {
        const t = this.expr(e.arg, ctx, expected);
        if (!isPermissive(t) && !isIntLike(t) && t.k !== 'bv') this.err(e.span, 'type/neg', `Only numbers can be negated, not ${showTy(t)}.`);
        if (t.k === 'mach') return ctx.spec ? INT : t;
        return t.k === 'bv' ? t : isIntLike(t) ? INT : t;
      }
      case '!': {
        const t = this.expr(e.arg, ctx, expected?.k === 'temporal' ? expected : BOOL);
        if (!isPermissive(t) && t.k !== 'bool' && t.k !== 'temporal') this.err(e.span, 'type/not', `\`!\` negates a condition, not ${showTy(t)}.`);
        return t.k === 'temporal' ? t : BOOL;
      }
      case '~': {
        const t = this.expr(e.arg, ctx, expected);
        if (t.k === 'rel') {
          if (t.cols.length !== 2) this.err(e.span, 'world/transpose', '`~` transposes a binary relation.');
          return { k: 'rel', cols: [...t.cols].reverse() };
        }
        if (!isPermissive(t) && t.k !== 'bv') this.err(e.span, 'type/bitnot', `\`~\` flips the bits of a bit-vector, not ${showTy(t)}.`);
        return t;
      }
      case '#': {
        const t = this.expr(e.arg, ctx);
        if (!isPermissive(t) && !['set', 'multiset', 'seq', 'rel', 'map'].includes(t.k)) this.err(e.span, 'type/card', `\`#\` counts the elements of a set or relation, not ${showTy(t)}.`);
        return INT;
      }
      case '^':
      case '*': {
        const t = this.expr(e.arg, ctx);
        if (!isPermissive(t) && (t.k !== 'rel' || t.cols.length !== 2)) this.err(e.span, 'world/closure', `\`${e.op}\` is the ${e.op === '^' ? 'transitive' : 'reflexive-transitive'} closure of a binary relation.`);
        return t;
      }
      case 'always':
      case 'eventually':
      case 'next': {
        if (!ctx.container) this.err(e.span, 'temporal/where', `\`${e.op}\` is a temporal operator: it is only meaningful in a system's \`property\`.`);
        const t = this.expr(e.arg, ctx, TEMPORAL);
        if (!isPermissive(t) && t.k !== 'bool' && t.k !== 'temporal') this.err(e.arg.span, 'type/temporal', `\`${e.op}\` applies to a condition, not ${showTy(t)}.`);
        return TEMPORAL;
      }
    }
  }

  binary(e: A.Expr & { k: 'binary' }, ctx: Ctx, expected?: Ty): Ty {
    const op = e.op;
    switch (op) {
      case '&&':
      case '||':
      case '==>':
      case '<==':
      case '<==>': {
        const want = expected?.k === 'heapprop' || expected?.k === 'temporal' ? expected : BOOL;
        const l = this.expr(e.left, ctx, want);
        const r = this.expr(e.right, ctx, want);
        for (const [x, t] of [[e.left, l], [e.right, r]] as const)
          if (!isPermissive(t) && t.k !== 'bool' && t.k !== 'heapprop' && t.k !== 'temporal') this.err(x.span, 'type/bool', `\`${op}\` combines conditions (bool), but this is ${showTy(t)}.`);
        if (l.k === 'temporal' || r.k === 'temporal') return TEMPORAL;
        if (l.k === 'heapprop' || r.k === 'heapprop') {
          if (op === '||' || op === '<==>') this.warn(e.span, 'heap/disjunction', 'Disjunctions of heap assertions are hard for the separation-logic engine; prefer `if … { … } else { … }`.');
          return HEAPPROP;
        }
        return BOOL;
      }
      case '**': {
        for (const x of [e.left, e.right]) {
          const t = this.expr(x, ctx, HEAPPROP);
          if (!isPermissive(t) && t.k !== 'bool' && t.k !== 'heapprop') this.err(x.span, 'heap/star', `\`**\` joins heap assertions, not ${showTy(t)}.`);
        }
        return HEAPPROP;
      }
      case '|->': {
        if (e.left.k !== 'field') this.err(e.left.span, 'heap/points-to', 'The left side of `|->` is a field of an object: `x.next |-> y`.');
        const l = this.expr(e.left, { ...ctx, pointsTo: true } as Ctx);
        const r = this.expr(e.right, ctx, l);
        this.coerce(e.right, r, l, 'points-to value');
        return HEAPPROP;
      }
      case 'until':
      case '~>': {
        for (const x of [e.left, e.right]) {
          const t = this.expr(x, ctx, TEMPORAL);
          if (!isPermissive(t) && t.k !== 'bool' && t.k !== 'temporal') this.err(x.span, 'type/temporal', `\`${op}\` relates conditions, not ${showTy(t)}.`);
        }
        if (!ctx.container) this.err(e.span, 'temporal/where', `\`${op}\` is a temporal operator: it is only meaningful in a system's \`property\`.`);
        return TEMPORAL;
      }
      case '==':
      case '!=': {
        const l = this.expr(e.left, ctx);
        const r = this.expr(e.right, ctx, isPermissive(l) ? undefined : l);
        // Re-type a literal on the left against the right.
        if (e.left.k === 'int') this.types.set(e.left, this.literal(e.left, r));
        if (!join(l, r) && !(l.k === 'atom' && r.k === 'rel') && !(l.k === 'rel' && r.k === 'atom')) this.err(e.span, 'type/compare-types', `These cannot be equal: one is ${showTy(l)}, the other ${showTy(r)}.`);
        return BOOL;
      }
      case '<':
      case '<=':
      case '>':
      case '>=': {
        const l = this.expr(e.left, ctx);
        const r = this.expr(e.right, ctx, isPermissive(l) ? undefined : l);
        if (e.left.k === 'int') this.types.set(e.left, this.literal(e.left, r));
        const okNum = (t: Ty) => isPermissive(t) || isIntLike(t) || t.k === 'bv';
        const okSet = (t: Ty) => isPermissive(t) || t.k === 'set' || t.k === 'multiset';
        if (!((okNum(l) && okNum(r)) || (okSet(l) && okSet(r) && (op === '<' || op === '<='))))
          this.err(e.span, 'type/compare', `\`${op}\` compares numbers${op === '<' || op === '<=' ? ' (or tests a subset)' : ''}; here it gets ${showTy(l)} and ${showTy(r)}.`);
        if ((l.k === 'bv') !== (r.k === 'bv') && !isPermissive(l) && !isPermissive(r) && e.left.k !== 'int' && e.right.k !== 'int') this.err(e.span, 'type/bv-mix', 'Bit-vectors do not mix with integers; convert with `as`.');
        return BOOL;
      }
      case 'in':
      case '!in': {
        const r = this.expr(e.right, ctx);
        const elem = r.k === 'seq' || r.k === 'set' || r.k === 'multiset' ? r.elem : r.k === 'map' ? r.key : undefined;
        const l = this.expr(e.left, ctx, elem);
        if (r.k === 'rel' || (ctx.container?.kind === 'world' && (l.k === 'rel' || l.k === 'atom'))) return BOOL;
        if (!isPermissive(r) && !elem) this.err(e.right.span, 'type/in', `\`${op}\` tests membership in a sequence, set, multiset or map, not ${showTy(r)}.`);
        else if (elem) this.coerce(e.left, l, elem, 'element');
        return BOOL;
      }
      case '+':
      case '-': {
        const l = this.expr(e.left, ctx, expected);
        const r = this.expr(e.right, ctx, isPermissive(l) || isIntLike(l) ? (expected && isIntLike(expected) ? expected : l.k === 'int' ? undefined : l) : l);
        if (e.left.k === 'int' && !isPermissive(r)) this.types.set(e.left, this.literal(e.left, r));
        if (l.k === 'set' || l.k === 'multiset' || l.k === 'rel') {
          if (!join(l, r) && !(l.k === 'rel' && r.k === 'atom')) this.err(e.span, 'type/set-op', `Both sides of \`${op}\` must be ${l.k}s of the same type; the right side is ${showTy(r)}.`);
          return join(l, r) ?? l;
        }
        if (l.k === 'map' && op === '-') return l;
        return this.arith(op, this.types.get(e.left) ?? l, r, ctx, e.span);
      }
      case '*':
      case '/':
      case '%': {
        const l = this.expr(e.left, ctx, expected);
        const r = this.expr(e.right, ctx, isPermissive(l) ? undefined : l.k === 'int' ? undefined : l);
        if (e.left.k === 'int' && !isPermissive(r)) this.types.set(e.left, this.literal(e.left, r));
        return this.arith(op, this.types.get(e.left) ?? l, r, ctx, e.span);
      }
      case '++': {
        const l = this.expr(e.left, ctx, expected);
        const r = this.expr(e.right, ctx, l.k === 'seq' ? l : expected);
        const j = join(l, r);
        if (!isPermissive(l) && (l.k !== 'seq' || !j)) this.err(e.span, 'type/concat', `\`++\` joins two sequences of the same type; here ${showTy(l)} and ${showTy(r)}.`);
        return j ?? ERR;
      }
      case '&':
      case '|':
      case '^': {
        const l = this.expr(e.left, ctx, expected);
        const r = this.expr(e.right, ctx, l);
        if ((l.k === 'set' || l.k === 'multiset' || l.k === 'rel') && op === '&') return join(l, r) ?? l;
        if (!isPermissive(l) && l.k !== 'bv') this.err(e.left.span, 'type/bitwise', `\`${op}\` works on bit-vectors${op === '&' ? ' (or intersects sets)' : ''}, not ${showTy(l)}.`);
        if (!isPermissive(l) && !isPermissive(r) && !tyEq(l, r) && !(e.right.k === 'int')) this.err(e.span, 'type/bv-width', `Both operands must have the same type: ${showTy(l)} and ${showTy(r)}.`);
        return l;
      }
      case '<<':
      case '>>': {
        const l = this.expr(e.left, ctx, expected);
        const r = this.expr(e.right, ctx, l);
        if (!isPermissive(l) && l.k !== 'bv') this.err(e.left.span, 'type/shift', `Shifts work on bit-vectors, not ${showTy(l)}.`);
        if (!isPermissive(r) && r.k !== 'bv' && !isIntLike(r)) this.err(e.right.span, 'type/shift', 'The shift amount is a number.');
        return l;
      }
      case '.': {
        // Relational join (worlds): `d.^parent`, `x.(r + s)`.
        const l = this.expr(e.left, ctx);
        const r = this.expr(e.right, ctx);
        return this.joinType(l, r, e.span);
      }
    }
  }

  joinType(l: Ty, r: Ty, span: Span): Ty {
    const cols = (t: Ty): Ty[] | undefined => (t.k === 'rel' ? t.cols : t.k === 'atom' ? [t] : undefined);
    const a = cols(l);
    const b = cols(r);
    if (isPermissive(l) || isPermissive(r)) return ERR;
    if (!a || !b) {
      this.err(span, 'world/join', `\`.\` joins relations; here ${showTy(l)} and ${showTy(r)}.`);
      return ERR;
    }
    if (a.length + b.length - 2 < 1) {
      this.err(span, 'world/join', 'This join produces nothing: both sides are sets of atoms.');
      return ERR;
    }
    return { k: 'rel', cols: [...a.slice(0, -1), ...b.slice(1)] };
  }

  indexType(e: A.Expr & { k: 'index' }, t: Ty, ctx: Ctx): Ty {
    if (isPermissive(t)) {
      e.indices.forEach((i) => this.expr(i, ctx));
      return ERR;
    }
    if (t.k === 'seq') {
      if (e.indices.length !== 1) this.err(e.span, 'type/index', 'A sequence takes one index.');
      e.indices.forEach((i) => this.intExpr(i, ctx));
      return t.elem;
    }
    if (t.k === 'map') {
      e.indices.forEach((i) => this.coerce(i, this.expr(i, ctx, t.key), t.key, 'key'));
      return t.val;
    }
    if (t.k === 'func') {
      if (e.indices.length !== t.params.length) this.err(e.span, 'type/index', `This state function takes ${t.params.length} argument(s).`);
      e.indices.forEach((i, k) => {
        const pt = t.params[k];
        const it = this.expr(i, ctx, pt);
        if (pt) this.coerce(i, it, pt, 'argument');
      });
      return t.result;
    }
    if (t.k === 'bv') {
      e.indices.forEach((i) => this.intExpr(i, ctx));
      return BOOL;
    }
    this.err(e.target.span, 'type/index', `Only sequences, maps and state functions can be indexed; this is ${showTy(t)}.`);
    e.indices.forEach((i) => this.expr(i, ctx));
    return ERR;
  }

  fieldType(e: A.Expr & { k: 'field' }, t: Ty, ctx: Ctx): Ty {
    if (isPermissive(t)) return ERR;
    if (t.k === 'struct') {
      const f = t.fields.find((x) => x.name === e.name);
      if (!f) {
        const hint = suggest(e.name, t.fields.map((x) => x.name));
        this.err(e.nameSpan, 'name/field', `${t.name} has no field “${e.name}”.${hint.length ? ` Did you mean “${hint[0]}”?` : ''}`);
        return ERR;
      }
      return f.ty;
    }
    if (t.k === 'ref') {
      const cls = this.classes.get(t.cls);
      const f = cls?.k === 'struct' ? cls.fields.find((x) => x.name === e.name) : undefined;
      if (!f) {
        this.err(e.nameSpan, 'name/field', `Class ${t.cls} has no field “${e.name}”.`);
        return ERR;
      }
      return f.ty;
    }
    if (t.k === 'atom' || t.k === 'rel') {
      // A relational join with a named relation: `d.parent`.
      const r = ctx.scope.lookup(e.name);
      if (r?.kind === 'rel') {
        this.use(e, r, e.nameSpan);
        return this.joinType(t, r.ty, e.span);
      }
      this.err(e.nameSpan, 'world/join', `No relation called “${e.name}”.`);
      return ERR;
    }
    this.err(e.nameSpan, 'name/field', `${showTy(t)} has no fields.`);
    return ERR;
  }

  binders(bs: A.Binder[], ctx: Ctx, scope: Scope): Sym[] {
    return bs.map((b) => {
      let ty: Ty = INT;
      if (b.type) ty = this.resolveType(b.type, ctx.scope);
      else if (b.range && 'set' in b.range) {
        const st = this.expr(b.range.set, ctx);
        ty = st.k === 'seq' || st.k === 'set' || st.k === 'multiset' ? st.elem : st.k === 'map' ? st.key : st.k === 'rel' && st.cols.length === 1 ? st.cols[0]! : isPermissive(st) ? ERR : (this.err(b.range.set.span, 'type/binder', `A variable can range over a sequence, set or map, not ${showTy(st)}.`), ERR);
      } else if (b.range) {
        this.intExpr(b.range.lo, ctx);
        this.intExpr(b.range.hi, ctx);
      }
      const s = this.sym('bound', b.name, ty, b.span, { mutable: false });
      this.refs.set(b, s);
      scope.names.set(b.name, s);
      return s;
    });
  }

  pattern(p: A.Pattern, t: Ty, scope: Scope): void {
    if (p.k === 'wild') return;
    if (p.k === 'lit') {
      this.expr(p.value, { scope, spec: true }, t);
      return;
    }
    if (t.k !== 'enum') {
      if (!isPermissive(t)) this.err(p.span, 'type/pattern', `Patterns with names match enumeration values; this is ${showTy(t)}.`);
      return;
    }
    const v = t.variants.find((x) => x.name === p.name);
    if (!v) {
      this.err(p.span, 'name/variant', `${t.name} has no value “${p.name}”. Its values are ${t.variants.map((x) => x.name).join(', ')}.`);
      return;
    }
    const vs = scope.lookup(p.name);
    if (vs) this.use(p, vs, { start: p.span.start, end: p.span.start + p.name.length });
    if (p.binds.length !== v.fields.length) this.err(p.span, 'type/pattern-arity', `${p.name} has ${v.fields.length} field(s).`);
    p.binds.forEach((b, i) => {
      const s = this.sym('local', b.name, v.fields[i]?.ty ?? ERR, b.span, { mutable: false });
      this.refs.set(b, s);
      scope.names.set(b.name, s);
    });
  }

  exhaustive(scrut: A.Expr, t: Ty, pats: A.Pattern[], span: Span): void {
    if (t.k !== 'enum' || pats.some((p) => p.k === 'wild')) return;
    const missing = t.variants.filter((v) => !pats.some((p) => p.k === 'variant' && p.name === v.name)).map((v) => v.name);
    if (missing.length) this.err(span, 'type/non-exhaustive', `This match does not handle ${missing.join(', ')}. Add the missing case${missing.length > 1 ? 's' : ''} or a \`_ =>\` arm.`);
    void scrut;
  }

  call(e: A.Expr & { k: 'call' }, ctx: Ctx, expected?: Ty): Ty {
    const s = ctx.scope.lookup(e.callee);
    if (!s && BUILTINS.includes(e.callee)) return this.builtin(e, ctx, expected);
    if (!s) {
      const hint = suggest(e.callee, [...ctx.scope.visible().filter((x) => x.kind === 'fn' || x.kind === 'variant').map((x) => x.name), ...BUILTINS]);
      this.err(e.calleeSpan, 'name/unknown', `Unknown function “${e.callee}”.${hint.length ? ` Did you mean ${hint.map((h) => `“${h}”`).join(' or ')}?` : ''}`);
      e.args.forEach((a) => this.expr(a, ctx));
      return ERR;
    }
    this.use(e, s, e.calleeSpan);
    if (s.kind === 'variant' && s.ty.k === 'enum') {
      const v = s.ty.variants[s.index!]!;
      if (e.args.length !== v.fields.length) this.err(e.span, 'type/args', `${e.callee} takes ${v.fields.length} value(s).`);
      e.args.forEach((a, i) => {
        const ft = v.fields[i]?.ty;
        const t = this.expr(a, ctx, ft);
        if (ft) this.coerce(a, t, ft, `field ${v.fields[i]!.name}`);
      });
      return s.ty;
    }
    if (s.kind === 'process') {
      this.err(e.span, 'system/process-call', `Processes run on their own; write \`${e.callee}(…) at label\` to ask where one is.`);
      return ERR;
    }
    if (s.kind !== 'fn' || !s.decl || s.decl.k !== 'fn') {
      this.err(e.calleeSpan, 'name/not-fn', `“${e.callee}” is not a function.`);
      e.args.forEach((a) => this.expr(a, ctx));
      return ERR;
    }
    const decl = s.decl;
    const info = [...this.fns.values()].find((f) => f.decl === decl);
    if (!info) return ERR;
    if (decl.flavour === 'fn' && !decl.ghost) {
      if (ctx.spec && !ctx.fn?.decl.ghost) this.err(e.span, 'call/exec-in-spec', `“${e.callee}” is an executable function; specifications can only call pure functions and predicates (write it as \`pure fn\`).`);
      else if (!ctx.allowExecCall) this.err(e.span, 'call/exec-nested', `Calls to executable functions must stand alone: \`let x = ${e.callee}(…)\` or \`${e.callee}(…)\` on its own line.`);
      if (ctx.fn?.decl.flavour === 'pure' || ctx.fn?.decl.flavour === 'pred') this.err(e.span, 'call/exec-in-pure', 'A pure function cannot call an executable function.');
    }
    if (decl.flavour === 'lemma' && !ctx.allowExecCall) this.err(e.span, 'call/lemma', `A lemma is used as a statement: \`${e.callee}(…)\` on its own line, which adds its conclusion to what the verifier knows.`);
    ctx = { ...ctx, allowExecCall: false };
    if (e.args.length !== info.params.length) this.err(e.span, 'type/args', `“${e.callee}” takes ${info.params.length} argument${info.params.length === 1 ? '' : 's'}, not ${e.args.length}.`);
    e.args.forEach((a, i) => {
      const p = info.params[i];
      if (!p) {
        this.expr(a, ctx);
        return;
      }
      if (p.inout) {
        if (a.k !== 'var' && a.k !== 'field' && a.k !== 'index') this.err(a.span, 'call/inout', `The argument for inout parameter “${p.name}” must be a variable (it is updated by the call).`);
        const t = this.lvalue(a, ctx);
        if (!tyEq(t, p.ty) && !isPermissive(t) && !isPermissive(p.ty)) this.err(a.span, 'type/mismatch', `inout parameter “${p.name}” has type ${showTy(p.ty)}; this variable is ${showTy(t)}.`);
      } else {
        const t = this.expr(a, ctx, p.ty);
        this.coerce(a, t, p.ty, `argument ${p.name}`);
      }
    });
    return info.result?.ty ?? VOID;
  }

  builtin(e: A.Expr & { k: 'call' }, ctx: Ctx, expected?: Ty): Ty {
    const arity = (n: number) => {
      if (e.args.length !== n) this.err(e.span, 'type/args', `${e.callee} takes ${n} argument${n === 1 ? '' : 's'}.`);
    };
    const args = e.args.map((a) => this.expr(a, ctx, ['min', 'max', 'abs'].includes(e.callee) ? expected : undefined));
    const a0 = args[0] ?? ERR;
    switch (e.callee) {
      case 'len':
        arity(1);
        if (!isPermissive(a0) && a0.k !== 'seq') this.err(e.span, 'type/len', `\`len\` is the length of a sequence; for sets use \`#s\`. This is ${showTy(a0)}.`);
        return NAT_LEN;
      case 'multiset':
      case 'set':
        arity(1);
        if (!isPermissive(a0) && a0.k !== 'seq' && a0.k !== 'set' && a0.k !== 'multiset') this.err(e.span, 'type/conv', `\`${e.callee}\` turns a sequence into a ${e.callee}; this is ${showTy(a0)}.`);
        return { k: e.callee, elem: a0.k === 'seq' || a0.k === 'set' || a0.k === 'multiset' ? a0.elem : ERR };
      case 'min':
      case 'max': {
        if (args.length < 2) this.err(e.span, 'type/args', `${e.callee} takes two or more numbers.`);
        let t: Ty = a0;
        for (const x of args.slice(1)) t = join(t, x) ?? (this.err(e.span, 'type/args', `${e.callee} needs numbers of one type.`), ERR);
        if (!isPermissive(t) && !isIntLike(t) && t.k !== 'bv') this.err(e.span, 'type/args', `${e.callee} works on numbers.`);
        return t;
      }
      case 'abs':
        arity(1);
        if (!isPermissive(a0) && !isIntLike(a0)) this.err(e.span, 'type/args', '`abs` works on integers.');
        return a0.k === 'mach' && !ctx.spec ? a0 : INT;
      case 'reversed':
        arity(1);
        if (!isPermissive(a0) && a0.k !== 'seq') this.err(e.span, 'type/args', '`reversed` reverses a sequence.');
        return a0;
      case 'keys':
        arity(1);
        return a0.k === 'map' ? { k: 'set', elem: a0.key } : ERR;
      case 'sum':
        arity(1);
        if (!isPermissive(a0) && (a0.k !== 'seq' || !isIntLike(a0.elem))) this.err(e.span, 'type/args', '`sum` adds up a sequence of integers.');
        return INT;
      case 'slt':
      case 'sle':
      case 'sgt':
      case 'sge':
        arity(2);
        if (!isPermissive(a0) && a0.k !== 'bv') this.err(e.span, 'type/args', `\`${e.callee}\` compares bit-vectors as signed numbers.`);
        return BOOL;
      case 'sdiv':
      case 'srem':
      case 'ashr':
        arity(2);
        if (!isPermissive(a0) && a0.k !== 'bv') this.err(e.span, 'type/args', `\`${e.callee}\` works on bit-vectors.`);
        return a0;
      case 'seq_of':
        return { k: 'seq', elem: a0 };
    }
    return ERR;
  }
}

/** `len` returns a natural number. */
const NAT_LEN: Ty = NAT;

/** An integer literal standing alone defaults to `int`. */
function widenLiteral(t: Ty): Ty {
  return t;
}

function usesSpatial(e: A.Expr): boolean {
  let found = false;
  forEachSubExpr(e, (x) => {
    if (x.k === 'emp' || (x.k === 'binary' && (x.op === '**' || x.op === '|->'))) found = true;
  });
  return found;
}

export function conjuncts(e: A.Expr): A.Expr[] {
  return e.k === 'binary' && e.op === '&&' ? [...conjuncts(e.left), ...conjuncts(e.right)] : [e];
}

export function collectLabels(b: A.Block): string[] {
  const out: string[] = [];
  const walk = (s: A.Stmt) => {
    switch (s.k) {
      case 'label':
        out.push(s.label);
        walk(s.stmt);
        break;
      case 'if':
        s.then.stmts.forEach(walk);
        if (s.else) !isBlock(s.else) ? walk(s.else) : s.else.stmts.forEach(walk);
        break;
      case 'while':
      case 'for':
      case 'loop':
      case 'atomic':
        s.body.stmts.forEach(walk);
        break;
      case 'block':
        s.body.stmts.forEach(walk);
        break;
      case 'match':
        s.arms.forEach((a) => a.body.stmts.forEach(walk));
        break;
    }
  };
  b.stmts.forEach(walk);
  return out;
}

/** Defer work until all declarations of a scope exist (field types refer to types declared later). */
function queueMicrotaskLike(f: () => void, c: object): void {
  (c as unknown as { queued: (() => void)[] }).queued.push(f);
}

export { machBounds };
