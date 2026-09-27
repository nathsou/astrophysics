// AST -> KIR lowering, in the style of `clang -O0`: every local variable
// lives in a stack slot (alloca), every read is a load and every write a store.
// Turning those slots into SSA registers is the job of mem2reg (Chapter 4).

import { BUILTINS, type Expr, type FuncDecl, type Program, type Stmt } from './ast';
import { Block, Const, Func, Instr, Module, type BinaryOp, type CmpPred, type Type, type Value } from '../ir/ir';
import { removeUnreachable } from '../opt/simplifycfg';

type Binding = { kind: 'local'; slot: Instr; isArray: boolean } | { kind: 'global'; name: string; isArray: boolean };

const ARITH: Partial<Record<string, BinaryOp>> = {
  '+': 'add', '-': 'sub', '*': 'mul', '/': 'sdiv', '%': 'srem',
  '&': 'and', '|': 'or', '^': 'xor', '<<': 'shl', '>>': 'ashr',
};
const CMP: Partial<Record<string, CmpPred>> = { '==': 'eq', '!=': 'ne', '<': 'slt', '<=': 'sle', '>': 'sgt', '>=': 'sge' };

export const c64 = (v: bigint | number) => new Const(BigInt(v));

class FnLowering {
  fn: Func;
  cur: Block;
  allocas: Instr[] = [];
  scopes: Map<string, Binding>[] = [];
  loops: { brk: Block; cont: Block }[] = [];
  line = 0;

  constructor(
    private decl: FuncDecl,
    private globals: Map<string, boolean>,
  ) {
    this.fn = new Func(decl.name);
    this.fn.line = decl.pos.line;
    this.fn.endLine = decl.endLine;
    this.cur = this.fn.newBlock('entry');
  }

  emit(op: Instr['op'], type: Type, args: Value[], extra: Partial<Instr> = {}): Instr {
    const i = this.fn.newInstr(op, type, args, { line: this.line, ...extra });
    if (this.cur.terminator) this.cur = this.fn.newBlock('dead');
    i.block = this.cur;
    this.cur.instrs.push(i);
    return i;
  }

  setBlock(b: Block) { this.cur = b; }

  br(target: Block) { if (!this.cur.terminator) this.emit('br', 'void', [], { blocks: [target] }); }

  alloca(name: string, bytes: number, note: string): Instr {
    const a = this.fn.newInstr('alloca', 'i64', [], { size: bytes, name: `${name}.addr`, line: this.line, note });
    this.allocas.push(a);
    return a;
  }

  lookup(name: string): Binding {
    for (let k = this.scopes.length - 1; k >= 0; k--) {
      const b = this.scopes[k].get(name);
      if (b) return b;
    }
    return { kind: 'global', name, isArray: this.globals.get(name)! };
  }

  run(): Func {
    const d = this.decl;
    this.line = d.pos.line;
    const scope = new Map<string, Binding>();
    this.scopes.push(scope);
    d.params.forEach((p, k) => {
      const param = this.fn.newInstr('param', 'i64', [], { index: k, name: p, line: d.pos.line, note: `incoming argument #${k}` });
      this.fn.params.push(param);
      const slot = this.alloca(p, 8, `stack slot for parameter '${p}'`);
      this.emit('store', 'void', [param, slot], { note: `spill parameter '${p}' to its stack slot` });
      scope.set(p, { kind: 'local', slot, isArray: false });
    });
    this.block(d.body);
    this.line = d.endLine;
    if (!this.cur.terminator) this.emit('ret', 'void', [c64(0)], { note: 'implicit return 0 at end of function' });
    // hoist all allocas to the top of the entry block, like clang
    for (const a of this.allocas) a.block = this.fn.entry;
    this.fn.entry.instrs.unshift(...this.allocas);
    this.fn.computePreds();
    removeUnreachable(this.fn);
    return this.fn;
  }

  block(stmts: Stmt[]) {
    this.scopes.push(new Map());
    for (const s of stmts) this.stmt(s);
    this.scopes.pop();
  }

