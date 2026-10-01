/**
 * Selections. Two styles, both plain functions:
 *
 *  - over an `EventTable` (columnar): `cut(table, (i) => pt[i] > 25 && Math.abs(eta[i]) < 2.4)`;
 *  - over the reconstructed objects of one event: `objects(ev, 'muon', { ptMin: 20, etaMax: 2.4 })`.
 *
 * `Cutflow` records how many events survive each successive cut, the table every analysis paper prints.
 */
import { EventTable, type FullEvent, type ObjectKind, type RecoEvent, type RecoObject } from '../event/index.ts';
import { eta as etaOf, pt as ptOf } from '../kinematics/index.ts';

/** Keep the rows of `table` for which `keep(i)` is true. */
export function cut(table: EventTable, keep: (i: number) => boolean): EventTable {
  return table.select(keep);
}

/** The indices of the rows passing `keep`. */
export function passing(table: EventTable, keep: (i: number) => boolean): number[] {
  const out: number[] = [];
  for (let i = 0; i < table.n; i++) if (keep(i)) out.push(i);
  return out;
}

export interface ObjectCuts {
  /** Minimum transverse momentum, GeV. */
  ptMin?: number;
  /** Maximum |η|. */
  etaMax?: number;
  /** Maximum isolation (scalar pT sum in the cone divided by the object's pT). Objects without an isolation value pass. */
  isolationMax?: number;
  /** Required charge sign (+1 or −1). */
  charge?: 1 | -1;
  /** Minimum b-tag score (jets). */
  btagMin?: number;
  /** Any further condition. */
  where?: (o: RecoObject) => boolean;
}

/** The objects of a given kind in an event that pass the cuts, sorted by decreasing pT. */
export function objects(ev: RecoEvent | FullEvent, kind: ObjectKind, cuts: ObjectCuts = {}): RecoObject[] {
  const reco = 'reco' in ev ? ev.reco : ev;
  const out: RecoObject[] = [];
  for (const o of reco.objects) {
    if (o.kind !== kind) continue;
    if (cuts.ptMin !== undefined && ptOf(o.p) < cuts.ptMin) continue;
    if (cuts.etaMax !== undefined && Math.abs(etaOf(o.p)) > cuts.etaMax) continue;
    if (cuts.isolationMax !== undefined && o.isolation !== undefined && o.isolation > cuts.isolationMax) continue;
    if (cuts.charge !== undefined && o.charge !== cuts.charge) continue;
    if (cuts.btagMin !== undefined && (o.btag ?? 0) < cuts.btagMin) continue;
    if (cuts.where && !cuts.where(o)) continue;
    out.push(o);
  }
  return out.sort((a, b) => ptOf(b.p) - ptOf(a.p));
}

export interface CutflowRow {
  name: string;
  /** Events (or summed weights) surviving this cut and all before it. */
  count: number;
  /** count / previous count. */
  relEff: number;
  /** count / initial count. */
  cumEff: number;
}

/**
 * A cutflow: the initial count and, for each named cut applied in order, the number of events left.
 *
 *     const cf = new Cutflow(table.n);
 *     let t = table;
 *     t = cut(t, (i) => …); cf.add('two muons', t.n);
 *     console.log(cf.toString());
 *
 * `Cutflow.run` applies a list of named predicates to an array of items and records everything in one call.
 */
export class Cutflow {
  private readonly steps: { name: string; count: number }[] = [];
  readonly initial: number;
  readonly label: string;
  constructor(initial: number, label = 'all events') {
    this.initial = initial;
    this.label = label;
  }

  /** Record the count after a cut. Counts may be sums of weights. */
  add(name: string, count: number): this {
    this.steps.push({ name, count });
    return this;
  }

  rows(): CutflowRow[] {
    const rows: CutflowRow[] = [{ name: this.label, count: this.initial, relEff: 1, cumEff: 1 }];
    let prev = this.initial;
    for (const s of this.steps) {
      rows.push({ name: s.name, count: s.count, relEff: prev > 0 ? s.count / prev : 0, cumEff: this.initial > 0 ? s.count / this.initial : 0 });
      prev = s.count;
    }
    return rows;
  }
  /** Count after the last cut. */
  get final(): number {
    return this.steps.length ? this.steps[this.steps.length - 1]!.count : this.initial;
  }
  /** A fixed-width text table. */
  toString(): string {
    const rows = this.rows();
    const w = Math.max(4, ...rows.map((r) => r.name.length));
    const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toPrecision(5));
    const lines = [`${'cut'.padEnd(w)}  ${'count'.padStart(12)}  ${'rel. eff.'.padStart(9)}  ${'cum. eff.'.padStart(9)}`];
    for (const r of rows) lines.push(`${r.name.padEnd(w)}  ${fmt(r.count).padStart(12)}  ${(100 * r.relEff).toFixed(1).padStart(8)}%  ${(100 * r.cumEff).toFixed(1).padStart(8)}%`);
    return lines.join('\n');
  }

  /** Apply the steps in order to `items`, recording the cutflow. Returns the survivors and the cutflow. */
  static run<T>(items: readonly T[], steps: { name: string; pass: (item: T, index: number) => boolean }[], weight?: (item: T) => number): { kept: T[]; cutflow: Cutflow } {
    const total = (xs: readonly T[]) => (weight ? xs.reduce((s, x) => s + weight(x), 0) : xs.length);
    const cf = new Cutflow(total(items));
    let cur = items.slice();
    for (const s of steps) {
      cur = cur.filter((x, i) => s.pass(x, i));
      cf.add(s.name, total(cur));
    }
    return { kept: cur, cutflow: cf };
  }
}

/**
 * Apply named row predicates to an event table in order, recording the cutflow. Each predicate receives the row index
 * and the table as it stands after the earlier cuts (row numbers change when rows are removed).
 */
export function applyCuts(table: EventTable, steps: { name: string; pass: (i: number, t: EventTable) => boolean }[]): { table: EventTable; cutflow: Cutflow } {
  const cf = new Cutflow(table.n);
  let t = table;
  for (const s of steps) {
    const cur = t;
    t = cur.select((i) => s.pass(i, cur));
    cf.add(s.name, t.n);
  }
  return { table: t, cutflow: cf };
}
