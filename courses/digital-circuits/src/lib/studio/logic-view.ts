/**
 * The logic view: a {@link Network} drawn as a two-level circuit on the bench's schematic renderer.
 *
 * Columns, left to right:
 *
 *   inputs and feedback labels │ complement inverters │ literal buses │ AND terms │ OR per output │
 *   polarity inverter │ flip-flop │ polarity inverter │ tri-state │ output LED
 *
 * The drawing is a plain `Circuit` (components and axis-aligned wires on the grid), so the digital engine
 * runs it and the Schematic component animates it. Nothing here touches the DOM.
 *
 * Wiring rules that keep distinct nets from touching (the netlist resolver joins any wire end that lies on
 * another wire, and any two wires with a vertex in common):
 *
 * - Literal buses are vertical lines, one per literal, each fed from its source row in a band above the
 *   first AND gate; AND inputs tap them with horizontal wires that end on the line.
 * - Between gate columns, every net has a private vertical *track* (tracks are shared only by nets whose
 *   vertical extents do not overlap). A producer leaves on a horizontal stub whose row is even (a one-row
 *   jog fixes odd ones); every consumer gate is placed on an odd row so its pins are odd. Stubs and
 *   branches therefore never share a row, and no wire end can land on another wire.
 * - Long-range connections (the clock, the asynchronous reset, output enables, feedback) use net labels.
 */
import type { Circuit, Params, Placed, Wire } from '../sim/netlist/types';
import { placedPins } from '../sim/netlist/connect';
import { reachableTerms, termText, usedSignals } from './network';
import type { NetOutput, NetTerm, Network, Probe, Ref } from './types';

export const MAX_FANIN = 8;

type Col = 'and1' | 'and2' | 'or1' | 'or2' | 'inv1' | 'ff' | 'inv2' | 'tri' | 'led';
const STAGE_COLS = new Set<Col>(['inv1', 'ff', 'inv2', 'tri', 'led']);

/** A gate in the plan: its row is known before its column. */
interface G {
  comp: Placed;
  col: Col;
  /** Number of input pins. */
  k: number;
}

interface NetPlan {
  /** Producer gate. */
  src: G;
  sinks: { g: G; pin: number }[];
}

export interface LogicView {
  circuit: Circuit;
  /** What a click on a component selects. */
  refs: Map<string, Ref>;
  /** Component id of the AND gate (or the last gate) that produces each term. */
  termGate: Map<string, string>;
  /** Components that belong to an output (OR, inverters, flip-flop, tri-state, LED). */
  outputParts: Map<string, string[]>;
  /** Input signal → toggle (or button) component id. */
  inputComp: Map<string, string>;
  /** Component id of the clock button, if any. */
  clockComp?: string;
  /** Output name → id of its indicator (whose input pin A carries the output level). */
  led: Map<string, string>;
  stats: { gates: number; wires: number };
}

const uniq = (used: Set<string>, base: string): string => {
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base} #${n}`;
  used.add(id);
  return id;
};
/** The id of a signal or output component: its own name, which was reserved up front. */
const own = (name: string): string => name;

const isEven = (n: number) => (n & 1) === 0;
const oddAtLeast = (n: number) => (isEven(n) ? n + 1 : n);
const evenStub = (y: number) => (isEven(y) ? y : y + 1);

/** Vertical tracks for nets, given each net's [lo, hi] rows: nets share a track only if their spans are 2+ rows apart. */
export function assignTracks(spans: { lo: number; hi: number }[]): { track: number[]; count: number } {
  const order = spans.map((_, i) => i).sort((a, b) => spans[a]!.lo - spans[b]!.lo || spans[a]!.hi - spans[b]!.hi);
  const ends: number[] = [];
  const track: number[] = new Array(spans.length).fill(0);
  for (const i of order) {
    const s = spans[i]!;
    let t = ends.findIndex((e) => e + 2 <= s.lo);
    if (t < 0) {
      t = ends.length;
      ends.push(s.hi);
    } else ends[t] = s.hi;
    track[i] = t;
  }
  return { track, count: ends.length };
}

const chunks = <T>(xs: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
};

export interface LogicViewOptions {
  /** Input levels at build time (toggle positions). */
  inputs?: Record<string, number>;
}

