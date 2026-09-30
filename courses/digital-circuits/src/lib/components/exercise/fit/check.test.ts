import { describe, expect, test } from 'vitest';
import { blankPla } from '$lib/studio/adapters/pla';
import { checkFit, checkFitSource, pinsOf, resourcesOf, type FitInput } from './check';
import { getAdapter } from '$lib/studio/adapters';

const comparator: FitInput = {
  id: 't/cmp',
  device: 'pla',
  spec: {
    truthTable: {
      inputs: ['A1', 'A0', 'B1', 'B0'],
      outputs: ['LT', 'EQ', 'GT'],
      rows: Array.from({ length: 16 }, (_, m) => `${(m >> 2).toString(2).padStart(2, '0')}${(m & 3).toString(2).padStart(2, '0')} ${(m >> 2) < (m & 3) ? 1 : 0}${(m >> 2) === (m & 3) ? 1 : 0}${(m >> 2) > (m & 3) ? 1 : 0}`),
    },
  },
  budget: { terms: 6 },
};
const table = (polarity: string) =>
  `${polarity}A1 A0 B1 B0 | LT EQ GT\n${Array.from({ length: 16 }, (_, m) => `${[...(m >> 2).toString(2).padStart(2, '0')].join(' ')} ${[...(m & 3).toString(2).padStart(2, '0')].join(' ')} | ${(m >> 2) < (m & 3) ? 1 : 0} ${(m >> 2) === (m & 3) ? 1 : 0} ${(m >> 2) > (m & 3) ? 1 : 0}`).join('\n')}\n`;

describe('fit: combinational specs on a PLA', () => {
  test('the function can be right and the budget still missed', () => {
    const high = checkFitSource(comparator, table(''));
    expect(high.functionOk).toBe(true);
    expect(high.pass).toBe(false);
    expect(high.resources.find((r) => r.key === 'terms')).toMatchObject({ used: 10, budget: 6, ok: false });
    const auto = checkFitSource(comparator, table('# @polarity auto\n'));
    expect(auto.pass).toBe(true);
    expect(auto.resources.find((r) => r.key === 'terms')!.used).toBe(6);
  });

  test('a wrong function is reported as inputs, what was wanted and what the device gave', () => {
    const r = checkFitSource(comparator, 'A1 A0 B1 B0 | LT EQ GT\n0 0 0 0 | 0 1 0\n');
    expect(r.functionOk).toBe(false);
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.length).toBeLessThanOrEqual(8);
    expect(Object.keys(r.rows[0]!.inputs)).toEqual(['A1', 'A0', 'B1', 'B0']);
    expect(r.rows[0]!.differ.length).toBeGreaterThan(0);
  });

  test('a PLA programmed by hand (a virgin device with named pins) is checked on its fuses', () => {
    const pins = pinsOf(comparator.spec);
    expect(pins).toEqual({ inputs: ['A1', 'A0', 'B1', 'B0'], outputs: ['LT', 'EQ', 'GT'] });
    const blank = blankPla(pins.inputs, pins.outputs);
    expect(checkFit(comparator, blank).pass).toBe(false);
    // One crossing at a time, as the chip view does it: GT = A1 & !B1 needs one term.
    let fit = blank;
    const toggle = (a: Parameters<NonNullable<typeof fit.edit>>[0]) => (fit = fit.edit!(a) as typeof blank);
    toggle({ type: 'toggle', plane: 'and', term: 0, input: 0, literal: 'complement' });
    expect(fit.edited).toBe(true);
  });

  test('source errors come back as errors, not as a failed check', () => {
    const r = checkFitSource(comparator, 'Y = A &');
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.pass).toBe(false);
  });

  test('an output the spec names that the device does not have is explained', () => {
    const r = checkFitSource(comparator, 'A1 A0 B1 B0 | LT EQ\n0 0 0 0 | 0 1\n');
    expect(r.problems[0]).toMatch(/no output called GT/);
  });
});

