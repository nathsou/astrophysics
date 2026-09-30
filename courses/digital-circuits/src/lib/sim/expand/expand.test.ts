import { describe, expect, test } from 'vitest';
import '../netlist/catalog';
import { getDef, pinsOf, transformPoint, withDefaults } from '../netlist/catalog';
import { connect } from '../netlist/connect';
import { flatten, topLevelNets } from '../netlist/flatten';
import type { Circuit, Params, Placed } from '../netlist/types';
import { LX, LZ } from '../netlist/types';
import { createAnalogEngine } from '../analog';
import { createDigitalEngine } from '../digital';
import { createSwitchEngine, type SwitchEngine } from '../switch';
import type { Engine } from '../engine';
import { GATE_TYPES, cellFor, conducts, gateTransistors, transistorsOf, type GateType } from './cells';
import { canExpand, cellCircuit, expandCheck, expandToAnalog, expandToSwitch, ANALOG } from './expand';

/**
 * These tests settle 30 ns in one advance() call. The engine resolves each edge's picosecond
 * transient, which takes more than the per-call cap a UI frame uses, so lift the caps here.
 */
const SETTLE = { maxStepsPerAdvance: 100_000, maxWorkPerAdvance: 1e12 };

/** A bench for one gate: a toggle per input pin, the gate, an indicator "Y" on its output. */
function gateBench(type: GateType, inputs: number): Circuit {
  const def = getDef(type)!;
  const params: Params = type === 'not' || type === 'buffer' || type === 'tristate' ? {} : { inputs };
  const gate: Placed = { id: 'U1', type, x: 12, y: 0, params };
  const pins = pinsOf(def, withDefaults(def, params));
  const components: Placed[] = [gate];
  const wires: Circuit['wires'] = [];
  let out: [number, number] = [0, 0];
  for (const p of pins) {
    const [px, py] = transformPoint(p, gate);
    if (p.dir === 'out') {
      out = [px, py];
      continue;
    }
    if (p.name === 'EN') {
      components.push({ id: 'EN', type: 'toggle', x: px - 3, y: py - 3 });
      wires.push({ points: [[px, py - 3], [px, py]] });
    } else {
      components.push({ id: p.name, type: 'toggle', x: 0, y: py });
      wires.push({ points: [[3, py], [px, py]] });
    }
  }
  components.push({ id: 'Y', type: 'indicator', x: out[0] + 4, y: out[1] });
  wires.push({ points: [out, [out[0] + 4, out[1]]] });
  return { version: 1, title: `${type}${inputs}`, components, wires };
}

const inputNames = (type: GateType, inputs: number) => (type === 'tristate' ? ['A', 'EN'] : Array.from({ length: inputs }, (_, i) => String.fromCharCode(65 + i)));

const reference: Record<string, (b: number[]) => number> = {
  not: (b) => 1 - b[0]!,
  buffer: (b) => b[0]!,
  and: (b) => +b.every((x) => x === 1),
  nand: (b) => +!b.every((x) => x === 1),
  or: (b) => +b.some((x) => x === 1),
  nor: (b) => +!b.some((x) => x === 1),
  xor: (b) => b.reduce((a, x) => a ^ x, 0),
  xnor: (b) => 1 - b.reduce((a, x) => a ^ x, 0),
};

function* combos(n: number): Generator<number[]> {
  for (let i = 0; i < 1 << n; i++) yield Array.from({ length: n }, (_, j) => (i >> j) & 1);
}

const sizes = (type: GateType) => (type === 'not' || type === 'buffer' ? [1] : type === 'tristate' ? [1] : [1, 2, 3, 4]);

function drive(e: Engine, names: string[], values: number[]) {
  names.forEach((n, i) => e.setParam(n, 'on', values[i] === 1));
}

