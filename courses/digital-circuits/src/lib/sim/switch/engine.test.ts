import { describe, expect, test } from 'vitest';
import type { Circuit } from '../netlist/types';
import { LX, LZ } from '../netlist/types';
import { flatten } from '../netlist/flatten';
import { SwitchBuilder, createSwitchEngine, netStrength, type SwitchEngine } from './index';

const NS = 1e-9;

/** Set toggles `ids` to the bits of `m` (ids[0] = bit 0). */
function apply(e: SwitchEngine, ids: string[], m: number): void {
  ids.forEach((id, i) => e.setParam(id, 'on', ((m >> i) & 1) === 1));
}

/** Check a gate's truth table over every input combination. */
function truthTable(e: SwitchEngine, ids: string[], y: number, fn: (bits: number[]) => number): void {
  for (let m = 0; m < 1 << ids.length; m++) {
    apply(e, ids, m);
    const bits = ids.map((_, i) => (m >> i) & 1);
    expect(e.logic(y), `inputs ${bits.join('')}`).toBe(fn(bits));
    expect(netStrength(e, y)).toBe('driven');
  }
}

describe('CMOS gates', () => {
  test('an inverter drawn on the grid, flattened', () => {
    const c: Circuit = {
      version: 1,
      engine: 'switch',
      components: [
        { id: 'A', type: 'toggle', x: 0, y: 4 },
        { id: 'P', type: 'pmos', x: 6, y: 0 },
        { id: 'N', type: 'nmos', x: 6, y: 6 },
        { id: 'VDD', type: 'rail', x: 9, y: -2 },
        { id: 'GND', type: 'ground', x: 9, y: 8 },
        { id: 'L', type: 'indicator', x: 12, y: 3 },
      ],
      wires: [
        { points: [[3, 4], [6, 4]] },
        { points: [[6, 0], [6, 6]] },
        { points: [[9, 2], [9, 4]] },
        { points: [[9, 3], [12, 3]] },
      ],
    };
    const net = flatten(c);
    const e = createSwitchEngine(net);
    expect(e.messages).toEqual([]);
    const y = net.elements.find((el) => el.id === 'L')!.pins[0]!;
    expect(e.state('L')).toEqual({ lit: true, brightness: 1, value: 1 });
    expect(e.state('P').on).toBe(1);
    expect(e.state('N').on).toBe(0);
    e.setParam('A', 'on', true);
    expect(e.logic(y)).toBe(0);
    expect(e.voltage(y)).toBe(0);
    expect(e.state('L').lit).toBe(false);
    expect(e.state('P').on).toBe(0);
    expect(e.state('N').on).toBe(1);
    expect(netStrength(e, y)).toBe('driven');
    expect(netStrength(e, net.ground!)).toBe('supply');
    expect(e.current('N', 0)).toBe(0);
  });

  test('NAND and NOR, 2 and 3 inputs', () => {
    for (const k of [2, 3]) {
      const b = new SwitchBuilder();
      const ids = Array.from({ length: k }, (_, i) => `I${i}`);
      const ins = ids.map((id) => b.input(id));
      const nand = b.net('NAND');
      const nor = b.net('NOR');
      b.nand('G1', ins, nand);
      b.nor('G2', ins, nor);
      const e = createSwitchEngine(b.build());
      truthTable(e, ids, nand, (x) => +!x.every((v) => v === 1));
      truthTable(e, ids, nor, (x) => +!x.some((v) => v === 1));
    }
  });

  test('complex gate ¬(A·(B+C)): series-parallel networks and their duals', () => {
    const b = new SwitchBuilder();
    const [A, B, C] = ['A', 'B', 'C'].map((id) => b.input(id)) as [number, number, number];
    const y = b.net('Y');
    const m = b.net();
    const k = b.net();
    const vdd = b.vdd();
    const gnd = b.gnd();
    // Pull-down: A in series with (B ∥ C).
    b.nmos('nA', A, y, m);
    b.nmos('nB', B, m, gnd);
    b.nmos('nC', C, m, gnd);
    // Pull-up, the dual: A in parallel with (B series C).
    b.pmos('pA', A, vdd, y);
    b.pmos('pB', B, vdd, k);
    b.pmos('pC', C, k, y);
    const e = createSwitchEngine(b.build());
    truthTable(e, ['A', 'B', 'C'], y, ([a, bb, c]) => +!(a && (bb || c)));
    expect(e.contended(y)).toBe(false);
  });

  test('transmission-gate multiplexer passes either input both ways', () => {
    const b = new SwitchBuilder();
    const a = b.input('A');
    const bIn = b.input('B');
    const s = b.input('S');
    const sb = b.net('Sb');
    const y = b.net('Y');
    b.inv('Is', s, sb);
    b.tgate('T0', a, y, sb, s);
    b.tgate('T1', bIn, y, s, sb);
    const e = createSwitchEngine(b.build());
    truthTable(e, ['A', 'B', 'S'], y, ([x0, x1, sel]) => (sel ? x1! : x0!));
  });
});

