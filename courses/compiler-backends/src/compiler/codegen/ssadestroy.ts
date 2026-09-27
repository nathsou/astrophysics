// SSA destruction ("out-of-SSA", phi elimination) on machine IR.
//
// A phi  d = PHI [a1, P1], [a2, P2]  means: on the edge Pi -> B, copy ai to d.
// All phis of a block execute *simultaneously*, so the copies on one edge form
// a parallel copy. The classic pitfalls:
//   * the lost-copy problem: placing the copy in a predecessor with several
//     successors clobbers a value still needed on the other path. Fix: split
//     critical edges so every copy has an edge-private block.
//   * the swap problem: phis that permute values (a,b) = (b,a) need a
//     temporary if copies are emitted one at a time. Fix: sequentialise the
//     parallel copy correctly (Briggs et al. 1998; Boissinot et al. 2009;
//     Rideau, Serpette & Leroy, "Tilting at windmills with Coq", 2008).

import type { Target } from '../target/target';
import { R, firstTerminator, isPhi, type MBlock, type MFunc, type MInstr, type RegOp } from './mir';

export interface PCopy { dst: number; src: number }

export interface SeqStep {
  pending: PCopy[];
  emitted: PCopy;
  why: string;
  usedTemp: boolean;
}

/**
 * Sequentialise a parallel copy over "locations" (numbers). Emits a copy whenever
 * its destination is no longer needed as a source; when only cycles remain,
 * saves one member of a cycle to `tmp` and redirects its readers.
 */
export function sequentialize(copies: PCopy[], tmp: () => number, trace?: SeqStep[]): PCopy[] {
  let pending = copies.filter((c) => c.dst !== c.src).map((c) => ({ ...c }));
  const out: PCopy[] = [];
  while (pending.length) {
    const ready = pending.find((c) => !pending.some((o) => o !== c && o.src === c.dst));
    if (ready) {
      out.push(ready);
      pending = pending.filter((c) => c !== ready);
      trace?.push({ pending: pending.map((c) => ({ ...c })), emitted: ready, why: `${ready.dst} is not read by any remaining copy, so it can be overwritten now`, usedTemp: false });
      continue;
    }
    // every remaining destination is still needed: we are inside a cycle
    const c = pending[0];
    const t = tmp();
    const save = { dst: t, src: c.dst };
    out.push(save);
    for (const o of pending) if (o.src === c.dst) o.src = t;
    trace?.push({ pending: pending.map((x) => ({ ...x })), emitted: save, why: `only cycles remain: save ${c.dst} in a temporary so it can be overwritten`, usedTemp: true });
  }
  return out;
}

export interface DestroyTrace {
  splitEdges: { from: string; to: string; block: string }[];
  edges: { from: string; to: string; parallel: { dst: string; src: string }[]; sequence: { dst: string; src: string }[]; steps: SeqStep[] }[];
}

export function destroySSA(f: MFunc, t: Target, opts: { splitCritical?: boolean } = {}): DestroyTrace {
  const trace: DestroyTrace = { splitEdges: [], edges: [] };
  f.computeCFG();
  const hasPhis = (b: MBlock) => b.instrs.some(isPhi);

  // 1. split critical edges into blocks that have phis
  if (opts.splitCritical !== false) {
    for (const b of [...f.blocks]) {
      if (!hasPhis(b) || b.preds.length < 2) continue;
      for (const p of [...b.preds]) {
        if (p.succs.length < 2) continue;
        const nb = f.newBlock(`${p.name}.${b.name}.split`);
        // keep the new block right after its predecessor in layout
        f.blocks.splice(f.blocks.indexOf(nb), 1);
        f.blocks.splice(f.blocks.indexOf(p) + 1, 0, nb);
        nb.loopDepth = Math.min(p.loopDepth, b.loopDepth);
        nb.instrs.push({ ...t.jump(f, b), tag: 'split', note: `critical edge ${p.name} → ${b.name} split so phi copies have a place of their own` });
        for (const mi of p.instrs) t.retarget(mi, b, nb);
        for (const mi of b.instrs) {
          if (!isPhi(mi)) continue;
          for (let k = 2; k < mi.ops.length; k += 2) {
            const o = mi.ops[k];
            if (o.k === 'block' && o.b === p) o.b = nb;
          }
        }
        trace.splitEdges.push({ from: p.name, to: b.name, block: nb.name });
        f.computeCFG();
      }
    }
  }

  // 2. replace phis by parallel copies at the end of each predecessor
  const regOf = new Map<number, RegOp>();
  const name = (k: number) => (regOf.get(k)!.k === 'vreg' ? f.vregName(k) : t.regs[-k - 1].name);
  for (const b of f.blocks) {
    const phis = b.instrs.filter(isPhi);
    if (!phis.length) continue;
    const perPred = new Map<MBlock, PCopy[]>();
    for (const phi of phis) {
      const d = phi.ops[0] as RegOp & { k: 'vreg' };
      regOf.set(d.id, d);
      for (let k = 1; k < phi.ops.length; k += 2) {
        const src = phi.ops[k] as RegOp & { k: 'vreg' };
        const pred = (phi.ops[k + 1] as { b: MBlock }).b;
        regOf.set(src.id, src);
        if (!perPred.has(pred)) perPred.set(pred, []);
        perPred.get(pred)!.push({ dst: d.id, src: src.id });
      }
    }
    for (const [pred, copies] of perPred) {
      const steps: SeqStep[] = [];
      const seq = sequentialize(copies, () => {
        const id = f.newVreg('swap');
        regOf.set(id, R.v(id));
        return id;
      }, steps);
      const mis: MInstr[] = seq.map((c) => f.mi('COPY', [R.vd(c.dst), R.v(c.src)], {
        tag: 'phi-copy',
        note: f.vregNames.get(c.dst) === 'swap'
          ? 'temporary that breaks a cycle in the parallel copy (the swap problem)'
          : `phi copy on edge ${pred.name} → ${b.name}`,
      }));
      const at = firstTerminator(t, pred);
      pred.instrs.splice(at, 0, ...mis);
      trace.edges.push({
        from: pred.name, to: b.name,
        parallel: copies.map((c) => ({ dst: name(c.dst), src: name(c.src) })),
        sequence: seq.map((c) => ({ dst: name(c.dst), src: name(c.src) })),
        steps,
      });
    }
    b.instrs = b.instrs.filter((mi) => !isPhi(mi));
  }
  f.computeCFG();
  return trace;
}