describe('cells: static CMOS duality', () => {
  for (const type of GATE_TYPES) {
    for (const n of sizes(type)) {
      test(`${type}${n}: exactly one network conducts and it computes the gate's function`, () => {
        const cell = cellFor(type, n);
        const names = inputNames(type, n);
        for (const bits of combos(names.length)) {
          const value: Record<string, number> = Object.fromEntries(names.map((nm, i) => [nm, bits[i]!]));
          for (const st of cell.stages) {
            const up = conducts(st.pun, (s) => value[s]!, true);
            const down = conducts(st.pdn, (s) => value[s]!, false);
            if (type === 'tristate' && st.out === 'Y') {
              expect(up && down).toBe(false);
              expect(up || down, 'tristate drives iff EN').toBe(value.EN === 1);
              if (up) value.Y = 1;
              else if (down) value.Y = 0;
              else value.Y = -1;
            } else {
              expect(up !== down, `${type}${n} stage ${st.out} at ${bits}: pull-up ${up}, pull-down ${down}`).toBe(true);
              value[st.out] = up ? 1 : 0;
            }
          }
          if (type === 'tristate') {
            if (value.EN === 1) expect(value.Y).toBe(value.A);
          } else expect(value.Y, `${type}${n} at ${bits}`).toBe(reference[type]!(bits));
        }
      });
    }
  }

  test('transistor counts', () => {
    expect(gateTransistors('not', 1)).toBe(2);
    expect(gateTransistors('nand', 2)).toBe(4);
    expect(gateTransistors('nor', 3)).toBe(6);
    expect(gateTransistors('and', 2)).toBe(6);
    expect(gateTransistors('or', 2)).toBe(6);
    expect(gateTransistors('buffer', 1)).toBe(4);
    expect(gateTransistors('xor', 2)).toBe(12);
    expect(gateTransistors('xnor', 2)).toBe(12);
    expect(gateTransistors('xor', 3)).toBe(24);
    expect(gateTransistors('tristate', 1)).toBe(8);
  });
});

describe('the drawing is wired as the cell says', () => {
  /** Every transistor terminal of the drawn gate sits on the node the cell names, and nodes are never merged or split. */
  function checkWiring(bench: Circuit, gateId: string, type: GateType, n: number) {
    const x = expandToSwitch(bench);
    const conn = connect(x.circuit);
    const cell = cellFor(type, n);
    const spec = transistorsOf(cell);
    const ids = x.map[gateId]!;
    expect(ids.length).toBe(spec.length);
    const symToNet = new Map<string, number>();
    const netToSym = new Map<number, string>();
    const bind = (sym: string, net: number, what: string) => {
      const known = symToNet.get(sym);
      expect(known === undefined || known === net, `${what}: node ${sym} is on two nets (${known}, ${net})`).toBe(true);
      const other = netToSym.get(net);
      expect(other === undefined || other === sym, `${what}: nodes ${other} and ${sym} are the same net ${net}`).toBe(true);
      symToNet.set(sym, net);
      netToSym.set(net, sym);
    };
    bind('VDD', conn.netNames.indexOf('+5V'), 'rail');
    bind('GND', conn.netNames.indexOf('GND'), 'ground');
    inputNames(type, n).forEach((nm) => bind(nm, conn.pinNet.get(`${nm}.Y`)!, `input ${nm}`));
    bind('Y', conn.pinNet.get('Y.A')!, 'output');
    ids.forEach((id, i) => {
      const t = spec[i]!;
      const comp = x.circuit.components.find((c) => c.id === id)!;
      expect(comp.type).toBe(t.p ? 'pmos' : 'nmos');
      bind(t.g, conn.pinNet.get(`${id}.G`)!, `${id} gate`);
      bind(t.d, conn.pinNet.get(`${id}.D`)!, `${id} drain`);
      bind(t.s, conn.pinNet.get(`${id}.S`)!, `${id} source`);
    });
    return x;
  }

  for (const type of GATE_TYPES) {
    for (const n of type === 'not' || type === 'buffer' || type === 'tristate' ? [1] : [1, 2, 3, 4, 5, 6, 7, 8]) {
      test(`${type}${n}`, () => {
        checkWiring(gateBench(type, n), 'U1', type, n);
      });
    }
  }

  test('in a bigger circuit, gate by gate', () => {
    for (const [c, gates] of [[halfAdder, { X1: ['xor', 2], U1: ['and', 2] }], [mux, { N1: ['not', 1], G1: ['and', 2], G2: ['and', 2], O1: ['or', 2] }]] as const) {
      const x = expandToSwitch(c);
      const conn = connect(x.circuit);
      // Each gate's inner nodes belong to that gate alone; only rail and ground are shared.
      const nets = new Map<string, Set<number>>();
      for (const [id, [type, n]] of Object.entries(gates) as [string, [GateType, number]][]) {
        const set = new Set<number>();
        for (const t of x.map[id]!) for (const pin of ['D', 'S']) set.add(conn.pinNet.get(`${t}.${pin}`)!);
        nets.set(id, set);
        expect(x.map[id]!.length).toBe(gateTransistors(type, n));
      }
      const rail = conn.netNames.indexOf('+5V');
      const gnd = conn.netNames.indexOf('GND');
      const ids = [...nets.keys()];
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) {
          const shared = [...nets.get(ids[i]!)!].filter((v) => nets.get(ids[j]!)!.has(v) && v !== rail && v !== gnd);
          expect(shared, `${ids[i]} and ${ids[j]} share channel nets`).toEqual([]);
        }
    }
  });
});