describe('ratioed logic and pull-ups', () => {
  test('nMOS inverter with a resistor pull-up: the transistor wins', () => {
    const b = new SwitchBuilder();
    const a = b.input('A');
    const y = b.net('Y');
    b.add('resistor', 'R', { '1': b.vdd(), '2': y });
    b.nmos('N', a, y, b.gnd());
    const e = createSwitchEngine(b.build());
    expect(e.logic(y)).toBe(1);
    expect(netStrength(e, y)).toBe('weak');
    e.setParam('A', 'on', true);
    expect(e.logic(y)).toBe(0);
    expect(netStrength(e, y)).toBe('driven');
    expect(e.contended(y)).toBe(false);
  });

  test('pseudo-nMOS: the load must be weaker than the pull-down (ratioed)', () => {
    for (const [load, want] of [
      ['weak', 0],
      ['normal', LX],
    ] as const) {
      const b = new SwitchBuilder();
      const a = b.input('A');
      const y = b.net('Y');
      b.pmos('P', b.gnd(), b.vdd(), y, load);
      b.nmos('N', a, y, b.gnd());
      const e = createSwitchEngine(b.build());
      expect(e.logic(y)).toBe(1);
      e.setParam('A', 'on', true);
      expect(e.logic(y), `${load} load`).toBe(want);
      expect(e.contended(y)).toBe(want === LX);
    }
  });

  test('open-drain outputs with a pull-up resistor make a wired AND', () => {
    const b = new SwitchBuilder();
    const ids = ['A', 'B', 'C'];
    const ins = ids.map((id) => b.input(id));
    const bus = b.net('BUS');
    b.add('resistor', 'Rpu', { '1': b.vdd(), '2': bus }, { resistance: 4700 });
    // Each open-drain output pulls the bus low when its (active-low) data is 0: here an inverter
    // drives the pull-down gate, so the bus is the AND of the data inputs.
    ins.forEach((x, i) => {
      const g = b.net();
      b.inv(`I${i}`, x, g);
      b.nmos(`OD${i}`, g, bus, b.gnd());
    });
    const e = createSwitchEngine(b.build());
    for (let m = 0; m < 8; m++) {
      apply(e, ids, m);
      expect(e.logic(bus)).toBe(m === 7 ? 1 : 0);
      expect(netStrength(e, bus)).toBe(m === 7 ? 'weak' : 'driven');
      expect(e.contended(bus)).toBe(false);
    }
  });
});

