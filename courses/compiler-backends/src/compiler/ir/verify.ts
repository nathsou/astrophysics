import { dominates, dominators } from '../analysis/dom';
import { irGraph } from '../analysis/graph';
import { Instr, type Func, type Module } from './ir';
import { valueName } from './ir';

/** Structural + SSA checks. Throws with a descriptive message on the first violation. */
export function verifyFunc(fn: Func, ssa = true) {
  const fail = (msg: string) => { throw new Error(`IR verifier (${fn.name}): ${msg}`); };
  fn.computePreds();
  const defined = new Set<Instr>(fn.params);
  for (const b of fn.blocks) {
    if (!b.instrs.length) fail(`block ${b.name} is empty`);
    b.instrs.forEach((i, k) => {
      if (i.block !== b) fail(`${valueName(i)} has wrong parent block`);
      if (i.isTerminator !== (k === b.instrs.length - 1)) fail(`block ${b.name}: terminator must be last (at ${i.op})`);
      if (i.op === 'phi' && k > 0 && b.instrs[k - 1].op !== 'phi') fail(`phi ${valueName(i)} not at top of ${b.name}`);
      defined.add(i);
    });
    for (const s of b.succs) if (!fn.blocks.includes(s)) fail(`${b.name} branches to a deleted block ${s.name}`);
  }
  const g = irGraph(fn);
  const dom = dominators(g);
  const bi = new Map(fn.blocks.map((b, i) => [b, i]));
  for (const b of fn.blocks) {
    for (const i of b.instrs) {
      if (i.op === 'phi') {
        if (i.args.length !== b.preds.length) fail(`phi ${valueName(i)} in ${b.name} has ${i.args.length} incoming, block has ${b.preds.length} preds`);
        for (const p of b.preds) if (!i.blocks.includes(p)) fail(`phi ${valueName(i)} missing incoming for ${p.name}`);
      }
      i.args.forEach((a, k) => {
        if (!(a instanceof Instr)) return;
        if (!defined.has(a)) fail(`${valueName(i)} (${i.op}) uses ${valueName(a)} which is not defined in this function`);
        if (!ssa || a.op === 'param') return;
        const useBlock = i.op === 'phi' ? i.blocks[k] : b;
        const db = bi.get(a.block)!, ub = bi.get(useBlock)!;
        if (dom.idom[ub] === -1) return;
        if (db === ub && i.op !== 'phi') {
          if (b.instrs.indexOf(a) >= b.instrs.indexOf(i)) fail(`${valueName(a)} used before definition in ${b.name}`);
        } else if (!dominates(dom, db, ub)) fail(`definition of ${valueName(a)} in ${a.block.name} does not dominate its use in ${useBlock.name}`);
      });
    }
  }
}

export function verifyModule(m: Module, ssa = true) {
  for (const f of m.funcs) verifyFunc(f, ssa);
}