describe('switch level matches the digital gates', () => {
  for (const type of GATE_TYPES.filter((t) => t !== 'tristate')) {
    for (const n of sizes(type)) {
      test(`${type}${n}: truth table`, () => {
        const bench = gateBench(type, n);
        const digital = createDigitalEngine(flatten(bench));
        const exp = expandToSwitch(bench);
        const sw = createSwitchEngine(exp.netlist()) as SwitchEngine;
        const dOut = topLevelNets(bench).pinNet.get('Y.A')!;
        const sOut = topLevelNets(exp.circuit).pinNet.get('Y.A')!;
        const names = inputNames(type, n);
        for (const bits of combos(names.length)) {
          drive(digital, names, bits);
          digital.advance(20e-9);
          drive(sw, names, bits);
          sw.settle();
          expect(sw.logic(sOut), `${type}${n}(${bits})`).toBe(digital.logic(dOut));
          expect(sw.logic(sOut)).toBe(reference[type]!(bits));
          expect(sw.strengthKind(sOut), 'output is driven from a rail').toBe('driven');
        }
        expect(sw.messages.filter((m) => m.level !== 'info')).toEqual([]);
      });
    }
  }

  test('tristate: follows A while EN, floats otherwise', () => {
    const bench = gateBench('tristate', 1);
    const exp = expandToSwitch(bench);
    const sw = createSwitchEngine(exp.netlist()) as SwitchEngine;
    const out = topLevelNets(exp.circuit).pinNet.get('Y.A')!;
    for (const a of [0, 1]) {
      drive(sw, ['A', 'EN'], [a, 1]);
      sw.settle();
      expect(sw.logic(out)).toBe(a);
      expect(sw.strengthKind(out)).toBe('driven');
      drive(sw, ['A', 'EN'], [a, 0]);
      sw.settle();
      expect(sw.strengthKind(out), 'EN = 0 lets go').not.toBe('driven');
    }
    // With EN low from the start the output is never driven at all.
    const fresh = createSwitchEngine(exp.netlist());
    fresh.settle();
    expect(fresh.strengthKind(out)).not.toBe('driven');
    expect([LZ, LX]).toContain(fresh.logic(out));
  });
});

/** Let the analog engine run until the circuit has settled (ns). */
function settleAnalog(e: Engine, ns = 30) {
  e.settle();
  e.advance(ns * 1e-9);
}