describe('charge storage', () => {
  /** An inverting tri-state stage; `enableOutside` puts the enable transistors next to the output. */
  function triState(enableOutside: boolean) {
    const b = new SwitchBuilder();
    const a = b.input('A');
    const en = b.input('EN', true);
    const enb = b.net('ENb');
    const y = b.net('Y');
    const x = b.net('x');
    const z = b.net('z');
    b.inv('Ie', en, enb);
    const [pOuter, pInner, nInner, nOuter] = enableOutside ? [a, enb, en, a] : [enb, a, a, en];
    b.pmos('p1', pOuter, b.vdd(), x);
    b.pmos('p2', pInner, x, y);
    b.nmos('n2', nInner, y, z);
    b.nmos('n1', nOuter, z, b.gnd());
    b.add('probe', 'PR', { A: y });
    return { e: createSwitchEngine(b.build()), y };
  }

  test('a tri-state output releases its node, which keeps its charge', () => {
    const { e, y } = triState(true);
    expect(e.logic(y)).toBe(1); // an inverting stage, A = 0
    e.setParam('A', 'on', true);
    expect(e.logic(y)).toBe(0);
    e.setParam('EN', 'on', false);
    expect(e.logic(y)).toBe(0);
    expect(netStrength(e, y)).toBe('charged');
    // The input changes, the released output does not follow.
    e.setParam('A', 'on', false);
    expect(e.logic(y)).toBe(0);
    e.setParam('A', 'on', true);
    e.setParam('A', 'on', false);
    expect(e.state('PR').value).toBe(0);
    e.setParam('EN', 'on', true);
    expect(e.logic(y)).toBe(1);
    expect(netStrength(e, y)).toBe('driven');
  });

  test('with the enable transistors at the rails, a released output suffers charge sharing', () => {
    const { e, y } = triState(false);
    e.setParam('A', 'on', true);
    e.setParam('EN', 'on', false); // Y holds 0; the node between the pMOS holds 1
    expect(e.logic(y)).toBe(0);
    e.setParam('A', 'on', false); // the inner pMOS joins them: equal sizes, different values
    expect(e.logic(y)).toBe(LX);
  });

  test('a node that has never been driven floats (Z); once driven and released it holds', () => {
    const b = new SwitchBuilder();
    const d = b.input('D', true);
    const g = b.input('G');
    const s = b.net('S');
    b.nmos('pass', g, d, s);
    b.add('probe', 'P', { A: s });
    const e = createSwitchEngine(b.build(), { powerUp: 'x' });
    expect(e.logic(s)).toBe(LZ);
    expect(e.state('P').value).toBe(LZ);
    expect(netStrength(e, s)).toBe('floating');
    expect(e.voltage(s)).toBeNaN();
    e.setParam('G', 'on', true);
    expect(e.logic(s)).toBe(1);
    e.setParam('G', 'on', false);
    e.setParam('D', 'on', false);
    expect(e.logic(s)).toBe(1);
    expect(netStrength(e, s)).toBe('charged');
    e.reset();
    expect(e.logic(s)).toBe(LZ);
  });

  test('dynamic logic: precharge, then evaluate (a dynamic NAND)', () => {
    const b = new SwitchBuilder();
    const clk = b.input('CLK');
    const a = b.input('A');
    const bb = b.input('B');
    const d = b.net('D');
    const m1 = b.net();
    const m2 = b.net();
    b.pmos('pre', clk, b.vdd(), d);
    b.nmos('nA', a, d, m1);
    b.nmos('nB', bb, m1, m2);
    b.nmos('foot', clk, m2, b.gnd());
    const e = createSwitchEngine(b.build());
    for (let m = 0; m < 4; m++) {
      e.setParam('CLK', 'on', false); // precharge
      expect(e.logic(d)).toBe(1);
      expect(netStrength(e, d)).toBe('driven');
      apply(e, ['A', 'B'], m);
      e.setParam('CLK', 'on', true); // evaluate
      expect(e.logic(d)).toBe(m === 3 ? 0 : 1);
      expect(netStrength(e, d)).toBe(m === 3 ? 'driven' : 'charged');
    }
  });

  test('charge sharing: the larger node wins; equal sizes that disagree give X', () => {
    const build = (sizeB: 'small' | 'normal' | 'cap') => {
      const b = new SwitchBuilder();
      const d1 = b.input('D1', true);
      const d2 = b.input('D2', false);
      const w1 = b.input('W1', true);
      const w2 = b.input('W2', true);
      const share = b.input('SH');
      const n1 = b.net('BIG');
      const n2 = b.net('N2');
      b.nmos('t1', w1, d1, n1);
      b.nmos('t2', w2, d2, n2);
      b.nmos('ts', share, n1, n2);
      b.add('capacitor', 'C1', { '1': n1, '2': b.gnd() }, { capacitance: 1e-12 });
      if (sizeB === 'cap') b.add('capacitor', 'C2', { '1': n2, '2': b.gnd() }, { capacitance: 1e-12 });
      const e = createSwitchEngine(b.build(), { nodeSize: sizeB === 'small' ? { N2: 'small' } : {} });
      expect(e.logic(n1)).toBe(1);
      expect(e.logic(n2)).toBe(0);
      e.setParam('W1', 'on', false);
      e.setParam('W2', 'on', false);
      expect(netStrength(e, n1)).toBe('charged');
      e.setParam('SH', 'on', true);
      return [e.logic(n1), e.logic(n2)];
    };
    expect(build('small')).toEqual([1, 1]);
    expect(build('normal')).toEqual([1, 1]);
    expect(build('cap')).toEqual([LX, LX]);
  });

  test('charge sharing between a normal and a small node', () => {
    const b = new SwitchBuilder();
    const w = b.input('W', true);
    const sh = b.input('SH');
    const n1 = b.net('N1');
    const n2 = b.net('N2');
    b.nmos('t1', w, b.vdd(), n1);
    b.nmos('t2', w, b.gnd(), n2);
    b.nmos('ts', sh, n1, n2);
    const e = createSwitchEngine(b.build(), { nodeSize: { N2: 'small' } });
    e.setParam('W', 'on', false);
    e.setParam('SH', 'on', true);
    expect([e.logic(n1), e.logic(n2)]).toEqual([1, 1]);
  });
});