export function buildLogicView(net: Network, opts: LogicViewOptions = {}): LogicView {
  const comps: Placed[] = [];
  const wires: Wire[] = [];
  const ids = new Set<string>();
  const refs = new Map<string, Ref>();
  const termGate = new Map<string, string>();
  const outputParts = new Map<string, string[]>();
  const inputComp = new Map<string, string>();
  const led = new Map<string, string>();
  const gates: G[] = [];
  // Names of signals and outputs are reserved: a single-literal term called "Q1" must not take the LED's id.
  for (const n of [...net.inputs, ...net.outputs.map((o) => o.name), ...(net.clock ? [net.clock] : [])]) ids.add(n);

  const termById = new Map(net.terms.map((t) => [t.id, t]));
  const live = reachableTerms(net);
  const liveIds = new Set(live.map((t) => t.id));
  const registered = net.outputs.some((o) => o.ff !== 'comb');
  const clockSignal = registered ? (net.clock ?? 'CLK') : undefined;

  // ── Signals and the source band ──────────────────────────────────────────
  const signals = usedSignals({ ...net, terms: live });
  const needs = new Map<string, { t: boolean; c: boolean }>();
  for (const s of signals) needs.set(s, { t: false, c: false });
  for (const t of live) for (const l of t.lits) needs.get(l.signal)![l.neg ? 'c' : 't'] = true;
  const clockRow = clockSignal !== undefined && !signals.includes(clockSignal);
  const bandRows = (clockRow ? 1 : 0) + signals.length;
  const rowOfSignal = new Map<string, number>();
  signals.forEach((s, j) => rowOfSignal.set(s, 1 + 2 * ((clockRow ? 1 : 0) + j)));
  const bandBottom = 2 * bandRows + 1;

  // ── Plan: gates and rows ─────────────────────────────────────────────────
  const mk = (id: string, type: string, col: Col, y0: number, params: Params = {}, k = 0, extra: Partial<Placed> = {}): G => {
    const g: G = { comp: { id, type, x: 0, y: y0, params, ...extra }, col, k };
    comps.push(g.comp);
    gates.push(g);
    return g;
  };
  const outRowOf = (g: G): number => {
    const t = g.comp.type;
    if (t === 'and' || t === 'or' || t === 'xor') return g.comp.y + g.k - 1;
    return g.comp.y; // not, buffer, const, tristate, flip-flops
  };
  const bodyBottom = (g: G): number => {
    const t = g.comp.type;
    if (t === 'and' || t === 'or') return g.comp.y + 2 * g.k - 1;
    if (t === 'dff' || t === 'dffr' || t === 'tff') return g.comp.y + 2 * Math.max(2, g.k) - 1;
    return g.comp.y + 1;
  };

  interface TermPlan {
    term: NetTerm;
    out: G;
    taps: { y: number; sig: string; neg: boolean }[];
  }
  const termPlans = new Map<string, TermPlan>();
  const nets1: NetPlan[] = []; // chunk ANDs → the AND that combines them
  const netsOr: NetPlan[] = []; // term outputs → OR gates
  const netsOr2: NetPlan[] = []; // OR gates → the OR that combines them

  /** Place a term's gates from row `top`; returns the row below its lowest body. */
  function placeTerm(term: NetTerm, top: number): number {
    const text = termText(term);
    const id = uniq(ids, ids.has(text) ? `${text} (term)` : text);
    let cy = top;
    const lits = term.kind === 'true' ? [] : term.lits;
    const groups = lits.length === 0 ? [[]] : chunks(lits, MAX_FANIN);
    const plan: TermPlan = { term, out: undefined as unknown as G, taps: [] };
    const chunkGates: G[] = [];
    groups.forEach((grp, gi) => {
      const k = grp.length;
      const y0 = cy + 1;
      const type = k === 0 ? 'const' : k === 1 ? 'buffer' : 'and';
      const cid = groups.length === 1 ? id : uniq(ids, `${id} [${gi + 1}]`);
      const g = mk(cid, type, 'and1', y0, type === 'and' ? { inputs: k } : type === 'const' ? { value: 1 } : {}, k);
      refs.set(cid, { kind: 'term', id: term.id });
      grp.forEach((l, i) => plan.taps.push({ y: y0 + 2 * i, sig: l.signal, neg: l.neg }));
      chunkGates.push(g);
      cy = bodyBottom(g) + 2;
    });
    if (chunkGates.length > 1) {
      const k = chunkGates.length;
      const stubs = chunkGates.map((g) => evenStub(outRowOf(g)));
      const center = (Math.min(...stubs) + Math.max(...stubs)) / 2;
      const y0 = oddAtLeast(Math.max(Math.round(center - (k - 1)), top + 1));
      const fid = uniq(ids, `${id} [all]`);
      const f = mk(fid, 'and', 'and2', y0, { inputs: k }, k);
      refs.set(fid, { kind: 'term', id: term.id });
      chunkGates.forEach((g, i) => nets1.push({ src: g, sinks: [{ g: f, pin: i }] }));
      cy = Math.max(cy, bodyBottom(f) + 2);
      plan.out = f;
    } else plan.out = chunkGates[0]!;
    termPlans.set(term.id, plan);
    termGate.set(term.id, plan.out.comp.id);
    return cy;
  }

  let cursor = bandBottom + 1;
  interface OutPlan {
    o: NetOutput;
    last: G;
    stageRow: number;
    parts: G[];
    index: number;
  }
  const outPlans: OutPlan[] = [];

  for (const o of net.outputs) {
    const blockTop = cursor;
    let cy = blockTop;
    const newIds = [...new Set([...o.terms, ...(o.oe ? [o.oe] : [])])].filter((tid) => !termPlans.has(tid) && liveIds.has(tid));
    for (const tid of newIds) cy = placeTerm(termById.get(tid)!, cy);

    // OR gate(s): items sorted by the row they arrive from.
    const items = o.terms.filter((tid) => termPlans.has(tid)).map((tid) => termPlans.get(tid)!);
    items.sort((a, b) => outRowOf(a.out) - outRowOf(b.out));
    const groups = items.length === 0 ? [[]] : chunks(items, MAX_FANIN);
    const parts: G[] = [];
    const or1: G[] = [];
    let orTop = blockTop;
    groups.forEach((grp, gi) => {
      const m = grp.length;
      const stubs = grp.map((p) => evenStub(outRowOf(p.out)));
      const center = m ? (Math.min(...stubs) + Math.max(...stubs)) / 2 : (blockTop + cy) / 2;
      const y0 = oddAtLeast(Math.max(Math.round(center - (m - 1)), orTop + 1));
      const type = m === 0 ? 'const' : m === 1 ? 'buffer' : 'or';
      const id = groups.length > 1 ? `${o.name} (OR ${gi + 1})` : `${o.name} (OR)`;
      const g = mk(uniq(ids, id), type, 'or1', y0, type === 'or' ? { inputs: m } : type === 'const' ? { value: 0 } : {}, m);
      refs.set(g.comp.id, { kind: 'output', name: o.name });
      grp.forEach((p, i) => {
        const existing = netsOr.find((n) => n.src === p.out);
        if (existing) existing.sinks.push({ g, pin: i });
        else netsOr.push({ src: p.out, sinks: [{ g, pin: i }] });
      });
      or1.push(g);
      parts.push(g);
      orTop = bodyBottom(g) + 1;
    });
    let last = or1[0]!;
    if (or1.length > 1) {
      const k = or1.length;
      const stubs = or1.map((g) => evenStub(outRowOf(g)));
      const center = (Math.min(...stubs) + Math.max(...stubs)) / 2;
      const y0 = oddAtLeast(Math.max(Math.round(center - (k - 1)), orTop + 1));
      const or2 = mk(uniq(ids, `${o.name} (OR all)`), 'or', 'or2', y0, { inputs: k }, k);
      refs.set(or2.comp.id, { kind: 'output', name: o.name });
      or1.forEach((g, i) => netsOr2.push({ src: g, sinks: [{ g: or2, pin: i }] }));
      parts.push(or2);
      last = or2;
      orTop = bodyBottom(or2) + 1;
    }
    // The stage row must clear the block top (the tri-state's enable label above, the flip-flop's pins below).
    const minStage = blockTop + (o.oe ? 5 : 3);
    let shift = Math.max(0, minStage - outRowOf(last));
    shift += shift & 1; // even, so every OR gate stays on odd rows
    if (shift) {
      for (const g of parts) g.comp.y += shift;
      orTop += shift;
    }
    const stageRow = outRowOf(last);
    const add = (id: string, type: string, col: Col, params: Params = {}, k = 0, extra: Partial<Placed> = {}) => {
      const g = mk(uniq(ids, id), type, col, stageRow, params, k, extra);
      refs.set(g.comp.id, { kind: 'output', name: o.name });
      parts.push(g);
      return g;
    };
    if (o.invert === 'before') add(`${o.name} (invert)`, 'not', 'inv1');
    if (o.ff !== 'comb') {
      const init = String(o.init ?? 0);
      if (o.ff === 'T') add(`${o.name} (T flip-flop)`, 'tff', 'ff', { init }, 2);
      else if (o.reset) add(`${o.name} (flip-flop)`, 'dffr', 'ff', { init }, 3);
      else add(`${o.name} (flip-flop)`, 'dff', 'ff', { init }, 2);
    }
    if (o.invert === 'after') add(`${o.name} (invert)`, 'not', 'inv2');
    if (o.oe) add(`${o.name} (tri-state)`, 'tristate', 'tri');
    const ledId = own(o.name);
    const ledG = mk(ledId, 'indicator', 'led', stageRow, { color: 'amber' }, 0, { label: o.name });
    refs.set(ledId, { kind: 'output', name: o.name });
    parts.push(ledG);
    led.set(o.name, ledId);
    outPlans.push({ o, last, stageRow, parts, index: outPlans.length + 1 });
    cursor = Math.max(cy, orTop, stageRow + 7) + 1;
    outputParts.set(o.name, parts.map((g) => g.comp.id));
  }

  // The asynchronous reset term.
  let arGate: G | undefined;
  if (net.ar && termById.has(net.ar) && outPlans.some((p) => p.o.reset)) {
    const t = termById.get(net.ar)!;
    cursor = placeTerm(t, cursor) + 1;
    arGate = termPlans.get(t.id)!.out;
  }

  // ── Tracks ───────────────────────────────────────────────────────────────
  const rowOfSink = (s: { g: G; pin: number }) => s.g.comp.y + 2 * s.pin;
  const stubOf = (n: NetPlan) => evenStub(outRowOf(n.src));
  const spansOf = (nets: NetPlan[]) =>
    nets.map((n) => {
      const rows = [stubOf(n), ...n.sinks.map(rowOfSink)];
      return { lo: Math.min(...rows), hi: Math.max(...rows) };
    });
  const t1 = assignTracks(spansOf(nets1));
  const t2 = assignTracks(spansOf(netsOr));
  const t3 = assignTracks(spansOf(netsOr2));

  // ── Columns ──────────────────────────────────────────────────────────────
  const nT = signals.filter((s) => needs.get(s)!.t).length;
  const nC = signals.filter((s) => needs.get(s)!.c).length;
  const X_SRC = 1;
  const xT0 = 6;
  const X_N = xT0 + nT + 1;
  const xC0 = X_N + 7;
  const colX: Record<Col, number> = { and1: 0, and2: 0, or1: 0, or2: 0, inv1: 0, ff: 0, inv2: 0, tri: 0, led: 0 };
  colX.and1 = xC0 + nC + 3;
  let x = colX.and1 + 6;
  const ch1 = x + 6;
  if (nets1.length) {
    colX.and2 = ch1 + t1.count + 2;
    x = colX.and2 + 6;
  }
  const ch2 = x + 6;
  colX.or1 = ch2 + t2.count + 2;
  x = colX.or1 + 6;
  const ch3 = x + 3;
  if (netsOr2.length) {
    colX.or2 = ch3 + t3.count + 2;
    x = colX.or2 + 6;
  }
  x += 4;
  const any = (f: (o: NetOutput) => boolean) => net.outputs.some(f);
  if (any((o) => o.invert === 'before')) {
    colX.inv1 = x;
    x += 8;
  }
  if (any((o) => o.ff !== 'comb')) {
    colX.ff = x;
    x += 10;
  }
  if (any((o) => o.invert === 'after')) {
    colX.inv2 = x;
    x += 8;
  }
  if (any((o) => !!o.oe)) {
    colX.tri = x;
    x += 8;
  }
  colX.led = x + 5;
  for (const g of gates) g.comp.x = colX[g.col];

  // ── Emit ─────────────────────────────────────────────────────────────────
  const pinOf = (c: Placed, name: string): [number, number] => {
    const p = placedPins(c).find((q) => q.pin === name);
    if (!p) throw new Error(`no pin ${name} on ${c.type}`);
    return [p.x, p.y];
  };
  const outPin = (g: G): [number, number] => pinOf(g.comp, g.comp.type === 'tristate' ? 'Y' : g.comp.type.startsWith('dff') || g.comp.type === 'tff' ? 'Q' : 'Y');
  const inPin = (g: G, i: number): [number, number] => {
    const t = g.comp.type;
    if (t === 'not' || t === 'buffer' || t === 'indicator') return pinOf(g.comp, 'A');
    if (t === 'tristate') return pinOf(g.comp, i === 0 ? 'A' : 'EN');
    if (t === 'dff' || t === 'dffr') return pinOf(g.comp, ['D', 'CLK', 'CLR'][i]!);
    if (t === 'tff') return pinOf(g.comp, ['T', 'CLK'][i]!);
    return pinOf(g.comp, String.fromCharCode(65 + i));
  };
  const wire = (...pts: [number, number][]) => wires.push({ points: pts });
  const label = (idBase: string, name: string, at: [number, number], flip = false) => comps.push({ id: uniq(ids, idBase), type: 'label', x: at[0], y: at[1], flip, params: { name } });

  // Channels between gate columns.
  const emitChannel = (nets: NetPlan[], tracks: { track: number[] }, x0: number) => {
    nets.forEach((n, i) => {
      const [sx, sy] = outPin(n.src);
      const stub = stubOf(n);
      const tx = x0 + tracks.track[i]!;
      if (sy === stub) wire([sx, sy], [tx, stub]);
      else wire([sx, sy], [sx + 1, sy], [sx + 1, stub], [tx, stub]);
      const rows = [stub, ...n.sinks.map(rowOfSink)];
      const lo = Math.min(...rows);
      const hi = Math.max(...rows);
      if (lo < hi) wire([tx, lo], [tx, hi]);
      for (const s of n.sinks) {
        const [px, py] = inPin(s.g, s.pin);
        wire([tx, py], [px, py]);
      }
    });
  };
  emitChannel(nets1, t1, ch1);
  emitChannel(netsOr, t2, ch2);
  emitChannel(netsOr2, t3, ch3);

  // Literal buses: taps from the AND inputs to their lines.
  const lineX = new Map<string, { t?: number; c?: number }>();
  {
    let it = 0;
    let ic = 0;
    for (const s of signals) {
      const n = needs.get(s)!;
      lineX.set(s, { t: n.t ? xT0 + it++ : undefined, c: n.c ? xC0 + ic++ : undefined });
    }
  }
  const tapRows = new Map<string, number[]>();
  for (const p of termPlans.values())
    for (const tap of p.taps) {
      const key = `${tap.sig}|${tap.neg ? 'c' : 't'}`;
      (tapRows.get(key) ?? tapRows.set(key, []).get(key)!).push(tap.y);
      wire([lineX.get(tap.sig)![tap.neg ? 'c' : 't']!, tap.y], [colX.and1, tap.y]);
    }

  // Sources: toggles, feedback labels, the clock button, and the complement inverters.
  const initial = opts.inputs ?? {};
  for (const s of signals) {
    const r = rowOfSignal.get(s)!;
    const lx = lineX.get(s)!;
    const need = needs.get(s)!;
    let startX = 4;
    if (net.outputs.some((o) => o.name === s)) {
      const id = uniq(ids, `fb:${s}`);
      comps.push({ id, type: 'label', x: 5, y: r, flip: true, params: { name: s } });
      refs.set(id, { kind: 'signal', name: s });
      startX = 5;
    } else if (s === clockSignal) {
      const id = own(s);
      comps.push({ id, type: 'button', x: 1, y: r, params: { pressed: false }, label: s });
      inputComp.set(s, id);
      refs.set(id, { kind: 'signal', name: s });
    } else {
      const id = own(s);
      comps.push({ id, type: 'toggle', x: 1, y: r, params: { on: !!initial[s] }, label: s });
      inputComp.set(s, id);
      refs.set(id, { kind: 'signal', name: s });
    }
    const bottomOf = (k: 't' | 'c') => Math.max(r, ...(tapRows.get(`${s}|${k}`) ?? [r]));
    if (need.c) {
      const notId = uniq(ids, `!${s}`);
      comps.push({ id: notId, type: 'not', x: X_N, y: r, params: {} });
      refs.set(notId, { kind: 'signal', name: s });
      wire([startX, r], [X_N, r]);
      wire([X_N + 5, r], [lx.c!, r], [lx.c!, bottomOf('c')]);
      if (need.t) wire([lx.t!, r], [lx.t!, bottomOf('t')]);
    } else if (need.t) wire([startX, r], [lx.t!, r], [lx.t!, bottomOf('t')]);
    if (s === clockSignal) {
      // The clock is also a literal (pin 1 of a GAL): name its net, so the flip-flops see it.
      wire([startX + 1, r], [startX + 1, r - 1]);
      label('clk:src', 'CLK', [startX + 1, r - 1]);
    }
  }
  if (clockRow) {
    const id = own(clockSignal!);
    comps.push({ id, type: 'button', x: 1, y: 1, params: { pressed: false }, label: clockSignal });
    inputComp.set(clockSignal!, id);
    refs.set(id, { kind: 'signal', name: clockSignal! });
    wire([4, 1], [6, 1]);
    label('clk:src', 'CLK', [6, 1]);
  }

  // Stages after each OR: polarity, flip-flop, tri-state, LED; labels for clock, reset, enable and feedback.
  for (const p of outPlans) {
    const stage = p.parts.filter((g) => STAGE_COLS.has(g.col));
    let prev = outPin(p.last);
    for (const g of stage) {
      wire(prev, inPin(g, 0));
      if (g.comp.type !== 'indicator') prev = outPin(g);
    }
    // Feedback: a label on a stub above the wire just before the tri-state (or the LED).
    if (needs.has(p.o.name)) {
      const after = stage.find((g) => g.col === 'tri' || g.col === 'led')!;
      const fx = inPin(after, 0)[0] - 3;
      wire([fx, p.stageRow], [fx, p.stageRow - 2]);
      label(`fbl:${p.o.name}`, p.o.name, [fx, p.stageRow - 2]);
    }
    const ff = p.parts.find((g) => g.col === 'ff');
    if (ff) {
      label(`clk:${p.o.name}`, 'CLK', inPin(ff, 1), true);
      if (ff.comp.type === 'dffr') label(`ar:${p.o.name}`, 'AR', inPin(ff, 2), true);
    }
    const tri = p.parts.find((g) => g.col === 'tri');
    if (tri) {
      const en = inPin(tri, 1);
      const name = `OE${p.index}`;
      wire(en, [en[0], en[1] - 2]);
      label(`oe:${p.o.name}`, name, [en[0], en[1] - 2], true);
      const src = p.o.oe ? termPlans.get(p.o.oe)?.out : undefined;
      if (src) {
        const [ox, oy] = outPin(src);
        wire([ox, oy], [ox + 1, oy]);
        label(`oe:${p.o.name}:src`, name, [ox + 1, oy]);
      }
    }
  }
  if (arGate) {
    const [ox, oy] = outPin(arGate);
    wire([ox, oy], [ox + 1, oy]);
    label('ar:src', 'AR', [ox + 1, oy]);
  }

  const circuit: Circuit = { version: 1, title: 'Logic view', engine: 'digital', components: comps, wires };
  return { circuit, refs, termGate, outputParts, inputComp, clockComp: clockSignal !== undefined ? inputComp.get(clockSignal) : undefined, led, stats: { gates: gates.length, wires: wires.length } };
}

/** Component ids to highlight for a probe. */
export function highlightIds(view: LogicView, probe: Probe): Set<string> {
  const out = new Set<string>();
  for (const t of probe.terms) {
    const g = view.termGate.get(t);
    if (g) out.add(g);
  }
  for (const o of probe.outputs) for (const id of view.outputParts.get(o) ?? []) out.add(id);
  for (const s of probe.signals) {
    const id = view.inputComp.get(s);
    if (id) out.add(id);
  }
  return out;
}
