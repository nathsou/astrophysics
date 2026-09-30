import { describe, expect, test } from 'vitest';
import { EventTable, type FullEvent, type RecoEvent, type RecoObject } from '../event/index.ts';
import { fromPtEtaPhiM } from '../kinematics/index.ts';
import { Cutflow, applyCuts, cut, objects, passing } from './select.ts';

const obj = (kind: RecoObject['kind'], pt: number, eta: number, extra: Partial<RecoObject> = {}): RecoObject => ({ kind, p: fromPtEtaPhiM(pt, eta, 0.3, 0.1), truth: -1, ...extra });
const reco = (objs: RecoObject[]): RecoEvent => ({ tracks: [], vertices: [], clusters: [], objects: objs, met: { x: 0, y: 0 }, sumEt: 0 });

describe('objects', () => {
  const ev = reco([obj('muon', 15, 0.5), obj('muon', 45, -1.2, { charge: -1, isolation: 0.05 }), obj('muon', 30, 2.6), obj('electron', 50, 0.1), obj('jet', 80, 1, { btag: 0.9 }), obj('muon', 28, 0.2, { charge: 1, isolation: 0.4 })]);
  test('filters by kind, pT, |η|, isolation and charge, sorted by decreasing pT', () => {
    expect(objects(ev, 'muon').map((o) => Math.round(o.p.px ** 2 + o.p.py ** 2) > 0)).toEqual([true, true, true, true]);
    const pts = objects(ev, 'muon').map((o) => Math.hypot(o.p.px, o.p.py));
    expect(pts.map((p) => Math.round(p))).toEqual([45, 30, 28, 15]);
    expect(objects(ev, 'muon', { ptMin: 20, etaMax: 2.4 }).length).toBe(2);
    expect(objects(ev, 'muon', { isolationMax: 0.1 }).length).toBe(3); // objects without isolation pass
    expect(objects(ev, 'muon', { charge: 1 }).length).toBe(1);
    expect(objects(ev, 'jet', { btagMin: 0.8 }).length).toBe(1);
    expect(objects(ev, 'jet', { btagMin: 0.95 }).length).toBe(0);
    expect(objects(ev, 'electron', { where: (o) => o.p.E > 1000 }).length).toBe(0);
  });
  test('accepts a FullEvent', () => {
    const full: FullEvent = { reco: ev, weight: 1 };
    expect(objects(full, 'electron').length).toBe(1);
  });
});

describe('table selections and the cutflow', () => {
  const t = new EventTable(6).setColumn('pt', [10, 25, 30, 45, 60, 80]).setColumn('eta', [0.1, 3, 1, 0.5, 2.5, 0.2]).setJagged('mu', [[1], [], [1, 2], [1], [1, 2, 3], []]);
  test('cut keeps the matching rows, jagged columns included', () => {
    const c = cut(t, (i) => t.col('pt')[i]! > 20);
    expect(c.n).toBe(5);
    expect(Array.from(c.row('mu', 0))).toEqual([]);
    expect(Array.from(c.row('mu', 1))).toEqual([1, 2]);
    expect(passing(t, (i) => t.col('eta')[i]! > 2)).toEqual([1, 4]);
  });
  test('applyCuts records a cutflow with relative and cumulative efficiencies', () => {
    const { table, cutflow } = applyCuts(t, [
      { name: 'pT > 20', pass: (i, x) => x.col('pt')[i]! > 20 },
      { name: '|η| < 2.4', pass: (i, x) => Math.abs(x.col('eta')[i]!) < 2.4 },
      { name: 'at least 2 muons', pass: (i, x) => x.row('mu', i).length >= 2 },
    ]);
    expect(table.n).toBe(1);
    const rows = cutflow.rows();
    expect(rows.map((r) => r.count)).toEqual([6, 5, 3, 1]);
    expect(rows[1]!.relEff).toBeCloseTo(5 / 6, 12);
    expect(rows[2]!.relEff).toBeCloseTo(3 / 5, 12);
    expect(rows[3]!.cumEff).toBeCloseTo(1 / 6, 12);
    expect(cutflow.final).toBe(1);
    const text = cutflow.toString();
    expect(text).toContain('at least 2 muons');
    expect(text).toContain('16.7%');
    expect(text.split('\n').length).toBe(5);
  });
  test('Cutflow.run on plain items, with weights', () => {
    const items = [{ v: 1, w: 2 }, { v: 5, w: 1 }, { v: 9, w: 0.5 }];
    const { kept, cutflow } = Cutflow.run(items, [{ name: 'v > 3', pass: (x) => x.v > 3 }], (x) => x.w);
    expect(kept.length).toBe(2);
    expect(cutflow.rows().map((r) => r.count)).toEqual([3.5, 1.5]);
  });
});