describe('unknown values', () => {
  test('X on a gate propagates only where it matters', () => {
    const b = new SwitchBuilder();
    const x = b.net('X');
    b.add('const', 'CX', { Y: x }, { value: 'X' });
    const a = b.input('A');
    const inv = b.net('INV');
    const nand = b.net('NAND');
    const nor = b.net('NOR');
    b.inv('I', x, inv);
    b.nand('G1', [a, x], nand);
    b.nor('G2', [a, x], nor);
    const e = createSwitchEngine(b.build());
    expect(e.logic(inv)).toBe(LX);
    expect(e.state('I.n').on).toBe(2);
    expect(e.state('I.p').on).toBe(2);
    // A = 0: the NAND's pMOS on A pulls up definitely; the X nMOS is in series with an off one.
    expect(e.logic(nand)).toBe(1);
    expect(e.logic(nor)).toBe(LX);
    e.setParam('A', 'on', true);
    expect(e.logic(nand)).toBe(LX);
    expect(e.logic(nor)).toBe(0);
    // Resolving the X resolves everything downstream.
    e.setParam('CX', 'value', 0);
    expect([e.logic(inv), e.logic(nand), e.logic(nor)]).toEqual([1, 1, 0]);
  });

  test('an X pass transistor: harmless if both sides agree, X if they differ', () => {
    const b = new SwitchBuilder();
    const x = b.net('X');
    b.add('const', 'CX', { Y: x }, { value: 0 });
    const d = b.input('D', true);
    const w = b.input('W', true);
    const n = b.net('N');
    b.nmos('write', w, d, n);
    b.nmos('pass', x, b.vdd(), n);
    const e = createSwitchEngine(b.build());
    e.setParam('W', 'on', false); // N holds 1
    e.setParam('CX', 'value', 'X'); // VDD may or may not reach N: it is 1 either way
    expect(e.logic(n)).toBe(1);
    e.setParam('CX', 'value', 0);
    e.setParam('D', 'on', false);
    e.setParam('W', 'on', true);
    e.setParam('W', 'on', false); // N holds 0
    e.setParam('CX', 'value', 'X');
    expect(e.logic(n)).toBe(LX);
    // A definite driver of the same strength as the X path cannot outvote it: still X.
    e.setParam('W', 'on', true);
    expect(e.logic(n)).toBe(LX);
  });

  test('an X transistor fighting a stronger definite driver loses', () => {
    const b = new SwitchBuilder();
    const x = b.net('X');
    b.add('const', 'CX', { Y: x }, { value: 'X' });
    const y = b.net('Y');
    b.pmos('load', x, b.vdd(), y, 'weak');
    b.nmos('down', b.vdd(), y, b.gnd(), 'strong');
    const e = createSwitchEngine(b.build());
    expect(e.logic(y)).toBe(0);
  });
});

