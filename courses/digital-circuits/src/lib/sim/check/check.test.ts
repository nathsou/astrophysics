import { describe, expect, test } from 'vitest';
import { CircuitBuilder } from '../../partsbin/builder';
import { CircuitBench, DEFAULT_CLOCK, findClock, seqClock, checkCombinational, checkSequential, checkWaveform, checkMeasurement, costOf, parseTruthTable, compileComb, valueAt, edges, dutyCycle } from './index';
import { flatten } from '../netlist/flatten';
import { connect } from '../netlist/connect';

function halfAdder() {
  const b = new CircuitBuilder('Half adder');
  b.input('A');
  b.input('B');
  b.gate('xor', ['A', 'B'], 'S');
  b.gate('and', ['A', 'B'], 'C');
  b.output('S');
  b.output('C');
  return b.build();
}

describe('builder', () => {
  test('draws a connected circuit', () => {
    const c = halfAdder();
    const conn = connect(c);
    expect(conn.unconnected).toEqual([]);
    const flat = flatten(c);
    expect(flat.elements.map((e) => e.type).sort()).toEqual(['and', 'xor']);
  });
});

describe('combinational checker', () => {
  const ha = halfAdder();
  test('truth table pass', () => {
    const r = checkCombinational(ha, { truthTable: { inputs: ['A', 'B'], outputs: ['S', 'C'], rows: ['00 00', '01 10', '10 10', '11 01'] } });
    expect(r.problems).toEqual([]);
    expect(r.pass).toBe(true);
    expect(r.total).toBe(4);
    expect(r.rows).toEqual(['pass', 'pass', 'pass', 'pass']);
  });
  test('expression pass and fail with counterexample', () => {
    expect(checkCombinational(ha, { expression: { S: 'A ^ B', C: 'A & B' } }).pass).toBe(true);
    expect(checkCombinational(ha, ['S = A·B′'.replace('′', "'")] as never).problems.length).toBeGreaterThan(0);
    const bad = checkCombinational(ha, { expression: ['S = A | B', 'C = A & B'] });
    expect(bad.pass).toBe(false);
    expect(bad.failCount).toBe(1);
    expect(bad.failures[0]).toMatchObject({ index: 3, inputs: { A: 1, B: 1 }, wrong: ['S'] });
    expect(bad.failures[0]!.got.S).toBe('0');
    expect(bad.rows).toEqual(['pass', 'pass', 'pass', 'fail']);
  });
  test('expression syntaxes', () => {
    for (const e of ['Y = A & !B | C', 'Y = A·B\' + C'.replace("B'", "B'"), 'Y = A && !B || C']) {
      const m = compileComb({ expression: e });
      expect(m.inputs).toEqual(['A', 'B', 'C']);
    }
    const m = compileComb({ expression: 'Y = A·B\' + C' });
    expect(m.expected([1, 0, 0])).toEqual([1]);
    expect(m.expected([1, 1, 0])).toEqual([0]);
    expect(compileComb({ expression: 'A & !B | C' }).outputs).toEqual(['Y']);
  });
  test('reference circuit as spec', () => {
    const r = checkCombinational(ha, { reference: halfAdder() });
    expect(r.pass).toBe(true);
  });
  test('missing pins are reported', () => {
    const r = checkCombinational(ha, { expression: 'Z = A & B' });
    expect(r.pass).toBe(false);
    expect(r.problems.join()).toContain('no output called Z');
  });
  test('toggles and indicators are read by label', () => {
    const c = {
      version: 1 as const,
      components: [
        { id: 'SA', type: 'toggle', x: 0, y: 0, label: 'A' },
        { id: 'U1', type: 'not', x: 6, y: 0 },
        { id: 'D1', type: 'indicator', x: 14, y: 0, label: 'Y' },
      ],
      wires: [{ points: [[3, 0], [6, 0]] as [number, number][] }, { points: [[11, 0], [14, 0]] as [number, number][] }],
    };
    expect(checkCombinational(c, { expression: 'Y = !A' }).pass).toBe(true);
    expect(checkCombinational(c, { expression: 'Y = A' }).pass).toBe(false);
  });
  test('don’t-care rows are skipped', () => {
    const c = halfAdder();
    const r = checkCombinational(c, { truthTable: { inputs: ['A', 'B'], outputs: ['S', 'C'], rows: [[0, 0, 0, 0], [1, 1, 'x', 1]] } });
    expect(r.pass).toBe(true);
    expect(r.rows).toEqual(['pass', 'skip', 'skip', 'pass']);
  });
  test('truth table parsing errors', () => {
    expect(() => parseTruthTable({ inputs: ['A'], outputs: ['Y'], rows: ['0 1 1'] })).toThrow(/columns/);
    expect(() => parseTruthTable({ inputs: ['A'], outputs: ['Y'], rows: [[2, 1]] })).toThrow();
  });
});

