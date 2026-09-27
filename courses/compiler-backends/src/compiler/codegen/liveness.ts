// Liveness analysis on machine IR: the classic backward dataflow problem
//
//   LiveOut(b) = ∪ LiveIn(s)  for s in succ(b)
//   LiveIn(b)  = Use(b) ∪ (LiveOut(b) − Def(b))
//
// solved by round-robin iteration in postorder until nothing changes.
// Registers are keys: vregs are >= 0, tracked physical registers are -(r+1).
// Also builds live intervals over a linear instruction numbering, used by the
// linear-scan allocator and the live-range visualisations.

import { dfs } from '../analysis/graph';
import type { Target } from '../target/target';
import { mirGraph } from './mcfg';
import { instrDefs, instrUses, keyIsPreg, keyPreg, type MFunc, type MInstr } from './mir';

export interface BlockLive {
  use: Set<number>;
  def: Set<number>;
  liveIn: Set<number>;
  liveOut: Set<number>;
}

export interface LiveIter {
  round: number;
  block: number;
  liveIn: number[];
  liveOut: number[];
  changed: boolean;
}

export interface Range { from: number; to: number }
export interface Interval {
  key: number;
  ranges: Range[];
  start: number;
  end: number;
  uses: number[]; // positions
  defs: number[];
}

export interface Liveness {
  blocks: BlockLive[];
  iterations: LiveIter[];
  rounds: number;
  /** live set after each instruction (by instr id) */
  liveAfter: Map<number, Set<number>>;
  liveBefore: Map<number, Set<number>>;
  /** linear numbering: instr id -> index (positions are 2*index for uses, 2*index+1 for defs) */
  index: Map<number, number>;
  order: MInstr[];
  blockRange: { from: number; to: number }[];
  intervals: Map<number, Interval>;
}

/**
 * Physical registers that take part in liveness/interference: everything the
 * allocator may hand out, plus the ABI registers that appear in the code
 * (argument/return registers), even when a demo restricts the register file.
 */
export function tracked(t: Target): Set<number> {
  return new Set([...t.allocOrder, ...t.argRegs, t.retReg, ...(t.pinnedRegs ?? [])]);
}

export function defsOf(mi: MInstr, track: Set<number>) {
  return instrDefs(mi).filter((k) => !keyIsPreg(k) || track.has(keyPreg(k)));
}
export function usesOf(mi: MInstr, track: Set<number>) {
  return instrUses(mi).filter((k) => !keyIsPreg(k) || track.has(keyPreg(k)));
}

export function liveness(f: MFunc, t: Target): Liveness {
  const g = mirGraph(f);
  const track = tracked(t);
  const blocks: BlockLive[] = f.blocks.map((b) => {
    const use = new Set<number>(), def = new Set<number>();
    for (const mi of b.instrs) {
      for (const u of usesOf(mi, track)) if (!def.has(u)) use.add(u);
      for (const d of defsOf(mi, track)) def.add(d);
    }
    return { use, def, liveIn: new Set(use), liveOut: new Set() };
  });
  const { postorder } = dfs(g);
  const unreached = f.blocks.map((_, i) => i).filter((i) => !postorder.includes(i));
  const order = [...postorder, ...unreached];
  const iterations: LiveIter[] = [];
  let round = 0;
  for (let changed = true; changed; ) {
    changed = false;
    round++;
    for (const bi of order) {
      const bl = blocks[bi];
      const out = new Set<number>();
      for (const s of g.succs[bi]) for (const x of blocks[s].liveIn) out.add(x);
      const inn = new Set(bl.use);
      for (const x of out) if (!bl.def.has(x)) inn.add(x);
      const ch = inn.size !== bl.liveIn.size || out.size !== bl.liveOut.size;
      if (ch) changed = true;
      bl.liveIn = inn;
      bl.liveOut = out;
      iterations.push({ round, block: bi, liveIn: [...inn], liveOut: [...out], changed: ch });
    }
  }

  // per-instruction sets and linear numbering
  const liveAfter = new Map<number, Set<number>>(), liveBefore = new Map<number, Set<number>>();
  const index = new Map<number, number>();
  const orderI: MInstr[] = [];
  const blockRange: { from: number; to: number }[] = [];
  for (const b of f.blocks) {
    const from = orderI.length * 2;
    for (const mi of b.instrs) { index.set(mi.id, orderI.length); orderI.push(mi); }
    blockRange.push({ from, to: orderI.length * 2 });
  }
  const intervals = new Map<number, Interval>();
  const iv = (k: number) => {
    let x = intervals.get(k);
    if (!x) intervals.set(k, (x = { key: k, ranges: [], start: Infinity, end: -Infinity, uses: [], defs: [] }));
    return x;
  };
  const addRange = (k: number, from: number, to: number) => {
    const x = iv(k);
    // ranges are added in decreasing position order (backward walk); merge with the first
    const first = x.ranges[0];
    if (first && to >= first.from) {
      first.from = Math.min(first.from, from);
      first.to = Math.max(first.to, to);
    } else x.ranges.unshift({ from, to });
  };
  const setFrom = (k: number, from: number) => {
    const x = iv(k);
    if (x.ranges.length) x.ranges[0].from = from;
    else x.ranges.unshift({ from, to: from + 1 });
  };
  for (let bi = f.blocks.length - 1; bi >= 0; bi--) {
    const b = f.blocks[bi];
    const { from, to } = blockRange[bi];
    const live = new Set(blocks[bi].liveOut);
    for (const k of live) addRange(k, from, to);
    for (let k = b.instrs.length - 1; k >= 0; k--) {
      const mi = b.instrs[k];
      const pos = index.get(mi.id)! * 2;
      liveAfter.set(mi.id, new Set(live));
      for (const d of defsOf(mi, track)) {
        if (live.has(d)) setFrom(d, pos + 1);
        else addRange(d, pos + 1, pos + 2); // dead def still occupies its register briefly
        iv(d).defs.unshift(pos + 1);
        live.delete(d);
      }
      for (const u of usesOf(mi, track)) {
        addRange(u, from, pos + 1);
        iv(u).uses.unshift(pos);
        live.add(u);
      }
      liveBefore.set(mi.id, new Set(live));
    }
  }
  for (const x of intervals.values()) {
    x.ranges.sort((a, b) => a.from - b.from);
    const merged: Range[] = [];
    for (const r of x.ranges) {
      const last = merged[merged.length - 1];
      if (last && r.from <= last.to) last.to = Math.max(last.to, r.to);
      else merged.push({ ...r });
    }
    x.ranges = merged;
    x.start = merged[0]?.from ?? 0;
    x.end = merged[merged.length - 1]?.to ?? 0;
  }
  return { blocks, iterations, rounds: round, liveAfter, liveBefore, index, order: orderI, blockRange, intervals };
}

export function intervalsIntersect(a: Interval, b: Interval): boolean {
  let i = 0, j = 0;
  while (i < a.ranges.length && j < b.ranges.length) {
    const x = a.ranges[i], y = b.ranges[j];
    if (x.from < y.to && y.from < x.to) return true;
    if (x.to <= y.from) i++;
    else j++;
  }
  return false;
}