  stmt(s: Stmt) {
    this.line = s.pos.line;
    const scope = this.scopes[this.scopes.length - 1];
    switch (s.k) {
      case 'let': {
        if (s.size !== undefined) {
          const slot = this.alloca(s.name, s.size * 8, `local array '${s.name}' (${s.size} x 8 bytes)`);
          scope.set(s.name, { kind: 'local', slot, isArray: true });
        } else {
          const slot = this.alloca(s.name, 8, `stack slot for local '${s.name}'`);
          const v = s.init ? this.expr(s.init) : c64(0);
          this.line = s.pos.line;
          this.emit('store', 'void', [v, slot], { note: `initialise '${s.name}'` });
          scope.set(s.name, { kind: 'local', slot, isArray: false });
        }
        return;
      }
      case 'assign': {
        const v = this.expr(s.value);
        this.line = s.pos.line;
        const addr = this.lvalue(s.target);
        this.emit('store', 'void', [v, addr], { note: `assign to ${s.target.k === 'var' ? `'${s.target.name}'` : 'array element'}` });
        return;
      }
      case 'expr':
        this.expr(s.e);
        return;
      case 'return': {
        const v = s.e ? this.expr(s.e) : c64(0);
        this.line = s.pos.line;
        this.emit('ret', 'void', [v]);
        return;
      }
      case 'if': {
        const then = this.fn.newBlock('if.then');
        const els = s.else ? this.fn.newBlock('if.else') : undefined;
        const end = this.fn.newBlock('if.end');
        this.cond(s.cond, then, els ?? end);
        this.setBlock(then);
        this.block(s.then);
        this.br(end);
        if (els) {
          this.setBlock(els);
          this.block(s.else!);
          this.br(end);
        }
        this.moveToEnd(end);
        this.setBlock(end);
        return;
      }
      case 'while': {
        const cond = this.fn.newBlock('while.cond');
        const body = this.fn.newBlock('while.body');
        const end = this.fn.newBlock('while.end');
        this.br(cond);
        this.setBlock(cond);
        this.cond(s.cond, body, end);
        this.setBlock(body);
        this.loops.push({ brk: end, cont: cond });
        this.block(s.body);
        this.loops.pop();
        this.line = s.pos.line;
        this.br(cond);
        this.moveToEnd(end);
        this.setBlock(end);
        return;
      }
      case 'for': {
        const slot = this.alloca(s.name, 8, `loop variable '${s.name}'`);
        const endSlot = this.alloca(`${s.name}.end`, 8, `upper bound of 'for ${s.name}' (evaluated once)`);
        this.emit('store', 'void', [this.expr(s.from), slot], { note: `${s.name} = start` });
        this.emit('store', 'void', [this.expr(s.to), endSlot], { note: 'remember the loop bound' });
        const cond = this.fn.newBlock('for.cond');
        const body = this.fn.newBlock('for.body');
        const inc = this.fn.newBlock('for.inc');
        const end = this.fn.newBlock('for.end');
        this.br(cond);
        this.setBlock(cond);
        this.line = s.pos.line;
        const iv = this.emit('load', 'i64', [slot]);
        const ev = this.emit('load', 'i64', [endSlot]);
        const c = this.emit('icmp', 'i1', [iv, ev], { pred: 'slt' });
        this.emit('condbr', 'void', [c], { blocks: [body, end] });
        this.setBlock(body);
        this.scopes.push(new Map([[s.name, { kind: 'local', slot, isArray: false }]]));
        this.loops.push({ brk: end, cont: inc });
        this.block(s.body);
        this.loops.pop();
        this.scopes.pop();
        this.br(inc);
        this.setBlock(inc);
        this.line = s.pos.line;
        const iv2 = this.emit('load', 'i64', [slot]);
        const nx = this.emit('add', 'i64', [iv2, c64(1)]);
        this.emit('store', 'void', [nx, slot], { note: `${s.name} += 1` });
        this.emit('br', 'void', [], { blocks: [cond] });
        this.moveToEnd(end);
        this.setBlock(end);
        return;
      }
      case 'break':
        this.emit('br', 'void', [], { blocks: [this.loops[this.loops.length - 1].brk], note: 'break' });
        return;
      case 'continue':
        this.emit('br', 'void', [], { blocks: [this.loops[this.loops.length - 1].cont], note: 'continue' });
        return;
    }
  }

  /** keep blocks roughly in source order: the join block goes after the arms */
  moveToEnd(b: Block) {
    const bs = this.fn.blocks;
    bs.splice(bs.indexOf(b), 1);
    bs.push(b);
  }

  lvalue(e: Expr): Value {
    if (e.k === 'var') {
      const b = this.lookup(e.name);
      if (b.kind === 'local') return b.slot;
      return this.emit('gaddr', 'i64', [], { sym: b.name });
    }
    if (e.k === 'index') return this.elementAddr(e.base, e.idx);
    throw new Error('not an lvalue');
  }

  elementAddr(base: Expr, idx: Expr): Value {
    const b = this.expr(base);
    const i = this.expr(idx);
    const off = this.emit('mul', 'i64', [i, c64(8)], { note: 'scale index by element size (8 bytes)' });
    return this.emit('add', 'i64', [b, off], { note: 'element address = base + index*8' });
  }