function dffFrom(type: 'dff' | 'dffr') {
  const b = new CircuitBuilder('reg');
  b.input('D');
  b.input('CLK');
  const pins: Record<string, string> = { D: 'D', CLK: 'CLK', Q: 'Q' };
  if (type === 'dffr') {
    b.input('CLR');
    pins.CLR = 'CLR';
  }
  b.comp(type, pins);
  b.output('Q');
  return b.build();
}

describe('sequential checker', () => {
  test('a flip-flop matches itself', () => {
    const r = checkSequential(dffFrom('dff'), { reference: dffFrom('dff') });
    expect(r.problems).toEqual([]);
    expect(r.pass).toBe(true);
    expect(r.proven).toBe(true);
  });
  test('a flip-flop with clear differs from one without', () => {
    const r = checkSequential(dffFrom('dff'), { reference: dffFrom('dffr'), reset: 'CLR' });
    expect(r.pass).toBe(false);
  });
  test('an FSM table: toggle flip-flop', () => {
    const t = new CircuitBuilder('T');
    t.input('T');
    t.input('CLK');
    t.comp('tff', { T: 'T', CLK: 'CLK', Q: 'Q' });
    t.output('Q');
    const spec = {
      fsm: {
        type: 'moore' as const,
        inputs: ['T'],
        outputs: ['Q'],
        initial: 'off',
        states: { off: { out: '0', next: { '0': 'off', '1': 'on' } }, on: { out: '1', next: { '0': 'on', '1': 'off' } } },
      },
    };
    const r = checkSequential(t.build(), spec);
    expect(r.problems).toEqual([]);
    expect(r.pass).toBe(true);
    expect(r.proven).toBe(true);
    expect(r.states).toBeGreaterThan(1);
    // A wrong table gives a counterexample with the diverging cycle.
    const wrong = { fsm: { ...spec.fsm, states: { off: { out: '0', next: { '0': 'off', '1': 'on' } }, on: { out: '1', next: { '0': 'on', '1': 'on' } } } } };
    const w = checkSequential(t.build(), wrong);
    expect(w.pass).toBe(false);
    expect(w.counterexample!.sequence.map((s) => s.T)).toEqual([1, 1]);
    expect(w.counterexample!.wrong).toEqual(['Q']);
  });
  test('an FSM with a bad table is reported', () => {
    const r = checkSequential(dffFrom('dff'), { fsm: { inputs: ['D'], outputs: ['Q'], initial: 'a', states: { a: { out: '0', next: { '0': 'a' } } } } });
    expect(r.pass).toBe(false);
    expect(r.problems.join()).toContain('no transition');
  });
  test('a counter with reset', () => {
    const mk = (bits: number) => {
      const b = new CircuitBuilder('cnt');
      b.input('CLK');
      b.input('CLR');
      const q = Array.from({ length: bits }, (_, i) => `Q${i}`);
      b.comp('counter', { CLK: 'CLK', CLR: 'CLR', ...Object.fromEntries(q.map((n) => [n, n])) }, { bits });
      q.forEach((n) => b.output(n));
      return b.build();
    };
    expect(checkSequential(mk(3), { reference: mk(3), reset: 'CLR' }).pass).toBe(true);
    // A counter whose clear input is not connected does not reset.
    const b = new CircuitBuilder('cnt');
    b.input('CLK');
    b.input('CLR');
    b.comp('counter', { CLK: 'CLK', Q0: 'Q0', Q1: 'Q1', Q2: 'Q2' }, { bits: 3 });
    ['Q0', 'Q1', 'Q2'].forEach((n) => b.output(n));
    const r = checkSequential(b.build(), { reference: mk(3), reset: 'CLR' });
    expect(r.pass).toBe(false);
  });
  test('missing clock is reported', () => {
    expect(checkSequential(halfAdder(), { reference: dffFrom('dff') }).problems.join()).toMatch(/no input called/);
  });
});

/** A D flip-flop whose data input is called `data` and whose clock port is called `clk`; D takes `data` (or its inverse). */
function ffNamed(data: string, clk: string, invert = false) {
  const b = new CircuitBuilder('ff');
  b.input(data);
  b.input(clk);
  const d = invert ? b.gate('not', [data], 'nd') : data;
  b.comp('dff', { D: d, CLK: clk, Q: 'Q' });
  b.output('Q');
  return b.build();
}

