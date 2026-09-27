// Instruction scheduling: list scheduling over a dependence DAG.
//
// Dependences (per basic block region):
//   RAW  (true)   def -> use       latency = producer latency
//   WAR  (anti)   use -> def       latency 0 (must not overtake)
//   WAW  (output) def -> def       latency 1
//   MEM           store -> load/store, load -> store, unless provably disjoint
// Priority: longest latency-weighted path to the end of the region
// ("critical path" / height), the heuristic of Gibbons & Muchnick (1986).
// Calls and instructions pinned to physical registers are region barriers.

import type { Target } from '../target/target';
import { forEachReg, instrDefs, instrUses, isTerminator, type MBlock, type MFunc, type MInstr, type MemOp } from './mir';

export type DepKind = 'raw' | 'war' | 'waw' | 'mem';
export interface DepEdge { from: number; to: number; kind: DepKind; lat: number; reg?: number }

export interface SchedRegion {
  block: string;
  instrs: MInstr[];
  edges: DepEdge[];
  height: number[];
  lat: number[];
  /** issue cycle per instruction (index into instrs) in the new schedule */
  cycle: number[];
  order: number[];
  steps: { cycle: number; ready: number[]; issued: number[] }[];
  beforeCycles: number;
  afterCycles: number;
  beforeIssue: number[];
  afterIssue: number[];
}

export interface SchedResult {
  regions: SchedRegion[];
  beforeTotal: number;
  afterTotal: number;
}

function mayAlias(a: MemOp, b: MemOp): boolean {
  const same = (x: MemOp['base'], y: MemOp['base']) =>
    x.k === y.k && (x.k === 'frame' ? x.fi === (y as { fi: number }).fi : x.k === 'vreg' ? x.id === (y as { id: number }).id : x.k === 'preg' ? x.r === (y as { r: number }).r : x.name === (y as { name: string }).name);
  if (a.base.k === 'frame' && b.base.k === 'frame' && a.base.fi !== b.base.fi) return false;
  if (!a.index && !b.index && same(a.base, b.base)) return Math.abs(a.disp - b.disp) < 8;
  return true;
}

const memOf = (mi: MInstr) => mi.ops.find((o) => o.k === 'mem') as MemOp | undefined;

export function buildDAG(t: Target, instrs: MInstr[]): { edges: DepEdge[]; lat: number[] } {
  const edges: DepEdge[] = [];
  const lat = instrs.map((mi) => t.sched.lat(mi));
  const lastDef = new Map<number, number>();
  const usesSince = new Map<number, number[]>();
  const mems: { i: number; m: MemOp; store: boolean }[] = [];
  const add = (from: number, to: number, kind: DepKind, l: number, reg?: number) => {
    if (from === to) return;
    const e = edges.find((x) => x.from === from && x.to === to);
    if (e) { if (l > e.lat) { e.lat = l; e.kind = kind; } return; }
    edges.push({ from, to, kind, lat: l, reg });
  };
  instrs.forEach((mi, i) => {
    const uses = instrUses(mi), defs = instrDefs(mi);
    for (const u of uses) {
      const d = lastDef.get(u);
      if (d !== undefined) add(d, i, 'raw', lat[d], u);
      if (!usesSince.has(u)) usesSince.set(u, []);
      usesSince.get(u)!.push(i);
    }
    for (const d of defs) {
      for (const u of usesSince.get(d) ?? []) add(u, i, 'war', 0, d);
      const pd = lastDef.get(d);
      if (pd !== undefined) add(pd, i, 'waw', 1, d);
      lastDef.set(d, i);
      usesSince.set(d, []);
    }
    const cls = t.opInfo(mi.op)?.cls;
    const m = memOf(mi);
    if (m && (cls === 'load' || cls === 'store')) {
      const store = cls === 'store';
      for (const p of mems) {
        if (!p.store && !store) continue;
        if (!mayAlias(p.m, m)) continue;
        add(p.i, i, 'mem', p.store && !store ? lat[p.i] : store && !p.store ? 0 : 1);
      }
      mems.push({ i, m, store });
    }
  });
  return { edges, lat };
}