  expr(e: Expr): Value {
    this.line = e.pos.line;
    switch (e.k) {
      case 'num':
        return c64(BigInt.asIntN(64, e.v));
      case 'var': {
        const b = this.lookup(e.name);
        if (b.kind === 'local') return b.isArray ? b.slot : this.emit('load', 'i64', [b.slot], { note: `read '${e.name}'` });
        const addr = this.emit('gaddr', 'i64', [], { sym: b.name });
        return b.isArray ? addr : this.emit('load', 'i64', [addr], { note: `read global '${e.name}'` });
      }
      case 'index': {
        const addr = this.elementAddr(e.base, e.idx);
        return this.emit('load', 'i64', [addr]);
      }
      case 'call': {
        const args = e.args.map((a) => this.expr(a));
        this.line = e.pos.line;
        const sym = BUILTINS[e.name]?.symbol ?? e.name;
        return this.emit('call', 'i64', args, { sym, note: BUILTINS[e.name] ? `runtime library: ${BUILTINS[e.name].doc}` : undefined });
      }
      case 'un': {
        if (e.op === '!') {
          const v = this.expr(e.e);
          const c = this.emit('icmp', 'i1', [v, c64(0)], { pred: 'eq', note: 'logical not: x == 0' });
          return this.emit('zext', 'i64', [c], { note: 'widen i1 to i64' });
        }
        const v = this.expr(e.e);
        if (e.op === '-') return this.emit('sub', 'i64', [c64(0), v], { note: 'negation: 0 - x' });
        return this.emit('xor', 'i64', [v, c64(-1)], { note: 'bitwise not: x ^ -1' });
      }
      case 'bin': {
        if (e.op === '&&' || e.op === '||') return this.boolValue(e);
        const l = this.expr(e.l);
        const r = this.expr(e.r);
        this.line = e.pos.line;
        const cmp = CMP[e.op];
        if (cmp) {
          const c = this.emit('icmp', 'i1', [l, r], { pred: cmp });
          return this.emit('zext', 'i64', [c], { note: 'comparison result used as a value: widen i1 to i64' });
        }
        return this.emit(ARITH[e.op]!, 'i64', [l, r]);
      }
    }
  }

  /** Materialise a short-circuit boolean as 0/1 via control flow and a phi. */
  boolValue(e: Expr): Value {
    const t = this.fn.newBlock('bool.true');
    const f = this.fn.newBlock('bool.false');
    const end = this.fn.newBlock('bool.end');
    this.cond(e, t, f);
    this.setBlock(t);
    this.br(end);
    this.setBlock(f);
    this.br(end);
    this.setBlock(end);
    return this.emit('phi', 'i64', [c64(1), c64(0)], { blocks: [t, f], note: `value of '${e.k === 'bin' ? e.op : ''}' expression` });
  }

  /** Jumping code: branch to t if e is true, else to f (Dragon book §6.6). */
  cond(e: Expr, t: Block, f: Block) {
    this.line = e.pos.line;
    if (e.k === 'bin' && e.op === '&&') {
      const rhs = this.fn.newBlock('and.rhs');
      this.cond(e.l, rhs, f);
      this.setBlock(rhs);
      this.cond(e.r, t, f);
      return;
    }
    if (e.k === 'bin' && e.op === '||') {
      const rhs = this.fn.newBlock('or.rhs');
      this.cond(e.l, t, rhs);
      this.setBlock(rhs);
      this.cond(e.r, t, f);
      return;
    }
    if (e.k === 'un' && e.op === '!') {
      this.cond(e.e, f, t);
      return;
    }
    let c: Value;
    if (e.k === 'bin' && CMP[e.op]) {
      const l = this.expr(e.l);
      const r = this.expr(e.r);
      this.line = e.pos.line;
      c = this.emit('icmp', 'i1', [l, r], { pred: CMP[e.op] });
    } else {
      const v = this.expr(e);
      this.line = e.pos.line;
      c = this.emit('icmp', 'i1', [v, c64(0)], { pred: 'ne', note: 'integer used as condition: x != 0' });
    }
    this.emit('condbr', 'void', [c], { blocks: [t, f] });
  }
}

export function lowerProgram(prog: Program, source = ''): Module {
  const m = new Module();
  m.source = source;
  const globals = new Map<string, boolean>();
  for (const g of prog.globals) {
    m.globals.push({ name: g.name, words: g.size, init: g.init, isArray: g.isArray, line: g.pos.line });
    globals.set(g.name, g.isArray);
  }
  for (const f of prog.funcs) m.funcs.push(new FnLowering(f, globals).run());
  return m;
}