describe('clock detection', () => {
  test('a clock is the input wired to a clock pin, whatever it is called', () => {
    for (const clk of ['CLK', 'Clock', 'phi', 'C']) expect(new CircuitBench(ffNamed('D', clk)).clockInputs).toEqual([clk]);
    expect(findClock(new CircuitBench(ffNamed('D', 'phi')))).toBe('phi');
  });
  test('an input called C or CLK that reaches no clock pin is data', () => {
    const ha = new CircuitBench(halfAdder());
    expect(ha.clockInputs).toEqual([]);
    const b = new CircuitBuilder('and3');
    for (const n of ['A', 'B', 'C', 'CLK']) b.input(n);
    b.gate('and', ['A', 'B', 'C'], 'Y');
    b.output('Y');
    const bench = new CircuitBench(b.build());
    expect(bench.inputs).toEqual(['A', 'B', 'C', 'CLK']);
    expect(findClock(bench)).toBeUndefined();
  });
  test('the spec says when it differs: an explicit name, or false for level-sensitive', () => {
    const bench = new CircuitBench(ffNamed('D', 'CLK'));
    expect(findClock(bench, 'D')).toBe('D');
    expect(findClock(bench, false)).toBeUndefined();
    expect(seqClock({ reference: ffNamed('D', 'phi') })).toBe('phi');
    expect(seqClock({ reference: ffNamed('D', 'phi'), clock: 'D' })).toBe('D');
    expect(seqClock({ reference: ffNamed('D', 'phi'), clock: false })).toBeUndefined();
    expect(seqClock({ fsm: { inputs: ['T'], outputs: ['Q'], initial: 'a', states: { a: { out: '0', next: { '-': 'a' } } } } })).toBe(DEFAULT_CLOCK);
    expect(seqClock({ reference: halfAdder() })).toBeUndefined();
  });
  test('a sequential circuit may have a data input called C, and a clock with another name', () => {
    const ref = ffNamed('C', 'phi');
    const good = checkSequential(ffNamed('C', 'phi'), { reference: ref });
    expect(good.problems).toEqual([]);
    expect(good.pass).toBe(true);
    const bad = checkSequential(ffNamed('C', 'phi', true), { reference: ref });
    expect(bad.pass).toBe(false);
    // C is stimulus (it varies in the counterexample), the clock is not.
    expect(Object.keys(bad.counterexample!.sequence[0]!)).toEqual(['C']);
  });
  test('the circuit must use the clock name of the specification', () => {
    const r = checkSequential(ffNamed('D', 'CLK'), { reference: ffNamed('D', 'phi') });
    expect(r.pass).toBe(false);
    expect(r.problems.join()).toMatch(/clock input \(call it phi\)/);
  });
});

describe('waveforms and measurements', () => {
  const clk = { t: [0, 1, 2, 3, 4], v: [0, 1, 0, 1, 0] };
  test('helpers', () => {
    expect(valueAt(clk, 1.5)).toBe(1);
    expect(edges(clk, 'rise')).toEqual([1, 3]);
    expect(dutyCycle(clk, 0, 4)).toBe(0.5);
  });
  test('checkWaveform', () => {
    expect(checkWaveform(clk, [{ at: 1.5, value: 1 }, { from: 2, to: 2.9, value: 0 }, { edgeAt: 3, dir: 'rise', window: 0.1 }]).pass).toBe(true);
    const r = checkWaveform(clk, [{ at: 0.5, value: 1 }, { edgeAt: 2, dir: 'rise', window: 0.1 }]);
    expect(r.pass).toBe(false);
    expect(r.failures).toHaveLength(2);
  });
  test('checkMeasurement', () => {
    expect(checkMeasurement('4.7 k', 4700).pass).toBe(true);
    expect(checkMeasurement('4.6k', 4700, 0.05).pass).toBe(true);
    expect(checkMeasurement('2.2 mA', 0.0022).pass).toBe(true);
    expect(checkMeasurement('2.2 A', 0.0022)).toMatchObject({ pass: false, reason: 'wrong magnitude' });
    expect(checkMeasurement('5.5', 5)).toMatchObject({ pass: false, reason: 'too high' });
    expect(checkMeasurement('-5', 5)).toMatchObject({ pass: false, reason: 'wrong sign' });
    expect(checkMeasurement('abc', 5)).toMatchObject({ pass: false, reason: 'not a number' });
    expect(checkMeasurement(0.09, 0.1, { abs: 0.02 }).pass).toBe(true);
  });
});

describe('cost', () => {
  test('half adder', () => {
    const c = costOf(halfAdder());
    expect(c).toMatchObject({ gates: 2, transistors: 14, depth: 1 });
  });
  test('depth follows the longest path', () => {
    const b = new CircuitBuilder('chain');
    b.input('A');
    const x = b.gate('not', ['A']);
    const y = b.gate('nand', [x, 'A']);
    b.gate('not', [y], 'Y');
    b.output('Y');
    const c = costOf(b.build());
    expect(c.depth).toBe(3);
    expect(c.transistors).toBe(2 + 4 + 2);
  });
});