describe('timing', () => {
  function ring(options: Parameters<typeof createSwitchEngine>[1]) {
    const b = new SwitchBuilder();
    const [a, bb, c] = [b.net('A'), b.net('B'), b.net('C')];
    b.inv('I1', a, bb);
    b.inv('I2', bb, c);
    b.inv('I3', c, a);
    return { e: createSwitchEngine(b.build(), options), a, bb, c };
  }

  test('a ring of three inverters oscillates in unit-delay mode: period 6 delays', () => {
    const { e, a, bb } = ring({ mode: 'unit-delay', unitDelay: NS });
    expect(e.messages).toEqual([]);
    const rec = e.watch([a, bb]);
    e.advance(60 * NS);
    const t = rec.times();
    const [va] = rec.values();
    // Every edge of A is 3 ns after the previous one.
    const edges: number[] = [];
    for (let i = 1; i < t.length; i++) if (va![i] !== va![i - 1]) edges.push(t[i]!);
    expect(edges.length).toBeGreaterThanOrEqual(18);
    for (let i = 1; i < edges.length; i++) expect(edges[i]! - edges[i - 1]!).toBeCloseTo(3 * NS, 12);
    expect(va!.every((v) => v === 0 || v === 1)).toBe(true);
    expect(e.time).toBeCloseTo(60 * NS, 15);
    // step() moves one stage at a time.
    const before = [e.logic(a), e.logic(bb)];
    let steps = 0;
    while (e.logic(a) === before[0] && steps < 10) {
      e.step();
      steps++;
    }
    expect(steps).toBeGreaterThanOrEqual(1);
    expect(steps).toBeLessThanOrEqual(3);
    rec.close();
  });

  test('in settle (zero-delay) mode the ring is reported and shown as X', () => {
    const { e, a, bb, c } = ring({ maxRounds: 50 });
    expect(e.messages.some((m) => m.level === 'error' && /oscillat/.test(m.text))).toBe(true);
    expect([e.logic(a), e.logic(bb), e.logic(c)]).toEqual([LX, LX, LX]);
  });

  test('a long inverter chain settles in many rounds and is not mistaken for an oscillation', () => {
    const b = new SwitchBuilder();
    let x = b.input('A');
    const stages = 2500; // more rounds than the 1000 that a small circuit is allowed
    for (let i = 0; i < stages; i++) {
      const y = b.net();
      b.inv(`I${i}`, x, y);
      x = y;
    }
    const e = createSwitchEngine(b.build());
    expect(e.messages).toEqual([]);
    expect(e.logic(x)).toBe(0); // 2500 inversions of 0 is 0
    e.setParam('A', 'on', true);
    expect(e.logic(x)).toBe(1);
    expect(e.messages).toEqual([]);
  });

  test('an inverter chain: unit delay per stage', () => {
    const b = new SwitchBuilder();
    const a = b.input('A');
    const nodes = [a, ...b.nets(5, 'N')];
    for (let i = 0; i < 5; i++) b.inv(`I${i}`, nodes[i]!, nodes[i + 1]!);
    const e = createSwitchEngine(b.build(), { mode: 'unit-delay', unitDelay: 2 * NS });
    const out = nodes[5]!;
    expect(e.logic(out)).toBe(1);
    e.setParam('A', 'on', true);
    e.advance(9 * NS);
    expect(e.logic(out)).toBe(1);
    e.advance(1 * NS);
    expect(e.logic(out)).toBe(0);
  });

  test('a clock drives an inverter; the recorder sees every edge', () => {
    const b = new SwitchBuilder();
    const clk = b.net('CLK');
    b.add('clock', 'CK', { Y: clk }, { frequency: 1e6 });
    const y = b.net('Y');
    b.inv('I', clk, y);
    const e = createSwitchEngine(b.build());
    const rec = e.watch([clk, y]);
    e.advance(2.2e-6);
    const t = rec.times();
    const [vc, vy] = rec.values();
    expect(Array.from(t)).toEqual([0, 0.5e-6, 1e-6, 1.5e-6, 2e-6].map((x) => expect.closeTo(x, 12)));
    expect(Array.from(vc!)).toEqual([0, 1, 0, 1, 0]);
    expect(Array.from(vy!)).toEqual([1, 0, 1, 0, 1]);
    expect(e.state('CK')).toEqual({ value: 0, frequency: 1e6 });
    // Doubling the frequency keeps the phase.
    e.setParam('CK', 'frequency', 2e6);
    e.advance(0.3e-6);
    expect(e.logic(clk)).toBe(1);
    rec.trim(0.5e-6);
    expect(rec.times().length).toBeLessThan(t.length + 2);
    rec.close();
  });
});

