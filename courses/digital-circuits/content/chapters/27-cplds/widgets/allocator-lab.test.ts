import { describe, expect, test } from 'vitest';
import { SCENARIOS, allocate, describeMc, rearrange, MCS } from './allocator-lab';
import { fitCpldEquations } from '$lib/pld/cpld';

const by = (id: string) => SCENARIOS.find((s) => s.id === id)!.demand;

describe('the allocator lab of Chapter 27', () => {
  test('five terms each: nothing is borrowed and every slot is used', () => {
    const r = allocate(by('even'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.borrowed).toBe(0);
    expect(r.slotsFree).toBe(0);
    expect(r.mcs.every((m) => m.tpd === 7.5)).toBe(true);
  });

  test('a 12-term output in the middle borrows seven terms from its neighbours; each lends what it does not use', () => {
    const r = allocate(by('wide'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const m = r.mcs[3]!;
    expect(m.own).toBe(5);
    expect(m.borrowed).toBe(7);
    expect(m.fromBelow + m.fromAbove).toBe(7);
    // Its neighbours have only three spare slots each (they need two of their own), so one more term has to come
    // from further out: a neighbour borrows from its own neighbour in turn. Eight terms are borrowed in all.
    expect(r.borrowed).toBe(8);
    expect(r.mcs.filter((c) => c.mc !== 3 && c.borrowed > 0)).toHaveLength(1);
    // Whoever borrows pays the allocator's delay; a macrocell that only lends does not.
    expect(m.tpd).toBe(8.5);
    expect(r.mcs.filter((c) => c.demand > 0 && c.borrowed === 0).every((c) => c.tpd === 7.5)).toBe(true);
    // Every slot that is steered away has a borrower next door.
    for (const c of r.mcs) for (const s of c.slots) if (s.kind === 'lent') expect(Math.abs(s.to - c.mc)).toBe(1);
    // A macrocell lends only slots it does not need itself.
    for (const c of r.mcs) expect(c.own + c.lent).toBeLessThanOrEqual(5);
  });

  test('parity of four inputs at the end of the chain borrows three terms, as in the Studio', () => {
    const r = allocate(by('parity'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mcs[0]!.borrowed).toBe(3);
    expect(r.mcs[1]!.lent).toBe(3);
    expect(describeMc(r.mcs[0]!)).toBe('5 own + 3 from MC1');
    // The real fitter agrees.
    const fit = fitCpldEquations('P = A ^ B ^ C ^ D', { inputs: ['A', 'B', 'C', 'D'] });
    expect(fit.utilisation.borrowedTerms).toBe(3);
  });

  test('12 terms at the end of the chain cannot be collected: the end macrocell has one neighbour, so ten is the most', () => {
    const r = allocate(by('end'));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failing).toBe(0);
    expect(r.needed).toBe(12);
    expect(r.available).toBe(10);
    expect(r.message).toContain('needs 12 product terms');
    // The same output anywhere inside the chain is fine.
    const inside = allocate([1, 12, 1, 1, 1, 1, 1, 1]);
    expect(inside.ok).toBe(true);
  });

  test('the fitter moves the wide output away from the end, and the allocation then works', () => {
    const moved = rearrange(by('end'));
    expect(moved).not.toBeNull();
    expect(moved![0]).not.toBe(12);
    expect(moved!.reduce((a, b) => a + b, 0)).toBe(by('end').reduce((a, b) => a + b, 0));
    expect(allocate(moved!).ok).toBe(true);
    expect(moved!.length).toBe(MCS);
  });

  test('the crowded block has exactly as many slots as terms and is feasible only by a chain of borrowing', () => {
    const d = by('crowded');
    expect(d.reduce((a, b) => a + b, 0)).toBe(40);
    const r = allocate(d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.slotsFree).toBe(0);
    expect(r.borrowed).toBeGreaterThan(5);
  });

  test('more terms than slots is refused, whatever the arrangement', () => {
    expect(allocate([5, 5, 5, 5, 5, 5, 5, 6]).ok).toBe(false);
    expect(rearrange([5, 5, 5, 5, 5, 5, 5, 6])).toBeNull();
  });
});