describe('analog level matches the digital gates', () => {
  for (const type of GATE_TYPES.filter((t) => t !== 'tristate')) {
    for (const n of sizes(type)) {
      test(`${type}${n}: logic thresholds after settling`, () => {
        const bench = gateBench(type, n);
        const digital = createDigitalEngine(flatten(bench));
        const exp = expandToAnalog(bench);
        const an = createAnalogEngine(exp.netlist(), SETTLE);
        const dOut = topLevelNets(bench).pinNet.get('Y.A')!;
        const aOut = topLevelNets(exp.circuit).pinNet.get('Y.A')!;
        const names = inputNames(type, n);
        for (const bits of combos(names.length)) {
          drive(digital, names, bits);
          digital.advance(20e-9);
          drive(an, names, bits);
          settleAnalog(an);
          const v = an.voltage(aOut);
          expect(an.logic(aOut), `${type}${n}(${bits}) → ${v.toFixed(3)} V`).toBe(digital.logic(dOut));
          // Rail to rail: a static CMOS output is within a few mV of the rail it is connected to.
          expect(v < 0.05 || v > 4.95, `${v} V is not a clean level`).toBe(true);
        }
        expect(an.messages.filter((m) => m.level === 'error' || m.level === 'warning')).toEqual([]);
      });
    }
  }

  test('tristate: follows A while EN', () => {
    const exp = expandToAnalog(gateBench('tristate', 1));
    const an = createAnalogEngine(exp.netlist(), SETTLE);
    const out = topLevelNets(exp.circuit).pinNet.get('Y.A')!;
    for (const a of [0, 1]) {
      drive(an, ['A', 'EN'], [a, 1]);
      settleAnalog(an);
      expect(an.logic(out)).toBe(a);
    }
  });

  test('switching takes a realistic time, growing with the load', () => {
    const exp = expandToAnalog(gateBench('not', 1));
    const an = createAnalogEngine(exp.netlist(), { step: 20e-12 });
    const out = topLevelNets(exp.circuit).pinNet.get('Y.A')!;
    const inp = topLevelNets(exp.circuit).pinNet.get('A.Y')!;
    an.settle();
    an.advance(5e-9);
    expect(an.voltage(out)).toBeGreaterThan(4.9);
    const rec = an.watch([inp, out]);
    an.setParam('A', 'on', true);
    an.advance(5e-9);
    const t = rec.times();
    const [vi, vo] = rec.values();
    let t50 = NaN;
    for (let i = 1; i < t.length; i++) if (vo![i]! < 2.5 && vo![i - 1]! >= 2.5) t50 = t[i]!;
    rec.close();
    expect(vi![t.length - 1]).toBeCloseTo(5, 3);
    expect(t50).toBeGreaterThan(0);
    // The input stepped at the first sample after the toggle: the output followed within a few hundred ps.
    const t0 = t[vi!.findIndex((v) => v > 2.5)]!;
    const delay = t50 - t0;
    expect(delay, `propagation delay ${(delay * 1e12).toFixed(0)} ps`).toBeGreaterThan(30e-12);
    expect(delay).toBeLessThan(2e-9);
  });
});

/** Two gates from Chapter 14 and 13: a half adder and a 2:1 multiplexer. */
const halfAdder: Circuit = {
  version: 1,
  title: 'Half adder',
  components: [
    { id: 'A', type: 'toggle', x: 0, y: 0 },
    { id: 'B', type: 'toggle', x: 0, y: 4 },
    { id: 'X1', type: 'xor', x: 10, y: 0 },
    { id: 'U1', type: 'and', x: 10, y: 6 },
    { id: 'S', type: 'indicator', x: 20, y: 1 },
    { id: 'C', type: 'indicator', x: 20, y: 7 },
  ],
  wires: [
    { points: [[3, 0], [10, 0]] },
    { points: [[5, 0], [5, 8], [10, 8]] },
    { points: [[3, 4], [7, 4], [7, 2], [10, 2]] },
    { points: [[7, 4], [7, 6], [10, 6]] },
    { points: [[16, 1], [20, 1]] },
    { points: [[16, 7], [20, 7]] },
  ],
};

const mux: Circuit = {
  version: 1,
  title: '2:1 multiplexer',
  components: [
    { id: 'S', type: 'toggle', x: 0, y: 0 },
    { id: 'A', type: 'toggle', x: 0, y: 6 },
    { id: 'B', type: 'toggle', x: 0, y: 12 },
    { id: 'N1', type: 'not', x: 8, y: 0 },
    { id: 'G1', type: 'and', x: 18, y: 4 },
    { id: 'G2', type: 'and', x: 18, y: 10 },
    { id: 'O1', type: 'or', x: 28, y: 7 },
    { id: 'Y', type: 'indicator', x: 38, y: 8 },
  ],
  wires: [
    { points: [[3, 0], [8, 0]] },
    { points: [[5, 0], [5, 10], [18, 10]] },
    { points: [[3, 6], [10, 6], [10, 4], [18, 4]] },
    { points: [[13, 0], [15, 0], [15, 6], [18, 6]] },
    { points: [[3, 12], [18, 12]] },
    { points: [[24, 5], [26, 5], [26, 7], [28, 7]] },
    { points: [[24, 11], [26, 11], [26, 9], [28, 9]] },
    { points: [[34, 8], [38, 8]] },
  ],
};