describe('switches, lamps and relays', () => {
  test('the staircase light: two changeover switches make an XNOR', () => {
    const b = new SwitchBuilder();
    const [c2, l0, l1] = b.nets(3) as [number, number, number];
    b.add('spdt', 'S1', { C: b.vdd(), '0': l0, '1': l1 });
    b.add('spdt', 'S2', { C: c2, '0': l0, '1': l1 });
    b.add('lamp', 'L', { '1': c2, '2': b.gnd() });
    const e = createSwitchEngine(b.build());
    for (const [t1, t2] of [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]) {
      e.setParam('S1', 'throw', t1!);
      e.setParam('S2', 'throw', t2!);
      expect(e.state('L').brightness, `${t1}${t2}`).toBe(t1 === t2 ? 1 : 0);
      expect(e.state('S1').throw).toBe(t1);
    }
  });

  test('switches in series (AND) and parallel (OR), with a pushbutton', () => {
    const b = new SwitchBuilder();
    const m = b.net();
    const and = b.net('AND');
    const or = b.net('OR');
    b.add('switch', 'A', { '1': b.vdd(), '2': m });
    b.add('pushbutton', 'B', { '1': m, '2': and });
    b.add('resistor', 'R1', { '1': and, '2': b.gnd() });
    b.add('switch', 'A2', { '1': b.vdd(), '2': or });
    b.add('switch', 'B2', { '1': b.vdd(), '2': or });
    b.add('resistor', 'R2', { '1': or, '2': b.gnd() });
    const e = createSwitchEngine(b.build());
    for (let k = 0; k < 4; k++) {
      const a = (k & 1) === 1;
      const bb = (k & 2) === 2;
      e.setParam('A', 'closed', a);
      e.setParam('B', 'pressed', bb);
      e.setParam('A2', 'closed', a);
      e.setParam('B2', 'closed', bb);
      expect(e.logic(and)).toBe(+(a && bb));
      expect(e.logic(or)).toBe(+(a || bb));
    }
    expect(e.state('A')).toEqual({ closed: true });
    expect(e.state('B')).toEqual({ closed: true, pressed: true });
  });

  test('a relay switches its contacts after its operate time', () => {
    const b = new SwitchBuilder();
    const coil = b.net('COIL');
    const no = b.net('NO');
    const nc = b.net('NC');
    b.add('switch', 'S', { '1': b.vdd(), '2': coil });
    b.add('relay', 'K', { A: coil, B: b.gnd(), COM: b.vdd(), NO: no, NC: nc }, { operateTime: 0.005 });
    b.add('lamp', 'L1', { '1': no, '2': b.gnd() });
    b.add('lamp', 'L2', { '1': nc, '2': b.gnd() });
    const e = createSwitchEngine(b.build());
    expect(e.state('K')).toEqual({ energised: false, closed: false, throw: 0 });
    expect([e.state('L1').brightness, e.state('L2').brightness]).toEqual([0, 1]);
    e.setParam('S', 'closed', true);
    expect(e.state('K').energised).toBe(true);
    e.advance(0.004);
    expect(e.state('K').closed).toBe(false);
    e.advance(0.002);
    expect(e.state('K')).toEqual({ energised: true, closed: true, throw: 1 });
    expect([e.logic(no), e.logic(nc)]).toEqual([1, 0]);
    expect([e.state('L1').brightness, e.state('L2').brightness]).toEqual([1, 0]);
    // Released: the coil's end is pulled to ground through the coil itself.
    e.setParam('S', 'closed', false);
    expect(e.logic(coil)).toBe(0);
    e.advance(0.01);
    expect(e.state('K').closed).toBe(false);
    expect(e.logic(nc)).toBe(1);
  });

  test('a relay inverter chain (Stibitz-style NOT) settles stage by stage in time', () => {
    const b = new SwitchBuilder();
    const inp = b.net('IN');
    b.add('switch', 'S', { '1': b.vdd(), '2': inp });
    let x = inp;
    for (let i = 0; i < 3; i++) {
      const out = b.net(`O${i}`);
      b.add('relay', `K${i}`, { A: x, B: b.gnd(), COM: b.vdd(), NC: out }, { operateTime: 0.001 });
      b.add('resistor', `R${i}`, { '1': out, '2': b.gnd() });
      x = out;
    }
    const e = createSwitchEngine(b.build());
    e.advance(0.01);
    expect([0, 1, 2].map((i) => e.logic(b.build().netNames.indexOf(`O${i}`)))).toEqual([1, 0, 1]);
    e.setParam('S', 'closed', true);
    e.advance(0.01);
    expect([0, 1, 2].map((i) => e.logic(b.build().netNames.indexOf(`O${i}`)))).toEqual([0, 1, 0]);
  });
});

