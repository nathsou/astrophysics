import { describe, expect, it } from 'vitest';
import { arity, evaluate, R } from '../src/engine/recursive/rf.ts';
import * as Lib from '../src/engine/computability/library.ts';
import { gHierarchy } from '../src/engine/computability/ackermann.ts';
import { indexOf, sameDefinition, stripDefs, haltsWithin } from '../src/engine/computability/indices.ts';
import { decodeSeq, digitCount, evaluate as evalNat } from '../src/engine/numbers/nat.ts';
import {
  bookCode,
  certificate,
  classify,
  compositionParts,
  gLevel,
  indexLog10,
  listDiagonal,
  notation,
  parseNotation,
  prDiagonal,
  prRow,
  safeIndex,
  size,
  stage,
  unfoldRec,
} from '../src/engine/computability/primrec.ts';
import { haltingDiagonal, normalFormSearch, unaryIndices, unboundedSearch } from '../src/engine/computability/search.ts';
import { childrenOfAll, codeNumber, containsAllSubtrees, depth, distinctSubtrees, hSubtreeSeqLevels, leaf, node, treeCode, treeCodeText } from '../src/engine/computability/trees.ts';
import { append, COV_PRESETS, element, runCourseOfValues, runSimultaneous, SIM_PRESETS } from '../src/engine/computability/recursions.ts';

describe('primitive recursion, unfolded', () => {
  it('computes h(x, 0), …, h(x, y) by the equations', () => {
    const u = unfoldRec(Lib.mult(), [2n], 3n);
    expect(u.ok).toBe(true);
    if (!u.ok) return;
    expect(u.k).toBe(1);
    expect(u.rows.map((r) => r.value)).toEqual([0n, 2n, 4n, 6n]); // the book's mult(2, 0..3)
    expect(u.status).toBe('ok');
    const e = unfoldRec(Lib.exp(), [2n], 5n);
    expect(e.ok && e.rows.map((r) => r.value)).toEqual([1n, 2n, 4n, 8n, 16n, 32n]);
  });

  it('reports running out of fuel, and rejects what is not a recursion', () => {
    const u = unfoldRec(Lib.exp(), [3n], 8n, { fuel: 200 });
    expect(u.ok && u.status).toBe('out-of-fuel');
    expect(unfoldRec(Lib.dist(), [1n], 1n).ok).toBe(false);
    expect(unfoldRec(Lib.add(), [1n, 2n], 1n).ok).toBe(false);
  });

  it('evaluates a composition part by part', () => {
    const swap = R.comp(Lib.tsub(), [R.proj(2, 1), R.proj(2, 0)]);
    const c = compositionParts(swap, [2n, 7n]);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.parts.inner.map((i) => i.value)).toEqual([7n, 2n]);
    expect(c.parts.outer?.value).toBe(5n);
    const bad = compositionParts(R.comp(Lib.add(), [R.proj(1, 0)]), [1n]);
    expect(bad.ok).toBe(false);
  });
});

