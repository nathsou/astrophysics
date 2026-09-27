// mem2reg: promote stack slots to SSA values.
//
// This is the classic construction of Cytron, Ferrante, Rosen, Wegman and
// Zadeck, "Efficiently Computing Static Single Assignment Form and the Control
// Dependence Graph" (TOPLAS 1991):
//   1. for every promotable variable, place phis at the iterated dominance
//      frontier of the blocks that store to it;
//   2. rename: walk the dominator tree keeping a stack of "current definition"
//      per variable; loads read the top of stack, stores push.
// We optionally prune phis for variables that are not live-in at the join
// ("pruned SSA", Choi, Cytron & Ferrante 1991).
// Every step is recorded so the course can replay the algorithm.

import { dominanceFrontiers, dominators } from '../analysis/dom';
import { irGraph } from '../analysis/graph';
import { Const, Instr, type Block, type Func, type Value, valueName } from '../ir/ir';

export interface PhiStep {
  variable: string;
  from: string; // block whose frontier is being processed
  frontier: string[];
  placed?: string; // block where a phi was inserted
  skipped?: string; // pruned because the variable is dead there
  worklist: string[];
}

export interface RenameStep {
  block: string;
  action: 'enter' | 'phi' | 'load' | 'store' | 'succ-phi' | 'leave';
  variable?: string;
  value?: string;
  detail: string;
  stacks: Record<string, string[]>;
  instrId?: number;
}

export interface Mem2RegTrace {
  variables: { name: string; slot: number; defs: string[]; uses: string[]; promoted: boolean; reason?: string }[];
  phiSteps: PhiStep[];
  renameSteps: RenameStep[];
  df: Record<string, string[]>;
  idom: Record<string, string>;
}

function promotable(a: Instr, uses: Instr[]): string | undefined {
  if (a.size !== 8) return 'it is an array (address is taken for indexing)';
  for (const u of uses) {
    if (u.op === 'load' && u.args[0] === a) continue;
    if (u.op === 'store' && u.args[1] === a && u.args[0] !== a) continue;
    return `its address escapes into '${u.op}'`;
  }
  return undefined;
}

