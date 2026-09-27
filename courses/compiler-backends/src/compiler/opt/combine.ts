// Instruction combining: constant folding, algebraic identities,
// canonicalisation and simple strength reduction — the "instcombine" that
// hands the backend clean, canonical input. Also: dead code elimination and
// dominator-scoped common subexpression elimination.

import { dominators } from '../analysis/dom';
import { irGraph } from '../analysis/graph';
import { COMMUTATIVE, Const, Instr, type CmpPred, type Func, type Value, valueName, wrap64 } from '../ir/ir';
import type { PassLog } from './simplifycfg';

const isC = (v: Value): v is Const => v instanceof Const;
const log2 = (v: bigint) => {
  if (v <= 0n || (v & (v - 1n)) !== 0n) return -1;
  return v.toString(2).length - 1;
};
const SWAP: Record<CmpPred, CmpPred> = { eq: 'eq', ne: 'ne', slt: 'sgt', sgt: 'slt', sle: 'sge', sge: 'sle' };

export function evalBinary(op: string, a: bigint, b: bigint): bigint | undefined {
  switch (op) {
    case 'add': return wrap64(a + b);
    case 'sub': return wrap64(a - b);
    case 'mul': return wrap64(a * b);
    case 'sdiv': return b === 0n ? undefined : wrap64(a / b);
    case 'srem': return b === 0n ? undefined : wrap64(a % b);
    case 'and': return a & b;
    case 'or': return a | b;
    case 'xor': return a ^ b;
    case 'shl': return wrap64(a << (b & 63n));
    case 'ashr': return a >> (b & 63n);
    case 'lshr': return wrap64(BigInt.asUintN(64, a) >> (b & 63n));
  }
  return undefined;
}

export function evalCmp(p: CmpPred, x: bigint, y: bigint): boolean {
  return { eq: x === y, ne: x !== y, slt: x < y, sle: x <= y, sgt: x > y, sge: x >= y }[p];
}

/** Returns a replacement value if `i` simplifies to an existing value, or mutates `i` in place. */
function simplify(fn: Func, i: Instr, log: PassLog): Value | undefined | 'changed' {
  const [a, b] = i.args;
  const say = (m: string) => log.msgs.push(`${valueName(i)} (${i.op}): ${m}`);
  switch (i.op) {
    case 'add': case 'sub': case 'mul': case 'sdiv': case 'srem':
    case 'and': case 'or': case 'xor': case 'shl': case 'ashr': case 'lshr': {
      if (isC(a) && isC(b)) {
        const r = evalBinary(i.op, a.v, b.v);
        if (r !== undefined) { say(`constant-folded to ${r}`); return new Const(r); }
        return undefined;
      }
      if (COMMUTATIVE.has(i.op) && isC(a)) {
        i.args = [b, a];
        say('moved constant to the right-hand side (canonical form)');
        return 'changed';
      }
      if (!isC(b)) {
        if (a === b && (i.op === 'sub' || i.op === 'xor')) { say('x - x / x ^ x = 0'); return new Const(0n); }
        if (a === b && (i.op === 'and' || i.op === 'or')) { say('x & x = x'); return a; }
        if (isC(a) && a.v === 0n && (i.op === 'shl' || i.op === 'ashr' || i.op === 'lshr' || i.op === 'sdiv' || i.op === 'srem')) { say('0 op x = 0'); return new Const(0n); }
        return undefined;
      }
      const c = b.v;
      if (c === 0n && ['add', 'sub', 'or', 'xor', 'shl', 'ashr', 'lshr'].includes(i.op)) { say(`x ${i.op} 0 = x`); return a; }
      if (c === 0n && (i.op === 'mul' || i.op === 'and')) { say(`x ${i.op} 0 = 0`); return new Const(0n); }
      if (c === 1n && (i.op === 'mul' || i.op === 'sdiv')) { say(`x ${i.op} 1 = x`); return a; }
      if (c === 1n && i.op === 'srem') { say('x % 1 = 0'); return new Const(0n); }
      if (c === -1n && i.op === 'and') { say('x & -1 = x'); return a; }
      if (c === -1n && i.op === 'mul') {
        i.op = 'sub'; i.args = [new Const(0n), a];
        say('x * -1 → 0 - x');
        return 'changed';
      }
      if (i.op === 'sub') {
        i.op = 'add'; i.args = [a, new Const(wrap64(-c))];
        say(`x - ${c} → x + ${wrap64(-c)} (canonical: targets have add-immediate but rarely sub-immediate)`);
        return 'changed';
      }
      if (i.op === 'mul' && log2(c) > 0) {
        i.op = 'shl'; i.args = [a, new Const(BigInt(log2(c)))];
        say(`strength reduction: x * ${c} → x << ${log2(c)}`);
        return 'changed';
      }
      // reassociate (x + c1) + c2 -> x + (c1+c2)
      if (i.op === 'add' && a instanceof Instr && a.op === 'add' && isC(a.args[1]) && !isC(a.args[0])) {
        const k = wrap64(a.args[1].v + c);
        i.args = [a.args[0], new Const(k)];
        say(`reassociated (x + ${a.args[1].v}) + ${c} → x + ${k}`);
        return 'changed';
      }
      return undefined;
    }
    case 'icmp': {
      if (isC(a) && isC(b)) {
        const r = evalCmp(i.pred!, a.v, b.v);
        say(`constant-folded to ${r}`);
        return new Const(r ? 1n : 0n, 'i1');
      }
      if (isC(a)) {
        i.args = [b, a];
        i.pred = SWAP[i.pred!];
        say(`swapped operands so the constant is on the right (${i.pred})`);
        return 'changed';
      }
      if (a === b) {
        const r = i.pred === 'eq' || i.pred === 'sle' || i.pred === 'sge';
        say(`x ${i.pred} x is always ${r}`);
        return new Const(r ? 1n : 0n, 'i1');
      }
      // icmp ne (zext c), 0  ->  c ;  icmp eq (zext c), 0 -> !c
      if (isC(b) && b.v === 0n && a instanceof Instr && a.op === 'zext') {
        const inner = a.args[0];
        if (i.pred === 'ne') { say('icmp ne (zext c), 0 → c'); return inner; }
        if (i.pred === 'eq' && inner instanceof Instr && inner.op === 'icmp') {
          const INV: Record<CmpPred, CmpPred> = { eq: 'ne', ne: 'eq', slt: 'sge', sge: 'slt', sgt: 'sle', sle: 'sgt' };
          i.pred = INV[inner.pred!];
          i.args = [...inner.args];
          say(`icmp eq (zext (icmp ${inner.pred})), 0 → icmp ${i.pred}`);
          return 'changed';
        }
      }
      return undefined;
    }
    case 'zext':
      if (isC(a)) { say('constant-folded'); return new Const(a.v & 1n); }
      return undefined;
    case 'select': {
      if (isC(a)) { say('select on a constant condition'); return a.v ? i.args[1] : i.args[2]; }
      if (i.args[1] === i.args[2]) { say('both arms equal'); return i.args[1]; }
      return undefined;
    }
    case 'phi': {
      const distinct = new Set(i.args.filter((x) => x !== i));
      if (distinct.size === 1) {
        const [v] = distinct;
        say(`trivial phi: every incoming value is ${valueName(v)}`);
        return v;
      }
      return undefined;
    }
  }
  return undefined;
}