describe('what makes a definition primitive recursive', () => {
  it('classifies, stages and certifies', () => {
    expect(classify(Lib.prime())).toEqual({ pr: true, usesBasic: false });
    expect(classify(R.min(R.proj(2, 1)))).toMatchObject({ pr: false, reason: 'min' });
    expect(classify(R.comp(R.basic('add'), [R.proj(1, 0), R.proj(1, 0)]))).toEqual({ pr: true, usesBasic: true });
    // add = Rec(P^1_0, Comp(succ; P^3_2)): the step is at stage 1, the recursion at stage 2
    expect(stage(Lib.add())).toBe(2);
    expect(stage(Lib.mult())).toBe(4);
    expect(stage(R.succ())).toBe(0);
    expect(stage(R.min(R.proj(2, 1)))).toBeNull();
    expect(size(Lib.add())).toBe(5);
    const c = certificate(Lib.add());
    expect(c.ok).toBe(true);
    if (c.ok) {
      expect(c.cert.clause).toBe(5);
      expect(c.cert.name?.name).toBe('add');
      expect(c.cert.children.map((ch) => ch.clause)).toEqual([3, 4]);
      expect(c.cert.children[1].children.map((ch) => ch.clause)).toEqual([2, 3]);
    }
    expect(certificate(R.min(R.proj(2, 1))).ok).toBe(false);
    expect(certificate(R.rec(R.zero(), R.zero())).ok).toBe(false);
  });

  it('the book’s notation for add, and parsing it back', () => {
    expect(notation(Lib.add())).toBe('Rec_1[P^1_0, Comp_{1,3}[succ, P^3_2]]');
    const p = parseNotation('Rec_1[P^1_0, Comp_{1,3}[succ, P^3_2]]');
    expect(p.ok).toBe(true);
    if (p.ok) expect(sameDefinition(p.rf, stripDefs(Lib.add()))).toBe(true);
    for (const e of Lib.LIBRARY) {
      const back = parseNotation(notation(e.build()));
      expect(back.ok, e.name).toBe(true);
      if (back.ok) expect(sameDefinition(back.rf, stripDefs(e.build())), e.name).toBe(true);
    }
  });

  it('accepts the complete notation for mult (the book’s exercise)', () => {
    const p = parseNotation('Rec_1[zero, Comp_{2,3}[Rec_1[P^1_0, Comp_{1,3}[succ, P^3_2]], P^3_2, P^3_0]]');
    expect(p).toMatchObject({ ok: true, abbreviations: [] });
    if (p.ok) expect(sameDefinition(p.rf, Lib.mult())).toBe(true);
  });

  it('parses variants and reports mistakes', () => {
    expect(parseNotation('Rec[0, Comp[S, P^{3}_{2}]]').ok).toBe(true);
    expect(parseNotation('Rec_1[zero, Comp_2,3[add, P^3_2, P^3_0]]')).toMatchObject({ ok: true, abbreviations: ['add'] });
    expect(parseNotation('Comp_{2,3}[succ, P^3_2]')).toMatchObject({ ok: false });
    expect(parseNotation('Comp_{1,2}[succ, P^3_2]')).toMatchObject({ ok: false });
    expect(parseNotation('Rec_2[P^1_0, Comp_{1,3}[succ, P^3_2]]')).toMatchObject({ ok: false });
    expect(parseNotation('P^2_2')).toMatchObject({ ok: false });
    expect(parseNotation('Rec_1[P^1_0, succ]')).toMatchObject({ ok: false });
    expect(parseNotation('succ junk')).toMatchObject({ ok: false });
  });

  it('the book’s numbering of notations', () => {
    expect(evalNat(bookCode(R.zero())!)).toBe(2n); // ⟨0⟩
    expect(evalNat(bookCode(R.succ())!)).toBe(4n); // ⟨1⟩
    expect(evalNat(bookCode(R.proj(1, 0))!)).toBe(360n); // ⟨2, 1, 0⟩ = 2³·3²·5
    const add = bookCode(Lib.add())!;
    expect(evalNat(add, 1 << 16)).toBeNull(); // far too large
    expect(digitCount(add)).not.toBeNull();
    expect(bookCode(R.min(R.proj(2, 1)))).toBeNull();
    const d = decodeSeq(evalNat(bookCode(R.comp(R.succ(), [R.zero()]))!)!);
    expect(d.ok && d.items).toEqual([3n, 1n, 1n, 4n, 2n]); // ⟨3, 1, 1, #succ, #zero⟩
  });

  it('estimates index sizes and computes small ones exactly', () => {
    for (const e of Lib.LIBRARY.slice(0, 12)) {
      const f = e.build();
      const exact = indexOf(f);
      const est = indexLog10(f);
      const digits = exact.toString().length;
      // a rough estimate: good to within a factor for small indices, and to a few per cent for large ones
      if (digits > 3) expect(est).toBeGreaterThan((digits - 1) * 0.5);
      if (digits > 3) expect(est).toBeLessThan(digits * 1.1 + 1);
      if (digits > 100) expect(Math.abs(est - digits) / digits).toBeLessThan(0.05);
      expect(safeIndex(f)).toEqual({ ok: true, e: exact });
    }
    expect(safeIndex(Lib.prime())).toMatchObject({ ok: false });
  });
});

