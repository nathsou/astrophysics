import { describe, expect, test } from 'vitest';
import { mulberry32 } from '../twolevel/random';
import { STEER_NAMES } from '../devices/vcpld32-arch';
import { allocateTerms, arrangeFb, maxTermsAt, type AllocDemand, type FbAllocation } from './allocator';

const demand = (terms: (number | [number, boolean])[]): (AllocDemand | undefined)[] =>
  Array.from({ length: 8 }, (_, i) => {
    const t = terms[i];
    if (t === undefined || t === 0) return undefined;
    return Array.isArray(t) ? { terms: t[0], oe: t[1] } : { terms: t };
  });

/** Every invariant of a successful allocation. */
function check(demands: (AllocDemand | undefined)[], a: FbAllocation) {
  const used = new Set<string>();
  let borrowed = 0;
  for (const m of a.mcs) {
    const need = demands[m.mc]?.terms ?? 0;
    expect(m.sources).toHaveLength(need);
    expect(m.own + m.fromBelow + m.fromAbove).toBe(need);
    for (const s of m.sources) {
      // A source is a slot of this macrocell or a neighbour, not the enable slot, used once, and steered towards this macrocell.
      expect(Math.abs(s.mc - m.mc)).toBeLessThanOrEqual(1);
      const owner = a.mcs[s.mc]!;
      expect(s.slot).toBeLessThan(owner.capacity);
      const key = `${s.mc}.${s.slot}`;
      expect(used.has(key)).toBe(false);
      used.add(key);
      const want = s.mc === m.mc ? 'local' : s.mc < m.mc ? 'up' : 'down';
      expect(STEER_NAMES.includes(owner.steer[s.slot]!)).toBe(true);
      expect(owner.steer[s.slot]).toBe(want);
    }
    borrowed += m.borrowed;
    // Slots that nobody uses are off; the enable slot is never steered.
    const active = m.steer.filter((x) => x !== 'off').length;
    expect(active).toBe(m.own + m.lent);
    if (m.oeSlot) expect(m.steer[4]).toBe('off');
  }
  expect(a.borrowed).toBe(borrowed);
}

/** Exhaustive minimum of the total borrowed terms, by depth-first search over the seven link flows. */
function bruteForce(demands: (AllocDemand | undefined)[]): number | null {
  const cap = demands.map((d) => (d?.oe ? 4 : 5));
  const need = demands.map((d) => d?.terms ?? 0);
  let best: number | null = null;
  const rec = (i: number, prev: number, cost: number) => {
    if (best !== null && cost >= best) return;
    if (i === 8) {
      best = cost;
      return;
    }
    const range = i === 7 ? [0] : [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
    for (const f of range) {
      const received = Math.max(prev, 0) + Math.max(-f, 0);
      const own = need[i]! - received;
      if (own < 0) continue;
      if (own + Math.max(f, 0) + Math.max(-prev, 0) > cap[i]!) continue;
      rec(i + 1, f, cost + Math.abs(f));
    }
  };
  rec(0, 0, 0);
  return best;
}

describe('allocateTerms', () => {
  test('outputs that fit in their own five terms borrow nothing', () => {
    const d = demand([5, 3, 1, 5, 2]);
    const a = allocateTerms(d);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.borrowed).toBe(0);
    check(d, a);
  });

  test('a demanding macrocell borrows from a neighbour that has spare terms', () => {
    const d = demand([0, 0, 0, 8]);
    const a = allocateTerms(d);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    check(d, a);
    expect(a.borrowed).toBe(3);
    expect(a.mcs[3]!.own).toBe(5);
    expect(a.mcs[3]!.borrowed).toBe(3);
    // The lenders are the neighbours, and the slots they lend are steered up or down.
    expect(a.mcs[2]!.lent + a.mcs[4]!.lent).toBe(3);
    const steer = [...a.mcs[2]!.steer, ...a.mcs[4]!.steer];
    expect(steer.filter((s) => s === 'up').length + steer.filter((s) => s === 'down').length).toBe(3);
  });

  test('a busy neighbour cannot lend: the terms come from the other side, or the allocation fails', () => {
    const d = demand([5, 5, 8, 5, 5, 5, 5, 5]);
    const a = allocateTerms(d);
    expect(a.ok).toBe(false);
    // With an idle macrocell at the end, the chain shifts: MC 1 takes MC 0's spare slots and lends its own to MC 2.
    const chain = allocateTerms(demand([0, 5, 8, 5]));
    expect(chain.ok).toBe(true);
    if (chain.ok) check(demand([0, 5, 8, 5]), chain);
    const d2 = demand([0, 0, 8, 5]);
    const b = allocateTerms(d2);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    check(d2, b);
    // MC 2 can only borrow from MC 1 (steered up), MC 3 being full.
    expect(b.mcs[2]!.fromBelow).toBe(3);
    expect(b.mcs[2]!.fromAbove).toBe(0);
  });

  test('a macrocell collects at most 15 terms inside a block, 10 at either end; an enable term costs one slot', () => {
    expect(maxTermsAt(3, false)).toBe(15);
    expect(maxTermsAt(0, false)).toBe(10);
    expect(maxTermsAt(7, false)).toBe(10);
    expect(maxTermsAt(3, true)).toBe(14);
    expect(allocateTerms(demand([0, 0, 0, 15])).ok).toBe(true);
    expect(allocateTerms(demand([0, 0, 0, 16])).ok).toBe(false);
    expect(allocateTerms(demand([10])).ok).toBe(true);
    expect(allocateTerms(demand([11])).ok).toBe(false);
    expect(allocateTerms(demand([0, 0, 0, 0, 0, 0, 0, 10])).ok).toBe(true);
    expect(allocateTerms(demand([0, 0, 0, 0, 0, 0, 0, 11])).ok).toBe(false);
    expect(allocateTerms(demand([0, 0, 0, [14, true]])).ok).toBe(true);
    expect(allocateTerms(demand([0, 0, 0, [15, true]])).ok).toBe(false);
    const d = demand([0, 0, 0, 15]);
    const a = allocateTerms(d);
    if (a.ok) {
      check(d, a);
      expect(a.mcs[2]!.lent).toBe(5);
      expect(a.mcs[4]!.lent).toBe(5);
    }
  });

  test('failure says which macrocell runs out and by how much', () => {
    const a = allocateTerms(demand([0, 0, 0, 0, 16]));
    expect(a.ok).toBe(false);
    if (a.ok) return;
    expect(a.mc).toBe(4);
    expect(a.needed).toBe(16);
    expect(a.available).toBe(15);
    expect(a.shortfall).toBe(1);
    expect(a.message).toContain('macrocell 4');
  });

  test('borrowing is minimal and feasibility exact: agrees with an exhaustive search on random demands', () => {
    const rng = mulberry32(21);
    let feasible = 0;
    for (let t = 0; t < 400; t++) {
      const d: (AllocDemand | undefined)[] = Array.from({ length: 8 }, () => {
        if (rng.chance(0.4)) return undefined;
        return { terms: 1 + rng.int(rng.chance(0.3) ? 12 : 5), oe: rng.chance(0.25) };
      });
      const a = allocateTerms(d);
      const want = bruteForce(d);
      expect(a.ok).toBe(want !== null);
      if (a.ok) {
        feasible++;
        check(d, a);
        expect(a.borrowed).toBe(want);
      }
    }
    expect(feasible).toBeGreaterThan(100);
  });
});