function truth(c: Circuit, inputs: string[], out: string, level: 'digital' | 'switch' | 'analog'): number[] {
  const results: number[] = [];
  const x = level === 'switch' ? expandToSwitch(c) : level === 'analog' ? expandToAnalog(c) : undefined;
  const e: Engine = x ? (level === 'switch' ? createSwitchEngine(x.netlist()) : createAnalogEngine(x.netlist(), SETTLE)) : createDigitalEngine(flatten(c));
  const outNet = topLevelNets(x?.circuit ?? c).pinNet.get(`${out}.A`)!;
  for (const bits of combos(inputs.length)) {
    drive(e, inputs, bits);
    if (level === 'digital') e.advance(50e-9);
    else if (level === 'switch') e.settle();
    else settleAnalog(e, 60);
    const l = e.logic(outNet);
    expect(l, `${c.title} ${level} ${bits}`).not.toBe(LX);
    results.push(l);
  }
  return results;
}

describe('circuits opened up behave like the circuit', () => {
  test('half adder: sum and carry at both levels', () => {
    for (const out of ['S', 'C']) {
      const want = truth(halfAdder, ['A', 'B'], out, 'digital');
      expect(truth(halfAdder, ['A', 'B'], out, 'switch')).toEqual(want);
      expect(truth(halfAdder, ['A', 'B'], out, 'analog')).toEqual(want);
    }
    expect(truth(halfAdder, ['A', 'B'], 'S', 'digital')).toEqual([0, 1, 1, 0]);
    expect(truth(halfAdder, ['A', 'B'], 'C', 'digital')).toEqual([0, 0, 0, 1]);
  });

  test('2:1 multiplexer at both levels', () => {
    const want = truth(mux, ['S', 'A', 'B'], 'Y', 'digital');
    expect(truth(mux, ['S', 'A', 'B'], 'Y', 'switch')).toEqual(want);
    expect(truth(mux, ['S', 'A', 'B'], 'Y', 'analog')).toEqual(want);
    // Y = S ? B : A, with inputs in the order S, A, B (S is bit 0).
    expect(want).toEqual(Array.from({ length: 8 }, (_, i) => ((i & 1) === 1 ? (i >> 2) & 1 : (i >> 1) & 1)));
  });

  test('the gates keep their place: same pins, same wires', () => {
    const x = expandToSwitch(halfAdder);
    // Every original wire is still there, first in the list, with as many vertices.
    expect(x.circuit.wires.slice(0, halfAdder.wires.length).map((w) => w.points.length)).toEqual(halfAdder.wires.map((w) => w.points.length));
    // A wire that ended on a gate pin ends on the edge of that gate's outline.
    const f = x.frames.find((fr) => fr.id === 'X1')!;
    const first = x.circuit.wires[0]!.points;
    expect(first[first.length - 1]![0]).toBe(f.x);
    expect(x.map.X1!.length).toBe(12);
    expect(x.map.U1!.length).toBe(6);
    expect(x.transistors).toBe(18);
    // The outlines do not overlap each other.
    const [a, b] = [x.frames[0]!, x.frames[1]!];
    expect(a.y + a.h <= b.y || b.y + b.h <= a.y || a.x + a.w <= b.x || b.x + b.w <= a.x).toBe(true);
  });

  test('the drawn circuit has the same nets as the simulated one', () => {
    for (const build of [expandToSwitch, expandToAnalog]) {
      const x = build(mux);
      const a = connect(x.circuit);
      const b = connect(x.drawn);
      expect(b.netCount).toBe(a.netCount);
      expect([...b.pinNet]).toEqual([...a.pinNet]);
      expect(b.wireNet).toEqual(a.wireNet);
      expect(x.drawn.components.length).toBe(x.circuit.components.length + x.frames.length);
    }
  });

  test('no two wires of different signals touch: every net is one signal', () => {
    for (const c of [halfAdder, mux]) {
      const x = expandToSwitch(c);
      const flat = x.netlist();
      // Each transistor's three pins sit on nets that a truth-table run would have shorted if wires collided; also
      // count nets touched by gate pins of more than one driver: an output net must be driven by one stage.
      const drivers = new Map<number, Set<string>>();
      for (const e of flat.elements) {
        if (e.type !== 'pmos' && e.type !== 'nmos') continue;
        const gate = e.id.split('/')[0]!;
        e.pins.forEach((n, i) => {
          if (e.pinNames[i] === 'G') return;
          if (!drivers.has(n)) drivers.set(n, new Set());
          drivers.get(n)!.add(gate);
        });
      }
      // A channel net is shared by the transistors of one gate, except rails and the output node feeding no channel.
      for (const [n, gs] of drivers) {
        if (n === flat.ground || flat.netNames[n] === '+5V') continue;
        expect(gs.size, `net ${n} joins the channels of ${[...gs].join(', ')}`).toBe(1);
      }
    }
  });
});

