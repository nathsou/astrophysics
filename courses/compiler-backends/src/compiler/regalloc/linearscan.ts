// Linear-scan register allocation (Poletto & Sarkar, TOPLAS 1999).
// Live ranges are approximated by intervals over a linear instruction order;
// a single sweep in order of increasing start point assigns registers,
// expiring intervals that have ended. When no register is free, spill the
// interval that ends furthest away. Physical registers constrained by the
// code (argument registers, call clobbers) appear as fixed intervals.

import type { Target } from '../target/target';
import { intervalsIntersect, liveness, type Interval, type Liveness } from '../codegen/liveness';
import { isCopy, keyIsPreg, keyPreg, regKey, type MFunc, type RegOp } from '../codegen/mir';

export type LSEvent =
  | { k: 'start'; iv: number; pos: number; active: number[] }
  | { k: 'expire'; iv: number; reg: number; pos: number }
  | { k: 'assign'; iv: number; reg: number; hint?: boolean; blockedByFixed: number[] }
  | { k: 'spill'; iv: number; pos: number; victimOf?: number; reason: string };

export interface LSResult {
  color: Map<number, number>;
  spilled: number[];
  events: LSEvent[];
  live: Liveness;
}

export function linearScan(f: MFunc, t: Target, noSpill: Set<number> = new Set()): LSResult {
  const live = liveness(f, t);
  const regs = t.allocOrder;
  const fixed = new Map<number, Interval>();
  const vivs: Interval[] = [];
  for (const [k, iv] of live.intervals) {
    if (keyIsPreg(k)) fixed.set(keyPreg(k), iv);
    else vivs.push(iv);
  }
  vivs.sort((a, b) => a.start - b.start || a.key - b.key);
  // copy hints: vreg -> other side of a COPY
  const hints = new Map<number, number[]>();
  for (const mi of live.order) {
    if (!isCopy(mi)) continue;
    const [d, s] = mi.ops as RegOp[];
    const dk = regKey(d), sk = regKey(s);
    if (!hints.has(dk)) hints.set(dk, []);
    if (!hints.has(sk)) hints.set(sk, []);
    hints.get(dk)!.push(sk);
    hints.get(sk)!.push(dk);
  }
  const color = new Map<number, number>();
  const events: LSEvent[] = [];
  const spilled: number[] = [];
  let active: Interval[] = [];

  const fixedBlock = (iv: Interval, r: number) => {
    const fx = fixed.get(r);
    return !!fx && intervalsIntersect(fx, iv);
  };

  for (const cur of vivs) {
    events.push({ k: 'start', iv: cur.key, pos: cur.start, active: active.map((a) => a.key) });
    // expire old intervals
    active = active.filter((a) => {
      if (a.end <= cur.start) {
        events.push({ k: 'expire', iv: a.key, reg: color.get(a.key)!, pos: cur.start });
        return false;
      }
      return true;
    });
    const busy = new Set(active.map((a) => color.get(a.key)!));
    const blocked = regs.filter((r) => fixedBlock(cur, r));
    const partners = (hints.get(cur.key) ?? []).filter((h) => keyIsPreg(h) && !regs.includes(keyPreg(h))).map(keyPreg);
    const free = [...regs, ...partners].filter((r) => !busy.has(r) && !fixedBlock(cur, r));
    if (free.length) {
      let pick = free[0], hinted = false;
      for (const h of hints.get(cur.key) ?? []) {
        const hr = keyIsPreg(h) ? keyPreg(h) : color.get(h);
        if (hr !== undefined && free.includes(hr)) { pick = hr; hinted = true; break; }
      }
      color.set(cur.key, pick);
      active.push(cur);
      events.push({ k: 'assign', iv: cur.key, reg: pick, hint: hinted, blockedByFixed: blocked });
      continue;
    }
    // spill: the interval (active or current) that ends last, if its register would suit cur
    const candidates = active.filter((a) => !noSpill.has(a.key) && !fixedBlock(cur, color.get(a.key)!));
    candidates.sort((a, b) => b.end - a.end);
    const victim = candidates[0];
    if (victim && (victim.end > cur.end || noSpill.has(cur.key))) {
      const r = color.get(victim.key)!;
      color.delete(victim.key);
      spilled.push(victim.key);
      active = active.filter((a) => a !== victim);
      events.push({ k: 'spill', iv: victim.key, pos: cur.start, victimOf: cur.key, reason: `ends last (at ${victim.end}); its register goes to ${cur.key}` });
      color.set(cur.key, r);
      active.push(cur);
      events.push({ k: 'assign', iv: cur.key, reg: r, blockedByFixed: blocked });
    } else {
      spilled.push(cur.key);
      events.push({ k: 'spill', iv: cur.key, pos: cur.start, reason: 'no free register and it ends later than every active interval' });
    }
  }
  return { color, spilled, events, live };
}