describe('inputs, displays and messages', () => {
  test('seven-segment and hex displays, buttons and constants', () => {
    const b = new SwitchBuilder();
    const bits = ['D0', 'D1', 'D2', 'D3'].map((id) => b.input(id));
    const btn = b.net('BTN');
    b.add('button', 'BT', { Y: btn });
    b.add('hex-display', 'H', { D0: bits[0]!, D1: bits[1]!, D2: bits[2]!, D3: bits[3]! });
    const segs: Record<string, number> = {};
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'].forEach((s, i) => (segs[s] = i < 4 ? bits[i]! : btn));
    b.add('seven-seg', 'SS', segs);
    const e = createSwitchEngine(b.build());
    expect(e.state('H').value).toBe(0);
    apply(e, ['D0', 'D1', 'D2', 'D3'], 0xb);
    expect(e.state('H').value).toBe(0xb);
    e.setParam('BT', 'pressed', true);
    expect(e.state('BT')).toEqual({ pressed: true, value: 1 });
    expect(e.state('SS')).toEqual({ segments: 0b11111011, unknown: false });
    expect(e.state('D0')).toEqual({ on: true, value: 1 });
    expect(e.state('nope')).toEqual({});
  });

  test('two toggles on one net are a short: X and a warning', () => {
    const b = new SwitchBuilder();
    const n = b.net('N');
    b.add('toggle', 'T1', { Y: n }, { on: true });
    b.add('toggle', 'T2', { Y: n }, { on: true });
    const e = createSwitchEngine(b.build());
    expect(e.logic(n)).toBe(1);
    e.setParam('T2', 'on', false);
    expect(e.logic(n)).toBe(LX);
    expect(e.messages.some((m) => /Short circuit/.test(m.text))).toBe(true);
  });

  test('components the engine cannot simulate are reported and left out', () => {
    const b = new SwitchBuilder();
    b.add('diode', 'D1', {});
    b.add('diode', 'D2', {});
    const e = createSwitchEngine(b.build());
    expect(e.messages).toHaveLength(1);
    expect(e.messages[0]!.text).toMatch(/diode.*D1, D2/);
    e.reset();
    expect(e.messages).toHaveLength(1);
  });

  test('a latch powers up in a random but consistent state; powerUp x leaves it X', () => {
    const build = () => {
      const b = new SwitchBuilder();
      const [q, qb] = [b.net('Q'), b.net('Qb')];
      b.inv('I1', q, qb);
      b.inv('I2', qb, q);
      return { net: b.build(), q, qb };
    };
    const { net, q, qb } = build();
    const seen = new Set<number>();
    for (let seed = 1; seed <= 16; seed++) {
      const e = createSwitchEngine(net, { seed });
      expect(e.logic(q)).not.toBe(LX);
      expect(e.logic(qb)).toBe(1 - e.logic(q));
      expect(e.messages).toEqual([]);
      seen.add(e.logic(q));
    }
    expect(seen.size).toBe(2);
    const x = createSwitchEngine(net, { powerUp: 'x' });
    expect([x.logic(q), x.logic(qb)]).toEqual([LX, LX]);
    expect(netStrength(x, q)).toBe('driven');
  });
});