export function combine(fn: Func, log: PassLog = { msgs: [] }): boolean {
  let any = false;
  for (let changed = true; changed; ) {
    changed = false;
    for (const b of fn.blocks) {
      for (const i of [...b.instrs]) {
        const r = simplify(fn, i, log);
        if (r === undefined) continue;
        changed = any = true;
        if (r === 'changed') continue;
        if (r instanceof Instr && !r.name && i.name) r.name = i.name;
        fn.replaceAllUses(i, r);
        b.remove(i);
      }
    }
  }
  return any;
}

/** Mark-and-sweep DCE: anything not transitively needed by a side effect is dead (handles dead phi cycles). */
export function dce(fn: Func, log: PassLog = { msgs: [] }): boolean {
  const live = new Set<Instr>();
  const work: Instr[] = [];
  for (const i of fn.instructions()) if (i.hasSideEffects) { live.add(i); work.push(i); }
  while (work.length) {
    for (const a of work.pop()!.args) {
      if (a instanceof Instr && !live.has(a)) { live.add(a); work.push(a); }
    }
  }
  let any = false;
  for (const b of fn.blocks) {
    const keep = b.instrs.filter((i) => live.has(i));
    if (keep.length !== b.instrs.length) {
      for (const i of b.instrs) if (!live.has(i)) log.msgs.push(`removed dead ${valueName(i)} = ${i.op}`);
      b.instrs = keep;
      any = true;
    }
  }
  return any;
}

/** Common subexpression elimination over the dominator tree (scoped hash table). */
export function cse(fn: Func, log: PassLog = { msgs: [] }): boolean {
  fn.computePreds();
  const g = irGraph(fn);
  const dom = dominators(g);
  const key = (i: Instr) => {
    let args = i.args.map((a) => (a instanceof Const ? `#${a.v}` : `%${(a as Instr).id}`));
    if (COMMUTATIVE.has(i.op)) args = [...args].sort();
    return `${i.op}.${i.pred ?? ''}.${i.sym ?? ''}(${args.join(',')})`;
  };
  const table = new Map<string, Instr>();
  let any = false;
  const walk = (bi: number) => {
    const added: string[] = [];
    const b = fn.blocks[bi];
    for (const i of [...b.instrs]) {
      if (!i.isPure) continue;
      const k = key(i);
      const prev = table.get(k);
      if (prev) {
        log.msgs.push(`${valueName(i)} is a recomputation of ${valueName(prev)} (which dominates it) — reuse`);
        fn.replaceAllUses(i, prev);
        b.remove(i);
        any = true;
      } else {
        table.set(k, i);
        added.push(k);
      }
    }
    for (const c of dom.children[bi]) walk(c);
    for (const k of added) table.delete(k);
  };
  walk(0);
  return any;
}
