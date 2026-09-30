import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { checkSequential } from '$lib/sim/check';
import {
  allInputs,
  guardText,
  matches,
  mealyToMoore,
  mergePatterns,
  mooreToMealy,
  reachable,
  stateTable,
  step,
  toFsmInput,
  validate,
  type Fsm,
} from './fsm';
import { BLANK, DETECTOR, LOCK, PRESETS, TRAFFIC_LIGHT, UART_RX, VENDING } from './presets';

/** A stream of pseudo-random input vectors. */
function stream(n: number, len: number, seed: number): number[][] {
  let a = seed;
  const r = () => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) >>> 8) & 0xffff;
  return Array.from({ length: len }, () => Array.from({ length: n }, () => (r() & 1 ? 1 : 0)));
}

describe('patterns', () => {
  test('a dash matches either bit', () => {
    expect(matches('1-', [1, 0])).toBe(true);
    expect(matches('1-', [0, 1])).toBe(false);
    expect(matches('', [])).toBe(true);
  });
  test('every input vector, first input most significant', () => {
    expect(allInputs(2)).toEqual([[0, 0], [0, 1], [1, 0], [1, 1]]);
    expect(allInputs(0)).toEqual([[]]);
  });
  test('guards read like code', () => {
    expect(guardText('1-0', ['a', 'b', 'c'])).toBe('a & !c');
    expect(guardText('--', ['a', 'b'])).toBe('any');
  });
  test('minterms merge into patterns', () => {
    expect(mergePatterns(['00', '01']).sort()).toEqual(['0-']);
    expect(mergePatterns(['00', '01', '10', '11'])).toEqual(['--']);
    expect(mergePatterns(['01', '10']).sort()).toEqual(['01', '10']);
  });
});

describe('the presets are valid machines', () => {
  for (const p of PRESETS) {
    test(p.label, () => {
      expect(validate(p.fsm).filter((x) => x.level === 'error')).toEqual([]);
      expect(reachable(p.fsm).size).toBe(p.fsm.states.length);
    });
  }
  test('the blank machine is valid', () => {
    expect(validate(BLANK)).toEqual([]);
  });
});

describe('behaviour', () => {
  test('the traffic light walks its ring only while tick is high', () => {
    let s = 'Red';
    const seen: string[] = [];
    for (const tick of [1, 0, 0, 1, 1, 1, 1]) {
      s = step(TRAFFIC_LIGHT, s, [tick]).next;
      seen.push(s);
    }
    expect(seen).toEqual(['RedAmber', 'RedAmber', 'RedAmber', 'Green', 'Amber', 'Red', 'RedAmber']);
  });
  test('a Moore machine shows the outputs of its state; a Mealy machine those of its arrow', () => {
    expect(step(TRAFFIC_LIGHT, 'RedAmber', [0]).out).toBe('110');
    expect(step(VENDING, 'Has5', [0, 1]).out).toBe('1');
    expect(step(VENDING, 'Has5', [1, 0]).out).toBe('0');
    // No arrow for both coins at once: it stays, and outputs nothing.
    expect(step(VENDING, 'Has5', [1, 1])).toMatchObject({ next: 'Has5', out: '0', via: null });
  });
  test('the detector finds 1011, with overlap', () => {
    let s = 'Idle';
    const found: number[] = [];
    [...'1011011'].forEach((c, i) => {
      const r = step(DETECTOR, s, [+c]);
      s = r.next;
      if (r.out === '1') found.push(i);
    });
    expect(found).toEqual([3, 6]);
  });
  test('the lock opens on 2, 0, 3 and nothing else', () => {
    const digits = (ds: number[]) => {
      let s = 'Locked';
      let opened = false;
      for (const d of ds) {
        s = step(LOCK, s, [d >> 1, d & 1]).next;
        if (s === 'Open') opened = true;
      }
      return opened;
    };
    expect(digits([2, 0, 3])).toBe(true);
    expect(digits([1, 2, 0, 3])).toBe(true);
    expect(digits([2, 0, 2])).toBe(false);
    expect(digits([2, 1, 3])).toBe(false);
    expect(digits([3, 0, 2])).toBe(false);
  });
  test('the UART control walks idle, start, data, stop', () => {
    let s = 'Idle';
    const trace: string[] = [];
    for (const [rx, last] of [[1, 0], [0, 0], [0, 0], [1, 0], [1, 1], [1, 0], [1, 0]]) {
      s = step(UART_RX, s, [rx!, last!]).next;
      trace.push(s);
    }
    expect(trace).toEqual(['Idle', 'Start', 'Data', 'Data', 'Stop', 'Idle', 'Idle']);
  });
});