describe('arrangeFb', () => {
  test('a heavy output is moved away from the end of the chain and next to idle macrocells', () => {
    const arr = arrangeFb([
      { terms: 12, oe: false, buried: false },
      { terms: 1, oe: false, buried: false },
      { terms: 1, oe: false, buried: false },
    ]);
    expect(arr).not.toBeNull();
    const p = arr!.positions[0]!;
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(7);
    check(
      Array.from({ length: 8 }, (_, i) => {
        const k = arr!.positions.indexOf(i);
        return k < 0 ? undefined : { terms: [12, 1, 1][k]! };
      }),
      arr!.allocation,
    );
  });

  test('outputs that fit are placed in order in the lowest macrocells, with no borrowing', () => {
    const arr = arrangeFb(Array.from({ length: 4 }, () => ({ terms: 3, oe: false, buried: false })))!;
    expect(arr.positions).toEqual([0, 1, 2, 3]);
    expect(arr.borrowed).toBe(0);
  });

  test('fixed macrocells and reserved input pads are respected', () => {
    const reserved = [true, true, false, false, false, false, false, false];
    const arr = arrangeFb(
      [
        { terms: 2, oe: false, buried: false },
        { terms: 2, oe: false, buried: true },
        { terms: 2, oe: false, buried: false, mc: 5 },
      ],
      reserved,
    )!;
    expect(arr.positions[2]).toBe(5);
    expect(reserved[arr.positions[0]!]).toBe(false);
    // Reserved pads: only a buried output may sit there. Fixing a driving output on one is impossible.
    expect(arrangeFb([{ terms: 1, oe: false, buried: false, mc: 0 }], reserved)).toBeNull();
    expect(arrangeFb([{ terms: 1, oe: false, buried: true, mc: 0 }], reserved)).not.toBeNull();
  });

  test('impossible blocks are refused: too many outputs, too many terms, two outputs on one macrocell', () => {
    expect(arrangeFb(Array.from({ length: 9 }, () => ({ terms: 1, oe: false, buried: false })))).toBeNull();
    expect(arrangeFb([15, 15, 15].map((terms) => ({ terms, oe: false, buried: false })))).toBeNull();
    expect(arrangeFb([{ terms: 1, oe: false, buried: false, mc: 2 }, { terms: 1, oe: false, buried: false, mc: 2 }])).toBeNull();
  });

  test('a full block of 5-term outputs fits; one more term anywhere does not', () => {
    const five = Array.from({ length: 8 }, () => ({ terms: 5, oe: false, buried: false }));
    expect(arrangeFb(five)).not.toBeNull();
    expect(arrangeFb(five.map((m, i) => (i === 3 ? { ...m, terms: 6 } : m)))).toBeNull();
  });
});
