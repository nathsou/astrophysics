// Register allocation driver: allocate, and if anything spilled, insert spill
// code (or rematerialise constants) and try again, until everything fits.
// Finally rewrite virtual registers to their assigned physical registers.

import type { Target } from '../target/target';
import { computeLoopDepth } from '../codegen/mcfg';
import { cloneMFunc, forEachReg, type MFunc, type MInstr, type RegOp } from '../codegen/mir';
import { irc, type GraphSnapshot, type RAEvent } from './irc';
import { linearScan, type LSEvent } from './linearscan';
import type { Liveness } from '../codegen/liveness';

export type RAAlgo = 'irc' | 'linear';

export interface RARound {
  round: number;
  /** snapshot of the function this round allocated */
  fn: MFunc;
  live: Liveness;
  graph?: GraphSnapshot;
  events: RAEvent[] | LSEvent[];
  color: Map<number, number>;
  spilled: number[];
  coalesced?: Map<number, number>;
  rewrites: { vreg: string; kind: 'spill' | 'remat'; slot?: number; loads: number; stores: number }[];
}

export interface RAResult {
  algo: RAAlgo;
  rounds: RARound[];
  assignment: Map<number, number>;
  spillSlots: number;
}

/** A value is rematerialisable if its only definition is a constant load with no other inputs. */
function rematDef(f: MFunc, v: number): MInstr | undefined {
  let def: MInstr | undefined, count = 0;
  for (const b of f.blocks) for (const mi of b.instrs) forEachReg(mi, (r, d) => { if (d && r.k === 'vreg' && r.id === v) { def = mi; count++; } });
  if (count !== 1 || !def) return undefined;
  const cls = f.target.opInfo(def.op)?.cls;
  if (cls !== 'alu' && cls !== 'move') return undefined;
  if (def.implUses?.length || def.implDefs?.length) return undefined;
  const others = def.ops.filter((o, k) => k !== 0);
  if (!others.length || !others.every((o) => o.k === 'imm')) return undefined;
  if (def.ops[0].k !== 'vreg' || !(def.ops[0] as RegOp).def || (def.ops[0] as RegOp).use) return undefined;
  return def;
}

export function insertSpillCode(f: MFunc, t: Target, spills: number[], noSpill: Set<number>, remat = true): RARound['rewrites'] {
  const out: RARound['rewrites'] = [];
  for (const v of spills) {
    const rdef = remat ? rematDef(f, v) : undefined;
    const name = f.vregNames.get(v) ?? '';
    let fi = -1;
    if (!rdef) fi = f.addFrameObject({ size: 8, align: 8, kind: 'spill', name: `spill ${f.vregName(v)}` });
    let loads = 0, stores = 0;
    for (const b of f.blocks) {
      const out2: MInstr[] = [];
      for (const mi of b.instrs) {
        if (rdef && mi === rdef) continue; // the original definition is no longer needed
        let usesV = false, defsV = false;
        forEachReg(mi, (r, d, u) => {
          if (r.k === 'vreg' && r.id === v) { if (u) usesV = true; if (d) defsV = true; }
        });
        if (!usesV && !defsV) { out2.push(mi); continue; }
        const tmp = f.newVreg(name ? `${name}.s` : 's');
        noSpill.add(tmp);
        forEachReg(mi, (r) => { if (r.k === 'vreg' && r.id === v) r.id = tmp; });
        if (usesV) {
          if (rdef) {
            const re = { ...rdef, id: f.nextInstrId++, ops: rdef.ops.map((o) => ({ ...o })), tag: 'remat', note: `rematerialise ${f.vregName(v)} instead of reloading it: recomputing a constant is cheaper than a memory access` };
            (re.ops[0] as RegOp & { k: 'vreg' }).id = tmp;
            out2.push(re);
          } else out2.push({ ...t.reload(f, { k: 'vreg', id: tmp }, fi), note: `reload spilled ${f.vregName(v)} before its use` });
          loads++;
        }
        out2.push(mi);
        if (defsV && !rdef) {
          out2.push({ ...t.spillStore(f, { k: 'vreg', id: tmp }, fi), note: `store ${f.vregName(v)} to its spill slot right after the definition` });
          stores++;
        }
      }
      b.instrs = out2;
    }
    out.push({ vreg: f.vregName(v), kind: rdef ? 'remat' : 'spill', slot: fi >= 0 ? fi : undefined, loads, stores });
  }
  return out;
}

export function allocateRegisters(f: MFunc, t: Target, algo: RAAlgo = 'irc', opts: { coalesce?: boolean; remat?: boolean } = {}): RAResult {
  computeLoopDepth(f);
  const rounds: RARound[] = [];
  const noSpill = new Set<number>();
  let spillSlots = 0;
  for (let round = 1; round <= 12; round++) {
    const snap = cloneMFunc(f);
    let color: Map<number, number>, spilled: number[], events: RAEvent[] | LSEvent[], live: Liveness, graph: GraphSnapshot | undefined, coalesced: Map<number, number> | undefined;
    if (algo === 'irc') {
      const r = irc(f, t, { coalesce: opts.coalesce, noSpill });
      ({ color, spilled, events, live, graph, coalesced } = r);
    } else {
      const r = linearScan(f, t, noSpill);
      ({ color, spilled, events, live } = r);
    }
    // every vreg without a colour (including ones coalesced into a spilled node) is spilled
    const allV = new Set<number>();
    for (const b of f.blocks) for (const mi of b.instrs) forEachReg(mi, (r) => { if (r.k === 'vreg') allV.add(r.id); });
    const toSpill = [...allV].filter((v) => !color.has(v));
    const rd: RARound = { round, fn: snap, live, graph, events, color, spilled: toSpill, coalesced, rewrites: [] };
    rounds.push(rd);
    if (!toSpill.length) {
      applyAssignment(f, color);
      return { algo, rounds, assignment: color, spillSlots };
    }
    if (toSpill.some((v) => noSpill.has(v))) throw new Error(`register allocation failed in ${f.name}: a spill temporary could not be coloured (too few registers: ${t.allocOrder.length})`);
    rd.rewrites = insertSpillCode(f, t, toSpill, noSpill, opts.remat !== false);
    spillSlots += rd.rewrites.filter((r) => r.kind === 'spill').length;
  }
  throw new Error(`register allocation did not converge for ${f.name}`);
}

function applyAssignment(f: MFunc, color: Map<number, number>) {
  f.assignment = new Map(color);
  for (const b of f.blocks) {
    for (const mi of b.instrs) {
      forEachReg(mi, (r) => {
        if (r.k !== 'vreg') return;
        const p = color.get(r.id);
        if (p === undefined) throw new Error(`unassigned ${f.vregName(r.id)}`);
        const o = r as unknown as { k: string; r: number; id?: number; vreg?: number };
        o.vreg = r.id;
        o.k = 'preg';
        o.r = p;
      });
    }
  }
}