describe('validation', () => {
  const base = (): Fsm => structuredClone(TRAFFIC_LIGHT);
  test('two arrows that both apply must agree', () => {
    const f = base();
    f.transitions.push({ from: 'Red', to: 'Green', when: '-' });
    const p = validate(f);
    expect(p[0]).toMatchObject({ level: 'error' });
    expect(p[0]!.text).toMatch(/In state Red.*RedAmber and Green both apply/);
  });
  test('overlapping arrows to the same place are fine', () => {
    const f = base();
    f.transitions.push({ from: 'Red', to: 'RedAmber', when: '-' });
    expect(validate(f)).toEqual([]);
  });
  test('Mealy arrows with different outputs clash', () => {
    const f = structuredClone(VENDING);
    f.transitions.push({ from: 'Empty', to: 'Has5', when: '1-', out: '1' });
    expect(validate(f).some((x) => x.level === 'error' && /both apply/.test(x.text))).toBe(true);
  });
  test('names, patterns and sizes are checked', () => {
    const f = base();
    f.states[1]!.name = 'Red';
    expect(validate(f).some((x) => /Two states are called Red/.test(x.text))).toBe(true);
    const g = base();
    g.transitions[0]!.when = '11';
    expect(validate(g).some((x) => /pattern of 1 characters/.test(x.text))).toBe(true);
    const h = base();
    h.states = [h.states[0]!];
    h.transitions = [];
    expect(validate(h).some((x) => /at least two states/.test(x.text))).toBe(true);
    const k = base();
    k.inputs = ['clk'];
    expect(validate(k).some((x) => /reserved/.test(x.text))).toBe(true);
  });
  test('unreachable states are a warning, not an error', () => {
    const f = base();
    f.states.push({ name: 'Broken', out: '000' });
    const p = validate(f);
    expect(p).toEqual([{ level: 'warning', text: expect.stringMatching(/Broken can never be reached/) }]);
  });
});

describe('the state table', () => {
  test('lists arrows and the inputs that keep the machine where it is', () => {
    const rows = stateTable(TRAFFIC_LIGHT);
    expect(rows).toHaveLength(8);
    expect(rows.filter((r) => r.implicit).map((r) => [r.state, r.when, r.next])).toEqual([
      ['Red', '0', 'Red'],
      ['RedAmber', '0', 'RedAmber'],
      ['Green', '0', 'Green'],
      ['Amber', '0', 'Amber'],
    ]);
    const vend = stateTable(VENDING).filter((r) => r.state === 'Empty');
    // Empty: five → Has5, ten → Has10, and "neither" or "both" stay.
    expect(vend.filter((r) => r.implicit).map((r) => r.when).sort()).toEqual(['00', '11']);
  });
});

describe('Mealy and Moore', () => {
  test('a Moore machine is a Mealy machine with the state output on every arrow', () => {
    const m = mooreToMealy(TRAFFIC_LIGHT);
    expect(m.kind).toBe('mealy');
    for (const seq of [stream(1, 60, 1), stream(1, 60, 2)]) {
      let a = 'Red';
      let b = 'Red';
      for (const v of seq) {
        const ra = step(TRAFFIC_LIGHT, a, v);
        const rb = step(m, b, v);
        expect(rb.out).toBe(ra.out);
        a = ra.next;
        b = rb.next;
      }
    }
  });
  test('converting a Mealy machine to Moore adds states and delays every output by one cycle', () => {
    for (const mealy of [DETECTOR, VENDING]) {
      const moore = mealyToMoore(mealy);
      expect(moore.kind).toBe('moore');
      expect(validate(moore).filter((x) => x.level === 'error')).toEqual([]);
      expect(moore.states.length).toBeGreaterThan(mealy.states.length);
      for (const seed of [3, 4, 5]) {
        let a = mealy.states[0]!.name;
        let b = moore.states[0]!.name;
        let previous = '0'.repeat(mealy.outputs.length);
        for (const v of stream(mealy.inputs.length, 200, seed)) {
          const ra = step(mealy, a, v);
          const rb = step(moore, b, v);
          expect(rb.out).toBe(previous);
          previous = ra.out;
          a = ra.next;
          b = rb.next;
        }
      }
    }
  });
  test('the detector costs one extra state as a Moore machine', () => {
    expect(mealyToMoore(DETECTOR).states.map((s) => s.name)).toEqual(['Idle', 'Got1', 'Got10', 'Got101', 'Got1_1']);
  });
});

describe('the exercise checker agrees', () => {
  test('toFsmInput is a valid table for the sequential checker', () => {
    // A circuit checked against the table: the table itself as a machine, via a trivial reference is not
    // possible here, so check that the table is accepted and complete by simulating it.
    for (const p of PRESETS) {
      const t = toFsmInput(p.fsm);
      expect(Object.keys(t.states)).toEqual(p.fsm.states.map((s) => s.name));
      for (const st of Object.values(t.states)) expect(Object.keys(st.next)).toHaveLength(1 << p.fsm.inputs.length);
      expect(() => checkSequential({ version: 1, engine: 'digital', components: [], wires: [] }, { fsm: t })).not.toThrow();
    }
  });
});