export function mem2reg(fn: Func, opts: { pruned?: boolean } = {}): Mem2RegTrace {
  const pruned = opts.pruned ?? true;
  fn.computePreds();
  const g = irGraph(fn);
  const dom = dominators(g);
  const { df } = dominanceFrontiers(g, dom);
  const bi = new Map(fn.blocks.map((b, i) => [b, i]));
  const uses = fn.uses();
  const trace: Mem2RegTrace = {
    variables: [], phiSteps: [], renameSteps: [],
    df: Object.fromEntries(fn.blocks.map((b, i) => [b.name, [...df[i]].map((x) => fn.blocks[x].name)])),
    idom: Object.fromEntries(fn.blocks.map((b, i) => [b.name, dom.idom[i] >= 0 && i !== 0 ? fn.blocks[dom.idom[i]].name : ''])),
  };

  const allocas = fn.entry.instrs.filter((i) => i.op === 'alloca');
  const vars: Instr[] = [];
  for (const a of allocas) {
    const us = uses.get(a) ?? [];
    const reason = promotable(a, us);
    const name = a.name?.replace(/\.addr$/, '') ?? `v${a.id}`;
    trace.variables.push({
      name, slot: a.id,
      defs: [...new Set(us.filter((u) => u.op === 'store').map((u) => u.block.name))],
      uses: [...new Set(us.filter((u) => u.op === 'load').map((u) => u.block.name))],
      promoted: !reason, reason,
    });
    if (!reason) vars.push(a);
  }
  const varName = (a: Instr) => a.name!.replace(/\.addr$/, '');

  // --- liveness of each variable at block entry (for pruning) --------------
  const liveIn = new Map<Instr, Set<Block>>();
  if (pruned) {
    for (const a of vars) {
      const upward = new Set<Block>(); // blocks that read before writing
      const kills = new Set<Block>();
      for (const b of fn.blocks) {
        for (const i of b.instrs) {
          if (i.op === 'load' && i.args[0] === a) { if (!kills.has(b)) upward.add(b); break; }
          if (i.op === 'store' && i.args[1] === a) { kills.add(b); break; }
        }
      }
      const live = new Set<Block>(upward);
      const work = [...upward];
      while (work.length) {
        const b = work.pop()!;
        for (const p of b.preds) if (!kills.has(p) && !live.has(p)) { live.add(p); work.push(p); }
      }
      liveIn.set(a, live);
    }
  }

  // --- phi placement ---------------------------------------------------------
  const phiVar = new Map<Instr, Instr>(); // phi -> alloca
  for (const a of vars) {
    const defBlocks = new Set((uses.get(a) ?? []).filter((u) => u.op === 'store').map((u) => bi.get(u.block)!));
    const work = [...defBlocks];
    const hasPhi = new Set<number>();
    const everOnWork = new Set(work);
    while (work.length) {
      const x = work.shift()!;
      const frontier = [...df[x]];
      for (const y of frontier) {
        if (hasPhi.has(y)) continue;
        hasPhi.add(y);
        const Y = fn.blocks[y];
        const step: PhiStep = { variable: varName(a), from: fn.blocks[x].name, frontier: frontier.map((f) => fn.blocks[f].name), worklist: [] };
        if (pruned && !liveIn.get(a)!.has(Y)) {
          step.skipped = Y.name;
        } else {
          const phi = fn.newInstr('phi', 'i64', [], { name: varName(a), line: a.line, note: `phi for variable '${varName(a)}' at join point ${Y.name}` });
          phi.block = Y;
          Y.instrs.unshift(phi);
          phiVar.set(phi, a);
          step.placed = Y.name;
        }
        if (!everOnWork.has(y)) { everOnWork.add(y); work.push(y); }
        step.worklist = work.map((w) => fn.blocks[w].name);
        trace.phiSteps.push(step);
      }
    }
  }

  // --- renaming ----------------------------------------------------------------
  const stacks = new Map<Instr, Value[]>(vars.map((a) => [a, [new Const(0n)]]));
  const snap = () => Object.fromEntries(vars.map((a) => [varName(a), stacks.get(a)!.map(valueName)]));
  const R = (s: Omit<RenameStep, 'stacks'>) => trace.renameSteps.push({ ...s, stacks: snap() });
  const varSet = new Set(vars);
  const replaced = new Map<Instr, Value>();
  const resolve = (v: Value): Value => {
    while (v instanceof Instr && replaced.has(v)) v = replaced.get(v)!;
    return v;
  };

  const rename = (bIdx: number) => {
    const b = fn.blocks[bIdx];
    R({ block: b.name, action: 'enter', detail: `enter ${b.name}` });
    const pushed: Instr[] = [];
    for (const i of [...b.instrs]) {
      if (i.op === 'phi' && phiVar.has(i)) {
        const a = phiVar.get(i)!;
        stacks.get(a)!.push(i);
        pushed.push(a);
        R({ block: b.name, action: 'phi', variable: varName(a), value: valueName(i), detail: `phi ${valueName(i)} becomes the current definition of '${varName(a)}'`, instrId: i.id });
        continue;
      }
      for (let k = 0; k < i.args.length; k++) i.args[k] = resolve(i.args[k]);
      if (i.op === 'load' && varSet.has(i.args[0] as Instr)) {
        const a = i.args[0] as Instr;
        const cur = stacks.get(a)!.at(-1)!;
        replaced.set(i, cur);
        fn.replaceAllUses(i, cur);
        b.remove(i);
        R({ block: b.name, action: 'load', variable: varName(a), value: valueName(cur), detail: `load of '${varName(a)}' replaced by current definition ${valueName(cur)}`, instrId: i.id });
      } else if (i.op === 'store' && varSet.has(i.args[1] as Instr)) {
        const a = i.args[1] as Instr;
        const v = i.args[0];
        if (v instanceof Instr && !v.name && v.op !== 'param') v.name = varName(a);
        stacks.get(a)!.push(v);
        pushed.push(a);
        b.remove(i);
        R({ block: b.name, action: 'store', variable: varName(a), value: valueName(v), detail: `store to '${varName(a)}': push ${valueName(v)}`, instrId: i.id });
      }
    }
    for (const s of b.succs) {
      for (const phi of s.phis) {
        const a = phiVar.get(phi);
        if (!a) continue;
        const cur = stacks.get(a)!.at(-1)!;
        phi.args.push(cur);
        phi.blocks.push(b);
        R({ block: b.name, action: 'succ-phi', variable: varName(a), value: valueName(cur), detail: `fill ${valueName(phi)} in ${s.name}: incoming [${valueName(cur)}, ${b.name}]`, instrId: phi.id });
      }
    }
    for (const c of dom.children[bIdx]) rename(c);
    for (const a of pushed) stacks.get(a)!.pop();
    R({ block: b.name, action: 'leave', detail: `leave ${b.name}: pop ${pushed.length} definition(s)` });
  };
  rename(0);
  // phi operands filled later in the walk might refer to replaced loads
  for (const i of fn.instructions()) for (let k = 0; k < i.args.length; k++) i.args[k] = resolve(i.args[k]);
  // order phi operands like the block's predecessor list (purely cosmetic)
  for (const b of fn.blocks) {
    for (const phi of b.phis) {
      if (!phiVar.has(phi)) continue;
      const pairs = phi.blocks.map((bb, k) => [bb, phi.args[k]] as const);
      pairs.sort((x, y) => b.preds.indexOf(x[0]) - b.preds.indexOf(y[0]));
      phi.blocks = pairs.map((p) => p[0]);
      phi.args = pairs.map((p) => p[1]);
    }
  }
  fn.entry.instrs = fn.entry.instrs.filter((i) => !varSet.has(i));
  return trace;
}