/** In-order, W-wide issue with one memory port and one mul/div unit. Returns issue cycle per instruction. */
export function simulateInOrder(t: Target, seq: MInstr[]): { issue: number[]; cycles: number } {
  const ready = new Map<number, number>();
  const issue: number[] = [];
  let cycle = 0, slots = 0;
  const unitsThisCycle = new Map<string, number>();
  for (const mi of seq) {
    let earliest = cycle;
    for (const u of instrUses(mi)) earliest = Math.max(earliest, ready.get(u) ?? 0);
    const unit = t.sched.unit(mi);
    for (;;) {
      if (earliest > cycle) { cycle = earliest; slots = 0; unitsThisCycle.clear(); }
      const unitBusy = unit !== 'alu' && (unitsThisCycle.get(unit) ?? 0) >= 1;
      if (slots < t.sched.issueWidth && !unitBusy) break;
      cycle++; slots = 0; unitsThisCycle.clear();
    }
    issue.push(cycle);
    slots++;
    unitsThisCycle.set(unit, (unitsThisCycle.get(unit) ?? 0) + 1);
    const l = t.sched.lat(mi);
    for (const d of instrDefs(mi)) ready.set(d, cycle + l);
  }
  const cycles = seq.length ? Math.max(...seq.map((mi, i) => issue[i] + 1)) : 0;
  return { issue, cycles };
}

export function scheduleRegion(t: Target, block: string, instrs: MInstr[]): SchedRegion {
  const { edges, lat } = buildDAG(t, instrs);
  const n = instrs.length;
  const succ: DepEdge[][] = Array.from({ length: n }, () => []);
  const pred: DepEdge[][] = Array.from({ length: n }, () => []);
  for (const e of edges) { succ[e.from].push(e); pred[e.to].push(e); }
  const height = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    height[i] = lat[i];
    for (const e of succ[i]) height[i] = Math.max(height[i], e.lat + height[e.to]);
  }
  const done = new Array(n).fill(-1);
  const order: number[] = [];
  const steps: SchedRegion['steps'] = [];
  let cycle = 0;
  while (order.length < n) {
    const cand: number[] = [];
    for (let i = 0; i < n; i++) {
      if (done[i] >= 0) continue;
      let ok = true;
      for (const e of pred[i]) {
        if (done[e.from] < 0 || done[e.from] + e.lat > cycle) { ok = false; break; }
      }
      if (ok) cand.push(i);
    }
    cand.sort((a, b) => height[b] - height[a] || a - b);
    const issued: number[] = [];
    const units = new Map<string, number>();
    for (const i of cand) {
      if (issued.length >= t.sched.issueWidth) break;
      const u = t.sched.unit(instrs[i]);
      if (u !== 'alu' && (units.get(u) ?? 0) >= 1) continue;
      // zero-latency successors issued in the same cycle must keep program order for WAR
      if (pred[i].some((e) => e.lat === 0 && done[e.from] < 0)) continue;
      units.set(u, (units.get(u) ?? 0) + 1);
      issued.push(i);
      done[i] = cycle;
      order.push(i);
    }
    steps.push({ cycle, ready: cand, issued });
    cycle++;
    if (cycle > 100000) throw new Error('scheduler did not terminate');
  }
  const before = simulateInOrder(t, instrs);
  const after = simulateInOrder(t, order.map((i) => instrs[i]));
  return {
    block, instrs, edges, height, lat, cycle: done, order, steps,
    beforeCycles: before.cycles, afterCycles: after.cycles, beforeIssue: before.issue, afterIssue: after.issue,
  };
}

export function scheduleFunction(f: MFunc, t: Target, mode: 'pre' | 'post'): SchedResult {
  const regions: SchedRegion[] = [];
  const barrier = (mi: MInstr) => {
    const cls = t.opInfo(mi.op)?.cls;
    if (cls === 'call' || isTerminator(t, mi)) return true;
    if (mode === 'post') return mi.tag === 'prologue' || mi.tag === 'epilogue';
    let pinned = false;
    forEachReg(mi, (r) => { if (r.k === 'preg' && r.r !== t.zero && r.r !== t.sp) pinned = true; });
    return pinned || !!mi.implDefs?.length || !!mi.implUses?.length;
  };
  let beforeTotal = 0, afterTotal = 0;
  for (const b of f.blocks) {
    const out: MInstr[] = [];
    let cur: MInstr[] = [];
    const flush = () => {
      if (cur.length > 1) {
        const r = scheduleRegion(t, b.name, cur);
        regions.push(r);
        out.push(...r.order.map((i) => cur[i]));
        beforeTotal += r.beforeCycles;
        afterTotal += r.afterCycles;
      } else out.push(...cur);
      cur = [];
    };
    for (const mi of b.instrs) {
      if (barrier(mi)) { flush(); out.push(mi); }
      else cur.push(mi);
    }
    flush();
    b.instrs = out;
  }
  return { regions, beforeTotal, afterTotal };
}

export type { MBlock };
