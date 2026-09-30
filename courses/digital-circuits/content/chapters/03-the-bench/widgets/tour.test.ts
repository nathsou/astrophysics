import { describe, expect, test } from 'vitest';
import { ledBrightness, measure, nextFault, taskStatus, type Meter, type Reading, type Rig, type Sample } from './tour';

const divider = (over: Partial<Rig> = {}): Rig => ({ scenario: 'divider', power: true, linkClosed: true, fault: -1, ...over });
const fault = (f: number, over: Partial<Rig> = {}): Rig => ({ scenario: 'fault', power: true, linkClosed: true, fault: f, ...over });
const plain = (t: string) => t.replace(/\u00a0/g, ' ');
const meter = (mode: Meter['mode'], red: Meter['red'], black: Meter['black']): Meter => ({ mode, red, black });

describe('divider', () => {
  test('voltages: 3 V across R2, 6 V across R1, 9 V across the battery', () => {
    expect(measure(divider(), meter('V', 'B', 'C'), false).value).toBeCloseTo(3, 2);
    expect(measure(divider(), meter('V', 'A', 'B'), false).value).toBeCloseTo(6, 2);
    expect(measure(divider(), meter('V', 'A', 'G'), false).value).toBeCloseTo(9, 2);
    expect(plain(measure(divider(), meter('V', 'B', 'C'), false).text)).toBe('3.00 V');
  });

  test('swapping the probes gives a minus sign', () => {
    const r = measure(divider(), meter('V', 'C', 'B'), false);
    expect(r.value).toBeCloseTo(-3, 2);
    expect(r.text.startsWith('−')).toBe(true);
  });

  test('current: the meter must be in series, in the gap where the jumper was', () => {
    const r = measure(divider({ linkClosed: false }), meter('A', 'C', 'G'), false);
    expect(r.kind).toBe('ok');
    expect(r.value).toBeCloseTo(1e-3, 5);
    expect(plain(r.text)).toBe('1.00 mA');
    // With the jumper in, the ammeter is in parallel with a wire and reads (almost) nothing.
    const shorted = measure(divider({ linkClosed: true }), meter('A', 'C', 'G'), false);
    expect(Math.abs(shorted.value)).toBeLessThan(1e-4);
  });

  test('an ammeter across the battery blows the fuse', () => {
    const r = measure(divider(), meter('A', 'A', 'G'), false);
    expect(r.blew).toBe(true);
    expect(r.kind).toBe('fuse');
    expect(Math.abs(r.value)).toBeGreaterThan(20);
    // Afterwards the range is open until the fuse is replaced.
    const after = measure(divider({ linkClosed: false }), meter('A', 'C', 'G'), true);
    expect(after.kind).toBe('fuse');
    expect(after.value).toBe(0);
  });

  test('resistance needs the power off; open circuits read OL; a wire beeps', () => {
    const off = divider({ power: false });
    expect(measure(off, meter('R', 'B', 'C'), false).value).toBeCloseTo(3000, 0);
    expect(measure(off, meter('R', 'A', 'G'), false).value).toBeCloseTo(9000, 0);
    expect(plain(measure(off, meter('R', 'B', 'C'), false).text)).toBe('3.00 kΩ');
    expect(measure(divider({ power: true }), meter('R', 'B', 'C'), false).kind).toBe('live');
    const open = measure(divider({ power: false, linkClosed: false }), meter('R', 'C', 'G'), false);
    expect(open.kind).toBe('open');
    expect(open.text).toBe('OL');
    const wire = measure(off, meter('C', 'C', 'G'), false);
    expect(wire.beep).toBe(true);
    expect(measure(off, meter('C', 'B', 'C'), false).beep).toBe(false);
  });
});

describe('fault circuit', () => {
  test('a healthy circuit lights the LED; an open resistor puts it out', () => {
    expect(ledBrightness(fault(-1))).toBeGreaterThan(0.05);
    for (const f of [0, 1, 2]) expect(ledBrightness(fault(f))).toBeLessThan(0.001);
  });

  test('the open resistor drops nearly the whole battery voltage; the others drop nothing', () => {
    const across = [
      ['A', 'P'],
      ['P', 'Q'],
      ['Q', 'R'],
    ] as const;
    for (const f of [0, 1, 2]) {
      across.forEach(([a, b], i) => {
        const v = measure(fault(f), meter('V', a, b), false).value;
        if (i === f) expect(v).toBeGreaterThan(7); // nearly all of it: the LED conducts a microamp through the meter
        else expect(Math.abs(v)).toBeLessThan(0.01);
      });
    }
  });

  test('with the power off, the open resistor reads OL and the healthy ones read their value', () => {
    const off = (f: number) => fault(f, { power: false });
    const rd = (f: number, a: 'A' | 'P' | 'Q', b: 'P' | 'Q' | 'R'): Reading => measure(off(f), meter('R', a, b), false);
    expect(rd(1, 'A', 'P').value).toBeCloseTo(470, 0);
    expect(rd(1, 'P', 'Q').kind).toBe('open');
    expect(rd(1, 'Q', 'R').value).toBeCloseTo(470, 0);
  });

  test('walking down from the top, the voltage to ground falls to zero at the open part', () => {
    const vg = (f: number, t: 'A' | 'P' | 'Q' | 'R') => measure(fault(f), meter('V', t, 'G'), false).value;
    expect(vg(1, 'A')).toBeCloseTo(9, 1);
    expect(vg(1, 'P')).toBeCloseTo(9, 1);
    expect(Math.abs(vg(1, 'Q'))).toBeLessThan(0.01);
    expect(Math.abs(vg(1, 'R'))).toBeLessThan(0.01);
  });
});

describe('tasks', () => {
  test('the log ticks the tasks off', () => {
    const sample = (over: Partial<Sample>): Sample => ({
      mode: 'V',
      scenario: 'divider',
      power: true,
      linkClosed: true,
      a: 'B',
      b: 'C',
      reading: measure(divider(), meter('V', 'B', 'C'), false),
      blew: false,
      ...over,
    });
    expect(taskStatus(0, []).every((t) => !t.done)).toBe(true);
    const s = taskStatus(0, [sample({}), sample({ a: 'G', b: 'A' })]);
    expect(s.map((t) => t.done)).toEqual([true, false, true]);
  });

  test('faults cycle through the three resistors', () => {
    expect([2, nextFault(2), nextFault(nextFault(2))].sort()).toEqual([0, 1, 2]);
    expect(nextFault(-1)).toBe(1);
  });
});