describe('the hierarchy g_n as primitive recursive definitions', () => {
  it('agrees with the rewriting in ackermann.ts', () => {
    for (let n = 0; n <= 3; n++) {
      const g = gLevel(n);
      expect(arity(g)).toEqual({ ok: true, arity: 1 });
      expect(classify(g).pr).toBe(true);
      for (let x = 0n; x <= (n === 3 ? 2n : 5n); x++) {
        const h = gHierarchy(n, x);
        const r = evaluate(g, [x], { fuel: 2_000_000, maxTraceDepth: -1 });
        expect(r.status).toBe('ok');
        expect(h.status === 'ok' && h.value, `g_${n}(${x})`).toBe(r.value);
      }
    }
  });
});

describe('the enumeration of unary primitive recursive functions', () => {
  it('follows the book’s convention for codes that are not notations', () => {
    expect(prRow(1n)).toMatchObject({ kind: 'pr' });
    expect(prRow(4n)).toMatchObject({ kind: 'zero-by-convention' });
    expect(prRow(45n)).toMatchObject({ kind: 'zero-by-convention', why: expect.stringContaining('μ') }); // Min(P^2_1)
  });

  it('the diagonal differs from every row where it was computed', () => {
    const rows = prDiagonal(0n, 40, 40, 5000);
    rows.forEach((r, e) => {
      expect(r.diag.kind).toBe('value'); // every row is total, and these are small
      if (r.diag.kind === 'value') {
        expect(r.h).toBe(r.diag.value + 1n);
        expect(r.cells[e]).toEqual(r.diag);
      }
    });
    const lst = listDiagonal([Lib.id(), Lib.pred(), Lib.fac()], 4, 10_000);
    expect(lst.map((r) => r.h)).toEqual([1n, 1n, 3n]); // id(0)+1, pred(1)+1, fac(2)+1
  });
});

describe('unbounded search', () => {
  // f(x, z) = 1 ∸ χ_=(x + x, z): μx f(x, z) is z/2 for even z and undefined for odd z
  const half = Lib.charNot(R.comp(Lib.chiEq(), [R.comp(Lib.add(), [R.proj(2, 0), R.proj(2, 0)]), R.proj(2, 1)]));

  it('finds the least zero', () => {
    const r = unboundedSearch(half, [6n]);
    expect(r).toMatchObject({ kind: 'found', value: 3n });
    if (r.kind === 'found') expect(r.tests.map((t) => t.value)).toEqual([1n, 1n, 1n, 0n]);
  });

  it('reports a search that ran out of budget, without calling it undefined', () => {
    const r = unboundedSearch(half, [7n], { fuel: 5000, maxTests: 1000 });
    expect(['exhausted', 'stuck']).toContain(r.kind);
    const r2 = unboundedSearch(half, [7n], { fuel: 1_000_000, maxTests: 10 });
    expect(r2).toMatchObject({ kind: 'exhausted', searchedBelow: 10n });
  });

  it('gets stuck at an undefined intermediate value, as the book’s definition requires', () => {
    // g(w, x, z) = 1 ∸ x;  f(x, z) = μw g(w, x, z): undefined at x = 0, 0 for x ≥ 1
    const f = R.min(R.comp(Lib.tsub(), [Lib.constN(1, 3), R.proj(3, 1)]));
    expect(arity(f)).toEqual({ ok: true, arity: 2 });
    const r = unboundedSearch(f, [5n], { fuel: 3000 });
    expect(r).toMatchObject({ kind: 'stuck', at: 0n });
  });

  it('checks the arity of f', () => {
    expect(unboundedSearch(half, [1n, 2n])).toMatchObject({ kind: 'error' });
  });
});