describe('fit: scripted steps on a GAL22V10', () => {
  const counter: FitInput = {
    id: 't/gal',
    device: 'gal22v10',
    spec: {
      buses: { Q: ['Q1', 'Q0'] },
      steps: [
        { set: { EN: 0 }, expect: { Q: 0 } },
        { set: { EN: 1 }, clock: 1, expect: { Q: 1 } },
        { clock: 2, expect: { Q: 3 } },
        { clock: 1, expect: { Q: 0 } },
        { set: { EN: 0 }, clock: 3, expect: { Q: 0 } },
      ],
    },
    budget: { terms: 2, registers: 2 },
  };
  const source = '# @clock CLK\nQ0.R = Q0 ^ EN\nQ1.R = Q1 ^ (EN & Q0)\n';

  test('the device is clocked from power-up and read after the edges', () => {
    const r = checkFitSource(counter, source);
    expect(r.functionOk).toBe(true);
    expect(r.resources.map((x) => `${x.key}:${x.used}`)).toEqual(['terms:5', 'macrocells:2', 'registers:2']);
    // Five terms against a budget of two.
    expect(r.pass).toBe(false);
    expect(checkFitSource({ ...counter, budget: { terms: 5, macrocells: 2, registers: 2 } }, source).pass).toBe(true);
  });

  test('a step that goes wrong names itself', () => {
    const r = checkFitSource({ ...counter, budget: undefined }, '# @clock CLK\nQ0.R = Q0 ^ EN\nQ1.R = Q1\n');
    expect(r.functionOk).toBe(false);
    expect(r.rows[0]!.step).toMatch(/step 3 \(after 2 clock edges\)/);
    expect(r.rows[0]!.got).toMatchObject({ Q1: '0', Q0: '1' });
  });

  test('`z` expects an output that is not driven', () => {
    const tri: FitInput = { id: 't/z', device: 'gal22v10', spec: { steps: [{ set: { A: 1, OE: 0 }, expect: { Y: 'z' } }, { set: { OE: 1 }, expect: { Y: 1 } }] } };
    expect(checkFitSource(tri, 'Y = A\nY.E = OE\n').pass).toBe(true);
    expect(checkFitSource(tri, 'Y = A\n').functionOk).toBe(false);
  });
});

describe('fit: state machines on a CPLD', () => {
  const toggle: FitInput = {
    id: 't/fsm',
    device: 'cpld32',
    spec: { fsm: { type: 'moore', inputs: ['T'], outputs: ['Q'], initial: 'off', states: { off: { out: '0', next: { '0': 'off', '1': 'on' } }, on: { out: '1', next: { '0': 'on', '1': 'off' } } } } },
    budget: { macrocells: 1 },
  };
  test('lock step from power-up against the table', () => {
    expect(checkFitSource(toggle, '# @clock CLK\nQ.R = Q ^ T\n').pass).toBe(true);
    const bad = checkFitSource(toggle, 'Q.R = Q | T\n');
    expect(bad.functionOk).toBe(false);
    expect(bad.rows.length).toBeGreaterThan(0);
    expect(bad.rows[bad.rows.length - 1]!.step).toMatch(/cycle \d+, (before|after) the clock edge/);
  });
  test('a buried macrocell counts', () => {
    const r = checkFitSource(toggle, '# @buried X\nX = T\nQ.R = Q ^ X\n');
    expect(r.functionOk).toBe(true);
    expect(r.resources.find((x) => x.key === 'macrocells')).toMatchObject({ used: 2, ok: false });
  });
});

describe('resources', () => {
  test('a product term shared by two outputs counts once', () => {
    const fit = (getAdapter('pla')!.program('X = A & B\nY = A & B\n') as { ok: true; fit: import('$lib/studio/types').DeviceFit }).fit;
    expect(resourcesOf(fit).find((r) => r.key === 'terms')!.used).toBe(1);
    expect(resourcesOf(fit, { literals: 1 }).find((r) => r.key === 'literals')).toMatchObject({ used: 2, ok: false });
  });
});