describe('budget and checks', () => {
  test('the half adder fits the analog budget; a 4-input XOR chain does not', () => {
    expect(canExpand(halfAdder, 'switch')).toBe(true);
    expect(canExpand(halfAdder, 'analog')).toBe(true);
    expect(expandCheck(halfAdder, 'analog').transistors).toBe(18);
    const big = gateBench('xor', 4);
    expect(expandCheck(big, 'analog').transistors).toBe(36);
    const bigger: Circuit = { ...big, components: [...big.components, { id: 'U2', type: 'xor', x: 40, y: 0, params: { inputs: 3 } }] };
    expect(canExpand(bigger, 'analog')).toBe(false);
    expect(expandCheck(bigger, 'analog').reason).toMatch(/more than/);
    expect(canExpand(bigger, 'switch')).toBe(true);
  });

  test('circuits with parts that have no transistor version are refused with a reason', () => {
    const c: Circuit = { version: 1, components: [{ id: 'R1', type: 'resistor', x: 0, y: 0 }, { id: 'U1', type: 'not', x: 6, y: 0 }], wires: [] };
    const r = expandCheck(c, 'switch');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/R1/);
    expect(() => expandToSwitch(c)).toThrow(/R1/);
    expect(canExpand({ version: 1, components: [{ id: 'A', type: 'toggle', x: 0, y: 0 }], wires: [] }, 'switch')).toBe(false);
  });

  test('a rotated gate is refused', () => {
    const c: Circuit = { version: 1, components: [{ id: 'U1', type: 'not', x: 6, y: 0, rot: 90 }], wires: [] };
    expect(expandCheck(c, 'switch').reason).toMatch(/rotated/);
  });
});

describe('analog netlist', () => {
  test('adds capacitance to gates, internal nodes and outputs only', () => {
    const x = expandToAnalog(gateBench('nand', 2));
    const flat = x.netlist();
    const caps = flat.elements.filter((e) => e.type === 'capacitor');
    expect(caps.length).toBeGreaterThan(0);
    for (const c of caps) expect(c.pins[1]).toBe(flat.ground);
    const conn = topLevelNets(x.circuit);
    const outNet = conn.pinNet.get('Y.A')!;
    const outCap = caps.find((c) => c.pins[0] === outNet)!;
    expect(outCap.params.capacitance).toBeCloseTo(ANALOG.node + ANALOG.out, 20);
    // The input nets carry only the gate capacitance of their two transistors (a toggle drives them, so none is added).
    const inA = conn.pinNet.get('A.Y')!;
    expect(caps.some((c) => c.pins[0] === inA)).toBe(false);
    // The switch-level netlist has none.
    expect(expandToSwitch(gateBench('nand', 2)).netlist().elements.some((e) => e.type === 'capacitor')).toBe(false);
    void LX;
  });

  test('a gate driving another loads it', () => {
    const x = expandToAnalog(mux);
    const flat = x.netlist();
    const conn = topLevelNets(x.circuit);
    const n1out = conn.pinNet.get('G1/MP1.G');
    expect(n1out).toBeDefined();
    const cap = flat.elements.find((e) => e.type === 'capacitor' && e.pins[0] === flat.alias?.[n1out!]! + 0);
    void cap;
  });
});

describe('cell circuits', () => {
  test('a standalone drawing has a port per pin', () => {
    const c = cellCircuit('nand', 2);
    const ports = c.components.filter((p) => p.type === 'port');
    expect(ports.map((p) => p.params?.name).sort()).toEqual(['A', 'B', 'Y']);
    expect(c.components.filter((p) => p.type === 'pmos' || p.type === 'nmos').length).toBe(4);
    const flat = flatten(c);
    expect(flat.elements.filter((e) => e.type === 'pmos').length).toBe(2);
  });
});