describe('normal form and halting, with a budget', () => {
  it('the least s with T′(e, x, s) is the number of calls', () => {
    const r = normalFormSearch(31n, 4n, 1000); // Comp(succ; succ)
    expect(r.value).toBe(6n);
    expect(r.leastS).toBeDefined();
    expect(haltsWithin(31n, 4n, r.leastS!)).toMatchObject({ halts: true });
    expect(haltsWithin(31n, 4n, r.leastS! - 1)).toMatchObject({ halts: false, reason: 'out-of-fuel' });
    const d = normalFormSearch(45n, 3n, 500); // Min(P^2_1) at 3: never halts
    expect(d.leastS).toBeUndefined();
    expect(normalFormSearch(4n, 0n, 100).definition.ok).toBe(false);
  });

  it('the diagonal of the halting proof', () => {
    const rows = haltingDiagonal([0n, 1n, 4n, 45n], 500);
    expect(rows.map((r) => [r.h, r.d])).toEqual([
      [1, 'undefined'],
      [1, 'undefined'],
      [0, 1],
      ['unknown', 'unknown'],
    ]);
    expect(unaryIndices(0n, 50)).toContain(45n);
    expect(unaryIndices(0n, 50)).not.toContain(4n);
  });
});

describe('trees', () => {
  const book = node(1, [leaf(2), leaf(3)]);

  it('codes trees as in the book', () => {
    expect(treeCodeText(leaf(7))).toBe('⟨0, 7⟩');
    expect(treeCodeText(book)).toBe('⟨2, ⟨0, 2⟩, ⟨0, 3⟩, 1⟩');
    expect(codeNumber(leaf(2))).toBe(54n); // 2^1 · 3^3
    const c = codeNumber(book, 1 << 20);
    expect(c).not.toBeNull();
    const d = decodeSeq(c!);
    expect(d.ok && d.items).toEqual([2n, 54n, 162n, 1n]);
    expect(digitCount(treeCode(node(0, [book, book])))).not.toBeNull();
  });

  it('hSubtreeSeq collects every subtree, with repetitions', () => {
    const t = node(0, [book, leaf(4)]);
    expect(depth(t)).toBe(2);
    expect(childrenOfAll([t, book])).toHaveLength(4);
    const levels = hSubtreeSeqLevels(t, 4);
    expect(levels.map((l) => l.seq.length)).toEqual([1, 3, 7, 13, 21]);
    expect(containsAllSubtrees(t, levels[1].seq)).toBe(false);
    expect(containsAllSubtrees(t, levels[depth(t)].seq)).toBe(true);
    expect(distinctSubtrees(t)).toHaveLength(5);
  });
});

describe('other recursions via sequence codes', () => {
  it('reads and appends', () => {
    expect(element(0n, 0)).toBe(0n);
    const s = append(append(0n, 0, 4n), 1, 0n); // ⟨4, 0⟩ = 2^5 · 3
    expect(s).toBe(96n);
    expect([element(s, 0), element(s, 1)]).toEqual([4n, 0n]);
  });

  it('course-of-values recursions compute the intended functions', () => {
    for (const p of COV_PRESETS) {
      const rows = runCourseOfValues(p, p.maxY);
      rows.forEach((r) => {
        expect(r.value, `${p.id}(${r.y})`).toBe(p.spec(r.y));
        const d = decodeSeq(r.next);
        expect(d.ok && d.items.length).toBe(Number(r.y) + 1);
        expect(r.reads.every((rd) => rd.i < Number(r.y))).toBe(true);
      });
    }
  });

  it('simultaneous recursions', () => {
    for (const p of SIM_PRESETS) {
      for (const r of runSimultaneous(p, p.maxY)) expect([r.h0, r.h1]).toEqual(p.spec(r.y));
    }
  });
});
